export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ image: '' });

  let decoded;
  try { decoded = decodeURIComponent(url); }
  catch(e) { decoded = url; }

  const headers = {
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  try {
    const response = await fetch(decoded, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) return res.json({ image: '' });
    
    const html = await response.text();

    // Try all common image meta tags
    const patterns = [
      /property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      /property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1] && /^https?:\/\//i.test(match[1])) {
        return res.json({ image: match[1].replace(/&amp;/g, '&').trim() });
      }
    }

    return res.json({ image: '' });
  } catch (err) {
    return res.json({ image: '' });
  }
}
