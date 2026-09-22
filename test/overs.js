const E = require('../dist/engine.js');
const pl = process.argv[2] || 'MHL';
const res = {};
for (let sd = 1; sd <= 12; sd++) {
  E.newGame({ player: pl, leader: 'Bot', seed: sd * 104729, diff: 1, temper: 1 });
  const S = E.S;
  while (S.turn < 120 && !S.over) { while (E.currentEvent()) { const ev = E.currentEvent(); const ok = ev.options.filter(o => o.ok); E.resolveEvent(ok[0].i); if (S.over) break; } if (S.over) break; E.endTurn(); }
  const k = S.over ? S.over.type + '@' + Math.round(S.turn / 12) : 'alive'; res[k] = (res[k] || 0) + 1;
}
console.log(pl, res);
