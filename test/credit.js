// Credit rating stress test: reckless vs prudent budgets, and what the rating does.
const E = require('../dist/engine.js');
const modes = { reckless: c => { E.setBudget('tax', c.taxBase - 8); E.setBudget('social', c.exp.social + 6); }, prudent: c => { E.setBudget('tax', c.taxBase + 2); E.setBudget('social', c.exp.social - 1); }, default: () => {} };
const rows = []; let errs = 0;
for (const pl of (process.argv[2] || 'USA,ITA,NGA,JPN,DEU').split(',')) for (const m of Object.keys(modes)) for (let sd = 1; sd <= 3; sd++) {
  try {
    E.newGame({ player: pl, leader: 'Bot', seed: sd * 7919, diff: 1, temper: 1, termLimits: false });
    const S = E.S; const hist = []; const evs = {}; let last = E.creditInfo().rating; const start = last;
    modes[m](E.me());
    while (!S.over && S.turn < 72) {
      let g = 0; while (E.currentEvent() && g++ < 20) { const ev = E.currentEvent(); evs[ev.id] = (evs[ev.id] || 0) + 1; const ok = ev.options.filter(o => o.ok); E.resolveEvent(ok.length ? ok[0].i : 0); }
      if (S.over) break;
      E.endTurn();
      const ci = E.creditInfo(); if (ci.rating !== last) { hist.push(S.turn + ':' + last + '>' + ci.rating); last = ci.rating; }
    }
    const c = E.me(), ci = E.creditInfo();
    rows.push({ pl, m, sd, over: S.over ? S.over.type : 'alive', t: S.turn, start, end: ci.rating, debt: Math.round(E.debtPct(c)), rate: ci.rate.toFixed(1), appr: Math.round(c.appr), hist: hist.join(' '), auct: evs.failedAuction || 0, forced: evs.forcedAusterity || 0, cuts: evs.ratingCut || 0 });
  } catch (e) { errs++; console.log('ERR', pl, m, e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.table(rows); console.log('errors', errs);
