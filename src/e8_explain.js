// ===================== WHY DID THIS HAPPEN =====================
// Explains the player's numbers and relationships in plain terms, and records what moved each month and why.

const SIGN_OK = { stab: 1, appr: 1, growth: 1, prest: 1, infl: -1, unemp: -1, tension: -1 };
const fmtS = (v, d) => (v >= 0 ? '+' : '') + v.toFixed(d == null ? 1 : d);

function mergeParts(parts, minAbs) {
  const by = {}; parts.forEach(([n, v]) => { by[n] = (by[n] || 0) + v; });
  return Object.keys(by).map(n => ({ label: n, v: by[n] })).filter(x => Math.abs(x.v) >= (minAbs == null ? 0.12 : minAbs)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
}

function partsFor(kind, c) {
  if (kind === 'stab') { const r = stabTarget(c); return { now: c.stab, target: r.t, base: r.base, baseLabel: 'Baseline for a state like yours', parts: r.parts, unit: '' }; }
  if (kind === 'appr') { const r = apprTarget(c); return { now: c.appr, target: r.t, base: r.base, baseLabel: 'Baseline mood', parts: r.parts, unit: '%' }; }
  if (kind === 'growth') { const r = growthTarget(c); return { now: c.growth, target: r.g, base: 0, baseLabel: '', parts: r.parts, unit: '%' }; }
  return null;
}

const EXPLAIN_TITLES = { stab: 'Stability', appr: 'Approval', growth: 'Growth' };
const EXPLAIN_LEAD = {
  stab: (now, tgt) => 'Stability is ' + Math.round(now) + ' and is settling toward ' + Math.round(tgt) + '. Below 30 is where coups and uprisings become real.',
  appr: (now, tgt) => 'Approval is ' + Math.round(now) + '% and is settling toward ' + Math.round(tgt) + '%.',
  growth: (now, tgt) => 'Growth is ' + now.toFixed(1) + '% a year and is heading for ' + tgt.toFixed(1) + '%.',
};

function explain(kind) {
  const c = me();
  if (kind.startsWith('rel:')) return explainRel(kind.slice(4));
  if (kind === 'budget') return explainBudget();
  if (kind === 'credit') return explainCredit();
  const r = partsFor(kind, c); if (!r) return null;
  const items = mergeParts(r.parts);
  const rows = [];
  if (r.baseLabel) rows.push({ label: r.baseLabel, v: r.base, base: true });
  items.forEach(x => rows.push(x));
  const gain = items.filter(x => x.v > 0 && x.label !== 'Underlying trend').slice(0, 2).map(x => x.label.toLowerCase()), loss = items.filter(x => x.v < 0).slice(0, 2).map(x => x.label.toLowerCase());
  let why = '';
  if (loss.length) why += 'Holding it back: ' + loss.join(' and ') + '. ';
  if (gain.length) why += 'Helping: ' + gain.join(' and ') + '.';
  return { kind, title: EXPLAIN_TITLES[kind], lead: EXPLAIN_LEAD[kind](r.now, r.target), why: why.trim(), rows, unit: r.unit, dec: kind === 'growth' ? 2 : 1 };
}

function explainCredit() {
  const ci = creditInfo(); if (!ci) return null;
  const rows = [{ label: 'A perfect record', v: 100, base: true }].concat(ci.parts.map(p => ({ label: p.label, v: p.v })));
  { const sum = 100 + ci.parts.reduce((a, b) => a + b.v, 0), other = ci.score - sum; if (Math.abs(other) >= 0.5) rows.push({ label: 'Small factors and gradual adjustment', v: other }); }
  const lead = 'Your rating is ' + ci.rating + ' (' + ci.outlook.toLowerCase() + ' outlook), with a score of ' + ci.score.toFixed(1) + '. The bands are AAA 84 or more, AA 74, A 63, BBB 52, BB 41, B 30, CCC below that. A rating drops a notch once the score is a little under its band, and only rises after a longer wait and a clear margin, so it lags the score. Outlook shows which way the score is heading or how close it is to a boundary.';
  const why = (Math.abs(ci.premium) > 0.01 ? 'The rating alone adds ' + ci.premium.toFixed(1) + ' points to your borrowing cost compared with the start (inflation and debt add more on top). ' : 'Your rating is unchanged since the start, so it adds nothing to your borrowing cost yet. ') + (ci.slack ? ci.slack + ' ' : '') + (ci.arrears > 0 ? 'Bills left unpaid because lenders would not lend: ' + money(ci.arrears) + ' so far. ' : '') + (ci.war ? 'Wartime deficits are treated leniently.' : '');
  return { kind: 'credit', title: 'Credit rating', lead, why: why.trim(), rows, unit: 'pts', dec: 0 };
}

function explainBudget() {
  const c = me(), f = fiscalCalc(c);
  const rows = [
    { label: 'Tax revenue', v: f.rev * 12 / c.gdp * 100, pct: true }, { label: 'Programmes and admin', v: -(f.prog + f.admin) * 12 / c.gdp * 100, pct: true },
    { label: 'Debt interest', v: -f.interest * 12 / c.gdp * 100, pct: true },
  ];
  const sup = supportCostPct(c), tc = terrCostPct(c);
  if (sup) rows.push({ label: 'Support for allies', v: -sup, pct: true });
  if (tc) rows.push({ label: 'Upkeep of conquered lands', v: -tc, pct: true });
  const bal = (f.rev - f.spend) * 12 / c.gdp * 100;
  return { kind: 'budget', title: 'Budget', lead: 'You are running a ' + (bal >= 0 ? 'surplus' : 'deficit') + ' of ' + Math.abs(bal).toFixed(1) + '% of GDP a year.', why: '', rows, unit: '% of GDP', dec: 1 };
}

// relationship between the player (or any two states) broken into its causes
function relParts(a, b) {
  const ca = C(a), cb = C(b), P = [];
  if (ca.camp && cb.camp) P.push([ca.camp === cb.camp ? 'Same world camp' : 'Opposing world camps', ca.camp === cb.camp ? (ca.camp > 0 ? 11 : 9) : -12]);
  if (hasPact(a, b)) P.push(['Formal alliance', 22]);
  const bl = sharedBloc(a, b); if (bl) P.push(['Shared bloc: ' + bl.name, bl.type === 'defence' ? 12 : bl.type === 'union' ? 10 : 5]);
  const rv = rivalryOf(a, b); if (rv) P.push(['Rivalry', -20 * rv]);
  if (isDemo(ca.gov) && isDemo(cb.gov)) P.push(['Both democracies', 5]); else if ((ca.gov === 'D') !== (cb.gov === 'D') && (isAuto(ca.gov) || isAuto(cb.gov))) P.push(['Different political systems', -3]);
  if (ca.gov === cb.gov && isAuto(ca.gov)) P.push(['Similar regimes', 3]);
  if (NB[a] && NB[a].includes(b) && !rv) P.push(['Neighbours', 1]);
  P.push(['Historic affinity', (hrand(a + b + S.seed) - 0.5) * 16]);
  const w = warBetween(a, b); if (w) P.push(['At war with each other', -70]);
  S.wars.forEach(x => { if (x.sup.a.includes(a) || x.sup.b.includes(a)) { /* supporters counted in the drift, skip */ } });
  if (S.sanctions.some(s => (s.by === a && s.on === b) || (s.by === b && s.on === a))) P.push(['Sanctions', -18]);
  if (S.deals.some(d => (d[0] === a && d[1] === b) || (d[0] === b && d[1] === a))) P.push(['Trade deal', 8]);
  return P;
}
function explainRel(iso) {
  const a = S.player, b = iso; const P = relParts(a, b);
  const target = clamp(P.reduce((s, x) => s + x[1], 0), -100, 100), now = R(a, b);
  const rows = mergeParts(P, 0.5);
  const resid = now - target;
  if (Math.abs(resid) >= 3) rows.push({ label: resid > 0 ? 'Recent goodwill (fades over time)' : 'Recent incidents (fade over time)', v: resid });
  rows.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
  return { kind: 'rel', title: 'Relations with ' + nm(iso), lead: 'Relations are ' + relWord(now).toLowerCase() + ' (' + fmtS(now, 0) + '). Underlying factors point toward ' + fmtS(target, 0) + ', and the score drifts that way slowly.', why: '', rows, unit: '', dec: 0 };
}

// ---------- monthly "what moved" log ----------
let WHY_BEFORE = null;
function whySnap() {
  const c = me();
  WHY_BEFORE = { stab: c.stab, appr: c.appr, growth: c.growth, infl: c.infl, unemp: c.unemp, prest: c.prest, tension: S.world.tension, treasury: c.treasury, wars: S.wars.length,
    parts: { stab: partsFor('stab', c).parts, appr: partsFor('appr', c).parts, growth: partsFor('growth', c).parts },
    rel: {} };
  aliveList().forEach(i => { if (i !== S.player) WHY_BEFORE.rel[i] = R(S.player, i); });
}
function partDiffs(kind, c) {
  const after = mergeParts(partsFor(kind, c).parts, 0), bmap = {}; mergeParts(WHY_BEFORE.parts[kind], 0).forEach(x => { bmap[x.label] = x.v; });
  return after.map(x => ({ label: x.label, d: x.v - (bmap[x.label] || 0) })).filter(x => Math.abs(x.d) >= 0.15);
}
function whyDone() {
  if (!WHY_BEFORE) return;
  const c = me(), B = WHY_BEFORE, rows = [];
  const add = (kind, label, from, to, thr, dec, why) => {
    const d = to - from; if (Math.abs(d) < thr) return;
    const good = (SIGN_OK[kind] || 1) * d > 0;
    rows.push({ k: kind, label, from: +from.toFixed(dec), to: +to.toFixed(dec), good, why, mag: Math.abs(d) / thr });
  };
  const reasonFromParts = (kind, dir) => {
    const diffs = partDiffs(kind, c).filter(x => Math.sign(x.d) === dir).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2);
    if (diffs.length) return (dir > 0 ? 'Helped by ' : 'Hit by ') + diffs.map(x => x.label.toLowerCase()).join(' and ') + '.';
    return dir > 0 ? 'Still recovering toward its target.' : 'Still sliding toward its target.';
  };
  add('stab', 'Stability', B.stab, c.stab, 2, 0, reasonFromParts('stab', Math.sign(c.stab - B.stab)));
  add('appr', 'Approval', B.appr, c.appr, 2.5, 0, reasonFromParts('appr', Math.sign(c.appr - B.appr)));
  add('growth', 'Growth', B.growth, c.growth, 0.5, 1, reasonFromParts('growth', Math.sign(c.growth - B.growth)));
  add('infl', 'Inflation', B.infl, c.infl, 0.6, 1, S.world.oil > 1.15 ? 'Oil prices are pushing costs up.' : c.growth > c.baseGrowth + 1 ? 'The economy is running hot.' : 'Prices are drifting back toward their normal level.');
  add('unemp', 'Unemployment', B.unemp, c.unemp, 0.4, 1, c.growth < c.baseGrowth ? 'Growth below trend is costing jobs.' : 'Growth above trend is creating jobs.');
  add('prest', 'Prestige', B.prest, c.prest, 2, 0, S.wars.length > B.wars ? 'A new war is changing how you are seen.' : 'Your recent actions and standing are changing how others see you.');
  const td = S.world.tension - B.tension;
  if (Math.abs(td) >= 3) {
    const bits = []; if (S.wars.length) bits.push(S.wars.length + (S.wars.length === 1 ? ' war' : ' wars') + ' under way'); if ((S.world.nukeAlert || 0) > 8) bits.push('raised nuclear alert'); if (S.world.shock) bits.push('an economic shock');
    add('tension', 'World tension', B.tension, S.world.tension, 3, 0, td > 0 ? (bits.length ? 'Driven by ' + bits.join(', ') + '.' : 'Rivalries are heating up.') : 'Fewer active conflicts are letting things cool.');
  }
  // relationships that moved by 6 or more
  const rl = S.relLog || [];
  Object.keys(B.rel).forEach(i => {
    const d = R(S.player, i) - B.rel[i]; if (Math.abs(d) < 6 || !alive(i)) return;
    const mine = rl.filter(x => x.iso === i);
    let why;
    if (mine.length) { const best = mine.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0]; why = best.src + '.'; }
    else if (warBetween(S.player, i)) why = 'You are at war.';
    else if (S.wars.some(w => w.a.concat(w.b).includes(i))) why = 'Their war is pulling relations toward whichever side you stand with.';
    else why = 'Bloc, rivalry and ideology pressures are pulling relations this way.';
    rows.push({ k: 'rel', iso: i, label: 'Relations with ' + nm(i), from: Math.round(B.rel[i]), to: Math.round(R(S.player, i)), good: d > 0, why, mag: Math.abs(d) / 6 });
  });
  rows.sort((a, b) => b.mag - a.mag);
  S.why = { turn: S.turn, rows: rows.slice(0, 7) };
  S.relLog = []; WHY_BEFORE = null;
}
function relNote(iso, d, src) { if (!S.relLog) S.relLog = []; S.relLog.push({ iso, d, src }); }

Object.assign(Engine, { explain, whyRows: () => (S.why && S.why.turn === S.turn ? S.why.rows : (S.why ? S.why.rows : [])) });
