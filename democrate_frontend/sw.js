// sw.js — Web Push service worker.
// Display push notifications, forward data to open pages, focus on click.

self.addEventListener('push', (e) => {
    let data = {};
    try { data = e.data ? e.data.json() : {}; } catch (_) {}
    e.waitUntil(
        self.registration.showNotification(
            data.title || 'Democrate',
            { body: data.body || '', icon: '/assets/logo.webp', data: { url: data.url || '/' } }
        ).then(() => {
            // Forward push data to all open client pages so they can refresh in-place.
            return clients.matchAll({ type: 'window' }).then((wins) =>
                wins.map((w) => w.postMessage(data))
            );
        })
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then((wins) => {
            if (wins.length) { wins[0].focus(); if (wins[0].navigate) wins[0].navigate(url); }
            else return clients.openWindow(url);
        })
    );
});
