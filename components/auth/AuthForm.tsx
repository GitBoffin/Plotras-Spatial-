"use client";

// =====================================================================
// PLOTRAS — Auth Form (signup + login)
// =====================================================================
// Signup only ever produces a RETAIL_USER account. Getting SURVEYOR /
// LAWYER / BANK_OFFICER / GOVT_ADMIN now goes through a request ->
// GOVT_ADMIN review flow (see /apply-for-role and /admin/role-requests,
// backed by role_requests + fn_review_role_request). This closes the
// self-assignment gap the previous version of this file flagged.
// =====================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signup" | "login";

async function logLogin(accessToken: string) {
  try {
    await fetch("/api/v1/auth/log-login", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Non-fatal — a missed audit log entry shouldn't block sign-in.
  }
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        setNotice("Check your email to confirm your account, then log in.");
      } else {
        await logLogin(data.session.access_token);
        router.push("/");
        router.refresh();
      }
    } else {
      const { data: signInData, error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else if (signInData.session) {
        await logLogin(signInData.session.access_token);
        router.push("/");
        router.refresh();
      }
    }

    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-20">
      <h1 className="mb-2 font-serif text-3xl text-foreground">
        {mode === "signup" ? "Create an account" : "Sign in"}
      </h1>
      {mode === "signup" && (
        <p className="mb-6 text-xs text-foreground-muted">
          Surveyors, lawyers, bank officers, and government admins: create a retail
          account first, then apply for your professional role from your dashboard.
        </p>
      )}

      <form onSubmit={handleSubmit} className={mode === "login" ? "mt-8 space-y-4" : "space-y-4"}>
        {mode === "signup" && (
          <Field label="Full name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
            />
          </Field>
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground focus:border-brass-muted focus:outline-none"
          />
        </Field>

        {error && <p className="text-sm text-signal-red">{error}</p>}
        {notice && <p className="text-sm text-signal-green">{notice}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-card bg-brass px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
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
