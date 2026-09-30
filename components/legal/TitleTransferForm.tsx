"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function TitleTransferForm() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [spatialId, setSpatialId] = useState("");
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [instrumentType, setInstrumentType] = useState("Deed of Assignment");
  const [govVol, setGovVol] = useState("");
  const [govPage, setGovPage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return setRole(null);
      const { data } = await supabaseBrowser.from("users").select("role").eq("id", session.user.id).single();
      setRole(data?.role ?? null);
    });
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
      setError({ code: "ERR_UNAUTHENTICATED", message: "Sign in as a lawyer first." });
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/v1/title/transfer/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        spatial_id: spatialId.trim(),
        assignee_email: assigneeEmail.trim(),
        instrument_type: instrumentType.trim(),
        gov_registry_vol: govVol || undefined,
        gov_registry_page: govPage || undefined,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error);
    } else {
      setResult(body.message);
      setSpatialId("");
      setAssigneeEmail("");
      setGovVol("");
      setGovPage("");
    }
    setSubmitting(false);
  }

  if (role === "loading") return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;

  if (role !== "LAWYER") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          Initiating a title transfer is only available to LAWYER accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <p className="mb-2 text-sm text-brass">Legal Workspace</p>
      <h1 className="mb-3 font-serif text-3xl text-foreground">Initiate Title Transfer</h1>
      <p className="mb-8 text-sm leading-relaxed text-foreground-muted">
        Submits a Deed of Assignment for government approval. Requires the parcel to
        be STATE_APPROVED with no active lien — it will be re-checked again at
        approval time too.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Spatial ID">
          <input value={spatialId} onChange={(e) => setSpatialId(e.target.value)} required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none" />
        </Field>
        <Field label="Assignee (buyer) email">
          <input type="email" value={assigneeEmail} onChange={(e) => setAssigneeEmail(e.target.value)} required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none" />
        </Field>
        <Field label="Instrument type">
          <input value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)} required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gov. registry volume">
            <input value={govVol} onChange={(e) => setGovVol(e.target.value)}
              className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none" />
          </Field>
          <Field label="Gov. registry page">
            <input value={govPage} onChange={(e) => setGovPage(e.target.value)}
              className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none" />
          </Field>
        </div>

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

        <button type="submit" disabled={submitting}
          className="w-full rounded-card bg-brass px-5 py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50">
          {submitting ? "Submitting…" : "Submit for Government Approval"}
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
