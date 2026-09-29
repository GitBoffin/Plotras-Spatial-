"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type RequestableRole = "SURVEYOR" | "LAWYER" | "BANK_OFFICER" | "GOVT_ADMIN";

const ROLES: { value: RequestableRole; label: string }[] = [
  { value: "SURVEYOR", label: "Surveyor" },
  { value: "LAWYER", label: "Lawyer" },
  { value: "BANK_OFFICER", label: "Bank officer" },
  { value: "GOVT_ADMIN", label: "Government admin" },
];

export default function ApplyForRoleForm() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<RequestableRole>("SURVEYOR");
  const [bankCode, setBankCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(Boolean(session));
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
      setError("Sign in first.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabaseBrowser.from("role_requests").insert({
      user_id: session.user.id,
      requested_role: role,
      bank_code: role === "BANK_OFFICER" ? bankCode : null,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setResult("Request submitted. A government admin will review it.");
    }
    setSubmitting(false);
  }

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          Sign in first to apply for a professional role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="mb-3 font-serif text-3xl text-foreground">Apply for a Role</h1>
      <p className="mb-8 text-sm leading-relaxed text-foreground-muted">
        Professional roles are granted after review — a government admin approves
        or rejects each request. This is what stands between "anyone can register a
        lien" and actual RBAC.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-foreground-muted">Requested role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RequestableRole)}
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        {role === "BANK_OFFICER" && (
          <label className="block">
            <span className="mb-1.5 block text-xs text-foreground-muted">Bank code</span>
            <input
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              required
              className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
            />
          </label>
        )}

        {error && <p className="text-sm text-signal-red">{error}</p>}
        {result && <p className="text-sm text-signal-green">{result}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-card bg-brass px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
