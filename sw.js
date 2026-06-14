// Flash Nigeria Service Worker — v3
// Smart notifications + offline caching

const CACHE = 'fn-v3';
const OFFLINE_URLS = ['/', '/index.html', '/manifest.json'];
const MAX_DAILY = 3;
const NOTIF_K = 'fn_notif_daily';

// ── INSTALL ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// ── ACTIVATE ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => checkTrending())
  );
  self.clients.claim();
});

// ── FETCH ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cls => {
      const url = e.notification.data?.url || 'https://flash-nigeria.vercel.app';
      const c = cls.find(c => c.url.includes('flash-nigeria') && 'focus' in c);
      if (c) return c.focus();
      return clients.openWindow(url);
    })
  );
});

// ── MESSAGES ──
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_NEWS') checkTrending();
  if (e.data?.type === 'TEST_NOTIF') {
    self.registration.showNotification('⚡ Flash Nigeria', {
      body: '🇳🇬 Breaking alerts are ON! You\'ll be notified of major Nigerian news — max 3 per day.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test-notification',
      data: { url: 'https://flash-nigeria.vercel.app' }
    });
  }
});

// ── CHECK DAILY LIMIT ──
function getDailyCount() {
  try {
    const d = JSON.parse(self.__notifData || '{}');
    const today = new Date().toDateString();
    if (d.date !== today) return 0;
    return d.count || 0;
  } catch(e) { return 0; }
}

function incrementDailyCount() {
  try {
    const today = new Date().toDateString();
    const count = getDailyCount() + 1;
    self.__notifData = JSON.stringify({ date: today, count });
  } catch(e) {}
}

// ── BREAKING NEWS DETECTION ──
function isTrending(article, sentIds) {
  if (sentIds.includes(article.id)) return false;
  const title = (article.title || '').toLowerCase();

  // HIGH PRIORITY — Always notify immediately
  const highPriority = [
    // Death & violence
    'dead','killed','death','bomb','attack','explosion','shooting','gunmen',
    'massacre','hostage','kidnap','abduct','assassination',
    // Major political events
    'impeach','coup','overthrow','resign','sacked','suspended',
    'arrested','convicted','sentenced','jailed',
    'wins election','declared winner','election result',
    // Economic emergencies
    'naira crash','naira falls','fuel scarcity','fuel price hike',
    'fuel subsidy','economic emergency','recession',
    // Natural disasters
    'flood','earthquake','disaster','collapse','fire outbreak',
    // Key Nigerian figures
    'tinubu','president tinubu','vice president','chief justice',
    // Legal
    'supreme court rules','court orders','efcc arrests',
  ];

  // MEDIUM PRIORITY — Notify if truly breaking
  const mediumPriority = [
    'breaking','just in','urgent','alert','flash',
    'crash','fire','flood','protest','strike','shutdown',
    'atiku','obi','senate','house of reps','efcc','dss','nnpc',
    'naira','fuel price','subsidy','inflation','cbn',
    'super eagles','afcon','world cup','champions league',
    'crisis','war','emergency','overthrow',
  ];

  const isHighPriority = highPriority.some(w => title.includes(w));
  const isMediumPriority = mediumPriority.some(w => title.includes(w));

  if (!isHighPriority && !isMediumPriority) return false;

  // Must be recent — within last 3 hours for high, 2 hours for medium
  if (article.pub) {
    const age = (Date.now() - new Date(article.pub)) / 1000 / 60; // minutes
    if (isHighPriority && age > 180) return false;
    if (isMediumPriority && age > 120) return false;
  }

  return isHighPriority ? 'high' : 'medium';
}

// ── FETCH & CHECK TRENDING ──
async function checkTrending() {
  if (getDailyCount() >= MAX_DAILY) return;
  if (self.Notification?.permission !== 'granted') return;

  try {
    const res = await fetch('https://flash-nigeria.vercel.app/api/news', {
      cache: 'no-store'
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.articles?.length) return;

    // Get already-sent IDs
    let sentIds = [];
    try {
      const stored = await self.registration.getNotifications({ tag: 'flash-sent' });
      sentIds = stored.map(n => n.data?.id).filter(Boolean);
    } catch(e) {}

    // Find best breaking story
    let bestArticle = null;
    let bestPriority = null;

    for (const article of data.articles) {
      const priority = isTrending(article, sentIds);
      if (priority === 'high') {
        bestArticle = article;
        bestPriority = 'high';
        break; // High priority — send immediately
      }
      if (priority === 'medium' && !bestArticle) {
        bestArticle = article;
        bestPriority = 'medium';
      }
    }

    if (!bestArticle) return;

    const emoji = bestPriority === 'high' ? '🚨' : '⚡';
    const prefix = bestPriority === 'high' ? 'BREAKING' : 'Flash Nigeria';

    await self.registration.showNotification(`${emoji} ${prefix}`, {
      body: bestArticle.title,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `flash-${bestArticle.id}`,
      data: { url: bestArticle.link, id: bestArticle.id },
      requireInteraction: bestPriority === 'high', // High priority stays on screen
      vibrate: bestPriority === 'high' ? [200,100,200,100,200] : [200,100,200],
    });

    incrementDailyCount();

  } catch(e) {
    console.error('SW checkTrending error:', e);
  }
}

// Check every 30 minutes
setInterval(() => checkTrending(), 30 * 60 * 1000);
