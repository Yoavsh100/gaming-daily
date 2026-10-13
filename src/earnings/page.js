// The web version of a Merlin report, in Iceman's look: same sections as the CEO-brief
// PDF, laid out for reading on screen (and on a phone), with the PDF one click away.

const esc = (s = '') => String(s).replace(/&amp;/g, '&').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s = '') => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
const signed = (v = '') => (/^\s*[-−]/.test(v) && v.trim() !== '-' ? 'neg' : /^\s*\+/.test(v) ? 'pos' : '');

function table(t) {
  const n = 1 + t.columns.length;
  const rows = t.rows.map((r) => {
    if (r.kind === 'group') return `<tr class="grp"><td colspan="${n}">${esc(r.label)}</td></tr>`;
    const cells = t.columns.map((_, i) => `<td class="${signed(r.cells?.[i])}">${esc(r.cells?.[i] ?? '')}</td>`).join('');
    return `<tr${r.kind === 'emphasis' ? ' class="em"' : ''}><td${r.indent ? ' class="ind"' : ''}>${esc(r.label)}${r.footnote ? ` <small>${esc(r.footnote)}</small>` : ''}</td>${cells}</tr>`;
  }).join('');
  return `<div class="tbl"><table><thead><tr><th>${esc(t.note)}</th>${t.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

const tagged = (list) => list.map((h) => `<li>${inline(h.text)} <span class="pill">${esc(h.tag)}</span></li>`).join('');

export function renderReportPage({ company, period, report: r, hasPdf }) {
  const title = `${company.name} ${period}`;
  const listing = [company.exchange, company.ticker].filter(Boolean).join(': ');
  let n = 2;
  const segs = r.segments.map((s) => `
  <section><h2><span class="n">${++n}</span>Segment deep-dive: ${esc(s.name)}</h2>
    ${s.headline ? `<p class="lede">${inline(s.headline)}</p>` : ''}
    <div class="seg"><div class="prose">${s.narrative.map((p) => `<p>${inline(p)}</p>`).join('')}</div>${table(s.table)}</div>
  </section>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Iceman</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Public+Sans:wght@400;500;600&display=swap">
<style>
:root {
  --bg: #ffffff; --surface: #f2f5f8; --ink: #15202b; --muted: #5d6a78; --line: #e1e7ed;
  --accent: #1769b0; --on-accent: #ffffff; --panel: #16222f; --panel-ink: #f3f7fa; --panel-muted: #a9b8c6;
  --up: #1b7a4b; --down: #b8382c; --pill: #e6edf4;
  --display: "Archivo", "Arial Narrow", Arial, sans-serif;
  --body: "Public Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) { :root {
  --bg: #0f151c; --surface: #17202a; --ink: #e8eef4; --muted: #98a6b4; --line: #253140;
  --accent: #6db7f2; --on-accent: #07131f; --panel: #0a1018; --panel-ink: #eef3f8; --panel-muted: #98a6b4;
  --up: #5fcf93; --down: #f08a7e; --pill: #22303f; color-scheme: dark;
} }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 var(--body); }
a { color: var(--accent); }
.wrap { max-width: 1080px; margin: 0 auto; padding-inline: 20px; }
.bar { border-bottom: 1px solid var(--line); }
.bar .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 14px; flex-wrap: wrap; }
.brand { font: 800 18px/1 var(--display); font-stretch: 125%; letter-spacing: .06em; text-transform: uppercase; color: var(--ink); text-decoration: none; }
.brand span { font: 600 11px/1 var(--body); letter-spacing: .12em; color: var(--accent); margin-left: 10px; }
.btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--on-accent); text-decoration: none; font-weight: 600; font-size: 14px; padding: 9px 16px; border-radius: 999px; }
header.head { padding-block: 32px 20px; display: grid; gap: 10px; }
.eyebrow { margin: 0; font: 600 12px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0; font: 800 clamp(28px, 4.5vw, 42px)/1.1 var(--display); text-wrap: balance; }
.meta { margin: 0; color: var(--muted); font-size: 14px; }
.meta b { color: var(--ink); font-weight: 600; }
.conf { display: inline-block; font: 700 11px/1 var(--body); letter-spacing: .08em; padding: 5px 9px; border-radius: 4px; background: var(--pill); color: var(--ink); }
.verdict { background: var(--panel); color: var(--panel-ink); border-radius: 12px; padding: 20px 24px; margin-block: 8px 24px; }
.verdict p { margin: 6px 0 0; font-size: 17px; line-height: 1.55; max-width: 75ch; }
.verdict .lbl { font: 700 11px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--panel-muted); }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 36px; }
.kpi { border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 4px; }
.kpi .k { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.kpi .v { font: 800 24px/1.1 var(--display); font-variant-numeric: tabular-nums; }
.kpi .d { font-size: 13px; font-weight: 600; }
.up { color: var(--up); } .down { color: var(--down); } .flat { color: var(--muted); }
section { margin-bottom: 40px; }
h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 16px; font: 700 20px/1.2 var(--display); text-wrap: balance; }
h2 .n { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 13px; flex: none; }
.bullets { margin: 0; padding-left: 20px; columns: 2 380px; column-gap: 40px; }
.bullets li { margin-bottom: 8px; break-inside: avoid; }
.lede { margin: -4px 0 14px; font-weight: 600; }
.seg { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.prose p { margin: 0 0 12px; max-width: 70ch; }
.tbl { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th, td { padding: 7px 10px; text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; white-space: normal; min-width: 160px; }
thead th { background: var(--surface); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
tbody td { border-top: 1px solid var(--line); }
tr.grp td { background: var(--surface); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
tr.em td { font-weight: 700; }
td.ind { padding-left: 24px; }
td small { color: var(--muted); }
td.neg { color: var(--down); } td.pos { color: var(--up); }
.hl { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.hl > div { border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
.hl h3 { margin: 0 0 10px; font: 700 15px/1 var(--display); }
.hl ul { margin: 0; padding-left: 18px; } .hl li { margin-bottom: 8px; }
.pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: var(--pill); color: var(--muted); white-space: nowrap; }
.fc { background: var(--surface); border-radius: 12px; padding: 20px 22px; }
.fc p { max-width: 75ch; }
.bridge { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 16px 0; }
.bridge div { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.bridge .t { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.bridge .m { font: 800 18px/1.2 var(--display); margin-top: 4px; }
.bridge .c { font-size: 13px; color: var(--muted); }
.sources ol { padding-left: 22px; font-size: 14px; } .sources li { margin-bottom: 6px; overflow-wrap: anywhere; }
.kind { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-right: 6px; }
footer { border-top: 1px solid var(--line); padding-block: 20px 40px; color: var(--muted); font-size: 13px; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 760px) { .seg { grid-template-columns: minmax(0, 1fr); } .wrap { padding-inline: 16px; } }
</style>
</head>
<body>
<div class="bar"><div class="wrap">
  <a class="brand" href="../../">Iceman<span>Quarterly Reports</span></a>
  ${hasPdf ? '<a class="btn" href="brief.pdf">Download the CEO brief (PDF)</a>' : ''}
</div></div>
<main class="wrap">
  <header class="head">
    <p class="eyebrow">${esc(period)} results · analyst report</p>
    <h1>${esc(company.name)}</h1>
    <p class="meta">${listing ? `<b>${esc(listing)}</b> · ` : ''}Released ${esc(r.releaseDate)} · Currency ${esc(r.currency)} · <span class="conf">Data confidence: ${esc(r.confidence)}</span></p>
    ${r.sharePriceReaction ? `<p class="meta">Market reaction: <b>${esc(r.sharePriceReaction)}</b></p>` : ''}
  </header>

  <div class="verdict"><div class="lbl">The one-line verdict</div><p>${inline(r.verdict)}</p></div>
  <div class="kpis">${r.kpis.map((k) => `<div class="kpi"><span class="k">${esc(k.label)}</span><span class="v">${esc(k.value)}</span><span class="d ${k.dir}">${esc(k.delta)}</span></div>`).join('')}</div>

  <section><h2><span class="n">1</span>Executive summary</h2><ul class="bullets">${r.summary.map((b) => `<li>${inline(b)}</li>`).join('')}</ul></section>
  <section><h2><span class="n">2</span>Group financial summary</h2>${table(r.groupTable)}</section>
  ${segs}
  <section><h2><span class="n">${++n}</span>Highlights &amp; lowlights</h2>
    <div class="hl"><div><h3 class="up">▲ Highlights</h3><ul>${tagged(r.highlights)}</ul></div><div><h3 class="down">▼ Lowlights</h3><ul>${tagged(r.lowlights)}</ul></div></div>
  </section>
  <section><h2><span class="n">${++n}</span>Forecast &amp; outlook</h2>
    <div class="fc">
      <p><b>Guidance bridge.</b> ${inline(r.forecast.intro)}</p>
      <div class="bridge">${r.forecast.bridge.map((b) => `<div><div class="t">${esc(b.title)}</div><div class="m">${esc(b.value)}</div>${b.change ? `<div class="c">${esc(b.change)}</div>` : ''}</div>`).join('')}</div>
      <p><b>Independent view.</b> ${inline(r.forecast.view)}</p>
      <p><b>What to watch next quarter</b></p><ul>${r.forecast.watch.map((w) => `<li>${inline(w)}</li>`).join('')}</ul>
    </div>
  </section>
  <section class="sources"><h2>Sources</h2>
    <p><span class="conf">Data confidence: ${esc(r.confidence)}</span> ${esc(r.confidenceNote)}</p>
    <ol>${r.sources.map((s) => `<li><span class="kind">${s.kind === 'primary' ? 'Primary' : 'Secondary'}</span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`).join('')}</ol>
  </section>
</main>
<footer><div class="wrap">Research analysis by Merlin for Iceman (B2Tech), produced with AI from public sources. Not a rating, price target or investment advice. Verify figures against the company's own filing before relying on them.</div></footer>
</body>
</html>
`;
}
