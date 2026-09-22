const E = require('../dist/engine.js');
const bins = { '<12': 0, '<24': 0, '<40': 0, '<62': 0, '>=62': 0 }; let n = 0, ev = { adviserQuits: 0, adviserDefects: 0, cabinetLeak: 0 }, months = 0;
for (let sd = 1; sd <= 30; sd++) {
  E.newGame({ player: ['USA', 'GBR', 'IND', 'BRA', 'RUS', 'NGA'][sd % 6], gov: ['D', 'H', 'O', 'J', 'M'][sd % 5], leader: 'B', seed: sd * 31, diff: 1, temper: 1, termLimits: false });
  const S = E.S;
  while (!S.over && S.turn < 120) {
    let g = 0; while (E.currentEvent() && g++ < 20) { const e = E.currentEvent(); if (ev[e.id] != null) ev[e.id]++; const ok = e.options.filter(o => o.ok); let pk = ok[Math.floor(Math.random() * ok.length)]; if (process.argv[2] === 'bias' && e.advice && e.advice[0] && e.advice[0].opposes >= 0 && e.options[e.advice[0].opposes].ok) pk = e.options[e.advice[0].opposes]; E.resolveEvent(pk.i); if (S.over) break; }
    if (S.over) break;
    S.pc = 12; E.endTurn(); months++;
    Object.values(S.cabinet).forEach(a => { if (a.status !== 'serving') return; n++; const l = a.loyalty; bins[l < 12 ? '<12' : l < 24 ? '<24' : l < 40 ? '<40' : l < 62 ? '<62' : '>=62']++; });
  }
}
console.log(months, 'months', bins, ev);
