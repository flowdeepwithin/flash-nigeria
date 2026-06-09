# ⚡ Flash Nigeria

**Breaking Nigeria. Every Second.**

A free Nigerian news aggregator PWA pulling live RSS feeds from 8+ top Nigerian news outlets.

## Features
- Live news from Punch, Vanguard, TheCable, BellaNaija, Legit.ng, Premium Times, Channels TV, Naijaloaded
- Category filtering: Politics, Entertainment, Sports, Business, Lifestyle, Tech
- AI-powered article summaries (Claude API)
- Trending keywords auto-extracted from headlines
- Bookmark/save articles
- Search across all news
- Breaking news ticker
- Installable PWA (works offline)

## Deploy to Vercel (Free)

1. Go to github.com → Create new repo → Name it `flash-nigeria`
2. Upload all these files to the repo
3. Go to vercel.com → New Project → Import from GitHub
4. Select `flash-nigeria` repo → Deploy
5. Your app is live at `flash-nigeria.vercel.app`

## Files
- `index.html` — full app (single file)
- `sw.js` — service worker for offline/PWA
- `manifest.json` — PWA manifest
- `vercel.json` — routing config
- `icons/` — app icons

## Cost
- Hosting: FREE (Vercel)
- News feeds: FREE (RSS)
- AI summaries: Anthropic API (pay per use, very cheap)

## Customization
- Add more RSS sources in `RSS_SOURCES` array
- Change colors in `:root` CSS variables
- Modify categories in `CAT_KEYWORDS` object
