#!/usr/bin/env node
// Builds today's edition: collect → classify with Claude → embed images → render.
// Usage: node src/digest.js [--hours 24]   (Mondays default to 72h to cover the weekend)
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { collect, collectEgr } from './collect.js';
import { translate } from './translate.js';
import { classify } from './classify.js';
import { embedImages } from './images.js';
import { placeholder } from './placeholders.js';
import { render, wrapDocument } from './render.js';
import { resultsInEdition, addCandidates, loadIndex } from './earnings/queue.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true }); // shared key with Viper

const now = new Date();
const flag = process.argv.indexOf('--hours');
const hours = flag > -1 ? Number(process.argv[flag + 1]) : now.getUTCDay() === 1 ? 72 : 24;

const t0 = Date.now();
const [{ items, status }, egr] = await Promise.all([
  collect({ hours }),
  collectEgr({ hours }).catch((e) => { console.warn(`EGR Intel fetch failed (${e.message})`); return []; }),
]);
status.push({ source: 'EGR Intel', ok: egr.length > 0, count: egr.length, error: egr.length ? null : 'no headlines' });
for (const s of status) console.log(`${s.ok ? '✓' : '✗'} ${s.source}: ${s.ok ? `${s.count}${s.via === 'direct' || !s.via ? '' : ` via ${s.via}`}` : s.error}`);
if (!items.length) throw new Error('No articles collected; not publishing an empty edition.');

await translate(items); // FR→EN (and any other flagged) headlines before classification
const [edition] = await Promise.all([classify(items), embedImages(items)]);
console.log(`${items.length} articles → ${edition.stories.length} stories (${edition.engine})`);

// Every card gets a picture: the lead article's photo, another outlet's photo of the same
// story, or a drawn illustration for its section.
const placeholders = new Map();
for (const s of edition.stories) {
  const photo = s.ids.map((id) => items[id]).find((a) => a.imageData);
  if (photo) { s.image = photo.imageData; continue; }
  const p = await placeholder(s.section, items[s.ids[0]].url);
  s.placeholder = p.id;
  placeholders.set(p.id, p.uri);
}

// On GitHub the published site (gh-pages) is checked out at ICEMAN_SITE: results stories
// join Merlin's queue there, and the reports it has finished appear in this edition.
let reports = [];
const site = process.env.ICEMAN_SITE;
if (site) {
  const found = resultsInEdition(edition, items);
  await addCandidates(site, found, now.toISOString().slice(0, 10));
  if (found.length) console.log(`Results spotted: ${found.map((f) => `${f.company} ${f.period}`).join('; ')}`);
  const weekAgo = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
  reports = (await loadIndex(site)).filter((r) => r.status === 'done' && r.published >= weekAgo)
    .sort((a, b) => b.published.localeCompare(a.published));
}

const page = render({ edition, items, status, now, hours, reports, placeholders, egr });
const outDir = path.join(root, 'out');
await mkdir(outDir, { recursive: true });
const day = now.toISOString().slice(0, 10);
const emailFile = path.join(outDir, `gaming-daily-${day}.html`);
await writeFile(emailFile, wrapDocument(page));
await writeFile(path.join(outDir, 'publish.html'), page); // stable path for the shareable page
console.log(`Wrote ${emailFile} (${(Buffer.byteLength(page) / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
