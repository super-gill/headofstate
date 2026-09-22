// ===================== CORE: state, data, relations =====================
const W = WORLDDATA;
const ISOS = W.countries.map(c => c.iso);
const N = ISOS.length;
const IDX = {}; ISOS.forEach((k, i) => IDX[k] = i);
const ROW = {}; W.countries.forEach(r => ROW[r.iso] = r);
const NB = {}; MAPDATA.c.forEach(m => NB[m.id] = m.nb);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FAC = ['public', 'business', 'military', 'party'];

let S = null; // the one live game state

// ---------- small utilities ----------
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
function rnd() { // mulberry32 on S.rng
  S.rng = (S.rng + 0x6D2B79F5) | 0;
  let t = Math.imul(S.rng ^ (S.rng >>> 15), 1 | S.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = p => rnd() < p;
const between = (a, b) => a + (b - a) * rnd();
const pick = arr => arr[Math.floor(rnd() * arr.length)];
function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hrand(str) { return (hash(str) % 100000) / 100000; }
function weighted(items, wf) {
  let tot = 0; const ws = items.map(i => { const w = Math.max(0, wf(i)); tot += w; return w; });
  if (tot <= 0) return null;
  let r = rnd() * tot; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function mo(n) { n = Math.round(n); return n + ' month' + (n === 1 ? '' : 's'); }
// how to describe your political critics/rivals, in the right register for the government type
const oppTerm = c => isDemo(c.gov) ? 'the opposition' : c.gov === 'M' ? 'the exiled court' : c.gov === 'T' ? 'dissident clerics abroad' : 'the underground opposition';
const legTerm = c => isDemo(c.gov) ? 'backbenchers' : c.gov === 'M' ? 'courtiers' : c.gov === 'J' ? 'the officer council' : c.gov === 'T' ? 'the clergy' : 'the inner circle';
function money(bn) {
  const a = Math.abs(bn), s = bn < 0 ? '-' : '';
  if (a >= 1000) return s + '$' + (a / 1000).toFixed(a >= 10000 ? 1 : 2) + 'tn';
  if (a >= 10) return s + '$' + a.toFixed(0) + 'bn';
  if (a >= 1) return s + '$' + a.toFixed(1) + 'bn';
  return s + '$' + (a * 1000).toFixed(0) + 'm';
}
function popStr(m) { return m >= 100 ? m.toFixed(0) + 'm' : m >= 1 ? m.toFixed(1) + 'm' : (m * 1000).toFixed(0) + 'k'; }
const dateLabel = (d) => MONTHS[(d || S.date).m] + ' ' + (d || S.date).y;
function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const dist = (a, b) => haversine(ROW[a], ROW[b]);

// ---------- governments ----------
const GOV = {
  D: { name: 'Liberal democracy', leader: 'President', w: { public: .5, business: .15, military: .05, party: .3 }, fl: ['Voters', 'Business community', 'Armed forces', 'Parliament and party'], free: 82, corr: 25, appr: 1.0, coup: .02, pcMult: .95, pcMax: 11, fric: 1.15, term: 48, rig: 0, war: 1.25, desc: 'Free elections and strong checks. You answer to voters and parliament, but your power to act is limited.' },
  H: { name: 'Hybrid regime', leader: 'President', w: { public: .32, business: .2, military: .15, party: .33 }, fl: ['Voters', 'Business allies', 'Security forces', 'Ruling party'], free: 50, corr: 48, appr: .8, coup: .1, pcMult: 1.05, pcMax: 12, fric: 1.0, term: 48, rig: .14, war: .9, desc: 'Elections are held but the field is tilted. More room to act, but corruption and unrest simmer.' },
  M: { name: 'Absolute monarchy', leader: 'Monarch', w: { public: .1, business: .25, military: .3, party: .35 }, fl: ['Subjects', 'Merchant families', 'Royal guard and army', 'Royal court'], free: 22, corr: 45, appr: .45, coup: .12, pcMult: 1.1, pcMax: 13, fric: .8, term: 0, rig: 0, war: .6, desc: 'The crown rules. Your enemies are palace intrigue and the army, not the ballot box.' },
  O: { name: 'One-party state', leader: 'General Secretary', w: { public: .15, business: .15, military: .25, party: .45 }, fl: ['Citizens', 'State enterprises', 'The army', 'The Party'], free: 14, corr: 40, appr: .45, coup: .05, pcMult: 1.1, pcMax: 13, fric: .85, term: 0, rig: 0, war: .7, desc: 'The Party is everything. Keep the Party and army loyal and the streets quiet.' },
  J: { name: 'Military junta', leader: 'Chairman of the Council', w: { public: .1, business: .15, military: .5, party: .25 }, fl: ['Citizens', 'Business allies', 'Rank and file', 'Officer council'], free: 18, corr: 55, appr: .4, coup: .3, pcMult: 1.0, pcMax: 12, fric: .7, term: 0, rig: 0, war: .5, desc: 'You rule by the gun. The main threat is another general with the same idea.' },
  T: { name: 'Theocracy', leader: 'Supreme Leader', w: { public: .2, business: .1, military: .3, party: .4 }, fl: ['The faithful', 'Bazaar and traders', 'Guard corps', 'Clergy'], free: 15, corr: 45, appr: .55, coup: .06, pcMult: 1.05, pcMax: 12, fric: .9, term: 0, rig: 0, war: .8, desc: 'Religious authority underpins the state. Clergy and the guard corps decide who leads.' },
  P: { name: 'Personalist autocracy', leader: 'President', w: { public: .15, business: .25, military: .35, party: .25 }, fl: ['The public', 'Oligarchs', 'Security services', 'Inner circle'], free: 20, corr: 60, appr: .5, coup: .13, pcMult: 1.1, pcMax: 13, fric: .75, term: 0, rig: 0, war: .7, desc: 'Power flows through you. Reward the inner circle and never let the security services drift.' },
};
const isDemo = g => g === 'D' || g === 'H';
const isAuto = g => !isDemo(g);

// resource rent (% of GDP flowing to state revenue)
const RENT = { SAU: 22, KWT: 30, QAT: 25, ARE: 10, OMN: 20, BHR: 12, BRN: 20, IRN: 7, IRQ: 35, LBY: 40, DZA: 14, RUS: 8, NOR: 9, VEN: 15, NGA: 6, AGO: 22, KAZ: 9, AZE: 20, TKM: 30, GAB: 15, GNQ: 25, COG: 25, GUY: 10, TTO: 10, SSD: 40, TCD: 14, CAN: 2, YEM: 5, BOL: 4, ECU: 5 };
// camp seeds
const WEST_X = ['ISR', 'TWN', 'UKR', 'MDA', 'CHE', 'IRL', 'AUT', 'JPN', 'KOR', 'AUS', 'NZL', 'PHL', 'SGP', 'GEO', 'XKX'];
const EAST_X = ['RUS', 'CHN', 'IRN', 'PRK', 'VEN', 'CUB', 'NIC', 'BLR', 'MMR', 'ERI'];

// ---------- relations ----------
const R = (a, b) => S.rel[IDX[a] * N + IDX[b]];
function setR(a, b, v) { v = clamp(v, -100, 100); S.rel[IDX[a] * N + IDX[b]] = v; S.rel[IDX[b] * N + IDX[a]] = v; }
const addR = (a, b, d) => { if (a !== b && S.c[a] && S.c[b]) { setR(a, b, R(a, b) + d); if (SRC && (a === S.player || b === S.player)) { relNote(a === S.player ? b : a, d, SRC); remember(a === S.player ? b : a, SRC, d); } } };
const pkey = (a, b) => a < b ? a + '|' + b : b + '|' + a;

// ---------- accessors ----------
const C = iso => S.c[iso];
const me = () => S.c[S.player];
const alive = iso => S.c[iso] && S.c[iso].alive;
const aliveList = () => ISOS.filter(alive);
function ownerOf(iso) { let o = iso, g = 0; while (S.owner[o] && S.owner[o] !== o && g++ < 10) o = S.owner[o]; return o; }
const nm = iso => S.c[iso] ? S.c[iso].name : iso;

function news(text, tag, iso) {
  S.news.unshift({ d: dateLabel(), text, tag: tag || 'world', iso: iso || null, turn: S.turn });
  if (S.news.length > 160) S.news.length = 160;
}
function logPlayer(text) { S.log.unshift({ d: dateLabel(), text, turn: S.turn }); if (S.log.length > 120) S.log.length = 120; }

// ---------- blocs, pacts ----------
const inBloc = (iso, id) => S.blocs[id] && S.blocs[id].members.includes(iso);
const blocsOf = iso => Object.keys(S.blocs).filter(id => S.blocs[id].members.includes(iso));
const hasPact = (a, b) => S.pacts.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));
function defenceAllies(iso) {
  const out = new Set();
  S.pacts.forEach(p => { if (p[0] === iso) out.add(p[1]); else if (p[1] === iso) out.add(p[0]); });
  for (const id in S.blocs) {
    const bl = S.blocs[id];
    if ((bl.type === 'defence' || bl.type === 'union') && bl.members.includes(iso)) bl.members.forEach(m => { if (m !== iso) out.add(m); });
  }
  return [...out].filter(alive);
}
function sharedBloc(a, b, types) {
  for (const id in S.blocs) { const bl = S.blocs[id]; if ((!types || types.includes(bl.type)) && bl.members.includes(a) && bl.members.includes(b)) return bl; }
  return null;
}
const rivalryOf = (a, b) => { const r = S.rivals.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)); return r ? r.n : 0; };
const sanctioned = (by, on) => S.sanctions.some(s => s.by === by && s.on === on);
const hasDeal = (a, b) => S.deals.some(d => (d[0] === a && d[1] === b) || (d[0] === b && d[1] === a));

// ---------- military power ----------
function armyTarget(c) {
  const spend = c.spend.mil / 100 * c.gdp;
  return Math.pow(spend + 0.02, 0.85) * (0.6 + 0.16 * c.tech) * (1 + 0.1 * Math.log10(c.pop + 1)) * (1 + 0.22 * c.mob);
}
const power = c => c.army * (0.75 + c.readiness / 200);
function reachKm(c) { return c.army >= 60 && c.tech >= 4 ? 20000 : c.army >= 25 ? 4500 : 1800; }
function canReach(a, b) {
  if (NB[a] && NB[a].includes(b)) return true;
  const d = dist(a, b);
  return d <= Math.max(reachKm(C(a)), reachKm(C(b)) * 0.5);
}

// ---------- wars (queries) ----------
const warsOf = iso => S.wars.filter(w => w.a.includes(iso) || w.b.includes(iso));
const atWar = iso => warsOf(iso).length > 0;
const warBetween = (a, b) => S.wars.find(w => (w.a.includes(a) && w.b.includes(b)) || (w.b.includes(a) && w.a.includes(b)));
function enemiesOf(iso) {
  const out = new Set();
  S.wars.forEach(w => { if (w.a.includes(iso)) w.b.forEach(x => out.add(x)); else if (w.b.includes(iso)) w.a.forEach(x => out.add(x)); });
  return [...out];
}

// ---------- building the country records ----------
function makeCountry(row, opts) {
  const gdppc = row.gdp * 1000 / row.pop;
  const tier = gdppc > 35000 ? 4 : gdppc > 15000 ? 3 : gdppc > 4500 ? 2 : 1;
  const g = GOV[row.gov];
  const tech = row.tech || (gdppc > 45000 ? 4 : gdppc > 25000 ? 3 : gdppc > 8000 ? 2 : 1);
  const rent = RENT[row.iso] || 0;
  const debtPct = row.debt != null ? row.debt : ({ 4: 60, 3: 55, 2: 50, 1: 55 }[tier]);
  const milPct = clamp(row.mil / row.gdp * 100, 0.02, 12);
  const fragile = row.fragile;
  const baseGrowth = row.growth != null ? row.growth : ({ 4: 1.7, 3: 2.6, 2: 3.6, 1: 4.2 }[tier] + (row.gov === 'J' ? -1 : 0));
  let socialBase = { 4: 19, 3: 13, 2: 8, 1: 5 }[tier];
  if (['DNK', 'SWE', 'FRA', 'BEL', 'FIN', 'AUT', 'NOR', 'ITA', 'DEU'].includes(row.iso)) socialBase += 3;
  if (['USA', 'KOR', 'IRL', 'SGP', 'CHE', 'AUS', 'JPN'].includes(row.iso)) socialBase -= 2;
  if (['M', 'J', 'P', 'O', 'T'].includes(row.gov)) socialBase -= 1.5;
  if (rent > 15) socialBase += 2;
  const adminPct = { 4: 6, 3: 5, 2: 4.2, 1: 3.6 }[tier];
  const rateBase = row.iso === 'JPN' ? 0.6 : { 4: 2.2, 3: 3.5, 2: 5.5, 1: 8 }[tier];
  const corr0 = g.corr + (tier <= 1 ? 10 : tier >= 4 ? -8 : 0);
  const interest0 = debtPct * rateBase / 100;
  const milSp = Math.max(0.1, Math.round(milPct * 10) / 10);
  const deficitT = (row.gov === 'D' && tier >= 3) ? 2.5 : 1.5;
  let taxBase = (socialBase + milSp + 3 + (fragile ? 2.4 : 1.4) + adminPct + interest0 - rent) / (1 - corr0 / 450) - deficitT;
  taxBase = Math.round(clamp(taxBase, 8, 55));
  socialBase = Math.round(socialBase * 10) / 10;
  const c = {
    iso: row.iso, name: row.name, gov: row.gov, alive: true,
    pop: row.pop, gdp: row.gdp, tier, tech, nukes: row.nukes || 0, fragile,
    baseGrowth, growth: baseGrowth, infl: tier >= 3 ? 2.6 : tier === 2 ? 5 : 8, unemp: tier >= 3 ? 5.5 : tier === 2 ? 8 : 11,
    baseInfl: tier >= 3 ? 2.4 : tier === 2 ? 4.5 : 7, baseUnemp: tier >= 3 ? 5.5 : tier === 2 ? 8 : 11,
    taxBase, tax: taxBase, rent, adminPct, rateBase, dpRef: debtPct, rgi: 1, pop0: row.pop,
    spend: { social: socialBase, mil: Math.round(milPct * 10) / 10, infra: 3, sec: fragile ? 2.4 : 1.4 },
    exp: { social: socialBase, mil: Math.round(milPct * 10) / 10, infra: 3, sec: fragile ? 2.4 : 1.4 },
    debtAbs: debtPct / 100 * row.gdp, treasury: row.gdp * 0.02,
    infraIdx: 45, secIdx: 50,
    army: 0, readiness: 60, mob: 0,
    stab: fragile ? 34 : ({ 4: 68, 3: 60, 2: 52, 1: 44 }[tier]) + (row.gov === 'D' ? 4 : 0),
    appr: 50, corr: corr0, free: g.free, prest: 30 + Math.min(40, Math.log10(row.gdp + 1) * 9),
    fac: { public: 50, business: 55, military: 55, party: 55 },
    warWeary: 0, mods: [], flags: {}, aggr: row.aggr != null ? row.aggr : (isAuto(row.gov) ? 0.3 : 0.12),
    camp: 0, lastWarEnd: -99, kills: 0,
  };
  c.spend.mil = Math.max(0.1, c.spend.mil); c.exp.mil = c.spend.mil;
  c.army = armyTarget(c);
  c.appr = clamp(48 + g.appr * 6 + gauss() * 6, 25, 75);
  FAC.forEach(f => c.fac[f] = clamp(52 + gauss() * 7, 30, 75));
  c.fac.public = c.appr;
  if (fragile) { c.appr -= 8; c.fac.public = c.appr; }
  return c;
}

function tierOf(c) { const pc = c.gdp * 1000 / c.pop; return pc > 35000 ? 4 : pc > 15000 ? 3 : pc > 4500 ? 2 : 1; }

// ---------- static base relations ----------
function computeCamps() {
  const nato = S.blocs.NATO ? S.blocs.NATO.members : [], eu = S.blocs.EU ? S.blocs.EU.members : [], aukus = S.blocs.AUKUS ? S.blocs.AUKUS.members : [];
  const csto = S.blocs.CSTO ? S.blocs.CSTO.members : [];
  ISOS.forEach(i => {
    const c = C(i); let camp = 0;
    if (nato.includes(i) || eu.includes(i) || aukus.includes(i) || WEST_X.includes(i) || hasPact(i, 'USA')) camp = 1;
    if (csto.includes(i) || EAST_X.includes(i) || hasPact(i, 'RUS') || hasPact(i, 'CHN')) camp = -1;
    if (i === 'CHN' || i === 'RUS') camp = -1; if (i === 'USA') camp = 1;
    if (c.campLock != null) camp = c.campLock;
    c.camp = camp;
  });
}
function buildBase() {
  computeCamps();
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const a = ISOS[i], b = ISOS[j], ca = C(a), cb = C(b);
    let v = 0;
    if (ca.camp && cb.camp) v += ca.camp === cb.camp ? (ca.camp > 0 ? 11 : 9) : -12;
    if (hasPact(a, b)) v += 22;
    const bl = sharedBloc(a, b);
    if (bl) v += bl.type === 'defence' ? 12 : bl.type === 'union' ? 10 : 5;
    const rv = rivalryOf(a, b); if (rv) v -= 20 * rv;
    if (isDemo(ca.gov) && isDemo(cb.gov)) v += 5; else if ((ca.gov === 'D') !== (cb.gov === 'D') && (isAuto(ca.gov) || isAuto(cb.gov))) v -= 3;
    if (ca.gov === cb.gov && isAuto(ca.gov)) v += 3;
    if (NB[a] && NB[a].includes(b) && !rv) v += 1;
    if (ca.nukes && !cb.nukes && cb.camp !== ca.camp) v -= 0;
    v += (hrand(a + b + S.seed) - 0.5) * 16;
    S.base[i * N + j] = S.base[j * N + i] = clamp(v, -95, 95);
  }
  S.dirtyBase = false;
}
function dynTargets() {
  const m = new Map(); const add = (a, b, v) => { const k = IDX[a] * N + IDX[b]; m.set(k, (m.get(k) || 0) + v); m.set(IDX[b] * N + IDX[a], (m.get(IDX[b] * N + IDX[a]) || 0) + v); };
  S.wars.forEach(w => {
    w.a.forEach(x => w.b.forEach(y => add(x, y, -70)));
    for (const side of ['a', 'b']) for (let i = 0; i < w[side].length; i++) for (let j = i + 1; j < w[side].length; j++) add(w[side][i], w[side][j], 14);
    ['a', 'b'].forEach(side => { const opp = side === 'a' ? 'b' : 'a'; (w.sup[side] || []).forEach(s => { w[side].forEach(x => add(s, x, 16)); w[opp].forEach(x => add(s, x, -30)); }); });
  });
  // camp sympathy in wars between opposed camps
  S.wars.forEach(w => {
    const la = w.lead.a, lb = w.lead.b, ca = C(la).camp, cb = C(lb).camp;
    if (!ca || !cb || ca === cb) return;
    ISOS.forEach(p => {
      const cp = C(p); if (!cp.alive || !cp.camp || w.a.includes(p) || w.b.includes(p)) return;
      if (cp.camp === ca) { add(p, la, 14); add(p, lb, -8); } else { add(p, lb, 14); add(p, la, -8); }
    });
  });
  S.sanctions.forEach(s => add(s.by, s.on, -18));
  S.deals.forEach(d => add(d[0], d[1], 8));
  if (S.leaders) Object.keys(S.leaders).forEach(i => { const ms = memSum(i); if (ms) add(S.player, i, ms * 0.25); });
  return m;
}
function initRelations() {
  for (let i = 0; i < N * N; i++) S.rel[i] = S.base[i];
}
function driftRelations() {
  if (S.dirtyBase) buildBase();
  const dyn = dynTargets();
  const rate = 0.045;
  for (let i = 0; i < N; i++) {
    if (!S.c[ISOS[i]].alive) continue;
    for (let j = i + 1; j < N; j++) {
      if (!S.c[ISOS[j]].alive) continue;
      const k = i * N + j;
      const target = clamp(S.base[k] + (dyn.get(k) || 0), -100, 100);
      let v = S.rel[k] + (target - S.rel[k]) * rate + gauss() * 0.35;
      v = clamp(v, -100, 100);
      S.rel[k] = v; S.rel[j * N + i] = v;
    }
  }
}

// ---------- game creation ----------
function newGameState(opts) {
  const seed = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9)) >>> 0;
  S = {
    v: 3, seed, rng: seed || 1, date: { y: 2027, m: 0 }, turn: 0,
    player: opts.player, leader: opts.leader || 'The Leader', diff: opts.diff || 1, temper: opts.temper === 0 ? 0.5 : (opts.temper || 1), termLimits: !!opts.termLimits,
    c: {}, owner: {}, rel: new Float32Array(N * N), base: new Float32Array(N * N), dirtyBase: true,
    blocs: {}, terr: {}, pacts: [], rivals: [], sanctions: [], deals: [], wars: [], nextWarId: 1, apps: [], cb: {}, intel: {},
    news: [], log: [], events: [], eventHist: {}, cool: {}, pc: 6, pcMax: 12, history: [], flags: {},
    world: { cycle: 0, cycleT: 0, oil: 1, tension: 30, shock: null, nukeUse: 0, annexations: 0, lastAnnex: -99 },
    over: null, electionIn: 0, terms: 1, startStats: null, stat: { casualties: 0, warsWon: 0, warsLost: 0, ceasefires: 0, annexed: 0, policies: 0, eventsSeen: 0 },
    prepOpts: { ...opts },
  };
  W.blocs.forEach(b => S.blocs[b.id] = { id: b.id, name: b.name, type: b.type, desc: b.desc, members: b.members.slice() });
  S.pacts = W.pacts.map(p => p.slice());
  S.rivals = W.rivalries.filter(r => r.n > 0).map(r => ({ a: r.a, b: r.b, n: r.n, why: r.why }));
  if (opts.temper === 0) S.rivals.forEach(r => r.n = Math.max(1, r.n - 1));
  W.countries.forEach(row => { S.c[row.iso] = makeCountry(row); S.owner[row.iso] = row.iso; });
  // the player's chosen government
  const p = S.c[S.player];
  if (opts.gov && opts.gov !== p.gov) {
    p.gov = opts.gov; const g = GOV[p.gov];
    p.free = g.free; p.corr = clamp(g.corr + (p.tier <= 1 ? 8 : p.tier >= 4 ? -8 : 0), 5, 95);
    p.appr = clamp(50 + g.appr * 5, 30, 70); p.fac.public = p.appr; p.flags.customGov = 1;
  }
  buildBase(); initRelations();
  S.pcMax = GOV[p.gov].pcMax; S.pc = Math.round(S.pcMax * 0.6);
  S.electionIn = isDemo(p.gov) ? 20 + Math.floor(rnd() * 28) : 0;
  cabinetEnsure();
  // starting wars
  if (opts.temper !== 0) {
    const sw = [];
    W.startWars.forEach(([a, b]) => { if (alive(a) && alive(b)) sw.push(startWar(a, b, { silent: true, months: 36, goal: 'conquest', score: -6, deferAllies: true })); });
    if (sw.length) { for (let i = 0; i < 45; i++) driftRelations(); sw.forEach(w => {
      callAllies(w, true);
      ['a', 'b'].forEach(side => {
        const L = w.lead[side], oth = side === 'a' ? 'b' : 'a';
        aliveList().forEach(p => {
          if (p === S.player || w.a.includes(p) || w.b.includes(p) || w.sup[side].includes(p) || w.sup[oth].includes(p)) return;
          const cp = C(p);
          if (cp.camp && cp.camp === C(L).camp && cp.army >= 3 && R(p, L) > 8) w.sup[side].push(p);
        });
      });
    });
  }
  }
  applyScenario(opts.scenario);
  S.world.tension = computeTension();
  S.startStats = snapshot(p);
  { const rk = ranks(); S.startInfo = { rankGdp: rk.gdp[S.player], rankPow: rk.pow[S.player], allies: defenceAllies(S.player).length, blocs: blocsOf(S.player).length, gov: p.gov, nukes: p.nukes }; S._rk = null; }
  initAmbition(opts.ambition === 'none' ? null : (opts.ambition || (SCENARIOS[opts.scenario] || {}).amb));
  S.yr = yrFresh();
  creditEnsure();
  recordHistory();
  news('A new year begins. ' + nm(S.player) + ' has a new leader: ' + S.leader + '.', 'you', S.player);
  return S;
}

function snapshot(c) {
  return { gdp: c.gdp, pop: c.pop, appr: c.appr, stab: c.stab, growth: c.growth, infl: c.infl, unemp: c.unemp, debt: c.debtAbs / c.gdp * 100, free: c.free, corr: c.corr, prest: c.prest, treasury: c.treasury, army: c.army };
}
function recordHistory() {
  const c = me();
  S.history.push({ t: S.turn, gdp: c.gdp, appr: c.appr, stab: c.stab, growth: c.growth, infl: c.infl, unemp: c.unemp, debt: c.debtAbs / c.gdp * 100, tension: S.world.tension, prest: c.prest });
  if (S.history.length > 400) S.history.splice(0, S.history.length - 400);
}
