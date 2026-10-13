// Every source we pull, and how. Crawlability was verified 2026-10-13:
// all of these are open (no login, no paywall, robots.txt permits the path used).
// LinkedIn and X/Twitter are deliberately excluded (login wall / paid API).
// `gnews` is a Google News search used when the direct fetch fails: Cloudflare on SBC, Focus
// and Gambling Insider blocks data-centre IPs, so the cloud job reads them via Google News.

export const SOURCES = [
  { id: 'igb',     name: 'iGaming Business',       type: 'rss',     url: 'https://igamingbusiness.com/feed/' },
  // SBC's robots.txt disallows /feed/ for generic bots, so we use its Google News sitemap instead.
  { id: 'sbc',     name: 'SBC News',                type: 'sitemap', url: 'https://sbcnews.co.uk/news-sitemap.xml', gnews: 'site:sbcnews.co.uk' },
  { id: 'next',    name: 'NEXT.io',                 type: 'rss',     url: 'https://next.io/feed/' },
  { id: 'gi',      name: 'Gambling Insider',        type: 'rss',     url: 'https://www.gamblinginsider.com/feed/', gnews: 'site:gamblinginsider.com/news' },
  { id: 'focus',   name: 'Focus Gaming News',       type: 'rss',     url: 'https://focusgn.com/feed/', gnews: 'site:focusgn.com -site:focusgn.com/africa' },
  { id: 'focusaf', name: 'Focus Gaming News Africa', type: 'rss',    url: 'https://focusgn.com/africa/feed/', africa: true, gnews: 'site:focusgn.com/africa' },
  { id: 'yogonet', name: 'Yogonet',                 type: 'rss',     url: 'https://www.yogonet.com/international/rss.xml' },
  { id: 'gintel',  name: 'Gaming Intelligence',     type: 'wpjson',  url: 'https://www.gamingintelligence.com/wp-json/wp/v2/posts' },
  { id: 'igafr',   name: 'iGaming AFRIKA',          type: 'rss',     url: 'https://igamingafrika.com/feed/', africa: true },
  { id: 'igfut',   name: 'iGaming Future',          type: 'rss',     url: 'https://igamingfuture.com/feed/', africa: true },
];

export const SECTIONS = [
  { id: 'general',   label: 'General News' },
  { id: 'quarterly', label: 'Quarterly Reports' },
  { id: 'casino',    label: 'Casino' },
  { id: 'sports',    label: 'Sports Betting' },
  { id: 'people',    label: 'People Moves' },
  { id: 'africa',    label: 'Africa' },
];
