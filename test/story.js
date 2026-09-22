const E = require('../dist/engine.js');
let errs = 0; const seen = {};
for (let sd = 1; sd <= 30; sd++) {
  try {
    E.newGame({ player: 'GBR', leader: 'X', seed: sd, diff: 1, temper: 1, termLimits: false });
    const S = E.S; S.pc = 12; S.pcMax = 20;
    S.stories = [
      { id: 's1', kind: 'scandal', stage: 0, data: { minister: 'Ada Voss', guilt: 1 + sd % 3 }, next: 1, started: 0, waiting: false },
      { id: 's2', kind: 'border', stage: 0, data: { o: 'RUS', esc: 1 + sd % 3 }, next: 1, started: 0, waiting: false },
      { id: 's3', kind: 'generals', stage: 0, data: {}, next: 2, started: 0, waiting: false }];
    S.pledges = [{ id: 'p1', kind: sd % 2 ? 'noTaxRise' : 'holdDefence', made: 0, due: 3, base: sd % 2 ? S.c.GBR.tax : S.c.GBR.spend.mil }];
    S.c.GBR.tax += (sd % 4 === 0 ? 3 : 0);
    for (let t = 0; t < 30 && !S.over; t++) {
      let g = 0; while (E.currentEvent() && g++ < 12) {
        const ev = E.currentEvent(); seen[ev.id] = (seen[ev.id] || 0) + 1;
        const i = ev.options.findIndex((o, k) => o.ok && (sd + k) % 2 === 0); E.resolveEvent(i >= 0 ? i : ev.options.findIndex(o => o.ok));
      }
      S.pc = 12; E.endTurn();
    }
  } catch (e) { errs++; console.log(e.stack.split('\n').slice(0, 5).join('\n')); }
}
const keys = ['scandalDeepens', 'scandalVerdict', 'borderStandoff', 'borderBreaking', 'generalsUltimatum', 'pledgeResult'];
console.log({ errs }, keys.map(k => k + ':' + (seen[k] || 0)).join(' '));
