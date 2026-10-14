// Generic thumbnails for stories with no photo (mostly Google News fallbacks, which carry
// none). Two drawn variants per section, built from simple shapes in the section's colour
// and rasterised once per run to small inline WebP, like the real photos.
import sharp from 'sharp';

const W = 480, H = 270;

// Mid-tone palettes that sit well on both the light and the dark page.
const PALETTE = {
  general:   { bg: ['#25344d', '#3d5378'], ink: '#9fb6dc', hi: '#e3ebf7' },
  quarterly: { bg: ['#3b2f12', '#6b5420'], ink: '#d9b45a', hi: '#f6e8b9' },
  casino:    { bg: ['#2c1f45', '#4d3578'], ink: '#b59be0', hi: '#ece2f6' },
  sports:    { bg: ['#123546', '#1d5b77'], ink: '#7cc0de', hi: '#d8ebf6' },
  people:    { bg: ['#16352a', '#24603f'], ink: '#86c9a1', hi: '#dbefe1' },
  africa:    { bg: ['#3e2112', '#7a3a16'], ink: '#e09a63', hi: '#f7ddcc' },
};

const range = (n) => Array.from({ length: n }, (_, i) => i);

// Each motif returns SVG elements drawn over the gradient background.
const MOTIFS = {
  general: [
    // newspaper columns
    (c) => range(3).map((col) => {
      const x = 70 + col * 120;
      return `<rect x="${x}" y="60" width="96" height="16" rx="3" fill="${c.hi}" opacity=".85"/>` +
        range(7).map((r) => `<rect x="${x}" y="${92 + r * 18}" width="${r === 6 ? 60 : 96}" height="7" rx="3" fill="${c.ink}" opacity=".55"/>`).join('');
    }).join(''),
    // concentric broadcast rings
    (c) => range(6).map((i) => `<circle cx="240" cy="135" r="${24 + i * 26}" fill="none" stroke="${c.ink}" stroke-width="3" opacity="${0.75 - i * 0.11}"/>`).join('') +
      `<circle cx="240" cy="135" r="12" fill="${c.hi}"/>`,
  ],
  quarterly: [
    // rising bar chart with trend line
    (c) => range(7).map((i) => {
      const h = 40 + i * 22 + (i % 2) * 14;
      return `<rect x="${70 + i * 50}" y="${225 - h}" width="30" height="${h}" rx="3" fill="${c.ink}" opacity="${0.45 + i * 0.07}"/>`;
    }).join('') +
      `<polyline points="${range(7).map((i) => `${85 + i * 50},${170 - i * 20 - (i % 2) * 10}`).join(' ')}" fill="none" stroke="${c.hi}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<line x1="55" y1="226" x2="425" y2="226" stroke="${c.hi}" stroke-width="2" opacity=".6"/>`,
    // line chart over a grid
    (c) => range(5).map((i) => `<line x1="60" y1="${60 + i * 40}" x2="420" y2="${60 + i * 40}" stroke="${c.ink}" stroke-width="1.5" opacity=".35"/>`).join('') +
      `<polyline points="60,200 120,185 180,195 240,150 300,160 360,110 420,80" fill="none" stroke="${c.hi}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<circle cx="420" cy="80" r="9" fill="${c.hi}"/>`,
  ],
  casino: [
    // stack of chips
    (c) => [[170, 150], [250, 120], [320, 165]].map(([x, y], k) =>
      `<circle cx="${x}" cy="${y}" r="58" fill="${k === 1 ? c.hi : c.ink}" opacity="${k === 1 ? 0.9 : 0.7}"/>` +
      `<circle cx="${x}" cy="${y}" r="46" fill="none" stroke="${c.bg[0]}" stroke-width="10" stroke-dasharray="14 10" opacity=".8"/>` +
      `<circle cx="${x}" cy="${y}" r="26" fill="none" stroke="${c.bg[0]}" stroke-width="3" opacity=".6"/>`).join(''),
    // roulette wheel
    (c) => `<circle cx="240" cy="135" r="88" fill="none" stroke="${c.ink}" stroke-width="28" stroke-dasharray="17.3 17.3" opacity=".8"/>` +
      `<circle cx="240" cy="135" r="72" fill="none" stroke="${c.hi}" stroke-width="2" opacity=".7"/>` +
      `<circle cx="240" cy="135" r="50" fill="${c.ink}" opacity=".35"/>` +
      range(8).map((i) => { const a = (i * Math.PI) / 4; return `<line x1="240" y1="135" x2="${240 + 50 * Math.cos(a)}" y2="${135 + 50 * Math.sin(a)}" stroke="${c.hi}" stroke-width="3" opacity=".7"/>`; }).join('') +
      `<circle cx="240" cy="135" r="12" fill="${c.hi}"/><circle cx="300" cy="82" r="8" fill="${c.hi}"/>`,
  ],
  sports: [
    // pitch markings
    (c) => `<rect x="50" y="40" width="380" height="190" rx="4" fill="none" stroke="${c.hi}" stroke-width="4" opacity=".8"/>` +
      `<line x1="240" y1="40" x2="240" y2="230" stroke="${c.hi}" stroke-width="4" opacity=".8"/>` +
      `<circle cx="240" cy="135" r="38" fill="none" stroke="${c.hi}" stroke-width="4" opacity=".8"/>` +
      `<rect x="50" y="90" width="56" height="90" fill="none" stroke="${c.hi}" stroke-width="4" opacity=".8"/>` +
      `<rect x="374" y="90" width="56" height="90" fill="none" stroke="${c.hi}" stroke-width="4" opacity=".8"/>` +
      `<circle cx="240" cy="135" r="6" fill="${c.hi}"/>`,
    // scoreboard / odds grid
    (c) => range(3).map((r) => range(3).map((col) =>
      `<rect x="${95 + col * 100}" y="${55 + r * 58}" width="88" height="44" rx="6" fill="${(r + col) % 2 ? c.ink : c.hi}" opacity="${(r + col) % 2 ? 0.55 : 0.85}"/>`).join('')).join(''),
  ],
  people: [
    // three figures
    (c) => [[150, 0.65], [240, 0.95], [330, 0.65]].map(([x, o], k) => {
      const s = k === 1 ? 1.15 : 1;
      return `<circle cx="${x}" cy="${118 - (s - 1) * 60}" r="${30 * s}" fill="${k === 1 ? c.hi : c.ink}" opacity="${o}"/>` +
        `<path d="M${x - 55 * s} 240 a${55 * s} ${60 * s} 0 0 1 ${110 * s} 0 z" fill="${k === 1 ? c.hi : c.ink}" opacity="${o}"/>`;
    }).join(''),
    // org chart
    (c) => `<rect x="200" y="45" width="80" height="44" rx="8" fill="${c.hi}" opacity=".9"/>` +
      `<path d="M240 89 v28 M120 117 h240 M120 117 v26 M240 117 v26 M360 117 v26" stroke="${c.hi}" stroke-width="3" fill="none" opacity=".7"/>` +
      [80, 200, 320].map((x) => `<rect x="${x}" y="143" width="80" height="44" rx="8" fill="${c.ink}" opacity=".7"/>`).join(''),
  ],
  africa: [
    // sun over horizon bands
    (c) => `<circle cx="240" cy="175" r="78" fill="${c.hi}" opacity=".9"/>` +
      range(5).map((i) => `<rect x="0" y="${175 + i * 20}" width="480" height="11" fill="${c.ink}" opacity="${0.9 - i * 0.12}"/>`).join(''),
    // woven pattern
    (c) => range(5).map((r) => range(8).map((col) => {
      const x = 30 + col * 56, y = 30 + r * 44;
      return (r + col) % 2
        ? `<path d="M${x} ${y + 34} L${x + 22} ${y} L${x + 44} ${y + 34} z" fill="${c.ink}" opacity=".7"/>`
        : `<rect x="${x + 6}" y="${y + 6}" width="32" height="22" rx="3" fill="${c.hi}" opacity=".55"/>`;
    }).join('')).join(''),
  ],
};

const cache = new Map();

async function draw(section, variant) {
  const c = PALETTE[section] ?? PALETTE.general;
  const motifs = MOTIFS[section] ?? MOTIFS.general;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>${motifs[variant % motifs.length](c)}</svg>`;
  const webp = await sharp(Buffer.from(svg)).webp({ quality: 70 }).toBuffer();
  return `data:image/webp;base64,${webp.toString('base64')}`;
}

// Same story always gets the same variant; neighbouring stories usually differ.
const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// Returns a CSS class for the card plus the image behind it; the page embeds each image
// once as a style rule, so repeats cost nothing.
export async function placeholder(section, key) {
  const s = PALETTE[section] ? section : 'general';
  const variant = hash(key) % 2;
  const id = `ph-${s}-${variant}`;
  if (!cache.has(id)) cache.set(id, await draw(s, variant));
  return { id, uri: cache.get(id) };
}
