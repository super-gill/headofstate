// ===================== EMPIRE: ANNEXED TERRITORIES =====================
// An annexed country does not simply vanish into your totals. It becomes a territory with its own
// integration and unrest. Integration slowly turns conquered land into real GDP, while unrest drags on
// your stability, costs money to hold down and can end in revolt and secession.

const POSTURES = {
  light: { n: 'Light touch', cost: 1.5, push: 8, integ: 0.5, d: 'A thin administration. Cheap, but resentment builds and integration is slow.' },
  garrison: { n: 'Garrison', cost: 6, push: -14, integ: 0.2, d: 'Troops in the streets. Suppresses unrest fast, slows integration, hurts liberty at home and abroad.' },
  invest: { n: 'Invest and assimilate', cost: 10, push: -4, integ: 1.1, d: 'Roads, schools and jobs. Expensive, but it turns conquered land into your own.' },
};

function terrList() { return Object.values(S.terr || {}); }
function terrOf(owner) { return terrList().filter(t => ownerOf(t.iso) === owner && ownerOf(t.iso) !== t.iso); }
function terrFrac(t) {
  const base = 0.35 + 0.55 * t.integ / 100;
  return Math.max(0.05, base * (1 - Math.max(0, t.unrest - 55) / 120) * (t.autonomy ? 0.85 : 1));
}
const POSTURE_PC = { light: 60, garrison: 220, invest: 500 }; // dollars per resident per year (pop is in millions)
// annual cost in $bn: the larger of a share of what the territory yields and a per-resident cost of running it
const terrAnnual = t => Math.max(t.gdp * t.cred * POSTURES[t.posture].cost / 100, t.pop * (POSTURE_PC[t.posture] || 25) / 1000);
function terrCostPct(c) {
  // annual cost as a percentage of the owner's own GDP
  let s = 0; terrOf(c.iso).forEach(t => { s += terrAnnual(t); });
  return c.gdp > 0 ? s * 100 / c.gdp : 0;
}

function makeTerritory(winner, loser, relBefore) {
  const L = C(loser);
  const same = (C(winner).region === L.region ? 1 : 0), govSame = (C(winner).gov === L.gov ? 1 : 0);
  const nat = clamp(54 + (-relBefore) * 0.25 + (L.free > 60 ? 8 : 0) - same * 8 - govSame * 5, 28, 88);
  const t = {
    iso: loser, holder: winner, since: S.turn, integ: 8 + same * 8 + govSame * 4, unrest: clamp(nat + 6, 20, 95), nat,
    posture: 'light', pop: L.pop * 0.92, gdp: L.gdp * 0.7, cred: 0, armyGot: 0, autonomy: false, revolts: 0, lastEvent: -99,
  };
  return t;
}

// credit the owner with what the territory is worth right now
function terrCredit(t) {
  const O = C(ownerOf(t.iso)); if (!O) return;
  const f = terrFrac(t), delta = t.gdp * (f - t.cred);
  O.gdp = Math.max(1, O.gdp + delta); t.cred = f;
  if (t.integ >= 50 && !t.armyDone) { t.armyDone = true; const a = C(t.iso).army * 0.15; O.army += a; t.armyGot += a; }
}

function terrStep() {
  if (!S.terr) S.terr = {};
  const heat = {}; const drag = {};
  terrList().slice().forEach(t => {
    const o = ownerOf(t.iso), O = C(o);
    if (o === t.iso || !O || !O.alive || C(t.iso).alive) { delete S.terr[t.iso]; return; }
    const P = POSTURES[t.posture] || POSTURES.light, isMe = o === S.player;
    // AI owners choose a posture on their own
    if (!isMe && S.turn % 3 === 0) t.posture = t.unrest > 55 ? 'garrison' : (O.treasury > O.gdp * 0.01 && isDemo(O.gov) ? 'invest' : 'light');
    // integration
    const kin = (C(o).region === C(t.iso).region ? 0.35 : 0) + (C(o).gov === C(t.iso).gov ? 0.2 : 0);
    const before = t.integ;
    t.integ = clamp(t.integ + P.integ * (1 + kin) * (1 - t.unrest / 160) + (t.autonomy ? 0.2 : 0), 0, 100);
    // unrest drifts toward a target
    let tgt = t.nat * (1 - 0.5 * t.integ / 100) + P.push;
    if (O.stab < 35) tgt += 10;
    if (O.warWeary > 50) tgt += 6;
    if (O.army < C(t.iso).army * 0.3) tgt += 4;
    if (t.autonomy) tgt -= 8;
    t.unrest = clamp(t.unrest + (tgt - t.unrest) * 0.12 + gauss() * 0.7, 0, 100);
    terrCredit(t);
    const share = t.pop / Math.max(1, O.pop);
    drag[o] = (drag[o] || 0) + (t.unrest / 100) * share * 45;
    heat[o] = (heat[o] || 0) + Math.max(0, t.unrest - 50) / 50;
    // milestone
    if (before < 75 && t.integ >= 75) {
      O.prest = clamp(O.prest + 2, 0, 100);
      news(nm(t.iso) + ' is now fully integrated into ' + nm(o) + '.', 'politics', o);
      if (isMe) logPlayer(nm(t.iso) + ' is now fully integrated. Its economy counts almost in full.');
    }
    // revolt
    if (t.unrest > 68 && S.turn - t.lastEvent >= 6) {
      const p = (t.unrest - 68) / 32 * 0.09 * (t.posture === 'garrison' ? 0.6 : 1);
      if (chance(p)) {
        t.lastEvent = S.turn; t.revolts++;
        const breakaway = t.unrest > 85 && t.integ < 45 && chance(0.35);
        if (isMe) queueEvent(breakaway ? 'terrSecession' : 'terrInsurgency', { t: t.iso });
        else if (breakaway) secede(t, 'revolt');
        else { t.unrest = Math.max(20, t.unrest - 18); O.stab = clamp(O.stab - 2, 2, 99); news('Insurgents attack occupation forces in ' + nm(t.iso) + ', held by ' + nm(o) + '.', 'politics', t.iso); }
      }
    }
  });
  aliveList().forEach(i => { const c = C(i); c.flags.terrDrag = Math.min(14, drag[i] || 0); c.flags.terrHeat = heat[i] || 0; });
}

function secede(t, why) {
  const iso = t.iso, o = ownerOf(iso), O = C(o), L = C(iso);
  if (O) {
    O.pop = Math.max(O.pop * 0.5, O.pop - t.pop);
    O.gdp = Math.max(O.gdp * 0.5, O.gdp - t.gdp * t.cred);
    O.army = Math.max(0.05, O.army - (t.armyGot || 0));
    O.prest = clamp(O.prest - 6, 0, 100); O.stab = clamp(O.stab - 5, 2, 99);
    if (o === S.player) S.stat.terrLost = (S.stat.terrLost || 0) + 1;
  }
  L.alive = true; S.owner[iso] = iso; delete S.terr[iso];
  L.stab = 30; L.appr = 62; L.army = Math.max(L.army, L.army * 0.8 + 0.05);
  L.flags = L.flags || {}; L.flags.supporting = [];
  if (O) { addR(iso, o, -70); }
  aliveList().forEach(i => { if (i !== iso && i !== o) addR(i, iso, 6); });
  news(nm(iso) + ' has broken away from ' + (O ? nm(o) : 'its master') + ' and declared independence.', 'politics', iso);
  S.dirtyBase = true;
}

function setPosture(iso, key) {
  const t = S.terr && S.terr[iso];
  if (!t || ownerOf(iso) !== S.player) return { ok: false, text: 'Not one of your territories.' };
  if (!POSTURES[key]) return { ok: false, text: 'Unknown posture.' };
  if (t.posture === key) return { ok: true, text: 'Already set.' };
  const need = pcCost(1);
  if (S.pc < need) return { ok: false, text: 'Reorganising the administration costs ' + need + ' political capital, and you do not have it.' };
  S.pc -= need; t.posture = key;
  if (key === 'garrison' && isDemo(me().gov)) { me().free = clamp(me().free - 1, 0, 100); }
  logPlayer('Posture in ' + nm(iso) + ' set to ' + POSTURES[key].n.toLowerCase() + '.');
  return { ok: true, text: nm(iso) + ': ' + POSTURES[key].n + '.' };
}

function empireList() {
  return terrOf(S.player).map(t => {
    const p = POSTURES[t.posture];
    const risk = t.unrest > 85 ? 'Breakaway likely' : t.unrest > 68 ? 'Revolt risk' : t.unrest > 50 ? 'Restless' : t.unrest > 30 ? 'Sullen' : 'Calm';
    return { iso: t.iso, name: nm(t.iso), integ: t.integ, unrest: t.unrest, posture: t.posture, postureName: p.n, risk, pop: t.pop, gdp: t.gdp * t.cred, fullGdp: t.gdp * (0.35 + 0.55), months: S.turn - t.since, autonomy: t.autonomy, cost: terrAnnual(t), costPct: terrAnnual(t) * 100 / Math.max(1, C(ownerOf(t.iso)).gdp) };
  }).sort((a, b) => b.unrest - a.unrest);
}

// bring old saves (annexations made before this system existed) into the new one
function terrMigrate() {
  if (!S.terr) S.terr = {};
  Object.keys(S.owner).forEach(iso => {
    if (S.owner[iso] !== iso && !C(iso).alive && !S.terr[iso]) {
      const holder = S.owner[iso];
      const t = makeTerritory(holder, iso, -30);
      t.integ = 30; t.unrest = 45; t.cred = terrFrac(t); t.armyDone = false;
      S.terr[iso] = t;
    }
  });
}
