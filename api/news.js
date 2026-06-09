export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  
  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlashNigeria/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) throw new Error('Feed returned ' + response.status);
    const text = await response.text();
    res.setHeader('Content-Type', 'application/xml');
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
