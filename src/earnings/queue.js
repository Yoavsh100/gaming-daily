// Shared state for results reports, kept on the published site (gh-pages) so the
// daily edition and the analysis job both see it:
//   reports/candidates.json  results spotted in the news, waiting for Merlin
//   reports/index.json       every report Merlin has attempted (done or failed)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { WATCHLIST } from '../merlin/watchlist.js';

const KEEP_DAYS = 14; // candidates older than this are dropped unanalysed

const COMPANY_NOISE = /\b(plc|inc|ltd|limited|group|holdings?|corporation|corp|co|ab|sa|se|nv|ag|spa|s\.p\.a|the)\b|[^a-z0-9 ]/g;
const normName = (s = '') => s.toLowerCase().replace(/&/g, ' and ').replace(COMPANY_NOISE, ' ').replace(/\s+/g, ' ').trim();
// "FY26", "FY2026", "FY 2025-26" and "FY 2025/26" are one period, named by the year it ends.
const normPeriod = (s = '') => s.toUpperCase().replace(/\s+/g, ' ').trim()
  .replace(/^FY ?(?:\d{2,4} ?[-/] ?)?(\d{4}|\d{2})$/, (_, y) => `FY ${y.length === 2 ? `20${y}` : y}`)
  .replace(/^(Q[1-4]|H[12]) ?(\d{4})$/, '$1 $2');

// A watchlist entry only when the match is unambiguous (exact ticker, alias or name),
// so "evoke" never resolves to Evolution through a substring.
export function matchWatchlist({ company, ticker }) {
  const t = (ticker || '').toUpperCase();
  const n = normName(company);
  return WATCHLIST.find((c) => t && c.ticker.toUpperCase() === t)
    || WATCHLIST.find((c) => normName(c.name) === n || c.aliases.includes(n))
    || null;
}

// One key per company and period, however the news names them.
export function reportKey({ company, ticker, period }) {
  const known = matchWatchlist({ company, ticker });
  return `${known ? known.ticker : normName(company)}|${normPeriod(period)}`;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

export const loadIndex = (site) => readJson(path.join(site, 'reports', 'index.json'), []);
export const saveIndex = (site, index) => writeJson(path.join(site, 'reports', 'index.json'), index);
export const loadCandidates = (site) => readJson(path.join(site, 'reports', 'candidates.json'), []);

// Merge today's results stories into the rolling candidate list.
export async function addCandidates(site, found, day) {
  const list = await loadCandidates(site);
  const byKey = new Map(list.map((c) => [c.key, c]));
  for (const f of found) {
    const key = reportKey(f);
    const prev = byKey.get(key);
    if (prev) prev.urls = [...new Set([...prev.urls, ...f.urls])].slice(0, 6);
    else byKey.set(key, { key, company: f.company, ticker: f.ticker || null, period: normPeriod(f.period), urls: f.urls.slice(0, 6), seen: day });
  }
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const kept = [...byKey.values()].filter((c) => c.seen >= cutoff);
  await writeJson(path.join(site, 'reports', 'candidates.json'), kept);
  return kept;
}

// Results stories in an edition, as candidates (article links help Merlin find the release).
export function resultsInEdition(edition, items) {
  return edition.stories
    .filter((s) => s.results?.company && s.results?.period)
    .map((s) => ({ ...s.results, urls: s.ids.map((id) => items[id].url).filter((u) => !/news\.google\.com/.test(u)) }));
}
