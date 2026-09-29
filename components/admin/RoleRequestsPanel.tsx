"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface RoleRequest {
  id: string;
  user_id: string;
  requested_role: string;
  bank_code: string | null;
  status: string;
  created_at: string;
}

export default function RoleRequestsPanel() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadRequests() {
    const { data } = await supabaseBrowser
      .from("role_requests")
      .select("id, user_id, requested_role, bank_code, status, created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });
    setRequests(data ?? []);
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
      const { data } = await supabaseBrowser
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setRole(data?.role ?? null);
      if (data?.role === "GOVT_ADMIN") await loadRequests();
    }
    init();
  }, []);

  async function review(id: string, approve: boolean) {
    setBusyId(id);
    const { error } = await supabaseBrowser.rpc("fn_review_role_request", {
      p_request_id: id,
      p_approve: approve,
    });
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setBusyId(null);
  }

  if (role === "loading") {
    return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;
  }

  if (role !== "GOVT_ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          This page is only available to GOVT_ADMIN accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 font-serif text-3xl text-foreground">Role Requests</h1>

      {requests.length === 0 ? (
        <p className="text-sm text-foreground-muted">No pending requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-card border border-border bg-canvas-raised px-5 py-4"
            >
              <div>
                <p className="text-sm text-foreground">
                  {r.requested_role}
                  {r.bank_code && (
                    <span className="text-foreground-muted"> — bank code {r.bank_code}</span>
                  )}
                </p>
                <p className="text-xs text-foreground-faint">User {r.user_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => review(r.id, true)}
                  className="rounded-card bg-brass px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => review(r.id, false)}
                  className="rounded-card border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-signal-red disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
