// Serves out/ locally for previewing editions: node src/serve.js → http://localhost:4321
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');

createServer(async (req, res) => {
  try {
    let name = path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!name) name = (await readdir(out)).filter((f) => f.startsWith('gaming-daily-')).sort().pop();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(await readFile(path.join(out, name)));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(4321, () => console.log('Serving latest edition at http://localhost:4321'));
