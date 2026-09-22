const E = require('../dist/engine.js');
let seen = 0, errs = 0; const outc = {}; const roles = {};
for (const pl of ['JPN', 'KOR', 'USA', 'GBR', 'AUS', 'DEU', 'TWN', 'IND']) for (let sd = 1; sd <= 8; sd++) {
  try {
    E.newGame({ player: pl, leader: 'B', seed: sd * 104729, diff: 1, temper: 1, termLimits: false });
    const S = E.S;
    while (!S.over && S.turn < 240) {
      let g = 0;
      while (E.currentEvent() && g++ < 20) {
        const ev = E.currentEvent(); let i;
        const ok = ev.options.filter(o => o.ok);
        i = ok[Math.floor(Math.random() * ok.length)].i;
        if (ev.id === 'rogueLaunch') { seen++; roles[pl] = (roles[pl] || 0) + 1; const r = E.resolveEvent(i); const k = ev.options[i].label + ' -> ' + r.text.slice(0, 60); outc[k] = (outc[k] || 0) + 1; }
        else E.resolveEvent(i);
        if (S.over) break;
      }
      if (S.over) break;
      // random war ops
      E.warsOf(S.player).forEach(w => { const side = E.warSideOf(w, S.player); if (Math.random() < 0.5) { const ops = E.opList(w.id).filter(o => o.ok); if (ops.length) E.doOp(w.id, ops[Math.floor(Math.random() * ops.length)].id); } if (Math.random() < 0.15) { const pl2 = E.planList(w.id).filter(o => o.ok && !o.on); if (pl2.length) E.setPlan(w.id, pl2[Math.floor(Math.random() * pl2.length)].id); } });
      E.endTurn();
    }
  } catch (e) { errs++; console.log('ERR', pl, sd, e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.log('rogue events', seen, roles, 'errors', errs);
Object.entries(outc).sort().forEach(([k, v]) => console.log(v, k));
