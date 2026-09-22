const E = require('../dist/engine.js');
const pl = process.argv[2] || 'GBR', seed = +process.argv[3] || 5;
E.newGame({ player: pl, leader: 'Bot', seed, diff: 1, temper: 1 });
const S = E.S;
const row = () => { const c = E.me(); return [E.dateLabel(), 'gdp', Math.round(c.gdp), 'g', c.growth.toFixed(1), 'inf', c.infl.toFixed(1), 'un', c.unemp.toFixed(1), 'debt', Math.round(E.debtPct(c)), 'tre', Math.round(c.treasury), 'appr', Math.round(c.appr), 'stab', Math.round(c.stab), 'fac', FAC(c), 'pc', S.pc.toFixed(1), 'bal', c.fisc ? (c.fisc.balance / c.gdp * 100).toFixed(1) : '-', 'army', Math.round(E.power(c)), 'corr', Math.round(c.corr), 'prest', Math.round(c.prest)].join(' '); };
const FAC = c => E.FAC.map(f => Math.round(c.fac[f])).join('/');
console.log(row());
for (let t = 1; t <= 120; t++) {
  while (E.currentEvent()) { const ev = E.currentEvent(); const ok = ev.options.filter(o => o.ok); E.resolveEvent(ok[0].i); if (S.over) break; }
  if (S.over) { console.log('OVER', S.over.type); break; }
  E.endTurn();
  if (t % 12 === 0) console.log(row());
}
