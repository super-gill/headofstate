const E = require('../dist/engine.js');
const args = process.argv.slice(2);
const seeds = +args[0] || 5, years = +args[1] || 15, mode = args[2] || 'random', players = (args[3] || 'GBR,USA,IND,NGA,RUS,SAU').split(',');
let errs = 0; const summary = [];
for (const pl of players) for (let sd = 1; sd <= seeds; sd++) {
  try {
    E.newGame({ player: pl, leader: 'Bot', seed: sd * 7919, diff: 1, temper: 1, termLimits: false });
    const S = E.S; let steps = 0, evCount = 0, policies = 0;
    while (!S.over && S.turn < years * 12) {
      // resolve events
      let guard = 0;
      while (E.currentEvent() && guard++ < 20) { const ev = E.currentEvent(); let i = 0; if (mode === 'random') { const ok = ev.options.filter(o => o.ok); i = ok[Math.floor(Math.random() * ok.length)].i; } E.resolveEvent(i); evCount++; if (S.over) break; }
      if (S.over) break;
      if (mode === 'random' && Math.random() < 0.5) { const pl2 = E.policyList().filter(p => p.ok); if (pl2.length) { E.enact(pl2[Math.floor(Math.random() * pl2.length)].id); policies++; } }
      E.endTurn(); steps++;
    }
    const c = E.me();
    summary.push({ pl, sd, turns: S.turn, over: S.over ? S.over.type : 'alive', gdp: Math.round(c.gdp), appr: Math.round(c.appr), stab: Math.round(c.stab), tension: Math.round(S.world.tension), wars: S.wars.length, annexed: S.stat.annexed, nukeUse: S.world.nukeUse, ev: evCount });
  } catch (e) { errs++; console.log('ERROR', pl, sd, e.stack.split('\n').slice(0, 5).join('\n')); }
}
console.table(summary);
console.log('errors', errs);
