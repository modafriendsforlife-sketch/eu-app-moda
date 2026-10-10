/*
 * Jornada MF — Service Worker with Background Notification Engine
 *
 * Processes flexible payloads from the app to show notifications even when
 * the PWA is closed. All operations are wrapped in try/catch to ensure
 * silent background errors never block the build or crash the SW lifecycle.
 */

const CACHE_NAME = 'minha-jornada-shell-v3';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/logo-mf-192.png',
  '/assets/logo-mf-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

// ─── Push events (server push) ───
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try { payload = { body: event.data?.text() ?? '' }; } catch (ee) {}
  }

  try {
    const title = payload.title || 'Jornada MF';
    const options = {
      body: payload.body || 'Você tem um novo lembrete.',
      icon: payload.icon || '/assets/logo-mf-192.png',
      badge: payload.badge || '/assets/logo-mf-192.png',
      tag: payload.tag || 'minha-jornada-reminder',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: payload.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Never let push errors crash the SW
  }
});

// ─── Message handler: in-app → SW notification bridge ───
self.addEventListener('message', (event) => {
  try {
    if (event.data?.type !== 'show-reminder') return;

    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Jornada MF', {
        body: body || 'Você tem um novo lembrete.',
        icon: '/assets/logo-mf-192.png',
        badge: '/assets/logo-mf-192.png',
        tag: tag || 'minha-jornada-reminder',
        renotify: true,
        vibrate: [200, 100, 200],
      })
    );
  } catch (e) {
    // Silent fail
  }
});

// ─── Background notification engine ───
// Listens for 'check-alerts' messages from the app, reads localStorage data
// from all clients, and fires notifications for hydration / planner / tasks.
self.addEventListener('message', (event) => {
  try {
    if (event.data?.type !== 'check-alerts') return;
    runBackgroundAlertCheck().catch(() => {});
  } catch (e) {}
});

async function runBackgroundAlertCheck() {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    if (clients.length === 0) return;

    // Request data from the first available client
    const client = clients[0];
    const channel = new MessageChannel();

    const dataPromise = new Promise((resolve) => {
      let settled = false;
      channel.port1.onmessage = (ev) => {
        if (!settled) { settled = true; resolve(ev.data || {}); }
      };
      // Timeout fallback: if the client doesn't respond in 3s, continue with empty data
      setTimeout(() => { if (!settled) { settled = true; resolve({}); } }, 3000);
    });

    try {
      client.postMessage({ type: 'get-alert-data' }, [channel.port2]);
    } catch (e) {
      return;
    }

    const data = await dataPromise;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sentKey = 'minha-jornada-sw-sent';
    const sent = new Set((data.sentAlerts || []));
    const notifications = [];

    // ─── 1. Hydration check ───
    try {
      const hydration = data.hydration;
      if (hydration && hydration.goal > 0 && hydration.consumed < hydration.goal) {
        const pct = Math.round((hydration.consumed / hydration.goal) * 100);
        const hour = now.getHours();
        // Remind at 12h, 16h, 20h if below goal
        if ([12, 16, 20].includes(hour)) {
          const alertId = `hydration-${today}-${hour}`;
          if (!sent.has(alertId)) {
            sent.add(alertId);
            notifications.push({
              title: 'Lembrete de Hidratação',
              body: `Você está em ${pct}% da meta de água hoje. Que tal beber mais um copo? 💧`,
              tag: alertId,
              icon: '💧',
            });
          }
        }
      }
    } catch (e) {}

    // ─── 2. Planner events (today) ───
    try {
      const events = data.plannerEvents || [];
      events.forEach((ev) => {
        if (ev.date !== today) return;
        const [h, m] = (ev.time || '00:00').split(':').map(Number);
        const eventTime = new Date(today + 'T00:00:00');
        eventTime.setHours(h || 0, m || 0, 0, 0);

        // 15-minute advance warning
        const fifteenBefore = new Date(eventTime.getTime() - 15 * 60 * 1000);
        if (now >= fifteenBefore && now < eventTime) {
          const alertId = `planner-15-${ev.id}`;
          if (!sent.has(alertId)) {
            sent.add(alertId);
            const timeStr = ev.time || 'agora';
            notifications.push({
              title: 'Compromissos de Hoje',
              body: `Compromisso "${ev.title}" às ${timeStr} começa em 15 minutos! 🗓️`,
              tag: alertId,
              icon: '🗓️',
            });
          }
        }

        // Exact time
        const exactWindow = new Date(eventTime.getTime() + 2 * 60 * 1000);
        if (now >= eventTime && now < exactWindow) {
          const alertId = `planner-exact-${ev.id}`;
          if (!sent.has(alertId)) {
            sent.add(alertId);
            notifications.push({
              title: 'Compromissos de Hoje',
              body: `É hora do seu compromisso: "${ev.title}"! 🗓️`,
              tag: alertId,
              icon: '🗓️',
            });
          }
        }
      });
    } catch (e) {}

    // ─── 3. Task deadlines ───
    try {
      const tasks = data.tasks || [];
      tasks.forEach((list) => {
        if (!list.items) return;
        list.items.forEach((item) => {
          if (item.done || !item.deadline) return;
          const deadlineDate = new Date(item.deadline + 'T23:59:59');
          const oneDayBefore = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);
          if (now >= oneDayBefore && now < deadlineDate) {
            const alertId = `task-dl-${item.id}`;
            if (!sent.has(alertId)) {
              sent.add(alertId);
              notifications.push({
                title: 'Prazo Expirando',
                body: `A tarefa "${item.text}" está prestes a expirar! ✅`,
                tag: alertId,
                icon: '✅',
              });
            }
          }
        });
      });
    } catch (e) {}

    // ─── 4. Notes reminders ───
    try {
      const notes = data.notes || [];
      notes.forEach((note) => {
        if (!note.reminderDate) return;
        const reminderDate = new Date(note.reminderDate);
        const window = new Date(reminderDate.getTime() + 5 * 60 * 1000);
        if (now >= reminderDate && now < window) {
          const alertId = `note-rem-${note.id}`;
          if (!sent.has(alertId)) {
            sent.add(alertId);
            notifications.push({
              title: 'Lembrete de Anotação',
              body: `Você tem um lembrete: "${note.title || 'Anotação'}" 📝`,
              tag: alertId,
              icon: '📝',
            });
          }
        }
      });
    } catch (e) {}

    // ─── Fire notifications ───
    for (const notif of notifications) {
      try {
        await self.registration.showNotification(notif.title, {
          body: notif.body,
          icon: '/assets/logo-mf-192.png',
          badge: '/assets/logo-mf-192.png',
          tag: notif.tag,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: '/' },
        });
      } catch (e) {}
    }

    // Store sent IDs back to client for persistence
    try {
      client.postMessage({ type: 'sent-alerts-update', sentAlerts: [...sent].slice(-200) });
    } catch (e) {}
  } catch (e) {
    // Top-level catch — never crash
  }
}

// ─── Periodic background check via 'periodicsync' (if supported) ───
self.addEventListener('periodicsync', (event) => {
  try {
    if (event.tag === 'check-alerts') {
      event.waitUntil(runBackgroundAlertCheck());
    }
  } catch (e) {}
});

// ─── Notification click ───
self.addEventListener('notificationclick', (event) => {
  try {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((client) => 'focus' in client);
        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
    );
  } catch (e) {}
});
