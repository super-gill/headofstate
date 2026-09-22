#!/usr/bin/env node
// Playtest harness: plays Head of State from a command line, one command per call.
// State lives in /tmp/pt/<name>/game.json so each call is a fresh process.
const fs = require('fs'), path = require('path');
const E = require('../dist/engine.js');
const [name, cmd, ...args] = process.argv.slice(2);
if (!name || !cmd) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//H ')).map(l => l.slice(4)).join('\n')); process.exit(0); }
//H Usage: node test/pt.js <name> <command> [args]
//H   new ISO GOV SCENARIO AMBITION [seed]  start (GOV D/H/M/O/J/T/P or - for default; SCENARIO standard|collapse|rising|flashpoint|aftershock|coldwar; AMBITION auto|none|stabilise|greatpower|peace|prosperity|liberty|empire|alliances|handover)
//H   status            the Home screen: date, numbers, briefing, why things moved, cabinet, storylines, programmes, ambition
//H   event             the decision waiting for you (if any)
//H   choose N          pick option N of the current decision
//H   end [N]           end the month (N months; stops early at any decision, annual report, or game over)
//H   policies | enact ID
//H   budget | set tax|social|mil|infra|sec VALUE | mob 0-3
//H   projects | launch ID | cancel ID
//H   cabinet | replace ROLE (lists candidates) | hire ROLE INDEX
//H   empire | posture ISO light|garrison|invest
//H   world             big powers, wars, tension, blocs
//H   dip ISO           what you can do with a country (dossier + actions)   |  do ACTIONID ISO [goal]
//H   war               your wars, plans and operations  |  plan WARID PLANID  |  op WARID OPID
//H   blocs | apply BLOCID
//H   explain stab|appr|growth|budget|credit|rel:ISO
//H   report            last month's fiscal report  |  annual [YEAR]  the annual report
//H   note "text"       write an observation into your feedback log (do this often)
//H   legacy            score if the game is over
const dir = path.join('/tmp/pt', name); fs.mkdirSync(dir, { recursive: true });
const gf = path.join(dir, 'game.json'), nf = path.join(dir, 'notes.md'), lf = path.join(dir, 'actions.log');
const out = []; const P = s => out.push(s == null ? '' : String(s));
const money = v => E.money(v);
const pct = v => Math.round(v) + '%';
function load() { if (!fs.existsSync(gf)) { console.log('No game yet. Run: new ISO GOV SCENARIO AMBITION'); process.exit(1); } E.hydrate(fs.readFileSync(gf, 'utf8')); }
function save() { if (E.S && !E.S.over) fs.writeFileSync(gf, E.serialize()); else if (E.S) fs.writeFileSync(gf, E.serialize()); }
function log(s) { fs.appendFileSync(lf, '[' + (E.S ? E.S.turn : 0) + '] ' + s + '\n'); }
const dateL = () => E.dateLabel();

function showEvent() {
  const ev = E.currentEvent(); if (!ev) { P('No decision waiting.'); return; }
  P('=== DECISION: ' + ev.title + '  (' + ev.cat + ', ' + dateL() + ') ===');
  P(ev.text);
  if (ev.advice && ev.advice.length) ev.advice.forEach(a => { const f = ev.options[a.favours], o = a.opposes >= 0 ? ev.options[a.opposes] : null; P('  [' + a.title + ', ' + a.who + '] leans toward "' + (f ? f.label : '') + '"' + (o && o !== f ? ' and against "' + o.label + '"' : '')); });
  ev.options.forEach(o => P('  ' + o.i + ') ' + o.label + (o.hint ? ' -- ' + o.hint : '') + (o.ok ? '' : '   [UNAVAILABLE: ' + (o.why || '') + ']')));
}
function showOver() {
  const o = E.S.over; if (!o) return false;
  P('*** GAME OVER: ' + o.title + ' ***'); P(o.text);
  const L = o.legacy || E.legacy(); P('Legacy: ' + L.total + ' (' + L.rank + ')'); L.parts.filter(p => p.pts).forEach(p => P('  ' + p.label + ': ' + (p.pts > 0 ? '+' : '') + p.pts));
  const r = E.report(); P(r.verdict + '. ' + r.headline); r.rows.forEach(x => P('  ' + x.label + ': ' + x.from + ' -> ' + x.to + ' (' + x.verdict + ')'));
  return true;
}
function chips(r) { return (r.chips || []).map(c => c.label + ' ' + c.text).join(', '); }
function status() {
  const S = E.S, c = E.me();
  P('=== ' + dateL() + '  |  ' + c.name + '  |  ' + S.leader + ', ' + E.GOV[c.gov].leader.toLowerCase() + ' (' + E.GOV[c.gov].name + ') ===');
  P('Month ' + S.turn + '. Political capital ' + S.pc.toFixed(1) + '/' + S.pcMax + ' (+' + (S.pcRegen || 0).toFixed(1) + '/month)');
  P('Approval ' + pct(c.appr) + ' | Stability ' + Math.round(c.stab) + ' | Economy ' + money(c.gdp) + ' (growth ' + c.growth.toFixed(1) + '%, inflation ' + c.infl.toFixed(1) + '%, unemployment ' + c.unemp.toFixed(1) + '%)');
  P('Treasury ' + money(c.treasury) + ' | Debt ' + Math.round(E.debtPct(c)) + '% of GDP | Credit ' + E.creditInfo().rating + ' (' + E.creditInfo().outlook.toLowerCase() + ') | Prestige ' + Math.round(c.prest) + ' | Liberty ' + Math.round(c.free) + ' | Corruption ' + Math.round(c.corr) + ' | World tension ' + Math.round(S.world.tension));
  P('Power base loyalty: ' + E.FAC.map((f, i) => E.GOV[c.gov].fl[i] + ' ' + Math.round(c.fac[f])).join(', '));
  P(''); P('BRIEFING'); E.briefing().forEach(b => P('  [' + b.lvl + '] ' + b.text));
  const why = E.whyRows(); if (why && why.length) { P(''); P('WHAT MOVED LAST MONTH'); why.slice(0, 6).forEach(w => P('  ' + w.label + ': ' + w.from + ' to ' + w.to + '. ' + w.why)); }
  const A = E.ambitionState(); if (A) { P(''); P('AMBITION: ' + A.name + ' (' + Math.round(A.prog * 100) + '%)' + (A.done != null ? ' ACHIEVED' : '') + ' - ' + A.text); }
  const st = E.storyList(); const pj = E.projectStatus(); if (st.length || pj.length) { P(''); P('IN MOTION'); pj.forEach(p => P('  Programme: ' + p.name + ', ' + p.left + ' months left, ' + p.health)); st.forEach(s => P('  ' + s.name + ': ' + s.status)); }
  P(''); P('CABINET'); E.cabinetList().forEach(a => P('  ' + a.title + ' ' + a.name + ' (' + a.lean + ', skill ' + a.comp + '/5): ' + a.mood + ' (loyalty ' + Math.round(a.loyalty) + ')'));
  const emp = E.empireList(); if (emp.length) { P(''); P('TERRITORIES'); emp.forEach(t => P('  ' + t.name + ': integration ' + Math.round(t.integ) + ', unrest ' + Math.round(t.unrest) + ' (' + t.risk + '), ' + t.postureName)); }
  const ws = E.warsOf(S.player); if (ws.length) { P(''); P('WARS'); ws.forEach(w => { const side = E.warSideOf(w, S.player); P('  #' + w.id + ' vs ' + E.nm(w.lead[side === 'a' ? 'b' : 'a']) + ', ' + Math.round((side === 'a' ? w.score : -w.score)) + ' score'); }); }
  if (S.annuals && S.annuals.length) P('\nAnnual reports available: ' + E.annualList().map(a => a.year + ' ' + a.overall).join(', '));
}
function monthlyLine() {
  const m = E.monthlyReport(); if (!m) return;
  P('  Money: in ' + money(m.totRev) + ', out ' + money(m.totSpend) + (Math.abs(m.oneOff) > m.gdp * 0.0001 ? ', one-offs ' + money(m.oneOff) : '') + ', balance ' + (m.bal >= 0 ? '+' : '-') + money(Math.abs(m.bal)) + '. Debt ' + Math.round(m.dpct) + '% of GDP.');
}
function annual(a) {
  P('=== ANNUAL REPORT ' + a.year + ': overall ' + a.overall + ' ===');
  P(a.summary); a.grades.forEach(g => P('  ' + g.area + ': ' + g.g + ' - ' + g.note));
  const f = a.fiscal; P('Books: in ' + money(f.totRev) + ', out ' + money(f.totSpend) + (Math.abs(f.oneOff) > f.gdpAvg * 0.0001 ? ', one-offs ' + (f.oneOff >= 0 ? '+' : '-') + money(Math.abs(f.oneOff)) : '') + ', balance incl. one-offs ' + (f.balance >= 0 ? '+' : '-') + money(Math.abs(f.balance)) + ' (' + f.balPct.toFixed(1) + '% of GDP), debt ' + money(f.debt0) + ' -> ' + money(f.debt1));
  f.rev.forEach(x => P('   in  ' + x[0] + ': ' + money(x[1]))); f.spend.forEach(x => P('   out ' + x[0] + ': ' + money(x[1])));
  a.stats.forEach(s => P('  ' + s.label + ': ' + s.from + s.unit + ' -> ' + s.to + s.unit));
  a.gain.forEach(x => P('  Relations up: ' + x.name + ' ' + x.from + ' -> ' + x.to)); a.lose.forEach(x => P('  Relations down: ' + x.name + ' ' + x.from + ' -> ' + x.to));
  a.highlights.forEach(h => P('  * ' + h.d + ': ' + h.text));
}

const S0 = () => E.S;
try {
switch (cmd) {
  case 'new': {
    const [iso, gov, sc, amb, seed] = args;
    if (!E.ROW[iso]) { P('Unknown country code ' + iso); break; }
    try { fs.unlinkSync(nf); fs.unlinkSync(lf); } catch (e) { }
    E.newGame({ player: iso, gov: gov && gov !== '-' ? gov : undefined, scenario: sc || 'standard', ambition: amb || 'auto', leader: name, seed: seed ? +seed : Math.floor(Math.random() * 1e9), diff: 1, temper: 1, termLimits: true });
    save(); log('new ' + args.join(' ')); P('Started as ' + E.nm(iso) + '.'); status(); if (E.currentEvent()) { P(''); showEvent(); } break;
  }
  case 'status': load(); status(); if (E.currentEvent()) { P(''); showEvent(); } break;
  case 'event': load(); showEvent(); break;
  case 'choose': {
    load(); const ev = E.currentEvent(); if (!ev) { P('No decision waiting.'); break; }
    const i = +args[0]; const o = ev.options.find(x => x.i === i); if (!o) { P('No such option.'); break; }
    const r = E.resolveEvent(i); log('choose ' + ev.title + ' -> ' + o.label); if (!r) { P('That option is unavailable.'); break; }
    P('OUTCOME: ' + (r.title ? r.title + '. ' : '') + r.text); if (chips(r)) P('  Changes: ' + chips(r));
    save(); if (E.S.over) { showOver(); break; } if (E.currentEvent()) { P(''); showEvent(); } break;
  }
  case 'end': {
    load(); let n = Math.max(1, +args[0] || 1);
    if (E.currentEvent()) { P('You have an undecided decision. Use: event, then choose N'); break; }
    for (let i = 0; i < n; i++) {
      const top = E.S.news[0]; E.endTurn(); log('end month');
      const fresh = []; for (const x of E.S.news) { if (x === top) break; fresh.push(x); }
      P('-- ' + dateL() + ' --'); monthlyLine();
      fresh.filter(x => ['nuclear', 'war', 'peace', 'you'].includes(x.tag) || (x.tag === 'politics' && x.iso === E.S.player)).slice(0, 3).forEach(x => P('  NEWS: ' + x.text));
      if (E.S.over) { showOver(); break; }
      if (E.annualPending()) { annual(E.annualLatest()); E.annualAck(); P('(annual report shown)'); break; }
      if (E.currentEvent()) { P(''); showEvent(); break; }
    }
    save(); if (!E.S.over && !E.currentEvent()) { const S = E.S; P('Now: approval ' + pct(E.me().appr) + ', stability ' + Math.round(E.me().stab) + ', capital ' + S.pc.toFixed(1) + '/' + S.pcMax + ', treasury ' + money(E.me().treasury)); } break;
  }
  case 'policies': { load(); E.policyList().forEach(p => P((p.ok ? '[ok] ' : '[--] ') + p.id + ' (' + p.cat + ', ' + p.pc.toFixed(1) + ' PC): ' + p.name + ' - ' + p.desc + (p.ok ? '' : '  <' + p.why + '>'))); break; }
  case 'enact': { load(); const r = E.enact(args[0]); log('enact ' + args[0] + ' -> ' + r.text); P((r.ok ? 'DONE: ' : 'FAILED: ') + r.text); if (chips(r)) P('  Changes: ' + chips(r)); save(); break; }
  case 'budget': { load(); const c = E.me(); P('Tax ' + c.tax.toFixed(1) + '% of GDP (normal ' + c.taxBase + ') | Social ' + c.spend.social.toFixed(1) + ' | Armed forces ' + c.spend.mil.toFixed(1) + ' | Infrastructure ' + c.spend.infra.toFixed(1) + ' | Security ' + c.spend.sec.toFixed(1) + '  (all % of GDP)  | Mobilisation ' + c.mob); const f = E.fiscalPreview(c); P('Projected: revenue ' + money(f.rev) + '/yr, spending ' + money(f.spend) + '/yr, balance ' + money(f.balance) + '/yr (' + f.balPct.toFixed(1) + '% of GDP), debt rate ' + f.rate.toFixed(1) + '%'); const m = E.monthlyReport(); if (m) { P('Last month:'); m.rev.forEach(x => P('   in  ' + x.label + ' ' + money(x.v))); m.spend.forEach(x => P('   out ' + x.label + ' ' + money(x.v))); } break; }
  case 'set': { load(); const ok = E.setBudget(args[0], +args[1]); log('set ' + args.join(' ')); const cc = E.me(); P(ok ? 'Set ' + args[0] + ' to ' + (args[0] === 'tax' ? cc.tax : cc.spend[args[0]]) + ' (limits apply)' : 'Unknown lever'); save(); break; }
  case 'mob': { load(); const ok = E.setMobilisation(+args[0]); P(ok ? 'Mobilisation ' + args[0] : 'Not enough capital'); save(); break; }
  case 'projects': { load(); P('Running:'); E.projectStatus().forEach(p => P('  ' + p.id + ': ' + p.name + ', ' + p.left + ' months left, ' + p.health)); P('Available:'); E.projectList().forEach(p => P((p.on ? '[running] ' : p.ok ? '[ok] ' : '[--] ') + p.id + ' (' + p.months + ' months, ' + p.cost + '% GDP/yr, ' + p.pc.toFixed(1) + ' PC): ' + p.name + ' - ' + p.desc + (p.ok || p.on ? '' : ' <' + p.why + '>'))); break; }
  case 'launch': { load(); const r = E.startProject(args[0]); log('launch ' + args[0]); P((r.ok ? 'DONE: ' : 'FAILED: ') + r.text); save(); break; }
  case 'cancel': { load(); const r = E.cancelProject(args[0]); log('cancel ' + args[0]); P(r.text); save(); break; }
  case 'cabinet': { load(); E.cabinetList().forEach(a => P(a.role + ': ' + a.title + ' ' + a.name + ', ' + a.lean + ', skill ' + a.comp + '/5, ' + a.mood + ' (' + Math.round(a.loyalty) + '). ' + a.desc)); break; }
  case 'replace': { load(); E.candidatesFor(args[0]).forEach((c, i) => P(i + ') ' + c.name + ', ' + c.lean + ', skill ' + c.comp + '/5')); P('Hire with: hire ROLE INDEX (costs 2 PC)'); save(); break; }
  case 'hire': { load(); const r = E.hireAdviser(args[0], +args[1]); log('hire ' + args.join(' ')); P(r.text); save(); break; }
  case 'empire': { load(); const l = E.empireList(); if (!l.length) P('No territories.'); l.forEach(t => P(t.name + ' (' + t.iso + '): integration ' + Math.round(t.integ) + ', unrest ' + Math.round(t.unrest) + ' (' + t.risk + '), posture ' + t.postureName + ', costs ' + E.money(t.cost) + ' a year (' + t.costPct.toFixed(2) + '% of your GDP), ' + t.months + ' months held')); P('Postures: light, garrison, invest'); break; }
  case 'posture': { load(); const r = E.setPosture(args[0], args[1]); log('posture ' + args.join(' ')); P(r.text); save(); break; }
  case 'world': {
    load(); const S = E.S; P('World tension ' + Math.round(S.world.tension) + ' (' + (S.world.tension < 25 ? 'calm' : S.world.tension < 45 ? 'uneasy' : S.world.tension < 65 ? 'tense' : 'dangerous') + ')');
    P('Top economies:'); E.aliveList().slice().sort((a, b) => E.C(b).gdp - E.C(a).gdp).slice(0, 10).forEach((i, k) => P('  ' + (k + 1) + '. ' + E.nm(i) + ' (' + i + ') ' + money(E.C(i).gdp) + ', relations with you ' + (i === S.player ? '-' : Math.round(E.R(S.player, i)))));
    P('Wars:'); if (!S.wars.length) P('  none'); S.wars.forEach(w => P('  ' + w.a.map(E.nm).join('+') + ' vs ' + w.b.map(E.nm).join('+') + ', ' + (S.turn - w.start + (w.m0 || 0)) + ' months'));
    P('Recent news:'); S.news.slice(0, 8).forEach(x => P('  ' + x.text)); break;
  }
  case 'dip': {
    load(); const iso = args[0]; if (!E.ROW[iso]) { P('Unknown code'); break; }
    const i = E.countryInfo(iso); P(i.name + ' (' + iso + '): ' + i.gov + ', ' + E.popStr(i.pop) + ' people, ' + money(i.gdp) + ' economy (#' + i.rankGdp + '), military rank #' + i.rankPow + (i.nukes ? ', NUCLEAR' : ''));
    if (i.rel != null) P('Relations with you: ' + Math.round(i.rel) + ' (' + i.relWord + ')' + (i.pact ? ', defence pact' : '') + (i.deal ? ', trade deal' : '')); if (i.leader) P('Leader: ' + JSON.stringify(i.leader));
    if (!i.alive) { P('(annexed)'); break; }
    E.dipList(iso).forEach(d => P((d.ok ? '[ok] ' : '[--] ') + d.id + ' (' + d.cat + ', ' + d.pc.toFixed(1) + ' PC' + (d.cost ? ', ' + money(d.cost) : '') + (d.chance != null ? ', ~' + Math.round(d.chance * 100) + '% ' + (d.chanceLabel || '') : '') + '): ' + d.label + ' - ' + d.desc + (d.ok ? '' : ' <' + d.why + '>')));
    break;
  }
  case 'do': { load(); const r = E.doDip(args[0], args[1], args[2]); log('do ' + args.join(' ') + ' -> ' + r.text); P((r.ok ? 'DONE: ' : 'FAILED: ') + r.text); if (chips(r)) P('  Changes: ' + chips(r)); save(); if (E.S.over) showOver(); else if (E.currentEvent()) { P(''); showEvent(); } break; }
  case 'war': {
    load(); const ws = E.warsOf(E.S.player); if (!ws.length) { P('You are not at war.'); break; }
    ws.forEach(w => { const side = E.warSideOf(w, E.S.player); P('WAR #' + w.id + ' vs ' + E.nm(w.lead[side === 'a' ? 'b' : 'a']) + ', ' + (E.S.turn - w.start + (w.m0 || 0)) + ' months, score ' + Math.round(side === 'a' ? w.score : -w.score));
      { const wf = E.warForces(w.id); if (wf) P(' Forces: ' + wf.verdict + ' (' + (wf.capped ? 'over 20' : wf.ratio.toFixed(1)) + ' to 1). War costs ' + wf.cost.toFixed(1) + '% of GDP a year.'); }
      P(' Plans:'); E.planList(w.id).forEach(p => P('  ' + (p.on ? '* ' : '  ') + p.id + ': ' + p.name + ' - ' + p.desc + (p.ok ? '' : ' <' + p.why + '>'))); P(' Operations:'); E.opList(w.id).forEach(o => P('  ' + (o.ok ? '[ok] ' : '[--] ') + o.id + ' (' + o.pc.toFixed(1) + ' PC): ' + o.name + ' - ' + o.desc + (o.ok ? '' : ' <' + o.why + '>'))); });
    break;
  }
  case 'plan': { load(); const r = E.setPlan(+args[0], args[1]); log('plan ' + args.join(' ')); P(r.text); save(); break; }
  case 'op': { load(); const r = E.doOp(+args[0], args[1]); log('op ' + args.join(' ') + ' -> ' + r.text); P((r.ok ? 'DONE: ' : 'FAILED: ') + r.text); save(); if (E.S.over) showOver(); else if (E.currentEvent()) { P(''); showEvent(); } break; }
  case 'blocs': { load(); E.aliveList(); const S = E.S; Object.keys(S.blocs).forEach(id => { const b = S.blocs[id]; const el = E.blocEligible(id, S.player); P(id + ': ' + b.name + ' - ' + (b.members.includes(S.player) ? 'YOU ARE A MEMBER' : (el && el.ok ? 'you can apply' : 'not eligible' + (el && el.why ? ' (' + el.why + ')' : '')))); }); break; }
  case 'apply': { load(); const r = E.applyToBloc(args[0]); log('apply ' + args[0]); P(r.text); save(); break; }
  case 'explain': { load(); const x = E.explain(args[0]); if (!x) { P('Nothing to explain.'); break; } P(x.title + ': ' + x.lead + (x.why ? ' ' + x.why : '')); x.rows.forEach(r => P('  ' + r.label + ': ' + (r.base ? r.v.toFixed(0) : (r.v >= 0 ? '+' : '') + r.v.toFixed(1)))); break; }
  case 'report': { load(); const m = E.monthlyReport(); if (!m) { P('No month closed yet.'); break; } P('MONTH-END REPORT ' + m.date); m.rev.forEach(x => P('  in  ' + x.label + ' ' + money(x.v) + (x.dPct && Math.abs(x.dPct) >= 0.5 ? ' (' + (x.d > 0 ? '+' : '') + x.dPct.toFixed(0) + '%)' : ''))); m.spend.forEach(x => P('  out ' + x.label + ' ' + money(x.v) + (x.dPct && Math.abs(x.dPct) >= 0.5 ? ' (' + (x.d > 0 ? '+' : '') + x.dPct.toFixed(0) + '%)' : ''))); P('  Balance ' + money(m.bal) + ', treasury ' + money(m.treasury) + ', debt ' + money(m.debt)); break; }
  case 'annual': { load(); const a = args[0] ? E.annualByYear(+args[0]) : E.annualLatest(); if (!a) P('No annual report yet (the first arrives each January).'); else annual(a); break; }
  case 'note': { load(); const t = args.join(' '); fs.appendFileSync(nf, '- [month ' + E.S.turn + ', ' + dateL() + '] ' + t + '\n'); P('Noted.'); break; }
  case 'legacy': { load(); if (!showOver()) P('Game is not over. Score so far: ' + E.legacy().total); break; }
  default: P('Unknown command. Run without arguments for help.');
}
} catch (e) { P('ENGINE ERROR (this may be a real bug, note it with the exact command): ' + (e && e.message)); fs.appendFileSync(lf, 'ERROR ' + cmd + ' ' + args.join(' ') + ': ' + (e && e.stack) + '\n'); }
console.log(out.join('\n'));
