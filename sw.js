// Flash Nigeria Service Worker — Smart Notifications
// Max 2 alerts per day, only truly trending stories

const CACHE = 'flashng-v5';
const ASSETS = ['/', '/index.html'];
const MAX_DAILY = 2;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
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
});

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
    'breaking','just in','urgent','alert','bomb','attack','explosion',
    'dead','killed','death','crash','fire','flood','kidnap','abduct',
    'resign','arrested','impeach','coup','overthrow','emergency',
    'crisis','war','protest','strike','shutdown','collapse',
    'election result','wins election','declared winner',
    'tinubu','president','governor','senate','supreme court',
    'naira crash','naira falls','fuel price','fuel scarcity',
    'super eagles','champions league final','world cup',
  ];
  if (!breakingWords.some(w => title.includes(w))) return false;
  if (article.pub) {
    const age = (Date.now() - new Date(article.pub)) / 1000 / 60;
    if (age > 120) return false;
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
