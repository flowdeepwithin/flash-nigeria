export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  
  let decoded;
  try { decoded = decodeURIComponent(url); } 
  catch(e) { decoded = url; }
  
  // Validate it's actually an image URL
  if (!/^https?:\/\//i.test(decoded)) {
    return res.status(400).send('Invalid URL');
  }

  // Try multiple user agents and referers
  const attempts = [
    { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Referer': new URL(decoded).origin + '/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
    {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'image/*,*/*;q=0.8',
    },
    {
      'User-Agent': 'Twitterbot/1.0',
      'Accept': 'image/*',
    },
    {
      'User-Agent': 'WhatsApp/2.23.1.79 A',
      'Accept': 'image/*',
    }
  ];

  for (const headers of attempts) {
    try {
      const response = await fetch(decoded, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.includes('image') && !contentType.includes('octet')) continue;
      
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 100) continue; // too small, probably an error image
      
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(buffer));
      return;
    } catch (err) {
      continue;
    }
  }
  
  // All attempts failed - return transparent 1x1 pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.send(pixel);
}
