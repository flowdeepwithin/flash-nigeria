const API_KEY = 'pub_8c67b54a3b2a420c8492f7291a3f3224';

const CAT_MAP = {
  politics: 'politics',
  business: 'business',
  entertainment: 'entertainment',
  sports: 'sports',
  technology: 'technology',
  health: 'health',
};

// Simple in-memory cache to reduce API calls
const cache = new Map();
const CACHE_TTL = 8 * 60 * 1000; // 8 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { category, page, q } = req.query;

  // Cache headers
  if (!page && !q && !category) {
    res.setHeader('Cache-Control', 'public, s-maxage=480, stale-while-revalidate=960');
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }

  // Check in-memory cache for first page requests
  const cacheKey = `${category||'all'}-${q||''}-${page||'1'}`;
  if (!page && !q) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json(cached.data);
    }
  }

  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      country: 'ng',
      language: 'en',
      image: '1',
      size: '10',
    });

    if (q) params.set('q', q.slice(0, 100));
    if (category && CAT_MAP[category]) params.set('category', CAT_MAP[category]);
    if (page) params.set('page', page);

    const apiUrl = `https://newsdata.io/api/1/latest?${params}`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
    });

    // Handle rate limit gracefully
    if (response.status === 429) {
      return res.status(200).json({
        status: 'error',
        message: 'Daily news limit reached. Please try again later.',
        articles: [],
        nextPage: null,
      });
    }

    if (!response.ok) {
      throw new Error('NewsData API error: ' + response.status);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      // NewsData returns error in status field sometimes
      if (data.results?.status === 'limitReached') {
        return res.status(200).json({
          status: 'error',
          message: 'Daily news limit reached. Please try again later.',
          articles: [],
          nextPage: null,
        });
      }
      throw new Error('API returned: ' + data.status);
    }

    const articles = (data.results || [])
      .filter(item => item.title && item.title !== '[Removed]')
      .map(item => ({
        id: Buffer.from((item.link || item.title || Math.random().toString())).toString('base64').slice(0, 22),
        title: (item.title || '').trim(),
        link: item.link || '#',
        pub: item.pubDate || '',
        desc: (item.description || item.content || '')
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 250),
        img: item.image_url || '',
        source: item.source_name || item.source_id || 'Nigeria News',
        cat: item.category?.[0] || '',
      }));

    const result = {
      status: 'ok',
      articles,
      nextPage: data.nextPage || null,
      total: data.totalResults || 0,
    };

    // Cache first page
    if (!page && !q) {
      cache.set(cacheKey, { ts: Date.now(), data: result });
    }

    return res.json(result);

  } catch (err) {
    console.error('Flash Nigeria API error:', err.message);
    return res.status(200).json({
      status: 'error',
      message: err.message,
      articles: [],
      nextPage: null,
    });
  }
}
