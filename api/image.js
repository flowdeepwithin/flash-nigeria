export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  
  try {
    const decoded = decodeURIComponent(url);
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) throw new Error('Image fetch failed: ' + response.status);
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(buffer));
  } catch (err) {
    // Return a 1x1 transparent pixel on failure
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
    res.setHeader('Content-Type','image/gif');
    res.setHeader('Cache-Control','public, max-age=3600');
    res.send(pixel);
  }
}
