// Every source we pull, and how. Crawlability was verified 2026-10-13:
// all of these are open (no login, no paywall, robots.txt permits the path used).
// LinkedIn and X/Twitter are deliberately excluded (login wall / paid API).
// `gnews` is a Google News search used when the direct fetch fails: Cloudflare on SBC, Focus
// and Gambling Insider blocks data-centre IPs, so the cloud job reads them via Google News.

// Gambling-relevance filters for BROAD outlets (general business / tech / payments / racing):
// we keep only items that look gambling-related, so a tech or payments feed doesn't flood the
// gaming digest. Gambling-specific trade sites are added without a filter.
const GAMING_RE = /\b(gambl\w*|betting|bet365|sportsbook|sports[- ]?bet\w*|casino|i-?gaming|lotter\w*|wager\w*|bookmaker|aviator|flutter|draftkings|entain|betway|sportybet|sportpesa|1xbet|parimatch|prediction market|gaming (?:licen|regulat|tax|board|commission|authorit))\b/i;
const FR_GAMING_RE = /\b(pari\w*|paris sportifs|jeux? d['’’]argent|casino|lotter\w*|loterie|bookmaker|sportybet|betway|1xbet|parier)\b/i;

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
  { id: 'ibetaf',  name: 'iBetAfrica',              type: 'rss',     url: 'https://ibetafrica.com/feed/', africa: true, gnews: 'site:ibetafrica.com' },

  // --- Added 2026-10-15 (gambling-specific trade; full feed) ---
  { id: 'ignext',  name: 'iGaming NEXT',            type: 'rss',     url: 'https://igamingnext.com/feed/', gnews: 'site:igamingnext.com' },
  { id: 'igpost',  name: 'iGaming Post',            type: 'rss',     url: 'https://igamingpost.com/feed/', gnews: 'site:igamingpost.com' },
  { id: 'cbeats',  name: 'CasinoBeats',             type: 'rss',     url: 'https://casinobeats.com/feed/', gnews: 'site:casinobeats.com' },
  { id: 'eugaming', name: 'European Gaming',        type: 'rss',     url: 'https://europeangaming.eu/portal/feed/', gnews: 'site:europeangaming.eu' },
  { id: 'findmore', name: 'Findmore Africa',        type: 'rss',     url: 'https://findmoreafrica.com/feed/', africa: true, gnews: 'site:findmoreafrica.com' },
  { id: 'lsr',     name: 'Legal Sports Report',     type: 'rss',     url: 'https://www.legalsportsreport.com/feed/', gnews: 'site:legalsportsreport.com' },
  { id: 'covers',  name: 'Covers',                  type: 'rss',     url: 'https://www.covers.com/rss', gnews: 'site:covers.com (betting OR odds OR sportsbook OR gambling)' },
  { id: 'tcl',     name: 'The Closing Line',        type: 'rss',     url: 'https://closingline.substack.com/feed', gnews: 'site:closingline.substack.com' },
  { id: 'gamblest', name: 'The Gamblest',           type: 'rss',     url: 'https://www.thegamblest.com/feed/', gnews: 'site:thegamblest.com' },

  // --- Added 2026-10-15 (gambling-specific, no open feed → Google News) ---
  { id: 'ggb',     name: 'Global Gaming Business',  type: 'gnews',   gnews: 'site:ggbmagazine.com' },
  { id: 'vixio',   name: 'Vixio',                   type: 'gnews',   gnews: 'site:vixio.com' },
  { id: 'gbgc',    name: 'GBGC',                    type: 'gnews',   gnews: 'site:gbgc.com' },

  // --- Added 2026-10-15 (broad outlets → scoped to gambling-relevant stories) ---
  { id: 'techcabal', name: 'TechCabal',             type: 'rss',     url: 'https://techcabal.com/feed/', africa: true, filter: GAMING_RE, gnews: 'site:techcabal.com (betting OR gambling OR casino OR igaming OR lottery OR sportsbook)' },
  { id: 'nairam',  name: 'Nairametrics',            type: 'rss',     url: 'https://nairametrics.com/feed/', africa: true, filter: GAMING_RE, gnews: 'site:nairametrics.com (betting OR gambling OR casino OR gaming OR lottery OR sportsbook)' },
  { id: 'finextra', name: 'Finextra',               type: 'rss',     url: 'https://www.finextra.com/rss/headlines.aspx', filter: GAMING_RE, gnews: 'site:finextra.com (gambling OR betting OR igaming OR casino OR sportsbook)' },
  { id: 'jafrique', name: 'Jeune Afrique (EN)',     type: 'rss',     url: 'https://www.jeuneafrique.com/feed/', africa: true, filter: FR_GAMING_RE, translate: 'fr', gnews: 'site:jeuneafrique.com (pari OR paris OR casino OR jeux OR loterie OR bookmaker)' },
  { id: 'techpoint', name: 'Techpoint Africa',      type: 'gnews',   gnews: 'site:techpoint.africa (betting OR gambling OR casino OR igaming OR lottery OR sportsbook)', africa: true },
  { id: 'bda',     name: 'Business Daily Africa',   type: 'gnews',   gnews: 'site:businessdailyafrica.com (betting OR gambling OR casino OR gaming OR lottery OR sportsbook)', africa: true },
  { id: 'paypers', name: 'The Paypers',             type: 'gnews',   gnews: 'site:thepaypers.com (gambling OR betting OR igaming OR casino OR sportsbook)' },
  { id: 'racing',  name: 'Racing Post',             type: 'gnews',   gnews: 'site:racingpost.com (gambling OR bookmaker OR sportsbook OR "gambling commission" OR affordability OR levy OR "betting shops" OR "online betting")' },
];

// EGR Intel is a SEPARATE, cordoned feed: headlines only (articles are subscriber-only),
// shown in its own "EGR Headlines" section, and deliberately NOT part of SOURCES — so it
// never enters classification or cross-source de-duplication. Every EGR headline is listed
// regardless of whether the same story also appears (from another outlet) elsewhere.
export const EGR = {
  id: 'egr',
  label: 'EGR Headlines',
  name: 'EGR Intel',
  url: 'https://www.egr.global/intel/feed/',
};

export const SECTIONS = [
  { id: 'general',   label: 'General News' },
  { id: 'quarterly', label: 'Quarterly Reports' },
  { id: 'casino',    label: 'Casino' },
  { id: 'sports',    label: 'Sports Betting' },
  { id: 'payments',  label: 'Payments' },
  { id: 'people',    label: 'People Moves' },
  { id: 'africa',    label: 'Africa' },
];
