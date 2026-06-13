// Flash Nigeria — RSS News Fetcher
// Pulls from top Nigerian news sources — FREE, unlimited, no API key needed

const SOURCES = [
  { name: 'Vanguard',        url: 'https://www.vanguardngr.com/feed/', cat: '' },
  { name: 'Punch',           url: 'https://punchng.com/feed/', cat: '' },
  { name: 'Daily Post',      url: 'https://dailypost.ng/feed/', cat: '' },
  { name: 'Premium Times',   url: 'https://www.premiumtimesng.com/feed/', cat: '' },
  { name: 'The Guardian NG', url: 'https://guardian.ng/feed/', cat: '' },
  { name: 'Channels TV',     url: 'https://www.channelstv.com/feed/', cat: '' },
  { name: 'ThisDay',         url: 'https://www.thisdaylive.com/index.php/feed/', cat: '' },
  { name: 'BusinessDay',     url: 'https://businessday.ng/feed/', cat: '' },
];

const CAT_KEYWORDS = {
  politics:      ['politic','government','senate','president','governor','election','efcc','minister','house of reps','tinubu','atiku','obi'],
  business:      ['business','economy','naira','dollar','inflation','fuel','subsidy','oil','bank','market','trade','cbn','fintech'],
  sports:        ['sport','football','soccer','eagle','afcon','world cup','premier','league','osimhen','npfl','basketball','tennis'],
  entertainment: ['entertainment','nollywood','music','celebrity','film','movie','award','fashion','afrobeat','bbnaija'],
  technology:    ['tech','technology','digital','crypto','bitcoin','ai','startup','internet','software','app'],
  health:        ['health','medical','hospital','disease','covid','vaccine','cancer','mental','wellness','doctor'],
};

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function detectCategory(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return '';
}

function parseRSS(xml, sourceName) {
  const articles = [];
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const item of items.slice(0, 15)) {
    const get = (tag) => {
      const patterns = [
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
      ];
      for (const p of patterns) {
        const m = item.match(p);
        if (m) return m[1].trim();
      }
      return '';
    };

    const title = get('title').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#\d+;/g,'').trim();
    const link  = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    const desc  = get('description').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'').trim().slice(0, 300);
    const pub   = get('pubDate') || get('dc:date') || '';

    // Get image
    let img = '';
    const enclosure = item.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i);
    const mediaCont = item.match(/<media:content[^>]+url="([^"]+)"/i);
    const mediaThmb = item.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const imgTag    = (get('description')||'').match(/<img[^>]+src="([^"]+)"/i);
    img = (enclosure?.[1] || mediaCont?.[1] || mediaThmb?.[1] || imgTag?.[1] || '').trim();

    if (!title || !link) continue;

    const id = Buffer.from(link).toString('base64').slice(0, 22);
    const cat = detectCategory(title, desc);
    const pubDate = pub ? new Date(pub).toISOString() : new Date().toISOString();

    articles.push({ id, title, link, desc, img, source: sourceName, cat, pub: pubDate });
  }

  return articles;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { category, page } = req.query;
  const pageNum = parseInt(page) || 1;
  const pageSize = 20;

  // Cache key
  const cacheKey = `rss-${category||'all'}-${pageNum}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.json(cached.data);
  }

  try {
    // Pick sources to fetch (all or filtered)
    const sources = SOURCES;

    // Fetch all RSS feeds in parallel
    const results = await Promise.allSettled(
      sources.map(async (src) => {
        const r = await fetch(src.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeriaBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw new Error(`${src.name}: ${r.status}`);
        const xml = await r.text();
        return parseRSS(xml, src.name);
      })
    );

    // Combine all articles
    let allArticles = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles = allArticles.concat(result.value);
      }
    }

    // Sort by date — newest first
    allArticles.sort((a, b) => new Date(b.pub) - new Date(a.pub));

    // Remove duplicates by title similarity
    const seen = new Set();
    allArticles = allArticles.filter(a => {
      const key = a.title.slice(0, 40).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by category if requested
    if (category && category !== 'all') {
      allArticles = allArticles.filter(a => a.cat === category);
    }

    // Paginate
    const total = allArticles.length;
    const start = (pageNum - 1) * pageSize;
    const articles = allArticles.slice(start, start + pageSize);
    const nextPage = start + pageSize < total ? String(pageNum + 1) : null;

    const result = {
      status: 'ok',
      articles,
      nextPage,
      total,
      sources: results.map((r, i) => ({
        name: sources[i].name,
        ok: r.status === 'fulfilled',
        count: r.status === 'fulfilled' ? r.value.length : 0,
      })),
    };

    cache.set(cacheKey, { ts: Date.now(), data: result });
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.json(result);

  } catch (err) {
    console.error('RSS fetch error:', err.message);
    return res.status(200).json({
      status: 'error',
      message: err.message,
      articles: [],
      nextPage: null,
    });
  }
}
