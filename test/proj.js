const E = require('../dist/engine.js');
let stats = { started: 0, done: 0, snag: 0, pol: 0, cancel: 0 };
for (let seed = 1; seed <= 30; seed++) {
  E.newGame({ player: ['GBR', 'BRA', 'IND', 'NGA', 'USA'][seed % 5], leader: 'T', seed, diff: 1, temper: 1, termLimits: false });
  const S = E.S; S.pc = 12; const kinds = Object.keys(E.PROJECTS());
  for (let t = 0; t < 84 && !S.over; t++) {
    let g = 0; while (E.currentEvent() && g++ < 9) { const e = E.currentEvent(); if (e.title.includes('trouble')) stats.snag++; if (e.title.includes('under fire')) stats.pol++; if (e.title.includes('complete')) stats.done++; E.resolveEvent(e.options.findIndex(o => o.ok)); }
    S.pc = 12;
    if (t % 5 === 0) { const l = E.projectList().filter(p => p.ok); if (l.length) { const r = E.startProject(l[0].id); if (r.ok) stats.started++; } }
    E.endTurn();
  }
  if (S.over === undefined) {}
}
console.log(stats);
const r = E.projectList(); console.log(r.map(x => x.id + ':' + x.ok + ':' + x.why).join(' | '));
