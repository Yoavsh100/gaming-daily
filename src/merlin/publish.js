// Writes one finished Merlin report to <dir>/<slug>/: report.json (the data),
// report.md (the full write-up) and brief.pdf (the B2Tech CEO brief).
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { renderMarkdown, renderHtml } from './render.js';
import { htmlToPdf, findBrowser } from './pdf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const reportSlug = (company, period) =>
  `${company.ticker || company.name}-${period}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase();

async function logo(name) {
  const file = path.join(root, 'assets', `${name}.png`);
  return existsSync(file) ? `data:image/png;base64,${(await readFile(file)).toString('base64')}` : null;
}

export async function writeReport({ dir, company, period, report, model, usage }) {
  const slug = reportSlug(company, period);
  const out = path.join(dir, slug);
  await mkdir(out, { recursive: true });
  const meta = { company: { name: company.name, ticker: company.ticker || '', exchange: company.exchange || '' }, period };
  const prepared = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  await writeFile(path.join(out, 'report.json'), JSON.stringify({ ...meta, model, usage, prepared, report }, null, 2));
  await writeFile(path.join(out, 'report.md'), renderMarkdown(meta, report));

  let pdf = null;
  if (findBrowser()) {
    const tmp = path.join(os.tmpdir(), `merlin-${slug}-${Date.now()}.html`);
    await writeFile(tmp, renderHtml(meta, report, { prepared, logos: { b2tech: await logo('b2tech'), merlin: await logo('merlin') } }));
    pdf = await htmlToPdf(tmp, path.join(out, 'brief.pdf'));
    await rm(tmp, { force: true });
  }
  return { slug, dir: out, pdf };
}
