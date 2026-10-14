#!/usr/bin/env node
// Run Merlin by hand on one company's results.
// Usage: node src/merlin/cli.js --company "Flutter" --period "Q2 2026" [--url <release>]...
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolveCompany } from './watchlist.js';
import { analyze, estimateCost, MODEL } from './analyze.js';
import { writeReport } from './publish.js';
import { restructure } from './restructure.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true });

const args = { urls: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--company' || a === '-c') args.company = process.argv[++i];
  else if (a === '--period' || a === '-p') args.period = process.argv[++i];
  else if (a === '--url' || a === '-u') args.urls.push(process.argv[++i]);
}
if (!args.company || !args.period) {
  console.error('Usage: node src/merlin/cli.js --company <name|ticker> --period "Q2 2026" [--url <release>]');
  process.exit(1);
}

// Watchlist companies bring their IR/SEC hints; anyone else is researched from the name alone.
const company = resolveCompany(args.company) || { name: args.company };
const t0 = Date.now();
console.error(`🧙 Merlin: ${company.name} ${args.period} (${MODEL})`);
const { report, model, usage } = await analyze({ company, period: args.period, urls: args.urls });
await restructure(report).catch((err) => console.error(`  (kept the prose layout: ${err.message})`));
const { dir, pdf } = await writeReport({ dir: path.join(root, 'out', 'reports'), company, period: args.period, report, model, usage });
console.error(`✔ ${dir}${pdf ? '' : ' (no PDF: Chrome/Edge not found)'}`);
const cost = estimateCost(usage, model);
console.error(`  model=${model} turns=${usage.turns} input: uncached=${usage.uncached} cache-read=${usage.cacheRead} cache-write=${usage.cacheWrite} ` +
  `output=${usage.output} searches=${usage.searches} fetches=${usage.fetches}`);
console.error(`  confidence=${report.confidence} in ${Math.round((Date.now() - t0) / 1000)}s${cost != null ? ` · est. $${cost.toFixed(2)} + searches` : ''}`);
