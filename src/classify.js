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
4. Pick the 5 must-reads.`;

export async function classify(items) {
  const listing = items.map((it, id) =>
    `[${id}] (${it.sourceName}${it.africaSource ? ', Africa-focused outlet' : ''}) ${it.title}\n${it.excerpt.slice(0, 350)}`).join('\n\n');

  try {
    const client = new Anthropic();
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: zodOutputFormat(Edition) },
      messages: [{ role: 'user', content: `Articles:\n\n${listing}` }],
    });
    if (res.stop_reason !== 'end_turn' || !res.parsed_output) throw new Error(`stop_reason ${res.stop_reason}`);
    return { ...repair(res.parsed_output, items.length), engine: 'claude' };
  } catch (err) {
    console.warn(`Claude classification failed (${err.message}); using keyword rules.`);
    return { ...keywordEdition(items), engine: 'keywords' };
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
    if (!used.has(id)) stories.push({ ids: [id], section: 'general', summary: '', importance: 2 });
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
    return { ids: [id], section, summary: '', importance: 3 };
  });
  return { stories, mustReads: stories.slice(0, 5).map((story) => ({ story, why: '' })) };
}
