// event plausibility filters and event volume
const E = require('../dist/engine.js');
const pls = ['CHE', 'DEU', 'GBR', 'USA', 'IND', 'NGA', 'KAZ', 'FRA'];
const bad = [], cnt = {}, perMonth = {}; let maxM = 0, vict = 0;
for (const pl of pls) for (let sd = 1; sd <= 3; sd++) {
  E.newGame({ player: pl, leader: 'Bot', seed: sd * 7919, diff: 1, temper: 1.5, termLimits: false });
  const S = E.S; let last = 0;
  while (!S.over && S.turn < 96) {
    let g = 0, k = 0;
    while (E.currentEvent() && g++ < 20) {
      const ev = E.currentEvent(); k++;
      cnt[ev.id] = (cnt[ev.id] || 0) + 1;
      if (ev.id === 'victimAppeal') vict++;
      if (ev.id === 'currency' && ['DEU', 'FRA'].includes(pl)) bad.push('currency ' + pl);
      if (ev.id === 'seaDispute' && ['CHE', 'KAZ'].includes(pl)) bad.push('sea ' + pl);
      if (ev.id === 'greatPower' && ['GBR', 'DEU', 'FRA', 'USA'].includes(pl)) bad.push('gp ' + pl);
      if (ev.id === 'greatPower' && ev.text.includes('Non-alignment')) bad.push('old text');
      const ok = ev.options.filter(o => o.ok); E.resolveEvent(ok.length ? ok[Math.floor(Math.random() * ok.length)].i : 0);
    }
    maxM = Math.max(maxM, k);
    if (S.over) break; E.endTurn();
  }
}
console.log('bad', bad.slice(0, 10), 'victimAppeal', vict, 'max events resolved in one month', maxM);
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => e.join(':')).join(' '));
