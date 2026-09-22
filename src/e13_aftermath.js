// ===================== AFTER THE WAR =====================
// Wars leave bills. Countries that fought have to rebuild, refugees move to neighbours, and governments
// installed by force are fragile.

function aftermath(w, winnerSide, months) {
  const involved = ['a', 'b'];
  involved.forEach(side => {
    const lost = winnerSide && side !== winnerSide;
    w[side].forEach((i, k) => {
      const c = C(i); if (!c || !c.alive) return;
      const lead = i === w.lead[side];
      const sev = clamp((0.05 + Math.min(0.4, months * 0.012) + (w.intensity - 1) * 0.08 + (lost ? 0.22 : 0.04)) * (lead ? 1 : 0.35), 0.02, 0.85);
      if (sev < 0.08) return;
      c.flags.recon = Math.max(c.flags.recon || 0, sev);
      withSrc('Rebuilding after the war', () => addMod(c, 'growth', -sev * 2.5, 24));
      if (i === S.player && sev >= 0.22 && (winnerSide || months >= 4)) queueEvent('rebuildBill', { sev: Math.round(sev * 100) / 100, lost: !!lost, draw: !winnerSide });
    });
  });
  // regime installed by force stays fragile for a while
  // (marked by finishWar after the terms are known)
}
function markPuppet(lose, win) { const c = C(lose); c.flags.puppet = { by: win, until: S.turn + 30 }; c.stab = clamp(c.stab - 6, 2, 99); }

function aftermathStep() {
  sanctionsExpire(); supportCleanup();
  aliveList().forEach(i => {
    const c = C(i);
    if (c.flags.recon) { c.flags.recon *= 0.975; if (c.flags.recon < 0.03) c.flags.recon = 0; }
    const pp = c.flags.puppet;
    if (pp) {
      if (S.turn > pp.until || !alive(pp.by)) { delete c.flags.puppet; return; }
      c.stab = clamp(c.stab - 0.3, 2, 99);
      if (c.stab < 24 && chance(0.05)) {
        delete c.flags.puppet; regimeChange(c, 'ousted'); addR(i, pp.by, -45); addR(S.player, pp.by, pp.by === S.player ? 0 : -1);
        news('The government ' + nm(pp.by) + ' installed in ' + nm(i) + ' has been overthrown.', 'politics', i);
        if (pp.by === S.player) { me().prest = clamp(me().prest - 3, 0, 100); logPlayer('The government you installed in ' + nm(i) + ' has fallen.'); }
      } else if (pp.by === S.player && c.stab < 32 && S.turn - (pp.lastEv || -99) >= 8 && S.events.length < 2 && chance(0.2)) {
        pp.lastEv = S.turn; queueEvent('puppetWobbles', { t: i });
      }
    }
  });
}

// ---- reconstruction aid as a diplomatic action ----
const rebuildCost = t => clamp(C(t).gdp * 0.004, 0.05, 40);
{ const d = {
    id: 'rebuild', cat: 'economic', label: 'Fund reconstruction', pc: 1, cost: t => rebuildCost(t), desc: 'Pay to rebuild a war-torn country. Wins lasting goodwill and helps their recovery.',
    avail: t => enemyWarWith(S.player, t) ? 'At war.' : !(C(t).flags.recon > 0.2) ? 'They are not rebuilding from a war.' : me().treasury < rebuildCost(t) ? 'Treasury too low.' : null,
    run: t => { const c = C(t); addR(S.player, t, 14); c.flags.recon = Math.max(0, (c.flags.recon || 0) - 0.15); withSrc('Reconstruction aid', () => addMod(c, 'growth', 0.6, 12)); c.stab = clamp(c.stab + 3, 0, 99); me().prest = clamp(me().prest + 2, 0, 100); S.stat.rebuilt = (S.stat.rebuilt || 0) + 1; return 'Your money and engineers help rebuild ' + nm(t) + '. Relations +14, and the world notices.'; },
  };
  DIPS.push(d); DIPS_BY[d.id] = d; }

// ---- events ----
ev('rebuildBill', { cat: 'story',
  title: x => x.lost ? 'The bill for a lost war' : x.draw ? 'The cost of the war' : 'The cost of victory',
  text: x => (x.lost ? 'The fighting has stopped, but much of your infrastructure lies in ruins and the treasury is drained. ' : x.draw ? 'The war ended in a ceasefire, but it has left damaged roads, ports and power lines, and thousands of veterans needing care. ' : 'You won, but the war has left damaged roads, ports and power lines, and thousands of veterans needing care. ') + 'The reconstruction bill is coming due. How you handle it will shape the next few years.',
  options: x => [
    sOpt('Borrow to rebuild quickly', 'Adds to debt, shortens the slump.', () => { me().debtAbs += me().gdp * (0.02 + x.sev * 0.08); me().flags.recon = (me().flags.recon || 0) * 0.5; withSrc('Rebuilding after the war', () => addMod(me(), 'growth', x.sev * 1.6, 18)); return 'A reconstruction loan is floated. The rebuilding starts within weeks, and so does the interest.'; }),
    sOpt('Fund it from the budget', 'Costs 0.6% of GDP now. Balanced.', () => { spendPct(me(), 0.6); me().flags.recon = (me().flags.recon || 0) * 0.7; withSrc('Rebuilding after the war', () => addMod(me(), 'growth', x.sev * 0.9, 18)); ap(me(), -1, 4); return 'Money is diverted from other programmes. The recovery is steady, if unspectacular.'; }),
    sOpt('Appeal to friends for help', 'Cheap, but you owe a favour.', () => { const f = friends(S.player, 25).filter(i => C(i).gdp > 80).slice(0, 3); f.forEach(i => addR(S.player, i, 3)); me().flags.recon = (me().flags.recon || 0) * 0.75; withSrc('Rebuilding after the war', () => addMod(me(), 'growth', x.sev * 1.0, 18)); me().prest = clamp(me().prest - 1, 0, 100); return f.length ? 'Aid arrives from ' + f.map(nm).join(', ') + '. It comes with expectations.' : 'You find few willing donors, and rebuild slowly.'; }),
    sOpt('Let it take its course', 'No cost. The slump runs long.', () => { ap(me(), -2, 6); return 'You say the country will recover in its own time. It will, eventually.'; }),
  ] });
ev('puppetWobbles', { cat: 'story',
  title: x => 'The government you installed in ' + nm(x.t) + ' is wobbling',
  text: x => 'The regime you put in place in ' + nm(x.t) + ' has little popular support, and its own officers are restless. Your ambassador warns it may not last the year without help.',
  options: x => [
    sOpt('Send money and advisers', 'Costs 0.3% of GDP. Stabilises them.', () => { spendPct(me(), 0.3); C(x.t).stab = clamp(C(x.t).stab + 8, 2, 99); addR(S.player, x.t, 4); return 'Cash and advisers arrive, and the regime steadies.'; }),
    sOpt('Station troops there', 'Costs 1 PC. Strong signal, and a commitment.', () => { S.pc -= pcCost(1); C(x.t).stab = clamp(C(x.t).stab + 12, 2, 99); me().prest = clamp(me().prest - 2, 0, 100); aliveList().forEach(i => { if (i !== S.player && isDemo(C(i).gov)) addR(S.player, i, -2); }); return 'A garrison is dispatched. Order returns to the capital, and so does a sense of occupation.'; }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
    sOpt('Let it sink or swim', 'Save your resources. It may fall.', () => { return 'You keep your distance. The regime is on its own.'; }),
  ] });

// refugees become a storyline
STORIES.refugees = { name: s => 'Refugees from ' + nm(s.data.o), stages: ['refugeeOutcome'], status: () => 'Newcomers are settling. Public reaction is forming.' };
hookOption('refugees', /^(Open the borders|Controlled admission)/, x => startStory('refugees', { o: x.o, open: true }, 7, 12));
ev('refugeeOutcome', { cat: 'story',
  title: x => x.backlash ? 'Backlash over the refugees from ' + nm(x.o) : 'The refugees from ' + nm(x.o) + ' are settling in',
  text: x => x.backlash ? 'Months after the border opened, a populist campaign against the newcomers is gathering pace. Local services are stretched, and stories of tension are filling the papers.' : 'The newcomers are finding work and starting businesses. Local employers say they cannot manage without them, and the early fears have faded.',
  enter: x => { if (x.backlash == null) x.backlash = chance(0.3 + (me().unemp > me().baseUnemp + 2 ? 0.25 : 0) + (isDemo(me().gov) ? 0.05 : 0)); },
  options: x => x.backlash ? [
    sOpt('Invest in integration', 'Costs 0.3% of GDP. Defuses it.', () => { spendPct(me(), 0.3); ap(me(), -1, 4); st(me(), 1, 6); endStory(x.sid); return 'Language classes, housing and job schemes take the heat out of it.'; }),
    sOpt('Tighten the rules', 'Popular with critics, unpopular abroad.', () => { ap(me(), 2, 5); me().prest = clamp(me().prest - 2, 0, 100); addR(S.player, x.o, -3); endStory(x.sid); return 'New limits on admissions calm the debate, and disappoint aid groups.'; }),
    sOpt('Hold your nerve', 'Risky.', () => { ap(me(), -4, 6); fac(me(), 'party', -2); endStory(x.sid); return 'You defend your policy. The controversy rumbles on and costs you support.'; }),
  ] : [
    sOpt('Take credit', 'Your generosity pays off.', () => { ap(me(), 2, 6); me().prest = clamp(me().prest + 2, 0, 100); withSrc('Refugee workers', () => addMod(me(), 'growth', 0.15, 18)); endStory(x.sid); return 'The economy gains workers, and you gain a reputation for decency.'; }),
  ] });

Object.assign(Engine, {});
