export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  try {
    const decoded = decodeURIComponent(url);
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(response.status);
    const html = await response.text();

    // Extract og:image or twitter:image
    const patterns = [
      /property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    let image = '';
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && /https?:\/\//i.test(m[1])) {
        image = m[1].replace(/&amp;/g, '&');
        break;
      }
    }

    res.json({ image });
  } catch (err) {
    res.json({ image: '' });
  }
}
