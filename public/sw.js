// =====================================================================
// PLOTRAS — Service Worker
// =====================================================================
// Deliberately minimal for Phase 1: network-first for everything (a
// land-title verification tool showing stale cached data would be
// actively dangerous), with just enough caching that the app shell
// still loads under a flaky connection. Not an offline-first app —
// spatial checks and payments always need a live connection anyway.
// =====================================================================

const CACHE_NAME = "plotras-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Never cache API calls or Supabase/Mapbox/Paystack requests — this
  // app's data (parcel status, payment state) must always be fresh.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/")))
  );
});
