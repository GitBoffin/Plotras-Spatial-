// =====================================================================
// PLOTRAS — Shared spatial verification core
// =====================================================================
// Extracted from app/api/v1/spatial/verify/route.ts so the new B2B
// endpoint (app/api/v1/b2b/title-verification) runs the exact same
// validation, collision-detection, and signal-evaluation logic rather
// than a parallel copy that could silently drift out of sync. Auth and
// rate limiting are deliberately NOT in here — those differ between
// the consumer route (JWT + 10/min/IP) and the B2B route (API key +
// 500/min/client), so each caller handles its own.
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { signedRingArea, findSelfIntersection } from "@/lib/geometry/validatePolygon";

export const BeaconSchema = z.object({
  beacon_no: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const VerifyRequestSchema = z.object({
  search_mode: z.literal("BEACONS"),
  beacons: z.array(BeaconSchema),
});

export type VerifySignal = "GREEN" | "YELLOW" | "RED";

export interface VerifyResponseData {
  spatial_id: string;
  signal: VerifySignal;
  overlap_percentage: number;
  encumbrances_found: boolean;
  govt_acquisition: string | null;
  unlock_fee_naira: number;
  report_access_token: string;
}

export interface VerifyFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
  details?: unknown[];
}

export interface VerifySuccess {
  ok: true;
  data: VerifyResponseData;
  auditContext: { beaconCount: number; sourceSrid: number; targetSrid: number };
}

interface CollisionRow {
  spatial_id: string | null;
  parcel_status: string | null;
  overlap_percentage: number | null;
  loan_reference: string | null;
  lien_status: string | null;
  govt_acquisition_zone: string | null;
}

const UNLOCK_FEE_NAIRA = 2500;
const TARGET_SRID = 26331; // Minna / UTM Zone 31N — PRD's Phase 1 worked example
const MATERIAL_OVERLAP_THRESHOLD_PCT = 5;


function evaluateSignal(rows: CollisionRow[]) {
  const govtHit = rows.find((r) => r.govt_acquisition_zone !== null);
  const maxOverlap = rows.reduce((max, r) => Math.max(max, r.overlap_percentage ?? 0), 0);
  const materialParcelOverlap = rows.some(
    (r) => r.spatial_id !== null && (r.overlap_percentage ?? 0) > MATERIAL_OVERLAP_THRESHOLD_PCT
  );
  const activeLien = rows.find((r) => r.lien_status === "ACTIVE");

  if (govtHit || materialParcelOverlap) {
    return {
      signal: "RED" as VerifySignal,
      overlap_percentage: maxOverlap,
      encumbrances_found: Boolean(activeLien),
      govt_acquisition: govtHit?.govt_acquisition_zone ?? null,
    };
  }
  if (activeLien) {
    return { signal: "YELLOW" as VerifySignal, overlap_percentage: maxOverlap, encumbrances_found: true, govt_acquisition: null };
  }
  return { signal: "GREEN" as VerifySignal, overlap_percentage: 0, encumbrances_found: false, govt_acquisition: null };
}

export async function runSpatialVerification(
  supabase: SupabaseClient,
  beacons: z.infer<typeof BeaconSchema>[]
): Promise<VerifySuccess | VerifyFailure> {
  if (beacons.length < 4) {
    return {
      ok: false,
      status: 422,
      code: "ERR_INVALID_GEOMETRY_MIN_BEACONS",
      message: "At least 4 beacon coordinates are required to form a valid parcel boundary.",
    };
  }

  const invalidIndex = beacons.findIndex((b) => !Number.isFinite(b.lat) || !Number.isFinite(b.lng));
  if (invalidIndex !== -1) {
    return {
      ok: false,
      status: 422,
      code: "ERR_INVALID_COORDINATE",
      message: "One or more submitted coordinates are invalid.",
      details: [{ vertex_index: invalidIndex, coordinate: [beacons[invalidIndex].lat, beacons[invalidIndex].lng] }],
    };
  }

  if (signedRingArea(beacons) === 0) {
    return { ok: false, status: 422, code: "ERR_DEGENERATE_POLYGON", message: "The submitted coordinates enclose zero area." };
  }

  const intersectionVertex = findSelfIntersection(beacons);
  if (intersectionVertex !== null) {
    return {
      ok: false,
      status: 422,
      code: "ERR_SELF_INTERSECTING_POLYGON",
      message: "The coordinates provided form a self-intersecting polygon.",
      details: [{ vertex_index: intersectionVertex, coordinate: [beacons[intersectionVertex].lat, beacons[intersectionVertex].lng] }],
    };
  }

  const beaconPoints = beacons.map((b) => ({ lat: b.lat, lng: b.lng }));

  const { data, error } = await supabase.rpc("fn_beacons_to_collision_check", {
    beacon_points: beaconPoints,
    target_srid: TARGET_SRID,
  });

  if (error) {
    if (error.message?.includes("ERR_INVALID_GEOMETRY_MIN_BEACONS")) {
      return {
        ok: false,
        status: 422,
        code: "ERR_INVALID_GEOMETRY_MIN_BEACONS",
        message: "At least 4 beacon coordinates are required to form a valid parcel boundary.",
      };
    }
    return { ok: false, status: 500, code: "ERR_SPATIAL_ENGINE_FAILURE", message: "The spatial collision engine failed to evaluate the submitted geometry." };
  }

  const rows = (data ?? []) as CollisionRow[];
  const { signal, overlap_percentage, encumbrances_found, govt_acquisition } = evaluateSignal(rows);

  const matchedParcel = rows.find((r) => r.spatial_id !== null);
  const spatial_id = matchedParcel?.spatial_id ?? `SP-NEW-${randomUUID().slice(0, 8).toUpperCase()}`;

  return {
    ok: true,
    data: {
      spatial_id,
      signal,
      overlap_percentage: Math.round(overlap_percentage * 100) / 100,
      encumbrances_found,
      govt_acquisition,
      unlock_fee_naira: UNLOCK_FEE_NAIRA,
      report_access_token: randomUUID(),
    },
    auditContext: { beaconCount: beacons.length, sourceSrid: 4326, targetSrid: TARGET_SRID },
  };
}
