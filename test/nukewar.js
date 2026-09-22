const E = require('../dist/engine.js');
let ended = 0, capped = 0, errs = 0; const how = {};
for (let sd = 1; sd <= 20; sd++) {
  try {
    E.newGame({ player: 'CHN', leader: 'B', seed: sd * 31, diff: 1, temper: 0, termLimits: false });
    const S = E.S; S.pc = 12; S.pcMax = 20; E.C('CHN').army *= 3;
    const r = E.doDip('declare', 'IND', 'humiliate'); if (!r.ok) { console.log('declare failed', r.text); continue; }
    for (let t = 0; t < 60 && !S.over; t++) {
      let g = 0; while (E.currentEvent() && g++ < 9) { const ev = E.currentEvent(); let i = ev.options.findIndex(o => o.ok && /terms|Impose|Accept/.test(o.label)); if (i < 0) i = ev.options.findIndex(o => o.ok); how[ev.id + ':' + ev.options[i].label] = (how[ev.id + ':' + ev.options[i].label] || 0) + 1; E.resolveEvent(i); }
      const w = E.warBetween('CHN', 'IND'); if (!w) { ended++; break; }
      if (Math.abs(w.score) >= 54) capped++;
      S.pc = 12;
      const tm = E.dipList('IND').find(d => d.id === 'terms'); if (tm && tm.ok && t % 2 === 0) E.doDip('terms', 'IND');
      E.endTurn();
    }
  } catch (e) { errs++; console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.log({ ended, capped, errs }, how);
