/**
 * Magpie service worker — loan-expiry push notifications.
 *
 * This exists for one reason: borrowers who open a loan on the website have no
 * Telegram account behind their Magpie account, so the DM-based expiry warning
 * never reaches them. Measured over 90 days, of borrowers who reached the 24h
 * warning window, 96% of Telegram users were warned and 1.4% of site-only users
 * were — and every borrower liquidated with no warning at all was site-only.
 *
 * Scope is deliberately narrow. This worker does NOT cache anything, does not
 * intercept fetches, and does not touch app data. Adding a fetch handler here
 * would put a caching layer in front of live loan and price data, which is
 * exactly the kind of silent staleness that causes bad decisions. It handles
 * push and notification clicks, and nothing else.
 */

self.addEventListener("push", (event) => {
  // A push with no payload, or an unparsable one, must still show something.
  // Silently dropping it would recreate the very problem this channel fixes.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = typeof data.title === "string" && data.title ? data.title : "Magpie";
  const body =
    typeof data.body === "string" && data.body
      ? data.body
      : "You have a loan approaching its deadline.";
  const url = typeof data.url === "string" && data.url ? data.url : "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Collapse repeats so a borrower with several notifications sees the
      // latest state rather than a stack of near-identical warnings.
      tag: "magpie-loan-expiry",
      renotify: true,
      // Expiry warnings are time-critical and shouldn't be auto-dismissed.
      requireInteraction: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
      // Prefer focusing an existing Magpie tab over opening a duplicate.
      for (const c of all) {
        try {
          if (new URL(c.url).origin === self.location.origin) {
            await c.focus();
            if ("navigate" in c) await c.navigate(target);
            return;
          }
        } catch {
          /* a client we can't inspect — fall through to openWindow */
        }
      }
      await clients.openWindow(target);
    })(),
  );
});

// Take over promptly so a freshly-registered worker can receive pushes without
// requiring the user to reload first.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
