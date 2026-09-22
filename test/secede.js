const E = require('../dist/engine.js');
let sec = 0, kept = 0, gone = 0, errs = 0, ai = 0;
for (let sd = 1; sd <= 12; sd++) {
  try {
    E.newGame({ player: 'CHN', leader: 'B', seed: sd * 13, diff: 1, temper: 0, termLimits: false });
    const S = E.S; S.pc = 12; S.pcMax = 20; E.C('CHN').army *= 3;
    E.doDip('declare', 'VNM', 'conquest');
    let done = false;
    for (let t = 0; t < 80 && !S.over; t++) {
      let g = 0; while (E.currentEvent() && g++ < 9) {
        const ev = E.currentEvent();
        let i = ev.options.findIndex(o => o.ok && /Annex/.test(o.label)); if (i < 0) i = ev.options.findIndex(o => o.ok);
        if (ev.id === 'terrSecession') { sec++; const pref = sd % 3 === 0 ? /Let them/ : sd % 3 === 1 ? /Send/ : /autonomy/; i = ev.options.findIndex(o => o.ok && pref.test(o.label)); if (i < 0) i = ev.options.findIndex(o => o.ok); }
        E.resolveEvent(i);
      }
      S.pc = 12;
      const t0 = S.terr.VNM; if (t0 && !done) { done = true; t0.unrest = 97; t0.integ = 5; t0.nat = 95; }
      if (t0 && done) { E.C('CHN').stab = 20; t0.unrest = Math.max(t0.unrest, 90); }
      E.endTurn();
    }
    if (S.terr.VNM) kept++; else if (E.C('VNM').alive && E.S.owner.VNM === 'VNM') gone++;
    ai += Object.keys(S.terr).length;
  } catch (e) { errs++; console.log(e.stack.split('\n').slice(0, 5).join('\n')); }
}
console.log({ sec, kept, gone, errs, terrTotalEnd: ai });
