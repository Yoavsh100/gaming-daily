#!/usr/bin/env node
// The analysis job: runs Merlin on results spotted in the news that have no report yet,
// and publishes each report into <site>/reports/<slug>/.
// Usage: node src/earnings/run.js --site <gh-pages dir> [--max 3] [--company X --period "Q3 2026"]
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { analyze, estimateCost } from '../merlin/analyze.js';
import { writeReport } from '../merlin/publish.js';
import { renderReportPage } from './page.js';
import { writeFile } from 'node:fs/promises';
import { loadIndex, saveIndex, loadCandidates, matchWatchlist, reportKey } from './queue.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true });

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const site = path.resolve(arg('site', path.join(root, 'out', 'site')));
const max = Number(arg('max', 3));
const MAX_ATTEMPTS = 2;

const index = await loadIndex(site);
const entry = (key) => index.find((e) => e.key === key);

// A manual request goes first; then the oldest unanalysed news candidates.
const queue = [];
if (arg('company') && arg('period')) queue.push({ company: arg('company'), ticker: null, period: arg('period'), urls: [], manual: true });
for (const c of await loadCandidates(site)) queue.push(c);

const pending = queue
  .map((c) => ({ ...c, key: reportKey(c) }))
  .filter((c, i, all) => all.findIndex((x) => x.key === c.key) === i)
  .filter((c) => c.manual || (entry(c.key)?.status !== 'done' && (entry(c.key)?.attempts ?? 0) < MAX_ATTEMPTS))
  .sort((a, b) => (b.manual ? 1 : 0) - (a.manual ? 1 : 0) || (a.seen || '').localeCompare(b.seen || ''))
  .slice(0, max);

console.log(pending.length ? `Analysing ${pending.length}: ${pending.map((c) => `${c.company} ${c.period}`).join('; ')}` : 'Nothing new to analyse.');

let failures = 0;
for (const c of pending) {
  const known = matchWatchlist(c);
  const company = known || { name: c.company, ticker: c.ticker || '' };
  const t0 = Date.now();
  const prev = entry(c.key);
  const record = prev || { key: c.key, attempts: 0 };
  if (!prev) index.push(record);
  record.attempts += 1;
  record.lastAttempt = new Date().toISOString();
  try {
    console.log(`\n🧙 ${company.name} ${c.period}`);
    const { report, model, usage } = await analyze({ company, period: c.period, urls: c.urls, log: () => {} });
    const out = await writeReport({ dir: path.join(site, 'reports'), company, period: c.period, report, model, usage });
    await writeFile(path.join(out.dir, 'index.html'), renderReportPage({ company, period: c.period, report, hasPdf: !!out.pdf }));
    Object.assign(record, {
      status: 'done', error: null, slug: out.slug, published: new Date().toISOString().slice(0, 10),
      company: { name: company.name, ticker: company.ticker || '', exchange: company.exchange || '' },
      period: c.period, verdict: report.verdict, kpis: report.kpis, confidence: report.confidence,
      releaseDate: report.releaseDate, model,
    });
    const cost = estimateCost(usage, model);
    record.costUsd = cost != null ? Math.round(cost * 100) / 100 : null;
    console.log(`✔ ${out.slug} (${report.confidence}) in ${Math.round((Date.now() - t0) / 1000)}s · searches ${usage.searches}, reads ${usage.fetches}` +
      (cost != null ? ` · est. $${cost.toFixed(2)}` : ''));
  } catch (err) {
    failures++;
    Object.assign(record, { status: 'failed', error: err.message, company: { name: company.name, ticker: company.ticker || '' }, period: c.period });
    console.log(`✗ ${company.name} ${c.period}: ${err.message}`);
  }
  await saveIndex(site, index); // after every report, so a crash later keeps earlier work
}
if (failures && failures === pending.length) process.exitCode = 1;
