// ===================== INTELLIGENCE UNDER UNCERTAINTY =====================
// Reports arrive with a confidence level. The truth is decided when the report is issued, and the
// confidence only loosely tracks it. Your interior minister's skill improves how reliable it is.

const CONF = ['low', 'moderate', 'high'];
function reportConf(real) {
  const skill = compBonus('security'); // about -2 to +2
  const w = real ? [0.2 - skill * 0.05, 0.45, 0.35 + skill * 0.05] : [0.5 + skill * 0.06, 0.4, 0.1 - skill * 0.03];
  const t = Math.max(0.02, w[0]) + Math.max(0.02, w[1]) + Math.max(0.02, w[2]); let r = rnd() * t;
  for (let i = 0; i < 3; i++) { r -= Math.max(0.02, w[i]); if (r <= 0) return CONF[i]; }
  return 'moderate';
}
const confLine = c => 'Confidence: ' + c + '.';
function tallyIntel(ok) { S.stat.intelRight = (S.stat.intelRight || 0) + (ok ? 1 : 0); S.stat.intelWrong = (S.stat.intelWrong || 0) + (ok ? 0 : 1); }

// ---- 1. a coup plot ----
ev('intelPlot', { cat: 'intl', cd: 20, w: c => (c.fac.military < 50 ? 0.6 : 0.12) + (c.stab < 40 ? 0.4 : 0) + (!isDemo(c.gov) ? 0.2 : 0),
  ctx: c => { const h = hazards(c).coup; const real = chance(clamp(0.15 + h * 10, 0.1, 0.75)); return { real, conf: reportConf(real), who: randName(), v: Math.floor(rnd() * 1000) }; },
  title: x => x.consulted ? 'Your minister\'s assessment of the plot' : 'Intelligence: officers may be plotting',
  text: x => (x.consulted ? 'Your interior minister has gone back over the sources and now gives a firmer view. ' : 'Your security service reports chatter among senior officers, and names a general, ' + x.who + ', as a possible focal point. Nothing is confirmed. ') + confLine(x.conf) + ' The report could be right, or it could be a rival feeding the service a story.',
  options: x => [
    sOpt('Arrest the suspected plotters', 'Decisive if it is real. Ruinous if it is not.', () => { const me_ = me(); if (x.real) { fac(me_, 'military', -6); me_.flags.coupProof = S.turn + 12; ap(me_, 1, 4); tallyIntel(true); return 'Officers are detained before dawn. Documents show the plot was real, and would have moved within weeks.'; } fac(me_, 'military', -13); ap(me_, -3, 5); fac(me_, 'party', -2); tallyIntel(false); return 'The arrests go ahead. Investigators find nothing. The officers were loyal, and the army knows it.'; }),
    sOpt('Buy loyalty quietly', 'Costs 0.3% of GDP. Works either way.', () => { spendPct(me(), 0.3); fac(me(), 'military', 5); me().flags.coupProof = S.turn + 10; tallyIntel(x.real); return x.real ? 'Bonuses, promotions and a few postings abroad. The plot loses its momentum. You later learn it had been real.' : 'Perks are handed out and everyone is a little happier. There was probably nothing there.'; }),
    sOpt('Ask your interior minister to re-check', 'A firmer view, though not a certain one. (' + pcCost(1) + ' PC)', () => { S.pc -= pcCost(1); const acc = clamp(0.5 + 0.1 * (S.cabinet && S.cabinet.security ? S.cabinet.security.comp : 3), 0.55, 0.95); const says = chance(acc) ? x.real : !x.real; queueEvent('intelPlot', { real: x.real, conf: says ? 'high' : 'low', who: x.who, consulted: true, v: x.v }); return 'Your minister goes back to the sources.'; }, !x.consulted && S.pc >= pcCost(1) ? {} : { ok: false, why: x.consulted ? 'Already re-checked.' : 'Not enough political capital.' }),
    sOpt('Do nothing', 'Cheap if the report is wrong.', () => { if (x.real) { tallyIntel(false); if (chance(0.4)) { S.over = { type: 'coup', title: 'Overthrown in a coup', text: 'The report was right. Officers moved before dawn, and the plot you chose to ignore ended your rule.' }; return 'The report was right.'; } fac(me(), 'military', -3); return 'Nothing happens. Whether the plot fizzled or is still forming, you cannot tell.'; } tallyIntel(true); return 'Nothing happens, which is what you expected.'; }),
  ] });

// ---- 2. is an ally really behind you? ----
ev('intelAlly', { cat: 'intl', cd: 24, w: () => 0.45,
  ctx: c => { const al = defenceAllies(S.player).filter(x => x !== S.player && alive(x) && C(x).army > 3); if (!al.length) return null; const a = pick(al); const shaky = chance(clamp(0.45 - R(S.player, a) / 250, 0.15, 0.55)); const truth = shaky ? 'shaky' : 'solid'; return { a, truth, conf: reportConf(shaky), v: Math.floor(rnd() * 1000) }; },
  title: x => 'Doubts over ' + nm(x.a),
  text: x => 'Your foreign service picks up signs that ' + nm(x.a) + ' may not honour its commitments to you if you are attacked. ' + confLine(x.conf) + ' Their public position has not changed, and you cannot see what they would really do.',
  enter: x => { S.allyIntel = S.allyIntel || {}; S.allyIntel[x.a] = { truth: x.truth, until: S.turn + 24 }; },
  options: x => [
    sOpt('Ask for a public reaffirmation', 'Locks them in if they are sound. Insulting if they are not.', () => { if (x.truth === 'solid') { addR(S.player, x.a, 5); tallyIntel(false); return nm(x.a) + ' gladly reaffirms its commitment. It was never in doubt.'; } if (chance(0.5)) { S.allyIntel[x.a] = { truth: 'solid', until: S.turn + 30 }; addR(S.player, x.a, 3); tallyIntel(true); return nm(x.a) + ' is cornered into a public pledge. The doubts were real, and now they are bound.'; } addR(S.player, x.a, -8); tallyIntel(true); return nm(x.a) + ' takes offence at being asked, and its answer is vague. The doubts were real.'; }),
    sOpt('Reassure them quietly', 'Small gain in relations.', () => { addR(S.player, x.a, 4); return 'A private message, and a promise of consultation. Their tone warms a little.'; }),
    sOpt('Ignore the report', 'Cost-free, if it is wrong.', () => { tallyIntel(x.truth === 'solid'); return 'You take no action, and will find out when it matters.'; }),
    sOpt('Court other partners', 'Diversify your friends. (' + pcCost(1) + ' PC)', () => { S.pc -= pcCost(1); const c = friends(S.player, 10).filter(i => i !== x.a && C(i).army > 3); const t = c.length ? pick(c) : null; if (t) addR(S.player, t, 8); me().prest = clamp(me().prest + 1, 0, 100); return t ? 'You open a new channel to ' + nm(t) + ', in case ' + nm(x.a) + ' does not come through.' : 'You find no obvious new partner.'; }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
  ] });

// ---- 3. is a neighbour preparing to attack? ----
ev('intelBuildup', { cat: 'intl', cd: 22, w: () => 0.55,
  ctx: c => { const o = aliveList().filter(x => x !== S.player && !warBetween(S.player, x) && canReach(S.player, x) && R(S.player, x) < -20 && C(x).army > 3 && (rivalryOf(S.player, x) > 0 || (NB[S.player] || []).includes(x))); if (!o.length) return null; const a = pick(o); const real = chance(clamp(0.2 + (-R(S.player, a) - 20) / 150 + leaderAggr(C(a)) * 0.4, 0.15, 0.7)); return { o: a, real, conf: reportConf(real), v: Math.floor(rnd() * 1000) }; },
  title: x => (NB[S.player] || []).includes(x.o) ? 'Forces massing near ' + nm(x.o) + '\'s border' : 'Unusual military build-up in ' + nm(x.o),
  text: x => 'Satellite images and signals intelligence suggest ' + nm(x.o) + ' is ' + ((NB[S.player] || []).includes(x.o) ? 'moving armour and supplies toward your frontier. ' : 'concentrating ships, aircraft and long-range forces in a way that could be aimed at you. ') + confLine(x.conf) + ' It might be an exercise. It might be the first stage of something worse.',
  enter: x => { if (x.real) C(x.o).flags.warPrep = S.turn + 9; },
  options: x => [
    sOpt('Raise readiness and mobilise', 'Costs 1 PC and unsettles business. Deters a real attack.', () => { S.pc -= pcCost(1); if ((me().mob || 0) < 1) setMobilisation(1); me().readiness = clamp(me().readiness + 8, 10, 100); S.world.tension = clamp(S.world.tension + 2, 0, 100); if (x.real) { tallyIntel(true); return 'Your forces go to alert. ' + nm(x.o) + '\'s planners take note, and the build-up stalls. It was real.'; } tallyIntel(false); return 'Your forces go to alert. ' + nm(x.o) + ' says it is conducting routine exercises, and condemns your reaction.'; }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
    sOpt('Warn them publicly', 'Naming and shaming. Costs relations.', () => { addR(S.player, x.o, -6); if (x.real && chance(0.5)) { C(x.o).flags.warPrep = 0; tallyIntel(true); return 'Your warning is public and unambiguous. ' + nm(x.o) + ' backs down, denying any plan. It was real.'; } if (!x.real) tallyIntel(false); S.world.tension = clamp(S.world.tension + 1, 0, 100); return nm(x.o) + ' calls your warning provocative. Where this goes is unclear.'; }),
    sOpt('Share the intelligence with allies', 'Builds support without escalating.', () => { aliveList().forEach(i => { if (i !== S.player && hasPact(S.player, i)) addR(S.player, i, 3); }); me().prest = clamp(me().prest + 1, 0, 100); return 'Your partners are grateful to be consulted. Their views on the report are mixed.'; }),
    sOpt('Dismiss it', 'Save the money. Risky if it is real.', () => { tallyIntel(!x.real); return x.real ? 'You put the report down as noise. Time will tell.' : 'You judge it an exercise, and nothing further comes of it.'; }),
  ] });

Object.assign(Engine, { intelRecord: () => ({ right: S.stat.intelRight || 0, wrong: S.stat.intelWrong || 0 }) });
