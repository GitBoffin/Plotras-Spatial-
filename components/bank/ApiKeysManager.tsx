"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface ApiClient {
  id: string;
  client_name: string;
  rate_limit_per_minute: number;
  revoked: boolean;
  created_at: string;
}

export default function ApiKeysManager() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  }

  async function loadClients() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/v1/bank/api-keys", { headers });
    const body = await res.json();
    if (res.ok) setClients(body.clients);
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewKey(null);
    setSubmitting(true);

    const headers = await authHeaders();
    if (!headers) {
      setError("Sign in as a bank officer first.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/v1/bank/api-keys", {
      method: "POST",
      headers,
      body: JSON.stringify({ client_name: name }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error?.message ?? "Could not create the key.");
    } else {
      setNewKey(body.api_key);
      setName("");
      await loadClients();
    }
    setSubmitting(false);
  }

  async function handleRevoke(clientId: string) {
    const headers = await authHeaders();
    if (!headers) return;
    await fetch("/api/v1/bank/api-keys", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ client_id: clientId }),
    });
    await loadClients();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 text-sm text-brass">B2B Integration</p>
      <h1 className="mb-3 font-serif text-3xl text-foreground">API Keys</h1>
      <p className="mb-8 text-sm leading-relaxed text-foreground-muted">
        Server-to-server access to <code className="text-brass-muted">POST /api/v1/b2b/title-verification</code> via
        an <code className="text-brass-muted">X-API-Key</code> header. Limit: 500 requests/minute/client.
      </p>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Core Banking Integration"
          required
          className="flex-1 rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-card bg-brass px-5 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Key"}
        </button>
      </form>

      {error && <p className="mb-6 text-sm text-signal-red">{error}</p>}

      {newKey && (
        <div className="mb-8 rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-4">
          <p className="mb-2 text-sm text-foreground">
            Copy this now — it will not be shown again:
          </p>
          <code className="block break-all rounded-card bg-canvas px-3 py-2 text-xs text-brass">{newKey}</code>
        </div>
      )}

      <div className="space-y-3">
        {clients.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-card border border-border bg-canvas-raised px-5 py-4"
          >
            <div>
              <p className="text-sm text-foreground">{c.client_name}</p>
              <p className="text-xs text-foreground-faint">
                {c.rate_limit_per_minute}/min · created {new Date(c.created_at).toLocaleDateString()}
                {c.revoked && " · revoked"}
              </p>
            </div>
            {!c.revoked && (
              <button
                onClick={() => handleRevoke(c.id)}
                className="rounded-card border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-signal-red"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
