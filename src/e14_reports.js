// ===================== MONTHLY AND ANNUAL REPORTS =====================

function yrFresh() {
  const c = me();
  const rel = {}; topEconomies(12).forEach(i => { rel[i] = R(S.player, i); });
  return { startTurn: S.turn, rev: {}, spend: {}, oneOff: 0, months: 0, gSum: 0, iSum: 0, uSum: 0, balSum: 0, gdpSum: 0, debt0: c.debtAbs, treasury0: c.treasury, rel,
    credit0: c.credit ? c.credit.idx : null, start: { gdp: c.gdp, gdppc: c.gdp / c.pop, appr: c.appr, stab: c.stab, prest: c.prest, debt: debtPct(c), unemp: c.unemp, tension: S.world.tension, army: c.army, free: c.free, corr: c.corr },
    ranks: { gdp: ranks().gdp[S.player], pow: ranks().pow[S.player] }, allies: defenceAllies(S.player).length, stat: { won: S.stat.warsWon, lost: S.stat.warsLost, declared: S.stat.declared || 0, annexed: S.stat.annexed, events: S.stat.eventsSeen, intelR: S.stat.intelRight || 0, intelW: S.stat.intelWrong || 0 } };
}
function topEconomies(n) { return aliveList().filter(i => i !== S.player).sort((a, b) => C(b).gdp - C(a).gdp).slice(0, n); }

function reportsStep() {
  const c = me(), L = c.ledger; if (!L) return;
  if (!S.yr) S.yr = yrFresh();
  const y = S.yr;
  L.revLines.forEach(([k, v]) => { y.rev[k] = (y.rev[k] || 0) + v; });
  L.spendLines.forEach(([k, v]) => { y.spend[k] = (y.spend[k] || 0) + v; });
  y.oneOff += L.oneOff; y.months++; y.gSum += c.growth; y.iSum += c.infl; y.uSum += c.unemp; y.balSum += L.bal; y.gdpSum += c.gdp;
  if (S.date.m === 0 && y.months >= 6) { buildAnnual(); S.yr = yrFresh(); }
}

const GRADES = ['F', 'D', 'C', 'B', 'A'];
const gradeBy = (v, cuts) => { let g = 0; cuts.forEach((c, i) => { if (v >= c) g = i + 1; }); return GRADES[g]; };
const gradeNum = g => GRADES.indexOf(g);

function buildAnnual() {
  const c = me(), y = S.yr, n = Math.max(1, y.months);
  const totRev = Object.values(y.rev).reduce((a, b) => a + b, 0), totSpend = Object.values(y.spend).reduce((a, b) => a + b, 0);
  const gdpAvg = y.gdpSum / n, balPct = (totRev - totSpend + y.oneOff) / gdpAvg * 100;
  const cur = { gdp: c.gdp, gdppc: c.gdp / c.pop, appr: c.appr, stab: c.stab, prest: c.prest, debt: debtPct(c), unemp: c.unemp, tension: S.world.tension, army: c.army, free: c.free, corr: c.corr };
  const st = y.start;
  const growthAvg = y.gSum / n, inflAvg = y.iSum / n;
  const chg = (label, from, to, dec, unit, dir) => ({ label, from: +from.toFixed(dec), to: +to.toFixed(dec), unit: unit || '', good: (to - from) * (dir || 1) >= 0, flat: Math.abs(to - from) < Math.pow(10, -dec) * 0.6 });
  const stats = [
    chg('Approval', st.appr, cur.appr, 0, '%'), chg('Stability', st.stab, cur.stab, 0), chg('Economy', st.gdp, cur.gdp, 0, '', 1), chg('Income per person', st.gdppc * 1000, cur.gdppc * 1000, 0, '', 1),
    chg('Unemployment', st.unemp, cur.unemp, 1, '%', -1), chg('Debt to GDP', st.debt, cur.debt, 0, '%', -1), chg('Prestige', st.prest, cur.prest, 0), chg('World tension', st.tension, cur.tension, 0, '', -1),
  ];
  stats[2].pct = +((cur.gdp / st.gdp - 1) * 100).toFixed(1); stats[3].pct = +((cur.gdppc / st.gdppc - 1) * 100).toFixed(1);
  // relations with the biggest economies
  const rel = Object.keys(y.rel).map(i => ({ iso: i, name: nm(i), from: Math.round(y.rel[i]), to: Math.round(R(S.player, i)), d: R(S.player, i) - y.rel[i] })).filter(x => alive(x.iso));
  const gain = rel.slice().sort((a, b) => b.d - a.d).filter(x => x.d >= 4).slice(0, 2), lose = rel.slice().sort((a, b) => a.d - b.d).filter(x => x.d <= -4).slice(0, 2);
  const rk = ranks(); const allies = defenceAllies(S.player).length;
  // grades
  const ci = creditInfo(); const notch = ci && y.credit0 != null ? ci.idx - y.credit0 : 0;
  const structPct = (totRev - totSpend) / gdpAvg * 100;   // one-offs (sales, windfalls) do not count towards the grade
  const finScore = structPct - Math.max(0, cur.debt - st.debt) * 0.15 - Math.max(0, notch) * 1.2;
  const grades = [
    { area: 'Economy', g: gradeBy(growthAvg - Math.max(0, inflAvg - c.baseInfl - 2) * 0.3, [0, 1.2, 2.5, 4]), note: 'Real growth averaged ' + growthAvg.toFixed(1) + '%, inflation ' + inflAvg.toFixed(1) + '%. (The Economy figure above is in current dollars, so it also includes inflation.)' },
    { area: 'Public mood', g: gradeBy(c.appr, [35, 45, 55, 65]), note: 'Approval ended at ' + Math.round(c.appr) + '%.' },
    { area: 'Stability', g: gradeBy(c.stab, [30, 45, 60, 75]), note: 'Stability ended at ' + Math.round(c.stab) + '.' },
    { area: 'Public finances', g: gradeBy(finScore, [-6, -3.5, -1.5, 0]), note: (balPct >= 0 ? 'Surplus' : 'Deficit') + ' of ' + Math.abs(balPct).toFixed(1) + '% of GDP, debt ' + Math.round(cur.debt) + '% of GDP' + (ci ? ', rated ' + ci.rating + '.' : '.') },
    { area: 'Standing abroad', g: gradeBy(c.prest + (rel.reduce((a, b) => a + b.d, 0) / Math.max(1, rel.length)) * 1.5, [30, 45, 58, 70]), note: 'Prestige ' + Math.round(c.prest) + ', ' + allies + ' defence ' + (allies === 1 ? 'partner' : 'partners') + '.' },
  ];
  const gpa = grades.reduce((a, g) => a + gradeNum(g.g), 0) / grades.length;
  const worst = grades.slice().sort((a, b) => gradeNum(a.g) - gradeNum(b.g))[0], best = grades.slice().sort((a, b) => gradeNum(b.g) - gradeNum(a.g))[0];
  // a failing area cannot be averaged away: the overall grade is at most one step above the worst area
  const overall = GRADES[Math.min(Math.round(gpa), gradeNum(worst.g) + 1)];
  const summary = (gradeNum(worst.g) <= 1 ? 'The weak spot this year was ' + worst.area.toLowerCase() + ' (' + worst.note + ') ' : 'No area fell below a C. ') + (gradeNum(best.g) >= 3 && best !== worst ? 'The best result was ' + best.area.toLowerCase() + '.' : '');
  const highlights = S.log.filter(l => l.turn != null && l.turn > y.startTurn).slice(0, 6).map(l => ({ d: l.d, text: l.text }));
  const wars = { won: S.stat.warsWon - y.stat.won, lost: S.stat.warsLost - y.stat.lost, declared: (S.stat.declared || 0) - y.stat.declared, annexed: S.stat.annexed - y.stat.annexed, active: S.wars.filter(w => w.a.concat(w.b).includes(S.player)).length };
  const rep = {
    year: S.date.y - 1, turn: S.turn,
    fiscal: { rev: Object.keys(y.rev).map(k => [k, y.rev[k]]), spend: Object.keys(y.spend).map(k => [k, y.spend[k]]), totRev, totSpend, oneOff: y.oneOff, balance: totRev - totSpend + y.oneOff, balPct, debt0: y.debt0, debt1: c.debtAbs, treasury1: c.treasury, gdpAvg },
    stats, grades, overall, summary, gain, lose, highlights, wars,
    ranks: { gdp: [y.ranks.gdp, rk.gdp[S.player]], pow: [y.ranks.pow, rk.pow[S.player]] }, allies: [y.allies, allies],
    intel: { right: (S.stat.intelRight || 0) - y.stat.intelR, wrong: (S.stat.intelWrong || 0) - y.stat.intelW },
    decisions: S.stat.eventsSeen - y.stat.events,
    ambition: S.ambition ? ambitionState() : null,
  };
  S.annuals = (S.annuals || []).concat([rep]).slice(-15); S.annualNew = true;
}

// ---- monthly view ----
function monthlyReport() {
  const c = me(), L = c.ledger; if (!L) return null;
  const P = c.ledgerPrev, pm = (lines, k) => { if (!P) return null; const l = (lines === 'rev' ? P.revLines : P.spendLines).find(x => x[0] === k); return l ? l[1] : 0; };
  const line = (kind, k, v) => { const p = pm(kind, k); return { label: k, v, d: p == null ? 0 : v - p, dPct: p ? (v / p - 1) * 100 : 0 }; };
  const before = S.stat && S.mBefore || null;
  return {
    date: L.date, rev: L.revLines.map(([k, v]) => line('rev', k, v)), spend: L.spendLines.map(([k, v]) => line('spend', k, v)), totRev: L.rev, totSpend: L.spend, oneOff: L.oneOff, bal: L.bal + L.oneOff, opBal: L.bal,
    treasury: L.treasury, debt: L.debt, dDebt: L.dDebt, dTreasury: L.dTreasury, gdp: L.gdp, growth: L.growth, rate: L.rate, dpct: L.dpct, leak: L.leak,
    prevRev: P ? P.rev : null, prevSpend: P ? P.spend : null, balPct: (L.bal + L.oneOff) * 12 / L.gdp * 100,
  };
}
function annualPending() { return !!S.annualNew; }
function annualLatest() { return (S.annuals || []).slice(-1)[0] || null; }
function annualAck() { S.annualNew = false; }
function annualList() { return (S.annuals || []).map(a => ({ year: a.year, overall: a.overall })); }
function annualByYear(y) { return (S.annuals || []).find(a => a.year === y) || null; }

Object.assign(Engine, { monthlyReport, annualPending, annualLatest, annualAck, annualList, annualByYear });
