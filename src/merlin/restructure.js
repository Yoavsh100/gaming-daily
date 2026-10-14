// A formatting pass after the analysis: breaks each segment's long prose into short
// blocks (heading, one-line takeaway, a few bullets, an optional quote) that are easier
// to scan. It reorganises Merlin's text only; facts and figures must come through unchanged.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { MODEL } from './analyze.js';

const Blocks = z.object({
  segments: z.array(z.object({
    name: z.string().describe('The segment name exactly as given.'),
    blocks: z.array(z.object({
      heading: z.string().describe('2-4 words naming the topic, e.g. "Europe", "Asia", "Marketing spend", "Guidance".'),
      takeaway: z.string().describe('One sentence, at most 25 words, stating the main point with its key number.'),
      points: z.array(z.string()).describe('2-5 bullets, each at most 25 words, carrying the supporting figures and detail.'),
      quote: z.object({
        text: z.string().describe('A short management remark copied verbatim from the text.'),
        speaker: z.string().describe('Who said it, e.g. "CEO", or "Management" if not stated.'),
      }).nullable(),
    })),
  })),
});

const SYSTEM = `You reformat sections of an equity analyst report so executives can scan them.
For each segment you receive its narrative paragraphs. Reorganise that narrative into 3-7 blocks, one per topic (a region, a product, costs, a risk, guidance and so on), in the order the narrative covers them.

Rules:
- Use only what the narrative says. Do not add facts, opinions or numbers, and do not drop any material figure or judgement.
- Copy every number, percentage, currency and period exactly as written.
- Keep the analyst's judgements (e.g. "this remains the single largest risk"); put them in the takeaway or a bullet.
- Quotes must be verbatim from the text; use at most one per block, and only when the narrative quotes someone.
- Plain, direct sentences. No markdown, no bold markers.`;

export async function restructure(report) {
  const client = new Anthropic({ apiKey: process.env.GAMING_DAILY_API_KEY || process.env.ANTHROPIC_API_KEY });
  const input = report.segments.map((s) => `## ${s.name}\n${s.headline ? `Headline: ${s.headline}\n` : ''}\n${s.narrative.join('\n\n')}`).join('\n\n');
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(Blocks) },
    system: SYSTEM,
    messages: [{ role: 'user', content: input }],
  });
  if (res.stop_reason !== 'end_turn' || !res.parsed_output) throw new Error(`restructure stopped: ${res.stop_reason}`);
  // Attach blocks by position; the prose stays in the report as the source of record.
  res.parsed_output.segments.forEach((s, i) => {
    if (report.segments[i] && s.blocks.length) report.segments[i].blocks = s.blocks;
  });
  return report;
}
