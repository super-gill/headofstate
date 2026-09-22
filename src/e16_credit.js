// ===================== SOVEREIGN CREDIT RATING =====================
// A visible rating from AAA to CCC. It moves one notch at a time, prices the country's borrowing,
// and at the bottom it can shut you out of the bond market.

const RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'];
const RATING_PREM = [0, 0.15, 0.4, 0.9, 1.8, 3.2, 5.5];   // percentage points on the borrowing rate, relative to the start
const RATING_CUTS = [84, 74, 63, 52, 41, 30];               // score at or above the cut earns that rating index (0 = AAA)
// countries that borrow in a currency the world wants: markets forgive them more
const RESERVE_SLACK = { USA: 0.5, JPN: 0.35, GBR: 0.7, CHE: 0.6, DEU: 0.75, FRA: 0.8, NLD: 0.75, AUT: 0.8, BEL: 0.8, FIN: 0.8, IRL: 0.8, LUX: 0.75, ITA: 0.85, ESP: 0.85, PRT: 0.85, GRC: 0.85, CAN: 0.75, AUS: 0.75, SGP: 0.6 };
// track record, currency history and governance that the raw numbers miss (points off the score; negative means a bonus)
const RISK = { TUR: 40, RUS: 28, ARG: 15, SAU: 14, ARE: 8, IDN: 14, VNM: 16, ROU: 16, POL: 10, CHN: -8, IND: -6, MEX: 8, HUN: 12, JPN: -6, ISR: 8, HTI: 15, PRK: 15, NGA: 4, UKR: 25, SGP: -18, CHL: 8, PER: 6, COL: 10, PHL: -2 };
const ratingName = i => RATINGS[Math.max(0, Math.min(6, i))];
const ratingIdxFor = score => { let i = 6; for (let k = 0; k < RATING_CUTS.length; k++) if (score >= RATING_CUTS[k]) { i = k; break; } return i; };

// the score and what is driving it. Higher is safer.
function creditScore(c) {
  const f = fiscalCalc(c), P = [];
  const slack = RESERVE_SLACK[c.iso] || 1, war = atWar(c.iso);
  const dp = debtPct(c);
  const inst = ({ 4: 0, 3: 8, 2: 22, 1: 32 })[c.tier] + (c.fragile ? 8 : 0) + Math.max(0, c.corr - 35) * 0.22 + (RISK[c.iso] || 0);
  P.push(['Institutions and wealth', -inst]);
  P.push(['Debt burden', -Math.max(0, dp - 40) * 0.4 * slack * (war ? 0.8 : 1)]);
  const def = -(f.rev - f.spend) * 1200 / c.gdp;                 // deficit, % of GDP a year
  const defAvg = c.credit && c.credit.defAvg != null ? c.credit.defAvg : def;
  P.push(['Deficit', -Math.max(0, defAvg - 1) * 3.5 * slack * (war ? 0.4 : 1)]);
  P.push(['Interest bill', -Math.max(0, f.interest / Math.max(1e-9, f.rev) - 0.12) * 50 * slack]);
  P.push(['Inflation', -Math.max(0, c.infl - c.baseInfl - 3) * 1.0]);
  P.push(['Political stability', -Math.max(0, 40 - c.stab) * 0.5]);
  if (!war) P.push(['Recession', -Math.max(0, -c.growth) * 1.2]);
  if (c.credit && c.credit.planBonus) P.push(['Consolidation plan', c.credit.planBonus]);
  if (c.credit && c.credit.stress > 1) P.push(['Memory of past trouble', -Math.min(15, c.credit.stress * 0.4)]);
  if (c.credit && c.credit.lockUntil && S.turn < c.credit.lockUntil) P.push(['Recent default', -12]);
  const score = clamp(100 + P.reduce((a, b) => a + b[1], 0), -15, 100);
  return { score, parts: P, def };
}

function creditEnsure() {
  const c = me(); if (!c) return null;
  if (!c.credit) {
    const s = creditScore(c); const idx = ratingIdxFor(s.score);
    c.credit = { idx, idx0: idx, score: s.score, changed: S.turn, since: S.turn, defAvg: s.def, ccc: 0, lastAuction: -99, planBonus: 0, planUntil: 0, trend: 0 };
  }
  return c.credit;
}
// borrowing-cost premium, relative to where the rating started (a downgrade raises it, an upgrade lowers it)
function creditPrem(c) {
  if (c.iso !== S.player || !c.credit) return 0;
  return Math.max(-0.4, RATING_PREM[c.credit.idx] - RATING_PREM[c.credit.idx0]);
}

// how much the bond market will lend in one month. Only the bottom two grades are rationed.
function marketCap(c) {
  if (c.iso !== S.player || !c.credit) return Infinity;
  if (c.credit.lockUntil && S.turn < c.credit.lockUntil) return c.gdp * 0.005 / 12;   // after a default nobody lends
  return c.credit.idx >= 6 ? c.gdp * 0.02 / 12 : c.credit.idx === 5 ? c.gdp * 0.045 / 12 : Infinity;
}
// what cannot be borrowed cannot be paid: wages and pensions run late, and people notice
function marketShutOut(c, gap) {
  const cr = creditEnsure(); const pct = gap * 12 / c.gdp * 100;
  // the unpaid bills are not forgiven: they become arrears debt and carry interest like any other
  c.debtAbs += gap; cr.gapNow = gap; cr.arrears = (cr.arrears || 0) + gap;
  // and the state has to live within what it can fund: ministries are forced to cut in proportion to the shortfall
  const prog = c.gdp * (c.spend.social + c.spend.mil + c.spend.infra + c.spend.sec) / 1200;
  const u = clamp(gap / Math.max(1e-9, prog), 0.02, 0.4);
  ['social', 'mil', 'infra', 'sec'].forEach(k => { const lo = (BUDGET_LIM[k] || [0])[0]; c.spend[k] = Math.max(lo, Math.round(c.spend[k] * (1 - u) * 10) / 10); });
  addMod(c, 'growth', -Math.min(0.4, pct * 0.05), 6);
  addMod(c, 'stab', -Math.min(8, pct * 1.0), 2); addMod(c, 'appr', -Math.min(10, pct * 1.0), 2);
  if (S.turn - (cr.arrearsNews || -99) >= 6) { cr.arrearsNews = S.turn; news('Unable to borrow enough, ' + nm(S.player) + '\'s government is paying salaries and pensions late and ministries are ordered to cut.', 'economy', S.player); logPlayer('The bond market will not lend enough. Payments are late and your budgets have been cut by ' + Math.round(u * 100) + '%.'); }
}

function creditStep() {
  const c = me(); const cr = creditEnsure(); if (!c || !cr) return;
  const f = fiscalCalc(c); const def = -(f.rev - f.spend) * 1200 / c.gdp;
  cr.defAvg += (def - cr.defAvg) * 0.25;
  if (cr.planUntil && S.turn >= cr.planUntil) { cr.planBonus = 0; cr.planUntil = 0; }
  const prev = cr.score;
  const s = creditScore(c); cr.score = cr.score + (s.score - cr.score) * 0.3;   // scores move gradually
  cr.trend = cr.score - prev;
  const target = ratingIdxFor(cr.score);
  // hysteresis: the score has to clear the boundary by a margin, and moves are spaced out
  const cutAt = i => RATING_CUTS[i];                                           // boundary between index i and i+1 is RATING_CUTS[i]
  const since = S.turn - cr.changed;
  if (target > cr.idx && since >= 3 && cr.score < RATING_CUTS[cr.idx] - 1.5) {
    const old = cr.idx; cr.idx = Math.min(6, cr.idx + 1); cr.changed = S.turn; cr.lastMove = { from: old, to: cr.idx, t: S.turn };
    ratingChange(old, cr.idx, s);
  } else if (target < cr.idx && since >= 12 && cr.score >= RATING_CUTS[cr.idx - 1] + 2) {
    const old = cr.idx; cr.idx = cr.idx - 1; cr.changed = S.turn; cr.lastMove = { from: old, to: cr.idx, t: S.turn };
    ratingChange(old, cr.idx, s);
  }
  cr.ccc = cr.idx === 6 ? cr.ccc + 1 : 0;
  cr.stress = (cr.stress || 0) * 0.975 + (cr.idx >= 5 ? 1 : 0);
  // market shut-out at the bottom
  const pending = S.events.some(e => e.id === 'failedAuction' || e.id === 'forcedAusterity');
  if (!pending && S.events.length < 3 && cr.idx >= 5 && def > 1 && S.turn - cr.lastAuction >= 8) {
    const p = cr.idx === 6 ? 0.06 : (cr.score < 33 ? 0.015 : 0);
    if (chance(p)) { cr.lastAuction = S.turn; queueEvent(cr.ccc >= 10 && chance(0.5) ? 'forcedAusterity' : 'failedAuction', {}); }
  }
}

function ratingChange(from, to, s) {
  const c = me(), down = to > from;
  const worst = s.parts.slice().sort((a, b) => a[1] - b[1]).filter(x => x[1] < -1.5 && x[0] !== 'Institutions and wealth').slice(0, 2).map(x => x[0].toLowerCase());
  const why = down ? (worst.length ? 'Agencies point to ' + worst.join(' and ') + '.' : 'Agencies cite the overall trend.') : 'Agencies credit a steadier budget and economy.';
  news(nm(S.player) + '\'s credit rating is ' + (down ? 'cut' : 'raised') + ' to ' + ratingName(to) + ' from ' + ratingName(from) + '.', 'economy', S.player);
  logPlayer('Credit rating ' + (down ? 'cut' : 'raised') + ': ' + ratingName(from) + ' to ' + ratingName(to) + '.');
  if (down) {
    queueEvent('ratingCut', { from, to, why });
  } else {
    addMod(c, 'appr', 1, 4); c.prest = clamp(c.prest + 0.5, 0, 100);
  }
}

function creditInfo() {
  const c = me(); const cr = creditEnsure(); if (!cr) return null;
  const s = creditScore(c);
  const cutUp = cr.idx > 0 ? RATING_CUTS[cr.idx - 1] : null, cutDown = cr.idx < 6 ? RATING_CUTS[cr.idx] : null;
  const nearDown = cr.idx < 6 && cr.score < cutDown + 3, nearUp = cr.idx > 0 && cr.score > cutUp - 3;
  const outlook = (cr.trend < -0.2 || (nearDown && cr.trend < 0.1)) && cr.idx < 6 ? 'Negative' : (cr.trend > 0.2 || (nearUp && cr.trend > -0.1)) && cr.idx > 0 ? 'Positive' : 'Stable';
  const prem = creditPrem(c);
  const parts = s.parts.filter(x => Math.abs(x[1]) >= 0.5).map(x => ({ label: x[0], v: x[1] }));
  const f = fiscalCalc(c);
  const borrowing = c.treasury <= c.gdp * 0.0005 && f.rev < f.spend;
  return { rating: ratingName(cr.idx), idx: cr.idx, start: ratingName(cr.idx0), outlook, score: cr.score, parts, premium: prem, rate: f.rate, junk: cr.idx >= 4, borrowing, capYr: isFinite(marketCap(c)) ? marketCap(c) * 12 : null, gap: (cr.gapNow || 0) * 12, arrears: cr.arrears || 0, since: S.turn - cr.changed, last: cr.lastMove || null, defPct: s.def,
    slack: RESERVE_SLACK[c.iso] ? (c.iso === 'USA' ? 'Your currency is the world\'s reserve currency, so markets are slow to punish you.' : 'Markets give your currency extra slack.') : '', war: atWar(c.iso) };
}

// ---- events ----
ev('ratingCut', { cat: 'system',
  title: x => 'Credit rating cut to ' + ratingName(x.to),
  text: x => 'A major agency has downgraded your government debt from ' + ratingName(x.from) + ' to ' + ratingName(x.to) + '. ' + x.why + (x.to >= 4 ? ' The new grade is below investment level, and many funds are now barred from holding your bonds. Borrowing will cost more.' : ' Borrowing will cost a little more.') + (x.to >= 5 ? ' Lenders will now ration new borrowing to about ' + (x.to === 6 ? '2' : '4.5') + '% of GDP a year. Bills beyond that go unpaid, and your budgets are cut to fit.' : '') + (isDemo(me().gov) ? ' The opposition is already calling it a failure.' : ' Rivals inside the regime are quietly noting it.'),
  options: x => [
    opt('Announce a credible plan to cut the deficit', 'Costs 1 political capital. Adds 4 points to your credit score for a year and starts a pledge to get the deficit under 2% of GDP. Breaking it costs you.', () => {
      S.pc -= pcCost(1); const cr = creditEnsure(); cr.planBonus = 4; cr.planUntil = S.turn + 12; addPledge('balanceBudget', 12);
      return 'You promise a path back to balance. The agencies say they will watch the next two budgets.';
    }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
    opt('Call the agencies biased', 'Rallies some voters and costs some standing abroad. Changes nothing in the numbers.', () => { ap(me(), 1, 3); me().prest = clamp(me().prest - 1, 0, 100); return 'You blame foreign agencies with an agenda. It plays well at home and less well in the markets.'; }),
    opt('Say nothing and carry on', 'Free, but investors read silence as drift. Borrowing costs creep up a little.', () => { me().flags.creditHit = (me().flags.creditHit || 0) + 0.3; return 'The news cycle moves on. The interest bill does not.'; }),
  ] });

ev('failedAuction', { cat: 'system',
  title: () => 'Bond auction fails',
  text: () => 'Your treasury tried to sell government bonds and did not find enough buyers. Yields spiked within the hour. Without cash you cannot pay salaries and pensions in full at the end of the month. You must decide how to cover the gap.',
  options: () => {
    const c = me();
    return [
      opt('Emergency spending cuts', 'Cuts social spending by 0.8% of GDP and defence by 0.3%, and raises taxes 1.5 points. Costs approval and stability, but the gap closes.', () => {
        c.spend.social = Math.max(c.exp.social * 0.7, c.spend.social - 0.8); c.spend.mil = Math.max(c.exp.mil * 0.7, c.spend.mil - 0.3); c.tax = clamp(c.tax + 1.5, 5, 60);
        ap(c, -6, 8); addMod(c, 'stab', -3, 8); const cr = creditEnsure(); cr.planBonus = Math.max(cr.planBonus, 3); cr.planUntil = S.turn + 9;
        return 'The cuts are announced overnight. Protesters gather, but the payments go out.';
      }),
      opt('Have the central bank print money', 'The central bank finances the gap, cutting the debt burden by 2% of GDP. Inflation rises about 3.5 points for 18 months, and the rating suffers.', () => {
        writeDown(c, Math.min(c.debtAbs, c.gdp * 0.02)); addMod(c, 'infl', 3.5, 18); c.prest = clamp(c.prest - 2, 0, 100); const cr = creditEnsure(); cr.score -= 3; c.flags.creditHit = (c.flags.creditHit || 0) + 0.8;
        return 'The printing presses run. Prices begin to climb, and savers notice.';
      }),
      opt('Ask for an emergency loan', 'Costs 1 political capital. Adds 3% of GDP in cash, but with conditions: social spending cut by 0.6%, taxes up 1 point, and a balanced-budget pledge for two years.', () => {
        S.pc -= pcCost(1); c.treasury += c.gdp * 0.03; c.debtAbs += c.gdp * 0.03; c.spend.social = Math.max(c.exp.social * 0.75, c.spend.social - 0.6); c.tax = clamp(c.tax + 1, 5, 60);
        ap(c, -3, 12); addPledge('balanceBudget', 24); const cr = creditEnsure(); cr.planBonus = Math.max(cr.planBonus, 5); cr.planUntil = S.turn + 18; c.prest = clamp(c.prest - 1, 0, 100);
        return 'The loan arrives with a long list of conditions. Money is tight, but the doors stay open.';
      }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
    ];
  } });

ev('forcedAusterity', { cat: 'system',
  title: () => 'Lenders demand austerity',
  text: () => 'After months of rating pressure, your creditors say they will lend no more unless you cut sharply. The alternative is to stop paying part of the debt. Both roads are ugly.',
  options: () => {
    const c = me();
    return [
      opt('Accept a harsh austerity programme', 'Deep cuts and higher taxes for two years. Approval, stability and growth all take a hit, but the market reopens.', () => {
        c.spend.social = Math.max(c.exp.social * 0.65, c.spend.social - 1.2); c.spend.mil = Math.max(c.exp.mil * 0.7, c.spend.mil - 0.4); c.spend.infra = Math.max(1, c.spend.infra - 0.5); c.tax = clamp(c.tax + 2.5, 5, 60);
        ap(c, -8, 12); addMod(c, 'stab', -5, 10); addMod(c, 'growth', -1.0, 14); const cr = creditEnsure(); cr.planBonus = 6; cr.planUntil = S.turn + 18; addPledge('balanceBudget', 24);
        return 'The programme is signed. Ministries are told to find savings by Friday.';
      }),
      opt('Restructure the debt', 'Creditors take a loss of about a quarter. The bill falls, but for two years lenders will barely lend to you, your score takes a hit, and your standing suffers.', () => {
        writeDown(c, c.debtAbs * 0.28); const cr0 = creditEnsure(); cr0.lockUntil = S.turn + 24; c.prest = clamp(c.prest - 8, 0, 100); addMod(c, 'growth', -1.2, 18); c.flags.creditHit = (c.flags.creditHit || 0) + 2; ap(c, -3, 6); addMod(c, 'stab', -3, 8);
        const cr = creditEnsure(); cr.score = Math.min(cr.score, RATING_CUTS[5] - 3); cr.changed = S.turn;
        news(nm(S.player) + ' restructures its national debt, leaving creditors with losses.', 'economy', S.player); logPlayer('You restructured the national debt.');
        return 'You announce a restructuring. Bondholders are furious. The relief is real, and so is the stigma.';
      }),
    ];
  } });

// debt reduced by a deal, not by cash: keep it out of the month's one-off line
function writeDown(c, amt) { c.debtAbs = Math.max(0, c.debtAbs - amt); if (c.netMark != null) c.netMark += amt; }
Object.assign(Engine, { creditInfo, creditProbe: iso => { const c = C(iso); const s = creditScore(c); return { rating: ratingName(ratingIdxFor(s.score)), score: s.score, parts: s.parts }; } });
