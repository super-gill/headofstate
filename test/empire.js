const E = require('../dist/engine.js');
const res = { annexed: 0, secede: 0, insurg: 0, secEv: 0, over: {}, errs: 0 }; const rows = [];
const postures = ['light', 'garrison', 'invest'];
for (let sd = 1; sd <= 24; sd++) {
  const post = postures[sd % 3];
  try {
    E.newGame({ player: 'CHN', leader: 'B', seed: sd * 17, diff: 1, temper: 0, termLimits: false });
    const S = E.S; S.pc = 12; S.pcMax = 20; E.C('CHN').army *= 3;
    const tgt = ['VNM', 'PHL', 'MYS', 'KAZ'][sd % 4];
    const r = E.doDip('declare', tgt, 'conquest'); if (!r.ok) { console.log('declare failed', tgt, r.text); continue; }
    let g0 = null, annexedAt = -1;
    for (let t = 0; t < 130 && !S.over; t++) {
      let g = 0; while (E.currentEvent() && g++ < 9) {
        const ev = E.currentEvent(); if (ev.id === 'terrInsurgency') res.insurg++; if (ev.id === 'terrSecession') res.secEv++;
        let i = ev.options.findIndex(o => o.ok && /Annex/.test(o.label)); if (i < 0) i = ev.options.findIndex(o => o.ok);
        if (ev.id === 'terrSecession') i = ev.options.findIndex(o => o.ok && /army|Send/.test(o.label)); if (i < 0) i = ev.options.findIndex(o => o.ok);
        E.resolveEvent(i);
      }
      S.pc = 12; if (process.env.STRESS && S.terr && Object.keys(S.terr).length) { E.C('CHN').stab = Math.min(E.C('CHN').stab, 24); E.C('CHN').warWeary = 60; }
      if (annexedAt < 0 && S.terr && S.terr[tgt]) { annexedAt = t; g0 = E.C('CHN').gdp; res.annexed++; }
      E.empireList().forEach(x => E.setPosture(x.iso, post));
      E.endTurn();
    }
    const l = E.empireList();
    const gone = annexedAt >= 0 && !S.terr[tgt];
    if (gone && E.C(tgt).alive) res.secede++;
    if (S.over) res.over[S.over.type] = (res.over[S.over.type] || 0) + 1;
    rows.push([sd, post, tgt, annexedAt, l.length ? Math.round(l[0].integ) + '/' + Math.round(l[0].unrest) : (E.C(tgt).alive ? 'seceded' : '-'), g0 ? Math.round((E.C('CHN').gdp / g0 - 1) * 100) + '%' : '', S.over ? S.over.type : ''].join(' '));
  } catch (e) { res.errs++; console.log(e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.log(rows.join('\n')); console.log(res);
