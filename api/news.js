// Flash Nigeria — RSS News Fetcher v2
// FREE, unlimited, 8 Nigerian sources

const SOURCES = [
  { name: 'Vanguard',        url: 'https://www.vanguardngr.com/feed/' },
  { name: 'Punch',           url: 'https://punchng.com/feed/' },
  { name: 'Daily Post',      url: 'https://dailypost.ng/feed/' },
  { name: 'Premium Times',   url: 'https://www.premiumtimesng.com/feed/' },
  { name: 'Guardian Nigeria',url: 'https://guardian.ng/feed/' },
  { name: 'Channels TV',     url: 'https://www.channelstv.com/feed/' },
  { name: 'ThisDay',         url: 'https://www.thisdaylive.com/index.php/feed/' },
  { name: 'BusinessDay',     url: 'https://businessday.ng/feed/' },
];

const CAT_KEYWORDS = {
  politics:      ['politic','government','senate','president','governor','election','efcc','minister','tinubu','atiku','obi','police','army','military','security','court','judge','law','constitution','national assembly','reps','democracy','party','pdp','apc','labour party','impeach','resign','sack','arrest','detain','prison','jail'],
  business:      ['business','economy','naira','dollar','inflation','fuel','subsidy','oil','bank','market','trade','cbn','fintech','gdp','revenue','tax','budget','import','export','stock','exchange','price','cost','million','billion','pension','asset','equity','securities','frc','investment','finance','financial','monetary','fiscal','debt','loan','credit','mou','procurement'],
  sports:        ['sport','football','soccer','eagle','afcon','world cup','premier','league','osimhen','npfl','basketball','tennis','athletics','cricket','golf','boxing','wrestling','champion','match','game','goal','score','fifa','caf'],
  entertainment: ['entertainment','nollywood','music','celebrity','film','movie','award','fashion','afrobeat','bbnaija','big brother','singer','actor','actress','rapper','concert','album','song','dance','comedy','joke'],
  technology:    ['technolog','digital','crypto','bitcoin','ai ','artificial intelligence','startup','internet','software','app ','apps','cyber','hack','data','cloud','5g','robot','drone','satellite'],
  health:        ['health','medical','hospital','disease','covid','vaccine','cancer','mental','wellness','doctor','nurse','patient','drug','medicine','surgery','outbreak','epidemic','virus','treatment'],
};

function detectCategory(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  // Check in priority order
  for (const cat of ['politics','business','sports','entertainment','technology','health']) {
    if (CAT_KEYWORDS[cat].some(k => text.includes(k))) return cat;
  }
  return '';
}

function extractImage(item, description) {
  // Try multiple image sources in order of reliability
  const patterns = [
    // Media content
    /(<media:content[^>]+url=["'])([^"']+)(["'])/i,
    // Media thumbnail  
    /(<media:thumbnail[^>]+url=["'])([^"']+)(["'])/i,
    // Enclosure
    /(<enclosure[^>]+url=["'])([^"']+)["'][^>]*type=["']image/i,
    // Image in content:encoded
    /<img[^>]+src=["']([^"']+)["']/i,
  ];

  for (const p of patterns) {
    const m = item.match(p);
    if (m) {
      const url = m[2] || m[1];
      if (url && url.startsWith('http') && !url.includes('pixel') && !url.includes('1x1')) {
        return url.trim();
      }
    }
  }

  // Try in description HTML
  if (description) {
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1].startsWith('http')) return imgMatch[1].trim();
  }

  return '';
}

function parseRSS(xml, sourceName) {
  const articles = [];

  // Get all items
  const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)];

  for (const itemMatch of itemMatches.slice(0, 15)) {
    const item = itemMatch[0];

    const get = (tag) => {
      // Try CDATA first
      const cdataMatch = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
      if (cdataMatch) return cdataMatch[1].trim();
      // Try regular content
      const plainMatch = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (plainMatch) return plainMatch[1].replace(/<[^>]+>/g,'').trim();
      return '';
    };

    const rawTitle = get('title');
    const title = rawTitle
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#\d+;/g,'').replace(/&nbsp;/g,' ').trim();

    const rawLink = get('link') || item.match(/<link>([^<]+)<\/link>/i)?.[1] || '';
    const link = rawLink.replace(/&amp;/g,'&').trim();

    if (!title || !link) continue;

    const rawDesc = get('description') || get('content:encoded') || '';
    const desc = rawDesc
      .replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#\d+;/g,'').replace(/\s+/g,' ').trim().slice(0,280);

    const pub = get('pubDate') || get('dc:date') || get('published') || '';

    // Extract image
    const contentEncoded = get('content:encoded');
    const img = extractImage(item, rawDesc + contentEncoded);

    const id = Buffer.from(link).toString('base64').slice(0,22);
    const cat = detectCategory(title, desc);

    let pubDate = '';
    try { pubDate = pub ? new Date(pub).toISOString() : new Date().toISOString(); }
    catch(e) { pubDate = new Date().toISOString(); }

    articles.push({ id, title, link, desc, img, source: sourceName, cat, pub: pubDate });
  }

  return articles;
}

// In-memory cache
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { category, page } = req.query;
  const pageNum = parseInt(page) || 1;
  const pageSize = 20;
  const cacheKey = `rss-${category||'all'}-${pageNum}`;

  // Return cached if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.json(cached.data);
  }

  try {
    // Fetch all RSS feeds in parallel
    const results = await Promise.allSettled(
      SOURCES.map(async src => {
        const r = await fetch(src.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeriaBot/1.0; +https://flash-nigeria.vercel.app)',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(9000),
        });
        if (!r.ok) throw new Error(`${src.name} ${r.status}`);
        const xml = await r.text();
        return parseRSS(xml, src.name);
      })
    );

    // Combine & sort
    let all = [];
    results.forEach(r => { if (r.status === 'fulfilled') all = all.concat(r.value); });
    all.sort((a,b) => new Date(b.pub) - new Date(a.pub));

    // Deduplicate
    const seen = new Set();
    all = all.filter(a => {
      const key = a.title.slice(0,50).toLowerCase().replace(/[^a-z0-9]/g,'');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Filter by category
    if (category && category !== 'all') {
      all = all.filter(a => a.cat === category);
    }

    // Paginate
    const total = all.length;
    const start = (pageNum-1) * pageSize;
    const articles = all.slice(start, start+pageSize);
    const nextPage = start+pageSize < total ? String(pageNum+1) : null;

    const data = { status:'ok', articles, nextPage, total };
    cache.set(cacheKey, { ts: Date.now(), data });
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.json(data);

  } catch(err) {
    console.error('RSS error:', err.message);
    return res.status(200).json({ status:'error', message:err.message, articles:[], nextPage:null });
  }
}
