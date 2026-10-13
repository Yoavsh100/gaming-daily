#!/usr/bin/env node
// Builds today's edition: collect → classify with Claude → embed images → render.
// Usage: node src/digest.js [--hours 24]   (Mondays default to 72h to cover the weekend)
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { collect } from './collect.js';
import { classify } from './classify.js';
import { embedImages } from './images.js';
import { render, wrapDocument } from './render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
dotenv.config({ path: path.join(root, '..', '.env'), quiet: true }); // shared key with Viper

const now = new Date();
const flag = process.argv.indexOf('--hours');
const hours = flag > -1 ? Number(process.argv[flag + 1]) : now.getUTCDay() === 1 ? 72 : 24;

const t0 = Date.now();
const { items, status } = await collect({ hours });
for (const s of status) console.log(`${s.ok ? '✓' : '✗'} ${s.source}: ${s.ok ? `${s.count}${s.via === 'direct' ? '' : ` via ${s.via}`}` : s.error}`);
if (!items.length) throw new Error('No articles collected; not publishing an empty edition.');

const [edition] = await Promise.all([classify(items), embedImages(items)]);
console.log(`${items.length} articles → ${edition.stories.length} stories (${edition.engine})`);

const page = render({ edition, items, status, now, hours });
const outDir = path.join(root, 'out');
await mkdir(outDir, { recursive: true });
const day = now.toISOString().slice(0, 10);
const emailFile = path.join(outDir, `gaming-daily-${day}.html`);
await writeFile(emailFile, wrapDocument(page));
await writeFile(path.join(outDir, 'publish.html'), page); // stable path for the shareable page
console.log(`Wrote ${emailFile} (${(Buffer.byteLength(page) / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
