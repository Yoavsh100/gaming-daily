// Merlin's analyst engine: researches one company's results with Claude and returns the
// structured report (schema.js) that render.js turns into the CEO-brief PDF.
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildTask } from './prompt.js';
import { REPORT_SCHEMA } from './schema.js';

export const MODEL = process.env.MERLIN_MODEL || 'claude-fable-5-1';
const MAX_SEARCHES = Number(process.env.MERLIN_MAX_SEARCHES || 15);
const MAX_FETCHES = Number(process.env.MERLIN_MAX_FETCHES || 10);
const MAX_TURNS = 8; // resumes after pause_turn, plus one reminder to submit

const TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES },
  // A full 10-Q can run past 100k tokens; the cap keeps one filing from dominating every later step.
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: MAX_FETCHES, max_content_tokens: 30000 },
  {
    name: 'submit_report',
    description: 'Submit the final structured analyst report. Call exactly once when research is complete.',
    input_schema: REPORT_SCHEMA,
  },
];

// Approximate $ per million tokens, for the run log only (web search is billed separately).
const PRICES = {
  'claude-fable-5-1': { in: 10, out: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
};
export function estimateCost(usage, model) {
  const p = PRICES[model];
  if (!p) return null;
  return ((usage.uncached ?? 0) * p.in + (usage.cacheRead ?? 0) * p.cacheRead + (usage.cacheWrite ?? 0) * p.cacheWrite + usage.output * p.out) / 1e6;
}

// The fields render.js cannot do without; anything else missing renders as blank.
function check(report) {
  const missing = REPORT_SCHEMA.required.filter((k) => report?.[k] == null);
  if (missing.length) throw new Error(`report is missing ${missing.join(', ')}`);
  if (!Array.isArray(report.summary) || report.summary.length < 8) throw new Error('executive summary is too short');
}

export async function analyze({ company, period, urls = [], log = (m) => console.error(m) }) {
  const client = new Anthropic({ apiKey: process.env.GAMING_DAILY_API_KEY || process.env.ANTHROPIC_API_KEY });
  const messages = [{ role: 'user', content: buildTask({ company, period, extraUrls: urls }) }];
  const usage = { input: 0, output: 0, searches: 0, fetches: 0 };
  let reminded = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'xhigh' },
      // Each research step re-sends everything read so far; caching bills those repeats at a fraction.
      cache_control: { type: 'ephemeral' },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
    stream.on('streamEvent', (ev) => {
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'server_tool_use') {
        log(`  ${ev.content_block.name === 'web_fetch' ? 'reading' : 'searching'}…`);
      }
    });
    const msg = await stream.finalMessage();

    const u = msg.usage;
    usage.input += u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    usage.uncached = (usage.uncached ?? 0) + u.input_tokens;
    usage.cacheRead = (usage.cacheRead ?? 0) + (u.cache_read_input_tokens ?? 0);
    usage.cacheWrite = (usage.cacheWrite ?? 0) + (u.cache_creation_input_tokens ?? 0);
    usage.output += u.output_tokens;
    usage.turns = (usage.turns ?? 0) + 1;
    usage.searches += msg.usage.server_tool_use?.web_search_requests ?? 0;
    usage.fetches += msg.usage.server_tool_use?.web_fetch_requests ?? 0;

    if (msg.stop_reason === 'refusal') {
      throw new Error(`declined by the model (${msg.stop_details?.category ?? 'no category given'})`);
    }
    const submit = msg.content.find((b) => b.type === 'tool_use' && b.name === 'submit_report');
    if (submit) {
      check(submit.input);
      return { report: submit.input, model: msg.model, usage };
    }
    if (msg.stop_reason === 'max_tokens') throw new Error('ran out of output tokens before submitting the report');

    messages.push({ role: 'assistant', content: msg.content });
    if (msg.stop_reason === 'pause_turn') continue; // long server-tool turn: resume where it stopped
    if (reminded) break;
    reminded = true;
    messages.push({ role: 'user', content: 'Your research is done. Submit the finished report now by calling submit_report once.' });
  }
  throw new Error('no report was submitted');
}
