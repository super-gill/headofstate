// ===================== NATIONAL PROJECTS =====================
// Long programmes that run for two or three years. They cost money every month, throw up decisions
// along the way, and pay off at the end according to how well you looked after them.

const PROJECTS = {
  rail: { n: 'Rail and power grid programme', d: 'A long build. Raises growth and infrastructure for years once finished.', dur: 30, cost: 0.35, pc: 2, gate: c => c.gdp / c.pop > 1.2 ? '' : 'Too poor to fund a programme this size.',
    snag: 'The contractor says the tunnelling costs are far above the bid, and three regional governors want the line rerouted through their towns.',
    pol: c => isDemo(c.gov) ? 'Land purchases are stalling in court and opposition MPs are calling the project a vanity scheme.' : 'Land purchases are stalling in court, and ' + legTerm(c) + ' are grumbling that the project is a vanity scheme.',
    pay: (c, q) => { addMod(c, 'growth', 0.35 + 0.9 * q, 72); c.infraIdx = clamp(c.infraIdx + 6 + 10 * q, 0, 100); fac(c, 'business', 2 + 4 * q); return 'The new lines open. Freight moves faster and firms plan for the long term.'; } },
  milmod: { n: 'Military modernisation', d: 'New equipment and training. The army is stronger and more ready when it is done.', dur: 24, cost: 0.3, pc: 2, gate: c => c.army > 0.3 ? '' : 'No real army to modernise.',
    snag: 'A flagship weapons contract is running late and over budget. The generals say cutting it would leave the army half-equipped.',
    pol: 'A defence firm has been caught overcharging, and rival services are fighting over which one gets the new kit.',
    pay: (c, q) => { c.army *= 1.06 + 0.1 * q; c.readiness = clamp(c.readiness + 6 + 8 * q, 10, 100); fac(c, 'military', 3 + 4 * q); c.prest = clamp(c.prest + 1 + 2 * q, 0, 100); return 'The first modern brigades parade for the cameras. The high command is delighted.'; } },
  clean: { n: 'Clean government drive', d: 'Audit the state, prosecute the crooked, and reform procurement. Makes enemies in your own camp.', dur: 24, cost: 0.12, pc: 3, gate: c => c.corr > 25 ? '' : 'Corruption is already low.',
    snag: 'The audit has reached your own party. Powerful figures are asking you to stop, and some are hinting at what happens if you do not.',
    pol: 'A prosecution has collapsed on a technicality. Critics say the whole drive is a show trial of your rivals.',
    pay: (c, q) => { c.corr = clamp(c.corr - (5 + 9 * q), 0, 100); c.free = clamp(c.free + 1 + 2 * q, 0, 100); c.prest = clamp(c.prest + 1 + 2 * q, 0, 100); ap(c, 2 + 3 * q, 6); return 'A landmark report is published and the first big trials end in convictions. Public trust improves.'; } },
  health: { n: 'Health and pensions overhaul', d: 'A slow reform that people feel in their daily lives. Popular when it works.', dur: 30, cost: 0.3, pc: 2, gate: c => c.spend.social > 3 ? '' : 'There is too little of a system to overhaul.',
    snag: 'Doctors are threatening to walk out over the reform, and the pension fund numbers are worse than the ministry told you.',
    pol: c => isDemo(c.gov) ? 'A leaked memo suggests some benefits will be cut. The opposition is calling it a betrayal of pensioners.' : 'A leaked memo suggests some benefits will be cut, and ' + legTerm(c) + ' are calling it a betrayal.',
    pay: (c, q) => { addMod(c, 'appr', 2 + 4 * q, 60); addMod(c, 'stab', 1 + 2 * q, 60); ap(c, 3 + 3 * q, 6); return 'The reformed system launches. Waiting lists shorten and the first families feel the difference.'; } },
  skills: { n: 'Schools and skills programme', d: 'Training, universities and technical colleges. Slow, but it lifts growth and employment for a generation.', dur: 36, cost: 0.25, pc: 2, gate: c => c.gdp / c.pop > 0.8 ? '' : 'Too poor to fund a programme this size.',
    snag: 'Teachers want more pay, universities want more funds, and the ministry cannot agree on what to do first.',
    pol: 'A curriculum fight has broken out, and parents are angry about how the new schools were sited.',
    pay: (c, q) => { addMod(c, 'growth', 0.3 + 0.8 * q, 96); c.unemp = Math.max(1.5, c.unemp - (0.5 + 1.2 * q)); c.tech = Math.min(5, c.tech + (q > 0.7 && c.tech < 5 && chance(0.4) ? 1 : 0)); return 'The first graduates of the new colleges enter the workforce. Employers notice.'; } },
  space: { n: 'Space and technology programme', d: 'A prestige project. Costly and slow, but it lifts standing at home and abroad.', dur: 30, cost: 0.3, pc: 2, gate: c => c.gdp > 400 ? '' : 'The economy is too small.',
    snag: 'A test launch has failed and the programme is a year behind. Reporters want to know where the money went.',
    pol: 'Critics ask why so much is being spent on rockets while hospitals are short. A rival power has announced a bigger programme.',
    pay: (c, q) => { c.prest = clamp(c.prest + 3 + 6 * q, 0, 100); ap(c, 2 + 3 * q, 6); addMod(c, 'growth', 0.1 + 0.25 * q, 48); c.tech = Math.min(5, c.tech + (q > 0.75 && chance(0.35) ? 1 : 0)); return 'A successful mission is watched across the world. Your country has arrived.'; } },
};
const maxProjects = c => 2 + (c.flags && c.flags.thirdSlot ? 1 : 0);

function projEnsure() { if (!S.projects) S.projects = []; if (!S.projDone) S.projDone = {}; }
function projActive() { projEnsure(); return S.projects; }
function projectCostPct(c) {
  if (c.iso !== S.player || !S.projects) return 0;
  return S.projects.reduce((s, p) => s + PROJECTS[p.kind].cost * (p.funded === false ? 0 : 1), 0);
}
function projectList() {
  projEnsure(); const c = me(); const MAX_PROJECTS = maxProjects(c);
  return Object.keys(PROJECTS).map(k => {
    const d = PROJECTS[k]; const on = S.projects.find(p => p.kind === k); const need = pcCost(d.pc);
    let why = on ? 'Already under way.' : d.gate(c);
    if (!why && S.projDone[k] && S.turn - S.projDone[k] < 36) why = 'Finished recently. Give it time.';
    if (!why && S.projects.length >= MAX_PROJECTS) why = 'You can only run ' + MAX_PROJECTS + ' programmes at once.';
    if (!why && S.pc < need) why = 'Not enough political capital.';
    return { id: k, name: d.n, desc: d.d, months: d.dur, cost: d.cost, pc: need, ok: !why, why, on: !!on };
  });
}
function projectStatus() {
  projEnsure();
  return S.projects.map(p => {
    const d = PROJECTS[p.kind]; const pct = Math.min(100, Math.round((S.turn - p.start) / d.dur * 100));
    const q = p.q; const health = q >= 0.7 ? 'On track' : q >= 0.45 ? 'Some trouble' : 'In difficulty';
    return { id: p.kind, name: d.n, pct, left: Math.max(0, d.dur - (S.turn - p.start)), health, q, cost: d.cost * (p.funded === false ? 0 : 1), paused: p.funded === false };
  });
}
function startProject(k) {
  const info = projectList().find(x => x.id === k); if (!info) return { ok: false, text: 'Unknown programme.' };
  if (!info.ok) return { ok: false, text: info.why };
  S.pc -= info.pc; projEnsure();
  S.projects.push({ kind: k, start: S.turn, q: 0.7, funded: true, snagged: false, polled: false, id: 'pj' + S.turn + k });
  logPlayer('Launched: ' + PROJECTS[k].n + '.');
  return { ok: true, text: PROJECTS[k].n + ' is under way. It will run for about ' + mo(PROJECTS[k].dur) + '.' };
}
function cancelProject(k) {
  projEnsure(); const p = S.projects.find(x => x.kind === k); if (!p) return { ok: false, text: 'Not running.' };
  S.projects = S.projects.filter(x => x !== p);
  const prog = (S.turn - p.start) / PROJECTS[k].dur;
  ap(me(), -1 - 3 * prog, 5); fac(me(), 'business', -1); S.stat.projCancelled = (S.stat.projCancelled || 0) + 1;
  logPlayer('Cancelled: ' + PROJECTS[k].n + '.');
  return { ok: true, text: PROJECTS[k].n + ' is cancelled. What was spent is gone.' };
}
function projectStep() {
  projEnsure(); const c = me();
  S.projects.slice().forEach(p => {
    const d = PROJECTS[p.kind], age = S.turn - p.start;
    // starved treasury and unrest slowly wear a project down
    if (c.treasury <= 0 && c.debtAbs > c.gdp * 0.9) p.q = Math.max(0.05, p.q - 0.004);
    if (c.stab < 30) p.q = Math.max(0.05, p.q - 0.004);
    const pending = S.events.some(e => e.ctx && e.ctx.pj === p.id);
    if (!p.snagged && age >= Math.floor(d.dur * 0.38) && !pending && S.events.length < 3) { p.snagged = true; queueEvent('projectSnag', { pj: p.id, k: p.kind }); }
    else if (!p.polled && age >= Math.floor(d.dur * 0.7) && !pending && S.events.length < 3) { p.polled = true; queueEvent('projectPolitics', { pj: p.id, k: p.kind }); }
    else if (age >= d.dur && !pending && S.events.length < 3) { queueEvent('projectDone', { pj: p.id, k: p.kind, q: p.q }); p.finishing = true; }
  });
}
const projOf = x => { projEnsure(); return S.projects.find(p => p.id === x.pj) || null; };

ev('projectSnag', { cat: 'story',
  title: x => PROJECTS[x.k].n + ': trouble', text: x => PROJECTS[x.k].snag,
  options: x => { const p = projOf(x); if (!p) return [opt('Continue', '', () => 'Done.')]; return [
    opt('Fund the overrun', 'Costs 0.4% of GDP. Keeps quality high.', () => { spendPct(me(), 0.4); p.q = Math.min(1, p.q + 0.18); return 'The extra money is found and work resumes. The project is back on track.'; }),
    opt('Cut the scope', 'Free, but the end result will be weaker.', () => { p.q = Math.max(0.05, p.q - 0.2); ap(me(), 1, 2); return 'The plans are trimmed. It will still be finished, just not as grand as promised.'; }),
    opt('Push on and hope', 'Chance it sorts itself out. Otherwise it gets worse.', () => { if (chance(0.4)) { p.q = Math.min(1, p.q + 0.05); return 'Against the odds, the problems are solved without new money.'; } p.q = Math.max(0.05, p.q - 0.15); ap(me(), -2, 4); return 'The problems get worse and the press notices. The project slips further.'; }),
  ]; } });

ev('projectPolitics', { cat: 'story',
  title: x => PROJECTS[x.k].n + ': under fire', text: x => { const p = PROJECTS[x.k].pol; return typeof p === 'function' ? p(me()) : p; },
  options: x => { const p = projOf(x); if (!p) return [opt('Continue', '', () => 'Done.')]; const can = S.pc >= pcCost(1); return [
    opt('Defend it in public', 'Costs 1 political capital. Protects it and your standing.', () => { S.pc -= pcCost(1); p.q = Math.min(1, p.q + 0.08); ap(me(), 1, 3); return 'You make the case in person and the criticism loses some of its force.'; }, can ? {} : { ok: false, why: 'Not enough political capital.' }),
    opt('Let it ride', 'Nothing spent. The critics get their say.', () => { ap(me(), -1, 3); if (chance(0.35)) p.q = Math.max(0.05, p.q - 0.08); return 'The row runs for a few weeks. Some of the mud sticks.'; }),
    opt('Order a quiet review', 'Costs 0.1% of GDP. Delays the finish by three months but steadies things.', () => { spendPct(me(), 0.1); p.start += 3; p.q = Math.min(1, p.q + 0.04); return 'An independent review is announced. The heat goes out of the row, and the finish date slips a little.'; }),
  ]; } });

ev('projectDone', { cat: 'story',
  title: x => PROJECTS[x.k].n + ': complete',
  text: x => x.q >= 0.75 ? 'After a long effort, the project is finished, and finished well. Officials are asking who will cut the ribbon.' : x.q >= 0.45 ? 'The project is finished at last. It is not everything that was promised, but it works.' : 'The project is finally declared complete, years late in spirit if not on paper. Much of the original promise was lost along the way.',
  options: x => { const p = projOf(x); const q = p ? p.q : x.q; const fin = () => { S.projects = S.projects.filter(z => z.id !== x.pj); S.projDone[x.k] = S.turn; S.stat.projDone = (S.stat.projDone || 0) + 1; };
    return [
      opt('Hold a big opening', 'Costs 1 political capital. Full payoff, plus a bump in approval.', () => { S.pc = Math.max(0, S.pc - pcCost(1)); fin(); const t = withSrc(PROJECTS[x.k].n, () => PROJECTS[x.k].pay(me(), q)); ap(me(), 2 + 3 * q, 6); logPlayer(PROJECTS[x.k].n + ' completed.'); return t + ' You take the credit, and the public sees it.'; }, S.pc >= pcCost(1) ? {} : { ok: false, why: 'Not enough political capital.' }),
      opt('Let it open quietly', 'Full payoff, no fuss.', () => { fin(); const t = withSrc(PROJECTS[x.k].n, () => PROJECTS[x.k].pay(me(), q)); logPlayer(PROJECTS[x.k].n + ' completed.'); return t; }),
    ]; } });

Object.assign(Engine, { PROJECTS: () => PROJECTS, projectList, projectStatus, startProject, cancelProject });
