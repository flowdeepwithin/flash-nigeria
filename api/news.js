export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  try {
    const r = await fetch(decodeURIComponent(url), {
      headers: {'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1)'},
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) throw new Error(r.status);
    const text = await r.text();
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.send(text);
  } catch(e) {
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
  }
}
