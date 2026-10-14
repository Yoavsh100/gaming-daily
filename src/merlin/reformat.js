#!/usr/bin/env node
// Re-applies the current layout to published reports without re-running the analysis:
// adds topic blocks if missing, then rebuilds the web page, the PDF and the markdown.
// Usage: node src/merlin/reformat.js <reports dir>/<SLUG> [...]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { restructure } from './restructure.js';
import { writeReport } from './publish.js';
import { renderReportPage } from '../earnings/page.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true });

for (const dir of process.argv.slice(2)) {
  const saved = JSON.parse(await readFile(path.join(dir, 'report.json'), 'utf8'));
  if (!saved.report.segments.some((s) => s.blocks?.length)) await restructure(saved.report);
  const out = await writeReport({ dir: path.dirname(dir), company: saved.company, period: saved.period, report: saved.report, model: saved.model, usage: saved.usage });
  await writeFile(path.join(out.dir, 'index.html'), renderReportPage({ company: saved.company, period: saved.period, report: saved.report, hasPdf: !!out.pdf }));
  console.log(`✔ ${out.slug}: ${saved.report.segments.map((s) => `${s.name} → ${s.blocks?.length ?? 0} blocks`).join('; ')}`);
}
