// Translates the headline (and excerpt) of flagged non-English items into English, in one
// batched Claude call, before classification. Items keep their original title in `titleOrig`.
// Non-fatal: if translation fails, the original text is kept and the edition still builds.
import Anthropic from '@anthropic-ai/sdk';

export async function translate(items) {
  const todo = items.filter((i) => i.translate && i.title);
  if (!todo.length) return;
  try {
    const client = new Anthropic({ apiKey: process.env.GAMING_DAILY_API_KEY || process.env.ANTHROPIC_API_KEY });
    const list = todo.map((it, i) => `[${i}] ${it.title}${it.excerpt ? ` || ${it.excerpt.slice(0, 220)}` : ''}`).join('\n');
    const res = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      system: 'You translate gambling and business news items into concise, natural English. For each numbered line, return exactly one line "[i] <english headline> || <english excerpt>" (drop the "|| excerpt" part if there was none). Preserve company names, places, tickers and numbers. Output only these lines, nothing else.',
      messages: [{ role: 'user', content: list }],
    });
    const out = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    for (const m of out.matchAll(/^\s*\[(\d+)\]\s*(.+?)(?:\s*\|\|\s*(.*))?$/gm)) {
      const it = todo[Number(m[1])];
      if (!it || !m[2]?.trim()) continue;
      it.titleOrig = it.title;
      it.title = m[2].trim();
      if (m[3]?.trim()) it.excerpt = m[3].trim();
    }
  } catch (err) {
    console.warn(`Translation failed (${err.message}); keeping original text.`);
  }
}
