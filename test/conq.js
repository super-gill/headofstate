// Conquest cost check: as several big and small powers, declare war on a weak neighbour, win, annex; watch approval, sanctions, ratings, relations.
const E = require('../dist/engine.js');
const rows = []; let errs = 0;
for (const [pl, tg] of [['RUS', 'UKR'], ['TUR', 'GRC'], ['USA', 'MEX'], ['CHN', 'VNM'], ['GBR', 'IRL'], ['IND', 'BGD']]) for (let sd = 1; sd <= 3; sd++) {
  try {
    E.newGame({ player: pl, leader: 'Bot', seed: sd * 331, diff: 1, temper: 1, termLimits: false });
    const S = E.S; const c0 = E.me(); const a0 = c0.appr, prest0 = c0.prest; let declared = false, annexed = false; const log = { peak: 0, sanc: 0, rel: 0 };
    const relAvg = () => { const l = E.aliveList().filter(i => i !== pl); return l.reduce((s, i) => s + E.R(pl, i), 0) / l.length; };
    const rel0 = relAvg(); const evs = {};
    for (let m = 0; m < 60 && !S.over; m++) {
      let g = 0; while (E.currentEvent() && g++ < 12) { const ev = E.currentEvent(); evs[ev.id] = (evs[ev.id] || 0) + 1; const ok = ev.options.filter(o => o.ok); let pick = ok[0]; const ann = ok.find(o => /annex/i.test(o.label)); if (ann) pick = ann; E.resolveEvent(pick ? pick.i : 0); }
      if (S.over) break;
      if (!declared && m === 2) { const r = E.doDip ? E.doDip('declare', tg, 'conquest') : null; declared = true; }
      if (m === 2) { const w = E.S.wars.find(w => w.a.includes(pl)); if (w) w.score = 90; }
      if (E.S.wars.length) E.S.wars.filter(w => w.a.includes(pl)).forEach(w => { w.score = Math.max(w.score, 60); });
      E.endTurn();
      if (E.me().flags && S.stat.annexed && !annexed) { annexed = true; log.annexAt = S.turn; }
      log.peak = Math.max(log.peak, E.me().appr);
    }
    const c = E.me(); const sanc = S.sanctions.filter(s => s.on === pl).length;
    rows.push({ pl, tg, sd, over: S.over ? S.over.type : 'alive', annexed: S.stat.annexed || 0, at: log.annexAt || '-', appr0: Math.round(a0), peak: Math.round(log.peak), apprEnd: Math.round(c.appr), prest: Math.round(prest0) + '>' + Math.round(c.prest), sanc, relD: Math.round(relAvg() - rel0), fallout: evs.conquestFallout || 0, rating: E.creditInfo().rating, growth: c.growth.toFixed(1) });
  } catch (e) { errs++; console.log('ERR', pl, tg, e.stack.split('\n').slice(0, 4).join('\n')); }
}
console.table(rows); console.log('errors', errs);
