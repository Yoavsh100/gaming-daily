// Pulls recent articles from every source into one normalised list:
// { source, sourceName, africaSource, title, url, date (Date), excerpt, image }
import { execFile } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { SOURCES } from './sources.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text' });

// Requests go through curl, not Node's fetch: Cloudflare (SBC, Focus, Gambling Insider)
// rejects Node's TLS fingerprint with a 403 but serves curl normally.
const CURL = process.platform === 'win32' ? 'C:\\Windows\\System32\\curl.exe' : 'curl';

export function get(url, { as = 'text', timeout = 25000 } = {}) {
  const args = ['-s', '-L', '--compressed', '-A', UA, '--max-time', String(timeout / 1000), '-w', '\n%{http_code}', url];
  return new Promise((resolve, reject) => {
    execFile(CURL, args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error(`${err.code ?? 'curl failed'} ${url}`));
      const cut = stdout.lastIndexOf(10); // status code follows the final newline
      const status = +stdout.subarray(cut + 1).toString();
      const body = stdout.subarray(0, cut);
      if (status < 200 || status >= 300) return reject(new Error(`${status} ${url}`));
      resolve(as === 'buffer' ? body : as === 'json' ? JSON.parse(body.toString('utf8')) : body.toString('utf8'));
    });
  });
}

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (x == null ? '' : typeof x === 'object' ? (x['#text'] ?? '') : String(x));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', '#039': "'" };
export function clean(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9#]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s*(The post .* appeared first on .*|Continue reading.*)$/i, '')
    .trim();
}

// First real photo in a block of HTML, skipping WordPress emoji, avatars and tracking pixels.
const firstImg = (html = '') => [...String(html).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
  .map((m) => m[1])
  .find((src) => !/\/emoji\/|gravatar|pixel|\.svg(\?|$)|feedburner/i.test(src));

async function fromRss(src) {
  const doc = xml.parse(await get(src.url));
  return arr(doc?.rss?.channel?.item).map((it) => {
    const content = text(it['content:encoded']) || text(it.description);
    const media = arr(it['media:content'])[0] || arr(it['media:thumbnail'])[0];
    const encl = arr(it.enclosure).find((e) => /image/.test(e?.['@type'] || 'image'));
    return {
      title: clean(text(it.title)),
      url: text(it.link).trim(),
      date: new Date(text(it.pubDate) || text(it['dc:date'])),
      excerpt: clean(text(it.description) || content).slice(0, 600),
      image: media?.['@url'] || encl?.['@url'] || firstImg(content) || firstImg(text(it.description)),
    };
  });
}

async function fromSitemap(src) {
  const doc = xml.parse(await get(src.url));
  return arr(doc?.urlset?.url).map((u) => ({
    title: clean(text(u['news:news']?.['news:title'])),
    url: text(u.loc).trim(),
    date: new Date(text(u['news:news']?.['news:publication_date'])),
    excerpt: '',
    image: arr(u['image:image'])[0]?.['image:loc'],
  }));
}

async function fromWpJson(src) {
  const fields = 'date_gmt,link,title,excerpt,yoast_head_json.og_image,yoast_head_json.og_description';
  const posts = await get(`${src.url}?per_page=50&_fields=${fields}`, { as: 'json' });
  return posts.map((p) => ({
    title: clean(p.title?.rendered),
    url: p.link,
    date: new Date(p.date_gmt + 'Z'),
    excerpt: clean(p.excerpt?.rendered || p.yoast_head_json?.og_description).slice(0, 600),
    image: p.yoast_head_json?.og_image?.[0]?.url,
  }));
}

// For items with no image or excerpt in the feed, read the article's Open Graph tags.
async function enrichFromPage(item) {
  try {
    const html = await get(item.url, { timeout: 20000 });
    const meta = (prop) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')) || [])[1];
    item.image ||= meta('og:image');
    item.excerpt ||= clean(meta('og:description') || meta('description') || '');
  } catch { /* keep what we have */ }
}

export async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => { while (queue.length) await fn(queue.shift()); }));
}

const ADAPTERS = { rss: fromRss, sitemap: fromSitemap, wpjson: fromWpJson };

export async function collect({ hours }) {
  const since = Date.now() - hours * 3600e3;
  const status = [];
  const batches = await Promise.all(SOURCES.map(async (src) => {
    try {
      const items = (await ADAPTERS[src.type](src))
        .filter((i) => i.title && i.url && i.date.getTime() >= since)
        .map((i) => ({ ...i, source: src.id, sourceName: src.name, africaSource: !!src.africa }));
      status.push({ source: src.name, ok: true, count: items.length });
      return items;
    } catch (err) {
      status.push({ source: src.name, ok: false, count: 0, error: err.message });
      return [];
    }
  }));

  // Drop exact URL duplicates (e.g. Focus Africa stories that also appear in the main Focus feed).
  const seen = new Set();
  const items = batches.flat().filter((i) => {
    const key = i.url.replace(/[?#].*$/, '').replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await pool(items.filter((i) => !i.image || !i.excerpt), 6, enrichFromPage);
  return { items: items.sort((a, b) => b.date - a.date), status };
}
