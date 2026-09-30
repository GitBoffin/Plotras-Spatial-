"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface LineageEvent {
  event_type: "PARCEL_REGISTERED" | "TITLE_TRANSFER" | "LIEN_REGISTERED" | "LIEN_DISCHARGED";
  event_date: string;
  details: Record<string, unknown>;
}

const EVENT_LABELS: Record<string, string> = {
  PARCEL_REGISTERED: "Root of Title — Parcel Registered",
  TITLE_TRANSFER: "Title Transfer",
  LIEN_REGISTERED: "Mortgage Lien Locked",
  LIEN_DISCHARGED: "Lien Discharged",
};

const EVENT_COLORS: Record<string, string> = {
  PARCEL_REGISTERED: "#B8935A",
  TITLE_TRANSFER: "#F0C265",
  LIEN_REGISTERED: "#EAB308",
  LIEN_DISCHARGED: "#22C55E",
};

export default function TitleLineageViewer() {
  const [spatialId, setSpatialId] = useState("");
  const [events, setEvents] = useState<LineageEvent[] | null>(null);
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEvents(null);
    setLoading(true);

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    if (!session) {
      setError("Sign in required.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/title/lineage?spatial_id=${encodeURIComponent(spatialId.trim())}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error?.message ?? "Could not retrieve title lineage.");
      } else {
        setEvents(body.events);
        setLimited(body.limited);
      }
    } catch {
      setError("Could not reach the lineage service.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadReport() {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/v1/title/full-report?spatial_id=${encodeURIComponent(spatialId.trim())}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error?.message ?? "Could not generate the full report.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plotras-full-report-${spatialId.trim()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 text-sm text-brass">Legal Workspace</p>
      <h1 className="mb-3 font-serif text-3xl text-foreground">Title Lineage</h1>
      <p className="mb-8 text-sm leading-relaxed text-foreground-muted">
        The chronological chain of title for a parcel — registration, transfers,
        and mortgage lien history — tied to its Spatial ID.
      </p>

      <form onSubmit={handleSearch} className="mb-10 flex gap-2">
        <input
          value={spatialId}
          onChange={(e) => setSpatialId(e.target.value)}
          placeholder="SP-LAG-DEMO-GREEN"
          required
          className="flex-1 rounded-card border border-border bg-canvas-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-card bg-brass px-5 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p className="mb-6 rounded-card border border-signal-red-border bg-signal-red-bg px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {limited && (
        <p className="mb-6 rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          Showing a limited view — transfer parties and lien financial details are
          restricted for your role.
        </p>
      )}

      {events && !limited && (
        <button
          onClick={handleDownloadReport}
          className="mb-6 rounded-card border border-brass px-4 py-2 text-sm text-brass transition-colors hover:bg-brass hover:text-canvas"
        >
          Download Full Title Report (PDF)
        </button>
      )}

      {events && events.length === 0 && (
        <p className="text-sm text-foreground-muted">No events on file for this parcel.</p>
      )}

      {events && events.length > 0 && (
        <ol className="relative border-l border-border pl-6">
          {events.map((ev, i) => (
            <li key={i} className="mb-8 last:mb-0">
              <span
                className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-seal"
                style={{ backgroundColor: EVENT_COLORS[ev.event_type] }}
              />
              <p className="font-serif text-base text-foreground">{EVENT_LABELS[ev.event_type]}</p>
              <p className="mb-2 text-xs text-foreground-faint">
                {ev.event_date ? new Date(ev.event_date).toUTCString() : "Date unavailable"}
              </p>
              <dl className="space-y-1 text-xs text-foreground-muted">
                {Object.entries(ev.details).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-foreground-faint">{k.replaceAll("_", " ")}:</dt>
                    <dd>{String(v ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
