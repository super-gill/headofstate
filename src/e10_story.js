// ===================== STORYLINES AND PLEDGES =====================
// Some decisions start something that comes back later. A scandal you stonewall gets worse, a border
// clash you answered with force becomes a standoff, and a promise you made falls due.

function storyEnsure() { if (!S.stories) S.stories = []; if (!S.pledges) S.pledges = []; if (!S.storySeq) S.storySeq = 0; }
function startStory(kind, data, dmin, dmax) {
  storyEnsure();
  const d = dmin + Math.floor(rnd() * (dmax - dmin + 1));
  S.stories.push({ id: 's' + (++S.storySeq), kind, stage: 0, data: data || {}, next: S.turn + d, started: S.turn, waiting: false });
}
const storyById = id => { storyEnsure(); return S.stories.find(s => s.id === id) || null; };
function advanceStory(id, dmin, dmax, patch) { const s = storyById(id); if (!s) return; s.stage++; s.waiting = false; s.next = S.turn + dmin + Math.floor(rnd() * ((dmax == null ? dmin : dmax) - dmin + 1)); if (patch) Object.assign(s.data, patch); }
function endStory(id) { storyEnsure(); S.stories = S.stories.filter(s => s.id !== id); }

const STORIES = {
  scandal: { name: s => 'The ' + s.data.minister.split(' ').pop() + ' affair', stages: ['scandalDeepens', 'scandalVerdict'], status: s => s.stage === 0 ? 'Documents are circulating. The press is digging.' : 'An inquiry is under way.' },
  border: { name: s => (s.data.sea ? 'Waters standoff with ' : 'Border standoff with ') + nm(s.data.o), stages: ['borderStandoff', 'borderBreaking'], status: s => s.stage === 0 ? 'Forces are massing on both sides.' : 'The crisis is coming to a head.' },
  generals: { name: () => 'The generals\' ultimatum', stages: ['generalsUltimatum'], status: () => 'The high command is running out of patience.' },
};

function storyStep() {
  storyEnsure();
  S.stories.slice().forEach(s => {
    const def = STORIES[s.kind]; if (!def) { endStory(s.id); return; }
    const pending = S.events.some(e => e.ctx && e.ctx.sid === s.id);
    if (s.waiting) { if (!pending) endStory(s.id); return; }
    if (S.turn < s.next || S.events.length >= 3) return;
    const evId = def.stages[s.stage]; if (!evId) { endStory(s.id); return; }
    if (s.data.o && !alive(s.data.o)) { endStory(s.id); return; }
    s.waiting = true;
    queueEvent(evId, Object.assign({ sid: s.id }, s.data, { stage: s.stage }));
  });
  // pledges
  S.pledges.slice().forEach(p => {
    if (S.turn < p.due || S.events.some(e => e.id === 'pledgeResult' && e.ctx.pid === p.id)) return;
    const c = me(); let kept = true;
    if (p.kind === 'noTaxRise') kept = c.tax <= p.base + 0.6;
    else if (p.kind === 'holdDefence') kept = c.spend.mil >= p.base - 0.15;
    else if (p.kind === 'balanceBudget') { const f = fiscalCalc(c); kept = (f.rev - f.spend) * 1200 / c.gdp >= -2; }
    S.pledges = S.pledges.filter(x => x !== p);
    queueEvent('pledgeResult', { pid: p.id, kind: p.kind, kept });
  });
}
function addPledge(kind, months) {
  storyEnsure(); const c = me();
  S.pledges = S.pledges.filter(p => p.kind !== kind);
  S.pledges.push({ id: 'p' + (++S.storySeq), kind, made: S.turn, due: S.turn + months, base: kind === 'noTaxRise' ? c.tax : c.spend.mil });
}
const PLEDGE_TXT = { noTaxRise: 'No tax rises', holdDefence: 'Keep defence spending up', balanceBudget: 'Bring the deficit under 2% of GDP' };
const pledgeFac = k => (k === 'noTaxRise' || k === 'balanceBudget') ? 'business' : 'military';
function storyList() {
  storyEnsure();
  const out = S.stories.map(s => { const d = STORIES[s.kind]; return d ? { kind: 'story', name: d.name(s), status: d.status(s), months: S.turn - s.started } : null; }).filter(Boolean);
  S.pledges.forEach(p => out.push({ kind: 'pledge', name: 'Pledge: ' + PLEDGE_TXT[p.kind], status: 'Due in ' + mo(Math.max(0, p.due - S.turn)) + '.', months: S.turn - p.made }));
  return out;
}

// hook an option of an existing event so that choosing it starts a storyline
function hookOption(evId, re, fn) {
  const d = EVENTS[evId]; if (!d) return; const orig = d.options;
  d.options = x => orig(x).map(o => re.test(o.label) ? Object.assign({}, o, { run: (...a) => { const r = o.run(...a); fn(x, r); return r; } }) : o);
}
hookOption('scandal', /^Defend them/, x => startStory('scandal', { minister: x.minister, aid: x.aid, mrole: x.mrole, guilt: 1 }, 2, 4));

hookOption('borderIncident', /^Retaliate/, x => startStory('border', { o: x.o, esc: 2 }, 2, 3));
hookOption('borderIncident', /^Reinforce the border/, x => { if (chance(0.55)) startStory('border', { o: x.o, esc: 1 }, 2, 4); });
hookOption('seaDispute', /^Press your claim/, x => { if (chance(0.7)) startStory('border', { o: x.o, esc: 1, sea: true }, 2, 4); });
hookOption('milDemand', /^Refuse/, () => startStory('generals', {}, 5, 8));
hookOption('milDemand', /^Raise defence spending/, () => addPledge('holdDefence', 24));
hookOption('campaign', /^(Big spending|Give-away)/, () => addPledge('noTaxRise', 30));

// ---------------- STORY EVENTS ----------------
const sOpt = (label, hint, run, extra) => opt(label, hint, run, extra);
ev('scandalDeepens', { cat: 'story',
  title: x => 'New documents in the ' + x.minister.split(' ').pop() + ' affair',
  text: x => 'The scandal around ' + (x.mrole && ROLES[x.mrole] ? 'your ' + ROLES[x.mrole].title.toLowerCase() + ' ' : 'your minister ') + x.minister + ' has not gone away. A newspaper has published documents that suggest the original story was only part of it, and your own ' + legTerm(me()) + ' are asking what you knew.' + (x.guilt >= 2 ? ' The documents look genuinely damaging.' : ''),
  options: x => [
    sOpt('Sack them now', 'Cuts it short. They leave the cabinet. Your party will grumble.', () => { ap(me(), -1, 3); fac(me(), 'party', -1); endStory(x.sid); const r = dismissMinister(x.aid, 'sacked'); return (r ? dismissText(r) : x.minister + ' is gone.') + ' The story fades within a fortnight.'; }),
    sOpt('Stonewall', 'Cheap if it works. Costly if it does not.', () => { if (chance(x.guilt >= 2 ? 0.25 : 0.5)) { endStory(x.sid); return 'You say nothing new, and the news cycle moves on.'; } advanceStory(x.sid, 3, 4, { guilt: x.guilt + 1 }); ap(me(), -2, 4); return 'The press refuses to drop it. A formal inquiry is now being demanded.'; }),
    sOpt('Ask a judge to review it', 'Buys time. Outcome uncertain.', () => { advanceStory(x.sid, 4, 5); return 'A retired judge is appointed to review the affair. He will report in a few months.'; }),
  ] });
ev('scandalVerdict', { cat: 'story',
  title: x => x.result === 'clear' ? 'The ' + x.minister.split(' ').pop() + ' affair: cleared' : 'The ' + x.minister.split(' ').pop() + ' affair: damning report',
  text: x => x.result === 'clear' ? 'The review has cleared ' + x.minister + ' of the most serious allegations. ' + (isDemo(me().gov) ? 'The opposition says it' : oppTerm(me())[0].toUpperCase() + oppTerm(me()).slice(1) + ' say it') + ' is a whitewash, but the story has lost its force.' : 'The review is damning. It finds that ' + x.minister + ' misled you and covered it up, and that warnings were ignored. The question now is whether you knew.',
  options: x => x.result === 'clear' ? [
    sOpt('Press the advantage', 'Attack the accusers. A small popularity boost.', () => { ap(me(), 3, 5); endStory(x.sid); return 'You use the verdict to paint ' + oppTerm(me()) + ' as opportunists. It lands.'; }),
    sOpt('Move on quietly', 'Let it die.', () => { ap(me(), 1, 3); endStory(x.sid); return 'You say the matter is closed and get on with the job.'; }),
  ] : [
    sOpt('Apologise and let them go', 'Costs a little, and clears the air. They leave the cabinet.', () => { ap(me(), -3, 4); fac(me(), 'party', -1); endStory(x.sid); const r = dismissMinister(x.aid, 'resigned'); return 'You apologise publicly. ' + (r ? dismissText(r) : '') + ' The story has an ending, at least.'; }),
    sOpt('Fight on', 'High risk.', () => { ap(me(), -8, 6); fac(me(), 'party', -4); me().corr = clamp(me().corr + 2, 0, 100); endStory(x.sid); return 'You insist there is nothing to apologise for. Your own side winces.'; }),
  ] });
// the verdict is decided when the stage is queued
{ const d = EVENTS.scandalVerdict; const origEnter = d.enter; d.enter = ctx => { if (!ctx.result) ctx.result = chance(ctx.guilt >= 3 ? 0.1 : ctx.guilt === 2 ? 0.35 : 0.65) ? 'clear' : 'damning'; if (origEnter) origEnter(ctx); }; }

ev('borderStandoff', { cat: 'story',
  title: x => (x.sea ? 'Naval standoff with ' : 'Standoff with ') + nm(x.o),
  text: x => (x.sea ? 'Warships from both countries are now shadowing each other in the disputed waters.' : 'Armour and infantry from ' + nm(x.o) + ' are massing opposite your border, and yours are facing them. Neither side has fired a shot since the incident, and both governments say they will not blink.') + ' Your generals say the next few weeks are dangerous.',
  options: x => [
    sOpt('Match their deployment', 'Costs 0.3% of GDP. Raises the stakes.', () => { spendPct(me(), 0.3); fac(me(), 'military', 3); me().flags.readyBoost = 6; S.world.tension = clamp(S.world.tension + 2, 0, 100); addR(S.player, x.o, -5); advanceStory(x.sid, 2, 3, { esc: x.esc + 1 }); return 'Forces move up to the line. So do theirs.'; }),
    sOpt('Open a back channel', 'About 55% to defuse it. (' + pcCost(2) + ' PC)', () => { S.pc -= pcCost(2); if (chance(0.55)) { addR(S.player, x.o, 10); S.world.tension = clamp(S.world.tension - 2, 0, 100); endStory(x.sid); return 'Quiet talks between intelligence chiefs produce a pullback. Both sides claim it as a win.'; } advanceStory(x.sid, 2, 3, { esc: x.esc + 1 }); return 'The back channel goes nowhere, and someone leaks that it existed.'; }, S.pc >= pcCost(2) ? {} : { ok: false, why: 'Not enough political capital.' }),
    sOpt('Appeal to allies', 'Gets support, and hardens their position.', () => { aliveList().forEach(i => { if (i !== S.player && hasPact(S.player, i)) addR(S.player, i, 3); }); addR(S.player, x.o, -4); me().prest = clamp(me().prest + 1, 0, 100); advanceStory(x.sid, 3, 4); return 'Your allies issue statements of support. ' + nm(x.o) + ' calls it interference.'; }),
    sOpt('Stand down first', 'Ends it. Costs face at home.', () => { ap(me(), -3, 4); me().prest = clamp(me().prest - 2, 0, 100); fac(me(), 'military', -3); addR(S.player, x.o, 8); endStory(x.sid); return 'You order your units back. The crisis ends, and your critics call it weakness.'; }),
  ] });
ev('borderBreaking', { cat: 'story',
  title: x => x.result === 'war' ? nm(x.o) + ' attacks' : 'The standoff with ' + nm(x.o) + ' ends',
  text: x => x.result === 'war' ? 'After weeks of tension, ' + nm(x.o) + ' has crossed the line. Shooting has started, and their government says it was forced to act.' : 'The standoff has run its course. Both sides have quietly pulled back, and each will say it won.',
  options: x => x.result === 'war' ? [sOpt('Prepare to fight', 'The war is on.', () => { endStory(x.sid); if (!warBetween(S.player, x.o)) { startWar(x.o, S.player, { goal: 'humiliate', cb: false }); } return 'Your forces are ordered to defend. Diplomats scramble for a way out.'; })]
    : [sOpt('Take the win', 'A quiet result.', () => { ap(me(), 1, 3); endStory(x.sid); return 'Relations stay cold, but the guns are silent.'; })],
  enter: ctx => { const c = C(ctx.o); const p = clamp(0.1 * ctx.esc + S.world.tension / 400 + (leaderAggr(c) - 0.3) * 0.5, 0.05, 0.65); ctx.result = chance(p) && ctx.esc >= 2 && !warBetween(S.player, ctx.o) ? 'war' : 'thaw'; } });

ev('generalsUltimatum', { cat: 'story',
  title: () => 'The generals give you an ultimatum',
  text: () => 'The top brass have not forgotten that you turned them down. A delegation has told you, courteously and unmistakably, that the armed forces expect a change of policy before the year is out.',
  options: x => [
    sOpt('Give them the budget', 'Raises defence spending by 0.5% of GDP.', () => { me().spend.mil = clamp(me().spend.mil + 0.5, 0.1, 20); fac(me(), 'military', 10); endStory(x.sid); return 'The budget rises, and the delegation withdraws, satisfied.'; }),
    sOpt('Reshuffle the high command', 'Costs 2 PC. Removes the ringleaders, and some goodwill.', () => { S.pc -= pcCost(2); fac(me(), 'military', -4); addMod(me(), 'fmilitary', -3, 6); ap(me(), 1, 3); endStory(x.sid); return 'Three senior officers are retired. The army swallows it, resentfully.'; }, S.pc >= pcCost(2) ? {} : { ok: false, why: 'Not enough political capital.' }),
    sOpt('Call their bluff', 'A gamble.', () => { if (chance(0.55)) { fac(me(), 'military', -2); endStory(x.sid); return 'Nothing happens. The generals had no appetite for a fight.'; } fac(me(), 'military', -12); st(me(), -5, 6); endStory(x.sid); return 'The generals do not bluff. Loyalty in the barracks drains away and the capital feels tense.'; }),
  ] });

ev('pledgeResult', { cat: 'story',
  title: x => x.kept ? 'You kept your promise' : 'Promise broken: ' + PLEDGE_TXT[x.kind].toLowerCase(),
  text: x => x.kept ? 'You promised "' + PLEDGE_TXT[x.kind].toLowerCase() + '", and you have held to it. Your allies point to it as proof that you deliver.' : 'You promised "' + PLEDGE_TXT[x.kind].toLowerCase() + '", and the numbers show you did not hold to it. ' + (isDemo(me().gov) ? 'The opposition' : oppTerm(me())[0].toUpperCase() + oppTerm(me()).slice(1)) + ' is already quoting your own words back at you.',
  options: x => x.kept ? [
    sOpt('Take the credit', 'A modest boost.', () => { ap(me(), 3, 5); fac(me(), 'party', 2); fac(me(), pledgeFac(x.kind), 3); return 'You make a point of it in your next speech. It lands.'; }),
  ] : [
    sOpt('Admit it and explain', 'Honest, and it stings.', () => { ap(me(), -2, 5); fac(me(), pledgeFac(x.kind), -4); return 'You concede that circumstances changed. Some accept it, some do not.'; }),
    sOpt('Blame circumstances', 'Deflects, but it reads as spin.', () => { ap(me(), -4, 5); fac(me(), 'party', 1); fac(me(), pledgeFac(x.kind), -6); return 'You point at events outside your control. The press does not buy it.'; }),
  ] });

Object.assign(Engine, { storyList });
