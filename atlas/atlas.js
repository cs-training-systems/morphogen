/* atlas.js: the Morphospaces Atlas page. An ES module with no dependencies and no build step.

   The page holds no copy of the classification. Each time it loads it reads the canonical data file named
   by <body data-atlas-src> and draws everything from it: the law and substrate vocabularies and their
   order, the entries, the methods, the sources and every count. It therefore cannot differ from the file.

   The one thing written here and not in the data is PLAIN: for each law and substrate, a short line and
   a longer one in plain language. A law's short line is the data file's own, so none is written here.
   They are shown beside the data file's definition, never in place of it. All text from the data file
   is inserted as text, never as markup. */

const PLAIN = {
  law: {
    'atemporal': ['', 'The object is defined all at once, like a shape given by a formula. How a computer works it out or draws it is a separate matter.'],
    'discrete time': ['', 'Step 1, step 2, step 3: the steps can be moments in time or stages of a construction. The same start always gives the same result.'],
    'continuous time': ['', 'Time flows without gaps, as for a planet moving along its orbit. Sudden events, such as collisions, are allowed. The same start always gives the same result.'],
    'stochastic': ['', 'The rule itself rolls dice. A rule that only starts from a random state, and then runs without chance, does not count.'],
    'nondeterministic': ['', 'The rule says which next states are permitted. It does not say which one happens, or how likely each is.']
  },
  substrate: {
    'P': ['One point in a space of possibilities.', 'The whole state is a single point in an abstract space, such as the angle and velocity of a pendulum. It is not a cloud of dots in physical space.'],
    'F': ['A value at every point of space.', 'One or more quantities defined at every point of a continuous region, like the temperature across a metal plate.'],
    'L': ['Values on fixed sites.', 'Values sitting on the squares of a grid, or on the nodes of a network whose wiring never changes.'],
    'E': ['Separate individuals, each with its own state.', 'Particles, agents, cells or bodies tracked one by one, like birds in a flock or balls on a table.'],
    'R': ['The connections are the state.', 'What is linked to what: a network that grows or rewires, or a fixed web of relations studied in its own right.'],
    'S': ['Symbols: strings, trees, grammars.', 'The state is a symbolic object, such as a string of letters, a grammar or a tree of symbols.'],
    'G': ['A shape: a set, curve, surface or tiling.', 'The state is a geometric object itself, such as a set of points, a curve, a surface, a boundary or a tiling.'],
    'X': ['Two or more of these, coupled.', 'Different kinds of state carrier tied together, such as individuals moving through a field that they also change.']
  }
};

const EXAMPLE_ID = '0154';                                    // Conway's Game of Life; the first entry stands in if this id is absent
const PAGE = 60;                                              // entries drawn at a time
const PICTURE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;   // the one form a picture is drawn from

const SRC = document.body.dataset.atlasSrc || 'data/atlas.json';
const $ = (name) => document.querySelector(`[data-at="${name}"]`);
const collate = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

let DB = null;
let records = [], primary = [], methods = [], sources = [];
let byId = new Map(), methodById = new Map(), hay = new Map();
let lawOrder = [], subOrder = [];
let routeCount = new Map(), lawCount = new Map(), subCount = new Map();
let mapButtons = [], lastList = [], famKey = null, stKey = null;

const state = { law: '', sub: '', fam: '', st: '', type: '', q: '', sort: 'name', img: false, alias: false, open: '', shown: PAGE };

// ---- small helpers -------------------------------------------------------------------------------------------

// el('p', { class: 'x', text: 'words' }, child, 'more text'): every string becomes a text node, never markup
function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
  }
  return node;
}

const str = (v) => (typeof v === 'string' ? v : '');
const pretty = (v) => str(v).replace(/_/g, ' ');
const unwrap = (v) => str(v).replace(/^\s*\(/, '').replace(/\)\s*$/, '');
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const hasImage = (r) => typeof r.thumbnail === 'string' && PICTURE.test(r.thumbnail);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const routeKey = (law, sub) => `${law}\u0000${sub}`;
const setText = (name, value) => { const node = $(name); if (node) node.textContent = String(value); };

// search folding: accents, curly apostrophes and long dashes are ignored, so "henon" finds "Hénon"
const fold = (s) => s.normalize('NFD').replace(/\p{M}+/gu, '').replace(/[‘’ʼ]/g, "'").replace(/[‐-―−]/g, '-').toLowerCase();

function countBy(list, key) {
  const counts = new Map();
  for (const item of list) {
    const k = key(item);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// "Lozi map (piecewise-linear planar map)" -> { main: "Lozi map", paren: "(piecewise-linear planar map)" }
function splitName(name) {
  const s = str(name).trim();
  if (!s.endsWith(')')) return { main: s, paren: '' };
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ')') depth++;
    else if (s[i] === '(') {
      depth--;
      if (depth === 0) return i > 0 ? { main: s.slice(0, i).trim(), paren: s.slice(i) } : { main: s, paren: '' };
    }
  }
  return { main: s, paren: '' };
}

// the order the data file asks for, then anything in the vocabulary it left out, then any code the entries use
function ordered(order, vocab, used) {
  const out = [];
  const add = (code) => { if (typeof code === 'string' && code && !out.includes(code)) out.push(code); };
  if (Array.isArray(order)) order.filter((code) => Object.hasOwn(vocab, code)).forEach(add);
  Object.keys(vocab).forEach(add);
  used.forEach(add);
  return out;
}

const vocab = (kind) => (kind === 'law' ? DB.laws : DB.substrates);
function facet(kind, code) {
  const v = vocab(kind);
  return Object.hasOwn(v, code) && v[code] && typeof v[code] === 'object' ? v[code] : {};
}
const mark = (kind, code) => (kind === 'law' && str(facet(kind, code).sign)) || str(code);     // a law is shown by its sign, a carrier by its letter
function facetName(kind, code) { return str(facet(kind, code).name) || str(code); }             // "Discrete time"
function facetLabel(kind, code) { return `${mark(kind, code)} · ${facetName(kind, code)}`; }    // "Δ · Discrete time"
const route = (r) => `${mark('law', r.law)}-${str(r.substrate)}`;                               // "Δ-L": the law's sign, a hyphen, the carrier's letter
function plain(kind, code) {                                                                    // [short line, longer line]
  const [short, long] = PLAIN[kind][code] || [];
  return [short || unwrap(facet(kind, code).common), long || ''];
}

function link(text, url) {
  return isHttp(url) ? el('a', { href: url, rel: 'noopener noreferrer' }, text, ' ↗') : el('span', { text });
}

// a picture is stored as an opacity mask; the stylesheet fills it with the theme's ink color. Its tooltip names the entry.
function picture(r, size, decorative) {
  const name = splitName(r.name).main;
  return el('span', { class: `at__pic${size ? ` at__pic--${size}` : ''}`, title: name, style: `--m:url("${r.thumbnail}")`,
    role: decorative ? null : 'img', 'aria-label': decorative ? null : name, 'aria-hidden': decorative ? 'true' : null });
}

function haystack(r) {
  const parts = [r.id, r.name, r.gloss, r.condition, r.family, r.subtype, pretty(r.record_type)];
  if (Array.isArray(r.aliases)) {
    for (const a of r.aliases) if (a && typeof a === 'object') parts.push(a.name, a.relation);
  }
  return fold(parts.filter((part) => typeof part === 'string').join(' \n '));
}

// ---- loading -------------------------------------------------------------------------------------------------

async function init() {
  try {
    const res = await fetch(SRC, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    DB = await res.json();
    const ok = DB && typeof DB === 'object' && DB.laws && typeof DB.laws === 'object' && DB.substrates && typeof DB.substrates === 'object' && Array.isArray(DB.records);
    if (!ok) throw new Error('the file lacks one of its expected parts: laws, substrates, records');
  } catch (err) {
    fail(err);
    return;
  }
  prepare();
  readHash();
  build();
  syncControls();
  $('content').hidden = false;
  layWall();
  update();
}

function fail(err) {
  const box = $('error');
  box.textContent = `The data file could not be read (${err && err.message ? err.message : 'no reason given'}). This page draws everything from that file, so there is nothing to show without it.`;
  box.hidden = false;
  $('statusline').textContent = 'No data loaded';
}

function prepare() {
  records = DB.records.filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
  primary = records.filter((r) => r.primary === true);
  methods = Array.isArray(DB.methods) ? DB.methods.filter((m) => m && typeof m === 'object' && typeof m.id === 'string') : [];
  sources = Array.isArray(DB.sources) ? DB.sources : [];
  byId = new Map(records.map((r) => [r.id, r]));
  for (const r of records) if (typeof r.former_id === 'string' && !byId.has(r.former_id)) byId.set(r.former_id, r);   // an id from before the ids became numbers still finds its record
  methodById = new Map(methods.map((m) => [m.id, m]));
  hay = new Map(records.map((r) => [r, haystack(r)]));
  lawOrder = ordered(DB.law_order, DB.laws, primary.map((r) => str(r.law)));
  subOrder = ordered(DB.substrate_order, DB.substrates, primary.map((r) => str(r.substrate)));
  routeCount = countBy(primary, (r) => routeKey(r.law, r.substrate));
  lawCount = countBy(primary, (r) => r.law);
  subCount = countBy(primary, (r) => r.substrate);
}

// ---- the parts drawn once ------------------------------------------------------------------------------------

function build() {
  const withImage = primary.filter(hasImage).length;
  const withSource = primary.filter((r) => Array.isArray(r.source_refs) && r.source_refs.length > 0).length;
  $('statusline').textContent = `${plural(primary.length, 'entry', 'entries')} · ${withImage} with a picture · ${withSource} with a cited source · a working classification`;
  setText('n-laws', lawOrder.length);
  setText('n-subs', subOrder.length);
  setText('n-routes', lawOrder.length * subOrder.length);
  setText('n-img', withImage);
  setText('n-alias', records.length - primary.length);
  setText('n-sources', sources.length);
  buildGallery();
  buildExample();
  buildMap();
  buildLegend('law', lawOrder, 'legend-law', lawCount);
  buildLegend('substrate', subOrder, 'legend-sub', subCount);
  buildTypeOptions();
  buildMethods();
  buildSources();
  buildFacts(withImage, withSource);
  wire();
}

// ---- the wall: every entry as one square of a fixed size, in order of name -----------------------------------------

const wall = { list: [], cells: [], cols: 1, per: 1, wide: 0, page: 0, stop: 0 };                // stop: the square holding the wall's one tab stop
const onShow = () => Math.max(0, Math.min(wall.per, wall.list.length - wall.page * wall.per));   // squares in use on this page
const pageCount = () => Math.max(1, Math.ceil(wall.list.length / wall.per));

function buildGallery() {
  wall.list = primary.slice().sort((a, b) => collate(str(a.name), str(b.name)));
  $('wall').closest('section').hidden = wall.list.length === 0;
  document.body.append(el('i', { class: 'at__probe', 'aria-hidden': 'true' }));   // as tall as the smallest the screen gets, for measuring
}

// The squares keep one size on every screen, and the window decides how many fit. The stylesheet's --mat is the share of
// the window left free on each side: the page column becomes the widest whole number of squares that leaves it free to
// the left and right, and the wall takes the most rows that, with the arrows beneath, leave it free above and below.
function layWall() {
  if (!wall.list.length) return;
  const box = $('wall'), host = $('gallery'), column = box.closest('.page');
  const css = getComputedStyle(column);
  const px = (name) => parseFloat(css.getPropertyValue(name)) || 0;
  const gap = px('--gap'), pitch = px('--sq') + gap, free = 1 - 2 * px('--mat');
  const tall = document.querySelector('.at__probe').offsetHeight || window.innerHeight;
  const first = wall.page * wall.per;                                             // the first entry on show stays on show
  const fit = Math.max(1, Math.floor((document.documentElement.clientWidth * free + gap) / pitch));
  column.style.setProperty('--col-w', `${fit * pitch - gap}px`);
  column.style.setProperty('--col-pad', '0px');
  box.style.setProperty('--mat-v', `${Math.round(tall * px('--mat'))}px`);
  // the grid fills its column by itself, so it is never wider than the column: count the squares it put in a row
  wall.cols = getComputedStyle(host).gridTemplateColumns.split(' ').filter((track) => track.endsWith('px')).length || 1;
  wall.per = wall.cols * Math.max(1, Math.floor((tall * free - px('--btn')) / pitch));
  wall.wide = host.clientWidth;
  const want = Math.min(wall.per, wall.list.length);
  while (wall.cells.length < want) {
    const b = el('button', { type: 'button', class: 'at__tile', tabindex: '-1' }, el('span', { 'aria-hidden': 'true' }));
    wall.cells.push(b);
    host.append(el('li', null, b));
  }
  while (wall.cells.length > want) wall.cells.pop().parentNode.remove();
  paintWall(Math.floor(first / wall.per));
}

// turning a page changes the pictures; the grid stays where it is
function paintWall(page) {
  const pages = pageCount();
  wall.page = Math.min(Math.max(page, 0), pages - 1);
  wall.cells.forEach((b, i) => {
    const r = wall.list[wall.page * wall.per + i];
    const pic = b.firstChild;
    b.toggleAttribute('data-off', !r);
    b.disabled = !r;
    if (!r) {
      ['data-id', 'title', 'aria-label'].forEach((name) => b.removeAttribute(name));
      pic.className = 'at__pic at__pic--blank';
      pic.removeAttribute('style');
      return;
    }
    const name = splitName(r.name).main;
    b.dataset.id = r.id;
    b.title = name;
    b.setAttribute('aria-label', name);
    pic.className = hasImage(r) ? 'at__pic' : 'at__pic at__pic--blank';
    if (hasImage(r)) pic.style.setProperty('--m', `url("${r.thumbnail}")`);
    else pic.removeAttribute('style');
  });
  setStop(Math.min(wall.stop, onShow() - 1));
  const pager = $('pager'), dots = $('dots'), css = getComputedStyle(pager);
  pager.hidden = pages < 2;
  $('turn-back').disabled = wall.page === 0;
  $('turn-on').disabled = wall.page === pages - 1;
  // one dot for each page while they fit between the arrows; past that, as many as fit, and the lit one shows how far along
  const dot = parseFloat(css.getPropertyValue('--dot')) || 8;
  const room = Math.floor((wall.wide - 2 * (parseFloat(css.getPropertyValue('--btn')) + parseFloat(css.columnGap)) + dot) / (2 * dot));
  const shown = Math.max(1, Math.min(pages, room));
  while (dots.childElementCount < shown) dots.append(el('i'));
  while (dots.childElementCount > shown) dots.lastChild.remove();
  const lit = pages > 1 ? Math.round(wall.page / (pages - 1) * (shown - 1)) : 0;
  [...dots.children].forEach((d, i) => d.toggleAttribute('data-on', i === lit));
}

function turn(page) {
  paintWall(page);
  const from = wall.page * wall.per + 1;
  $('page-note').textContent = `Entries ${from} to ${from + onShow() - 1} of ${wall.list.length}, in order of name`;
  const back = $('turn-back'), on = $('turn-on');
  if (document.activeElement === back && back.disabled) on.focus();
  else if (document.activeElement === on && on.disabled) back.focus();
}

function setStop(i) {
  if (wall.cells[wall.stop]) wall.cells[wall.stop].tabIndex = -1;
  wall.stop = Math.max(0, i);
  if (wall.cells[wall.stop]) wall.cells[wall.stop].tabIndex = 0;
}

// one tab stop for the whole wall: the arrow keys move inside it and across its pages
function wallKey(event) {
  const i = wall.cells.indexOf(event.target);
  if (i < 0) return;
  const last = onShow() - 1, pages = pageCount();
  let to = i, page = wall.page;
  if (event.key === 'ArrowRight') { if (i < last) to = i + 1; else if (page < pages - 1) { page++; to = 0; } }
  else if (event.key === 'ArrowLeft') { if (i > 0) to = i - 1; else if (page > 0) { page--; to = wall.per - 1; } }
  else if (event.key === 'ArrowDown') { if (i + wall.cols <= last) to = i + wall.cols; }
  else if (event.key === 'ArrowUp') { if (i >= wall.cols) to = i - wall.cols; }
  else if (event.key === 'Home') to = 0;
  else if (event.key === 'End') to = last;
  else if (event.key === 'PageDown') { if (page < pages - 1) page++; }
  else if (event.key === 'PageUp') { if (page > 0) page--; }
  else return;
  event.preventDefault();
  if (page !== wall.page) turn(page);
  to = Math.min(to, onShow() - 1);
  setStop(to);
  wall.cells[to].focus();
}

function buildExample() {
  const wanted = byId.get(EXAMPLE_ID);
  const r = wanted && wanted.primary === true ? wanted : primary[0];
  const section = $('ex-name').closest('section');
  if (!r) { section.hidden = true; return; }
  setText('ex-name', str(r.name));
  setText('ex-law', facetLabel('law', r.law));
  setText('ex-law-plain', plain('law', r.law)[0]);
  setText('ex-sub', facetLabel('substrate', r.substrate));
  setText('ex-sub-plain', plain('substrate', r.substrate)[0]);
  setText('ex-fam', str(r.family));
  setText('ex-st', str(r.subtype));
  $('ex-open').addEventListener('click', () => openEntry(r.id));
}

function mapButton(kind, law, sub) {
  const b = el('button', { type: 'button', class: 'at__cell', 'aria-pressed': 'false', dataset: { kind, law: law || '', sub: sub || '' } });
  if (kind === 'cell') {
    const n = routeCount.get(routeKey(law, sub)) || 0;
    const widest = Math.max(1, ...routeCount.values());
    b.append(el('span', { text: String(n) }), el('span', { class: 'at__cell-bar', style: `width:${Math.round((100 * n) / widest)}%` }));
    b.setAttribute('aria-label', `${facetLabel('law', law)}, with ${facetLabel('substrate', sub)}: ${plural(n, 'entry', 'entries')}`);
    if (n === 0) b.disabled = true;
  } else if (kind === 'all') {
    b.classList.add('at__cell--head');
    b.append(el('b', { text: 'All' }), el('span', { class: 'at__map-total', text: String(primary.length) }));
    b.setAttribute('aria-label', `All ${plural(primary.length, 'entry', 'entries')}`);
  } else {
    const isLaw = kind === 'law';
    const facetKind = isLaw ? 'law' : 'substrate';
    const code = isLaw ? law : sub;
    const n = (isLaw ? lawCount : subCount).get(code) || 0;
    b.classList.add('at__cell--head');
    b.append(el('b', { text: mark(facetKind, code) }), el('span', { class: 'at__map-name', text: facetName(facetKind, code) }), el('span', { class: 'at__map-total', text: String(n) }));
    b.title = facetLabel(facetKind, code);
    b.setAttribute('aria-label', `${facetLabel(facetKind, code)}: ${plural(n, 'entry', 'entries')}`);
  }
  return b;
}

function buildMap() {
  const head = el('tr', null, el('td', null, mapButton('all')));
  for (const sub of subOrder) head.append(el('th', { scope: 'col' }, mapButton('sub', '', sub)));
  const body = el('tbody');
  for (const law of lawOrder) {
    const row = el('tr', null, el('th', { scope: 'row' }, mapButton('law', law, '')));
    for (const sub of subOrder) row.append(el('td', null, mapButton('cell', law, sub)));
    body.append(row);
  }
  const table = el('table', { class: 'at__map' },
    el('caption', { class: 'visually-hidden', text: 'Number of entries on each route. Rows are law architectures and columns are substrates.' }),
    el('thead', null, head), body);
  $('map').replaceChildren(table);
  mapButtons = [...table.querySelectorAll('button')];
}

function buildLegend(kind, order, hostName, counts) {
  $(hostName).replaceChildren(...order.map((code) => {
    const [short, long] = plain(kind, code);
    const definition = str(facet(kind, code).definition);
    return el('details', { class: 'at__term' },
      el('summary', null,
        el('span', { class: 'at__term-code', text: mark(kind, code) }),
        el('span', { class: 'at__term-name', text: facetName(kind, code) }),
        el('span', { class: 'at__term-plain', text: short })),
      el('div', { class: 'at__term-body' },
        long ? el('p', { text: long }) : null,
        definition ? el('p', null, el('span', { class: 'at__src', text: 'Definition in the data file' }), definition) : null,
        el('p', { text: `${plural(counts.get(code) || 0, 'entry', 'entries')}.` })));
  }));
}

function buildTypeOptions() {
  const select = $('type');
  const pool = listed();
  const counts = countBy(pool, (r) => str(r.record_type));
  const options = [el('option', { value: '', text: `All kinds (${pool.length})` })];
  for (const [kind, n] of [...counts].sort((a, b) => collate(pretty(a[0]), pretty(b[0])))) {
    options.push(el('option', { value: kind, text: `${pretty(kind)} (${n})` }));
  }
  select.replaceChildren(...options);
  if (state.type && !counts.has(state.type)) state.type = '';
  select.value = state.type;
}

function buildMethods() {
  const host = $('methods');
  host.closest('section').hidden = methods.length === 0;
  host.replaceChildren(...[...methods].sort((a, b) => collate(str(a.name), str(b.name))).map((m) => entryItem(m, true)));
}

function buildSources() {
  const host = $('sources');
  host.closest('details').hidden = sources.length === 0;
  host.replaceChildren(...sources.map((s, i) => el('li', null,
    el('span', { class: 'at__srcnum', text: `[${i}]` }),
    Array.isArray(s)
      ? el('span', null, link(str(s[0]) || str(s[1]), s[1]), str(s[2]) ? el('small', { text: s[2] }) : null)
      : el('span', { text: JSON.stringify(s) }))));
}

function buildFacts(withImage, withSource) {
  const head = (text) => el('tr', { class: 'at__facts-head' }, el('th', { colspan: 2, scope: 'colgroup', text }));
  const row = (label, value) => el('tr', null, el('th', { scope: 'row', text: label }), el('td', { text: String(value) }));
  const byCount = (counts) => [...counts].sort((a, b) => b[1] - a[1] || collate(a[0], b[0]));
  const rows = [
    head('What the data file holds'),
    row('Kinds of rule (law architectures)', lawOrder.length),
    row('Kinds of state carrier (substrates)', subOrder.length),
    row('Routes that hold at least one entry', `${routeCount.size} of ${lawOrder.length * subOrder.length}`),
    row('Mechanism families', new Set(primary.map((r) => str(r.family))).size),
    row('Subtypes (groups inside the families)', new Set(primary.map((r) => routeKey(str(r.family), str(r.subtype)))).size),
    row('Entries', primary.length),
    row('Alias redirects (an old id or alternate name that points at an entry)', records.length - primary.length),
    row('Auxiliary methods', methods.length),
    row('References', sources.length),
    row('References that at least one entry cites', new Set(primary.flatMap((r) => (Array.isArray(r.source_refs) ? r.source_refs : []))).size),
    head('How far the review has come'),
    row('Entries with a picture', withImage),
    row('Entries that cite at least one reference', withSource)
  ];
  for (const [status, n] of byCount(countBy(primary, (r) => str(r.scope_status)))) rows.push(row(`Entry status: ${pretty(status) || 'not stated'}`, n));
  for (const [status, n] of byCount(countBy(primary, (r) => str(r.thumbnail_status)))) rows.push(row(`Picture status: ${pretty(status) || 'not stated'}`, n));
  if (str(DB.edition)) rows.push(head('Edition label stored in the data file'), el('tr', null, el('th', { colspan: 2, text: DB.edition })));
  $('facts').replaceChildren(el('tbody', null, rows));
}

// ---- the state and what follows from it ----------------------------------------------------------------------

function listed() { return state.alias ? records : primary; }
function onRoute(r) { return (!state.law || r.law === state.law) && (!state.sub || r.substrate === state.sub); }

// the subtype chips belong to one family: the chosen one, or the only one in the selection
function familyScope(base) {
  if (state.fam) return base.filter((r) => r.family === state.fam);
  return new Set(base.map((r) => r.family)).size === 1 ? base : [];
}

function normalize() {
  const base = listed().filter(onRoute);
  if (state.fam && !base.some((r) => r.family === state.fam)) state.fam = '';
  if (state.st && !familyScope(base).some((r) => r.subtype === state.st)) state.st = '';
}

function filtered() {
  const tokens = fold(state.q).split(/\s+/).filter(Boolean);
  const out = listed().filter((r) => onRoute(r)
    && (!state.fam || r.family === state.fam)
    && (!state.st || r.subtype === state.st)
    && (!state.type || r.record_type === state.type)
    && (!state.img || hasImage(r))
    && tokens.every((token) => hay.get(r).includes(token)));
  const byName = (a, b) => collate(str(a.name), str(b.name));
  const byAddress = (a, b) => (lawOrder.indexOf(a.law) - lawOrder.indexOf(b.law))
    || (subOrder.indexOf(a.substrate) - subOrder.indexOf(b.substrate))
    || collate(str(a.family), str(b.family)) || collate(str(a.subtype), str(b.subtype)) || byName(a, b);
  return out.sort(state.sort === 'address' ? byAddress : byName);
}

function change(patch) {
  Object.assign(state, { open: '', shown: PAGE }, patch);
  update();
}

function update() {
  normalize();
  paintMap();
  renderSelection();
  renderCrumbs();
  renderChips();
  renderEntries();
  writeHash();
}

function syncControls() {
  $('q').value = state.q;
  $('type').value = state.type;
  $('sort').value = state.sort;
  $('img').checked = state.img;
  $('alias').checked = state.alias;
}

function wire() {
  $('map').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-kind]');
    if (!b) return;
    const { kind, law, sub } = b.dataset;
    if (kind === 'all') change({ law: '', sub: '', fam: '', st: '' });
    else if (kind === 'law') change({ law: state.law === law ? '' : law, fam: '', st: '' });
    else if (kind === 'sub') change({ sub: state.sub === sub ? '' : sub, fam: '', st: '' });
    else if (state.law === law && state.sub === sub) change({ law: '', sub: '', fam: '', st: '' });
    else change({ law, sub, fam: '', st: '' });
  });
  let timer = 0;
  $('q').addEventListener('input', (event) => {
    const value = event.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => change({ q: value }), 140);
  });
  $('type').addEventListener('change', (event) => change({ type: event.target.value }));
  $('sort').addEventListener('change', (event) => change({ sort: event.target.value === 'address' ? 'address' : 'name' }));
  $('img').addEventListener('change', (event) => change({ img: event.target.checked }));
  $('alias').addEventListener('change', (event) => { state.alias = event.target.checked; buildTypeOptions(); change({}); });
  $('fam-chips').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-value]');
    if (b) change({ fam: state.fam === b.dataset.value ? '' : b.dataset.value, st: '' });
  });
  $('st-chips').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-value]');
    if (b) change({ st: state.st === b.dataset.value ? '' : b.dataset.value });
  });
  window.addEventListener('hashchange', () => { readHash(); buildTypeOptions(); syncControls(); update(); });
  const squares = $('gallery');
  squares.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-id]');
    if (b) openEntry(b.dataset.id);
  });
  squares.addEventListener('focusin', (event) => {
    const i = wall.cells.indexOf(event.target);
    if (i >= 0) setStop(i);
  });
  squares.addEventListener('keydown', wallKey);
  $('turn-back').addEventListener('click', () => turn(wall.page - 1));
  $('turn-on').addEventListener('click', () => turn(wall.page + 1));
  let frame = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layWall); });
}

// the selection lives in the address bar, so a view can be bookmarked or sent to someone
function writeHash() {
  const params = new URLSearchParams();
  for (const key of ['law', 'sub', 'fam', 'st', 'type']) if (state[key]) params.set(key, state[key]);
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.sort !== 'name') params.set('sort', state.sort);
  if (state.img) params.set('img', '1');
  if (state.alias) params.set('alias', '1');
  if (state.open) params.set('open', state.open);
  const text = params.toString();
  history.replaceState(null, '', text ? `#${text}` : location.pathname + location.search);
}

function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const get = (key) => params.get(key) || '';
  state.law = lawOrder.includes(get('law')) ? get('law') : '';
  state.sub = subOrder.includes(get('sub')) ? get('sub') : '';
  state.fam = get('fam');
  state.st = get('st');
  state.type = get('type');
  state.q = get('q').slice(0, 200);
  state.sort = get('sort') === 'address' ? 'address' : 'name';
  state.img = get('img') === '1';
  state.alias = get('alias') === '1';
  state.open = byId.has(get('open')) ? byId.get(get('open')).id : '';
  state.shown = PAGE;
}

// ---- the map and the selection ---------------------------------------------------------------------------------

function paintMap() {
  for (const b of mapButtons) {
    const { kind, law, sub } = b.dataset;
    let pressed = false;
    let inLine = false;
    if (kind === 'all') pressed = !state.law && !state.sub;
    else if (kind === 'law') pressed = state.law === law;
    else if (kind === 'sub') pressed = state.sub === sub;
    else {
      pressed = state.law === law && state.sub === sub;
      inLine = !pressed && ((state.law === law && !state.sub) || (state.sub === sub && !state.law));
    }
    b.setAttribute('aria-pressed', String(pressed));
    b.classList.toggle('is-in', inLine);
  }
}

function gotoEntries() {
  const heading = document.getElementById('at-h-entries');
  heading.scrollIntoView({ block: 'start' });
  heading.focus({ preventScroll: true });
}

function renderSelection() {
  const kids = [];
  if (!state.law && !state.sub) {
    kids.push(el('p', { text: 'Nothing is selected: the list below holds every entry.' }));
  } else {
    const base = primary.filter(onRoute);
    const names = [];
    const essence = [];
    if (state.law) { names.push(facetLabel('law', state.law)); essence.push(plain('law', state.law)[0]); }
    if (state.sub) { names.push(facetLabel('substrate', state.sub)); essence.push(plain('substrate', state.sub)[0]); }
    kids.push(el('p', null, el('b', { text: names.join('  ×  ') }), `: ${plural(base.length, 'entry', 'entries')}.`));
    if (essence.some(Boolean)) kids.push(el('p', { text: essence.filter(Boolean).join(' ') }));
    if (state.law && state.sub && base.length) {
      const families = [...countBy(base, (r) => str(r.family))].sort((a, b) => collate(a[0], b[0]));
      kids.push(el('p', null,
        families.length === 1 ? 'Mechanism family on this route: ' : 'Mechanism families on this route: ',
        families.map(([family, n], i) => [i ? '; ' : '', el('b', { text: family }), ` (${n})`]).flat(), '.'));
    }
    if (base.length) kids.push(el('p', null, el('button', { type: 'button', class: 'at__btn', text: 'See these entries', onclick: gotoEntries })));
  }
  $('selection').replaceChildren(...kids);
}

// ---- the filters above the list --------------------------------------------------------------------------------

function renderCrumbs() {
  const items = [];
  const drop = (patch) => { change(patch); syncControls(); $('count').focus(); };
  const add = (label, patch) => items.push(el('button', { type: 'button', class: 'at__chip at__crumb', title: 'Remove this filter', onclick: () => drop(patch) },
    label, el('span', { 'aria-hidden': 'true', text: ' ✕' }), el('span', { class: 'visually-hidden', text: ' (remove this filter)' })));
  if (state.law) add(`Law: ${facetLabel('law', state.law)}`, { law: '', fam: '', st: '' });
  if (state.sub) add(`Substrate: ${facetLabel('substrate', state.sub)}`, { sub: '', fam: '', st: '' });
  if (state.fam) add(`Family: ${state.fam}`, { fam: '', st: '' });
  if (state.st) add(`Subtype: ${state.st}`, { st: '' });
  if (state.type) add(`Kind: ${pretty(state.type)}`, { type: '' });
  if (state.img) add('With a picture', { img: false });
  if (state.q.trim()) add(`Search: ${state.q.trim()}`, { q: '' });
  if (items.length > 1) {
    items.push(el('button', { type: 'button', class: 'at__chip', onclick: () => drop({ law: '', sub: '', fam: '', st: '', type: '', img: false, q: '' }) }, 'Clear all'));
  }
  $('crumbs').replaceChildren(...items);
}

function chipButtons(counts) {
  return [...counts].sort((a, b) => collate(a[0], b[0])).map(([name, n]) =>
    el('button', { type: 'button', class: 'at__chip', 'aria-pressed': 'false', dataset: { value: name } }, name, el('i', { text: String(n) })));
}

function paintChips(hostName, value) {
  for (const b of $(hostName).children) b.setAttribute('aria-pressed', String(b.dataset.value === value));
}

// the chips are rebuilt only when the set of choices changes, so a chip keeps the focus when it is pressed
function renderChips() {
  const base = listed().filter(onRoute);
  const families = countBy(base, (r) => str(r.family));
  const showFamilies = (Boolean(state.law || state.sub) && families.size > 1) || Boolean(state.fam);
  const fk = showFamilies ? `${state.alias}|${state.law}|${state.sub}` : '';
  if (fk !== famKey) { famKey = fk; $('fam-chips').replaceChildren(...(showFamilies ? chipButtons(families) : [])); }
  $('fam-row').hidden = !showFamilies;
  paintChips('fam-chips', state.fam);

  const subtypes = countBy(familyScope(base), (r) => str(r.subtype));
  const showSubtypes = subtypes.size > 1 || Boolean(state.st);
  const sk = showSubtypes ? `${state.alias}|${state.law}|${state.sub}|${state.fam}` : '';
  if (sk !== stKey) { stKey = sk; $('st-chips').replaceChildren(...(showSubtypes ? chipButtons(subtypes) : [])); }
  $('st-row').hidden = !showSubtypes;
  paintChips('st-chips', state.st);
}

// ---- the list --------------------------------------------------------------------------------------------------

function countText(total, shown) {
  const pool = listed().length;
  const noun = state.alias ? 'entries and alias redirects' : 'entries';
  if (total === 0) return 'Nothing matches. Remove a filter or change the search.';
  const what = total === pool ? `All ${pool} ${noun}` : `${total} of ${pool} ${noun}`;
  return shown < total ? `${what} · the first ${shown} shown` : what;
}

function renderMore(total, shown) {
  const kids = [];
  if (shown < total) {
    kids.push(el('button', { type: 'button', class: 'at__btn', text: `Show ${Math.min(PAGE, total - shown)} more`, onclick: () => showMore(false) }));
    if (total - shown > PAGE) kids.push(el('button', { type: 'button', class: 'at__btn', text: `Show all ${total}`, onclick: () => showMore(true) }));
  }
  $('more').replaceChildren(...kids);
}

function renderEntries() {
  lastList = filtered();
  if (state.open) {                                        // the open entry must be among those drawn
    const at = lastList.findIndex((r) => r.id === state.open);
    if (at < 0) state.open = '';
    else if (at >= state.shown) state.shown = Math.ceil((at + 1) / PAGE) * PAGE;
  }
  const host = $('entries');
  const shown = Math.min(state.shown, lastList.length);
  host.replaceChildren(...lastList.slice(0, shown).map((r) => entryItem(r, false)));
  renderMore(lastList.length, shown);
  $('count').textContent = countText(lastList.length, shown);
  $('live').textContent = lastList.length ? `${lastList.length} listed.` : 'Nothing matches.';
  if (state.open) openInList(state.open);
}

function showMore(all) {
  const host = $('entries');
  const from = host.children.length;
  state.shown = all ? lastList.length : state.shown + PAGE;
  const shown = Math.min(state.shown, lastList.length);
  const added = lastList.slice(from, shown).map((r) => entryItem(r, false));
  host.append(...added);
  renderMore(lastList.length, shown);
  $('count').textContent = countText(lastList.length, shown);
  if (added[0]) added[0].querySelector('summary').focus();
}

function entryItem(r, isMethod) {
  const { main, paren } = splitName(r.name);
  const where = isMethod
    ? pretty(r.record_type)
    : `${r.primary === true ? '' : 'Alias redirect · '}${route(r)} · ${str(r.family)}`;
  const body = el('div', { class: 'at__record' });
  const details = el('details', { class: 'at__entry', id: `${isMethod ? 'm-' : 'e-'}${r.id}` },
    el('summary', null,
      el('span', { class: 'at__entry-text' },
        el('span', { class: 'at__entry-name' }, el('b', { text: main }), paren ? ` ${paren}` : ''),
        el('span', { class: 'at__entry-gloss', text: str(r.gloss) }),
        el('span', { class: 'at__entry-addr', text: where })),
      hasImage(r) ? picture(r, 's', true) : null),
    body);
  details.addEventListener('toggle', () => {
    if (details.open && body.childElementCount === 0) body.append(...recordBody(r, isMethod));
    if (isMethod) return;
    if (details.open) state.open = r.id;                   // the entry opened last is kept in the address bar,
    else if (state.open === r.id) state.open = '';         // so a link to it can be copied
    writeHash();
  });
  return el('li', null, details);
}

// opening an entry from a picture or a link clears the filters, so that the entry is found in the full list;
// the view left behind is kept as a history entry, so the browser's Back button returns to it
function openEntry(id) {
  const r = byId.get(id);
  if (!r) return;
  history.pushState(null, '', location.href);
  Object.assign(state, { law: '', sub: '', fam: '', st: '', type: '', img: false, q: '', open: r.id, shown: PAGE });
  if (r.primary !== true) state.alias = true;
  buildTypeOptions();
  syncControls();
  update();
}

function openInList(id) { reveal(document.getElementById(`e-${id}`)); }
function openMethod(id) { reveal(document.getElementById(`m-${id}`)); }
function reveal(details) {
  if (!details) return;
  details.open = true;
  details.scrollIntoView({ block: 'start' });
  details.querySelector('summary').focus({ preventScroll: true });
}

// ---- one entry, opened -----------------------------------------------------------------------------------------

// each part of an opened entry's address is a link: it lists every entry that shares that part, and Back returns
function partLink(text, patch) {
  return el('button', { type: 'button', class: 'at__link', text, onclick: () => {
    history.pushState(null, '', location.href);
    change({ q: '', type: '', img: false, fam: '', st: '', ...patch });
    syncControls();
    gotoEntries();
  } });
}

function facetNodes(kind, code) {
  const short = plain(kind, code)[0];
  const patch = kind === 'law' ? { law: code, sub: '' } : { law: '', sub: code };
  return [el('b', null, partLink(facetLabel(kind, code), patch)), short ? el('small', { text: short }) : null];
}

// a small map of every route with this entry's own square filled, so where it sits is seen at a glance
function locator(r) {
  const squares = [];
  for (const law of lawOrder) for (const sub of subOrder) squares.push(el('i', { 'data-here': law === r.law && sub === r.substrate }));
  return el('span', { class: 'at__locator', role: 'img', style: `--n:${subOrder.length}`,
    'aria-label': `${facetName('law', r.law)} is row ${lawOrder.indexOf(r.law) + 1} of ${lawOrder.length}; ${facetName('substrate', r.substrate)} is column ${subOrder.indexOf(r.substrate) + 1} of ${subOrder.length}` }, squares);
}

function imageNodes(r) {
  if (!hasImage(r)) return [str(r.thumbnail_status) ? `None yet (${pretty(r.thumbnail_status)}).` : 'None yet.'];
  return [el('figure', { class: 'at__figure' },
    picture(r, 'l', false),
    el('figcaption', null,
      str(r.thumbnail_basis) ? el('p', { text: r.thumbnail_basis }) : null,
      str(r.thumbnail_renderer) ? el('p', null, 'Renderer: ', el('code', { text: r.thumbnail_renderer })) : null,
      isHttp(r.thumbnail_source_url) ? el('p', null, 'Reference for the picture: ', link(r.thumbnail_source_url, r.thumbnail_source_url)) : null))];
}

function sourceNodes(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  return [el('ul', null, refs.map((i) => {
    const s = Number.isInteger(i) ? sources[i] : undefined;
    if (!Array.isArray(s)) return el('li', { text: `Reference ${String(i)} is not in the data file's list.` });
    return el('li', null, `[${i}] `, link(str(s[0]) || str(s[1]), s[1]), str(s[2]) ? el('small', { text: s[2] }) : null);
  }))];
}

function refNodes(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === 'string' && id);
  if (list.length === 0) return [];
  return [el('ul', null, list.map((id) => {
    const r = byId.get(id);
    const m = methodById.get(id);
    if (r) return el('li', null, el('button', { type: 'button', class: 'at__link', text: str(r.name), onclick: () => openEntry(id) }), ' ', el('code', { text: id }));
    if (m) return el('li', null, el('button', { type: 'button', class: 'at__link', text: str(m.name), onclick: () => openMethod(id) }), ' ', el('code', { text: id }), ' (an auxiliary method)');
    return el('li', null, el('code', { text: id }), ' (not found in the data file)');
  }))];
}

function aliasNodes(aliases) {
  if (!Array.isArray(aliases) || aliases.length === 0) return [];
  return [el('ul', null, aliases.map((a) => {
    if (!a || typeof a !== 'object') return el('li', { text: String(a) });
    return el('li', null, str(a.name) || JSON.stringify(a),
      str(a.relation) ? el('small', { text: a.relation }) : null,
      str(a.note) ? el('small', { text: a.note }) : null);
  }))];
}

function rawValue(key, value) {
  if (key === 'thumbnail' && typeof value === 'string') return `(image data, ${value.length} characters)`;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function rawDetails(r) {
  const body = el('tbody');
  for (const [key, value] of Object.entries(r)) {
    body.append(el('tr', null, el('th', { scope: 'row', text: key }), el('td', { text: rawValue(key, value) })));
  }
  return el('details', { class: 'at__raw' }, el('summary', { text: 'Every stored field, exactly as in the data file' }), el('table', null, body));
}

function recordBody(r, isMethod) {
  const dl = el('dl', { class: 'at__dl' });
  const row = (label, ...value) => {
    const kids = value.flat().filter((v) => v !== '' && v !== null && v !== undefined && v !== false);
    if (kids.length) dl.append(el('dt', { text: label }), el('dd', null, kids));
  };
  if (isMethod) {
    row('Group', [str(r.family), str(r.subtype)].filter(Boolean).join(' · '));
  } else {
    const here = { law: r.law, sub: r.substrate };
    row('Route', el('span', { class: 'at__route' }, locator(r), partLink(route(r), here)));
    row('1 · Law architecture', facetNodes('law', r.law));
    row('2 · Substrate', facetNodes('substrate', r.substrate));
    row('3 · Mechanism family', str(r.family) ? partLink(r.family, { ...here, fam: r.family }) : '');
    row('4 · Subtype', str(r.subtype) ? partLink(r.subtype, { ...here, fam: r.family, st: r.subtype }) : '');
  }
  row(isMethod ? 'Kind of method' : 'Kind of entry', pretty(r.record_type));
  row(isMethod ? 'Exactly what this is' : 'Exactly what is classified', str(r.condition));
  row('Time structure', str(r.temporal));
  row('Where chance enters', str(r.randomness_source));
  row('Note on the starting state', str(r.initialization_note));
  row('Entry status', pretty(r.scope_status));
  if (!isMethod) row('Picture', imageNodes(r));
  row('References', sourceNodes(r.source_refs));
  row('Related entries', refNodes(r.related_to));
  row('Parent model', refNodes(r.parent_model));
  row('Contains or generalizes', refNodes(r.contains_or_generalizes));
  if (r.canonical_id && r.canonical_id !== r.id) row('Canonical entry', refNodes(r.canonical_id));
  row('Relation note', str(r.relation_note));
  row('Also known as', aliasNodes(r.aliases));
  row('Record id', el('code', { text: r.id }));
  row('Former id', r.former_id ? el('code', { text: r.former_id }) : '');
  return [dl, rawDetails(r)];
}

init();
