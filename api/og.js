export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  const allowed = [
    'punch.ng','vanguardngr.com','thecable.ng','bellanaija.com','legit.ng',
    'premiumtimesng.com','channelstv.com','naijaloaded.com.ng','techcabal.com',
    'nairametrics.com','guardian.ng','dailypost.ng','tribuneonlineng.com','businessday.ng',
    'leadership.ng','thisdaylive.com','dailytrust.com','saharareporters.com'
  ];

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const isAllowed = allowed.some(domain => host === domain || host.endsWith('.' + domain));
  if (!isAllowed) return res.status(403).json({ error: 'Domain not allowed' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeriaBot/1.0; +https://flash-nigeria.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const html = await response.text();

    const patterns = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /"image"\s*:\s*"(https?:\\/\\/[^"\\]+)"/i,
      /<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i,
    ];

    let image = '';
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) { image = m[1]; break; }
    }

    image = image.replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
    if (image && image.startsWith('//')) image = parsed.protocol + image;
    if (image && image.startsWith('/')) image = parsed.origin + image;

    const valid = /^https?:\/\//i.test(image) && /\.(jpg|jpeg|png|webp)(\?|$|&)/i.test(image);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ image: valid ? image : '' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch article image', detail: err.message });
  }
}
