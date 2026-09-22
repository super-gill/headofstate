// Governance-terminology check: no "opposition"/"backbenchers"/"Parliament"/"MPs" text for non-parliamentary regimes.
const E = require('../dist/engine.js');
const cases = [['SAU','M'], ['LBY','J'], ['IRN','T'], ['PRK','O'], ['RUS','P']];
const bad = [];
for (const [iso, gov] of cases) {
  for (let sd = 1; sd <= 4; sd++) {
    E.newGame({ player: iso, leader: 'Bot', seed: sd * 5003, diff: 1, temper: 1.5, termLimits: false });
    const S = E.S;
    while (!S.over && S.turn < 90) {
      let g = 0;
      while (E.currentEvent() && g++ < 20) {
        const ev = E.currentEvent();
        const blob = (ev.title || '') + ' ' + (ev.text || '') + ' ' + ev.options.map(o => o.label + ' ' + o.hint).join(' ');
        if (/\bbackbenchers\b|\bParliament\b|\bMPs\b|\bthe opposition\b/i.test(blob)) bad.push(iso + ':' + ev.id + ': ' + blob.slice(0, 140));
        const ok = ev.options.filter(o => o.ok);
        E.resolveEvent(ok.length ? ok[Math.floor(Math.random() * ok.length)].i : 0);
      }
      if (S.over) break;
      E.endTurn();
    }
  }
}
console.log('bad hits:', bad.length);
bad.slice(0, 20).forEach(b => console.log(b));
