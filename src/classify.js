// One Claude call turns the raw article list into an edition: duplicate stories merged,
// each story placed in a section with a one-line summary, and the day's must-reads picked.
// If the call fails, a keyword fallback keeps the digest going.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { SECTIONS } from './sources.js';

const MODEL = 'claude-opus-5-5';
const SECTION_IDS = SECTIONS.map((s) => s.id);

const Edition = z.object({
  stories: z.array(z.object({
    ids: z.array(z.number().int()).describe('Article ids covering this same story. First id = the best article to link to.'),
    section: z.enum(SECTION_IDS),
    summary: z.string().describe('One plain sentence, max 30 words, stating the news and the key number if there is one.'),
    importance: z.number().int().min(1).max(5).describe('5 = must know for an operator executive; 1 = minor/promotional.'),
    results: z.object({
      company: z.string().describe('The reporting company\'s full name, e.g. "Flutter Entertainment plc".'),
      ticker: z.string().nullable().describe('Main stock ticker if known, e.g. "FLUT", "ENT.L", "EVO.ST"; null if unknown.'),
      period: z.string().describe('Reporting period, e.g. "Q3 2026", "H1 2026", "FY 2025", "Q2 FY2027".'),
    }).nullable().describe('Set only when the story reports this company\'s own financial results; otherwise null.'),
  })),
  must_reads: z.array(z.object({
    story: z.number().int().describe('Index into the stories array.'),
    why: z.string().describe('Max 15 words: why a B2Tech executive should read it.'),
  })).describe('The 5 most important stories of the day, most important first.'),
});

const SYSTEM = `You are the news editor of a daily internal briefing for B2Tech, an online casino and sportsbook operator focused on African markets.
You receive the last day's articles from iGaming trade press. Build the edition:

1. Group articles that report the same news (same event, deal, result or appointment) into one story. Every article id appears in exactly one story.
2. Place each story in exactly one section, using the first rule that matches:
   - africa: the story is about an African market, regulator, operator or event (Nigeria, Kenya, South Africa, Ghana, Tanzania, Uganda, Zambia, Ethiopia, etc.).
   - quarterly: earnings, quarterly/half-year/annual results, trading updates, revenue or GGR figures reported by a company, guidance, analyst forecasts on a listed company.
   - people: appointments, departures, promotions, board changes, hires.
   - sports: sports betting, sportsbooks, odds, betting on sports events, prediction markets, sports sponsorship.
   - casino: online casino, slots, live casino, games studios, game launches, land-based casinos.
   - general: everything else (regulation, legislation, M&A outside results, technology, payments, marketing, events, responsible gambling).
3. Score importance from a senior operator's point of view. Regulation and tax changes, large M&A, major operator results and market openings score high. Supplier product launches, event promos and sponsored content score 1-2.
4. Pick the 5 must-reads.
5. Mark results stories. When a story reports a specific company's own financial results (quarterly, half-year or full-year results, or a trading update with figures), fill "results" with the company, its main ticker if you know it, and the period. Use the company's own period naming (a fiscal-year company's "Q2 FY2027" stays that way). Leave it null for market-level figures (state or national GGR, regulator statistics), for previews of upcoming results, and for stories that only mention results in passing.`;

// Deterministic safety net over the model's grouping: merge stories whose lead headlines are
// near-duplicates (the same news reworded by different outlets). Primary de-duplication is the
// model grouping articles into one story; this catches what it misses and, crucially, cleans up
// the keyword fallback, which otherwise makes every single article its own story.
const STOP = new Set('the a an of to in on for and or as at by with from is are be was were it its new has have had will after amid over into out more most than then that this these those up down off week day year has say says'.split(' '));
const toks = (t = '') => [...new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const sim = (a, b) => { if (!a.length || !b.length) return 0; const B = new Set(b); let i = 0; for (const x of a) if (B.has(x)) i++; return i / (a.length + b.length - i); };

function dedupe({ stories, mustReads }, items) {
  const survivors = [];
  const map = new Map();
  for (const s of stories) {
    const t = toks(items[s.ids[0]]?.title);
    // Same section + strong overlap, or very strong overlap regardless of section.
    const host = survivors.find((k) => (k.section === s.section && sim(k._t, t) >= 0.6) || sim(k._t, t) >= 0.82);
    if (host) {
      for (const id of s.ids) if (!host.ids.includes(id)) host.ids.push(id); // keep host's lead; others become "also covered by"
      if (s.importance > host.importance) host.importance = s.importance;
      host.summary ||= s.summary;
      map.set(s, host);
    } else {
      s._t = t;
      survivors.push(s);
      map.set(s, s);
    }
  }
  survivors.forEach((s) => delete s._t);
  const seen = new Set();
  const merged = mustReads
    .map((m) => ({ story: map.get(m.story) || m.story, why: m.why }))
    .filter((m) => m.story?.ids?.length && !seen.has(m.story) && seen.add(m.story));
  return { stories: survivors, mustReads: merged };
}

// Cap the articles sent to the model so its structured output can't overflow max_tokens and
// truncate (items are date-sorted, so this keeps the most recent). Any overflow is still
// rendered: repair() files unseen ids under "general".
const CLASSIFY_CAP = 220;

export async function classify(items) {
  const listing = items.slice(0, CLASSIFY_CAP).map((it, id) =>
    `[${id}] (${it.sourceName}${it.africaSource ? ', Africa-focused outlet' : ''}) ${it.title}\n${(it.excerpt || '').slice(0, 300)}`).join('\n\n');

  try {
    // Cloud environments reserve ANTHROPIC_API_KEY for their own login, so the cloud job
    // passes the key as GAMING_DAILY_API_KEY. Locally the shared .env key works as before.
    const client = new Anthropic({ apiKey: process.env.GAMING_DAILY_API_KEY || process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: zodOutputFormat(Edition) },
      messages: [{ role: 'user', content: `Articles:\n\n${listing}` }],
    });
    if (res.stop_reason !== 'end_turn' || !res.parsed_output) throw new Error(`stop_reason ${res.stop_reason}`);
    return { ...dedupe(repair(res.parsed_output, items.length), items), engine: 'claude' };
  } catch (err) {
    console.warn(`Claude classification failed (${err.message}); using keyword rules.`);
    return { ...dedupe(keywordEdition(items), items), engine: 'keywords' };
  }
}

// Make sure every article ends up in exactly one story, whatever the model returned.
function repair(edition, count) {
  const used = new Set();
  const stories = [];
  for (const s of edition.stories) {
    const ids = s.ids.filter((id) => id >= 0 && id < count && !used.has(id));
    ids.forEach((id) => used.add(id));
    stories.push({ ...s, ids });
  }
  for (let id = 0; id < count; id++) {
    if (!used.has(id)) stories.push({ ids: [id], section: 'general', summary: '', importance: 2, results: null });
  }
  const mustReads = edition.must_reads.filter((m) => stories[m.story]?.ids.length);
  return { stories: stories.filter((s) => s.ids.length), mustReads: mustReads.map((m) => ({ story: stories[m.story], why: m.why })) };
}

const RULES = [
  ['africa', /\b(africa|nigeria|kenya|ghana|tanzania|uganda|zambia|ethiopia|malawi|mozambique|namibia|botswana|cameroon|senegal|egypt|morocco|lagos|nairobi|johannesburg)\b/i],
  ['quarterly', /\b(q[1-4]|quarter|half-year|h1|h2|results|earnings|revenue|ggr|trading update|guidance|ebitda|profit)\b/i],
  ['people', /\b(appoint|hires?|named|joins|steps down|departs|promot|ceo|cfo|coo|chief|head of|board)\b/i],
  ['sports', /\b(sports?book|sports betting|betting|odds|prediction market|football|nfl|nba|bet)\b/i],
  ['casino', /\b(casino|slots?|igaming|game studio|live dealer|jackpot|games)\b/i],
];

function keywordEdition(items) {
  const stories = items.map((it, id) => {
    const text = `${it.title} ${it.excerpt}`;
    const section = (it.africaSource && 'africa') || RULES.find(([, re]) => re.test(text))?.[0] || 'general';
    return { ids: [id], section, summary: '', importance: 3, results: null };
  });
  return { stories, mustReads: stories.slice(0, 5).map((story) => ({ story, why: '' })) };
}
