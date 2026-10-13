// Renders the edition as one self-contained HTML page (all cards rendered server-side,
// a small script only filters by section and search).
import { SECTIONS } from './sources.js';

const PER_SECTION = 6; // cards shown per section in the "All" view

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const initials = (name) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase();

function stamp(date, now) {
  const sameDay = dayFmt.format(date) === dayFmt.format(now);
  return `${sameDay ? '' : dayFmt.format(date) + ', '}${timeFmt.format(date)} GMT`;
}

function card(story, now, extra) {
  const [lead, ...others] = story.articles;
  const search = [lead.title, story.summary, ...story.articles.map((a) => a.sourceName)].join(' ').toLowerCase();
  const thumb = lead.imageData
    ? `<img src="${lead.imageData}" alt="" loading="lazy">`
    : `<span class="ph" aria-hidden="true">${esc(initials(lead.sourceName))}</span>`;
  const also = others.length
    ? `<p class="also">Also covered by ${others.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.sourceName)}</a>`).join(', ')}</p>` : '';
  return `<article class="card${extra ? ' extra' : ''}" data-text="${esc(search)}">
  <a class="thumb" href="${esc(lead.url)}" target="_blank" rel="noopener" tabindex="-1">${thumb}</a>
  <div class="meta"><span class="src">${esc(lead.sourceName)}</span><time datetime="${lead.date.toISOString()}">${stamp(lead.date, now)}</time></div>
  <h3><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(lead.title)}</a></h3>
  ${story.summary ? `<p class="sum">${esc(story.summary)}</p>` : ''}
  ${also}
</article>`;
}

export function render({ edition, items, status, now, hours }) {
  const stories = edition.stories.map((s) => ({ ...s, articles: s.ids.map((id) => items[id]) }));
  const rank = (a, b) => b.importance - a.importance || b.articles.length - a.articles.length || b.articles[0].date - a.articles[0].date;
  const bySection = Object.fromEntries(SECTIONS.map((sec) => [sec.id, stories.filter((s) => s.section === sec.id).sort(rank)]));
  const sourcesOk = status.filter((s) => s.ok).length;
  const ticker = [...stories].sort(rank).slice(0, 8);

  const nav = SECTIONS.map((s) => `<a href="#${s.id}" data-go="${s.id}" class="tag t-${s.id}">${s.label}<span>${bySection[s.id].length}</span></a>`).join('');

  const sections = SECTIONS.map((sec) => {
    const list = bySection[sec.id];
    const more = list.length > PER_SECTION ? `<a class="more" href="#${sec.id}" data-go="${sec.id}">See all ${list.length}</a>` : '';
    return `<section class="sec" data-sec="${sec.id}" aria-labelledby="h-${sec.id}">
  <div class="sechead"><h2 id="h-${sec.id}"><span class="tag t-${sec.id}">${sec.label}</span></h2><span class="count">${list.length} ${list.length === 1 ? 'story' : 'stories'}</span>${more}</div>
  ${list.length ? `<div class="grid">${list.map((s, i) => card(s, now, i >= PER_SECTION)).join('\n')}</div>` : '<p class="none">No stories in this section today.</p>'}
  <p class="none nomatch" hidden>No stories here match your search.</p>
</section>`;
  }).join('\n');

  const must = edition.mustReads.map(({ story, why }) => {
    const lead = items[story.ids[0]];
    return `<li><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(lead.title)}</a>${why ? `<p>${esc(why)}</p>` : ''}<span>${esc(lead.sourceName)}</span></li>`;
  }).join('');

  const tickerItems = ticker.map((s) => `<a href="${esc(s.articles[0].url)}" target="_blank" rel="noopener">${esc(s.articles[0].title)}</a>`).join('');
  const sourceList = status.sort((a, b) => a.source.localeCompare(b.source))
    .map((s) => `<li class="${s.ok ? '' : 'down'}">${esc(s.source)} <span>${s.ok ? s.count : 'unavailable'}</span></li>`).join('');

  return `<title>Iceman</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Public+Sans:wght@400;500;600&display=swap">
<style>
/* Iceman: cold, clear, numbers-first. Glacier-blue accent on blue-grey neutrals.
   Layout: news-desk shell. Section rail on the left, pastel topic tags, a 3-up card grid per section, dark must-reads column on the right. */
:root {
  --bg: #ffffff; --surface: #f2f5f8; --ink: #15202b; --muted: #5d6a78; --line: #e1e7ed;
  --accent: #1769b0; --on-accent: #ffffff;
  --wash-a: #dcecf8; --wash-b: #f1f4f9;
  --panel: #16222f; --panel-ink: #f3f7fa; --panel-muted: #a9b8c6; --panel-line: #2a3a4a; --panel-accent: #6db7f2;
  --general-bg: #e3e8f2; --general-fg: #2e4367;
  --quarterly-bg: #f6e8b9; --quarterly-fg: #67500f;
  --casino-bg: #ece2f6; --casino-fg: #573884;
  --sports-bg: #d8ebf6; --sports-fg: #1b5877;
  --people-bg: #dbefe1; --people-fg: #22603b;
  --africa-bg: #f7ddcc; --africa-fg: #873b12;
  --display: "Archivo", "Arial Narrow", Arial, sans-serif;
  --body: "Public Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f151c; --surface: #17202a; --ink: #e8eef4; --muted: #98a6b4; --line: #253140;
  --accent: #6db7f2; --on-accent: #07131f;
  --wash-a: #12273a; --wash-b: #141c26;
  --panel: #0a1018; --panel-ink: #eef3f8; --panel-muted: #98a6b4; --panel-line: #1f2b38; --panel-accent: #7cc0f5;
  --general-bg: #253041; --general-fg: #bccbe7; --quarterly-bg: #3a321e; --quarterly-fg: #edd68c;
  --casino-bg: #33284a; --casino-fg: #d6c2f1; --sports-bg: #1b3443; --sports-fg: #a8d7ef;
  --people-bg: #1d3a29; --people-fg: #abe0bc; --africa-bg: #43291c; --africa-fg: #f3ba94;
  color-scheme: dark;
} }
:root[data-theme="dark"] {
  --bg: #0f151c; --surface: #17202a; --ink: #e8eef4; --muted: #98a6b4; --line: #253140;
  --accent: #6db7f2; --on-accent: #07131f;
  --wash-a: #12273a; --wash-b: #141c26;
  --panel: #0a1018; --panel-ink: #eef3f8; --panel-muted: #98a6b4; --panel-line: #1f2b38; --panel-accent: #7cc0f5;
  --general-bg: #253041; --general-fg: #bccbe7; --quarterly-bg: #3a321e; --quarterly-fg: #edd68c;
  --casino-bg: #33284a; --casino-fg: #d6c2f1; --sports-bg: #1b3443; --sports-fg: #a8d7ef;
  --people-bg: #1d3a29; --people-fg: #abe0bc; --africa-bg: #43291c; --africa-fg: #f3ba94;
  color-scheme: dark;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; }
a { color: inherit; text-decoration: none; }
a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }

.app { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 100vh; }
.rail { border-right: 1px solid var(--line); padding: 32px 20px; position: sticky; top: env(safe-area-inset-top, 0px); height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 28px; }
.mast { font-family: var(--display); font-stretch: 125%; font-weight: 800; font-size: 27px; line-height: .95; letter-spacing: .06em; text-transform: uppercase; }
.mast small { display: block; font-stretch: 100%; font-weight: 600; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
.rail nav { display: flex; flex-direction: column; gap: 2px; }
.rail nav a { display: flex; justify-content: space-between; padding: 7px 10px; border-radius: 8px; color: var(--muted); font-weight: 500; font-size: 14px; }
.rail nav a span { font-variant-numeric: tabular-nums; }
.rail nav a:hover { background: var(--surface); color: var(--ink); }
.rail nav a[aria-current="true"] { background: var(--surface); color: var(--ink); font-weight: 600; }
.rail h4, .foot h4 { margin: 0 0 8px; font: 600 11px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.srcs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; color: var(--muted); }
.srcs li { display: flex; justify-content: space-between; gap: 8px; }
.srcs li span { font-variant-numeric: tabular-nums; }
.srcs li.down span { color: var(--accent); }

.top { background: linear-gradient(100deg, var(--wash-a), var(--wash-b)); padding: 28px 40px 22px; display: grid; gap: 18px; }
.top .m-mast { display: none; }
.tagline { margin: 0; font-family: var(--display); font-weight: 600; font-size: 22px; letter-spacing: -.005em; text-wrap: balance; }
.tagline b { color: var(--accent); font-weight: 800; }
.dateline { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
.search { display: flex; max-width: 460px; }
.search input { flex: 1; min-width: 0; font: inherit; padding: 11px 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--ink); }
.pills { display: flex; gap: 8px; flex-wrap: wrap; }
.pill { font: 600 14px/1 var(--body); padding: 10px 16px; border-radius: 999px; border: 0; cursor: pointer; }
.pill.all { background: var(--surface); color: var(--ink); }
.pill[aria-pressed="true"] { background: var(--accent); color: var(--on-accent); }
.tag { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; font-weight: 600; }
.tag span { font-variant-numeric: tabular-nums; opacity: .7; font-weight: 500; }
.t-general { background: var(--general-bg); color: var(--general-fg); }
.t-quarterly { background: var(--quarterly-bg); color: var(--quarterly-fg); }
.t-casino { background: var(--casino-bg); color: var(--casino-fg); }
.t-sports { background: var(--sports-bg); color: var(--sports-fg); }
.t-people { background: var(--people-bg); color: var(--people-fg); }
.t-africa { background: var(--africa-bg); color: var(--africa-fg); }

.ticker { margin: 24px 40px 0; display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 14px; }
.ticker b { background: var(--accent); color: var(--on-accent); padding: 11px 16px; font: 700 13px/1.2 var(--display); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.tscroll { overflow: hidden; flex: 1; min-width: 0; display: flex; align-items: center; }
.track { display: flex; gap: 48px; white-space: nowrap; padding-left: 20px; animation: run 70s linear infinite; font-weight: 600; }
.ticker:hover .track { animation-play-state: paused; }
.track a:hover { color: var(--accent); }
@keyframes run { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .track { animation: none; } .tscroll { overflow-x: auto; } }

.body { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 36px; padding: 28px 40px 48px; align-items: start; }
.feed { display: grid; gap: 44px; min-width: 0; }
.sechead { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.sechead h2 { margin: 0; font: 700 17px/1 var(--display); }
.sechead .tag { padding: 9px 16px; }
.count { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.more { margin-left: auto; font-weight: 600; font-size: 14px; color: var(--accent); }
.more:hover { text-decoration: underline; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 28px 24px; }
.card { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.thumb { display: block; aspect-ratio: 16 / 9; max-width: 100%; border-radius: 10px; overflow: hidden; background: var(--surface); }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
.card:hover .thumb img { transform: scale(1.03); }
.ph { display: grid; place-items: center; height: 100%; font: 800 28px/1 var(--display); font-stretch: 125%; color: var(--muted); }
.meta { display: flex; gap: 10px; font-size: 12.5px; color: var(--muted); }
.meta .src { font-weight: 600; color: var(--ink); }
.card h3 { margin: 0; font: 700 16.5px/1.3 var(--display); text-wrap: balance; }
.card h3 a:hover { color: var(--accent); }
.sum { margin: 0; color: var(--muted); font-size: 14px; }
.also { margin: 0; font-size: 12.5px; color: var(--muted); }
.also a { text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 2px; }
.also a:hover { color: var(--ink); }
.none { color: var(--muted); margin: 0; }

body[data-view="all"]:not(.searching) .card.extra { display: none; }
body:not([data-view="all"]) .more { display: none; }

.must { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 20px); background: var(--panel); color: var(--panel-ink); border-radius: 12px; overflow: hidden; }
.must h2 { margin: 0; padding: 16px 20px; font: 700 16px/1 var(--display); border-bottom: 2px solid var(--panel-accent); }
.must ol { list-style: none; margin: 0; padding: 0; counter-reset: must; }
.must li { counter-increment: must; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 14px; padding: 16px 20px; border-top: 1px solid var(--panel-line); }
.must li:first-child { border-top: 0; }
.must li::after { content: counter(must); grid-column: 2; grid-row: 1 / span 3; font: 800 30px/1 var(--display); color: var(--panel-accent); align-self: center; }
.must li a { font: 700 15px/1.3 var(--display); }
.must li a:hover { text-decoration: underline; }
.must li p { margin: 6px 0 0; font-size: 13px; color: var(--panel-muted); }
.must li span { margin-top: 6px; font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--panel-muted); }

.foot { border-top: 1px solid var(--line); margin: 0 40px; padding-block: 20px 36px; color: var(--muted); font-size: 12.5px; display: grid; gap: 4px; }
.foot p { margin: 0; }

@media (max-width: 1100px) {
  .body { grid-template-columns: minmax(0, 1fr); }
  .must { position: static; order: -1; }
}
@media (max-width: 760px) {
  .app { grid-template-columns: minmax(0, 1fr); }
  .rail { display: none; }
  .top { padding: 20px 16px; }
  .top .m-mast { display: block; }
  .tagline { font-size: 18px; }
  .ticker { margin: 16px 16px 0; }
  .ticker b { display: none; }
  .body { padding: 20px 16px 40px; }
  .foot { margin: 0 16px; }
  .pills { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
  .pill { white-space: nowrap; }
}
</style>

<div class="app">
  <aside class="rail">
    <div class="mast"><small>B2Tech</small>Iceman</div>
    <nav aria-label="Sections"><a href="#all" data-go="all" aria-current="true">All stories<span>${stories.length}</span></a>${SECTIONS.map((s) => `<a href="#${s.id}" data-go="${s.id}">${s.label}<span>${bySection[s.id].length}</span></a>`).join('')}</nav>
    <div><h4>Sources today</h4><ul class="srcs">${sourceList}</ul></div>
  </aside>

  <div class="main">
    <header class="top">
      <div class="mast m-mast"><small>B2Tech</small>Iceman</div>
      <div>
        <p class="tagline"><b>I</b>ndustry &amp; <b>C</b>ompany <b>E</b>arnings, <b>M</b>arket <b>A</b>nalysis &amp; <b>N</b>ews</p>
        <p class="dateline">${longDate.format(now)} · ${stories.length} stories from ${sourcesOk} sources, last ${hours} hours</p>
      </div>
      <div class="search"><input id="q" type="search" placeholder="Search headlines, companies, markets" aria-label="Search stories"></div>
      <div class="pills" role="group" aria-label="Filter by section">
        <button class="pill all" data-go="all" aria-pressed="true">All</button>
        ${SECTIONS.map((s) => `<button class="pill tag t-${s.id}" data-go="${s.id}" aria-pressed="false">${s.label}</button>`).join('')}
      </div>
    </header>

    <div class="ticker" aria-label="Top stories"><b>Top stories</b><div class="tscroll"><div class="track">${tickerItems}${tickerItems.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ')}</div></div></div>

    <div class="body">
      <main class="feed">${sections}</main>
      <aside class="must" aria-labelledby="must-h"><h2 id="must-h">Must reads</h2><ol>${must}</ol></aside>
    </div>

    <footer class="foot">
      <p>Compiled ${longDate.format(now)} at ${timeFmt.format(now)} GMT from ${status.length} trade publications. Headlines link to the original articles.</p>
      <p>${edition.engine === 'claude' ? 'Sections, summaries and must-reads selected by Claude.' : 'Sections assigned by keyword rules (Claude was unavailable for this edition).'} Iceman by B2Tech · internal use only.</p>
    </footer>
  </div>
</div>

<script>
(() => {
  const body = document.body;
  const q = document.getElementById('q');
  const valid = ['all', ${SECTIONS.map((s) => `'${s.id}'`).join(', ')}];

  function apply() {
    const view = body.dataset.view;
    const term = q.value.trim().toLowerCase();
    body.classList.toggle('searching', !!term);
    document.querySelectorAll('[data-go]').forEach((el) => {
      const on = el.dataset.go === view;
      if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', on);
      else if (el.closest('.rail')) el.setAttribute('aria-current', on);
    });
    document.querySelectorAll('.sec').forEach((sec) => {
      let shown = 0;
      sec.querySelectorAll('.card').forEach((c) => {
        c.hidden = !!term && !c.dataset.text.includes(term);
        if (!c.hidden) shown++;
      });
      const nomatch = sec.querySelector('.nomatch');
      nomatch.hidden = !term || shown > 0;
      sec.hidden = (view !== 'all' && sec.dataset.sec !== view) || (!!term && shown === 0 && view === 'all');
    });
  }

  function go(view, scroll) {
    body.dataset.view = valid.includes(view) ? view : 'all';
    apply();
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-go]');
    if (!el) return;
    e.preventDefault();
    go(el.dataset.go, true);
    try { history.replaceState(null, '', '#' + el.dataset.go); } catch {}
  });
  q.addEventListener('input', apply);
  go(location.hash.slice(1) || 'all', false);
})();
</script>`;
}

// The emailed file needs its own document shell; the published page gets one from the host.
export function wrapDocument(fragment) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
</head>
<body>
${fragment}
</body>
</html>
`;
}
