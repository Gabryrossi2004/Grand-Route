// Service worker minimale per le notifiche push di Grand Route.
// Non fa caching/offline: si occupa solo di mostrare le notifiche push e di
// aprire la pagina giusta quando l'utente ci clicca sopra.

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
