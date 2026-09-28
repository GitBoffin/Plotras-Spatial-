// =====================================================================
// PLOTRAS — Shared polygon validation
// =====================================================================
// Extracted from lib/verify/runSpatialVerification.ts so the new
// government zone-creation route (app/api/v1/govt/zones) validates
// polygons with the exact same rules as beacon verification, rather
// than a second copy that could quietly diverge.
// =====================================================================

export interface LatLng {
  lat: number;
  lng: number;
}

/** Shoelace-formula signed area — zero means a degenerate polygon. */
export function signedRingArea(points: LatLng[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.lng * b.lat - b.lng * a.lat;
  }
  return sum / 2;
}

/** Returns the index of the second segment's start vertex on the first self-intersection found, or null. */
export function findSelfIntersection(points: LatLng[]): number | null {
  const n = points.length;
  const segs: [number, number][] = Array.from({ length: n }, (_, i) => [i, (i + 1) % n]);

  const ccw = (p1: LatLng, p2: LatLng, p3: LatLng) =>
    (p3.lat - p1.lat) * (p2.lng - p1.lng) - (p2.lat - p1.lat) * (p3.lng - p1.lng);

  const intersects = (a1: number, a2: number, b1: number, b2: number): boolean => {
    const p1 = points[a1], p2 = points[a2], p3 = points[b1], p4 = points[b2];
    const d1 = ccw(p3, p4, p1);
    const d2 = ccw(p3, p4, p2);
    const d3 = ccw(p1, p2, p3);
    const d4 = ccw(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };

  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const [a1, a2] = segs[i];
      const [b1, b2] = segs[j];
      if (a2 === b1 || b2 === a1 || a1 === b1 || a2 === b2) continue;
      if (intersects(a1, a2, b1, b2)) return b1;
    }
  }
  return null;
}
