// Pulls recent articles from every source into one normalised list:
// { source, sourceName, africaSource, title, url, date (Date), excerpt, image }
import { execFile } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import { SOURCES, EGR } from './sources.js';

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

// Google News search for one outlet. Links are Google redirects to the article, and there is
// no image or excerpt (the article page itself is what Cloudflare blocks).
async function fromGoogleNews(src) {
  const q = encodeURIComponent(`${src.gnews} when:3d`);
  const doc = xml.parse(await get(`https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`));
  return arr(doc?.rss?.channel?.item).map((it) => ({
    title: clean(text(it.title)).replace(/\s+-\s+[^-]+$/, ''), // drop the " - Outlet Name" suffix
    url: text(it.link).trim(),
    date: new Date(text(it.pubDate)),
    excerpt: '',
    image: undefined,
    viaGoogle: true,
  }));
}

const ADAPTERS = { rss: fromRss, sitemap: fromSitemap, wpjson: fromWpJson };

async function fetchSource(src) {
  try {
    // FORCE_GNEWS=1 simulates the cloud's Cloudflare blocks when testing locally.
    if (process.env.FORCE_GNEWS && src.gnews) throw new Error('forced');
    return { items: await ADAPTERS[src.type](src), via: 'direct' };
  } catch (err) {
    if (!src.gnews) throw err;
    return { items: await fromGoogleNews(src), via: `Google News (direct: ${err.message.split(' ')[0]})` };
  }
}

// EGR Intel: headlines only (title + link + date). Articles are subscriber-only, so we take
// nothing but the headline and link back. Kept entirely out of collect()/classification —
// never grouped or de-duplicated. Returns items in the edition window; if that window is thin
// (EGR is low-volume), falls back to the feed's latest so the section is rarely empty.
export async function collectEgr({ hours }) {
  const since = Date.now() - hours * 3600e3;
  const parseFeed = (body) => arr(xml.parse(body)?.rss?.channel?.item)
    .map((it) => ({ title: clean(text(it.title)).replace(/\s+-\s+EGR[^-]*$/i, ''), url: text(it.link).trim(), date: new Date(text(it.pubDate) || text(it['dc:date'])) }))
    .filter((i) => i.title && i.url && !Number.isNaN(i.date.getTime()));
  let all;
  try {
    all = parseFeed(await get(EGR.url));
  } catch (err) {
    // Cloud/data-centre IPs can be Cloudflare-blocked on egr.global; fall back to Google News
    // headlines for the Intel section (still headlines + link only).
    const q = encodeURIComponent('site:egr.global/intel when:4d');
    all = parseFeed(await get(`https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`));
  }
  all.sort((a, b) => b.date - a.date);
  const windowed = all.filter((i) => i.date.getTime() >= since);
  return windowed.length >= 5 ? windowed : all.slice(0, 8);
}

export async function collect({ hours }) {
  const since = Date.now() - hours * 3600e3;
  const status = [];
  const batches = await Promise.all(SOURCES.map(async (src) => {
    try {
      const { items: raw, via } = await fetchSource(src);
      const items = raw
        .filter((i) => i.title && i.url && i.date.getTime() >= since)
        .map((i) => ({ ...i, source: src.id, sourceName: src.name, africaSource: !!src.africa }));
      status.push({ source: src.name, ok: true, count: items.length, via });
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

  await pool(items.filter((i) => (!i.image || !i.excerpt) && !i.viaGoogle), 6, enrichFromPage);
  return { items: items.sort((a, b) => b.date - a.date), status };
}
