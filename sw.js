// Flash Nigeria Service Worker — Smart Notifications
// Max 2 alerts per day, only truly trending stories

const CACHE = 'flashng-v5';
const ASSETS = ['/', '/index.html'];
const MAX_DAILY = 3;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Check for breaking news immediately on activation
      return checkTrending();
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://flash-nigeria.vercel.app';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('flash-nigeria') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_NEWS') checkTrending();
  if (e.data?.type === 'TEST_NOTIF') {
    self.registration.showNotification('⚡ Flash Nigeria', {
      body: '🇳🇬 Breaking alerts are ON! You will get notified of major Nigerian news — max 3 per day.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test-notification',
      data: { url: 'https://flash-nigeria.vercel.app' }
    });
  }
});

// Use setInterval to periodically check (every 30 min)
setInterval(() => { checkTrending(); }, 30 * 60 * 1000);

async function checkTrending() {
  try {
    const state = await getState();
    const todayKey = new Date().toISOString().slice(0, 10);
    if (state.day !== todayKey) {
      state.day = todayKey; state.count = 0; state.sentIds = [];
    }
    if (state.count >= MAX_DAILY) return;

    const r = await fetch('https://flash-nigeria.vercel.app/api/news');
    if (!r.ok) return;
    const d = await r.json();
    if (d.status !== 'ok' || !d.articles?.length) return;

    const trending = d.articles.find(a => isTrending(a, state.sentIds));
    if (!trending) return;

    await self.registration.showNotification('⚡ Flash Nigeria', {
      body: trending.title,
      icon: '/icons/icon-192x192.png',   // ✅ fixed path
      badge: '/icons/icon-72x72.png',    // ✅ fixed path
      tag: trending.id,
      renotify: false,
      requireInteraction: false,
      silent: false,
      data: { url: trending.link || 'https://flash-nigeria.vercel.app', id: trending.id },
      actions: [
        { action: 'read', title: '📰 Read now' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });

    state.count++;
    state.sentIds.push(trending.id);
    await setState(state);

  } catch (err) {
    console.error('Flash Nigeria SW error:', err);
  }
}

function isTrending(article, sentIds) {
  if (sentIds.includes(article.id)) return false;
  const title = (article.title || '').toLowerCase();

  const breakingWords = [
    'breaking','just in','urgent','alert','flash',
    'bomb','attack','explosion','dead','killed','death','crash',
    'fire','flood','kidnap','abduct','robbery','shooting','gunmen',
    'bandits','terrorism','hostage','resign','arrested','impeach',
    'coup','overthrow','emergency','sacked','suspended','convicted',
    'sentenced','jailed','wins election','declared winner','election result',
    'tinubu','atiku','senate','supreme court','efcc','dss',
    'naira','fuel price','fuel scarcity','subsidy','inflation',
    'super eagles','afcon','world cup','champions league','osimhen',
    'crisis','war','protest','strike','shutdown','collapse','disaster',
  ];

  if (!breakingWords.some(w => title.includes(w))) return false;

  // Recent — within last 6 hours
  if (article.pub) {
    const age = (Date.now() - new Date(article.pub)) / 1000 / 60;
    if (age > 360) return false;
  }

  return true;
}

async function getState() {
  try {
    const cache = await caches.open('flashng-state');
    const r = await cache.match('/state');
    if (r) return await r.json();
  } catch {}
  return { day: '', count: 0, sentIds: [] };
}

async function setState(state) {
  const cache = await caches.open('flashng-state');
  await cache.put('/state', new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' }
  }));
}
