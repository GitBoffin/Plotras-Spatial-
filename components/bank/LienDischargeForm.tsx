"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LienDischargeForm() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [spatialId, setSpatialId] = useState("");
  const [loanReference, setLoanReference] = useState("");
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
      const res = await fetch("/api/v1/bank/lien-discharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          spatial_id: spatialId.trim(),
          loan_reference_no: loanReference.trim(),
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error);
      } else {
        setResult(body.message);
        setSpatialId("");
        setLoanReference("");
      }
    } catch {
      setError({ code: "ERR_NETWORK", message: "Could not reach the lien-discharge service." });
    } finally {
      setSubmitting(false);
    }
  }

  if (role === "loading") return null;

  if (role !== "BANK_OFFICER" && role !== "GOVT_ADMIN") {
    return null; // silently omitted — LienLockForm above already shows the access message
  }

  return (
    <div className="mt-12 border-t border-border pt-10">
      <h2 className="mb-2 font-serif text-xl text-foreground">Discharge a Lien</h2>
      <p className="mb-6 text-sm leading-relaxed text-foreground-muted">
        Clears the facility and, if no other active liens remain on the parcel,
        reverts its status back to STATE_APPROVED.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Spatial ID">
          <input
            value={spatialId}
            onChange={(e) => setSpatialId(e.target.value)}
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
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
          className="w-full rounded-card border border-brass px-5 py-3 text-sm font-medium text-brass transition-colors hover:bg-brass hover:text-canvas disabled:opacity-50"
        >
          {submitting ? "Discharging…" : "Discharge Lien"}
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
