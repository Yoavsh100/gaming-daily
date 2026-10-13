// Renders a structured report (see schema.js) into (a) a markdown document and
// (b) the branded B2Tech / Merlin HTML that becomes the CEO / analyst PDF.

// Decode any pre-existing HTML entities first (some inputs arrive pre-escaped),
// then encode — idempotent, so "&amp;" and "&" both render as a single "&".
const dec = (s = '') => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = (s = '') => dec(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline markdown -> HTML: **bold** and *italic* only (safe, escaped first).
const inline = (s = '') => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\*(.+?)\*/g, '<i>$1</i>');

const tagClass = (t = '') => (t.toLowerCase() === 'structural' ? 'ps' : 'po');

// Colour a numeric/percentage cell: leading '-' = red decline. (Positives are
// usually unsigned in analyst tables, so we only flag the negatives.)
const cellCls = (v = '') => {
  const t = String(v).trim();
  if (t.startsWith('-') && t !== '-' && t !== '—') return 'neg';
  if (t.startsWith('+')) return 'pos';
  return '';
};

// ---------- flexible tables (shared) ----------
function flexRowsHtml(t) {
  const nCols = 1 + t.columns.length;
  return t.rows.map((row) => {
    if (row.kind === 'group') return `<tr class="grp"><td colspan="${nCols}">${esc(row.label)}</td></tr>`;
    const cls = row.kind === 'emphasis' ? ' class="hi"' : '';
    const lbl = esc(row.label).replace(/^ +/, (m) => '&nbsp;'.repeat(m.length)) +
      (row.footnote ? ` <sup>${esc(row.footnote)}</sup>` : '');
    const cells = (row.cells || []);
    const tds = t.columns.map((_, i) => {
      const v = cells[i] ?? '';
      return `<td class="${cellCls(v)}">${esc(v)}</td>`;
    }).join('');
    return `<tr${cls}><td${row.indent ? ' style="padding-left:16px"' : ''}>${lbl}</td>${tds}</tr>`;
  }).join('');
}
function flexTableHtml(t) {
  const head = `<th>${esc(t.note)}</th>` + t.columns.map((c) => `<th>${esc(c)}</th>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${flexRowsHtml(t)}</tbody></table>` +
    (t.footnote ? `<div class="tfoot">${esc(t.footnote)}</div>` : '');
}
function flexTableMd(t) {
  const L = [];
  L.push(`| ${t.note} | ${t.columns.join(' | ')} |`);
  L.push(`|${'---|'.repeat(1 + t.columns.length)}`);
  for (const row of t.rows) {
    if (row.kind === 'group') { L.push(`| **${row.label}** |${' |'.repeat(t.columns.length)}`); continue; }
    const lbl = row.label + (row.footnote ? ` ${row.footnote}` : '');
    const cells = t.columns.map((_, i) => (row.cells?.[i] ?? '')).join(' | ');
    L.push(`| ${lbl} | ${cells} |`);
  }
  if (t.footnote) L.push(`\n${t.footnote}`);
  return L.join('\n');
}

// ---------- Markdown ----------
export function renderMarkdown(meta, r) {
  const L = [];
  L.push(`# ${meta.company.name} (${meta.company.ticker}) — ${meta.period} Analyst Report`);
  L.push(`**${meta.company.exchange} · Reporting currency: ${r.currency} · Results released ${r.releaseDate}**`);
  if (r.sharePriceReaction) L.push(`**Market reaction:** ${r.sharePriceReaction}`);
  L.push(`\n> ${r.verdict}\n`);

  L.push('## 1. Executive Summary\n');
  for (const b of r.summary) L.push(`- ${b}`);

  L.push('\n## 2. Group Financial Summary\n');
  L.push(flexTableMd(r.groupTable));

  let n = 3;
  for (const seg of r.segments) {
    L.push(`\n## ${n}. Segment deep-dive — ${seg.name}\n`);
    if (seg.headline) L.push(`*${seg.headline}*\n`);
    for (const p of seg.narrative) { L.push(p); L.push(''); }
    L.push(flexTableMd(seg.table));
    n++;
  }

  L.push(`\n## ${n}. Highlights & Lowlights\n`);
  L.push('**Highlights**\n');
  for (const h of r.highlights) L.push(`- ${h.text} _(${h.tag})_`);
  L.push('\n**Lowlights**\n');
  for (const h of r.lowlights) L.push(`- ${h.text} _(${h.tag})_`);
  n++;

  L.push(`\n## ${n}. Forecast & Outlook\n`);
  L.push(`${r.forecast.intro}\n`);
  for (const b of r.forecast.bridge) L.push(`- **${b.title}:** ${b.value}${b.change ? ` (${b.change})` : ''}`);
  L.push(`\n${r.forecast.view}\n`);
  L.push('**What to watch next quarter:**\n');
  for (const w of r.forecast.watch) L.push(`- ${w}`);

  L.push(`\n### Sources\n`);
  L.push(`**Data confidence: ${r.confidence}.** ${r.confidenceNote}\n`);
  r.sources.forEach((s, i) => L.push(`${i + 1}. [${s.kind === 'primary' ? 'Primary' : 'Secondary'}] ${s.label}${s.url ? ` — ${s.url}` : ''}`));
  L.push(`\n*Research analysis only — not a rating, price target, or personalised investment advice.*`);
  return L.join('\n');
}

// ---------- Branded HTML (PDF) ----------
export function renderHtml(meta, r, opts = {}) {
  const prepared = opts.prepared || '';
  const logos = opts.logos || {};
  const isReg = r.docType === 'regulator';
  const briefLabel = isReg ? 'Gambling Market & Regulatory Brief' : 'Earnings — Analyst Brief';
  const table2Label = isReg ? 'Market Summary' : 'Group Financial Summary';
  const segLabel = isReg ? 'Deep-dive' : 'Segment deep-dive';

  const brandLeft = logos.b2tech
    ? `<img class="logo-b2t" src="${logos.b2tech}" alt="B2Tech">`
    : `<div class="b2t"><span class="mark">B2</span>TECH<span class="tail">GAMING · EQUITY RESEARCH</span></div>`;
  const brandRight = logos.merlin
    ? `<img class="logo-merlin" src="${logos.merlin}" alt="Merlin">`
    : `<div class="merlin"><div class="vn">MERLIN</div><div class="vt">the Q reporting tool</div></div>`;
  const footMerlin = logos.merlin
    ? `<span class="footmerlin"><img src="${logos.merlin}" alt="Merlin"> the Q reporting tool</span>`
    : `<span>Made by <b style="color:var(--navy);">🧙 Merlin</b> — the Q reporting tool</span>`;

  const kpis = r.kpis.map((k) => `
    <div class="kpi"><div class="k">${esc(k.label)}</div>
      <div class="v"${k.dir === 'down' ? ' style="color:var(--red)"' : ''}>${esc(k.value)}</div>
      <div class="d ${k.dir === 'up' ? 'up' : k.dir === 'down' ? 'down' : 'flat'}">${esc(k.delta)}</div></div>`).join('');
  const bullets = r.summary.map((b) => `<li>${inline(b)}</li>`).join('');

  let n = 3;
  const segHtml = r.segments.map((seg) => {
    const nar = seg.narrative.map((p) => `<p class="segp">${inline(p)}</p>`).join('');
    const block = `
    <div class="sec seg">
      <div class="sec-h"><span class="n">${n}</span><h2>${segLabel} — ${esc(seg.name)}</h2><span class="rule"></span></div>
      ${seg.headline ? `<div class="seghead">${inline(seg.headline)}</div>` : ''}
      <div class="seggrid">
        <div class="segnar">${nar}</div>
        <div class="segtbl">${flexTableHtml(seg.table)}</div>
      </div>
    </div>`;
    n++;
    return block;
  }).join('');
  const hlN = n; n++;
  const fcN = n;

  const hl = r.highlights.map((h) => `<li>${inline(h.text)} <span class="pill ${tagClass(h.tag)}">${esc(h.tag)}</span></li>`).join('');
  const ll = r.lowlights.map((h) => `<li>${inline(h.text)} <span class="pill ${tagClass(h.tag)}">${esc(h.tag)}</span></li>`).join('');
  const bridge = r.forecast.bridge.map((b) => `
    <div class="b"><div class="t">${esc(b.title)}</div><div class="m">${esc(b.value)}</div>${b.change ? `<div class="c">${esc(b.change)}</div>` : ''}</div>`).join('');
  const watch = r.forecast.watch.map((w) => `<li>${inline(w)}</li>`).join('');
  const srcs = r.sources.map((s) => `[${s.kind === 'primary' ? 'Primary' : 'Secondary'}] ${esc(s.label)}`).join('; ');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>${esc(meta.company.name)} ${esc(meta.period)} — Analyst Brief</title>
<style>
  :root{--navy:#0d2338;--ink:#1b2733;--slate:#5a6b7b;--line:#dbe2e8;--soft:#f4f7f9;
    --green:#1f8a5b;--red:#c0392b;--accent:#2f7fb0;--vgreen:#1f8a3b;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{margin:0;padding:0;}
  body{font-family:"Segoe UI",-apple-system,Arial,sans-serif;color:var(--ink);font-size:10.2px;line-height:1.45;}
  @page{size:A4;margin:13mm 12mm 14mm 12mm;}
  h2{margin:0;font-weight:700;color:var(--navy);}
  p{margin:0 0 6px;}
  .brandbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;margin-bottom:9px;border-bottom:1px solid var(--line);}
  .logo-b2t{height:30px;width:auto;}
  .logo-merlin{height:46px;width:auto;}
  .b2t{font-size:17px;font-weight:800;letter-spacing:1px;color:var(--navy);display:flex;align-items:center;}
  .b2t .mark{background:var(--accent);color:#fff;border-radius:4px;padding:1px 6px;margin-right:5px;letter-spacing:0;font-weight:800;font-size:16px;}
  .b2t .tail{color:var(--slate);font-weight:700;font-size:9px;letter-spacing:2px;margin-left:8px;align-self:flex-end;padding-bottom:2px;}
  .merlin{text-align:right;line-height:1.35;}
  .merlin .vn{font-size:12px;font-weight:800;color:var(--navy);letter-spacing:.5px;}
  .merlin .vn::before{content:"\\1F9D9";margin-right:4px;font-size:11px;}
  .merlin .vt{font-size:8px;color:var(--slate);text-transform:uppercase;letter-spacing:1px;}
  .masthead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--navy);padding-bottom:9px;margin-bottom:11px;}
  .masthead .co{font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--navy);}
  .masthead .sub{font-size:9.5px;color:var(--slate);margin-top:2px;}
  .masthead .react{font-size:9.5px;color:var(--red);font-weight:700;margin-top:2px;}
  .masthead .right{text-align:right;font-size:9px;color:var(--slate);line-height:1.5;}
  .tag{display:inline-block;background:var(--navy);color:#fff;font-size:8.5px;font-weight:700;letter-spacing:.6px;padding:2px 7px;border-radius:3px;text-transform:uppercase;}
  .verdict{background:var(--navy);color:#eaf1f6;border-radius:6px;padding:10px 13px;margin-bottom:11px;}
  .verdict .lbl{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;color:#9dbdd6;font-weight:700;}
  .verdict p{margin:3px 0 0;font-size:10.5px;line-height:1.5;color:#f2f7fb;}
  .verdict b{color:#fff;}
  .kpis{display:grid;grid-template-columns:repeat(${r.kpis.length},1fr);gap:7px;margin-bottom:13px;}
  .kpi{border:1px solid var(--line);border-radius:6px;padding:7px 8px;background:var(--soft);}
  .kpi .k{font-size:7.6px;text-transform:uppercase;letter-spacing:.4px;color:var(--slate);font-weight:700;}
  .kpi .v{font-size:14px;font-weight:800;color:var(--navy);margin-top:3px;line-height:1;}
  .kpi .d{font-size:8.5px;font-weight:700;margin-top:3px;}
  .up{color:var(--green);}.down{color:var(--red);}.flat{color:var(--slate);}
  .sec{margin-bottom:12px;}
  .sec-h{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
  .sec-h .n{background:var(--navy);color:#fff;width:16px;height:16px;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
  .sec-h h2{font-size:12px;text-transform:uppercase;letter-spacing:.4px;}
  .sec-h .rule{flex:1;height:1px;background:var(--line);}
  .sec-h{break-after:avoid;}
  .seg{break-inside:avoid;}
  ul.bul{margin:0;padding:0;list-style:none;}
  ul.bul li{position:relative;padding:0 0 5px 13px;margin-bottom:1px;}
  ul.bul li::before{content:"";position:absolute;left:2px;top:5px;width:4px;height:4px;background:var(--accent);border-radius:50%;}
  ul.bul li b{color:var(--navy);}
  .cols2{column-count:2;column-gap:16px;}
  table{width:100%;border-collapse:collapse;font-size:8.7px;}
  th,td{padding:3px 6px;text-align:right;}
  th:first-child,td:first-child{text-align:left;}
  thead th{background:var(--navy);color:#fff;font-size:8px;text-transform:uppercase;letter-spacing:.3px;}
  tbody tr:nth-child(even){background:var(--soft);}
  tbody td{border-bottom:1px solid var(--line);}
  tr.grp td{background:#e9eef2;font-weight:700;color:var(--navy);text-transform:uppercase;font-size:7.6px;letter-spacing:.5px;}
  tr.hi td{font-weight:700;}
  .neg{color:var(--red);}.pos{color:var(--green);}
  .tfoot{font-size:7.4px;color:var(--slate);margin-top:3px;}
  /* segment two-column: narrative left, table right */
  .seg .seggrid{display:grid;grid-template-columns:1.05fr 1fr;gap:13px;align-items:start;}
  .seghead{font-size:10px;font-weight:700;color:var(--navy);background:var(--soft);border-left:3px solid var(--accent);padding:5px 9px;border-radius:0 4px 4px 0;margin-bottom:7px;}
  .segnar .segp{margin:0 0 6px;text-align:justify;line-height:1.5;}
  .segnar .segp:last-child{margin-bottom:0;}
  .hlll{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .card{border:1px solid var(--line);border-radius:6px;overflow:hidden;}
  .card .cap{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;padding:5px 10px;color:#fff;}
  .card.h .cap{background:var(--green);}.card.l .cap{background:var(--red);}
  .card .body{padding:8px 10px;}
  .card ul{margin:0;padding:0;list-style:none;}
  .card li{padding:0 0 5px 12px;position:relative;margin-bottom:1px;}
  .card li::before{content:"";position:absolute;left:0;top:5px;width:4px;height:4px;border-radius:50%;}
  .card.h li::before{background:var(--green);}.card.l li::before{background:var(--red);}
  .pill{display:inline-block;font-size:7.5px;font-weight:700;padding:0 5px;border-radius:8px;margin-left:3px;vertical-align:middle;}
  .ps{background:#eef3f7;color:var(--slate);}.po{background:#fff4e5;color:#a56412;}
  .fc{background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:10px 12px;}
  .bridge{display:grid;grid-template-columns:repeat(${r.forecast.bridge.length},1fr);gap:8px;margin:8px 0;}
  .bridge .b{background:#fff;border:1px solid var(--line);border-radius:5px;padding:7px 9px;}
  .bridge .b .t{font-size:8px;text-transform:uppercase;color:var(--slate);font-weight:700;letter-spacing:.4px;}
  .bridge .b .m{font-size:12px;font-weight:800;color:var(--navy);margin-top:2px;}
  .bridge .b .c{font-size:8.2px;color:var(--red);font-weight:700;}
  .watch li{padding-left:14px;}
  .foot{margin-top:12px;border-top:1px solid var(--line);padding-top:8px;font-size:8px;color:var(--slate);}
  .conf{display:inline-block;background:#e8f5ee;color:var(--green);font-weight:800;font-size:8px;padding:1px 7px;border-radius:3px;letter-spacing:.4px;}
  .srcs{font-size:7.6px;color:var(--slate);margin-top:5px;line-height:1.5;}
  .footrow{margin-top:6px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:5px;}
  .footmerlin{display:inline-flex;align-items:center;gap:5px;}
  .footmerlin img{height:22px;width:auto;}
  .avoid-break{break-inside:avoid;}
  .page-break{break-before:page;}
</style></head><body>

  <div class="brandbar">${brandLeft}${brandRight}</div>

  <div class="masthead">
    <div>
      <div class="co">${esc(meta.company.name)} <span style="font-weight:600;color:var(--slate);font-size:12px;">(${esc(meta.company.exchange)}: ${esc(meta.company.ticker)})</span></div>
      <div class="sub">${esc(meta.period)} ${briefLabel} &nbsp;·&nbsp; ${isReg ? 'Published' : 'Released'} ${esc(r.releaseDate)} &nbsp;·&nbsp; Currency ${esc(r.currency)}</div>
      ${r.sharePriceReaction ? `<div class="react">${esc(r.sharePriceReaction)}</div>` : ''}
    </div>
    <div class="right"><span class="tag">Confidential · Internal</span><br>${prepared ? `Prepared: ${esc(prepared)}<br>` : ''}B2Tech · via Merlin</div>
  </div>

  <div class="verdict"><div class="lbl">The one-line verdict</div><p>${inline(r.verdict)}</p></div>

  <div class="kpis">${kpis}</div>

  <div class="sec">
    <div class="sec-h"><span class="n">1</span><h2>Executive Summary</h2><span class="rule"></span></div>
    <ul class="bul cols2">${bullets}</ul>
  </div>

  <div class="sec avoid-break">
    <div class="sec-h"><span class="n">2</span><h2>${table2Label}</h2><span class="rule"></span></div>
    ${flexTableHtml(r.groupTable)}
  </div>

  ${segHtml}

  <div class="sec avoid-break">
    <div class="sec-h"><span class="n">${hlN}</span><h2>Highlights &amp; Lowlights</h2><span class="rule"></span></div>
    <div class="hlll">
      <div class="card h"><div class="cap">▲ Highlights</div><div class="body"><ul>${hl}</ul></div></div>
      <div class="card l"><div class="cap">▼ Lowlights</div><div class="body"><ul>${ll}</ul></div></div>
    </div>
  </div>

  <div class="sec avoid-break">
    <div class="sec-h"><span class="n">${fcN}</span><h2>Forecast &amp; Outlook</h2><span class="rule"></span></div>
    <div class="fc">
      <p><b>Guidance bridge.</b> ${inline(r.forecast.intro)}</p>
      <div class="bridge">${bridge}</div>
      <p><b>Independent view.</b> ${inline(r.forecast.view)}</p>
      <p style="margin-top:4px;"><b>What to watch next quarter:</b></p>
      <ul class="bul watch">${watch}</ul>
    </div>
  </div>

  <div class="foot">
    <span class="conf">DATA CONFIDENCE: ${esc(r.confidence)}</span> &nbsp; ${esc(r.confidenceNote)}
    <div class="srcs"><b>Sources:</b> ${srcs}.</div>
    <div style="margin-top:5px;font-style:italic;">Research analysis only — not a rating, price target, or personalised investment advice. Prepared for internal executive review.</div>
    <div class="footrow">
      <span style="font-weight:700;color:var(--navy);letter-spacing:.5px;">B2TECH</span>
      ${footMerlin}
    </div>
  </div>

</body></html>`;
}
