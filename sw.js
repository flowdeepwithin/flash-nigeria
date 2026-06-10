// Flash Nigeria Service Worker — Smart Notifications
// Max 2 alerts per day, only truly trending stories

const CACHE = 'flashng-v5';
const ASSETS = ['/', '/index.html'];
const CHECK_INTERVAL = 30 * 60 * 1000; // check every 30 min
const MAX_DAILY = 2;

// ── INSTALL & ACTIVATE ──
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

// ── FETCH — never cache API ──
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://flash-nigeria.vercel.app';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const client of list) {
        if (client.url.includes('flash-nigeria') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC — check for trending news ──
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_NEWS') {
    checkTrending();
  }
});

// Called from app periodically
async function checkTrending() {
  try {
    // Load stored state
    const state = await getState();
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Reset counter on new day
    if (state.day !== todayKey) {
      state.day = todayKey;
      state.count = 0;
      state.sentIds = [];
    }

    // Already hit daily limit?
    if (state.count >= MAX_DAILY) return;

    // Fetch latest news
    const r = await fetch('https://flash-nigeria.vercel.app/api/news');
    if (!r.ok) return;
    const d = await r.json();
    if (d.status !== 'ok' || !d.articles?.length) return;

    // Find a truly trending article we haven't notified about
    const trending = d.articles.find(a => isTrending(a, state.sentIds));
    if (!trending) return;

    // Send notification
    await self.registration.showNotification('⚡ Flash Nigeria', {
      body: trending.title,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
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

    // Update state
    state.count++;
    state.sentIds.push(trending.id);
    await setState(state);

  } catch (err) {
    console.error('Flash Nigeria SW check error:', err);
  }
}

// Determine if an article is truly trending/breaking
function isTrending(article, sentIds) {
  // Skip already sent
  if (sentIds.includes(article.id)) return false;

  const title = (article.title || '').toLowerCase();
  const cat = (article.cat || '').toLowerCase();

  // Breaking keywords — high urgency signals
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

  const hasBreakingWord = breakingWords.some(w => title.includes(w));
  if (!hasBreakingWord) return false;

  // Must be recent — published within last 2 hours
  if (article.pub) {
    const age = (Date.now() - new Date(article.pub)) / 1000 / 60; // minutes
    if (age > 120) return false; // older than 2 hours
  }

  return true;
}

// Simple state storage using Cache API as KV store
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
