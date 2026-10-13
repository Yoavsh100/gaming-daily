// Coverage universe: the "select few" publicly traded gaming companies.
// Add or edit entries here. The `ir` / `sec` hints steer the model's web
// search toward primary sources first. `aliases` let the CLI resolve loose
// user input (ticker, short name, brand) to the right company.

export const WATCHLIST = [
  {
    ticker: 'FLUT',
    name: 'Flutter Entertainment plc',
    aliases: ['flutter', 'fanduel', 'paddypower', 'flut'],
    exchange: 'NYSE / LSE',
    fiscalYearEnd: 'December',
    ir: 'https://flutter.com/investors/investor-hub/results-reports/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001635327&type=10-Q',
    segments: ['US (FanDuel)', 'UK & Ireland', 'International', 'Australia'],
    notes: 'Reports in USD since 2024 US primary listing. Watch US sportsbook hold, UK gaming duty, leverage.'
  },
  {
    ticker: 'DKNG',
    name: 'DraftKings Inc.',
    aliases: ['draftkings', 'draft kings', 'dkng'],
    exchange: 'NASDAQ',
    fiscalYearEnd: 'December',
    ir: 'https://investors.draftkings.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001883685&type=10-Q',
    segments: ['B2C (Sportsbook, iGaming, DFS)'],
    notes: 'US-centric pure play. Watch structural sportsbook hold, promo reinvestment, MUP/ARPMUP.'
  },
  {
    ticker: 'ENT.L',
    name: 'Entain plc',
    aliases: ['entain', 'ladbrokes', 'coral', 'bwin', 'betmgm'],
    exchange: 'LSE',
    fiscalYearEnd: 'December',
    ir: 'https://www.entaingroup.com/investor-relations/',
    sec: null,
    segments: ['UK & Ireland Retail', 'UK & Ireland Online', 'International', 'BetMGM (JV 50%)'],
    notes: 'Reports in GBP. BetMGM is a 50/50 JV with MGM (equity accounted). Watch UK online, JV losses/profit.'
  },
  {
    ticker: 'EVO.ST',
    name: 'Evolution AB',
    aliases: ['evolution', 'evolution gaming', 'evo'],
    exchange: 'Nasdaq Stockholm',
    fiscalYearEnd: 'December',
    ir: 'https://www.evolution.com/investors/',
    sec: null,
    segments: ['Live Casino', 'RNG'],
    notes: 'Reports in EUR. B2B live casino supplier. Watch Asia/grey-market exposure, EBITDA margin, cyberattacks.'
  },
  {
    ticker: 'LNW',
    name: 'Light & Wonder, Inc.',
    aliases: ['light and wonder', 'light & wonder', 'scientific games', 'lnw'],
    exchange: 'NASDAQ / ASX',
    fiscalYearEnd: 'December',
    ir: 'https://investors.lnw.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000750004&type=10-Q',
    segments: ['Gaming', 'SciPlay (social)', 'iGaming'],
    notes: 'Slot/content supplier. Watch Gaming operations install base, SciPlay, Dragon Train / IP litigation.'
  },
  {
    ticker: 'CHDN',
    name: 'Churchill Downs Incorporated',
    aliases: ['churchill downs', 'chdn', 'twinspires'],
    exchange: 'NASDAQ',
    fiscalYearEnd: 'December',
    ir: 'https://ir.churchilldowns.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000020286&type=10-Q',
    segments: ['Live and Historical Racing', 'Wagering Services (TwinSpires)', 'Gaming'],
    notes: 'Kentucky Derby, HRM expansion. Watch project capex, HRM ramp (Virginia), leverage.'
  },
  {
    ticker: 'SGHC',
    name: 'Super Group (SGHC) Limited',
    aliases: ['super group', 'betway', 'spin', 'sghc'],
    exchange: 'NYSE',
    fiscalYearEnd: 'December',
    ir: 'https://investors.sghc.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001891856&type=20-F',
    segments: ['Betway (sports)', 'Spin (casino)'],
    notes: 'Reports in USD. Exited US. Watch Africa/Canada growth, ex-US margin, dividend.'
  },
  {
    ticker: 'GENI',
    name: 'Genius Sports Limited',
    aliases: ['genius sports', 'geni', 'genius'],
    exchange: 'NYSE',
    fiscalYearEnd: 'December',
    ir: 'https://investors.geniussports.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001834489&type=10-Q',
    segments: ['Betting Technology, Content & Services', 'Media Technology, Content & Services', 'Sports Technology & Services'],
    notes: 'Sports data rights (NFL). Watch data rights cost, group margin flow-through, FCF conversion.'
  },
  {
    ticker: 'RSI',
    name: 'Rush Street Interactive, Inc.',
    aliases: ['rush street', 'betrivers', 'rsi'],
    exchange: 'NYSE',
    fiscalYearEnd: 'December',
    ir: 'https://investors.rushstreetinteractive.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001793659&type=10-Q',
    segments: ['B2C Online Casino & Sportsbook (US + LatAm)'],
    notes: 'BetRivers. Watch MAUs & ARPMAU (US vs LatAm), iGaming mix, margin, guidance raises.'
  },
  {
    ticker: 'SRAD',
    name: 'Sportradar Group AG',
    aliases: ['sportradar', 'srad'],
    exchange: 'NASDAQ',
    fiscalYearEnd: 'December',
    ir: 'https://investors.sportradar.com/',
    sec: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001836470&type=6-K',
    segments: ['Betting Technology & Solutions', 'Sports Content, Technology & Services'],
    notes: 'Reports EUR. Sports data (NBA/ATP). Watch net retention, margin, rights costs, FCF.'
  },
  {
    ticker: 'EVOK.L',
    name: 'evoke plc',
    aliases: ['evoke', '888', '888 holdings', 'william hill', 'mr green'],
    exchange: 'LSE',
    fiscalYearEnd: 'December',
    ir: 'https://www.evokeplc.com/investors/',
    sec: null,
    segments: ['UK & Ireland Online', 'UK Retail', 'International'],
    notes: 'Reports GBP; often half-yearly. High leverage — watch net debt/deleveraging, online growth.'
  },
  {
    ticker: 'BETS-B.ST',
    name: 'Betsson AB',
    aliases: ['betsson', 'bets-b', 'betsb'],
    exchange: 'Nasdaq Stockholm',
    fiscalYearEnd: 'December',
    ir: 'https://www.betssonab.com/en/investors/',
    sec: null,
    segments: ['Casino', 'Sportsbook'],
    notes: 'Presents EUR. Strong LatAm/CEECA. Watch organic growth, sportsbook margin, region mix, buyback.'
  },
  {
    ticker: 'PTEC.L',
    name: 'Playtech plc',
    aliases: ['playtech', 'ptec', 'caliplay'],
    exchange: 'LSE',
    fiscalYearEnd: 'December',
    ir: 'https://www.playtech.com/investors/',
    sec: null,
    segments: ['B2B', 'B2C'],
    notes: 'Reports EUR; half-yearly. Post-Snaitech B2B pure play. Watch US, Caliplay, net cash, capital return.'
  }
];

// Resolve a loose user string ("flutter", "FLUT", "fanduel") to a watchlist entry.
export function resolveCompany(input) {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  return (
    WATCHLIST.find((c) => c.ticker.toLowerCase() === q) ||
    WATCHLIST.find((c) => c.name.toLowerCase() === q) ||
    WATCHLIST.find((c) => c.aliases.some((a) => a === q)) ||
    WATCHLIST.find((c) => c.name.toLowerCase().includes(q)) ||
    WATCHLIST.find((c) => c.aliases.some((a) => a.includes(q) || q.includes(a))) ||
    null
  );
}
