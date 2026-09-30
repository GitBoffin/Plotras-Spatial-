"use client";

// =====================================================================
// PLOTRAS — Bank Officer Dashboard
// =====================================================================
// Phase 2 scope: "BANK_OFFICER dashboard." Shows the signed-in bank
// officer's own lien portfolio (encumbrances.bank_id = auth.uid(),
// enforced by RLS — see encumbrances_read_policy migration), not just
// the lock/discharge forms in isolation. GOVT_ADMIN sees every bank's
// portfolio (same RLS policy grants that).
// =====================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv/toCsv";

interface LienRow {
  id: string;
  loan_reference: string;
  amount: number;
  status: "ACTIVE" | "DISCHARGED";
  registered_at: string;
  discharged_at: string | null;
  parcels: {
    spatial_id: string;
    status: string;
    state_code: string;
    lga: string;
  } | null;
}

export default function BankDashboard() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [liens, setLiens] = useState<LienRow[]>([]);
  const [loadingLiens, setLoadingLiens] = useState(true);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (!session) {
        setRole(null);
        return;
      }

      const { data: profile } = await supabaseBrowser
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setRole(profile?.role ?? null);

      if (profile?.role === "BANK_OFFICER" || profile?.role === "GOVT_ADMIN") {
        const { data } = await supabaseBrowser
          .from("encumbrances")
          .select(
            "id, loan_reference, amount, status, registered_at, discharged_at, parcels(spatial_id, status, state_code, lga)"
          )
          .order("registered_at", { ascending: false });
        setLiens((data as unknown as LienRow[]) ?? []);
      }
      setLoadingLiens(false);
    }
    init();
  }, []);

  if (role === "loading") {
    return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;
  }

  if (role !== "BANK_OFFICER" && role !== "GOVT_ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          This dashboard is only available to BANK_OFFICER or GOVT_ADMIN accounts.
        </p>
      </div>
    );
  }

  const active = liens.filter((l) => l.status === "ACTIVE");
  const discharged = liens.filter((l) => l.status === "DISCHARGED");
  const totalActiveValue = active.reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="mb-2 text-sm text-brass">Bank Operations</p>
          <h1 className="font-serif text-3xl text-foreground">
            {role === "GOVT_ADMIN" ? "All Bank Liens" : "Your Lien Portfolio"}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadCsv(
                "plotras-lien-portfolio.csv",
                liens.map((l) => ({
                  spatial_id: l.parcels?.spatial_id ?? "",
                  loan_reference: l.loan_reference,
                  amount: l.amount,
                  status: l.status,
                  registered_at: l.registered_at,
                  discharged_at: l.discharged_at ?? "",
                }))
              )
            }
            disabled={liens.length === 0}
            className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground disabled:opacity-40"
          >
            Export CSV
          </button>
          {role === "BANK_OFFICER" && (
            <Link
              href="/bank/api-keys"
              className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              API Keys
            </Link>
          )}
          <Link
            href="/bank/lien-lock"
            className="rounded-card bg-brass px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Lock / Discharge
          </Link>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-3 gap-4">
        <StatCard label="Active liens" value={active.length.toString()} />
        <StatCard label="Discharged" value={discharged.length.toString()} />
        <StatCard label="Active facility value" value={`₦${totalActiveValue.toLocaleString()}`} />
      </div>

      {loadingLiens ? (
        <p className="text-sm text-foreground-muted">Loading portfolio…</p>
      ) : liens.length === 0 ? (
        <p className="text-sm text-foreground-muted">No liens registered yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-canvas-raised text-xs text-foreground-muted">
                <th className="px-4 py-3 font-normal">Spatial ID</th>
                <th className="px-4 py-3 font-normal">Loan reference</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Registered</th>
              </tr>
            </thead>
            <tbody>
              {liens.map((lien) => (
                <tr key={lien.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{lien.parcels?.spatial_id ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground-muted">{lien.loan_reference}</td>
                  <td className="px-4 py-3 text-foreground">₦{Number(lien.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: lien.status === "ACTIVE" ? "#EAB308" : "#22C55E" }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-seal"
                        style={{ backgroundColor: lien.status === "ACTIVE" ? "#EAB308" : "#22C55E" }}
                      />
                      {lien.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-faint">
                    {new Date(lien.registered_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-canvas-raised p-4">
      <p className="mb-1 text-xs text-foreground-muted">{label}</p>
      <p className="font-serif text-2xl text-foreground">{value}</p>
    </div>
  );
}
