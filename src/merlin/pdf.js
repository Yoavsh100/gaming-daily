// Renders an HTML file to PDF using a headless Chromium browser already on the
// machine (Edge or Chrome). No downloads, no extra dependencies.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

const pexec = promisify(execFile);

const CANDIDATES = [
  process.env.MERLIN_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

export function findBrowser() {
  return CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

export async function htmlToPdf(htmlPath, outPath) {
  const bin = findBrowser();
  if (!bin) {
    throw new Error(
      'No Chrome/Edge found to render the PDF. Install one, or set MERLIN_BROWSER ' +
      'to the full path of chrome.exe / msedge.exe.'
    );
  }
  const url = pathToFileURL(htmlPath).href;
  await pexec(bin, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${outPath}`, url
  ], { maxBuffer: 1024 * 1024 * 16 });
  if (!fs.existsSync(outPath)) throw new Error('PDF was not produced (browser render failed).');
  return outPath;
}
