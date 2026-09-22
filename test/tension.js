const E = require('../dist/engine.js');
E.newGame({ player: 'GBR', leader: 'Bot', seed: 7919, diff: 1, temper: 1 });
const S = E.S;
for (let t = 0; t < 36; t++) {
  while (E.currentEvent()) E.resolveEvent(0);
  E.endTurn();
  if (t % 6 === 5) {
    console.log(E.dateLabel(), 'tension', S.world.tension.toFixed(1), 'computed', E.computeTension().toFixed(1), 'wars', S.wars.map(w => w.lead.a + '>' + w.lead.b + ' ' + w.score.toFixed(0) + ' a' + w.a.length + 'b' + w.b.length).join(' | '), 'nukeAlert', (S.world.nukeAlert || 0).toFixed(1));
  }
}
console.log(S.news.slice(0, 40).map(n => n.d + ' ' + n.text).join('\n'));
