export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  let decoded;
  try { decoded = decodeURIComponent(url); }
  catch(e) { decoded = url; }

  try {
    const response = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) throw new Error('Feed error: ' + response.status);
    const text = await response.text();

    // Parse items from raw XML text using regex (avoids namespace issues)
    const items = [];
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(text)) !== null && items.length < 15) {
      const block = match[1];

      const title = decodeEntities(extractTag(block, 'title'));
      const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
      const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || extractTag(block, 'published');
      const desc = decodeEntities(extractTag(block, 'description') || extractTag(block, 'content:encoded') || '');

      // Extract image - try ALL possible locations
      let img = '';

      // 1. media:content url attribute
      img = img || extractAttr(block, 'media:content', 'url');
      // 2. media:thumbnail url attribute  
      img = img || extractAttr(block, 'media:thumbnail', 'url');
      // 3. enclosure url attribute
      const encType = extractAttr(block, 'enclosure', 'type') || '';
      if (!img && (encType.includes('image') || !encType)) {
        img = extractAttr(block, 'enclosure', 'url');
      }
      // 4. og:image in content
      img = img || (block.match(/og:image[^>]+content=["']([^"']+)["']/i) || [])[1];
      // 5. img src in description
      if (!img) {
        const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
                      || desc.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)(\?[^\s"'<>]*)?/i);
        if (imgMatch) img = imgMatch[1] || imgMatch[0];
      }
      // 6. Any image URL in the whole block
      if (!img) {
        const anyImg = block.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)(\?[^\s"'<>]*)?/i);
        if (anyImg) img = anyImg[0];
      }

      // Clean up img URL
      if (img) img = img.replace(/&amp;/g, '&').replace(/^\s+|\s+$/g, '');

      // Clean description
      const cleanDesc = desc.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').trim().slice(0, 200);

      if (title && link) {
        items.push({ title, link: link.trim(), pubDate, desc: cleanDesc, img });
      }
    }

    res.json({ status: 'ok', items });
  } catch (err) {
    res.status(500).json({ error: err.message, items: [] });
  }
}

function extractTag(text, tag) {
  const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = text.match(r);
  return m ? m[1].trim() : '';
}

function extractAttr(text, tag, attr) {
  const r = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, 'i');
  const m = text.match(r);
  return m ? m[1].trim() : '';
}

function decodeEntities(s) {
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
