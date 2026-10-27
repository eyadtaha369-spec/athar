/* ATHAR service worker: shows push notifications and opens the right page when one is tapped. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || "ATHAR أثر";
  // An open admin dashboard refreshes its order list right away (banner + chime) instead of waiting for the next check
  const tellPages = data.kind === "new-order"
    ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => wins.forEach((w) => w.postMessage({ type: "athar:new-order", tag: data.tag })))
    : Promise.resolve();
  event.waitUntil(Promise.all([tellPages,
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/favicon-32.png",
      tag: data.tag || "athar",
      renotify: !!data.tag,
      dir: "auto",
      requireInteraction: data.kind === "new-order",
      silent: false, // play the phone's / computer's normal notification sound
      vibrate: data.kind === "new-order" ? [120, 60, 120] : undefined,
      data: { url: data.url || "/" },
    })
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
