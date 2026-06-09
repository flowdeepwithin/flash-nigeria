export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  let parsed;
  try { parsed = new URL(url); }
  catch (e) { return res.status(400).json({ error: 'Invalid image URL' }); }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http/https images allowed' });
  }

  // Prevent localhost/private-network fetches.
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' ||
    host.startsWith('10.') || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return res.status(403).json({ error: 'Blocked image host' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeria/1.0; +https://flash-nigeria.vercel.app)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://flash-nigeria.vercel.app/',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return res.status(response.status).json({ error: `Image upstream error: ${response.status}` });

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'URL did not return an image' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', contentType);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch image', detail: err.message });
  }
}
