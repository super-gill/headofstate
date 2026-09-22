// ===================== ECONOMY, POLITICS, SURVIVAL =====================
let SRC = null;
const withSrc = (label, fn) => { const o = SRC; SRC = label; try { return fn(); } finally { SRC = o; } };
function addMod(c, k, v, months) { c.mods.push({ k, v, t: months, src: SRC }); }
function modParts(c, k, label) {
  const by = {}; c.mods.forEach(m => { if (m.k === k) by[m.src || label || 'Recent events'] = (by[m.src || label || 'Recent events'] || 0) + m.v; });
  return Object.keys(by).map(n => [n, by[n]]);
}
function modSum(c, k) { let s = 0; for (const m of c.mods) if (m.k === k) s += m.v; return s; }
function tickMods(c) { for (const m of c.mods) m.t--; c.mods = c.mods.filter(m => m.t > 0); }
function fac(c, f, d) { c.fac[f] = clamp(c.fac[f] + d, 0, 100); }
function adj(c, k, d, lo, hi) { c[k] = clamp(c[k] + d, lo == null ? 0 : lo, hi == null ? 100 : hi); }
const debtPct = c => c.debtAbs / c.gdp * 100;
const powerBase = c => { const w = GOV[c.gov].w; return FAC.reduce((s, f) => s + w[f] * c.fac[f], 0); };

function tradeBonus(c) {
  let b = 0;
  S.deals.forEach(d => {
    if (d[0] !== c.iso && d[1] !== c.iso) return;
    const o = C(d[0] === c.iso ? d[1] : d[0]); if (!o || !o.alive) return;
    b += Math.min(0.55, 0.06 + 0.5 * o.gdp / (c.gdp + o.gdp));
  });
  blocsOf(c.iso).forEach(id => { if (S.blocs[id].type === 'union') b += 0.22; });
  return Math.min(1.4, b);
}
function sanctionPenalty(c) {
  let p = 0;
  S.sanctions.forEach(s => { if (s.on === c.iso && alive(s.by)) { let f = 1; if (s.until) f = clamp((s.until - S.turn) / Math.max(1, s.until - s.turn), 0.3, 1); p += clamp(C(s.by).gdp / (c.gdp + C(s.by).gdp) * 1.6, 0.03, 1.5) * f * (s.w || 1); } });
  return Math.min(c.iso === S.player ? 3 : 4, p);
}


function growthTarget(c) {
  const w = S.world, dp = debtPct(c);
  const rel = clamp(c.rgi / (c.pop / c.pop0), 0.7, 4);
  const P = [];
  P.push(['Underlying trend', c.baseGrowth * Math.pow(1 / rel, 0.4)]);
  P.push(['World business cycle', w.cycle * (c.tier >= 3 ? 1 : 0.85)]);
  P.push(['Infrastructure', (c.infraIdx - 45) * 0.02]);
  P.push(['Tax burden', -(c.tax - c.taxBase) * 0.06 - Math.max(0, c.tax - 45) * 0.15]);
  modParts(c, 'growth').forEach(m => P.push(m));
  P.push(['Inflation', -Math.max(0, c.infl - 7) * 0.22]);
  P.push(['Debt burden', -Math.max(0, dp - 110) * 0.018]);
  if (c.iso === S.player && c.credit && c.credit.idx >= 5) P.push(['Market confidence', -0.25 * (c.credit.idx - 4)]);
  P.push(['Instability', -(c.stab < 32 ? (32 - c.stab) * 0.05 : 0)]);
  P.push(['Corruption', -Math.max(0, c.corr - 45) * 0.02]);
  P.push(['Trade links', tradeBonus(c)]);
  P.push(['Sanctions', -sanctionPenalty(c)]);
  P.push(['War damage', -(c.warDmg || 0)]);
  P.push(['Mobilisation', -0.45 * c.mob]);
  if (c.rent) P.push(['Oil price', (w.oil - 1) * c.rent * 0.15]);
  P.push(['Social spending', clamp(c.spend.social - c.exp.social, -8, 8) * 0.03]);
  return { g: P.reduce((a, b) => a + b[1], 0), parts: P };
}
function apprTarget(c) {
  const g = GOV[c.gov]; const P = [];
  P.push(['Economic growth', clamp(c.growth - 2.2, -7, 7) * 1.8]);
  P.push(['Unemployment', -clamp(c.unemp - c.baseUnemp, -3, 12) * 1.4]);
  P.push(['Inflation', -clamp(c.infl - c.baseInfl - 1, 0, 25) * 1.0]);
  P.push(['Social spending', clamp(c.spend.social - c.exp.social, -12, 12) * 1.2]);
  P.push(['Taxes', -clamp(c.tax - c.taxBase, -15, 20) * 0.9]);
  P.push(['Corruption', -Math.max(0, c.corr - 30) * 0.16]);
  P.push(['National prestige', (c.prest - 40) * 0.07]);
  P.push(['War weariness', -c.warWeary * 0.35]);
  modParts(c, 'appr').forEach(m => P.push(m));
  P.push(['Civil liberties', (c.free - 50) * 0.03]);
  const spinB = c.iso === S.player ? compBonus('spin') * 0.9 : 0; if (spinB) P.push([spinB > 0 ? 'Your communications team' : 'A weak communications team', spinB]);
  const sc = g.appr > 0.9 ? 1 : 0.55 + g.appr * 0.45, off = g.appr > 0.9 ? 5 : 0;
  const base = 55 - off;
  return { t: base + P.reduce((a, b) => a + b[1], 0) * sc, parts: P.map(x => [x[0], x[1] * sc]), base };
}
function stabTarget(c) {
  const P = [];
  const ts0 = ({ 4: 66, 3: 60, 2: 52, 1: 44 })[c.tier] + (c.fragile ? -14 : 0) + (c.gov === 'D' ? 4 : 0);
  P.push(['Approval', (c.appr - 50) * 0.3]);
  P.push(['Security services', (c.secIdx - 50) * 0.12]);
  P.push(['Unemployment', -clamp(c.unemp - c.baseUnemp, -2, 10) * 0.8]);
  P.push(['Inflation', -clamp(c.infl - c.baseInfl, 0, 20) * 0.35]);
  modParts(c, 'stab').forEach(m => P.push(m));
  P.push(['War weariness', -c.warWeary * 0.12]);
  P.push(['War damage', -(c.warDmg || 0) * 1.5]);
  P.push(['Unrest in conquered lands', -(c.flags.terrDrag || 0) * 0.5]);
  return { t: ts0 + P.reduce((a, b) => a + b[1], 0), parts: P, base: ts0 };
}
function econStep(c, isMe) {
  const w = S.world;
  const dp = debtPct(c);
  const g = growthTarget(c).g;
  c.growth += (g - c.growth) * 0.22 + gauss() * 0.1;
  c.growth = clamp(c.growth, -15, 20);
  c.gdp *= 1 + (c.growth + clamp(c.infl, 0, 4)) / 1200;
  c.rgi *= 1 + c.growth / 1200;
  c.pop *= 1 + (c.tier >= 3 ? 0.002 : c.tier === 2 ? 0.008 : 0.016) / 12;
  // inflation and unemployment
  const oilPass = c.rent ? 0 : (w.oil - 1) * 2.2;
  const tInfl = c.baseInfl + modSum(c, 'infl') + (c.growth - c.baseGrowth) * 0.25 + oilPass * (c.flags.green ? 0.5 : 1) + (w.food || 0) * (c.tier <= 2 ? 1 : 0.4);
  c.infl = clamp(c.infl + (tInfl - c.infl) * 0.1 + gauss() * 0.08, -1, 90);
  const tUn = c.baseUnemp + (c.baseGrowth - c.growth) * 0.7 + modSum(c, 'unemp') - 0.6 * c.mob;
  c.unemp = clamp(c.unemp + (tUn - c.unemp) * 0.08 + gauss() * 0.04, 1, 45);
  // military build-up
  const mobFloor = c.exp.mil + 1.3 * c.mob;
  if (isMe && c.mob > 0 && c.spend.mil < mobFloor) c.spend.mil = mobFloor;
  const at = armyTarget(c);
  c.army += (at - c.army) * (at > c.army ? 0.05 : 0.03);
  c.readiness += ((58 + 12 * c.mob + (atWar(c.iso) ? 14 : 0)) - c.readiness) * 0.1;
  if (c.flags.readyBoost) { c.readiness = Math.min(100, c.readiness + c.flags.readyBoost); c.flags.readyBoost = 0; }
  c.readiness = clamp(c.readiness, 10, 100);
  if (isMe) {
    c.infraIdx = clamp(c.infraIdx + (c.spend.infra - 2.5) * 0.35 - c.infraIdx * 0.004, 0, 100);
    c.secIdx = clamp(c.secIdx + (c.spend.sec - c.exp.sec) * 0.7 - (c.secIdx - 50) * 0.03, 0, 100);
    fiscalStep(c);
  }
}

function fiscalCalc(c) {
  const w = S.world;
  const taxGross = c.gdp * c.tax / 1200, leak = taxGross * c.corr / 450, taxNet = taxGross - leak;
  const rents = c.gdp * c.rent * w.oil / 1200, tariffs = c.flags.tariffs ? c.gdp * 0.0035 / 12 : 0;
  const rev = taxNet + rents + tariffs;
  const admin = c.gdp * c.adminPct / 1200 * (c.iso === S.player ? 1 - compBonus('treasury') * 0.03 : 1);
  const dp = debtPct(c);
  const rate = clamp(c.rateBase + 0.35 * (c.infl - c.baseInfl) + Math.max(0, dp - Math.max(c.dpRef, 60)) * (c.iso === S.player ? 0.02 : 0.04) + creditPrem(c) + (c.flags.creditHit || 0), 0.3, 25);
  const interest = c.debtAbs * rate / 1200;
  const sp = k => c.gdp * c.spend[k] / 1200;
  const prog = sp('social') + sp('mil') + sp('infra') + sp('sec');
  const support = c.gdp * supportCostPct(c) / 1200, terr = c.gdp * terrCostPct(c) / 1200, proj = c.gdp * projectCostPct(c) / 1200, warc = c.gdp * warCostPct(c) / 1200;
  const spend = prog + admin + interest + support + terr + proj + warc;
  const lines = {
    rev: taxSplit(c, taxNet).concat([['Oil and resource income', rents], ['Tariffs', tariffs]]).filter(x => x[1] > 0),
    spend: [['Health, welfare and pensions', sp('social')], ['Armed forces', sp('mil')], ['Infrastructure and industry', sp('infra')], ['Police and security', sp('sec')], ['Administration', admin], ['Debt interest', interest], ['Support for allies', support], ['Upkeep of conquered lands', terr], ['National programmes', proj], ['Cost of the war', warc]].filter(x => x[1] > 0),
    leak,
  };
  return { rev, admin, interest, prog, spend, rate, dp, lines };
}
// the same tax take, shown by source: richer countries lean on income tax, poorer ones on sales tax,
// and the business slice swings with the economic cycle
function taxSplit(c, taxNet) {
  const rich = clamp((c.gdp / c.pop - 8) / 45, 0, 1);
  const biz = clamp(0.2 + 0.018 * c.growth - 0.004 * Math.max(0, c.unemp - 6), 0.1, 0.32);
  const inc = clamp(0.22 + 0.3 * rich - 0.02 * Math.max(0, c.unemp - 6), 0.15, 0.56);
  const sales = Math.max(0.1, 1 - biz - inc);
  const t = biz + inc + sales;
  return [['Income and payroll taxes', taxNet * inc / t], ['Business and corporate taxes', taxNet * biz / t], ['Sales and consumption taxes', taxNet * sales / t]];
}
function fiscalPreview(c) {
  const f = fiscalCalc(c);
  return { rev: f.rev * 12, spend: f.spend * 12, interest: f.interest * 12, admin: f.admin * 12, prog: f.prog * 12, rate: f.rate, balance: (f.rev - f.spend) * 12, revPct: f.rev * 1200 / c.gdp, spendPct: f.spend * 1200 / c.gdp, balPct: (f.rev - f.spend) * 1200 / c.gdp };
}
function fiscalStep(c) {
  const f = fiscalCalc(c); const rev = f.rev, spend = f.spend;
  const net0 = c.treasury - c.debtAbs, oneOff = c.netMark == null ? 0 : net0 - c.netMark, tre0 = c.treasury, debt0 = c.debtAbs, gdpPrev = c.ledger ? c.ledger.gdp : c.gdp;
  c.fisc = { rev: rev * 12, spend: spend * 12, interest: f.interest * 12, rate: f.rate, balance: (rev - spend) * 12, revPct: rev * 1200 / c.gdp, spendPct: spend * 1200 / c.gdp };
  c.treasury += rev - spend;
  if (c.treasury < 0) {
    const need = -c.treasury, cap = marketCap(c), borrow = Math.min(need, cap);
    c.debtAbs += borrow; c.treasury = 0;
    if (need > borrow) marketShutOut(c, need - borrow);
    else if (c.credit) c.credit.gapNow = 0;
  } else if (c.credit) c.credit.gapNow = 0;
  const cap = c.gdp * 0.03;
  if (c.treasury > cap) { const pay = c.treasury - cap; c.debtAbs = Math.max(0, c.debtAbs - pay); c.treasury -= pay; }
  if (c.flags.creditHit) c.flags.creditHit = Math.max(0, c.flags.creditHit - 0.05);
  c.netMark = c.treasury - c.debtAbs;
  c.ledgerPrev = c.ledger || null;
  c.ledger = { turn: S.turn, date: dateLabel(S.date.m === 0 ? { y: S.date.y - 1, m: 11 } : { y: S.date.y, m: S.date.m - 1 }), rev: rev, spend: spend, revLines: f.lines.rev, spendLines: f.lines.spend, leak: f.lines.leak, bal: rev - spend, oneOff, treasury: c.treasury, dTreasury: c.treasury - tre0, debt: c.debtAbs, dDebt: c.debtAbs - debt0, gdp: c.gdp, growth: c.growth, rate: f.rate, dpct: f.dp };
}

function politicsStep(c) {
  const g = GOV[c.gov];
  const isAt = atWar(c.iso);
  // approval
  const t = apprTarget(c).t;
  c.appr = clamp(c.appr + (t - c.appr) * 0.2 + gauss() * 0.6, 3, 97);
  // factions
  let tb = 55 + clamp(c.growth - 2, -5, 5) * 2.5 - (c.tax - c.taxBase) * 1.4 - Math.max(0, c.infl - 8) * 0.6 + modSum(c, 'fbusiness') - (c.mob * 3);
  c.fac.business += (tb - c.fac.business) * 0.08 + gauss() * 0.5;
  let tm = 52 + (c.spend.mil - c.exp.mil - 1.3 * c.mob) * 7 + modSum(c, 'fmilitary') + (isAt ? clamp((c.warSuccess || 0) * 0.12, -12, 12) : 0) - (c.stab < 30 ? 6 : 0);
  c.fac.military += (tm - c.fac.military) * 0.08 + gauss() * 0.5;
  let tp = 52 + (c.appr - 50) * (isDemo(c.gov) ? 0.45 : 0.25) - Math.max(0, c.corr - 50) * 0.1 + modSum(c, 'fparty') - (c.flags.recentScandal ? 6 : 0);
  c.fac.party += (tp - c.fac.party) * 0.08 + gauss() * 0.5;
  c.fac.public = c.appr;
  FAC.forEach(f => c.fac[f] = clamp(c.fac[f], 1, 99));
  // stability
  const ts = stabTarget(c).t;
  c.stab = clamp(c.stab + (ts - c.stab) * 0.15 + gauss() * 0.5, 2, 99);
  // war weariness
  if (isAt) {
    const bl = warsOf(c.iso); let heat = 0;
    bl.forEach(w => { const mine = w.a.includes(c.iso) ? 'a' : 'b'; heat += (w.intensity || 1) * (mine === 'b' && w.aggressor !== 'b' ? 0.6 : 1); });
    c.warWeary = clamp(c.warWeary + heat * 0.9 * g.war, 0, 100);
  } else c.warWeary *= 0.93;
  // slow drifts
  c.corr = clamp(c.corr + (g.corr - c.corr) * 0.004 + (isAuto(c.gov) ? 0.02 : 0), 0, 100);
  c.prest = clamp(c.prest + (30 + Math.min(40, Math.log10(c.gdp + 1) * 9) + (c.nukes ? 6 : 0) + (c.flags.prestige || 0) - c.prest) * 0.02, 0, 100);
  if (c.flags.prestige) c.flags.prestige *= 0.97;
  if (c.flags.recentScandal) c.flags.recentScandal = Math.max(0, c.flags.recentScandal - 1);
  // political capital
  const regen = clamp((1.9 + (c.fac.party - 50) / 35 + (c.appr - 50) / 50) * g.pcMult - (isAt ? 0.4 : 0), 0.9, 4.3);
  S.pc = Math.min(S.pcMax, S.pc + regen);
  S.pcRegen = regen;
}

// AI countries: lighter step
function aiStep(c) {
  econStep(c, false);
  const g = GOV[c.gov];
  const t = ({ 4: 66, 3: 60, 2: 52, 1: 44 })[c.tier] + (c.fragile ? -14 : 0) + (c.gov === 'D' ? 4 : 0) + (c.growth - c.baseGrowth) * 1.5 - (c.warDmg || 0) * 2 - c.warWeary * 0.1 + modSum(c, 'stab');
  c.stab = clamp(c.stab + (t - c.stab) * 0.08 + gauss() * 1.1, 2, 99);
  c.appr = clamp(c.appr + (55 - 0.3 * (50 - c.stab) - c.appr) * 0.05 + gauss() * 0.8, 5, 95);
  c.fac.public = c.appr;
  if (atWar(c.iso)) c.warWeary = clamp(c.warWeary + 0.9 * g.war, 0, 100); else c.warWeary *= 0.93;
  c.prest = clamp(c.prest + (30 + Math.min(40, Math.log10(c.gdp + 1) * 9) + (c.nukes ? 6 : 0) - c.prest) * 0.02, 0, 100);
  // military posture drifts with world tension and neighbours
  const target = c.exp.mil * (1 + (S.world.tension - 30) / 250 + (atWar(c.iso) ? 0.35 : 0));
  c.spend.mil += (target - c.spend.mil) * 0.03;
  // AI arms and unrest: fragile juntas and hybrids sometimes fall
  if (c.stab < 20 && chance(0.012 * (c.fragile ? 1.6 : 1))) regimeChange(c, 'unrest');
}

const NEW_GOV = { D: ['D', 'H'], H: ['D', 'H', 'J', 'P'], M: ['M', 'H', 'D'], O: ['O', 'H', 'P'], J: ['J', 'H', 'D', 'P'], T: ['T', 'J', 'H'], P: ['P', 'J', 'H', 'D'] };
function regimeChange(c, why) {
  const to = pick(NEW_GOV[c.gov]) === c.gov ? pick(['J', 'H', 'P', 'D']) : pick(NEW_GOV[c.gov]);
  const from = c.gov; c.gov = to; c.stab = clamp(c.stab + 25, 30, 70); c.appr = 52;
  const g = GOV[to]; c.free = g.free; c.corr = clamp(g.corr + gauss() * 5, 10, 90); c.flags.customGov = 1; S.dirtyBase = true;
  const how = to === 'J' ? 'A military coup topples the government in ' : to === 'D' ? 'Mass protests force democratic transition in ' : to === 'H' ? 'A contested transition reshapes politics in ' : 'A strongman consolidates power in ';
  news(how + c.name + ' (now ' + GOV[to].name.toLowerCase() + ').', 'politics', c.iso);
  if (c.iso === S.player) return;
  if (typeof replaceLeader === 'function') replaceLeader(c.iso, true);
  // neighbours react
  (NB[c.iso] || []).forEach(n => { if (alive(n)) addR(c.iso, n, -4); });
}

// ---------- survival ----------
function hazards(c) {
  const g = GOV[c.gov]; const d = S.diff;
  const h = { coup: 0, palace: 0, uprising: 0, noconf: 0 };
  h.coup = g.coup * 0.08 * Math.pow(Math.max(0, (48 - c.fac.military) / 48), 1.3) * (1 + Math.max(0, (40 - c.stab) / 40)) * d * (c.flags.coupProof > S.turn ? 0.35 : 1);
  if (['M', 'O', 'T', 'P'].includes(c.gov)) h.palace = 0.06 * Math.pow(Math.max(0, (42 - c.fac.party) / 42), 1.3) * d;
  h.uprising = (c.stab < 24 && c.appr < 40) ? 0.06 * Math.pow((24 - c.stab) / 24, 1.2) * (c.free > 60 ? 0.5 : 1) * d : 0;
  if (isDemo(c.gov)) h.noconf = c.fac.party < 30 ? 0.06 * Math.pow((30 - c.fac.party) / 30, 1.2) * d : 0;
  h.total = 1 - (1 - h.coup) * (1 - h.palace) * (1 - h.uprising) * (1 - h.noconf);
  return h;
}
function checkSurvival(c) {
  const h = hazards(c);
  const roll = rnd();
  if (roll < h.total) {
    const parts = [['coup', h.coup], ['palace', h.palace], ['uprising', h.uprising], ['noconf', h.noconf]];
    const tot = parts.reduce((s, p) => s + p[1], 0) || 1;
    let r = rnd() * tot, kind = 'uprising';
    for (const p of parts) { r -= p[1]; if (r <= 0) { kind = p[0]; break; } }
    const texts = {
      coup: ['Overthrown in a coup', 'Officers moved before dawn. Tanks surrounded the palace, state television went dark, and by morning the army announced that you had been removed. Your military support had collapsed and you did not see it in time.'],
      palace: ['Removed by your own inner circle', 'The people you relied on decided you were the problem. A quiet vote behind closed doors ended your rule before the public even knew there was a crisis.'],
      uprising: ['Toppled by popular uprising', 'Unrest that started in the capital spread to every city. Security forces stopped obeying orders. You left by the back door as the crowds took the streets.'],
      noconf: ['Lost a vote of no confidence', 'Your own party turned on you. A confidence vote you could not win ended your time in office.'],
    };
    return { over: true, type: kind, title: texts[kind][0], text: texts[kind][1] };
  }
  if (rnd() < 0.00012 * (1 + (100 - c.appr) / 60 + (c.free < 30 ? 1 : 0)) + 0.0005 * (c.flags.terrHeat || 0)) return { over: true, type: 'assassin', title: 'Assassinated', text: 'A gunman got through your security. Your rule ends in a single moment on a public street.' };
  return null;
}

// ---------- elections ----------
function electionOdds(c) {
  const g = GOV[c.gov];
  let p = 0.5 + (c.fac.public - 47) / 42 + (c.fac.party - 50) / 300 + g.rig * (1 - c.free / 120) + (S.flags.campaign || 0);
  if (c.corr > 50 && c.gov === 'H') p += 0.05;
  return clamp(p, 0.03, 0.97);
}
