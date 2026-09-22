// ---------------- EMPIRE EVENTS (queued directly by terrStep) ----------------
const terrRow = x => (S.terr && S.terr[x.t]) || null;

ev('terrInsurgency', { cat: 'system',
  title: x => 'Insurgency in ' + nm(x.t),
  text: x => { const t = terrRow(x); const own = t && t.revolts > 1 ? ' This is not the first time.' : '';
    const flavour = [
      'Armed cells in ' + nm(x.t) + ' have begun attacking your garrisons and administrators. Checkpoints are burning and the local population is sheltering the fighters.',
      'A campaign of bombings and ambushes has started in ' + nm(x.t) + '. Local officials you installed are being murdered, and the rest are asking for protection.',
      'Strikes, riots and sniper attacks have spread across ' + nm(x.t) + '. Your governor says the province is slipping out of control.'][x.v % 3];
    return flavour + own + ' Your generals want orders.'; },
  options: x => {
    const t = terrRow(x); if (!t) return [opt('Continue', '', () => 'Done.')];
    const dem = isDemo(me().gov);
    return [
      opt('Crack down hard', 'Cuts unrest quickly. Costs liberty, approval and standing abroad.', () => { t.unrest = Math.max(0, t.unrest - 22); t.integ = Math.max(0, t.integ - 4); ap(me(), dem ? -5 : -1, 5); me().free = clamp(me().free - 3, 0, 100); me().prest = clamp(me().prest - 2, 0, 100); fac(me(), 'military', 3); S.stat.casualties += 1; return 'Troops sweep ' + nm(x.t) + '. The attacks fade for now, along with whatever goodwill was left.'; }),
      opt(t.autonomy ? 'Autonomy already granted' : 'Offer autonomy', t.autonomy ? '' : 'Permanently calms the province and lowers its resentment. Its economy counts a little less, and hardliners resent it.', () => { t.autonomy = true; t.nat = Math.max(15, t.nat - 8); t.unrest = Math.max(0, t.unrest - 18); fac(me(), 'party', -3); fac(me(), 'military', -2); return 'A limited home rule deal is announced. Moderates in ' + nm(x.t) + ' take it and the fighters lose their audience.'; }, t.autonomy ? { ok: false, why: 'Already granted.' } : {}),
      opt('Emergency investment', 'Costs 0.4% of GDP. Reduces unrest and speeds integration.', () => { spendPct(me(), 0.4); t.unrest = Math.max(0, t.unrest - 12); t.integ = Math.min(100, t.integ + 6); return 'Aid, jobs and reconstruction money flow into ' + nm(x.t) + '. It buys time, and some loyalty.'; }),
      opt('Hold the line', 'Do nothing new. The problem may grow.', () => { t.unrest = Math.min(100, t.unrest + 4); if (chance(0.4)) { st(me(), -4, 5); return 'The attacks continue. Your generals grumble, and the press asks why the conquest is not paying for itself.'; } return 'The violence rumbles on without a decisive turn.'; }),
    ];
  } });

ev('terrSecession', { cat: 'system',
  title: x => nm(x.t) + ' declares independence',
  text: x => 'A provisional government in ' + nm(x.t) + ' has proclaimed independence from your rule. Crowds have taken the administrative buildings, and local units have stopped taking orders. Whatever you decide, decide quickly.',
  options: x => {
    const t = terrRow(x); if (!t) return [opt('Continue', '', () => 'Done.')];
    const me_ = me(), L = C(x.t);
    const p = clamp(0.32 + (me_.army / Math.max(0.05, L.army * 2 + 0.2)) * 0.12 + (t.posture === 'garrison' ? 0.12 : 0) + (me_.mob * 0.05), 0.15, 0.85);
    const pcN = 2, can = S.pc >= pcCost(pcN);
    return [
      opt('Send in the army', 'About ' + Math.round(p * 100) + '% to hold it. Failure ends in independence and humiliation. (' + pcCost(pcN) + ' PC)', () => {
        S.pc -= pcCost(pcN);
        if (chance(p)) { t.unrest = 55; t.integ = Math.max(0, t.integ - 10); me_.prest = clamp(me_.prest - 3, 0, 100); fac(me_, 'military', 4); ap(me_, isDemo(me_.gov) ? -3 : 1, 5); S.stat.casualties += 2; return 'Your troops retake the buildings and arrest the leaders. ' + nm(x.t) + ' is yours again, for now.'; }
        secede(t, 'revolt'); st(me_, -5, 6); ap(me_, -4, 6); fac(me_, 'military', -4); return 'The army is beaten back or refuses to fire. ' + nm(x.t) + ' is independent, and your rivals are watching how you handle it.';
      }, can ? {} : { ok: false, why: 'Not enough political capital.' }),
      opt(t.autonomy ? 'Autonomy already granted' : 'Grant sweeping autonomy', t.autonomy ? '' : 'Keeps the province in exchange for near self-rule. Hardliners will not forgive it.', () => { t.autonomy = true; t.nat = Math.max(15, t.nat - 12); t.unrest = 50; fac(me_, 'party', -5); fac(me_, 'military', -3); me_.prest = clamp(me_.prest - 2, 0, 100); return 'A hurried deal keeps ' + nm(x.t) + ' under your flag on paper. In practice it now runs itself.'; }, t.autonomy ? { ok: false, why: 'Already granted. They want more.' } : {}),
      opt('Let them go', 'Accept the loss. A quieter ending, and no more bloodshed.', () => { secede(t, 'revolt'); ap(me_, isDemo(me_.gov) ? 1 : -2, 4); return nm(x.t) + ' is independent again. The empire you built has shrunk, and the war that won it now looks pointless.'; }),
    ];
  } });
