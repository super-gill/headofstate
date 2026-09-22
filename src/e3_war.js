// ===================== WAR AND ALLIANCES =====================
function isBlocDefence(p, l) { return sharedBloc(p, l, ['defence', 'union']) != null; }

let ANNEX_CB = false;
function startWar(a, b, o) {
  o = o || {};
  const w = {
    id: S.nextWarId++, a: [a], b: [b], lead: { a, b }, aggressor: 'a', start: S.turn, m0: o.months || 0, score: o.score || 0,
    goal: o.goal || 'humiliate', cas: { a: 0, b: 0 }, sup: { a: [], b: [] }, stance: { a: 'bal', b: 'bal' },
    intensity: 1, exh: { a: 0, b: 0 }, cb: !!o.cb, offered: -99, pending: false, plan: { a: 'bal', b: 'bal' }, fort: { a: 0, b: 0 },
  };
  S.wars.push(w);
  C(a).flags.lastAggr = S.turn;
  if (a === S.player && !o.silent) S.stat.declared = (S.stat.declared || 0) + 1;
  if (!o.deferAllies) callAllies(w, !!o.silent);
  if (!o.silent) {
    news(nm(a) + ' has gone to war with ' + nm(b) + '.', 'war', a);
    S.world.tension = clamp(S.world.tension + 8, 0, 100);
  }
  S.dirtyBase = false;
  return w;
}

function callAllies(w, silent) {
  const sides = [['b', 'defensive'], ['a', 'offensive']];
  sides.forEach(([side, kind]) => {
    const L = w.lead[side], opp = side === 'a' ? 'b' : 'a', OL = w.lead[opp];
    defenceAllies(L).forEach(p => {
      if (!alive(p) || w.a.includes(p) || w.b.includes(p)) return;
      // skip if p is also bound to the other side (intra-bloc wars)
      if (defenceAllies(OL).includes(p) || p === OL) return;
      let prob = kind === 'defensive' ? (isBlocDefence(p, L) ? 0.85 : 0.7) : (hasPact(p, L) ? 0.12 : 0);
      prob *= clamp(0.5 + R(p, L) / 100, 0.3, 1.3);
      if (w[opp].some(x => C(x).nukes) && !C(p).nukes) prob *= 0.6;
      if (atWar(p)) prob *= 0.5;
      if (C(p).army < 1) prob *= 0.3;
      { const ai = S.allyIntel && S.allyIntel[p]; if (ai && ai.until > S.turn && L === S.player && p !== S.player) prob = ai.truth === 'solid' ? Math.max(prob, 0.92) : prob * 0.25; }
      if (p === S.player) {
        if (!silent) {
          const bl = sharedBloc(p, L, ['defence', 'union']);
          queueEvent('allyCall', { ally: L, war: w.id, side, kind, via: bl ? { t: 'bloc', n: bl.name } : hasPact(p, L) ? { t: 'pact' } : null });
        }
        return;
      }
      if (chance(prob)) { w[side].push(p); if (!silent) news(nm(p) + ' joins the war on the side of ' + nm(L) + '.', 'war', p); }
    });
    // supporters: aid without troops
    aliveList().forEach(p => {
      if (p === L || p === OL || w.a.includes(p) || w.b.includes(p) || p === S.player) return;
      const cp = C(p); if (cp.army < 3) return;
      const rl = R(p, L), ro = R(p, OL);
      if (rl > 24 && ro < 10 && chance(0.4 * (rl - 24) / 76 + (cp.camp && cp.camp === C(L).camp ? 0.35 : 0))) {
        w.sup[side].push(p);
        if (!silent) news(nm(p) + ' begins sending military aid to ' + nm(L) + '.', 'war', p);
      }
    });
  });
}

// ---------- campaign plans and operations ----------
const PLANS = {
  bal:   { id: 'bal',   name: 'Balanced', desc: 'No special emphasis. Steady and adaptable.', pos: 1, neg: 1, loss: 1, exhOpp: 0, flat: 0 },
  attr:  { id: 'attr',  name: 'Attrition', desc: 'Grind them down. Your gains come 20% slower, but the enemy tires faster.', pos: 0.8, neg: 1, loss: 1.05, exhOpp: 0.45, flat: 0 },
  blitz: { id: 'blitz', name: 'Manoeuvre', desc: 'Go for a quick decision. Gains x1.5, setbacks x1.3, and your forces wear out 40% faster.', pos: 1.5, neg: 1.3, loss: 1.4, exhOpp: 0, flat: 0 },
  air:   { id: 'air',   name: 'Air and missile', desc: 'Steady pressure from the sky: +0.6 a month, 30% fewer losses. Needs technology 3+ and costs 0.03% of GDP a month.', pos: 1, neg: 1, loss: 0.7, exhOpp: 0, flat: 0.6, need: c => c.tech >= 3 ? null : 'Needs technology level 3 or higher.' },
  deep:  { id: 'deep',  name: 'Defence in depth', desc: 'Trade space for time. Setbacks x0.6, gains x0.7, and 20% fewer losses.', pos: 0.7, neg: 0.6, loss: 0.8, exhOpp: 0, flat: 0 },
};
const planOf = (w, s) => (w.plan && w.plan[s]) || 'bal';
function planAdjust(w, d) {
  ['a', 'b'].forEach(s => {
    const P = PLANS[planOf(w, s)]; if (!P || P.id === 'bal') return;
    const dir = s === 'a' ? 1 : -1, mine = d * dir;
    d = dir * (mine > 0 ? mine * P.pos : mine * P.neg) + dir * P.flat;
  });
  ['a', 'b'].forEach(s => { if (w.fort && w.fort[s] > S.turn) { const dir = s === 'a' ? 1 : -1; if (d * dir < 0) d *= 0.5; } });
  return d;
}
const clampScore = w => { const hi = w.b.some(x => C(x).nukes) ? 55 : 100, lo = w.a.some(x => C(x).nukes) ? -55 : -100; w.score = clamp(w.score, lo, hi); };
function swing(w, side, amount) { w.score += (side === 'a' ? 1 : -1) * amount; clampScore(w); }

function planList(wid) {
  const w = S.wars.find(x => x.id === wid); if (!w) return [];
  const side = warSideOf(w, S.player); if (!side) return [];
  const c = me(), cur = planOf(w, side);
  return Object.values(PLANS).map(P => {
    let why = P.need ? P.need(c) : null;
    if (!why && P.id !== cur && S.pc < pcCost(1)) why = 'Not enough political capital.';
    return { id: P.id, name: P.name, desc: P.desc, on: P.id === cur, ok: !why, why, pc: P.id === cur ? 0 : pcCost(1) };
  });
}
function setPlan(wid, id) {
  const w = S.wars.find(x => x.id === wid); const P = PLANS[id]; if (!w || !P) return { ok: false, text: 'Unknown plan.' };
  const side = warSideOf(w, S.player); if (!side) return { ok: false, text: 'You are not in this war.' };
  if (planOf(w, side) === id) return { ok: false, text: 'That is already your plan.' };
  const info = planList(wid).find(x => x.id === id); if (!info) return { ok: false, text: 'Unknown plan.' }; if (!info.ok) return { ok: false, text: info.why };
  S.pc -= info.pc; w.plan = w.plan || { a: 'bal', b: 'bal' }; w.plan[side] = id;
  logPlayer('Changed war plan against ' + nm(w.lead[side === 'a' ? 'b' : 'a']) + ' to ' + P.name + '.');
  return { ok: true, text: 'New campaign plan: ' + P.name + '. ' + P.desc };
}

const OPS = [
  { id: 'push', name: 'Offensive push', pc: 1, cd: 3, cost: 0, desc: 'Throw reserves at a weak point. Swings the war 4 to 12 points your way. It can stall, and readiness drops.',
    avail: (c, w) => c.readiness < 25 ? 'Your forces are too worn out.' : null,
    run: (c, w, s) => { if (chance(0.25)) { swing(w, s, 1); c.readiness = Math.max(10, c.readiness - 10); c.army *= 0.97; fac(c, 'military', -2); return 'The push stalls against prepared defences. Heavy losses for little ground.'; } const g = (4 + rnd() * 8) * (0.7 + 0.3 * c.readiness / 100); swing(w, s, g); c.readiness = Math.max(10, c.readiness - 6); c.army *= 0.985; return 'The attack breaks through. Ground is taken and the front moves your way.'; } },
  { id: 'air', name: 'Air and missile strikes', pc: 1, cd: 2, cost: 0.25, desc: 'Hit command posts, depots and industry. Swings the war 3 to 6 points. Costs 0.25% of GDP, and raises tension.',
    avail: (c, w) => c.tech < 2 ? 'Needs technology level 2 or higher.' : null,
    run: (c, w, s, en) => { swing(w, s, 3 + rnd() * 3 * (0.6 + c.tech / 6)); const e = C(en); e.stab = clamp(e.stab - 2, 2, 99); e.army *= 0.99; S.world.tension = clamp(S.world.tension + 1, 0, 100); if (e.nukes) S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + 3); if (chance(0.12)) { c.prest = clamp(c.prest - 3, 0, 100); addMod(c, 'appr', -1, 4); return 'Strikes hit key targets, but a strike on a crowded district kills civilians and the world notices.'; } return 'Waves of strikes hit their depots and command posts. Their movements slow.'; } },
  { id: 'fort', name: 'Fortify and dig in', pc: 1, cd: 4, cost: 0, desc: 'For four months, halve any ground the enemy gains. Forces rest and readiness recovers.',
    avail: () => null,
    run: (c, w, s) => { w.fort = w.fort || { a: 0, b: 0 }; w.fort[s] = S.turn + 4; c.readiness = Math.min(100, c.readiness + 6); return 'Engineers dig in and reserves are pulled back. The line will be hard to crack for the next few months.'; } },
  { id: 'raid', name: 'Special forces raid', pc: 1, cd: 2, cost: 0, desc: 'A risky strike deep behind the lines. Can swing the war and dent the enemy leader\'s standing, or embarrass you.',
    avail: (c, w) => c.tech < 2 ? 'Needs technology level 2 or higher.' : null,
    run: (c, w, s, en) => { const r = rnd(); if (r < 0.5) { swing(w, s, 5); C(en).prest = clamp(C(en).prest - 3, 0, 100); return 'The raid destroys a command centre and returns home. The enemy is rattled.'; } if (r < 0.8) return 'The team is extracted safely, but the target had already moved. Little to show for it.'; swing(w, s, -2); c.prest = clamp(c.prest - 2, 0, 100); addMod(c, 'appr', -3, 4); return 'The raid goes wrong. Operators are captured and paraded on enemy television.'; } },
  { id: 'blockade', name: 'Naval blockade', pc: 2, cd: 8, cost: 0.3, desc: 'Choke their trade. Their economy loses 0.7 points of growth for ten months, and they tire. Costs 0.3% of GDP and irritates their trade partners.',
    avail: (c, w) => c.army < 10 ? 'You lack the naval strength.' : null,
    run: (c, w, s, en) => { addMod(C(en), 'growth', -0.7, 10); w.exh[s === 'a' ? 'b' : 'a'] += 6; swing(w, s, 2); S.world.tension = clamp(S.world.tension + 1.5, 0, 100); S.deals.filter(d => d.includes(en)).forEach(d => { const o = d[0] === en ? d[1] : d[0]; if (o !== S.player) addR(S.player, o, -2); }); return 'Warships close the sea lanes. Shortages start to bite in their ports.'; } },
  { id: 'cyber', name: 'Cyber offensive', pc: 1, cd: 3, cost: 0.1, desc: 'Cripple their networks. Their readiness and stability drop. Costs 0.1% of GDP and invites retaliation.',
    avail: (c, w) => c.tech < 3 ? 'Needs technology level 3 or higher.' : null,
    run: (c, w, s, en) => { const e = C(en); e.readiness = Math.max(15, e.readiness - 8); e.stab = clamp(e.stab - 2, 2, 99); swing(w, s, 2); if (chance(0.3) && e.tech >= 3) { addMod(c, 'growth', -0.2, 4); return 'Their command networks go dark for days. Their hackers hit back at your banks in return.'; } return 'Their command networks go dark for days. Units fall out of contact.'; } },
];
function opList(wid) {
  const w = S.wars.find(x => x.id === wid); if (!w) return [];
  const side = warSideOf(w, S.player); if (!side) return [];
  const c = me();
  return OPS.map(o => {
    let why = o.avail(c, w); const key = 'op' + wid + o.id;
    if (!why && S.cool[key] > S.turn) why = 'Ready again in ' + mo(S.cool[key] - S.turn) + '.';
    const cost = o.cost ? c.gdp * o.cost / 100 : 0;
    if (!why && S.pc < pcCost(o.pc)) why = 'Not enough political capital.';
    if (!why && cost && c.treasury < cost * 0.9) why = 'Treasury too low.';
    return { id: o.id, name: o.name, desc: o.desc, pc: pcCost(o.pc), cost, ok: !why, why };
  });
}
function doOp(wid, id) {
  const w = S.wars.find(x => x.id === wid); const o = OPS.find(x => x.id === id); if (!w || !o) return { ok: false, text: 'Unknown order.' };
  const info = opList(wid).find(x => x.id === id); if (!info) return { ok: false, text: 'You are not fighting that war.' }; if (!info.ok) return { ok: false, text: info.why };
  const side = warSideOf(w, S.player), en = w.lead[side === 'a' ? 'b' : 'a'], c = me();
  const before = snapshot(c), sc0 = w.score;
  S.pc -= info.pc; if (info.cost) c.treasury -= info.cost; S.cool['op' + wid + id] = S.turn + o.cd;
  const text = o.run(c, w, side, en);
  const d = (w.score - sc0) * (side === 'a' ? 1 : -1);
  logPlayer(o.name + ': ' + text);
  const chips = diffChips(before, snapshot(c)); if (Math.abs(d) >= 0.5) chips.unshift({ label: 'War score', text: sgn0(d), good: d > 0 });
  return { ok: true, text, chips };
}
const sgn0 = v => (v >= 0 ? '+' : '') + (Math.round(v * 10) / 10);

function warPowerSide(w, side) {
  let p = 0; const L = w.lead[side];
  w[side].forEach(i => { const c = C(i); if (c) p += power(c) * (i === L ? 1 : 0.65); });
  const la = power(C(L));
  (w.sup[side] || []).forEach(i => { if (alive(i)) p += Math.min(0.05 * power(C(i)), 0.35 * la); });
  const st = w.stance[side]; p *= st === 'off' ? 1.12 : st === 'def' ? 0.92 : 1;
  if (side === 'b' && w.aggressor === 'a') p *= 1.2;
  if (side === 'a' && !w.b.some(y => w.a.some(x => NB[x] && NB[x].includes(y)))) p *= 0.75;
  return Math.max(p, 0.05);
}

function warStep(w) {
  if (w.pending) return;
  const pa = warPowerSide(w, 'a'), pb = warPowerSide(w, 'b');
  const months = w.m0 + (S.turn - w.start);
  let d = Math.log(pa / pb) * 5 + gauss() * 2.4;
  d /= (1 + months * 0.035);
  d = planAdjust(w, d);
  let hi = 100, lo = -100;
  if (w.b.some(x => C(x).nukes)) hi = 55;
  if (w.a.some(x => C(x).nukes)) lo = -55;
  w.score = clamp(w.score + d, lo, hi);
  w.intensity = clamp(1 + Math.log10(1 + Math.min(pa, pb)) * 0.55, 1, 3);
  // attrition
  ['a', 'b'].forEach(side => {
    const own = side === 'a' ? pa : pb, opp = side === 'a' ? pb : pa;
    const stanceLoss = w.stance[side] === 'off' ? 1.3 : w.stance[side] === 'def' ? 0.75 : 1;
    w[side].forEach(i => {
      const c = C(i); const share = i === w.lead[side] ? 1 : 0.6;
      const loss = 0.010 * clamp(opp / own, 0.3, 3) * share * w.intensity * stanceLoss * PLANS[planOf(w, side)].loss;
      c.army *= (1 - loss); c.readiness = Math.max(15, c.readiness - 0.8);
      c.kills = (c.kills || 0) + loss * 45 * Math.sqrt(c.pop + 1);
    });
    const k = 0.06 * opp * w.intensity * stanceLoss;
    w.cas[side] += k; S.stat.casualties += k;
    w.exh[side] += w.intensity * (1 + C(w.lead[side]).warWeary / 100) * 0.6;
    { const P = PLANS[planOf(w, side)]; if (P.exhOpp) w.exh[side === 'a' ? 'b' : 'a'] += P.exhOpp * w.intensity; if (P.id === 'air' && w.lead[side] === S.player) C(S.player).treasury -= C(S.player).gdp * 0.0003; }
  });
  // damage and morale
  const losing = w.score > 0 ? 'b' : 'a';
  ['a', 'b'].forEach(side => {
    const attacked = (side === 'b') === (w.aggressor === 'a');
    const sc = side === 'a' ? w.score : -w.score;
    w[side].forEach(i => {
      const c = C(i); const share = i === w.lead[side] ? 1 : 0.35;
      let dmg = attacked ? (0.6 + 2.8 * Math.max(0, -sc) / 100 + 0.6 * w.intensity) : (0.35 + 0.5 * w.intensity);
      c.warDmg = Math.max(c.warDmg || 0, dmg * share);
      c.warSuccess = sc;
    });
  });
  // nuclear brinkmanship
  nuclearCheck(w);
  // ending
  const total = w.score >= 100 ? 'a' : w.score <= -100 ? 'b' : null;
  if (total) return concludeWar(w, total, true);
  // Nuclear stalemate: a side pinned at the cap cannot win outright, but it can force terms
  {
    const capSide = (w.b.some(x => C(x).nukes) && w.score >= 54.5) ? 'a' : (w.a.some(x => C(x).nukes) && w.score <= -54.5) ? 'b' : null;
    if (capSide) w.capM = (w.capM || 0) + 1; else w.capM = Math.min(0, w.capM || 0) + (w.capM < 0 ? 1 : 0);
    if (capSide && w.capM >= 4) {
      const involved = w.a.concat(w.b).includes(S.player);
      if (w.lead[capSide] === S.player) { w.capM = -6; w.pending = true; queueEvent('victoryTerms', { war: w.id, side: capSide, total: false, limited: true, nuker: w[capSide === 'a' ? 'b' : 'a'].find(x => C(x).nukes) }); return; }
      if (!involved) { concludeWar(w, capSide, false); return; }
      const pSide = w.a.includes(S.player) ? 'a' : 'b';
      if (pSide !== capSide && w.lead[pSide] === S.player) { w.capM = -4; if (S.turn - w.offered >= 3) { w.offered = S.turn; queueEvent('ceasefireOffer', { war: w.id, from: w.lead[capSide], dictated: true }); } }
      else if (pSide === capSide) { w.capM = -4; concludeWar(w, capSide, false); return; }
    }
  }
  const aiOnly = !w.a.concat(w.b).includes(S.player);
  const peaceP = 0.006 + 0.0007 * months + (Math.abs(w.score) > 55 ? 0.05 : 0) + Math.max(w.exh.a, w.exh.b) * 0.0004;
  if (chance(peaceP)) {
    if (aiOnly) {
      if (Math.abs(w.score) >= 55) concludeWar(w, w.score > 0 ? 'a' : 'b', false); else concludeWar(w, null, false);
    } else if (S.turn - w.offered >= 4) {
      w.offered = S.turn;
      const pSide = w.a.includes(S.player) ? 'a' : 'b';
      const enemy = w.lead[pSide === 'a' ? 'b' : 'a'];
      if (Math.abs(w.score) >= 55 && (w.score > 0) !== (pSide === 'a')) queueEvent('ceasefireOffer', { war: w.id, from: enemy, dictated: true });
      else queueEvent('ceasefireOffer', { war: w.id, from: enemy });
    }
  }
}

function nuclearCheck(w) {
  ['a', 'b'].forEach(side => {
    const sc = side === 'a' ? w.score : -w.score;
    const L = w.lead[side], c = C(L);
    if (!c.nukes || sc > -45) return;
    // regime under threat: signalling then rare use
    const oppSide = side === 'a' ? 'b' : 'a';
    const sig = 0.03 * (-sc - 45) / 55;
    if (chance(sig)) {
      S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + 10);
      news(nm(L) + ' raises its nuclear alert level as its position in the war deteriorates.', 'nuclear', L);
      if (w.a.concat(w.b).includes(S.player) || S.player === L) queueEvent('nuclearSignal', { from: L, war: w.id });
    }
    if (chance(0.0009 * (-sc - 45) / 55 * (1 + (S.world.nukeAlert || 0) / 30))) {
      if (L === S.player) return;
      nuclearStrike(L, w.lead[oppSide], w);
    }
  });
}

function nuclearStrike(by, target, w) {
  const b = C(by), t = C(target);
  S.world.nukeUse++; S.world.nukeAlert = 60; S.world.tension = 100;
  news('NUCLEAR DETONATION: ' + b.name + ' has used a nuclear weapon against ' + t.name + '.', 'nuclear', by);
  t.stab = Math.max(5, t.stab - 40); t.gdp *= 0.88; t.army *= 0.6; t.pop *= 0.985;
  aliveList().forEach(i => { if (i !== by) addR(i, by, -35); });
  aliveList().forEach(i => { if (i !== by && C(i).army > 10 && chance(0.4)) { if (!S.sanctions.some(s => s.by === i && s.on === by)) S.sanctions.push({ by: i, on: by, turn: S.turn }); } });
  b.prest = Math.max(0, b.prest - 50);
  // retaliation risk
  const retaliators = [target, ...defenceAllies(target)].filter(x => C(x).nukes);
  if (retaliators.length && b.nukes && chance(0.35 + 0.15 * (retaliators.length - 1))) {
    S.over = { type: 'nuclear', title: 'Nuclear exchange', text: 'A single strike triggered retaliation, and retaliation triggered more. Within days the great powers had spent their arsenals. There is no leader left to lead, and very little left to lead.', world: true };
  }
  if (w) w.score = clamp(w.score + (w.lead.a === by ? 45 : -45), -100, 100);
  S.dirtyBase = true;
}

// ---------- ending wars ----------
function canAnnex(win, lose) { return annexReason(win, lose) === null; }
function concludeWar(w, winnerSide, total) {
  // ceasefire or decisive result
  const involvedPlayer = w.a.concat(w.b).includes(S.player);
  if (winnerSide === null) return finishWar(w, null, null);
  const winL = w.lead[winnerSide];
  if (winL === S.player && !w.playerDecides) {
    w.pending = true;
    queueEvent('victoryTerms', { war: w.id, side: winnerSide, total });
    return;
  }
  const terms = pickTerms(w, winnerSide);
  finishWar(w, winnerSide, terms);
}
function pickTerms(w, winnerSide) {
  const win = w.lead[winnerSide], lose = w.lead[winnerSide === 'a' ? 'b' : 'a'];
  const aggr = C(win).aggr;
  const winnerIsAttacker = winnerSide === 'a';
  if (!winnerIsAttacker) return 'repel';
  if (w.goal === 'conquest' && canAnnex(win, lose) && S.turn - S.world.lastAnnex >= 30 && (isAuto(C(win).gov) || aggr >= 0.4) && chance(0.5)) return 'annex';
  if (w.goal === 'regime' || chance(0.25 * aggr)) return 'regime';
  return 'concede';
}
function finishWar(w, winnerSide, terms) {
  S.wars = S.wars.filter(x => x !== w);
  const all = w.a.concat(w.b);
  all.forEach(i => { const c = C(i); if (c) { c.lastWarEnd = S.turn; c.warWeary *= 0.6; c.warDmg = 0; c.warSuccess = 0; } });
  const months = w.m0 + (S.turn - w.start);
  const pl = all.includes(S.player);
  aftermath(w, winnerSide, months);
  if (winnerSide === null) {
    all.forEach(i => w.a.includes(i) ? w.b.forEach(j => addR(i, j, 10)) : 0);
    news('Ceasefire between ' + nm(w.lead.a) + ' and ' + nm(w.lead.b) + ' after ' + mo(Math.max(1, months)) + ' of fighting.', 'peace', w.lead.a);
    if (pl) S.stat.ceasefires++;
    S.world.tension = Math.max(0, S.world.tension - 6);
    w.a.concat(w.b).forEach(i => { const c = C(i); if (c && pl) c.prest = Math.min(100, c.prest); });
    if (pl) logPlayer('Ceasefire agreed: ' + nm(w.lead.a) + ' and ' + nm(w.lead.b) + '.');
    return;
  }
  const loserSide = winnerSide === 'a' ? 'b' : 'a';
  const win = w.lead[winnerSide], lose = w.lead[loserSide];
  const cw = C(win), cl = C(lose);
  cw.prest = clamp(cw.prest + 6, 0, 100); cl.prest = clamp(cl.prest - 8, 0, 100);
  cl.stab = clamp(cl.stab - 10, 2, 99); cl.appr = clamp(cl.appr - 12, 3, 97); cl.fac.military = clamp(cl.fac.military - 12, 1, 99);
  if (win === S.player) addMod(cw, 'appr', 5, 6); else cw.appr = clamp(cw.appr + 6, 3, 97);
  cw.fac.military = clamp(cw.fac.military + 8, 1, 99);
  w[winnerSide].forEach(i => { if (i !== win) C(i).prest = clamp(C(i).prest + 2, 0, 100); });
  if (pl) { const ps = w.a.includes(S.player) ? 'a' : 'b'; if (ps === winnerSide) S.stat.warsWon++; else S.stat.warsLost++; }
  let msg;
  ANNEX_CB = !!w.cb;
  if (terms === 'annex' && canAnnexNow(win, lose)) { annex(win, lose); msg = nm(lose) + ' has been annexed by ' + nm(win) + '.'; }
  else if (terms === 'regime') {
    cl.gov = isAuto(cw.gov) && chance(0.6) ? pick(['J', 'P']) : 'H'; const g = GOV[cl.gov]; cl.free = g.free; cl.corr = g.corr; cl.campLock = cw.camp; cl.flags.customGov = 1; S.dirtyBase = true;
    addR(win, lose, 25);
    markPuppet(lose, win);
    if (win === S.player) annexFallout(lose, !!w.cb, 'regime');
    const nl = replaceLeader(lose, false);
    msg = nm(win) + ' forces regime change in ' + nm(lose) + (nl ? '. ' + nl.name + ' now heads the government.' : '.');
  } else if (terms === 'magnanimous') {
    cl.stab += 3; addR(win, lose, 10); msg = nm(win) + ' and ' + nm(lose) + ' sign a generous peace.';
  } else if (terms === 'repel') {
    cw.prest = clamp(cw.prest + 4, 0, 100); cl.stab -= 5;
    msg = nm(lose) + ' has been forced to withdraw. ' + nm(win) + ' held firm.';
    if (isAuto(cl.gov) && cl.stab < 35 && chance(0.4)) regimeChange(cl, 'defeat');
  } else {
    cl.gdp *= 0.97; cw.treasury += cl.gdp * 0.03;
    addR(win, lose, -8);
    msg = nm(lose) + ' accepts humiliating terms from ' + nm(win) + '.';
  }
  news('WAR ENDS: ' + msg, 'peace', win);
  if (pl) logPlayer('War ended: ' + msg);
  w.a.concat(w.b).forEach(i => { if (i !== win && i !== lose) addR(i, win, winnerSide === (w.a.includes(i) ? 'a' : 'b') ? 4 : -4); });
  S.world.tension = Math.max(0, S.world.tension - 5);
  S.dirtyBase = true;
  if (lose === S.player && terms === 'annex') S.over = { type: 'conquered', title: 'Your nation is annexed', text: nm(win) + ' has absorbed your country. The flag comes down and your government is dissolved.' };
}
const canAnnexNow = (win, lose) => canAnnex(win, lose) && alive(lose);

function annex(winner, loser) {
  const Wn = C(ownerOf(winner)), L = C(loser);
  const relBefore = R(Wn.iso, loser);
  Wn.pop += L.pop * 0.92; Wn.army += L.army * 0.15; Wn.stab = clamp(Wn.stab - 4, 2, 99); Wn.prest = clamp(Wn.prest - 5, 0, 100);
  L.alive = false; S.owner[loser] = Wn.iso;
  // the conquered country becomes a territory: its GDP is credited as it is integrated
  if (!S.terr) S.terr = {};
  S.terr[loser] = makeTerritory(Wn.iso, loser, relBefore); S.terr[loser].gdp = L.gdp * 0.78; terrCredit(S.terr[loser]);
  S.stat.annexed++; S.world.annexations++; S.world.lastAnnex = S.turn;
  Object.values(S.blocs).forEach(b => b.members = b.members.filter(x => x !== loser));
  S.pacts = S.pacts.filter(p => p[0] !== loser && p[1] !== loser);
  S.deals = S.deals.filter(d => d[0] !== loser && d[1] !== loser);
  S.sanctions = S.sanctions.filter(s => s.by !== loser && s.on !== loser);
  S.rivals = S.rivals.filter(r => r.a !== loser && r.b !== loser);
  // strip from any other wars
  S.wars.forEach(w => { for (const s of ['a', 'b']) { w[s] = w[s].filter(x => x !== loser); w.sup[s] = w.sup[s].filter(x => x !== loser); } });
  S.wars = S.wars.filter(w => w.a.length && w.b.length);
  aliveList().forEach(i => { if (i !== Wn.iso) addR(i, Wn.iso, isDemo(C(i).gov) ? -8 : -3); });
  S.dirtyBase = true;
  if (Wn.iso === S.player) annexFallout(loser, !!ANNEX_CB);
}

// ---------- tension ----------
function computeTension() {
  let t = 12;
  S.wars.forEach(w => {
    const tot = w.a.concat(w.b).reduce((s, i) => s + C(i).army, 0);
    t += Math.min(10, 2 + 2.2 * Math.log10(1 + tot));
    const nuc = new Set(); ['a', 'b'].forEach(s => w[s].concat(w.sup[s]).forEach(i => { if (alive(i) && C(i).nukes) nuc.add(s); }));
    if (nuc.size === 2) t += 12;
    if (w.a.concat(w.b).some(i => C(i).army > 150)) t += 5;
  });
  S.rivals.forEach(r => {
    if (!alive(r.a) || !alive(r.b)) return;
    const host = Math.max(0, -R(r.a, r.b) - 30) / 70;
    const wgt = Math.min(1, (C(r.a).army + C(r.b).army) / 400);
    t += host * r.n * 2.4 * wgt;
  });
  t += (S.world.nukeAlert || 0) * 0.6;
  return clamp(t, 0, 100);
}

// ---------- AI aggression ----------
function aiWarStarts() {
  if (S.wars.length >= 6 || S.turn < 4) return;
  const seen = new Set(); const cand = [];
  const push = (a, b) => { const k = a + b; if (seen.has(k)) return; seen.add(k); cand.push([a, b]); };
  S.rivals.forEach(r => { push(r.a, r.b); push(r.b, r.a); });
  aliveList().forEach(a => (NB[a] || []).forEach(b => { if (alive(b) && R(a, b) < -22) push(a, b); }));
  const t = S.world.tension;
  cand.forEach(([a, b]) => {
    if (!alive(a) || !alive(b)) return;
    const prepped = b === S.player && C(a).flags.warPrep > S.turn;
    if (a === S.player || b === S.player) { if (!prepped && !aiTargetsPlayer(a, b)) return; }
    if (atWar(a)) return;
    if (warBetween(a, b)) return;
    if (S.turn - Math.max(C(a).lastWarEnd, C(b).lastWarEnd) < 30) return;
    const rel = R(a, b);
    if (rel > -34) return;
    if (sharedBloc(a, b, ['defence'])) return;
    const ca = C(a), cb = C(b);
    if (ca.army < 0.5 || !canReach(a, b)) return;
    const defenders = defenceAllies(b).reduce((s, x) => s + power(C(x)), 0);
    let friendPow = 0, friendNuke = false;
    if (cb.camp) aliveList().forEach(x => { if (x !== b && x !== a && C(x).camp === cb.camp && R(b, x) > 25) { friendPow += 0.15 * power(C(x)); if (C(x).nukes && C(x).camp !== ca.camp) friendNuke = true; } });
    const ratio = power(ca) / (power(cb) * 1.15 + defenders * 0.5 + friendPow + 0.01);
    if (ratio < 0.85) return;
    let p = 0.00022 * S.temper * Math.pow(leaderAggr(ca) / 0.3, 1.5) * (1 + (-rel - 34) / 40) * clamp(ratio, 0.5, 2.5) * (1 + t / 120);
    const rv = rivalryOf(a, b); if (rv) p *= 1 + 0.7 * rv;
    if (ca.nukes && cb.nukes) p *= 0.15; else if (cb.nukes) p *= 0.25;
    if (friendNuke) p *= 0.35;
    if (ca.warWeary > 20) p *= 0.4;
    if (isDemo(ca.gov) && ca.gov === 'D') p *= 0.35;
    if (ca.stab < 30) p *= 1.3;
    if (a === S.player || b === S.player) p *= 0.5;
    if (prepped) p *= 7 * (S.c[S.player].mob >= 1 ? 0.4 : 1);
    if (chance(p)) {
      const goal = cb.nukes ? 'humiliate' : (chance(0.45 * leaderAggr(ca) / 0.3) && canAnnex(a, b) ? 'conquest' : (chance(0.25) ? 'regime' : 'humiliate'));
      aiDeclare(a, b, goal);
    }
  });
}
const GOAL_TXT = { conquest: 'Aim: conquest.', regime: 'Aim: toppling the government.', humiliate: 'Aim: forcing concessions.' };
function warWhy(a, b, goal) {
  const rv = S.rivals.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  let why = rv && rv.why ? ' Background: ' + rv.why.replace(/\.$/, '').toLowerCase() + '.' : (NB[a] && NB[a].includes(b) ? ' Border tensions had been rising.' : '');
  return (GOAL_TXT[goal] || '') + why;
}
function aiTargetsPlayer(a, b) {
  // only rivals with real grievances go after the player, and only a fraction of the time
  const pl = S.player; const other = a === pl ? b : a; if (a === pl) return false;
  return rivalryOf(a, b) > 0 || R(a, b) < -50;
}
function aiDeclare(a, b, goal) {
  if (b === S.player) {
    // warning first, then war
    queueEvent('warDeclared', { by: a, goal, why: warWhy(a, S.player, goal) });
    return;
  }
  const w = startWar(a, b, { goal });
  news('WAR: ' + nm(a) + ' invades ' + nm(b) + '. ' + warWhy(a, b, goal), 'war', a);
  if (b !== S.player && w.b.includes(S.player) === false) {
    // ripple in relations
    aliveList().forEach(i => { if (i !== a) addR(i, a, isDemo(C(i).gov) ? -3 : -1); });    if (a !== S.player && S.turn - (S.eventHist.victimAppeal == null ? -99 : S.eventHist.victimAppeal) >= 8 && S.events.length < 3 && !(defenceAllies(S.player).includes(a)) && R(S.player, a) < 25 && R(S.player, b) > -15 && C(b).gdp > 5) queueEvent('victimAppeal', { a, b, war: w.id, goal });
  }
}
