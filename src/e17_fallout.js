// ===================== COST AND FALLOUT OF WAR AND CONQUEST =====================
// The rally is a mood that fades, wars cost money, and the world reacts to aggression:
// sanctions from a coalition, allies cooling, blocs suspending you, trade partners walking away.

// running costs of being a belligerent, as % of GDP a year
function warCostPct(c) {
  let s = 0;
  warsOf(c.iso).forEach(w => { s += 0.5 + 0.7 * ((w.intensity || 1) - 1); });
  return s > 0 ? s + 0.4 * c.mob : 0;
}

// sanctions that lapse: coalition sanctions on the player carry an end date
// military aid to a country ends when its war does
function supportCleanup() {
  aliveList().forEach(i => {
    const c = C(i), sp = c.flags.supporting; if (!sp || !sp.length) return;
    const keep = sp.filter(t => alive(t) && atWar(t));
    if (keep.length !== sp.length) {
      const gone = sp.filter(t => !keep.includes(t)); c.flags.supporting = keep;
      if (i === S.player) logPlayer('Military aid to ' + gone.map(nm).join(' and ') + ' has ended with the fighting.');
    }
  });
}
function sanctionsExpire() {
  const gone = S.sanctions.filter(s => s.until && s.until <= S.turn);
  if (!gone.length) return;
  S.sanctions = S.sanctions.filter(s => !s.until || s.until > S.turn); S.dirtyBase = true;
  const mine = gone.filter(s => s.on === S.player);
  if (mine.length) news('Sanctions on ' + nm(S.player) + ' imposed by ' + mine.length + (mine.length === 1 ? ' country have' : ' countries have') + ' lapsed.', 'diplomacy', S.player);
}
// the countries around a place: neighbours, and their neighbours
function neighbourhood(iso) { const s = new Set(NB[iso] || []); (NB[iso] || []).forEach(n => (NB[n] || []).forEach(m => s.add(m))); s.delete(iso); return s; }
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// an existing sanctioner is pushed harder rather than ignored
function coalitionSanction(i, until, w) {
  const ex = S.sanctions.find(s => s.by === i && s.on === S.player);
  if (ex) { if (ex.until) { ex.until = Math.max(ex.until, until); ex.w = Math.min(1.6, (ex.w || 1) + 0.3 * w); } return false; }
  S.sanctions.push({ by: i, on: S.player, turn: S.turn, until, w }); return true;
}
// a pact partner who is sanctioning you does not stay a pact partner
function dropPacts(list) { const out = []; list.forEach(a => { if (hasPact(S.player, a)) { S.pacts = S.pacts.filter(q => !((q[0] === S.player && q[1] === a) || (q[1] === S.player && q[0] === a))); out.push(a); } }); return out; }

// the player declares war on t
function aggressionFallout(w, t, cb) {
  const p = me(), out = { sanc: [], deals: 0 };
  // rally: a mood, not a gain. It is gone in four months and war weariness takes over
  if (cb) addMod(p, 'appr', 5, 4); else if (!isDemo(p.gov)) addMod(p, 'appr', 2, 4);
  // a coalition of countries that side with the victim
  aliveList().forEach(i => {
    if (i === S.player || i === t || C(i).gdp < 100 || C(i).army < 1) return;
    if (w.a.includes(i) || w.b.includes(i)) return;
    const bias = (R(i, t) - R(i, S.player)) / 100;
    const p_ = bias * (cb ? 0.35 : 0.9) * (isDemo(C(i).gov) ? 1 : 0.5);
    if (bias > 0.2 && chance(clamp(p_, 0, 0.7))) { if (coalitionSanction(i, S.turn + (cb ? 18 : 30), cb ? 0.4 : 0.8)) out.sanc.push(i); }
  });
  // trade partners of the victim walk away from your deals with it
  const had = S.deals.filter(d => d.includes(t));
  if (had.length) { S.deals = S.deals.filter(d => !d.includes(t)); addMod(p, 'growth', -0.25 * had.length, 12); out.deals = had.length; }
  // allies dislike adventures
  if (!cb) defenceAllies(S.player).forEach(a => { if (isDemo(C(a).gov)) addR(S.player, a, -5); });
  dropPacts(out.sanc);
  if (out.sanc.length) { news(plural(out.sanc.length, 'country', 'countries') + ', led by ' + nm(out.sanc.slice().sort((a, b) => C(b).gdp - C(a).gdp)[0]) + ', impose sanctions on ' + nm(S.player) + ' over the war on ' + nm(t) + '.', 'diplomacy', S.player); S.dirtyBase = true; }
  return out;
}

// the player has annexed a country, or toppled its government (mode 'regime', a lighter version)
function annexFallout(loser, cb, mode) {
  const p = me(), lo = C(loser), regime = mode === 'regime';
  const sanc = [], cooled = [], pacts = []; let bloc = null;
  const near = neighbourhood(loser);
  aliveList().forEach(i => {
    if (i === S.player) return;
    const ci = C(i);
    addR(i, S.player, ((isDemo(ci.gov) ? -6 : -3) + (near.has(i) ? -6 : 0)) * (regime ? 0.5 : 1) * (cb ? 0.6 : 1));
    if (ci.gdp >= 100 && ci.army >= 1 && isDemo(ci.gov) && R(i, S.player) < 15 && chance((regime ? 0.3 : 0.6) * (cb ? 0.5 : 1))) { if (coalitionSanction(i, S.turn + (regime ? 18 : 36), cb ? 0.5 : 1)) sanc.push(i); }
  });
  defenceAllies(S.player).forEach(a => { if (alive(a) && isDemo(C(a).gov)) { addR(S.player, a, regime ? -5 : -10); cooled.push(a); } });
  dropPacts(sanc.concat(defenceAllies(S.player).filter(a => alive(a) && !regime && R(S.player, a) < 25 && chance(0.3)))).forEach(a => pacts.push(a));
  if (!regime) blocsOf(S.player).forEach(id => {
    const b = S.blocs[id]; if (!b || bloc) return;
    if ((b.type === 'union' || b.type === 'defence') && b.members.some(m => alive(m) && near.has(m)) && chance(cb ? 0.2 : 0.4)) { b.members = b.members.filter(x => x !== S.player); bloc = b.name; addMod(p, 'growth', -0.3, 18); }
  });
  S.world.tension = clamp(S.world.tension + (regime ? 3 : 6), 0, 100);
  p.prest = clamp(p.prest - (regime ? 4 : 6), 0, 100);
  if (sanc.length) S.dirtyBase = true;
  queueEvent('conquestFallout', { loser, regime, sanc: sanc.length, lead: sanc.slice().sort((a, b) => C(b).gdp - C(a).gdp)[0] || null, cooled: cooled.length, pacts: pacts.map(nm), bloc });
}

ev('conquestFallout', { cat: 'system',
  title: x => x.regime ? 'The world reacts to the overthrow of the government in ' + nm(x.loser) : 'The world reacts to the annexation of ' + nm(x.loser),
  text: x => {
    const bits = [];
    if (x.sanc) bits.push(plural(x.sanc, 'country', 'countries') + ', led by ' + nm(x.lead) + ', impose sanctions that will last about ' + (x.regime ? 'a year and a half' : 'three years') + ' and fade as they age');
    if (x.cooled) bits.push(x.cooled === 1 ? 'one of your democratic partners publicly distances itself' : x.cooled + ' of your democratic partners publicly distance themselves');
    if (x.pacts.length) bits.push('a pact with ' + x.pacts.join(' and ') + ' is torn up');
    if (x.bloc) bits.push('members of ' + x.bloc + ' vote to suspend you');
    return (x.regime ? 'A government installed by your army now sits in ' + nm(x.loser) + ' and the capitals of the world have noticed. ' : 'The flag has changed over ' + nm(x.loser) + ' and the capitals of the world have noticed. ') + (bits.length ? bits.join('; ').replace(/^./, m => m.toUpperCase()) + '.' : 'There is no coordinated response, but nobody is pleased.') + ' Neighbours are quietly counting your divisions. The celebration at home will not last.';
  },
  options: x => [
    opt('Defy the critics', 'Rally support at home for a while. Standing abroad takes a further hit.', () => { addMod(me(), 'appr', 3, 4); me().prest = clamp(me().prest - 3, 0, 100); return 'You tell the world it has no say in your affairs. It plays well at home.'; }),
    opt('Reassure your neighbours', 'Costs 1 political capital. Softens the damage to relations with the countries around it.', () => { S.pc = Math.max(0, S.pc - pcCost(1)); const near = neighbourhood(x.loser); aliveList().forEach(i => { if (i !== S.player && near.has(i)) addR(S.player, i, 4); }); return 'Envoys carry promises that this is the last border you intend to move.'; }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
    opt('Say nothing', 'Let it pass.', () => 'You let the statements pile up unanswered.'),
  ] });

// how the two sides stack up
function warForces(wid) {
  const w = S.wars.find(x => x.id === wid); if (!w) return null;
  const side = warSideOf(w, S.player); if (!side) return null; const opp = side === 'a' ? 'b' : 'a';
  const sum = s => w[s].reduce((a, i) => a + (alive(i) ? power(C(i)) : 0), 0) + (w.sup[s] || []).reduce((a, i) => a + (alive(i) ? power(C(i)) * 0.3 : 0), 0);
  const you = sum(side), them = sum(opp), ratio = you / Math.max(0.01, them);
  const cost = warCostPct(me());
  return { you, them, ratio: Math.min(ratio, 20), capped: ratio > 20, verdict: ratio >= 2 ? 'You are much stronger on paper.' : ratio >= 1.2 ? 'You have the edge on paper.' : ratio >= 0.8 ? 'The sides are evenly matched.' : ratio >= 0.5 ? 'You are the weaker side on paper.' : 'You are badly outmatched on paper.', cost };
}

// ---- a third country is invaded: the player is asked to choose a side, and helping the victim is rewarded ----
ev('victimAppeal', { cat: 'system',
  title: x => nm(x.b) + ' appeals for help against ' + nm(x.a),
  text: x => nm(x.a) + ' has invaded ' + nm(x.b) + '. ' + (GOAL_TXT[x.goal] || '') + ' ' + nm(x.b) + ' is asking friendly governments for arms, sanctions on the aggressor and diplomatic backing. Doing nothing is an option, but the victim and its friends will notice who stood with it.',
  options: x => {
    const w = S.wars.find(w => w.id === x.war), c = me();
    if (!w || !alive(x.a) || !alive(x.b)) return [opt('Move on', '', () => 'The situation has changed.')];
    const can = S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' };
    const o = [];
    o.push(opt('Send military aid to ' + nm(x.b), 'Arms and money, no troops. Costs about 0.12% of GDP a year until the war ends.', () => {
      const side = warSideOf(w, x.b); if (!side) return 'The war has ended.';
      w.sup[side].push(S.player); c.flags.supporting = (c.flags.supporting || []).concat([x.b]);
      addR(S.player, x.b, 18); addR(S.player, x.a, -20); c.prest = clamp(c.prest + 2, 0, 100); S.world.tension = clamp(S.world.tension + 1, 0, 100);
      aliveList().forEach(i => { if (i !== S.player && i !== x.a && R(i, x.a) < -15) addR(S.player, i, 2); });
      news(nm(S.player) + ' begins sending military aid to ' + nm(x.b) + '.', 'war', S.player);
      return 'Shipments are on their way to ' + nm(x.b) + '. Its government is publicly grateful, and ' + nm(x.a) + ' is furious.';
    }));
    o.push(opt('Sanction ' + nm(x.a), 'Costs 1 PC. Hurts the aggressor and marks you as its opponent.', () => {
      S.pc -= pcCost(1);
      if (!sanctioned(S.player, x.a)) S.sanctions.push({ by: S.player, on: x.a, turn: S.turn });
      addR(S.player, x.a, -15); addR(S.player, x.b, 10); c.prest = clamp(c.prest + 2, 0, 100);
      return 'Sanctions on ' + nm(x.a) + ' are announced. ' + nm(x.b) + ' welcomes them, and like-minded governments take note.';
    }, can));
    o.push(opt('Condemn the invasion', 'Words only. Small gains.', () => { addR(S.player, x.a, -5); addR(S.player, x.b, 5); c.prest = clamp(c.prest + 1, 0, 100); return 'You condemn the invasion at the UN. It changes little on the ground.'; }));
    o.push(opt('Stay out of it', 'No cost. ' + nm(x.b) + ' will be disappointed if it counted on you.', () => { if (R(S.player, x.b) > 25) addR(S.player, x.b, -4); return 'You call for restraint on all sides and keep your distance.'; }));
    return o;
  } });
Object.assign(Engine, { warForces });
