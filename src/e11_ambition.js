// ===================== SCENARIOS AND PERSONAL AMBITIONS =====================

const SCENARIOS = {
  standard: { n: 'Standard start', d: 'The world as it is. No special conditions.', amb: null },
  collapse: { n: 'A state on the brink', d: 'Stability is low, the treasury is empty and people are angry. Pull the country back from the edge.', amb: 'stabilise' },
  rising: { n: 'Rising power', d: 'Strong growth and a growing army, but neighbours are wary of your ambitions.', amb: 'greatpower' },
  flashpoint: { n: 'Flashpoint year', d: 'Tension is high, an old dispute is flaring and energy prices are climbing. Every decision counts.', amb: 'peace' },
  aftershock: { n: 'After the crash', d: 'A deep recession has hit. Jobs are gone, debt is high, and voters want answers.', amb: 'prosperity' },
  coldwar: { n: 'Blocs harden', d: 'The world is splitting into camps. Friends are close, rivals are closer to hostile.', amb: 'alliances' },
};

function applyScenario(id) {
  const p = me(); if (!id || id === 'standard' || !SCENARIOS[id]) return;
  S.scenario = id;
  if (id === 'collapse') {
    p.stab = Math.max(14, p.stab - 22); p.appr = Math.max(20, p.appr - 14); p.unemp += 3; p.growth -= 2; p.debtAbs += p.gdp * 0.25; p.corr = clamp(p.corr + 6, 0, 100);
    FAC.forEach(f => { p.fac[f] = clamp(p.fac[f] - 8, 5, 95); }); p.fac.public = p.appr; p.treasury = 0;
    addMod(p, 'stab', -9, 30); addMod(p, 'appr', -7, 30); addMod(p, 'growth', -1.0, 30);
  } else if (id === 'rising') {
    addMod(p, 'growth', 1.6, 60); p.army *= 1.25; p.prest = clamp(p.prest + 6, 0, 100); (NB[S.player] || []).forEach(n => { if (alive(n)) addR(S.player, n, -10); });
  } else if (id === 'flashpoint') {
    S.world.nukeAlert = 15; addShock('oil', 0.4, 12);
    const near = (NB[S.player] || []).filter(n => alive(n) && C(n).army > 1).sort((a, b) => C(b).army - C(a).army)[0] || aliveList().filter(x => x !== S.player && canReach(S.player, x)).sort((a, b) => R(S.player, a) - R(S.player, b))[0];
    if (near) { addR(S.player, near, -40); S.cb[pkey(S.player, near)] = S.turn + 24; S.cb[pkey(near, S.player)] = S.turn + 24; }
    p.readiness = clamp(p.readiness + 8, 10, 100);
  } else if (id === 'aftershock') {
    addShock('cycle', -2.5, 20); p.unemp += 2.5; p.debtAbs += p.gdp * 0.2; p.appr = Math.max(25, p.appr - 6); p.fac.public = p.appr;
  } else if (id === 'coldwar') {
    aliveList().forEach(x => { if (x === S.player) return; const a = C(x).camp, b = p.camp; if (!a || !b) return; addR(S.player, x, a === b ? 8 : -12); });
    S.world.tension = clamp(S.world.tension + 10, 0, 100);
  }
}

// ---------------- ambitions ----------------
const AMBITIONS = {
  stabilise: { n: 'Pull the country back', d: 'Get stability to 60 and approval to 55, and hold it for six months.' },
  greatpower: { n: 'Become a great power', d: 'Grow your share of the world economy. The target depends on your starting size: 40% for a small economy, 30% for a mid-sized one, 15% for a giant.' },
  peace: { n: 'A peaceful term', d: 'Declare no wars, and spend no more than six months at war in total.' },
  prosperity: { n: 'Make people richer', d: 'Raise income per person by 40% with healthy approval and no big debt rise.' },
  liberty: { n: 'Leave a freer, cleaner state', d: 'Raise civil liberties by 10 points and cut corruption by 8.' },
  empire: { n: 'Build an empire', d: 'Hold two conquered territories that are properly integrated.' },
  alliances: { n: 'Build a web of alliances', d: 'Add three defence partners to the ones you start with.' },
  handover: { n: 'A clean handover', d: 'Leave office by choice or on schedule with the country stable and approving.' },
};
function initAmbition(id) {
  const p = me(); const w = aliveList().reduce((s, i) => s + C(i).gdp, 0);
  if (!id || !AMBITIONS[id]) { S.ambition = null; return; }
  S.ambition = { id, done: null, base: { gp: (p.gdp / w) < 0.02 ? 0.4 : (p.gdp / w) < 0.08 ? 0.3 : 0.15, allies: defenceAllies(S.player).length, hold: 0, share: p.gdp / w, gdppc: p.gdp / p.pop, free: p.free, corr: p.corr, debt: p.debtAbs / p.gdp * 100 } };
  // a goal that is already met on day one is no goal: swap it for the next one that is open
  if (ambitionMetAtStart()) { const alt = ['prosperity', 'alliances', 'liberty', 'greatpower'].find(k => k !== id); if (alt) { S.ambition.id = alt; S.ambition.swapped = id; } }
}
function ambitionMetAtStart() { const st = ambitionState(); return !!(st && st.ok); }
function ambitionState() {
  const a = S.ambition; if (!a) return null; const p = me();
  const def = AMBITIONS[a.id]; let prog = 0, ok = false, text = '';
  const wg = aliveList().reduce((s, i) => s + C(i).gdp, 0), b = a.base;
  if (a.id === 'stabilise') { const met = p.stab >= 60 && p.appr >= 55; prog = (Math.min(1, p.stab / 60) + Math.min(1, p.appr / 55)) / 2 * (met ? 0.85 + 0.15 * Math.min(1, (a.hold || 0) / 6) : 1); ok = met && (a.hold || 0) >= 6; text = 'Stability ' + Math.round(p.stab) + ' of 60, approval ' + Math.round(p.appr) + '% of 55%' + (met ? ', held ' + (a.hold || 0) + ' of 6 months.' : '.'); }
  else if (a.id === 'greatpower') { const r = (p.gdp / wg) / b.share - 1; const gp = b.gp || 0.4; prog = clamp(r / gp, 0, 1); ok = r >= gp; text = 'Your share of world output is ' + (r >= 0 ? '+' : '') + Math.round(r * 100) + '% against a ' + Math.round(gp * 100) + '% goal.'; }
  else if (a.id === 'peace') { const d = S.stat.declared || 0, wm = b.warMo || 0, lost = d || wm > 6; prog = lost ? 0 : clamp(S.turn / 48, 0, 1); ok = !lost && S.turn >= 24; text = d ? 'You have declared ' + d + (d === 1 ? ' war' : ' wars') + '. The ambition is lost.' : wm > 6 ? 'You have spent ' + wm + ' months at war. The ambition is lost.' : 'No wars declared, ' + wm + ' of 6 months at war so far, ' + S.turn + ' months in.'; }
  else if (a.id === 'prosperity') { const r = (p.gdp / p.pop) / b.gdppc - 1, debtOk = p.debtAbs / p.gdp * 100 <= b.debt + 10; prog = clamp(r / 0.4, 0, 1) * (p.appr >= 50 && debtOk ? 1 : 0.7); ok = r >= 0.4 && p.appr >= 50 && debtOk; text = 'Income per person ' + (r >= 0 ? '+' : '') + Math.round(r * 100) + '% against a 40% goal' + (debtOk ? '' : ', but debt has grown too far') + '.'; }
  else if (a.id === 'liberty') { const f = p.free - b.free, c = b.corr - p.corr; prog = (clamp(f / 10, 0, 1) + clamp(c / 8, 0, 1)) / 2; ok = f >= 10 && c >= 8; text = 'Liberties ' + (f >= 0 ? '+' : '') + Math.round(f) + ' of 10, corruption ' + (c >= 0 ? '-' : '+') + Math.abs(Math.round(c)) + ' of -8.'; }
  else if (a.id === 'empire') { const n = terrOf(S.player).filter(t => t.integ >= 60).length; prog = clamp(n / 2, 0, 1); ok = n >= 2; text = n + ' of 2 territories integrated.'; }
  else if (a.id === 'alliances') { const n = defenceAllies(S.player).length - b.allies; prog = clamp(n / 3, 0, 1); ok = n >= 3; text = Math.max(0, n) + ' of 3 new defence partners.'; }
  else if (a.id === 'handover') { const ready = p.stab >= 50 && p.appr >= 50; prog = ready ? 0.5 : 0; ok = false; text = 'Judged only when you leave office, by choice or on schedule, with stability and approval both at 50 or more. Now: stability ' + Math.round(p.stab) + ', approval ' + Math.round(p.appr) + '%. ' + (ready ? 'You could step down now.' : 'Not yet ready to hand over.'); }
  return { id: a.id, name: def.n, desc: def.d, prog, ok, text, done: a.done };
}
function ambitionStep() {
  const a = S.ambition; if (!a || a.done != null) return;
  if (a.id === 'peace') {
    if (atWar(S.player)) a.base.warMo = (a.base.warMo || 0) + 1;
    if (!a.lostSaid && ((S.stat.declared || 0) || a.base.warMo > 6)) { a.lostSaid = 1; const t = (S.stat.declared || 0) ? 'declaring a war' : 'spending more than six months at war'; news('Your ambition of a peaceful term is lost after ' + t + '.', 'you', S.player); logPlayer('Ambition lost: a peaceful term (' + t + ').'); }
    return;
  }
  if (a.id === 'handover') {
    const p = me();
    if (S.turn >= 24 && p.stab >= 50 && p.appr >= 50 && S.turn - (a.offered || -99) >= 24 && S.events.length < 2 && chance(0.06)) { a.offered = S.turn; queueEvent('retireOffer', {}); }
    return;
  }
  if (a.id === 'stabilise') { const p = me(); a.base.hold = (p.stab >= 60 && p.appr >= 55) ? (a.base.hold || 0) + 1 : 0; a.hold = a.base.hold; }
  const st = ambitionState(); if (st && st.ok) { a.done = S.turn; news('You have achieved your ambition: ' + st.name + '.', 'you', S.player); logPlayer('Ambition achieved: ' + st.name + '.'); queueEvent('ambitionDone', { name: st.name }); }
}
function ambitionLegacy() {
  const a = S.ambition; if (!a) return null; const st = ambitionState(); const o = S.over || {};
  let pts, note;
  if (a.id === 'handover') { const graceful = o.type === 'term' || o.type === 'retire'; const good = graceful && me().stab >= 50 && me().appr >= 50; pts = good ? 40 : graceful ? 12 : 0; note = good ? 'achieved' : graceful ? 'partly' : 'missed'; }
  else if (a.id === 'peace') { const d = S.stat.declared || 0, wm = (a.base.warMo || 0); const lost = d || wm > 6; pts = !lost && S.turn >= 24 ? 40 : 0; note = lost ? 'missed' : pts ? 'achieved' : 'partly'; }
  else if (st.ok) { pts = 40; note = 'achieved'; }
  else if (a.done != null) { pts = 18; note = 'won, then lost'; }
  else { pts = Math.round(st.prog * 15); note = 'partly'; }
  return { label: 'Ambition: ' + AMBITIONS[a.id].n + ' (' + note + ')', pts };
}

ev('ambitionDone', { cat: 'story',
  title: () => 'Ambition achieved', text: x => 'You set out to ' + x.name.toLowerCase() + ', and you have done it. Commentators are already talking about your legacy.',
  options: () => [opt('Savour it', 'A boost to standing.', () => { ap(me(), 3, 6); me().prest = clamp(me().prest + 2, 0, 100); return 'It is a good day. The country is still yours to lead.'; })] });

ev('retireOffer', { cat: 'story',
  title: () => 'The moment to leave', text: () => 'The country is stable and you are still popular. Advisers and friends say this is as good a time to hand over as you will get. Staying on risks the mood turning.',
  options: () => [
    opt('Step down now', 'Ends the game. Counts as a clean handover.', () => { retire(); return 'You announce that you are stepping down.'; }),
    opt('Stay on', 'Keep governing. You may be asked again.', () => 'You thank them and say there is more to do.'),
  ] });

Object.assign(Engine, { SCENARIOS: () => SCENARIOS, AMBITIONS: () => AMBITIONS, ambitionState });
