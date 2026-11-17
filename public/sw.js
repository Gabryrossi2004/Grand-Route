// Service worker di Grand Route:
// 1) mostra le notifiche push e apre la pagina giusta al clic;
// 2) nell'AREA CLIENTI rende consultabili senza rete le pagine già aperte
//    (itinerario, documenti): prima prova la rete, e solo se manca usa l'ultima
//    copia salvata. Le copie si cancellano quando il cliente esce dall'account.
// L'area delle agenzie non viene mai salvata.

const PAGES_CACHE = "gr-pages-v1";
const STATIC_CACHE = "gr-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));

const OFFLINE_HTML =
  '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Senza rete</title></head><body style="font-family:system-ui;background:#faf3e6;color:#233c5e;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center"><div><h1 style="font-size:1.4rem">Sei senza rete</h1><p>Questa pagina non è stata ancora salvata. Riaprila quando sei online: da quel momento sarà disponibile anche offline.</p></div></body></html>';

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request.url, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request.url, { cacheName: PAGES_CACHE });
    if (cached) return cached;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { cacheName: STATIC_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isClientArea = url.pathname.startsWith("/client") && !/^\/client\/(login|signup)/.test(url.pathname);
  if (request.mode === "navigate" && isClientArea) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Script e stili del sito (cambiano nome a ogni versione): servono per far
  // funzionare le pagine salvate anche senza rete.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request).catch(() => fetch(request)));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Grand Route", body: event.data.text() };
  }

  const title = payload.title || "Grand Route";
  const options = {
    body: payload.body || "",
    icon: "/grand-route-logo.jpg",
    badge: "/grand-route-logo.jpg",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
