// ===================== DIPLOMACY =====================
function hasCB(a, t) {
  const rv = rivalryOf(a, t);
  if ((rv >= 2 && R(a, t) < -30)) return 'Long-standing dispute';
  const e = S.cb[pkey(a, t)]; if (e && e > S.turn) return 'Provocation or refused ultimatum';
  if (sanctioned(t, a) && R(a, t) < -40) return 'Hostile sanctions';
  return null;
}
function ripple(t, amount, kind) {
  const p = S.player;
  defenceAllies(t).forEach(x => { if (x !== p) addR(p, x, -amount * 0.4); });
  S.rivals.forEach(r => { const o = r.a === t ? r.b : r.b === t ? r.a : null; if (o && o !== p && alive(o)) addR(p, o, amount * 0.25); });
}
const pcCost = base => Math.max(1, Math.round(base * GOV[me().gov].fric * 10) / 10);
function relWord(v) { return v >= 70 ? 'Allied' : v >= 40 ? 'Friendly' : v >= 12 ? 'Warm' : v > -12 ? 'Neutral' : v > -40 ? 'Cold' : v > -70 ? 'Hostile' : 'Enemy'; }
const enemyWarWith = (a, t) => warBetween(a, t);
function playerBelligerentIn(w) { return w.a.includes(S.player) || w.b.includes(S.player); }
function warSideOf(w, iso) { return w.a.includes(iso) ? 'a' : w.b.includes(iso) ? 'b' : null; }
function aidCost() { return clamp(me().gdp * 0.003, 0.05, 30); }
function supportCostPct(c) { return (c.flags.supporting || []).length * 0.12; }

// ---------- parliamentary approval (democracies only) ----------
const needsVote = () => me().gov === 'D';
function voteOdds(kind, t, goal) {
  const c = me();
  let p = 0.56 + (c.fac.party - 50) / 80 + (c.appr - 45) / 130 - c.warWeary / 250;
  if (kind === 'declare') {
    p += hasCB(S.player, t) ? 0.18 : -0.22;
    if (goal === 'conquest') p -= 0.12; else if (goal === 'regime') p -= 0.05;
    if (C(t).nukes && !c.nukes) p -= 0.1;
    if (defenceAllies(S.player).some(x => R(x, t) < -20)) p += 0.05;
  } else if (kind === 'join') {
    p += 0.05; if (sharedBloc(S.player, t, ['defence', 'union']) || hasPact(S.player, t)) p += 0.15; if (R(S.player, t) > 50) p += 0.08;
  } else if (kind === 'defend') p += 0.3;
  return clamp(p, 0.08, 0.95);
}
// returns null when the vote passes (or none is needed), otherwise the text of the defeat
function parliamentVote(kind, t, goal, refund) {
  if (!needsVote()) return null;
  const c = me();
  if (chance(voteOdds(kind, t, goal))) return null;
  c.fac.party = clamp(c.fac.party - 2, 0, 100); addMod(c, 'appr', -1, 4);
  if (refund) S.pc = Math.min(S.pcMax, S.pc + refund * 0.75);
  return 'Parliament debated the motion and voted it down. In a democracy you cannot commit the country to war without its backing. Your party is unhappy with the whip count.';
}
function annexReason(win, lose) {
  const L = C(lose), Wn = C(win);
  if (!L || !L.alive) return 'They no longer exist.';
  if (L.nukes) return 'Nuclear-armed states cannot be conquered.';
  if (L.gdp > 1800) return 'Their economy is too large to swallow.';
  if (L.pop > Wn.pop * 1.3) return 'Their population is too large for you to absorb.';
  return null;
}

const DIPS = [
  { id: 'visit', cat: 'friendly', label: 'Send a delegation', pc: 1, desc: 'Routine diplomacy. A small, reliable boost to relations.',
    avail: t => enemyWarWith(S.player, t) ? 'You are at war with them.' : null,
    run: t => { const d = R(S.player, t) < 0 ? 8 : 5; addR(S.player, t, d); return 'Your delegation was received politely. Relations with ' + nm(t) + ' improve (+' + d + ').'; } },
  { id: 'summit', cat: 'friendly', label: 'Host a state visit', pc: 2, cost: t => me().gdp * 0.0004, desc: 'A high-profile summit. Bigger boost and a prestige lift.',
    avail: t => enemyWarWith(S.player, t) ? 'You are at war with them.' : R(S.player, t) < -35 ? 'Relations are too poor for a summit.' : null,
    run: t => { addR(S.player, t, 13); me().prest = clamp(me().prest + 0.6, 0, 100); return 'The summit with ' + nm(t) + ' was a public success. Relations +13, prestige up.'; } },
  { id: 'trade', cat: 'economic', label: 'Negotiate trade agreement', pc: 2, desc: 'Boosts growth for both sides, more so for the smaller economy.',
    avail: t => hasDeal(S.player, t) ? 'You already have a trade deal.' : enemyWarWith(S.player, t) ? 'At war.' : sanctioned(S.player, t) || sanctioned(t, S.player) ? 'Sanctions are in place.' : R(S.player, t) < 0 ? 'Relations must be at least neutral.' : null,
    chance: t => clamp(0.3 + R(S.player, t) / 110 + (C(t).camp === me().camp && me().camp ? 0.08 : 0) - rivalryOf(S.player, t) * 0.25, 0.05, 0.92),
    run: t => { if (chance(DIPS_BY.trade.chance(t))) { S.deals.push([S.player, t]); addR(S.player, t, 8); me().fac.business = clamp(me().fac.business + 3, 0, 100); return nm(t) + ' signs a trade agreement with you. Growth prospects improve for both economies.'; } addR(S.player, t, -2); return 'Talks with ' + nm(t) + ' stalled over terms. No deal this time.'; } },
  { id: 'aid', cat: 'economic', label: 'Send foreign aid', pc: 1, cost: () => aidCost(), desc: 'Buys goodwill. Poorer nations respond most.',
    avail: t => enemyWarWith(S.player, t) ? 'At war.' : me().treasury < aidCost() ? 'Treasury too low.' : null,
    run: t => { const c = C(t); const boost = c.tier <= 1 ? 16 : c.tier === 2 ? 11 : 6; addR(S.player, t, boost); c.stab = clamp(c.stab + 2, 0, 99); me().prest = clamp(me().prest + 0.4, 0, 100); return nm(t) + ' is grateful for your aid. Relations +' + boost + '.'; } },
  { id: 'sanction', cat: 'coercive', label: 'Impose sanctions', pc: 2, desc: 'Squeezes their growth. Sours relations. Some allies may follow.',
    avail: t => sanctioned(S.player, t) ? 'Already sanctioned.' : null,
    run: t => {
      S.sanctions.push({ by: S.player, on: t, turn: S.turn }); addR(S.player, t, -15); ripple(t, 12, 'sanction');
      let joined = 0;
      defenceAllies(S.player).forEach(a => { if (a !== t && R(a, t) < 10 && chance(0.4) && !sanctioned(a, t)) { S.sanctions.push({ by: a, on: t, turn: S.turn }); joined++; } });
      me().fac.business = clamp(me().fac.business - 1, 0, 100); S.dirtyBase = true;
      return 'Sanctions imposed on ' + nm(t) + (joined ? ', and ' + joined + ' allies joined you.' : '.') + ' Expect a colder relationship.';
    } },
  { id: 'unsanction', cat: 'coercive', label: 'Lift sanctions', pc: 1, desc: 'Removes your sanctions and eases tension.',
    avail: t => sanctioned(S.player, t) ? null : 'You have not sanctioned them.',
    run: t => { S.sanctions = S.sanctions.filter(s => !(s.by === S.player && s.on === t)); addR(S.player, t, 8); S.dirtyBase = true; return 'Sanctions on ' + nm(t) + ' lifted. Relations +8.'; } },
  { id: 'pact', cat: 'security', label: 'Propose defence pact', pc: 3, desc: 'A mutual defence commitment. Each side is expected to join the other\'s defensive wars.',
    avail: t => hasPact(S.player, t) ? 'Already allied.' : enemyWarWith(S.player, t) ? 'At war.' : sharedBloc(S.player, t, ['defence']) ? 'Already covered by a shared alliance.' : R(S.player, t) < 30 ? 'Relations must be at least 30.' : null,
    chance: t => { let p = (R(S.player, t) - 28) / 60 + 0.1; const en = enemiesOf(S.player); if (C(t).camp && C(t).camp === me().camp) p += 0.12; if (rivalryOf(S.player, t)) p -= 0.5; if (defenceAllies(t).some(x => R(S.player, x) < -40)) p -= 0.25; return clamp(p, 0.03, 0.9); },
    run: t => { if (chance(DIPS_BY.pact.chance(t))) { S.pacts.push([S.player, t]); addR(S.player, t, 12); S.dirtyBase = true; news(nm(S.player) + ' and ' + nm(t) + ' sign a mutual defence pact.', 'diplomacy', S.player); return nm(t) + ' has signed a mutual defence pact with you.'; } addR(S.player, t, -3); return nm(t) + ' politely declined. They are not ready to commit.'; } },
  { id: 'breakpact', cat: 'security', label: 'Withdraw from defence pact', pc: 1, desc: 'Ends the pact. Damages trust.',
    avail: t => hasPact(S.player, t) ? null : 'No bilateral pact.',
    run: t => { S.pacts = S.pacts.filter(p => !((p[0] === S.player && p[1] === t) || (p[1] === S.player && p[0] === t))); addR(S.player, t, -22); me().prest = clamp(me().prest - 3, 0, 100); S.dirtyBase = true; return 'You withdrew from the pact with ' + nm(t) + '. They are furious.'; } },
  { id: 'exercise', cat: 'security', label: 'Joint military exercise', pc: 1, cost: t => me().gdp * 0.0003, desc: 'With friends: builds readiness. Near a rival: a show of force.',
    avail: t => enemyWarWith(S.player, t) ? 'At war.' : null,
    run: t => { const rel = R(S.player, t); me().flags.readyBoost = 8; if (rel > 5) { addR(S.player, t, 5); return 'Exercises with ' + nm(t) + ' went well. Readiness improves and ties strengthen.'; } addR(S.player, t, -9); S.world.tension = clamp(S.world.tension + 1.5, 0, 100); me().fac.military = clamp(me().fac.military + 3, 0, 100); return 'Your forces conducted drills near ' + nm(t) + '. Your generals approve. Their government protested, and tension rises.'; } },
  { id: 'spy', cat: 'coercive', label: 'Intelligence operation', pc: 2, cost: t => me().gdp * 0.0002, desc: 'Learn their intentions. Risk of exposure.',
    avail: t => null, chance: t => clamp(0.62 - C(t).tech * 0.03 + me().tech * 0.03, 0.3, 0.85),
    run: t => { if (chance(DIPS_BY.spy.chance(t))) { S.intel[t] = S.turn; return intelText(t); } addR(S.player, t, -18); me().prest = clamp(me().prest - 1.5, 0, 100); return 'Your agents were caught in ' + nm(t) + '. A diplomatic row erupts. Relations -18.'; } },
  { id: 'ultimatum', cat: 'coercive', label: 'Issue ultimatum', pc: 3, desc: 'Demand concessions backed by threat. Weaker or isolated states may fold. Refusal gives you grounds for war.',
    avail: t => enemyWarWith(S.player, t) ? 'At war.' : !canReach(S.player, t) ? 'Out of reach.' : sharedBloc(S.player, t, ['defence']) || hasPact(S.player, t) ? 'They are your ally.' : null,
    chance: t => { const r = Math.log((power(me()) + 0.1) / (power(C(t)) * 1.1 + defenceAllies(t).reduce((s, x) => s + power(C(x)) * 0.4, 0) + 0.1)); let p = 0.3 + r * 0.22 - C(t).aggr * 0.3; if (C(t).nukes && !me().nukes) p -= 0.3; if (defenceAllies(t).length > 3) p -= 0.1; return clamp(p, 0.03, 0.88); },
    run: t => {
      const c = C(t);
      if (chance(DIPS_BY.ultimatum.chance(t))) {
        c.prest = clamp(c.prest - 6, 0, 100); c.stab = clamp(c.stab - 4, 0, 99); c.appr = clamp(c.appr - 6, 0, 100);
        me().prest = clamp(me().prest + 2, 0, 100); addR(S.player, t, -15); (NB[t] || []).forEach(n => { if (n !== S.player && alive(n)) addR(S.player, n, -3); }); S.world.tension = clamp(S.world.tension + 1, 0, 100); me().treasury += Math.min(c.gdp * 0.01, me().gdp * 0.01);
        const rv = S.rivals.find(r => (r.a === S.player && r.b === t) || (r.b === S.player && r.a === t)); if (rv && chance(0.4)) { rv.n = Math.max(0, rv.n - 1); if (!rv.n) S.rivals = S.rivals.filter(x => x !== rv); }
        S.dirtyBase = true; me().appr = clamp(me().appr + 2, 0, 100);
        return nm(t) + ' backed down and accepted your terms. You gained tribute and a little prestige. Their neighbours are uneasy, and they will remember it.';
      }
      addR(S.player, t, -20); S.cb[pkey(S.player, t)] = S.turn + 24; S.world.tension = clamp(S.world.tension + 4, 0, 100);
      return nm(t) + ' rejected your ultimatum. You now have a casus belli for the next two years, but the world watches nervously.';
    } },
  { id: 'declare', cat: 'war', label: 'Declare war', pc: 4, desc: 'Open hostilities. Choose your war aim.', needsGoal: true, vote: true, chanceLabel: 'parliament backs it',
    chance: t => needsVote() ? voteOdds('declare', t) : null,
    avail: t => enemyWarWith(S.player, t) ? 'Already at war.' : hasPact(S.player, t) || sharedBloc(S.player, t, ['defence', 'union']) ? 'They are in your alliance.' : !canReach(S.player, t) ? 'Beyond your military reach.' : me().army < 0.5 ? 'You have no meaningful army.' : null,
    run: (t, goal) => {
      const cb = hasCB(S.player, t); const p = me();
      const vt = parliamentVote('declare', t, goal, 4); if (vt) return vt;
      if (goal === 'conquest' && !canAnnex(S.player, t)) goal = 'humiliate';
      const w = startWar(S.player, t, { goal, cb: !!cb });
      if (!cb) { p.prest = clamp(p.prest - 9, 0, 100); aliveList().forEach(i => { if (i !== S.player && i !== t) addR(S.player, i, isDemo(C(i).gov) ? -7 : -3); }); if (p.gov === 'D') p.appr = clamp(p.appr - 6, 0, 100); }
      p.fac.military = clamp(p.fac.military + 5, 0, 100);
      ripple(t, 20, 'war'); westSanctions(w); aggressionFallout(w, t, cb);
      logPlayer('Declared war on ' + nm(t) + '.');
      return 'You are at war with ' + nm(t) + (cb ? ' (justified: ' + cb + ').' : ' without justification. The world is appalled.') + ' Allies on both sides are choosing sides.';
    } },
  { id: 'ceasefire', cat: 'war', label: 'Propose ceasefire', pc: 1, desc: 'Ask the enemy leader to stop fighting.',
    avail: t => { const w = enemyWarWith(S.player, t); if (!w) return 'You are not at war with them.'; if (w.lead.a !== t && w.lead.b !== t) return 'They are not the enemy leader.'; return null; },
    chance: t => { const w = enemyWarWith(S.player, t); if (!w) return 0; const ts = w.a.includes(t) ? w.score : -w.score; const side = w.a.includes(t) ? 'a' : 'b'; return clamp(0.2 + Math.max(0, -ts) / 100 * 0.7 + w.exh[side] / 60 * 0.3 - Math.max(0, ts) / 100 * 0.25 - (w.goal === 'conquest' && side === 'b' ? 0 : 0.05), 0.03, 0.9); },
    run: t => { const w = enemyWarWith(S.player, t); if (chance(DIPS_BY.ceasefire.chance(t))) { finishWar(w, null); return 'Ceasefire agreed with ' + nm(t) + '. The guns fall silent.'; } return nm(t) + ' refused to stop fighting. They believe time is on their side.'; } },
  { id: 'terms', cat: 'war', label: 'Press for peace terms', pc: 2, desc: 'You are clearly winning. Force the enemy to the table and dictate the settlement. Works even against a nuclear power, which cannot be beaten outright.',
    avail: t => { const w = enemyWarWith(S.player, t); if (!w) return 'You are not at war with them.'; if (w.lead.a !== t && w.lead.b !== t) return 'They are not the enemy leader.'; const side = warSideOf(w, S.player); if (w.lead[side] !== S.player) return 'Only the leader of your side can negotiate.'; if (w.pending || S.events.some(e => e.id === 'victoryTerms')) return 'Terms are already being decided.'; const sc = side === 'a' ? w.score : -w.score; return sc >= 35 ? null : 'You need a clear lead in the war (35 or more) to dictate terms.'; },
    chance: t => { const w = enemyWarWith(S.player, t); if (!w) return 0; const side = warSideOf(w, S.player), es = side === 'a' ? 'b' : 'a'; const sc = side === 'a' ? w.score : -w.score; return clamp(0.25 + (sc - 35) * 0.012 + w.exh[es] / 150, 0.1, 0.85); },
    run: t => { const w = enemyWarWith(S.player, t); const side = warSideOf(w, S.player); if (chance(DIPS_BY.terms.chance(t))) { w.pending = true; queueEvent('victoryTerms', { war: w.id, side, total: false, nuker: (w[side === 'a' ? 'b' : 'a'].find(z => C(z).nukes)), limited: !!C(t).nukes || w.score * (side === 'a' ? 1 : -1) < 95 }); return nm(t) + ' agrees to talks. You will set the terms.'; } addR(S.player, t, -5); return nm(t) + ' refuses to talk. Its leaders believe they can still hold on.'; } },
  { id: 'mediate', cat: 'friendly', label: 'Broker peace talks', pc: 3, desc: 'Use your standing to end someone else\'s war.',
    avail: t => { const w = warsOf(t).find(w => !playerBelligerentIn(w)); if (!w) return 'They are not in a war you can mediate.'; if (S.turn - w.start < 4) return 'The war is too young. Neither side will listen yet.'; if (S.turn - (S.mediateAt == null ? -99 : S.mediateAt) < 18) return 'You brokered a peace recently. Give it time.'; return null; },
    chance: t => clamp(0.04 + me().prest / 400 + (R(S.player, t) > 0 ? R(S.player, t) / 500 : 0), 0.04, 0.35),
    run: t => { const w = warsOf(t).find(w => !playerBelligerentIn(w)); if (chance(DIPS_BY.mediate.chance(t))) { finishWar(w, null); S.mediateAt = S.turn; me().prest = clamp(me().prest + 3, 0, 100); addR(S.player, w.lead.a, 5); addR(S.player, w.lead.b, 5); S.stat.ceasefires++; return 'Your mediation produced a ceasefire between ' + nm(w.lead.a) + ' and ' + nm(w.lead.b) + '. Your standing rises.'; } me().prest = clamp(me().prest - 0.5, 0, 100); return 'The talks broke down. Neither side is ready to compromise.'; } },
  { id: 'joinwar', cat: 'war', label: 'Join war on their side', pc: 2, desc: 'Send your forces to fight beside this country.', vote: true, chanceLabel: 'parliament backs it',
    chance: t => needsVote() ? voteOdds('join', t) : null,
    avail: t => { const w = warsOf(t)[0]; if (!w) return 'They are not at war.'; if (playerBelligerentIn(w)) return 'You are already in this war.'; if (me().army < 0.5) return 'No army.'; return null; },
    run: t => { const vt = parliamentVote('join', t, null, 2); if (vt) return vt; const w = warsOf(t).find(w => !playerBelligerentIn(w)); const side = warSideOf(w, t); w[side].push(S.player); (w.sup[side] || []).splice(0, 0); w.sup[side] = w.sup[side].filter(x => x !== S.player); addR(S.player, t, 12); w[side === 'a' ? 'b' : 'a'].forEach(x => addR(S.player, x, -30)); me().fac.military = clamp(me().fac.military + 3, 0, 100); logPlayer('Joined the war on the side of ' + nm(t) + '.'); news(nm(S.player) + ' enters the war on the side of ' + nm(t) + '.', 'war', S.player); return 'You have entered the war beside ' + nm(t) + '.'; } },
  { id: 'support', cat: 'war', label: 'Send military aid', pc: 2, cost: () => me().gdp * 0.002, desc: 'Arms and money for a side, without committing troops. Costs ongoing upkeep.',
    avail: t => { const w = warsOf(t)[0]; if (!w) return 'They are not at war.'; if (playerBelligerentIn(w)) return 'You are in the war already.'; const side = warSideOf(w, t); if ((w.sup[side] || []).includes(S.player)) return 'Already supporting.'; if (me().treasury < me().gdp * 0.002) return 'Treasury too low.'; return null; },
    run: t => { const w = warsOf(t)[0]; const side = warSideOf(w, t); w.sup[side].push(S.player); const c = me(); c.flags.supporting = (c.flags.supporting || []).concat([t]); addR(S.player, t, 14); w[side === 'a' ? 'b' : 'a'].forEach(x => addR(S.player, x, -22)); S.world.tension = clamp(S.world.tension + 1.5, 0, 100); news(nm(S.player) + ' begins sending military aid to ' + nm(t) + '.', 'war', S.player); return 'Shipments of arms and funds are on their way to ' + nm(t) + '. Upkeep costs about 0.12% of GDP per year.'; } },
  { id: 'stopsupport', cat: 'war', label: 'End military aid', pc: 0, desc: 'Withdraw your support.',
    avail: t => (me().flags.supporting || []).includes(t) ? null : 'Not supporting them.',
    run: t => { const c = me(); c.flags.supporting = (c.flags.supporting || []).filter(x => x !== t); S.wars.forEach(w => { w.sup.a = w.sup.a.filter(x => x !== S.player); w.sup.b = w.sup.b.filter(x => x !== S.player); }); addR(S.player, t, -12); return 'Aid to ' + nm(t) + ' has ended. They feel abandoned.'; } },
  { id: 'withdraw', cat: 'war', label: 'Withdraw from war', pc: 2, desc: 'Leave a war you joined as a junior partner.',
    avail: t => { const w = enemyWarWith(S.player, t); if (!w) return 'You are not at war with them.'; if (w.lead.a === S.player || w.lead.b === S.player) return 'You lead this side. Propose a ceasefire instead.'; return null; },
    run: t => { const w = enemyWarWith(S.player, t); const side = warSideOf(w, S.player); const L = w.lead[side]; w[side] = w[side].filter(x => x !== S.player); addR(S.player, L, -22); me().prest = clamp(me().prest - 5, 0, 100); return 'You withdrew from the war. ' + nm(L) + ' feels betrayed.'; } },
];
const DIPS_BY = {}; DIPS.forEach(d => DIPS_BY[d.id] = d);

function westSanctions(w) {
  const agg = w.lead[w.aggressor], def = w.lead[w.aggressor === 'a' ? 'b' : 'a'];
  const ca = C(agg), cd = C(def);
  if (agg === S.player) return;
  aliveList().forEach(i => {
    if (i === S.player || i === agg || C(i).army < 1) return;
    const bias = (R(i, def) - R(i, agg)) / 100;
    if (bias > 0.3 && C(i).gdp > 100 && chance(0.5 * bias) && !sanctioned(i, agg)) S.sanctions.push({ by: i, on: agg, turn: S.turn });
  });
}
function intelText(t) {
  const c = C(t); const lines = [];
  const enemies = S.rivals.filter(r => r.a === t || r.b === t).map(r => nm(r.a === t ? r.b : r.a));
  const risk = c.aggr * (1 + (S.world.tension - 30) / 100);
  lines.push('Intelligence on ' + c.name + ': army strength ' + Math.round(power(c)) + ', readiness ' + Math.round(c.readiness) + '%, stability ' + Math.round(c.stab) + '.');
  if (c.nukes) lines.push('They hold ' + (c.nukes > 1 ? 'a major' : 'a limited') + ' nuclear arsenal.');
  if (enemies.length) lines.push('Analysts see rivalry with ' + enemies.slice(0, 3).join(', ') + '.');
  lines.push(risk > 0.5 ? 'Assessment: aggressive posture, elevated risk of military action.' : risk > 0.25 ? 'Assessment: opportunistic, will probe for weakness.' : 'Assessment: defensive and unlikely to start a war.');
  if (c.stab < 30) lines.push('Their government looks fragile. A coup or uprising is possible.');
  return lines.join(' ');
}
function dipList(t) {
  return DIPS.map(d => {
    const why = d.avail(t);
    const cost = d.cost ? d.cost(t) : 0;
    let reason = why;
    const need = d.pc ? pcCost(d.pc) : 0;
    if (!reason && S.pc < need) reason = 'Not enough political capital.';
    if (!reason && cost && me().treasury < cost * 0.9) reason = 'Treasury too low.';
    return { id: d.id, cat: d.cat, label: d.label, desc: d.desc + (d.vote && needsVote() ? ' Parliament must approve.' : ''), chanceLabel: d.chanceLabel || null, pc: need, cost, chance: d.chance && !why ? d.chance(t) : null, ok: !reason, why: reason, goal: !!d.needsGoal };
  });
}
function doDip(id, t, extra) {
  const d = DIPS_BY[id]; if (!d) return { ok: false, text: 'Unknown action.' };
  const list = dipList(t).find(x => x.id === id);
  if (!list.ok) return { ok: false, text: list.why };
  const before = snapshot(me());
  S.pc -= list.pc; if (list.cost) me().treasury -= list.cost;
  const text = withSrc(d.label + ' with ' + nm(t), () => d.run(t, extra));
  S.dirtyBase = true; if (id !== 'spy') logPlayer(text);
  S.stat.dip = (S.stat.dip || 0) + 1;
  return { ok: true, text, chips: diffChips(before, snapshot(me())) };
}

// ---------- blocs ----------
function blocEligible(id, iso) {
  const c = C(iso), r = ROW[iso], bl = S.blocs[id];
  if (bl.members.includes(iso)) return 'Already a member.';
  if (id === 'AUKUS') return 'Closed pact. No new members.';
  if (atWar(iso)) return 'Cannot apply while at war.';
  const reg = r.region, sub = r.sub;
  switch (id) {
    case 'NATO': if (!(reg === 'Europe' || sub === 'Northern America' || c.camp === 1)) return 'Must be a European or transatlantic state.'; break;
    case 'EU': if (reg !== 'Europe') return 'Must be a European state.'; if (!isDemo(c.gov)) return 'Requires a democratic government.'; if (c.gov === 'H' && c.corr > 55) return 'Corruption too high.'; break;
    case 'CSTO': if (!(sub === 'Central Asia' || sub === 'Eastern Europe' || sub === 'Western Asia' || iso === 'MNG')) return 'Not in the region.'; if (c.camp === 1) return 'Incompatible with a Western alignment.'; break;
    case 'SCO': if (!(reg === 'Asia' || sub === 'Eastern Europe')) return 'Must be a Eurasian state.'; break;
    case 'BRICS': if (c.gdp < 100) return 'Economy too small.'; break;
    case 'ASEAN': if (sub !== 'South-Eastern Asia') return 'Must be in Southeast Asia.'; break;
    case 'AU': if (reg !== 'Africa') return 'African states only.'; break;
    case 'ARAB': if (!(sub === 'Western Asia' || sub === 'Northern Africa')) return 'Arab states only.'; break;
    case 'GCC': if (sub !== 'Western Asia') return 'Must be in the Gulf region.'; break;
    case 'MERCOSUR': if (sub !== 'South America') return 'Must be South American.'; break;
  }
  return null;
}
function blocOdds(id, iso) {
  const bl = S.blocs[id]; let sw = 0, s = 0; let veto = null;
  bl.members.forEach(m => { if (!alive(m)) return; const wgt = 1 + Math.log10(1 + C(m).gdp) * 0.7; sw += wgt; s += wgt * R(iso, m); if (bl.type !== 'political' && R(iso, m) < -40 && C(m).gdp > 50) veto = veto || m; });
  const avg = sw ? s / sw : 0;
  let p = clamp(0.25 + (avg - 5) / 60, 0.05, 0.95);
  if (veto) p = Math.min(p, 0.08);
  return { p, avg, veto };
}
function applyToBloc(id) {
  const why = blocEligible(id, S.player); if (why) return { ok: false, text: why };
  if (S.apps.length) return { ok: false, text: 'You already have an application pending.' };
  const need = pcCost(3); if (S.pc < need) return { ok: false, text: 'Not enough political capital.' };
  S.pc -= need;
  S.apps.push({ bloc: id, due: S.turn + 3 + Math.floor(rnd() * 4) });
  const t = 'Your application to join ' + S.blocs[id].name + ' has been lodged. A decision is expected in a few months.';
  logPlayer(t); return { ok: true, text: t };
}
function resolveApp(a) {
  const bl = S.blocs[a.bloc]; const o = blocOdds(a.bloc, S.player);
  const ok = chance(o.p);
  S.apps = S.apps.filter(x => x !== a);
  if (ok) {
    bl.members.push(S.player); S.dirtyBase = true; me().prest = clamp(me().prest + 4, 0, 100); news(nm(S.player) + ' joins ' + bl.name + '.', 'diplomacy', S.player);
    bl.members.forEach(m => { if (m !== S.player) addR(S.player, m, 8); });
    if (bl.type === 'union') addMod(me(), 'growth', 0.3, 24);
    queueEvent('blocResult', { bloc: a.bloc, ok: true });
  } else {
    queueEvent('blocResult', { bloc: a.bloc, ok: false, veto: o.veto });
  }
}
function leaveBloc(id) {
  const bl = S.blocs[id]; if (!bl.members.includes(S.player)) return { ok: false, text: 'You are not a member.' };
  const need = pcCost(3); if (S.pc < need) return { ok: false, text: 'Not enough political capital.' };
  S.pc -= need;
  bl.members = bl.members.filter(x => x !== S.player); S.dirtyBase = true;
  bl.members.forEach(m => addR(S.player, m, bl.type === 'defence' ? -12 : -7));
  me().prest = clamp(me().prest - 4, 0, 100);
  if (bl.type === 'union') addMod(me(), 'growth', -0.6, 30);
  if (bl.type === 'defence') me().fac.military = clamp(me().fac.military - 3, 0, 100);
  news(nm(S.player) + ' leaves ' + bl.name + '.', 'diplomacy', S.player);
  const t = 'You left ' + bl.name + '. Former partners are alarmed.'; logPlayer(t); return { ok: true, text: t };
}

// ---------- AI diplomacy and world colour ----------
function aiDiplomacy() {
  const list = aliveList();
  // new defence pacts
  if (chance(0.06)) {
    const a = pick(list), b = pick(list);
    if (a !== b && a !== S.player && b !== S.player && !hasPact(a, b) && R(a, b) > 62 && C(a).army > 1 && C(b).army > 1 && !sharedBloc(a, b, ['defence']) && S.pacts.length < 45) {
      S.pacts.push([a, b]); S.dirtyBase = true; news(nm(a) + ' and ' + nm(b) + ' sign a mutual defence pact.', 'diplomacy', a);
    }
  }
  // rivalry thaw or hardening
  S.rivals.slice().forEach(r => {
    if (!alive(r.a) || !alive(r.b) || r.a === S.player || r.b === S.player) return;
    const rel = R(r.a, r.b);
    if (rel > 0 && chance(0.008)) { r.n--; news('Relations thaw between ' + nm(r.a) + ' and ' + nm(r.b) + '.', 'diplomacy', r.a); S.dirtyBase = true; if (r.n <= 0) S.rivals = S.rivals.filter(x => x !== r); }
    else if (rel < -60 && r.n < 3 && chance(0.004)) { r.n++; news('Tensions harden between ' + nm(r.a) + ' and ' + nm(r.b) + '.', 'diplomacy', r.a); S.dirtyBase = true; }
  });
  // new rivalries among hostile neighbours
  if (chance(0.03)) {
    const a = pick(list); const nb = (NB[a] || []).filter(alive);
    if (nb.length) { const b = pick(nb); if (a !== S.player && b !== S.player && R(a, b) < -35 && !rivalryOf(a, b)) { S.rivals.push({ a, b, n: 1, why: 'Border tensions' }); S.dirtyBase = true; news('A new dispute emerges between ' + nm(a) + ' and ' + nm(b) + '.', 'diplomacy', a); } }
  }
  // world colour headlines
  const heads = 2;
  for (let k = 0; k < heads; k++) {
    if (!chance(0.5)) continue;
    const r = pick(S.rivals.filter(x => alive(x.a) && alive(x.b) && !warBetween(x.a, x.b)));
    if (r && chance(0.6)) {
      const hostile = R(r.a, r.b) < -45;
      const pool = hostile ? [
        [nm(r.a) + ' conducts naval drills near ' + nm(r.b) + '.', 1.2],
        [nm(r.b) + ' accuses ' + nm(r.a) + ' of border violations.', 1],
        [nm(r.a) + ' and ' + nm(r.b) + ' expel diplomats in a tit-for-tat row.', 0.5],
        [nm(r.a) + ' test-fires missiles as tensions with ' + nm(r.b) + ' climb.', 1.5]] : [
        [nm(r.a) + ' and ' + nm(r.b) + ' hold quiet talks to reduce tensions.', 0],
        [nm(r.b) + ' summons the ambassador of ' + nm(r.a) + '.', 0.3]];
      const [txt, dt] = pick(pool);
      news(txt, 'tension', r.a); S.world.tension = clamp(S.world.tension + dt * 0.3, 0, 100); addR(r.a, r.b, -dt);
    } else {
      const a = pick(list), b = pick(list);
      if (a !== b && a !== S.player && b !== S.player && C(a).gdp > 50 && C(b).gdp > 50 && R(a, b) > 30) { news(nm(a) + ' and ' + nm(b) + ' announce a new trade partnership.', 'diplomacy', a); addR(a, b, 3); if (!hasDeal(a, b) && S.deals.length < 60) S.deals.push([a, b]); }
    }
  }
}
