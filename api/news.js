// Flash Nigeria — RSS News Fetcher v2
// FREE, unlimited, 8 Nigerian sources

const SOURCES = [
  { name: 'Vanguard',        url: 'https://www.vanguardngr.com/feed/' },
  { name: 'Punch',           url: 'https://punchng.com/feed/' },
  { name: 'Daily Post',      url: 'https://dailypost.ng/feed/' },
  { name: 'Premium Times',   url: 'https://www.premiumtimesng.com/feed/' },
  { name: 'Guardian Nigeria',url: 'https://guardian.ng/feed/' },
  { name: 'Channels TV',     url: 'https://www.channelstv.com/feed/' },
  { name: 'BusinessDay',     url: 'https://businessday.ng/feed/' },
  { name: 'Tribune',         url: 'https://tribuneonlineng.com/feed/' },
  { name: 'The Nation',      url: 'https://thenationonlineng.net/feed/' },
  { name: 'Pulse Nigeria',   url: 'https://www.pulse.ng/news/rss' },
  { name: 'Legit.ng',        url: 'https://www.legit.ng/rss/all.rss' },
  // Entertainment heavy sources
  { name: 'Pulse Entertainment', url: 'https://www.pulse.ng/entertainment/rss' },
  { name: 'Legit Entertainment', url: 'https://www.legit.ng/rss/entertainment.rss' },
  { name: 'Vanguard Entertainment', url: 'https://www.vanguardngr.com/entertainment/feed/' },
  { name: 'Punch Entertainment', url: 'https://punchng.com/category/entertainment/feed/' },
  { name: 'The Nation Entertainment', url: 'https://thenationonlineng.net/category/entertainment/feed/' },
  { name: 'Vanguard Sports', url: 'https://www.vanguardngr.com/sports/feed/' },
  { name: 'Punch Sports', url: 'https://punchng.com/category/sports/feed/' },
  { name: 'Complete Sports', url: 'https://www.completesports.com/feed/' },
];

const CAT_KEYWORDS = {
  politics: [
    'politic','government','senate','president','governor','election','efcc','minister',
    'tinubu','atiku','obi','buhari','police','army','military','security','court','judge',
    'law','constitution','national assembly','house of reps','democracy','party','pdp',
    'apc','labour party','impeach','resign','sack','arrest','detain','prison','jail',
    'lawmaker','legislation','bill','state','local government','lga','ward','council',
    'commissioner','speaker','deputy','federal','abuja','aso rock','national','protest',
    'strike','riot','coup','overthrow','presidency','vice president','chief of staff',
    'dss','nsa','ipob','bandits','terrorism','insurgency','boko haram','iswap',
    'kidnap','ransom','hostage','abduct','shooting','gunmen','troops','soldiers',
    'supreme court','appeal court','tribunal','judge','justice','ruling','verdict',
    'firs','customs','immigration','nnpc','fgn','dpr','nuprc',
  ],
  business: [
    'business','economy','naira','dollar','inflation','fuel','subsidy','oil','bank',
    'market','trade','cbn','fintech','gdp','revenue','tax','budget','import','export',
    'stock','exchange','price','cost','million','billion','pension','asset','equity',
    'securities','investment','finance','financial','monetary','fiscal','debt','loan',
    'credit','procurement','dangote','zenith','gtb','access bank','uba','firstbank',
    'fmcg','manufacturing','agriculture','farming','harvest','crude','barrel','brent',
    'forex','interest rate','mpc','monetary','bonds','treasury','pension','insurance',
    'startup','venture','capital','sme','entrepreneur','industry','company','firm',
    'profit','loss','revenue','quarterly','annual','report','shares','dividend',
    'power','electricity','nerc','aedc','eko','jos','ibadan distribution',
  ],
  sports: [
    'sport','football','soccer','super eagle','afcon','world cup','premier league',
    'osimhen','napoli','npfl','basketball','tennis','athletics','cricket','golf',
    'boxing','wrestling','champion','match','game','goal','score','fifa','caf',
    'galatasaray','arsenal','chelsea','manchester','liverpool','real madrid',
    'barcelona','transfer','signing','coach','manager','stadium','league',
    'ranger','ranger rover','cup','trophy','medal','olympics','commonwealth',
    'track','field','relay','swim','nff','nba','wnba','ipl','formula one','f1',
    'felix','blessing','tobi','brume','asaba','warri','lagos','abuja tournament',
    'fan','supporter','jersey','boots','pitch','referee','var','penalty',
  ],
  entertainment: [
    'entertainment','nollywood','music','celebrity','film','movie','award','fashion',
    'afrobeat','bbnaija','big brother','singer','actor','actress','rapper','concert',
    'album','song','dance','comedy','joke','wizkid','davido','burna boy','tiwa',
    'olamide','rema','tems','ckay','asake','fireboy','omah lay','simi','yemi alade',
    'genevieve','omotola','funke akindele','ramsey','ini edo','mercy johnson',
    'rita dominic','kate henshaw','toyin','eniola badmus','odunlade',
    'grammy','headies','amvca','afrima','vgma','kora','oscars','emmy',
    'instagram','tiktok','viral','trending','skit','content creator','influencer',
    'fashion week','model','designer','style','red carpet','premiere','box office',
    'streaming','netflix','amazon prime','showmax','youtube','spotify',
  ],
  technology: [
    'technolog','digital','crypto','bitcoin','blockchain','ai ','artificial intelligence',
    'startup','internet','software','app ','apps','cyber','hack','data','cloud','5g',
    'robot','drone','satellite','elon musk','spacex','tesla','openai','chatgpt',
    'meta','google','microsoft','apple','samsung','iphone','android','laptop',
    'fintech','paystack','flutterwave','opay','kuda','moniepoint','palmpay',
    'e-commerce','jumia','konga','jiji','social media','facebook','twitter','x ',
  ],
  health: [
    'health','medical','hospital','disease','covid','vaccine','cancer','mental',
    'wellness','doctor','nurse','patient','drug','medicine','surgery','outbreak',
    'epidemic','virus','treatment','who','ncdc','fmoh','ministry of health',
    'malaria','cholera','monkeypox','ebola','hiv','aids','tuberculosis','tb',
    'diabetes','hypertension','maternal','infant','mortality','nutrition',
    'federal medical centre','teaching hospital','clinic','pharmacy','nma',
  ],
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
  const patterns = [
    /media:content[^>]+url=["']([^"']+)["']/i,
    /media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i,
    /<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i,
  ];

  for (const p of patterns) {
    const m = item.match(p);
    if (m?.[1] && m[1].startsWith('http') && !m[1].includes('1x1') && !m[1].includes('pixel')) {
      return m[1].trim();
    }
  }

  // Try all img tags in description/content
  const allText = description || '';
  const imgMatches = [...allText.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    if (m[1].startsWith('http') && !m[1].includes('1x1') && !m[1].includes('pixel') && !m[1].includes('s.w.org/images/core')) {
      return m[1].trim();
    }
  }

  // Try srcset
  const srcset = allText.match(/srcset=["']([^"' ]+)/i);
  if (srcset?.[1]?.startsWith('http')) return srcset[1].trim();

  return '';
}

function parseRSS(xml, sourceName) {
  const articles = [];

  // Get all items
  const itemMatches = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)];

  for (const itemMatch of itemMatches.slice(0, 20)) {
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
    // Try RSS category tag first, then detect from text
    const rssCategory = get('category').toLowerCase();
    let cat = '';
    if (rssCategory.includes('sport')) cat = 'sports';
    else if (rssCategory.includes('entertain') || rssCategory.includes('nollywood') || rssCategory.includes('music')) cat = 'entertainment';
    else if (rssCategory.includes('politic') || rssCategory.includes('government')) cat = 'politics';
    else if (rssCategory.includes('business') || rssCategory.includes('economy') || rssCategory.includes('finance')) cat = 'business';
    else if (rssCategory.includes('tech') || rssCategory.includes('digital')) cat = 'technology';
    else if (rssCategory.includes('health') || rssCategory.includes('medical')) cat = 'health';
    else cat = detectCategory(title, desc);

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

  // Check full article cache first (stores ALL articles)
  const fullCacheKey = `rss-full-${category||'all'}`;
  let all = [];
  const fullCached = cache.get(fullCacheKey);
  if (fullCached && Date.now() - fullCached.ts < CACHE_TTL) {
    all = fullCached.data;
  } else {
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
    results.forEach(r => { if (r.status === 'fulfilled') all = all.concat(r.value); });
    all.sort((a,b) => new Date(b.pub) - new Date(a.pub));

    // For articles with no image — use category placeholder
    all = all.map(a => {
      if (!a.img || !a.img.startsWith('http')) {
        // Give entertainment/sports a branded placeholder color
        // so they still show but with style
        if (a.cat === 'entertainment') a.img = 'entertainment';
        else if (a.cat === 'sports') a.img = 'sports';
        else if (a.cat === 'politics') a.img = 'politics';
        else if (a.cat === 'business') a.img = 'business';
        else return null; // Remove uncategorised articles with no image
      }
      return a;
    }).filter(Boolean);

    // Deduplicate
    const seen = new Set();
    all = all.filter(a => {
      const key = a.title.slice(0,50).toLowerCase().replace(/[^a-z0-9]/g,'');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Interleave sources for ALL tab — sort by date for category tabs
    if (!category || category === 'all') {
      const bySource = {};
      all.forEach(a => {
        if (!bySource[a.source]) bySource[a.source] = [];
        bySource[a.source].push(a);
      });
      const sourceNames = Object.keys(bySource);
      const interleaved = [];
      let hasMore = true;
      while (hasMore) {
        hasMore = false;
        for (const src of sourceNames) {
          if (bySource[src].length > 0) {
            interleaved.push(bySource[src].shift());
            hasMore = true;
          }
        }
      }
      all = interleaved;
    }
    // For category pages keep date sort (already sorted above)

    // Store ALL articles in full cache
    cache.set(fullCacheKey, { ts: Date.now(), data: all });
  } catch(err) {
    console.error('RSS fetch error:', err.message);
    return res.status(200).json({ status:'error', message:err.message, articles:[], nextPage:null });
  }
  } // end else

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

}
