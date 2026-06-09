export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Whitelist only Nigerian news sources
  const allowed = [
    'punch.ng', 'vanguardngr.com', 'thecable.ng', 'bellanaija.com',
    'legit.ng', 'premiumtimesng.com', 'channelstv.com', 'naijaloaded.com.ng',
    'techcabal.com', 'nairametrics.com', 'guardian.ng', 'dailypost.ng',
    'tribuneonlineng.com', 'businessday.ng'
  ];

  let isAllowed = false;
  try {
    const parsed = new URL(url);
    isAllowed = allowed.some(domain => parsed.hostname.includes(domain));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!isAllowed) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeria/1.0; +https://flash-nigeria.vercel.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    }

    const text = await response.text();

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(text);

  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch feed', detail: err.message });
  }
}
