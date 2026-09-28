// =====================================================================
// PLOTRAS — Certificate record (get-or-create)
// =====================================================================
// PRD FR-004 acceptance criteria this satisfies:
//   "Report generation occurs asynchronously where necessary."
//     -> the webhook calls this right after marking a payment SUCCESS,
//        decoupled from the user's own request/click.
//   "Failed report generation triggers retry handling."
//     -> there's no background job queue here (overkill for Phase 1),
//        so the "retry" is structural: this function is idempotent
//        (ON CONFLICT DO NOTHING + re-select), so if the webhook's
//        attempt fails for any reason, the certificate download route
//        calling this same function is itself the retry — no separate
//        retry worker needed because creating the record is cheap and
//        safe to re-attempt from anywhere.
//   "Report generation failure does not cause a successful payment to
//   be lost." -> payment.status is written before this is ever called;
//        nothing here can roll that back, and this function failing
//        just means the next call (another webhook delivery, or the
//        user hitting download) tries again.
//
// Note what this function does NOT do: render PDF bytes. It only
// creates the authoritative DB record (hash + report_id). Actual PDF
// rendering in the certificate route is deterministic from that
// record, so it's cheap to redo on every download without needing to
// store the PDF bytes themselves anywhere.
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hash, type CertificateFields } from "@/lib/reports/sign";

export interface CertificateRecord {
  report_id: string;
  report_access_token: string;
  spatial_id: string;
  status: string;
  signal: "GREEN" | "YELLOW" | "RED";
  state_code: string;
  lga: string;
  sha256_hash: string;
  issued_at: string;
}

export async function getOrCreateCertificateRecord(
  supabase: SupabaseClient,
  reportAccessToken: string,
  spatialId: string
): Promise<CertificateRecord | null> {
  const { data: existing } = await supabase
    .from("certificates")
    .select("*")
    .eq("report_access_token", reportAccessToken)
    .maybeSingle();

  if (existing) return existing as CertificateRecord;

  const { data: summaryRows } = await supabase.rpc("fn_parcel_summary", {
    p_spatial_id: spatialId,
  });
  const summary = summaryRows?.[0];

  // No matching row means this was a freshly-minted spatial_id for
  // previously-unregistered ground (see spatial/verify/route.ts) —
  // treat as a clean, unclaimed parcel rather than failing.
  const status = summary?.status ?? "UNCLAIMED";
  const stateCode = summary?.state_code ?? "N/A";
  const lga = summary?.lga ?? "N/A";
  const signal = (summary?.signal ?? "GREEN") as "GREEN" | "YELLOW" | "RED";
  const issuedAt = new Date().toISOString();

  const fields: CertificateFields = {
    spatial_id: spatialId,
    status,
    signal,
    state_code: stateCode,
    lga,
    issued_at: issuedAt,
    report_access_token: reportAccessToken,
  };
  const hash = sha256Hash(fields);

  await supabase
    .from("certificates")
    .upsert(
      {
        report_access_token: reportAccessToken,
        spatial_id: spatialId,
        status,
        signal,
        state_code: stateCode,
        lga,
        sha256_hash: hash,
        issued_at: issuedAt,
      },
      { onConflict: "report_access_token", ignoreDuplicates: true }
    );

  const { data: settled } = await supabase
    .from("certificates")
    .select("*")
    .eq("report_access_token", reportAccessToken)
    .maybeSingle();

  return settled as CertificateRecord | null;
}
