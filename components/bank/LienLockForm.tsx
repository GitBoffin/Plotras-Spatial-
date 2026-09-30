"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LienLockForm() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [spatialId, setSpatialId] = useState("");
  const [loanReference, setLoanReference] = useState("");
  const [facilityAmount, setFacilityAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    async function checkRole() {
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
    }
    checkRole();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    if (!session) {
      setError({ code: "ERR_UNAUTHENTICATED", message: "Sign in as a bank officer first." });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/bank/lien-lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          // A fresh key per submission — a genuine retry of the same
          // click should reuse this value instead of generating a new
          // one, but that requires holding it in state across a retry
          // affordance we haven't built yet.
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          spatial_id: spatialId.trim(),
          loan_reference_no: loanReference.trim(),
          facility_amount: parseFloat(facilityAmount),
          bank_code: bankCode.trim(),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error);
      } else {
        setResult(body.message);
        setSpatialId("");
        setLoanReference("");
        setFacilityAmount("");
      }
    } catch {
      setError({ code: "ERR_NETWORK", message: "Could not reach the lien-lock service." });
    } finally {
      setSubmitting(false);
    }
  }

  if (role === "loading") {
    return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;
  }

  if (role !== "BANK_OFFICER") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          This page is only available to BANK_OFFICER accounts. Sign in with one, or
          apply for the Bank officer role from your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <p className="mb-2 text-sm text-brass">Bank Operations</p>
      <h1 className="mb-3 font-serif text-3xl text-foreground">Register a Lien Lock</h1>
      <p className="mb-10 text-sm leading-relaxed text-foreground-muted">
        Locks a STATE_APPROVED parcel against your facility. The parcel status flips
        to MORTGAGE_LOCKED and the lien shows as an active YELLOW signal on every
        future spatial check until it's discharged.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Spatial ID">
          <input
            value={spatialId}
            onChange={(e) => setSpatialId(e.target.value)}
            placeholder="SP-LAG-DEMO-GREEN"
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
          />
        </Field>
        <Field label="Loan reference number">
          <input
            value={loanReference}
            onChange={(e) => setLoanReference(e.target.value)}
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          />
        </Field>
        <Field label="Facility amount (₦)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={facilityAmount}
            onChange={(e) => setFacilityAmount(e.target.value)}
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          />
        </Field>
        <Field label="Bank code">
          <input
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          />
        </Field>

        {error && (
          <div className="rounded-card border border-signal-red-border bg-signal-red-bg px-4 py-3">
            <p className="font-mono text-xs text-foreground-muted">{error.code}</p>
            <p className="mt-1 text-sm text-foreground">{error.message}</p>
          </div>
        )}
        {result && (
          <div className="rounded-card border border-signal-green-border bg-signal-green-bg px-4 py-3 text-sm text-foreground">
            {result}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-card bg-brass px-5 py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Register Lien Lock"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-foreground-muted">{label}</span>
      {children}
    </label>
  );
}
