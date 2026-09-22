const E = require('../dist/engine.js');
const seeds = +process.argv[2] || 10, years = +process.argv[3] || 10, temper = process.argv[4] != null ? +process.argv[4] : 1;
let wars = 0, annex = 0, tens = [], ends = 0, byPair = {}, nukes = 0, overs = 0, ceasefires = 0;
for (let sd = 1; sd <= seeds; sd++) {
  E.newGame({ player: 'MHL', leader: 'Bot', seed: sd * 104729, diff: 0.4, temper });
  const S = E.S;
  while (S.turn < years * 12 && !S.over) { while (E.currentEvent()) { const ev = E.currentEvent(); const ok = ev.options.filter(o => o.ok); E.resolveEvent(ok[0].i); } E.endTurn(); if (S.turn % 12 === 0) tens.push(S.world.tension); }
  S.news.forEach(n => { if (n.text.startsWith('WAR:')) { wars++; const k = n.text.replace('WAR: ', ''); byPair[k] = (byPair[k] || 0) + 1; } if (n.text.startsWith('Ceasefire')) ceasefires++; });
  annex += S.world.annexations; nukes += S.world.nukeUse; if (S.over) overs++;
}
console.log({ seeds, years, temper, warsPerDecade: (wars / seeds / years * 10).toFixed(1), annexPerDecade: (annex / seeds / years * 10).toFixed(2), ceasefires, avgTension: (tens.reduce((a, b) => a + b, 0) / tens.length).toFixed(1), nukes, overs });
console.log(Object.entries(byPair).sort((a, b) => b[1] - a[1]).slice(0, 12));
