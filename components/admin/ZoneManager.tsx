"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Zone {
  id: string;
  zone_name: string;
  zone_type: string;
  source_authority: string | null;
  gazette_reference: string | null;
  created_at: string;
}

interface Point {
  lat: string;
  lng: string;
}

function emptyPoint(): Point {
  return { lat: "", lng: "" };
}

export default function ZoneManager() {
  const [role, setRole] = useState<string | null | "loading">("loading");
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState("GOVT_ACQUISITION");
  const [sourceAuthority, setSourceAuthority] = useState("");
  const [gazetteRef, setGazetteRef] = useState("");
  const [points, setPoints] = useState<Point[]>([emptyPoint(), emptyPoint(), emptyPoint()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  }

  async function loadZones() {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/v1/govt/zones", { headers });
    const body = await res.json();
    if (res.ok) setZones(body.zones);
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
      if (data?.role === "GOVT_ADMIN") await loadZones();
    }
    init();
  }, []);

  function updatePoint(i: number, field: keyof Point, value: string) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }
  function addPoint() {
    setPoints((prev) => [...prev, emptyPoint()]);
  }
  function removePoint(i: number) {
    setPoints((prev) => (prev.length <= 3 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const headers = await authHeaders();
    if (!headers) {
      setError("Sign in as a government admin first.");
      setSubmitting(false);
      return;
    }

    const parsedPoints = points.map((p) => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }));
    if (parsedPoints.some((p) => Number.isNaN(p.lat) || Number.isNaN(p.lng))) {
      setError("Every point needs a valid latitude and longitude.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/v1/govt/zones", {
      method: "POST",
      headers,
      body: JSON.stringify({
        zone_name: zoneName,
        zone_type: zoneType,
        source_authority: sourceAuthority || undefined,
        gazette_reference: gazetteRef || undefined,
        points: parsedPoints,
      }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error?.message ?? "Could not create the zone.");
    } else {
      setZoneName("");
      setSourceAuthority("");
      setGazetteRef("");
      setPoints([emptyPoint(), emptyPoint(), emptyPoint()]);
      await loadZones();
    }
    setSubmitting(false);
  }

  async function handleDelete(zoneId: string) {
    const headers = await authHeaders();
    if (!headers) return;
    await fetch("/api/v1/govt/zones", { method: "DELETE", headers, body: JSON.stringify({ zone_id: zoneId }) });
    await loadZones();
  }

  if (role === "loading") return <p className="px-6 py-16 text-sm text-foreground-muted">Loading…</p>;

  if (role !== "GOVT_ADMIN") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="rounded-card border border-signal-yellow-border bg-signal-yellow-bg px-4 py-3 text-sm text-foreground">
          Zone management is only available to GOVT_ADMIN accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 text-sm text-brass">State Master Layers</p>
      <h1 className="mb-3 font-serif text-3xl text-foreground">Government Zones</h1>
      <p className="mb-8 text-sm leading-relaxed text-foreground-muted">
        Acquisition and restricted zones checked against every spatial verification —
        any parcel overlapping one of these returns a RED signal.
      </p>

      <form onSubmit={handleCreate} className="mb-10 space-y-4 rounded-card border border-border bg-canvas-raised p-5">
        <div className="grid grid-cols-2 gap-3">
          <input
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="Zone name"
            required
            className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
          />
          <input
            value={zoneType}
            onChange={(e) => setZoneType(e.target.value)}
            placeholder="Zone type"
            className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
          />
          <input
            value={sourceAuthority}
            onChange={(e) => setSourceAuthority(e.target.value)}
            placeholder="Source authority (optional)"
            className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
          />
          <input
            value={gazetteRef}
            onChange={(e) => setGazetteRef(e.target.value)}
            placeholder="Gazette reference (optional)"
            className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                placeholder="Latitude"
                inputMode="decimal"
                value={p.lat}
                onChange={(e) => updatePoint(i, "lat", e.target.value)}
                required
                className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
              />
              <input
                placeholder="Longitude"
                inputMode="decimal"
                value={p.lng}
                onChange={(e) => updatePoint(i, "lng", e.target.value)}
                required
                className="rounded-card border border-border bg-canvas px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-brass-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removePoint(i)}
                disabled={points.length <= 3}
                className="px-2 text-sm text-foreground-faint hover:text-signal-red disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addPoint} className="text-sm text-brass-muted hover:text-brass">
            + Add point
          </button>
        </div>

        {error && <p className="text-sm text-signal-red">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-card bg-brass px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Zone"}
        </button>
      </form>

      <div className="space-y-2">
        {zones.map((z) => (
          <div key={z.id} className="flex items-center justify-between rounded-card border border-border bg-canvas-raised px-5 py-3">
            <div>
              <p className="text-sm text-foreground">{z.zone_name}</p>
              <p className="text-xs text-foreground-faint">
                {z.zone_type}{z.source_authority ? ` · ${z.source_authority}` : ""}
              </p>
            </div>
            <button
              onClick={() => handleDelete(z.id)}
              className="rounded-card border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-signal-red"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
