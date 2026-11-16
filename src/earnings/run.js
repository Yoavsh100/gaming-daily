#!/usr/bin/env node
// The analysis job: runs Merlin on results spotted in the news that have no report yet,
// and publishes each report into <site>/reports/<slug>/.
// Usage: node src/earnings/run.js --site <gh-pages dir> [--max 3] [--company X --period "Q3 2026"]
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { analyze, estimateCost } from '../merlin/analyze.js';
import { writeReport } from '../merlin/publish.js';
import { restructure } from '../merlin/restructure.js';
import { renderReportPage } from './page.js';
import { writeFile } from 'node:fs/promises';
import { loadIndex, saveIndex, loadCandidates, matchWatchlist, candidateKey, priorityTier, TIER_LABEL } from './queue.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true });

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const site = path.resolve(arg('site', path.join(root, 'out', 'site')));
const max = Number(arg('max', 6));
const MAX_ATTEMPTS = 2;

const index = await loadIndex(site);
const entry = (key) => index.find((e) => e.key === key);

// A manual request goes first; then news candidates by PRIORITY, newest first within a tier.
// A manual request is a company (--company) or a market/jurisdiction (--market), both with --period.
// Priority tiers (queue.js priorityTier): 1 gaming·Africa, 2 gaming·global, 3 payments·Africa,
// 4 payments·global, 5 the rest. This stops fresh high-value results (e.g. an African operator)
// being starved behind a long tail of older, lower-priority candidates.
const queue = [];
if (arg('company') && arg('period')) queue.push({ type: 'company', company: arg('company'), ticker: null, period: arg('period'), urls: [], manual: true });
if (arg('market') && arg('period')) queue.push({ type: 'jurisdiction', market: arg('market'), authority: null, period: arg('period'), urls: [], manual: true });
for (const c of await loadCandidates(site)) queue.push(c);

const label = (c) => (c.type === 'jurisdiction' ? `${c.market} ${c.period} [market]` : `${c.company} ${c.period}`) + ` {${TIER_LABEL[priorityTier(c)]}}`;
const pending = queue
  .map((c) => ({ ...c, key: candidateKey(c) }))
  .filter((c, i, all) => all.findIndex((x) => x.key === c.key) === i)
  .filter((c) => c.manual || (entry(c.key)?.status !== 'done' && (entry(c.key)?.attempts ?? 0) < MAX_ATTEMPTS))
  .sort((a, b) =>
    (b.manual ? 1 : 0) - (a.manual ? 1 : 0)            // manual request first
    || priorityTier(a) - priorityTier(b)               // then by priority tier (1 = highest)
    || (b.seen || '').localeCompare(a.seen || ''))     // then newest first within the tier
  .slice(0, max);

console.log(pending.length ? `Analysing ${pending.length}: ${pending.map(label).join('; ')}` : 'Nothing new to analyse.');

let failures = 0;
for (const c of pending) {
  const isReg = c.type === 'jurisdiction';
  const docType = isReg ? 'regulator' : 'company';
  // A market has no watchlist entry, ticker or exchange; its name is the market name.
  const company = isReg ? { name: c.market, ticker: '', exchange: '' } : (matchWatchlist(c) || { name: c.company, ticker: c.ticker || '' });
  const t0 = Date.now();
  const prev = entry(c.key);
  const record = prev || { key: c.key, attempts: 0 };
  if (!prev) index.push(record);
  record.attempts += 1;
  record.lastAttempt = new Date().toISOString();
  try {
    console.log(`\n🧙 ${company.name} ${c.period}${isReg ? ' [market]' : ''}`);
    const { report, model, usage } = await analyze({ company, period: c.period, urls: c.urls, docType, log: () => {} });
    await restructure(report).catch((err) => console.log(`  (kept the prose layout: ${err.message})`));
    const out = await writeReport({ dir: path.join(site, 'reports'), company, period: c.period, report, model, usage });
    await writeFile(path.join(out.dir, 'index.html'), renderReportPage({ company, period: c.period, report, hasPdf: !!out.pdf, docType }));
    Object.assign(record, {
      status: 'done', error: null, type: c.type || 'company', slug: out.slug, published: new Date().toISOString().slice(0, 10),
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
    Object.assign(record, { status: 'failed', error: err.message, type: c.type || 'company', company: { name: company.name, ticker: company.ticker || '' }, period: c.period });
    console.log(`✗ ${company.name} ${c.period}: ${err.message}`);
  }
  await saveIndex(site, index); // after every report, so a crash later keeps earlier work
}
if (failures && failures === pending.length) process.exitCode = 1;
