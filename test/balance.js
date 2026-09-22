const E = require('../dist/engine.js');
const YEARS = +process.argv[2] || 12, SEEDS = +process.argv[3] || 4;
const players = ['USA', 'CHN', 'IND', 'RUS', 'GBR', 'BRA', 'NGA', 'SAU', 'TUR', 'PAK', 'DEU', 'ETH', 'CHD', 'PRK', 'IRN', 'ARG'].filter(x => E.ROW[x]);
const govs = ['D', 'H', 'M', 'O', 'J', 'T', 'P'];
const scen = ['standard', 'collapse', 'rising', 'flashpoint', 'aftershock', 'coldwar'];
function run(pl, gov, sc, sd, style) {
  E.newGame({ player: pl, gov, scenario: sc, leader: 'Bot', seed: sd * 7919 + 13, diff: 1, temper: 1, termLimits: false });
  const S = E.S; let ev = 0, quits = 0, defects = 0, stories = 0, pj = 0;
  while (!S.over && S.turn < YEARS * 12) {
    let g = 0;
    while (E.currentEvent() && g++ < 20) {
      const e = E.currentEvent(); const ok = e.options.filter(o => o.ok);
      if (e.id === 'adviserQuits') quits++; if (e.id === 'adviserDefects') defects++;
      const pick = style === 'first' ? ok[0] : style === 'last' ? ok[ok.length - 1] : ok[Math.floor(Math.random() * ok.length)];
      E.resolveEvent(pick.i); ev++; if (S.over) break;
    }
    if (S.over) break;
    if (Math.random() < 0.5) { const l = E.policyList().filter(p => p.ok); if (l.length) E.enact(l[Math.floor(Math.random() * l.length)].id); }
    if (Math.random() < 0.08) { const l = E.projectList().filter(p => p.ok); if (l.length) { E.startProject(l[0].id); pj++; } }
    S.pc = Math.min(S.pcMax, S.pc);
    E.endTurn();
  }
  const a = E.S.ambition; const st = a ? E.ambitionState() : null;
  return { over: S.over ? S.over.type : 'alive', turns: S.turn, quits, defects, ev, amb: a ? a.id : null, ambDone: a && a.done != null, ambProg: st ? st.prog : 0, annuals: (S.annuals || []).map(x => x.overall), wars: S.stat.declared || 0, terr: S.stat.annexed };
}
const rows = [];
for (const style of ['random', 'first']) for (const gov of govs) for (let i = 0; i < SEEDS; i++) { const pl = players[(i * 5 + govs.indexOf(gov)) % players.length]; const sc = scen[i % scen.length]; try { rows.push(Object.assign({ style, gov, pl, sc }, run(pl, gov, sc, i + 1, style))); } catch (e) { console.log('ERR', pl, gov, sc, e.stack.split('\n').slice(0, 4).join('\n')); } }
const by = (k, f) => { const m = {}; rows.forEach(r => { const key = r[k]; (m[key] = m[key] || []).push(r); }); return m; };
const pct = (a, f) => Math.round(a.filter(f).length / a.length * 100) + '%';
console.log('--- by government (style random+first)');
const t1 = []; const g = by('gov'); Object.keys(g).forEach(k => { const a = g[k]; t1.push({ gov: k, n: a.length, alive: pct(a, r => r.over === 'alive'), medMonths: a.map(r => r.turns).sort((x, y) => x - y)[a.length >> 1], ambDone: pct(a, r => r.ambDone), quits: a.reduce((s, r) => s + r.quits, 0), defects: a.reduce((s, r) => s + r.defects, 0), ev_per_yr: (a.reduce((s, r) => s + r.ev, 0) / a.reduce((s, r) => s + r.turns, 0) * 12).toFixed(1) }); }); console.table(t1);
console.log('--- by scenario');
const t2 = []; const sm = by('sc'); Object.keys(sm).forEach(k => { const a = sm[k]; t2.push({ sc: k, n: a.length, alive: pct(a, r => r.over === 'alive'), ambDone: pct(a, r => r.ambDone), avgProg: (a.reduce((s, r) => s + r.ambProg, 0) / a.length).toFixed(2) }); }); console.table(t2);
console.log('--- by style');
const t3 = []; const st = by('style'); Object.keys(st).forEach(k => { const a = st[k]; t3.push({ style: k, n: a.length, alive: pct(a, r => r.over === 'alive'), ends: JSON.stringify(a.reduce((m, r) => { m[r.over] = (m[r.over] || 0) + 1; return m; }, {})) }); }); console.table(t3);
const gs = {}; rows.forEach(r => r.annuals.forEach(x => { gs[x] = (gs[x] || 0) + 1; })); console.log('annual grades', gs);
const am = {}; rows.forEach(r => { if (r.amb) { am[r.amb] = am[r.amb] || { n: 0, done: 0 }; am[r.amb].n++; if (r.ambDone) am[r.amb].done++; } }); console.log('ambitions', am);
console.log('peace rows', rows.filter(r => r.amb === 'peace').map(r => r.style + ':' + r.over + ':' + r.turns + ':wars' + r.wars + ':prog' + r.ambProg.toFixed(2)).join(' '));
console.log('prosperity rows', rows.filter(r => r.amb === 'prosperity').map(r => r.style + ':' + r.over + ':prog' + r.ambProg.toFixed(2) + ':' + r.ambDone).join(' '));
