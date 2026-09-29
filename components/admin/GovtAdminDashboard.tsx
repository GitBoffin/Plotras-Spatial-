"use client";

// =====================================================================
// PLOTRAS — Government Admin Dashboard
// =====================================================================
// Phase 3 scope: "Government administrative dashboard." Aggregates
// what a GOVT_ADMIN actually needs to act on: parcels awaiting
// charting approval (the one concrete state transition this dashboard
// drives — see fn_approve_charting), portfolio-wide counts, and a
// recent activity feed.
//
// Honest gap: there is no surveyor submission workflow yet (uploading
// draft beacons -> DRAFT_SURVEY -> PENDING_CHARTING is automatic once
// spatial validation passes, per the PRD's state diagram, but nothing
// in this app currently lets a surveyor create that parcel in the
// first place). So "Pending Charting Approvals" will show nothing in
// practice until that's built — this dashboard is the approval half
// of a two-sided workflow, not the whole thing.
// =====================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadCsv } from "@/lib/csv/toCsv";

interface OverviewCounts {
  total_parcels: number;
  pending_charting: number;
  state_approved: number;
  mortgage_locked: number;
  govt_zones: number;
  active_liens: number;
  discharged_liens: number;
  pending_role_requests: number;
}

interface PendingParcel {
  id: string;
  spatial_id: string;
  state_code: string;
  lga: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  action: string;
  timestamp: string;
}

interface PendingTransfer {
  id: string;
  instrument_type: string;
  status: string;
  timestamp: string;
  parcels: { spatial_id: string } | null;
}

export default function GovtAdminDashboard() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [pending, setPending] = useState<PendingParcel[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [transfers, setTransfers] = useState<PendingTransfer[]>([]);
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    const { data: countsData } = await supabaseBrowser.rpc("fn_admin_overview_counts");
    setCounts(countsData?.[0] ?? null);

    const { data: pendingData } = await supabaseBrowser
      .from("parcels")
      .select("id, spatial_id, state_code, lga, created_at")
      .eq("status", "PENDING_CHARTING")
      .order("created_at", { ascending: true });
    setPending(pendingData ?? []);

    const { data: activityData } = await supabaseBrowser
      .from("audit_logs")
      .select("id, entity_type, action, timestamp")
      .order("timestamp", { ascending: false })
      .limit(15);
    setActivity(activityData ?? []);

    const { data: transferData } = await supabaseBrowser
      .from("title_transfers")
      .select("id, instrument_type, status, timestamp, parcels(spatial_id)")
      .eq("status", "PENDING")
      .order("timestamp", { ascending: true });
    setTransfers((transferData as unknown as PendingTransfer[]) ?? []);
  }

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (!session) {
        setRole(null);
        return;
      }
      const { data } = await supabaseBrowser.from("users").select("role").eq("id", session.user.id).single();
      setRole(data?.role ?? null);
      if (data?.role === "GOVT_ADMIN") await loadAll();
    }
    init();
  }, []);

  async function approveCharting(spatialId: string) {
    setBusyId(spatialId);
    setError(null);
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/v1/govt/charting/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ spatial_id: spatialId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message ?? "Could not approve charting.");
    } else {
      await loadAll();
    }
    setBusyId(null);
  }

  async function reviewTransfer(transferId: string, approve: boolean) {
    setBusyTransferId(transferId);
    setError(null);
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/v1/title/transfer/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ transfer_id: transferId, approve }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error?.message ?? "Could not review the transfer.");
    } else {
      await loadAll();
    }
    setBusyTransferId(null);
  }

  async function exportParcels() {
    const { data } = await supabaseBrowser
      .from("parcels")
      .select("spatial_id, status, state_code, lga, title_type, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (data) downloadCsv("plotras-parcels.csv", data);
  }

  async function exportAuditLog() {
    const { data } = await supabaseBrowser
      .from("audit_logs")
      .select("entity_type, entity_id, action, performed_by, timestamp")
      .order("timestamp", { ascending: false })
      .limit(1000);
    if (data) downloadCsv("plotras-audit-log.csv", data);
  }

  if (role === "loading") return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;

  if (role !== "GOVT_ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          This dashboard is only available to GOVT_ADMIN accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="mb-2 text-sm text-brass">Government Operations</p>
          <h1 className="font-serif text-3xl text-foreground">Admin Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportParcels} className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            Export Parcels
          </button>
          <button onClick={exportAuditLog} className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            Export Audit Log
          </button>
          <Link href="/admin/zones" className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            Zones
          </Link>
          <Link href="/admin/role-requests" className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            Role Requests
          </Link>
          <Link href="/bank/dashboard" className="rounded-card border border-border px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground">
            Bank Liens
          </Link>
        </div>
      </div>

      {counts && (
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total parcels" value={counts.total_parcels} />
          <StatCard label="Awaiting charting" value={counts.pending_charting} highlight={counts.pending_charting > 0} />
          <StatCard label="State approved" value={counts.state_approved} />
          <StatCard label="Mortgage locked" value={counts.mortgage_locked} />
          <StatCard label="Govt. zones" value={counts.govt_zones} />
          <StatCard label="Active liens" value={counts.active_liens} />
          <StatCard label="Discharged liens" value={counts.discharged_liens} />
          <StatCard label="Pending role requests" value={counts.pending_role_requests} highlight={counts.pending_role_requests > 0} />
        </div>
      )}

      <h2 className="mb-3 font-serif text-xl text-foreground">Pending Charting Approvals</h2>
      {error && <p className="mb-4 text-sm text-signal-red">{error}</p>}
      {pending.length === 0 ? (
        <p className="mb-10 text-sm text-foreground-muted">
          Nothing awaiting charting approval right now.
        </p>
      ) : (
        <div className="mb-10 space-y-2">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-card border border-border bg-canvas-raised px-5 py-3">
              <div>
                <p className="text-sm text-foreground">{p.spatial_id}</p>
                <p className="text-xs text-foreground-faint">{p.lga}, {p.state_code}</p>
              </div>
              <button
                onClick={() => approveCharting(p.spatial_id)}
                disabled={busyId === p.spatial_id}
                className="rounded-card bg-brass px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busyId === p.spatial_id ? "Approving…" : "Approve Charting"}
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-serif text-xl text-foreground">Pending Title Transfers</h2>
      {transfers.length === 0 ? (
        <p className="mb-10 text-sm text-foreground-muted">No transfers awaiting approval.</p>
      ) : (
        <div className="mb-10 space-y-2">
          {transfers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-card border border-border bg-canvas-raised px-5 py-3">
              <div>
                <p className="text-sm text-foreground">{t.parcels?.spatial_id ?? "—"}</p>
                <p className="text-xs text-foreground-faint">{t.instrument_type}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => reviewTransfer(t.id, true)}
                  disabled={busyTransferId === t.id}
                  className="rounded-card bg-brass px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => reviewTransfer(t.id, false)}
                  disabled={busyTransferId === t.id}
                  className="rounded-card border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-signal-red disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-serif text-xl text-foreground">Recent Activity</h2>
      <div className="overflow-hidden rounded-card border border-border">
        <table className="w-full text-left text-sm">
          <tbody>
            {activity.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-foreground-muted">{a.entity_type}</td>
                <td className="px-4 py-2.5 text-foreground">{a.action}</td>
                <td className="px-4 py-2.5 text-xs text-foreground-faint">
                  {new Date(a.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-card border p-4" style={{ borderColor: highlight ? "#B8935A" : "#2A2A2A" }}>
      <p className="mb-1 text-xs text-foreground-muted">{label}</p>
      <p className="font-serif text-2xl text-foreground">{value}</p>
    </div>
  );
}
