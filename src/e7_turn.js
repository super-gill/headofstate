// ===================== TURN ENGINE, SCORING, API =====================
function tickShocks() {
  const w = S.world; w.shocks = (w.shocks || []).filter(s => s.t > 0);
  let cyc = 0, oil = 0, food = 0;
  w.shocks.forEach(s => { const eff = s.v * Math.min(1, s.t / Math.max(3, s.T * 0.4)); if (s.k === 'cycle') cyc += eff; else if (s.k === 'oil') oil += eff; else if (s.k === 'food') food += eff; s.t--; });
  w.noise = (w.noise || 0) * 0.92 + gauss() * 0.1;
  w.cycle = cyc + w.noise; w.oil = clamp(1 + oil + (w.oilNoise = (w.oilNoise || 0) * 0.93 + gauss() * 0.02), 0.5, 2.5); w.food = food;
}

function advanceDate() { S.date.m++; if (S.date.m > 11) { S.date.m = 0; S.date.y++; } S.turn++; }

function endTurn() {
  if (S.over) return;
  const p = me();
  const startPc = S.pc;
  whySnap();
  advanceDate();
  S.newsStart = S.news.length ? S.news[0] : null;
  S.turnNewsCount = 0; const before = S.news.length;
  aliveList().forEach(i => { C(i).warDmg = 0; });
  tickShocks();
  // wars
  S.wars.slice().forEach(w => { if (S.wars.includes(w)) warStep(w); });
  // countries
  aliveList().forEach(i => {
    const c = C(i);
    if (i === S.player) { econStep(c, true); politicsStep(c); } else aiStep(c);
    tickMods(c);
    if (c.flags.supporting && c.flags.supporting.length) c.flags.supporting = c.flags.supporting.filter(x => alive(x));
  });
  terrStep();
  cabinetStep(); leadersStep(); storyStep(); ambitionStep(); aftermathStep(); projectStep(); creditStep(); reportsStep();
  // world
  driftRelations();
  aiDiplomacy();
  if (chance(0.004)) rogueNews();
  aiWarStarts();
  S.world.nukeAlert = (S.world.nukeAlert || 0) * 0.92;
  S.world.tension += (computeTension() - S.world.tension) * 0.2;
  S.world.tension = clamp(S.world.tension, 0, 100);
  if (S.over) { finalise(); return; }
  // player timers
  S.apps.slice().forEach(a => { if (S.turn >= a.due) resolveApp(a); });
  if (p.flags.nukeProg > 0) {
    p.flags.nukeProg--;
    if (p.flags.nukeProg === 12 && chance(0.6) || (p.flags.nukeProg > 0 && chance(0.03))) queueEvent('nukeDiscovered', {});
    if (p.flags.nukeProg === 0) { p.nukes = 1; p.prest = clamp(p.prest + 8, 0, 100); news(p.name + ' has become a nuclear-armed state.', 'nuclear', p.iso); aliveList().forEach(i => { if (i !== S.player) addR(S.player, i, isDemo(C(i).gov) ? -8 : -3); }); S.dirtyBase = true; logPlayer('Your nuclear weapons programme succeeded.'); queueEvent('nukeDone', {}); }
  }
  // survival
  const surv = checkSurvival(p);
  if (surv) { S.over = surv; finalise(); return; }
  // elections
  if (isDemo(p.gov)) {
    S.electionIn--;
    const lastTerm = S.termLimits && p.gov === 'D' && S.terms >= 2;
    if (S.electionIn === 2 && !lastTerm) queueEvent('campaign', {});
    if (S.electionIn <= 0) {
      if (S.termLimits && p.gov === 'D' && S.terms >= 2) { S.over = { type: 'term', title: 'Term limits end your time in office', text: 'After two terms the constitution requires you to step aside. You leave office with the country still standing.', graceful: true }; finalise(); return; }
      const won = chance(electionOdds(p)); S.flags.campaign = 0;
      if (won) { S.terms++; S.electionIn = GOV[p.gov].term; queueEvent('electionResult', { won: true, share: clamp(48 + (p.fac.public - 45) * 0.45 + gauss() * 2, 40, 80), rigged: p.gov === 'H' }); addMod(p, 'appr', 3, 6); S.pc = Math.min(S.pcMax, S.pc + 2); logPlayer('Won the election.'); }
      else { S.over = { type: 'election', title: 'Voted out of office', text: 'The people have had enough. Your opponents won the election and your time in power is over.' }; finalise(); return; }
    }
  }
  whyDone();
  // decade milestones and random events
  drawEvents();
  if (S.over) { finalise(); return; }
  recordHistory();
  S.turnNewsCount = S.news.length - before;
}

function drawEvents() {
  if (S.events.length >= 3) return;
  const p = me();
  let n = (chance(0.7) ? 1 : 0) + (chance(0.2) ? 1 : 0) + (S.wars.some(playerBelligerentIn) && chance(0.25) ? 1 : 0);
  if (S.turn < 2) n = 0;
  n = Math.min(n, 2);
  const all = Object.values(EVENTS).filter(d => d.cat !== 'system' && d.cat !== 'story');
  for (let k = 0; k < n; k++) {
    const cands = all.filter(d => (S.eventHist[d.id] == null) || S.eventHist[d.id] + Math.round((d.cd || 10) * 1.4) <= S.turn).filter(d => !S.events.some(e => e.id === d.id));
    let tries = 0;
    while (tries++ < 6) {
      const d = weighted(cands, d => (d.w ? d.w(p) : 1) * (EV_MULT[d.id] ? EV_MULT[d.id](p) : 1) * Math.max(0.35, 1 / (1 + 0.3 * ((S.eventN || {})[d.id] || 0))));
      if (!d) break;
      const ctx = d.ctx ? d.ctx(p) : {};
      if (ctx === null) { const i = cands.indexOf(d); if (i >= 0) cands.splice(i, 1); continue; }
      queueEvent(d.id, ctx); break;
    }
  }
}

// events for the UI
function currentEvent() {
  const e = S.events[0]; if (!e) return null;
  const d = EVENTS[e.id];
  const vw = evView(e, d);
  const rawOpts = d.options(e.ctx);
  return { id: e.id, cat: d.cat, title: vw.title, text: vw.text, advice: rawOpts.length > 1 ? adviceFor(rawOpts) : [], options: rawOpts.map((o, i) => ({ i, label: o.label, hint: o.hint, ok: o.ok !== false, why: o.why })) };
}
function resolveEvent(i) {
  const e = S.events[0]; if (!e) return null;
  const d = EVENTS[e.id]; const allOpts = d.options(e.ctx); const o = allOpts[i];
  if (!o || o.ok === false) return { text: (o && o.why) || 'Not available.', chips: [] };
  const before = snapshot(me()); const pc0 = S.pc;
  S.events.shift();
  if (allOpts.length > 1) cabinetReact(allOpts, i);
  const text = withSrc(evView(e, d).title, () => o.run(e.ctx));
  S.stat.eventsSeen++;
  if (d.cat !== 'system' || e.id === 'allyCall' || e.id === 'warDeclared') logPlayer(evView(e, d).title + ': ' + text);
  if (S.over) finalise();
  return { text, chips: diffChips(before, snapshot(me())), title: evView(e, d).title };
}

// extra system events
ev('nukeDiscovered', { cat: 'system',
  title: () => 'Your nuclear programme is exposed', text: () => 'Foreign intelligence agencies have revealed evidence of a secret weapons programme. Capitals are reacting with alarm.',
  options: () => [
    opt('Deny everything', 'Buys time. Not much.', () => { aliveList().forEach(i => { if (i !== S.player && C(i).army > 5) addR(S.player, i, -3); }); return 'You call the reports fabrications. Few believe you.'; }),
    opt('Defiant announcement', 'Own it. Rally the nation.', () => { ap(me(), 5, 8); me().prest = clamp(me().prest - 5, 0, 100); aliveList().forEach(i => { if (i !== S.player) addR(S.player, i, isDemo(C(i).gov) ? -8 : -3); }); S.world.tension = clamp(S.world.tension + 6, 0, 100); aliveList().filter(i => C(i).gdp > 500 && R(S.player, i) < 10 && i !== S.player && chance(0.5)).forEach(i => { if (!sanctioned(i, S.player)) S.sanctions.push({ by: i, on: S.player, turn: S.turn }); }); S.dirtyBase = true; return 'You declare the programme a sovereign right. Sanctions follow.'; }),
    opt('Offer inspections', 'Slow the programme, calm the world.', () => { me().flags.nukeProg = (me().flags.nukeProg || 0) + 8; me().prest = clamp(me().prest + 1, 0, 100); return 'Inspectors are invited in. The programme is delayed.'; }),
  ] });
ev('nukeDone', { cat: 'system',
  title: () => 'You have the bomb', text: () => 'Your first nuclear device has been successfully tested. You now belong to the world\'s smallest and most feared club.',
  options: () => [opt('Announce it to the world', 'Prestige. Alarm.', () => { me().prest = clamp(me().prest + 4, 0, 100); ap(me(), 4, 6); S.world.tension = clamp(S.world.tension + 4, 0, 100); return 'The announcement changes how everyone deals with you.'; }), opt('Stay ambiguous', 'Quiet deterrence.', () => 'You neither confirm nor deny.')] });

// ---------- player nuclear option ----------
function playerNuke(t) {
  const p = me(); const w = warBetween(S.player, t);
  if (!p.nukes) return { ok: false, text: 'You have no nuclear weapons.' };
  if (!w) return { ok: false, text: 'You are not at war with them.' };
  nuclearStrike(S.player, t, w);
  p.appr = clamp(p.appr - 15, 0, 100); p.stab = clamp(p.stab - 8, 0, 99);
  logPlayer('You authorised a nuclear strike on ' + nm(t) + '.');
  if (S.over) finalise();
  return { ok: true, text: 'The unthinkable has happened. The world will never look at you the same way.' };
}
function retire() {
  S.over = { type: 'retire', title: 'You step down', text: 'You leave office by choice, with the country still standing.', graceful: true };
  finalise();
}

// ---------- legacy ----------
function legacy() {
  const c = me(), s = S.startStats, yrs = S.turn / 12;
  const parts = [];
  parts.push({ label: 'Time in power', pts: Math.round(Math.min(60, yrs * 3.5)) });
  const gdpGrowth = Math.log(c.gdp / s.gdp) / Math.log(1.6);
  parts.push({ label: 'Economic growth', pts: Math.round(clamp(gdpGrowth * 40, -30, 70)) });
  parts.push({ label: 'Living standards', pts: Math.round(clamp(((c.gdp / c.pop) / (s.gdp / s.pop) - 1) * 40, -20, 40)) });
  parts.push({ label: 'Public standing', pts: Math.round((c.appr - 50) * 0.4 + (c.stab - 50) * 0.3) });
  parts.push({ label: 'Liberty', pts: Math.round(clamp((c.free - s.free) * 0.35, -20, 20)) });
  parts.push({ label: 'Prestige abroad', pts: Math.round((c.prest - s.prest) * 0.8) });
  parts.push({ label: 'Wars won', pts: S.stat.warsWon * 8 });
  parts.push({ label: 'Wars lost', pts: -S.stat.warsLost * 12 });
  parts.push({ label: 'Peacemaking', pts: Math.min(5, S.stat.ceasefires) * 3 });
  parts.push({ label: 'Conquests', pts: -S.stat.annexed * 6 });
  if (S.stat.projDone) parts.push({ label: 'National programmes completed', pts: Math.min(3, S.stat.projDone) * 3 });
  { const held = terrOf(S.player), okT = held.filter(t => t.integ >= 70).length; if (okT) parts.push({ label: 'Territories fully integrated', pts: okT * 4 }); if (S.stat.terrLost) parts.push({ label: 'Territories lost to revolt', pts: -S.stat.terrLost * 5 }); }
  if (S.world.nukeUse) parts.push({ label: 'Nuclear catastrophe', pts: -Math.min(60, 20 * S.world.nukeUse) });
  if (S.over && S.over.type === 'nuclear') parts.push({ label: 'End of the world', pts: -200 });
  { const al = ambitionLegacy(); if (al) parts.push(al); }
  const total = parts.reduce((a, b) => a + b.pts, 0);
  const rank = total < 0 ? 'A cautionary tale' : total < 40 ? 'Barely remembered' : total < 90 ? 'A capable leader' : total < 150 ? 'A distinguished statesman' : total < 220 ? 'A leader for the history books' : 'One of the greats';
  return { parts, total, rank, years: yrs };
}
function finalise() { if (S.over && !S.over.legacy) { S.over.legacy = legacy(); S.over.date = dateLabel(); } }


// ---------- did you leave it better than you found it? ----------
function report() {
  const c = me(), s = S.startStats, si = S.startInfo || {}, now = snapshot(c), rk = ranks();
  const rows = []; let score = 0;
  const pcap = (c0, c1) => (c1 / c0);
  const add = (label, from, to, verdict, w, why) => { rows.push({ label, from, to, verdict, w, why }); score += (verdict === 'better' ? 1 : verdict === 'worse' ? -1 : 0) * w; };
  const ratio = (a, b, up, dn) => { const r = b / Math.max(1e-9, a); return r >= up ? 'better' : r <= dn ? 'worse' : 'same'; };
  const delta = (a, b, th, higherBetter) => { const d = (b - a) * (higherBetter ? 1 : -1); return d >= th ? 'better' : d <= -th ? 'worse' : 'same'; };
  const pcOf = x => x.gdp * 1000 / x.pop;
  add('Economy (nominal GDP)', money(s.gdp), money(now.gdp), ratio(s.gdp, now.gdp, 1.08, 0.96), 2);
  add('GDP per person', '$' + Math.round(pcOf(s)).toLocaleString('en-US'), '$' + Math.round(pcOf(now)).toLocaleString('en-US'), ratio(pcOf(s), pcOf(now), 1.06, 0.96), 2);
  add('Population', popStr(s.pop), popStr(now.pop), 'same', 0);
  add('Personal liberty', Math.round(s.free) + '', Math.round(now.free) + '', delta(s.free, now.free, 5, true), 1);
  add('Corruption', Math.round(s.corr) + '', Math.round(now.corr) + '', delta(s.corr, now.corr, 5, false), 1);
  add('National debt (% of GDP)', Math.round(s.debt) + '%', Math.round(now.debt) + '%', delta(s.debt, now.debt, 8, false), 1);
  add('Social stability', Math.round(s.stab) + '', Math.round(now.stab) + '', delta(s.stab, now.stab, 6, true), 1);
  add('Public approval', Math.round(s.appr) + '%', Math.round(now.appr) + '%', delta(s.appr, now.appr, 8, true), 0.5);
  add('Prestige abroad', Math.round(s.prest) + '', Math.round(now.prest) + '', delta(s.prest, now.prest, 5, true), 1);
  add('Military power', Math.round(s.army) + '', Math.round(now.army) + '', ratio(s.army, now.army, 1.2, 0.8), 0.5);
  if (si.rankGdp) add('World rank by economy', '#' + si.rankGdp, '#' + rk.gdp[S.player], rk.gdp[S.player] < si.rankGdp ? 'better' : rk.gdp[S.player] > si.rankGdp ? 'worse' : 'same', 1);
  if (si.rankPow) add('World rank by military', '#' + si.rankPow, '#' + rk.pow[S.player], rk.pow[S.player] < si.rankPow ? 'better' : rk.pow[S.player] > si.rankPow ? 'worse' : 'same', 0.5);
  if (si.allies != null) { const al = defenceAllies(S.player).length; add('Defence allies', si.allies + '', al + '', al > si.allies + 1 ? 'better' : al < si.allies - 1 ? 'worse' : 'same', 0.5); }
  const wars = warsOf(S.player).length; add('Wars in progress', '0', wars + '', wars ? 'worse' : 'same', 1);
  if (si.gov && si.gov !== c.gov) add('System of government', GOV[si.gov].name, GOV[c.gov].name, c.free > s.free + 5 ? 'better' : c.free < s.free - 5 ? 'worse' : 'same', 0);
  if (!si.nukes && c.nukes) add('Nuclear weapons', 'None', 'Armed', 'same', 0);
  const verdict = score >= 5 ? 'Clearly better' : score >= 2 ? 'Better in most ways' : score > -2 ? 'Mixed' : score > -5 ? 'Worse in most ways' : 'Clearly worse';
  const name = c.name;
  const phrase = { 'Clearly better': 'You left ' + name + ' clearly better than you found it.', 'Better in most ways': 'You left ' + name + ' better in most of the ways that count.', 'Mixed': name + ' ends up roughly where it started: gains in some areas, losses in others.', 'Worse in most ways': 'You left ' + name + ' worse off than you found it in most respects.', 'Clearly worse': 'You left ' + name + ' clearly worse than you found it.' }[verdict];
  const best = rows.filter(r => r.verdict === 'better').sort((a, b) => b.w - a.w)[0], worst = rows.filter(r => r.verdict === 'worse').sort((a, b) => b.w - a.w)[0];
  let extra = '';
  if (best) extra += ' Biggest gain: ' + best.label.toLowerCase() + ' (' + best.from + ' to ' + best.to + ').';
  if (worst) extra += ' Biggest loss: ' + worst.label.toLowerCase() + ' (' + worst.from + ' to ' + worst.to + ').';
  return { verdict, headline: phrase + extra, rows, score, better: rows.filter(r => r.verdict === 'better').length, worse: rows.filter(r => r.verdict === 'worse').length, months: S.turn };
}

// ---------- briefing ----------
function briefing() {
  const c = me(), out = [], h = hazards(c), g = GOV[c.gov];
  const add = (lvl, text) => out.push({ lvl, text });
  const yr = x => Math.round((1 - Math.pow(1 - x, 12)) * 100);
  if (h.coup > 0.006) add('bad', 'Coup risk is elevated: about ' + yr(h.coup) + '% over the next year. The armed forces are restless.');
  if (h.palace > 0.006) add('bad', 'Insiders are plotting against you: about ' + yr(h.palace) + '% risk this year.');
  if (h.uprising > 0.004) add('bad', 'A popular uprising is a real possibility (' + yr(h.uprising) + '% this year).');
  if (h.noconf > 0.004) add('bad', 'Your party could depose you (' + yr(h.noconf) + '% this year).');
  if (c.appr < 35) add('bad', 'Public approval has fallen to ' + Math.round(c.appr) + '%.');
  if (c.infl > c.baseInfl + 4) add('warn', 'Inflation is running at ' + c.infl.toFixed(1) + '%.');
  if (c.unemp > c.baseUnemp + 3) add('warn', 'Unemployment has risen to ' + c.unemp.toFixed(1) + '%.');
  if (debtPct(c) > 100) add('warn', 'National debt is ' + Math.round(debtPct(c)) + '% of GDP. Markets are watching.');
  { const ci = creditInfo(); if (ci) {
    if (ci.junk) add('bad', 'Your credit rating is ' + ci.rating + ', below investment grade. Borrowing costs ' + (Math.abs(ci.premium) > 0.05 ? Math.abs(ci.premium).toFixed(1) + ' points more than when you started' : 'more now') + (ci.idx === 6 ? ', and a failed bond auction is a real risk.' : '.'));
    else if (ci.outlook === 'Negative' && ci.idx >= 2) add('warn', 'Credit rating ' + ci.rating + ' with a negative outlook. A downgrade is possible if the books do not improve.');
    if (ci.gap > 0) add('bad', 'The market will lend you only ' + money(ci.capYr) + ' a year. The rest of the deficit goes unpaid: salaries and pensions are late, and unrest is building.');
    else if (ci.capYr != null && ci.junk) add('warn', 'Lenders will now finance only ' + money(ci.capYr) + ' of new debt a year. Beyond that, bills go unpaid.');
    if (ci.last && S.turn - ci.last.t <= 6) add(ci.last.to > ci.last.from ? 'warn' : 'good', 'Credit rating ' + (ci.last.to > ci.last.from ? 'cut' : 'raised') + ' to ' + ci.rating + ' ' + (S.turn - ci.last.t <= 1 ? 'last month' : (S.turn - ci.last.t) + ' months ago') + '.');
    if (ci.arrears > 0) add('bad', 'Unpaid bills from months when lenders refused to lend total ' + money(ci.arrears) + '.');
    if (ci.borrowing) add('warn', 'The treasury is empty, so every month\'s shortfall is borrowed at ' + ci.rate.toFixed(1) + '%.');
  } }
  if (c.fisc && c.fisc.balance < -c.gdp * 0.06) add('warn', 'The deficit is ' + (-c.fisc.balance / c.gdp * 100).toFixed(1) + '% of GDP.');
  if (c.growth < 0) add('warn', 'The economy is shrinking (' + c.growth.toFixed(1) + '% annualised).');
  if (c.corr > 65) add('warn', 'Corruption is severe and is draining revenue.');
  if (c.fac.military < 40 && g.coup > 0.05) add('warn', 'Your generals are unhappy.');
  warsOf(S.player).forEach(w => { const s = warSideOf(w, S.player); const sc = s === 'a' ? w.score : -w.score; add(sc < -30 ? 'bad' : 'info', 'At war with ' + nm(w.lead[s === 'a' ? 'b' : 'a']) + ' (' + (sc > 15 ? 'winning' : sc < -15 ? 'losing' : 'stalemate') + ').'); });
  terrOf(S.player).forEach(t => {
    if (t.unrest > 68) add('bad', nm(t.iso) + ' is close to revolt (unrest ' + Math.round(t.unrest) + '). ' + (t.posture === 'garrison' ? 'The garrison is holding it, for now.' : 'A light touch is not enough here.'));
    else if (t.unrest > 50 && t.posture === 'light') add('warn', 'Resentment is building in ' + nm(t.iso) + '. Integration is only ' + Math.round(t.integ) + '/100.');
  });
  if (isDemo(c.gov) && S.electionIn > 0 && S.electionIn <= 12 && S.termLimits && c.gov === 'D' && S.terms >= 2) add('info', 'Term limits: your final term ends in ' + mo(S.electionIn) + '. You cannot stand again, so the vote is for your successor.');
  else if (isDemo(c.gov) && S.electionIn > 0 && S.electionIn <= 12) add('info', 'Election in ' + mo(S.electionIn) + '. Odds of victory: ' + Math.round(electionOdds(c) * 100) + '%.');
  if (S.apps.length) add('info', 'Application to ' + S.blocs[S.apps[0].bloc].name + ' pending.');
  if (S.world.tension > 65) add('warn', 'Global tension is dangerously high.');
  if (c.flags.nukeProg > 0) add('info', 'Nuclear programme: ' + mo(c.flags.nukeProg) + ' to completion.');
  if (S.pc >= S.pcMax - 1) add('info', 'Political capital is nearly full. Spend it or lose it: policies, national programmes and new diplomacy all use it.');
  if (c.growth > c.baseGrowth + 1 && c.appr > 55) add('good', 'The economy is doing well and voters know it.');
  if (!out.length) add('good', 'No urgent crises. A good moment to plan ahead.');
  return out;
}

// ---------- country info ----------
function ranks() {
  if (S._rk && S._rk.turn === S.turn) return S._rk;
  const l = aliveList(); const byGdp = l.slice().sort((a, b) => C(b).gdp - C(a).gdp), byPow = l.slice().sort((a, b) => power(C(b)) - power(C(a))), byPop = l.slice().sort((a, b) => C(b).pop - C(a).pop);
  const rk = { turn: S.turn, gdp: {}, pow: {}, pop: {} };
  byGdp.forEach((k, i) => rk.gdp[k] = i + 1); byPow.forEach((k, i) => rk.pow[k] = i + 1); byPop.forEach((k, i) => rk.pop[k] = i + 1);
  S._rk = rk; return rk;
}
function countryInfo(iso) {
  const c = C(iso), rk = ranks(); const isMe = iso === S.player;
  const o = ownerOf(iso);
  return {
    iso, leader: iso === S.player ? null : leaderInfo(iso), name: c.name, alive: c.alive, ownerName: o !== iso ? nm(o) : null, gov: GOV[c.gov].name, govCode: c.gov,
    pop: c.pop, gdp: c.gdp, gdppc: c.gdp * 1000 / c.pop, growth: c.growth, power: power(c), nukes: c.nukes, tech: c.tech, stab: c.stab, appr: c.appr, prest: c.prest, free: c.free,
    rel: isMe ? null : R(S.player, iso), relWord: isMe ? '' : relWord(R(S.player, iso)),
    rankGdp: rk.gdp[iso], rankPow: rk.pow[iso], rankPop: rk.pop[iso],
    blocs: blocsOf(iso), allies: defenceAllies(iso).slice(0, 12), pact: hasPact(S.player, iso), deal: hasDeal(S.player, iso), sanctionedByYou: sanctioned(S.player, iso), sanctionedYou: sanctioned(iso, S.player),
    rivals: rival(iso).map(x => ({ iso: x, n: rivalryOf(iso, x), why: (S.rivals.find(r => (r.a === iso && r.b === x) || (r.b === iso && r.a === x)) || {}).why })),
    wars: warsOf(iso).map(w => ({ id: w.id, vs: w.a.includes(iso) ? w.lead.b : w.lead.a })),
    intel: S.intel[iso] != null && S.turn - S.intel[iso] < 18,
    nbrs: nbrs(iso), camp: c.camp,
  };
}

function snapshotAll() { return S; }

// ---------- save / load ----------
function serialize() {
  const s = Object.assign({}, S); s.rel = Array.from(S.rel, v => Math.round(v * 10) / 10); s.base = null; s._rk = null;
  return JSON.stringify(s);
}
function hydrate(str) {
  const o = JSON.parse(str);
  o.rel = Float32Array.from(o.rel); o.base = new Float32Array(N * N);
  if (o.v > 3) throw new Error('newer'); if (o.v !== 3) throw new Error('older');
  S = o; buildBase(); terrMigrate(); cabinetEnsure(); return S;
}

const Engine = {
  newGame: o => newGameState(o), hydrate, serialize, get S() { return S; }, GOV, ISOS, ROW, MONTHS, BUDGET_LIM,
  endTurn, currentEvent, resolveEvent, policyList, enact, dipList, doDip, applyToBloc, leaveBloc, blocEligible, blocOdds, setBudget, setMobilisation, setStance,
  empireList, setPosture, POSTURES: () => POSTURES, briefing, countryInfo, hazards, fiscalPreview, S_blocs: () => S.blocs, GOV_LIST: () => GOV, playerNuke, retire, legacy, electionOdds, powerBase, debtPct, canAnnex, annexReason, warVoteOdds: (kind, t, goal) => needsVote() ? voteOdds(kind, t, goal) : null, needsVote, canReach, hasCB, intelText, report,
  R, C, me, nm, alive, aliveList, power, warsOf, atWar, warSideOf, warBetween, defenceAllies, blocsOf, rivalryOf, hasPact, hasDeal, sanctioned, relWord, dateLabel, money, popStr, ownerOf, NB, enemiesOf, pcCost, aidCost,
  playerBelligerentIn, planList, setPlan, opList, doOp, fmt: { money, popStr }, isDemo, isAuto, FAC, computeTension, mo, pcCost,
};
