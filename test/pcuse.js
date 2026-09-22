// Political capital use: how often the pool sits near its cap, and how much is spent per year.
const E = require('../dist/engine.js');
const pls = (process.argv[2] || 'USA,GBR,DEU,IND,NGA,RUS,SAU,BRA,TUR,IRN,EGY,JPN').split(','), yrs = +process.argv[3] || 5;
const mode = process.argv[4] || 'active';   // active: enacts a policy whenever it can afford one at random; lazy: only when at cap
let months = 0, atCap = 0, sumFrac = 0, spentTot = 0, n = 0, pols = 0, evPC = 0; const rows = [];
for (const pl of pls) for (let sd = 1; sd <= 3; sd++) {
  E.newGame({ player: pl, leader: 'Bot', seed: sd * 104729, diff: 1, temper: 1, termLimits: false });
  const S = E.S; let m0 = 0, cap0 = 0, sp = 0, pol = 0;
  while (!S.over && S.turn < yrs * 12) {
    let g = 0; while (E.currentEvent() && g++ < 20) { const ev = E.currentEvent(); const ok = ev.options.filter(o => o.ok); const before = S.pc; E.resolveEvent(ok.length ? ok[Math.floor(Math.random() * ok.length)].i : 0); if (S.pc < before) evPC += before - S.pc; if (S.over) break; }
    if (S.over) break;
    const list = E.policyList().filter(p => p.ok);
    const want = mode === 'active' ? Math.random() < 0.6 : S.pc >= S.pcMax - 0.5;
    if (list.length && want) { const p = list[Math.floor(Math.random() * list.length)]; const b = S.pc; E.enact(p.id); sp += Math.max(0, b - S.pc); pol++; }
    m0++; if (S.pc >= S.pcMax - 1) cap0++; sumFrac += S.pc / S.pcMax;
    E.endTurn();
  }
  months += m0; atCap += cap0; spentTot += sp; pols += pol; n++;
  rows.push({ pl, sd, months: m0, capPct: Math.round(cap0 / Math.max(1, m0) * 100), polPerYr: +(pol / (m0 / 12)).toFixed(1), pcSpentPerYr: +(sp / (m0 / 12)).toFixed(1) });
}
console.table(rows);
console.log('mode', mode, '| months at/near cap: ' + Math.round(atCap / months * 100) + '% | avg pool ' + Math.round(sumFrac / months * 100) + '% of cap | policies/yr ' + (pols / (months / 12)).toFixed(1) + ' | PC spent on policies/yr ' + (spentTot / (months / 12)).toFixed(1) + ' | PC spent in events/yr ' + (evPC / (months / 12)).toFixed(1));
