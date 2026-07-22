// public/sw.js
// Service Worker for the WebMCP Agentic Showcase.

self.addEventListener("install", (event) => {
  // addRoutes is experimental and may not exist.
  if ("addRoutes" in event) {
    event.addRoutes({
      condition: {
        urlPattern: "/api/*",
        runningStatus: "not-running",
      },
      source: "network",
    });
  }

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
