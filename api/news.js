Skip to content
flowdeepwithin
flash-nigeria
Repository navigation
Code
Issues
Pull requests
Actions
Projects
Wiki
Security and quality
Insights
Settings
Comparing changes
Choose two branches to see what’s changed or to start a new pull request. If you need to, you can also  or learn more about diff comparisons.
...
 1 commit
 1 file changed
 1 contributor
Commits on Jun 9, 2026
Update news.js

@flowdeepwithin
flowdeepwithin authored 4 hours ago
 Showing  with 11 additions and 74 deletions.
 85 changes: 11 additions & 74 deletions85  
api/news.js
Original file line number	Diff line number	Diff line change
@@ -1,80 +1,17 @@
const API_KEY = 'pub_8c67b54a3b2a420c8492f7291a3f3224';

const CATEGORY_MAP = {
  politics: 'politics',
  business: 'business',
  entertainment: 'entertainment',
  sports: 'sports',
  technology: 'technology',
  health: 'health',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  const { url, category, page } = req.query;

  // If called with RSS url (legacy) — proxy it directly
  if (url) {
    let decoded;
    try { decoded = decodeURIComponent(url); }
    catch(e) { decoded = url; }
    try {
      const response = await fetch(decoded, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(response.status);
      const text = await response.text();
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.send(text);
    } catch(err) {
      return res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
    }
  }

  // NewsData.io API call
  const { url } = req.query;
  if (!url) return res.status(400).send('No URL');
  try {
    const params = new URLSearchParams({
      apikey: API_KEY,
      country: 'ng',
      language: 'en',
      image: '1',
      size: '50',
    });
    if (category && category !== 'all' && CATEGORY_MAP[category]) {
      params.set('category', CATEGORY_MAP[category]);
    }
    if (page) params.set('page', page);

    const apiUrl = `https://newsdata.io/api/1/latest?${params}`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(12000),
    const r = await fetch(decodeURIComponent(url), {
      headers: {'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1)'},
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) throw new Error('NewsData API error: ' + response.status);
    const data = await response.json();

    if (data.status !== 'success') throw new Error('API returned: ' + data.status);

    const articles = (data.results || []).map(item => ({
      title: (item.title || '').trim(),
      link: item.link || item.source_url || '#',
      pub: item.pubDate || '',
      desc: (item.description || item.content || '').replace(/<[^>]+>/g,'').trim().slice(0, 200),
      img: item.image_url || '',
      n: item.source_id || item.source_name || 'News',
      cat: item.category?.[0] || 'news',
      id: Buffer.from(item.link || item.title || Math.random().toString()).toString('base64').slice(0, 22),
    })).filter(a => a.title);

    res.json({ status: 'ok', articles, nextPage: data.nextPage || null });
  } catch(err) {
    res.status(500).json({ status: 'error', message: err.message, articles: [] });
    if (!r.ok) throw new Error(r.status);
    const text = await r.text();
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.send(text);
  } catch(e) {
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>');
  }
}
Footer
© 2026 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Community
Docs
Contact
Manage cookies
Do not share my personal information
