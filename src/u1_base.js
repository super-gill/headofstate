// ===================== UI BASE: state, helpers, modal, toast, map painting =====================
const E = Engine;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE_KEY = 'hos.v3';
const THEME_KEY = 'hos.theme';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};

const UI = {
  mode: 'setup', tab: 'home', sel: null, mapMode: 'rel', blocSel: 'NATO',
  setup: { iso: 'GBR', gov: null, leader: '', diff: 1, temper: 1, term: true, q: '', scenario: 'standard', ambition: 'auto' },
  modalOpen: false, modalDismiss: true, overOpen: false,
};
const S = () => E.S;

// ---------- number formats ----------
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const f0 = v => String(Math.round(v));
const sgn = (v, d) => (v >= 0 ? '+' : '') + (d === 0 ? f0(v) : f1(v));
function tensionWord(t) { return t < 25 ? 'Calm' : t < 45 ? 'Uneasy' : t < 65 ? 'Tense' : t < 85 ? 'Dangerous' : 'On the brink'; }
function scoreWord(sc) { return sc > 60 ? 'Decisively winning' : sc > 25 ? 'Winning' : sc > 8 ? 'Slight edge' : sc >= -8 ? 'Stalemate' : sc >= -25 ? 'Slipping' : sc >= -60 ? 'Losing' : 'Facing defeat'; }
const cls = v => v >= 0 ? 'good' : 'bad';

// ---------- theme ----------
function applyTheme(t) {
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
}
function cycleTheme() {
  const cur = store.get(THEME_KEY) || 'auto'; const nx = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
  store.set(THEME_KEY, nx); applyTheme(nx); return nx;
}

// ---------- modal ----------
function openModal(html, o) {
  o = o || {};
  if (typeof hideMonthly === 'function') hideMonthly();   // don't leave the month-end report floating behind another modal
  const root = $('#overlay'); UI.modalOpen = true; UI.modalDismiss = o.dismiss !== false;
  root.innerHTML = '<div class="overlay" data-ov="1"><div class="modal" role="dialog" aria-modal="true" style="' + (o.width ? 'width:min(' + o.width + 'px,100%)' : '') + '">' + html + '</div></div>';
  root.hidden = false;
  const m = $('.modal', root); if (m) { m.scrollTop = 0; const f = $('[data-focus]', m) || $('button:not(:disabled)', m); if (f && o.focus !== false) try { f.focus({ preventScroll: true }); } catch (e) { } }
}
function closeModal() { const root = $('#overlay'); root.innerHTML = ''; root.hidden = true; UI.modalOpen = false; UI.overOpen = false; }
function chipsHtml(chips) {
  if (!chips || !chips.length) return '';
  return '<div class="chipline">' + chips.map(c => '<span class="chip ' + (c.good ? 'good' : 'bad') + '">' + esc(c.label) + ' ' + esc(c.text) + '</span>').join('') + '</div>';
}

// ---------- toasts ----------
function toast(text, kind, chips) {
  const box = $('#toasts'); if (!box) return;
  const d = document.createElement('div'); d.className = 'toast' + (kind === 'bad' ? ' bad' : '');
  d.innerHTML = esc(text) + (chips && chips.length ? '<div class="chips" style="margin-top:6px">' + chips.map(c => '<span class="chip ' + (c.good ? 'good' : 'bad') + '">' + esc(c.label) + ' ' + esc(c.text) + '</span>').join('') + '</div>' : '');
  box.appendChild(d);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  const kill = () => { if (d.parentNode) d.parentNode.removeChild(d); };
  d.addEventListener('click', kill);
  setTimeout(kill, 4200 + Math.min(4000, text.length * 35));
}

// ---------- persistence ----------
// ---------- saves: an autosave, an earlier autosave and three manual slots ----------
const PREV_KEY = 'hos.v3.prev', SLOT_KEYS = ['hos.slot.1', 'hos.slot.2', 'hos.slot.3'];
const metaKey = k => 'hos.meta.' + k;
function saveMeta() { const c = E.me(), s = S(); return { name: c.name, leader: s.leader || '', date: E.dateLabel(), turn: s.turn, at: Date.now() }; }
function putSave(key, raw, meta) {
  const ok = store.set(key, raw); if (ok) store.set(metaKey(key), JSON.stringify(meta));
  return ok;
}
let saveWarned = false;
function save() {
  if (!S() || S().over) return;
  const raw = E.serialize(), meta = saveMeta();
  // every six months the autosave being replaced is kept as an earlier restore point
  if (S().turn % 6 === 0) { const old = store.get(SAVE_KEY); if (old) { store.set(PREV_KEY, old); const m = store.get(metaKey(SAVE_KEY)); if (m) store.set(metaKey(PREV_KEY), m); } }
  if (!putSave(SAVE_KEY, raw, meta) && !saveWarned) { saveWarned = true; if (typeof toast === 'function') toast('Browser storage is full or blocked, so autosave is failing. Use Menu, then Export, to keep a copy of your game.', 'bad'); }
}
function clearSave() { store.del(SAVE_KEY); store.del(metaKey(SAVE_KEY)); }
function readMeta(key) { try { return JSON.parse(store.get(metaKey(key)) || 'null'); } catch (e) { return null; } }
function saveRows() {
  const rows = [];
  rows.push({ key: SAVE_KEY, label: 'Autosave', auto: true }); rows.push({ key: PREV_KEY, label: 'Earlier autosave', auto: true });
  SLOT_KEYS.forEach((k, i) => rows.push({ key: k, label: 'Slot ' + (i + 1), auto: false }));
  return rows.map(r => Object.assign(r, { has: !!store.get(r.key), meta: readMeta(r.key) }));
}

// ---------- map colours ----------
const GOVCOL = { D: '#3f88c5', H: '#9bb86b', M: '#d9a441', O: '#d1493f', J: '#7a6a58', T: '#8a5fb5', P: '#d97b4a' };
const BLOCCOL = { NATO: '#3f88c5', EU: '#2f6fdb', CSTO: '#c2463c', SCO: '#d18a2c', BRICS: '#c9a227', ASEAN: '#2a9d8f', AU: '#5f9c3f', ARAB: '#8a5fb5', GCC: '#b4568a', MERCOSUR: '#3f9c7a', AUKUS: '#4c62c9' };
const mix = (a, b, p) => 'color-mix(in srgb, ' + a + ' ' + Math.max(0, Math.min(100, Math.round(p))) + '%, ' + b + ')';
function ownerIso(id) { return E.ownerOf(id); }
function heatOf(iso) {
  const s = S(); if (E.atWar(iso)) return 1;
  let h = 0; s.rivals.forEach(r => { if (r.a === iso || r.b === iso) { const o = r.a === iso ? r.b : r.a; if (!E.alive(o)) return; h += r.n * (E.R(iso, o) < -25 ? 0.22 : 0.09); } });
  if (E.C(iso).stab < 25) h += 0.15;
  return Math.min(0.9, h);
}
function fillFor(id) {
  const s = S();
  if (!s) { return GOVCOL[E.ROW[id] ? E.ROW[id].gov : 'D']; }
  if (UI.mode === 'setup') return id === UI.setup.iso ? 'var(--accent)' : GOVCOL[E.ROW[id].gov];
  const o = ownerIso(id), c = E.C(o); if (!c) return 'var(--land)';
  const me = s.player;
  switch (UI.mapMode) {
    case 'rel': {
      if (o === me) return 'var(--you)';
      if (E.warBetween(me, o)) return 'var(--war)';
      const v = E.R(me, o); return v >= 0 ? mix('var(--rel-pos)', 'var(--rel-mid)', v * 0.95) : mix('var(--rel-neg)', 'var(--rel-mid)', -v * 0.95);
    }
    case 'bloc': {
      const bl = s.blocs[UI.blocSel];
      if (bl && bl.members.includes(o)) return o === me ? 'var(--you)' : (BLOCCOL[UI.blocSel] || 'var(--info)');
      return o === me ? 'var(--you)' : mix('var(--land)', 'var(--sea)', 100);
    }
    case 'gov': return o === me ? 'var(--you)' : GOVCOL[c.gov];
    case 'eco': { const pc = c.gdp * 1000 / c.pop; const t = (Math.log10(Math.max(300, pc)) - 2.9) / 1.85; return mix('var(--seq-hi)', 'var(--seq-lo)', t * 100); }
    case 'mil': { const t = Math.log10(E.power(c) + 1) / 2.5; return mix('var(--mil-hi)', 'var(--mil-lo)', t * 100); }
    case 'ten': return mix('var(--mil-hi)', 'var(--mil-lo)', heatOf(o) * 100);
  }
  return 'var(--land)';
}
function paintMap() { MapView.paint(fillFor); }

function overlayLines() {
  const s = S(), lines = [], hots = new Set(); if (!s) return { lines, hots: [] };
  s.wars.forEach(w => {
    const seen = new Set();
    const add = (x, y) => { const k = x + y; if (seen.has(k)) return; seen.add(k); lines.push({ a: x, b: y, cls: 'warline', bend: 0.18 }); };
    add(w.lead.a, w.lead.b);
    w.a.forEach(x => { if (x !== w.lead.a) add(x, w.lead.b); });
    w.b.forEach(x => { if (x !== w.lead.b) add(x, w.lead.a); });
    w.a.concat(w.b).forEach(x => hots.add(x));
  });
  if (UI.mapMode === 'rel' || UI.mapMode === 'bloc') {
    s.pacts.forEach(p => { if (p[0] === s.player || p[1] === s.player) lines.push({ a: p[0], b: p[1], cls: 'pactline', bend: 0.25 }); });
  }
  if (UI.mapMode === 'ten') {
    s.rivals.forEach(r => { if (r.n >= 2 && E.alive(r.a) && E.alive(r.b) && E.R(r.a, r.b) < -30 && !E.warBetween(r.a, r.b)) lines.push({ a: r.a, b: r.b, cls: 'tenline', bend: 0.2 }); });
  }
  return { lines, hots: [...hots] };
}

function mapTip(id) {
  const s = S();
  if (UI.mode === 'setup' || !s) { const r = E.ROW[id]; if (!r) return ''; return '<b>' + esc(r.name) + '</b><span class="muted">' + esc(E.GOV[r.gov].name) + '</span><div class="muted">Pop ' + esc(E.popStr(r.pop)) + ', GDP ' + esc(E.money(r.gdp)) + '</div>'; }
  const o = ownerIso(id), c = E.C(o); if (!c) return '';
  let h = '<b>' + esc(E.nm(id)) + '</b>';
  if (o !== id) h += '<div class="muted">Annexed by ' + esc(c.name) + '</div>';
  h += '<span class="muted">' + esc(E.GOV[c.gov].name) + '</span>';
  h += '<div class="muted">Pop ' + esc(E.popStr(c.pop)) + ', GDP ' + esc(E.money(c.gdp)) + '</div>';
  if (o === s.player) h += '<div class="warn">Your country</div>';
  else {
    const v = E.R(s.player, o);
    h += '<div>' + esc(E.relWord(v)) + ' <span class="mono faint">' + sgn(v, 0) + '</span></div>';
    if (E.warBetween(s.player, o)) h += '<div class="bad">At war with you</div>';
  }
  if (E.atWar(o) && !E.warBetween(s.player, o)) h += '<div class="bad">In a war</div>';
  if (c.nukes) h += '<div class="faint">Nuclear-armed</div>';
  return h;
}

function legendHtml() {
  if (UI.mode === 'setup') return '<div class="row">' + Object.keys(GOVCOL).map(k => '<span class="sw"><i style="background:' + GOVCOL[k] + '"></i>' + esc(E.GOV[k].name) + '</span>').join('') + '</div>';
  const g = (a, b, l1, l2) => '<div class="row"><span class="faint">' + l1 + '</span><span class="grad" style="background:linear-gradient(90deg,' + a + ',' + b + ')"></span><span class="faint">' + l2 + '</span></div>';
  switch (UI.mapMode) {
    case 'rel': return '<div class="row"><span class="faint">Hostile</span><span class="grad" style="background:linear-gradient(90deg,var(--rel-neg),var(--rel-mid),var(--rel-pos))"></span><span class="faint">Allied</span><span class="sw"><i style="background:var(--you)"></i>You</span><span class="sw"><i style="background:var(--war)"></i>At war</span></div>';
    case 'bloc': {
      const list = Object.keys(S().blocs);
      return '<div class="row">' + list.map(k => '<button class="btn sm ' + (k === UI.blocSel ? 'primary' : 'ghost') + '" data-act="bloc" data-id="' + esc(k) + '" style="padding:2px 8px">' + esc(k) + '</button>').join('') + '</div><div class="faint" style="margin-top:4px">' + esc(S().blocs[UI.blocSel].name) + ', ' + S().blocs[UI.blocSel].members.length + ' members</div>';
    }
    case 'gov': return '<div class="row">' + Object.keys(GOVCOL).map(k => '<span class="sw"><i style="background:' + GOVCOL[k] + '"></i>' + esc(E.GOV[k].name) + '</span>').join('') + '</div>';
    case 'eco': return g('var(--seq-lo)', 'var(--seq-hi)', 'Poorer', 'Richer (GDP per person)');
    case 'mil': return g('var(--mil-lo)', 'var(--mil-hi)', 'Weak', 'Strong (military power)');
    case 'ten': return g('var(--mil-lo)', 'var(--mil-hi)', 'Calm', 'Hot (wars, rivalries)') + '<div class="faint" style="margin-top:3px">Dotted lines mark serious rivalries</div>';
  }
  return '';
}

function sparkSvg(key, goodDir) {
  const h = S().history.slice(-48); if (h.length < 3) return '<svg viewBox="0 0 100 22"></svg>';
  const v = h.map(x => x[key]); let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < 1e-6) { hi = lo + 1; }
  const pts = v.map((y, i) => (i / (v.length - 1) * 100).toFixed(1) + ',' + (20 - (y - lo) / (hi - lo) * 18).toFixed(1));
  const last = pts[pts.length - 1].split(',');
  const up = v[v.length - 1] >= v[0]; const good = goodDir === 0 ? null : (up === (goodDir > 0));
  const col = good === null ? 'var(--ink-3)' : good ? 'var(--good)' : 'var(--bad)';
  return '<svg viewBox="0 0 100 22" preserveAspectRatio="none"><polyline fill="none" stroke="' + col + '" stroke-width="1.6" vector-effect="non-scaling-stroke" points="' + pts.join(' ') + '"/></svg>';
}
function delta12(key) { const h = S().history; if (h.length < 2) return null; const a = h[Math.max(0, h.length - 13)][key], b = h[h.length - 1][key]; return b - a; }
