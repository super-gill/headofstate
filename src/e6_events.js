// ===================== EVENTS =====================
const EVENTS = {};
function ev(id, def) { def.id = id; EVENTS[id] = def; }
const opt = (label, hint, run, extra) => Object.assign({ label, hint: hint || '', run }, extra || {});
const ap = (c, d, m) => addMod(c, 'appr', d, m == null ? 6 : m);
const st = (c, d, m) => addMod(c, 'stab', d, m == null ? 6 : m);
const gr = (c, d, m) => addMod(c, 'growth', d, m == null ? 8 : m);
const rival = (iso, min) => S.rivals.map(r => r.a === iso ? r.b : r.b === iso ? r.a : null).filter(x => x && alive(x) && (min == null || rivalryOf(iso, x) >= min));
const hostile = (iso, th) => aliveList().filter(x => x !== iso && R(iso, x) < th && C(x).army > 1);
const nbrs = iso => (NB[iso] || []).filter(alive);
const friends = (iso, th) => aliveList().filter(x => x !== iso && R(iso, x) > th && C(x).gdp > 20);
const isAt = () => atWar(S.player);
// geography and currency facts used to keep events plausible
const LANDLOCKED = new Set('AFG ARM AUT AZE BLR BTN BOL BWA BFA BDI CAF TCD CZE SWZ ETH HUN KAZ XKX KGZ LAO LSO LIE LUX MWI MLI MDA MNG NPL MKD PRY RWA SRB SVK SSD CHE TJK TKM UGA UZB ZMB ZWE'.split(' '));
const EUROZONE = new Set('AUT BEL HRV CYP EST FIN FRA DEU GRC IRL ITA LVA LTU LUX MLT NLD PRT SVK SVN ESP'.split(' '));
const underAttack = x => S.wars.some(w => w.b.includes(x) && w.aggressor === 'a') || S.wars.some(w => w.a.includes(x) && w.aggressor === 'b');
const GREATS = ['USA', 'CHN', 'RUS'];

function queueEvent(id, ctx) {
  const def = EVENTS[id]; if (!def) return;
  ctx = ctx || {}; if (ctx.v == null) ctx.v = Math.floor(rnd() * 1000);
  { const V = typeof VARIANTS !== 'undefined' ? VARIANTS[id] : null;   // do not show the same variant twice running
    if (V && V.length > 1) { S.lastV = S.lastV || {}; if (ctx.v % V.length === S.lastV[id]) ctx.v++; S.lastV[id] = ctx.v % V.length; } }
  S.eventN = S.eventN || {}; S.eventN[id] = (S.eventN[id] || 0) + 1;
  S.events.push({ id, ctx });
  S.eventHist[id] = S.turn;
  if (def.enter) def.enter(ctx);
}

// ---------------- DOMESTIC ----------------
ev('strike', { cat: 'domestic', cd: 12, w: c => 0.7 + (c.infl > c.baseInfl + 3 ? 0.7 : 0) + (c.unemp > c.baseUnemp + 2 ? 0.3 : 0),
  title: () => 'General strike threatened', text: () => 'Union leaders are threatening a nationwide strike over wages and the cost of living. Transport and public services would grind to a halt.',
  options: () => [
    opt('Negotiate a pay deal', 'Costs 0.5% of GDP. Calms things down.', () => { spendPct(me(), 0.5); ap(me(), 2, 6); st(me(), 2); addMod(me(), 'infl', 0.3, 8); fac(me(), 'business', -3); return 'A deal is signed. The strike is called off and the unions claim victory.'; }),
    opt('Hold firm', 'Business approves, but the streets may not.', () => { fac(me(), 'business', 3); ap(me(), -4, 4); st(me(), -1); if (chance(0.5)) { st(me(), -6); gr(me(), -0.4, 4); return 'The strike goes ahead. Ports and railways stop for a week and the economy takes a hit.'; } return 'The unions blink first. The strike fizzles out.'; }),
    opt('Send in the police', 'Restores order, costs liberty.', () => { st(me(), 4); ap(me(), -6); me().free = clamp(me().free - 4, 0, 100); fac(me(), 'military', 2); me().prest = clamp(me().prest - 2, 0, 100); return 'Riot police clear the picket lines. Order returns. Resentment does not leave.'; }),
  ] });
ev('scandal', { cat: 'domestic', cd: 9, w: c => (0.6 + c.corr / 60) * (c.flags.press > S.turn ? 0.3 : 1),
  ctx: () => ministerTag(pickServing()),
  title: () => 'Cabinet scandal', text: x => 'Your ' + ministerLabel(x) + ' is caught in a financial scandal involving a government contract. The press is circling and your party wants to know what you will do.',
  options: x => [
    opt('Sack the minister', 'Clean and decisive. They leave the cabinet and someone new is appointed.', () => { fac(me(), 'party', -2); ap(me(), 1, 4); const r = dismissMinister(x.aid, 'sacked'); return (r ? dismissText(r) : x.minister + ' is gone.') + ' The story dies in a few days.'; }),
    opt('Defend them', 'Loyalty has a price. May become a running story.', () => { ap(me(), -5, 6); fac(me(), 'party', 2); me().flags.recentScandal = 4; const a = adviserById(x.aid); if (a) a.loyalty = clamp(a.loyalty + 8, 0, 100); return 'You stand by ' + x.minister + '. The opposition and the press do not let it go.'; }),
    opt('Order an inquiry', 'A gamble on the result.', () => { if (chance(0.5)) { ap(me(), 2, 6); return 'The inquiry clears ' + x.minister + '. You look fair-minded.'; } ap(me(), -4, 6); fac(me(), 'party', -4); const r = dismissMinister(x.aid, 'resigned'); return 'The inquiry finds more wrongdoing than expected. ' + (r ? dismissText(r) : x.minister + ' resigns.') + ' Damage all round.'; }),
  ] });
function ministerLabel(x) { return (x.mrole && ROLES[x.mrole] ? ROLES[x.mrole].title.toLowerCase() + ' ' : 'minister ') + x.minister; }
ev('disaster', { cat: 'domestic', cd: 14, w: () => 0.8,
  ctx: () => ({ k: pick(['A powerful earthquake', 'Severe floods', 'A devastating storm', 'Wildfires']) }),
  title: x => x.k + (/^(Severe floods|Wildfires)$/.test(x.k) ? ' strike' : ' strikes'), text: x => x.k + (/^(Severe floods|Wildfires)$/.test(x.k) ? ' have' : ' has') + ' struck several of your provinces. Thousands are homeless and roads and power lines are down.',
  options: () => [
    opt('Full national relief effort', 'Costs 1% of GDP. Strong public response.', () => { spendPct(me(), 1); ap(me(), 5, 6); st(me(), 2); return 'Aid convoys reach every affected town. Your leadership is praised.'; }),
    opt('Deploy the army', 'Costs 0.5% of GDP. Generals like it.', () => { spendPct(me(), 0.5); ap(me(), 3, 5); fac(me(), 'military', 3); return 'Soldiers pull people from rubble and rebuild bridges. The army earns public respect.'; }),
    opt('Modest response, appeal for foreign aid', 'Costs 0.3% of GDP. Cheap, but looks weak.', () => { spendPct(me(), 0.3); ap(me(), -2, 5); friends(S.player, 30).slice(0, 4).forEach(f => addR(S.player, f, 3)); me().prest = clamp(me().prest - 1, 0, 100); return 'Allies send help. Some citizens ask why their own government was not more prepared.'; }),
  ] });
ev('outbreak', { cat: 'domestic', cd: 60, w: () => 0.45,
  title: () => 'Outbreak of a new disease', text: () => 'Doctors report a fast-spreading respiratory illness in your major cities. Hospitals are filling up and the scientific advice is split.',
  options: () => [
    opt('Strict lockdown', 'Saves lives, hurts the economy.', () => { gr(me(), -1.0, 6); ap(me(), -4, 4); st(me(), 2, 6); return 'A hard lockdown flattens the curve. Shops stay shuttered for weeks.'; }),
    opt('Light-touch response', 'Keeps the economy moving. Risky.', () => { gr(me(), -0.3, 6); if (chance(0.4)) { st(me(), -6, 8); ap(me(), -5, 8); return 'The virus tears through the population. Hospitals are overwhelmed and confidence drops.'; } return 'The outbreak burns out faster than feared. You got away with it.'; }),
    opt('Fund vaccine research and cooperate abroad', 'Costs 0.8% of GDP. Prestige gain.', () => { spendPct(me(), 0.8); gr(me(), -0.5, 6); me().prest = clamp(me().prest + 3, 0, 100); ap(me(), 1, 8); return 'A joint research effort delivers a treatment ahead of schedule.'; }),
  ] });
ev('terror', { cat: 'domestic', cd: 12, w: c => 0.5 + (c.fragile ? 0.5 : 0) + (c.secIdx < 40 ? 0.4 : 0) - (c.flags.cyber ? 0 : 0),
  title: () => 'Terror attack', text: () => 'A bombing in a crowded market has killed dozens. The nation is in shock and demands answers.',
  options: () => {
    const o = [
      opt('Emergency security measures', 'Stability up, liberty down.', () => { st(me(), 4); ap(me(), 3, 4); me().free = clamp(me().free - 5, 0, 100); me().secIdx = clamp(me().secIdx + 6, 0, 100); return 'Checkpoints and surveillance expand overnight. The public feels safer.'; }),
      opt('Calm, measured response', 'Costs 0.3% of GDP. Protects civil liberties.', () => { spendPct(me(), 0.3); st(me(), 2); ap(me(), 1, 4); me().secIdx = clamp(me().secIdx + 3, 0, 100); return 'You urge unity and let the police do their work. Investigators make arrests within days.'; }),
    ];
    const rv = hostile(S.player, -30).filter(x => canReach(S.player, x))[0];
    if (rv) o.push(opt('Blame ' + nm(rv), 'Rally the nation. Damages relations.', () => { ap(me(), 4, 5); addR(S.player, rv, -15); S.world.tension = clamp(S.world.tension + 2, 0, 100); return 'You point the finger at ' + nm(rv) + '. Their government denies it furiously.'; }));
    return o;
  } });
ev('bankcrisis', { cat: 'domestic', cd: 24, w: c => (debtPct(c) > 80 || c.infl > 8) ? 0.9 : 0.25,
  title: () => 'Banking crisis', text: () => 'A major bank is close to collapse and depositors are queuing outside branches. Contagion could spread through the whole system.',
  options: () => [
    opt('Bail out the banks', 'Costs 2.5% of GDP.', () => { spendPct(me(), 2.5); fac(me(), 'business', 6); ap(me(), -4, 8); return 'The banks are saved on the taxpayer\'s bill. Nobody is happy about it.'; }),
    opt('Guarantee deposits only', 'Costs 1% of GDP.', () => { spendPct(me(), 1); gr(me(), -0.5, 6); fac(me(), 'business', -2); return 'Savers are protected but shareholders are wiped out. The system wobbles and holds.'; }),
    opt('Let the bank fail', 'Cheap. Dangerous.', () => { gr(me(), -1.2, 8); addMod(me(), 'unemp', 1.5, 10); fac(me(), 'business', -6); ap(me(), -6, 6); st(me(), -4); return 'The bank collapses and credit dries up. It hurts, but there is no bailout bill.'; }),
  ] });
ev('energy', { cat: 'domestic', cd: 14, w: c => c.rent > 5 ? 0.1 : 0.7,
  title: () => 'Energy prices spike', text: () => 'Fuel and electricity costs are surging. Households and factories are demanding action.',
  options: () => [
    opt('Cap prices', 'Costs 0.8% of GDP.', () => { spendPct(me(), 0.8); ap(me(), 3, 6); addMod(me(), 'infl', -0.2, 8); return 'Price caps hold bills down for now. The treasury pays the difference.'; }),
    opt('Let the market adjust', 'Painful in the short run.', () => { addMod(me(), 'infl', 1, 8); ap(me(), -3, 8); fac(me(), 'business', 2); return 'Bills climb. Business adapts. Voters remember.'; }),
    opt('Accelerate renewables', 'Costs 0.6% of GDP. Long-term payoff.', () => { spendPct(me(), 0.6); me().flags.prestige = (me().flags.prestige || 0) + 2; ap(me(), 1, 6); me().flags.green = 1; return 'A big renewables push begins. It will not help this winter but will help the next.'; }),
  ] });
ev('oilwindfall', { cat: 'domestic', cd: 24, w: c => c.rent > 5 && S.world.oil > 1.2 ? 1.2 : 0,
  title: () => 'Commodity windfall', text: () => 'High global prices are sending unexpected billions into the treasury. Everyone has an opinion on how to spend them.',
  options: () => [
    opt('Sovereign wealth fund', 'Save for the future.', () => { me().flags.prestige = (me().flags.prestige || 0) + 1; me().treasury += me().gdp * 0.015; fac(me(), 'business', 3); return 'Most of the windfall goes into a fund. Fiscal hawks applaud.'; }),
    opt('Spending spree', 'Popular now, costly later.', () => { ap(me(), 5, 8); me().corr = clamp(me().corr + 3, 0, 100); addMod(me(), 'infl', 0.5, 10); return 'Subsidies, stadiums and salaries. Everyone is happy for a while.'; }),
    opt('Tax cuts', 'Businesses and households benefit.', () => { fac(me(), 'business', 6); ap(me(), 3, 8); me().tax = clamp(me().tax - 1, 5, 60); return 'Tax rates come down a point. Growth benefits.'; }),
  ] });
ev('protests', { cat: 'domestic', cd: 10, ctx: c => ({ sev: c.appr < 38 || c.stab < 38 ? 3 : c.appr < 50 || c.stab < 50 ? 2 : 1 }), w: c => 0.5 + (c.infl > c.baseInfl + 2 ? 0.8 : 0) + (c.unemp > c.baseUnemp + 2 ? 0.5 : 0) + (c.stab < 45 ? 0.5 : 0),
  title: () => 'Cost-of-living protests', text: () => 'Thousands have taken to the streets over rising prices and stagnant wages. The chants are getting angrier.',
  options: () => [
    opt('Announce subsidies', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); ap(me(), 3, 6); st(me(), 2); return 'Relief measures are announced. The crowds thin out.'; }),
    opt('Address the nation', 'Talk, not money. Success varies.', () => { if (chance(isDemo(me().gov) ? 0.6 : 0.4)) { st(me(), 3); ap(me(), 1, 4); return 'Your speech strikes the right note. Tempers cool.'; } st(me(), -2); ap(me(), -2, 4); return 'The speech is mocked online. The protests grow.'; }),
    opt('Disperse the crowds', 'Order at a price.', () => { st(me(), 3, 4); ap(me(), -3, 6); me().free = clamp(me().free - 3, 0, 100); me().prest = clamp(me().prest - 1, 0, 100); return 'Tear gas and arrests clear the squares. Anger simmers underneath.'; }),
  ] });
ev('separatists', { cat: 'domestic', cd: 18, w: c => 0.3 + (c.fragile ? 0.5 : 0) + (c.pop > 20 ? 0.3 : 0) + (c.free < 40 ? 0.1 : 0),
  title: () => 'Separatist unrest', text: () => 'A restless region is demanding autonomy. Flags are flying and there are clashes with police.',
  options: () => [
    opt('Offer autonomy talks', 'Concessions may calm things.', () => { st(me(), 3, 10); fac(me(), 'party', -3); fac(me(), 'military', -3); me().flags.dialogue = S.turn + 12; return 'Talks begin. Hardliners call it weakness. The region calms.'; }),
    opt('Crack down', 'Force can work or backfire.', () => { if (chance(0.6)) { st(me(), 5, 8); fac(me(), 'military', 4); return 'The unrest is put down. The region falls quiet, for now.'; } st(me(), -8, 8); ap(me(), -4, 6); me().free = clamp(me().free - 3, 0, 100); return 'The crackdown backfires. Images of violence rally more people to the cause.'; }),
    opt('Ignore it', 'Hope it burns out.', () => { st(me(), -3, 8); return 'The movement grows steadily. It is harder to ignore each week.'; }),
  ] });
ev('expose', { cat: 'domestic', cd: 16, w: c => (isDemo(c.gov) ? 0.8 : 0.25) * (c.flags.press > S.turn ? 0.3 : 1) * (0.5 + c.corr / 80),
  title: () => 'Investigative exposé', text: () => 'A newspaper investigation alleges that people close to you have been enriching themselves through state contracts.',
  options: () => [
    opt('Prosecute those involved', 'Costly, but credible.', () => { me().corr = clamp(me().corr - 4, 0, 100); fac(me(), 'party', -5); ap(me(), 3, 6); return 'Several arrests follow. Insiders mutter, voters nod.'; }),
    opt('Attack the media', 'Risky and illiberal.', () => { me().free = clamp(me().free - 4, 0, 100); if (chance(0.5)) { ap(me(), 1, 5); return 'Your supporters rally against a hostile press. The story loses steam.'; } ap(me(), -4, 6); return 'It backfires: the attack makes the story bigger.'; }),
    opt('Say nothing', 'Wait for the news cycle.', () => { ap(me(), -3, 6); me().flags.recentScandal = 3; return 'The story lingers longer than you hoped.'; }),
  ] });
ev('milDemand', { cat: 'domestic', cd: 14, w: c => c.fac.military < 50 ? 1.5 : 0.25,
  title: () => 'Generals demand more money', text: () => 'Your top brass have made it clear, politely, that they are unhappy with the defence budget and their standing.',
  options: () => [
    opt('Raise defence spending by 0.5% of GDP', 'Permanent increase. You pledge to hold it for two years.', () => { me().spend.mil = clamp(me().spend.mil + 0.5, 0.1, 20); me().exp.mil = me().exp.mil; fac(me(), 'military', 8); return 'The budget rises. The generals are pleased.'; }),
    opt('Honours and perks', 'Costs 0.2% of GDP.', () => { spendPct(me(), 0.2); fac(me(), 'military', 4); return 'Medals, pensions and a new academy. It takes the edge off.'; }),
    opt('Refuse', 'Ignoring the army is a gamble.', () => { fac(me(), 'military', -8); ap(me(), 1, 4); return 'You refuse. The generals leave without a word.'; }),
  ] });
ev('bizDemand', { cat: 'domestic', cd: 14, w: c => c.tax > c.taxBase - 1 ? 1 : 0.3,
  title: () => 'Business leaders lobby for tax cuts', text: () => 'The biggest employers in the country are threatening to move investment abroad unless the tax burden eases.',
  options: () => [
    opt('Cut taxes by 2 points', 'Loses revenue, boosts growth.', () => { me().tax = clamp(me().tax - 2, 5, 60); fac(me(), 'business', 8); ap(me(), 2, 6); return 'The tax rate is trimmed. Executives smile.'; }),
    opt('Deregulate instead', 'Growth up, corruption risk.', () => { gr(me(), 0.15, 12); me().corr = clamp(me().corr + 2, 0, 100); fac(me(), 'business', 4); return 'Red tape is cut. Some of it was there for a reason.'; }),
    opt('Refuse', 'Keep the revenue.', () => { fac(me(), 'business', -6); ap(me(), 1, 4); return 'You hold the line. Business leaders publicly complain.'; }),
  ] });
ev('partyRevolt', { cat: 'domestic', cd: 12, w: c => c.fac.party < 48 ? 1.6 : 0.15,
  title: () => 'Revolt in your own ranks', text: () => 'A bloc of senior figures in your own party has demanded a change of direction. Some are hinting at a leadership challenge.',
  options: () => [
    opt('Make concessions', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); fac(me(), 'party', 8); return 'You buy peace with pet projects and cabinet seats.'; }),
    opt('Patronage and appointments', 'Corruption creeps up.', () => { me().corr = clamp(me().corr + 3, 0, 100); fac(me(), 'party', 6); return 'Lucrative posts are handed out. The rebels rediscover their loyalty.'; }),
    opt('Discipline the rebels', 'High stakes.', () => { if (chance(0.5)) { fac(me(), 'party', 4); return 'Your show of strength works. The rebels fold.'; } fac(me(), 'party', -10); return 'The rebels dig in and grow bolder.'; }),
  ] });
const COURT_MEASURES = ['the emergency budget powers', 'the new surveillance law', 'the immigration crackdown', 'the media licensing rules', 'the protest ban', 'the pension reform', 'the land reform act', 'the anti-strike law'];
ev('courtRuling', { cat: 'domestic', cd: 18, w: c => isDemo(c.gov) && c.free > 45 ? 0.7 : 0,
  ctx: () => ({ m: pick(COURT_MEASURES) }),
  title: x => 'Court strikes down ' + x.m, text: x => 'The highest court has ruled that ' + x.m + ' is unconstitutional.',
  options: () => [
    opt('Comply', 'Respect the courts.', () => { ap(me(), 1, 4); fac(me(), 'party', -2); me().prest = clamp(me().prest + 1, 0, 100); return 'You comply, grudgingly. The rule of law survives.'; }),
    opt('Pack the court', 'Bold and controversial.', () => { me().free = clamp(me().free - 8, 0, 100); me().corr = clamp(me().corr + 3, 0, 100); fac(me(), 'party', 3); me().prest = clamp(me().prest - 3, 0, 100); return 'New judges are appointed. The next ruling will look different.'; }),
    opt('Defy quietly', 'Slow-walk the order.', () => { ap(me(), -2, 4); me().prest = clamp(me().prest - 2, 0, 100); st(me(), -2); return 'You drag your feet. Critics call it contempt.'; }),
  ] });
ev('coupRumours', { cat: 'domestic', cd: 10, w: c => { const h = hazards(c); return h.coup + h.palace > 0.008 ? 3 : 0; },
  title: () => 'Whispers of a plot', text: () => 'Your intelligence chief reports that officers and courtiers have been meeting in secret. Nobody will say the word, but everyone knows what it is.',
  options: () => [
    opt('Purge suspected plotters', 'Removes threats. Hurts the army.', () => { fac(me(), 'military', -8); me().flags.coupProof = S.turn + 8; return 'A wave of arrests and quiet retirements follows. The plot, if it existed, is dead.'; }),
    opt('Buy them off', 'Costs 0.8% of GDP.', () => { spendPct(me(), 0.8); fac(me(), 'military', 8); fac(me(), 'party', 4); return 'Envelopes and promotions circulate. Loyalty is restored, at a price.'; }),
    opt('Investigate quietly', 'A gamble.', () => { if (chance(0.6)) { me().flags.coupProof = S.turn + 6; return 'Your agents identify the ringleaders. They are arrested before they can act.'; } return 'Nothing conclusive turns up. The whispers continue.'; }),
  ] });
ev('boom', { cat: 'domestic', cd: 18, w: c => c.growth > c.baseGrowth + 1.5 ? 1 : 0,
  title: () => 'Economic boom', text: () => 'Growth has surged ahead of expectations and the treasury is receiving a windfall. Options abound.',
  options: () => [
    opt('Invest in infrastructure', 'Build for the long term.', () => { me().infraIdx = clamp(me().infraIdx + 6, 0, 100); ap(me(), 2, 8); return 'Roads, ports and grids get the money they needed for years.'; }),
    opt('Cut taxes', 'Share the good times.', () => { me().tax = clamp(me().tax - 1.5, 5, 60); ap(me(), 3, 8); fac(me(), 'business', 5); return 'Voters and firms enjoy a lower tax bill.'; }),
    opt('Save it', 'Pay down debt.', () => { gain(me(), 1.5); me().flags.creditHit = Math.max(0, (me().flags.creditHit || 0) - 0.3); return 'The extra revenue goes to the reserve. Prudent, if unexciting.'; }),
  ] });
ev('techBreak', { cat: 'domestic', cd: 30, w: c => c.tier >= 2 ? 0.45 : 0.1,
  title: () => 'A homegrown tech breakthrough', text: () => 'A domestic research lab announces a breakthrough with major commercial potential.',
  options: () => [
    opt('Subsidise the industry', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); gr(me(), 0.35, 24); me().flags.prestige = (me().flags.prestige || 0) + 2; return 'Public money and private ambition combine. A new industry is born.'; }),
    opt('Leave it to the market', 'Free, slower.', () => { gr(me(), 0.15, 18); return 'Investors take over. Some of the gains flow abroad.'; }),
  ] });
ev('resourceFind', { cat: 'domestic', cd: 60, w: c => c.tier <= 3 ? 0.25 : 0.05,
  title: () => 'Major resource discovery', text: () => 'Geologists confirm a large deposit of valuable minerals and hydrocarbons. Who should develop it?',
  options: () => [
    opt('State-run development', 'Higher rent, slower start.', () => { me().rent += 3; ap(me(), 3, 8); me().corr = clamp(me().corr + 3, 0, 100); return 'A state company takes the lead. Revenues will climb over the next years.'; }),
    opt('Foreign investors', 'Fast growth, smaller share.', () => { gr(me(), 0.4, 24); me().rent += 1; const f = friends(S.player, 10)[0]; if (f) addR(S.player, f, 5); return 'International firms move in quickly. Growth picks up.'; }),
    opt('Sovereign fund', 'Save for the future.', () => { me().rent += 2; me().flags.prestige = (me().flags.prestige || 0) + 1; fac(me(), 'business', 2); return 'Proceeds are channelled into a national fund.'; }),
  ] });
ev('attempt', { cat: 'domestic', cd: 40, w: c => 0.12 + (c.appr < 40 ? 0.15 : 0),
  title: () => 'Assassination attempt', text: () => 'Shots were fired at your motorcade. You are unharmed, but the country is in shock.',
  options: () => [
    opt('Rally the nation', 'Use the moment.', () => { ap(me(), 6, 6); st(me(), 3); return 'You appear defiant and unhurt. The public rallies around you.'; }),
    opt('Tighten security state', 'Take no chances.', () => { st(me(), 5); me().free = clamp(me().free - 6, 0, 100); me().secIdx = clamp(me().secIdx + 8, 0, 100); return 'Security is tightened everywhere. It is safer, and it feels less free.'; }),
  ] });
ev('cyberBreach', { cat: 'domestic', cd: 14, w: c => c.flags.cyber ? 0.3 : 0.7,
  ctx: () => { const h = hostile(S.player, -25).filter(x => C(x).tech >= 3)[0]; return { o: h || null }; },
  title: () => 'Government networks breached', text: x => 'Hackers have penetrated several ministries and leaked sensitive documents. ' + (x.o ? 'Analysts point toward ' + nm(x.o) + '.' : 'The source is unclear.'),
  options: x => {
    const o = [opt('Patch and harden', 'Costs 0.2% of GDP.', () => { spendPct(me(), 0.2); me().secIdx = clamp(me().secIdx + 4, 0, 100); return 'A crash programme fixes the worst holes.'; })];
    if (x.o) o.push(opt('Publicly blame ' + nm(x.o), 'Naming and shaming. Raises tension, and may not stick.', () => { addR(S.player, x.o, -8); S.world.tension = clamp(S.world.tension + 1, 0, 100); if (chance(0.4)) { ap(me(), -1, 4); return nm(x.o) + ' denies it convincingly and the accusation does not stick.'; } ap(me(), 2, 4); me().prest = clamp(me().prest + 1, 0, 100); return 'You attribute the attack publicly. Allies back you up.'; }));
    o.push(opt('Downplay it', 'Say little.', () => { ap(me(), -2, 4); return 'The story is quietly buried. Your critics say you are hiding something.'; }));
    return o;
  } });
ev('youth', { cat: 'domestic', cd: 14, w: c => isDemo(c.gov) ? 0.5 : 0.15,
  title: () => 'Student and climate protests', text: () => 'Students have occupied campuses and blocked roads to demand faster action on climate and housing.',
  options: () => [
    opt('Meet some demands', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); ap(me(), 2, 6); fac(me(), 'business', -2); return 'You announce a package. The protesters call it a start.'; }),
    opt('Dismiss them', 'Free of charge.', () => { ap(me(), -2, 5); st(me(), -2); return 'The protesters are furious at being brushed off.'; }),
    opt('Co-opt their leaders', 'Bring them into the tent.', () => { fac(me(), 'party', 2); ap(me(), 1, 4); return 'A few leaders take advisory posts. The movement splits.'; }),
  ] });
ev('bondJitters', { cat: 'domestic', cd: 12, w: c => (debtPct(c) > 90 && !(c.credit && c.credit.idx >= 4)) ? 2 : 0,
  title: () => 'Bond markets turn nervous', text: () => 'Yields on government debt are creeping up. Investors are asking hard questions about your finances.',
  options: () => [
    opt('Announce a credible fiscal plan', 'Gains revenue, angers voters.', () => { gain(me(), 0.8); ap(me(), -4, 6); me().flags.creditHit = Math.max(0, (me().flags.creditHit || 0) - 0.5); return 'A plan of spending restraint calms the markets.'; }),
    opt('Lean on the central bank', 'Inflationary.', () => { addMod(me(), 'infl', 0.8, 10); return 'The central bank steps in to buy debt. Inflation ticks up.'; }),
    opt('Ignore the noise', 'Borrowing gets pricier.', () => { me().flags.creditHit = (me().flags.creditHit || 0) + 1; return 'Yields keep drifting up. Interest costs rise.'; }),
  ] });
ev('inflSurge', { cat: 'domestic', cd: 12, w: c => c.infl > c.baseInfl + 3 ? 1.6 : 0,
  title: () => 'Prices are surging', text: () => 'Inflation is well above target and households are feeling the pinch.',
  options: () => [
    opt('Raise interest rates', 'Slows growth.', () => { addMod(me(), 'infl', -1.6, 12); gr(me(), -0.5, 8); addMod(me(), 'unemp', 0.4, 10); ap(me(), -2, 6); return 'Rates rise. Inflation begins to ease, and so does the economy.'; }),
    opt('Price controls', 'Shortages likely.', () => { addMod(me(), 'infl', -1, 6); gr(me(), -0.3, 8); fac(me(), 'business', -5); ap(me(), 2, 5); return 'Controls hold prices down. Shelves start to thin.'; }),
    opt('Targeted subsidies', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); ap(me(), 3, 6); return 'Support reaches the poorest households. Inflation itself is unchanged.'; }),
  ] });
ev('housing', { cat: 'domestic', cd: 40, w: c => c.tier >= 3 ? 0.4 : 0.1,
  title: () => 'Housing bubble bursts', text: () => 'Property prices are tumbling and construction has stalled. Households are underwater on their mortgages.',
  options: () => [
    opt('Rescue package', 'Costs 2% of GDP.', () => { spendPct(me(), 2); ap(me(), 2, 6); gr(me(), -0.2, 8); return 'Homeowners and lenders get relief. The bill is large.'; }),
    opt('Tough love', 'Let the market clear.', () => { gr(me(), -0.6, 10); addMod(me(), 'unemp', 0.8, 12); ap(me(), -5, 8); return 'The correction is savage but short.'; }),
  ] });
ev('celebration', { cat: 'domestic', cd: 20, w: () => 0.35,
  title: () => 'A moment of national pride', text: () => 'Your athletes and artists have had a historic triumph abroad. The country is celebrating.',
  options: () => [
    opt('Capitalise on the mood', 'Costs 0.2% of GDP.', () => { spendPct(me(), 0.2); ap(me(), 6, 5); return 'Parades, speeches and a public holiday. Your poll numbers glow.'; }),
    opt('Stay above it', 'Dignified.', () => { me().flags.prestige = (me().flags.prestige || 0) + 2; ap(me(), 2, 4); return 'You congratulate the winners and leave it there.'; }),
  ] });
ev('ethnicClash', { cat: 'domestic', cd: 16, w: c => 0.3 + (c.fragile ? 0.5 : 0),
  title: () => 'Communal clashes', text: () => 'Fighting between ethnic and religious communities has broken out in a major city. Dozens are dead.',
  options: () => [
    opt('Deploy troops', 'Restores order.', () => { st(me(), 4); me().free = clamp(me().free - 3, 0, 100); fac(me(), 'military', 3); return 'Soldiers separate the communities. It holds, for now.'; }),
    opt('Mediation and dialogue', 'Slow but lasting.', () => { st(me(), 2, 10); fac(me(), 'party', -2); return 'Community leaders are brought to the table.'; }),
    opt('Harsh sweep', 'Fast and brutal.', () => { st(me(), 6); me().free = clamp(me().free - 8, 0, 100); me().prest = clamp(me().prest - 4, 0, 100); return 'Mass arrests end the violence quickly. Rights groups protest.'; }),
  ] });
ev('leak', { cat: 'domestic', cd: 20, w: c => c.free > 40 ? 0.45 : 0.1,
  title: () => 'Leaked documents', text: () => 'A whistleblower has handed the press classified files about a controversial government programme.',
  options: () => [
    opt('Come clean', 'Honest, painful.', () => { ap(me(), -2, 4); me().prest = clamp(me().prest + 1, 0, 100); me().corr = clamp(me().corr - 2, 0, 100); fac(me(), 'party', -3); return 'You acknowledge the programme and promise reform. Your own party is unhappy you gave ground.'; }),
    opt('Deny', 'A gamble.', () => { if (chance(0.6)) return 'The denial holds. The story loses steam.'; ap(me(), -6, 6); return 'More documents emerge. You look like a liar.'; }),
    opt('Prosecute the leaker', 'Punish the messenger.', () => { me().free = clamp(me().free - 5, 0, 100); ap(me(), -2, 4); fac(me(), 'military', 2); return 'The whistleblower is arrested. Civil society is alarmed.'; }),
  ] });
ev('health', { cat: 'domestic', cd: 16, w: c => c.spend.social < c.exp.social ? 0.7 : 0.25,
  title: () => 'Health system under strain', text: () => 'Hospitals are running out of beds and staff. Doctors are threatening to walk out.',
  options: () => [
    opt('Emergency funding', 'Costs 0.8% of GDP.', () => { spendPct(me(), 0.8); ap(me(), 3, 6); st(me(), 2); return 'Extra money and a hiring drive relieve the pressure.'; }),
    opt('Blame local authorities', 'Deflect.', () => { ap(me(), -2, 5); fac(me(), 'party', 1); return 'The blame game does nothing for patients.'; }),
  ] });
ev('crime', { cat: 'domestic', cd: 12, w: c => c.secIdx < 45 ? 1.2 : 0.5,
  title: () => 'Crime wave', text: () => 'Street crime and organised gangs are on the rise. The public wants results.',
  options: () => [
    opt('Tough policing', 'Costs 0.4% of GDP.', () => { spendPct(me(), 0.4); me().secIdx = clamp(me().secIdx + 6, 0, 100); me().free = clamp(me().free - 3, 0, 100); ap(me(), 2, 5); return 'More police, more powers. Crime figures begin to fall.'; }),
    opt('Social programmes', 'Costs 0.6% of GDP.', () => { spendPct(me(), 0.6); st(me(), 3, 10); ap(me(), 1, 6); return 'Youth and employment schemes take time to bite.'; }),
    opt('Do nothing', 'Hope for the best.', () => { ap(me(), -4, 6); return 'Voters conclude that you do not care.'; }),
  ] });
ev('brainDrain', { cat: 'domestic', cd: 24, w: c => c.tier >= 2 && c.stab < 55 ? 0.6 : 0.1,
  title: () => 'Skilled workers are leaving', text: () => 'Doctors, engineers and coders are emigrating in large numbers. Employers warn of a serious skills gap.',
  options: () => [
    opt('Retention incentives', 'Costs 0.4% of GDP.', () => { spendPct(me(), 0.4); gr(me(), 0.1, 18); return 'Tax breaks and housing help persuade some to stay.'; }),
    opt('Ignore it', 'A slow bleed.', () => { gr(me(), -0.1, 18); return 'The exodus continues.'; }),
  ] });
const weakCurrency = c => !EUROZONE.has(c.iso) && (c.infl > Math.max(8, c.baseInfl + 5) || debtPct(c) > 110 || (c.credit && c.credit.idx >= 4));
ev('currency', { cat: 'domestic', cd: 24, w: c => weakCurrency(c) ? 1.4 : 0,
  ctx: c => weakCurrency(c) ? {} : null,
  title: () => 'Currency under attack', text: () => 'Speculators are dumping your currency and reserves are draining.',
  options: () => [
    opt('Raise interest rates', 'Defend the currency.', () => { gr(me(), -0.6, 8); addMod(me(), 'infl', -0.8, 8); ap(me(), -3, 6); return 'Higher rates stem the outflow at the cost of growth.'; }),
    opt('Impose capital controls', 'Illiberal but effective.', () => { me().free = clamp(me().free - 3, 0, 100); fac(me(), 'business', -6); st(me(), 1); return 'Money can no longer leave freely. Markets stabilise.'; }),
    opt('Seek an IMF-style rescue', 'Costs sovereignty.', () => { gain(me(), 2); ap(me(), -5, 8); me().prest = clamp(me().prest - 2, 0, 100); gr(me(), -0.3, 10); return 'A rescue loan arrives with strings attached.'; }),
  ] });
ev('drought', { cat: 'domestic', cd: 20, w: c => c.tier <= 2 ? 0.7 : 0.05,
  title: () => 'Drought and failed harvests', text: () => 'Rains have failed for a second season. Food prices are soaring in rural and urban markets alike.',
  options: () => [
    opt('Import food at scale', 'Costs 1% of GDP.', () => { spendPct(me(), 1); st(me(), 2); ap(me(), 2, 5); return 'Shiploads of grain arrive. Prices stabilise.'; }),
    opt('Ration and requisition', 'Order at a price.', () => { st(me(), -1); ap(me(), -3, 6); fac(me(), 'military', 2); return 'Rationing is enforced. It is unpopular but effective.'; }),
    opt('Appeal for international aid', 'Costs some pride.', () => { me().prest = clamp(me().prest - 1, 0, 100); ap(me(), 1, 4); friends(S.player, 20).slice(0, 4).forEach(f => addR(S.player, f, 3)); return 'Donors respond. Your standing abroad dips slightly.'; }),
  ] });
ev('insurgency', { cat: 'domestic', cd: 14, w: c => c.fragile ? 1.3 : 0.15,
  title: () => 'Insurgents strike in the provinces', text: () => 'Armed groups have overrun several towns and government outposts. The army wants a free hand.',
  options: () => [
    opt('Launch an offensive', 'Costs 0.6% of GDP.', () => { spendPct(me(), 0.6); fac(me(), 'military', 4); if (chance(0.7)) { st(me(), 3); return 'The towns are retaken. The insurgents melt away.'; } st(me(), -4); return 'The offensive stalls with heavy losses.'; }),
    opt('Negotiate', 'Ceasefire and talks.', () => { st(me(), 2, 10); fac(me(), 'military', -3); return 'A ceasefire is agreed. It is fragile.'; }),
    opt('Fortify what you hold', 'Costs 0.2% of GDP. Defensive.', () => { spendPct(me(), 0.2); st(me(), -1); return 'The outposts are reinforced. The insurgents keep the initiative.'; }),
  ] });
ev('dissident', { cat: 'domestic', cd: 16, w: c => isAuto(c.gov) ? 0.6 : 0,
  title: () => 'A rival gains a following', text: () => 'A charismatic critic is drawing crowds and the security services are nervous.',
  options: () => [
    opt('Arrest them', 'Decisive.', () => { st(me(), 2); me().free = clamp(me().free - 4, 0, 100); me().prest = clamp(me().prest - 3, 0, 100); return 'The critic disappears into custody. The crowds do not gather again.'; }),
    opt('Co-opt them', 'Offer a post.', () => { fac(me(), 'party', -2); ap(me(), 2, 6); return 'The critic accepts a ministry. Their followers feel betrayed.'; }),
    opt('Ignore them', 'They may fade.', () => { ap(me(), -2, 6); st(me(), -2, 8); return 'The crowds grow.'; }),
  ] });
ev('foreignInvest', { cat: 'domestic', cd: 24, w: c => c.tier <= 3 ? 0.5 : 0.2,
  ctx: () => { const f = friends(S.player, 0).filter(x => C(x).gdp > 400); return f.length ? { o: pick(f) } : null; },
  title: x => 'Big investment offer from ' + nm(x.o), text: x => 'A consortium tied to ' + nm(x.o) + ' is offering to build a giant industrial complex in your country. There are strings attached.',
  options: x => [
    opt('Accept the offer', 'Fast growth, some dependence.', () => { gr(me(), 0.3, 24); me().corr = clamp(me().corr + 2, 0, 100); addR(S.player, x.o, 8); return 'The deal is signed. Cranes and contractors arrive.'; }),
    opt('Demand tougher terms', 'They may walk away.', () => { if (chance(0.5)) { gr(me(), 0.25, 24); addR(S.player, x.o, 3); return 'They agree to better terms.'; } addR(S.player, x.o, -3); return 'They walk away and take the investment elsewhere.'; }),
    opt('Decline', 'Independence matters.', () => { ap(me(), 1, 4); return 'You turn them down. Nationalists cheer.'; }),
  ] });

// ---------------- INTERNATIONAL ----------------
ev('borderIncident', { cat: 'intl', cd: 10, w: () => 0.9,
  ctx: () => { const opts = aliveList().filter(x => x !== S.player && !warBetween(S.player, x) && R(S.player, x) < -20 && canReach(S.player, x) && (NB[S.player] || []).includes(x)); if (!opts.length) return null; return { o: pick(opts) }; },
  title: x => 'Border incident with ' + nm(x.o), text: x => 'Troops from ' + nm(x.o) + ' have clashed with your border guards. Both sides are blaming each other.',
  options: x => [
    opt('Protest formally', 'Measured.', () => { addR(S.player, x.o, -3); S.world.tension = clamp(S.world.tension + 0.3, 0, 100); return 'A note of protest is delivered. Things calm.'; }),
    opt('Reinforce the border', 'Costs 0.3% of GDP.', () => { spendPct(me(), 0.3); fac(me(), 'military', 3); addR(S.player, x.o, -6); me().flags.readyBoost = 6; return 'Troops and armour move up. ' + nm(x.o) + ' does the same.'; }),
    opt('Retaliate', 'Escalation risk.', () => { addR(S.player, x.o, -15); S.world.tension = clamp(S.world.tension + 3, 0, 100); fac(me(), 'military', 5); ap(me(), 2, 4); S.cb[pkey(S.player, x.o)] = S.turn + 12; return 'Your forces hit back. It is now a full-blown crisis, and both sides have grounds for war.'; }),
    opt('De-escalate through talks', 'Costs a little pride.', () => { addR(S.player, x.o, 5); ap(me(), -1, 3); return 'Envoys meet in a neutral capital. Tempers cool.'; }),
  ] });
ev('summit', { cat: 'intl', cd: 12, w: () => 0.55,
  ctx: () => { const o = aliveList().filter(x => x !== S.player && C(x).gdp > 800 && R(S.player, x) > -20); return o.length ? { o: pick(o) } : null; },
  title: x => nm(x.o) + ' invites you to a summit', text: x => 'The leader of ' + nm(x.o) + ' is inviting selected leaders to a high-profile summit. Attending would raise your profile, and cost you some time.',
  options: x => [
    opt('Attend', 'Costs 0.02% of GDP.', () => { spendPct(me(), 0.02); addR(S.player, x.o, 7); me().prest = clamp(me().prest + 1.5, 0, 100); S.pc = Math.min(S.pcMax, S.pc + 1); return 'The summit produces a warm communique and some useful contacts.'; }),
    opt('Send a minister', 'Low-key.', () => { addR(S.player, x.o, 1); return 'Your minister attends. Nobody notices.'; }),
    opt('Decline', 'Stay home.', () => { addR(S.player, x.o, -3); return 'The host is mildly offended.'; }),
  ] });
ev('sanctionsProposal', { cat: 'intl', cd: 10, w: () => S.wars.length ? 1 : 0,
  ctx: () => { const ws = S.wars.filter(w => !playerBelligerentIn(w)); if (!ws.length) return null; const w = pick(ws); const agg = w.lead[w.aggressor]; if (agg === S.player || sanctioned(S.player, agg)) return null; return { on: agg, war: w.id }; },
  title: x => 'Sanctions on ' + nm(x.on), text: x => 'A coalition of countries is proposing sanctions against ' + nm(x.on) + ' over the war it started. They want to know which side you are on.',
  options: x => [
    opt('Join the sanctions', 'Business will grumble.', () => { S.sanctions.push({ by: S.player, on: x.on, turn: S.turn }); addR(S.player, x.on, -15); friends(S.player, 10).slice(0, 6).forEach(f => addR(S.player, f, 2)); fac(me(), 'business', -2); S.dirtyBase = true; return 'You join the coalition. ' + nm(x.on) + ' denounces you.'; }),
    opt('Abstain', 'Stay out of it.', () => { friends(S.player, 30).slice(0, 4).forEach(f => addR(S.player, f, -1)); return 'You stay neutral. Neither side is thrilled.'; }),
    opt('Oppose the sanctions', 'Stand with ' + nm(x.on) + '.', () => { addR(S.player, x.on, 8); friends(S.player, 20).slice(0, 6).forEach(f => addR(S.player, f, -3)); me().prest = clamp(me().prest - 1, 0, 100); return 'You break with the coalition. The West is irritated.'; }),
  ] });
ev('tradeOffer', { cat: 'intl', cd: 8, w: () => 0.7,
  ctx: () => { const o = aliveList().filter(x => x !== S.player && R(S.player, x) > 5 && C(x).gdp > 20 && !hasDeal(S.player, x) && !sanctioned(S.player, x) && !sharedBloc(S.player, x, ['union'])); return o.length ? { o: pick(o) } : null; },
  title: x => nm(x.o) + ' offers a trade deal', text: x => 'The government of ' + nm(x.o) + ' has proposed a bilateral trade agreement.',
  options: x => [
    opt('Accept', 'Growth boost for both.', () => { S.deals.push([S.player, x.o]); addR(S.player, x.o, 6); return 'The trade deal is signed.'; }),
    opt('Push for better terms', 'Might backfire.', () => { if (chance(0.5)) { S.deals.push([S.player, x.o]); addR(S.player, x.o, 3); return 'They give ground and the deal is signed.'; } addR(S.player, x.o, -3); return 'They lose patience and walk away.'; }),
    opt('Decline', 'Protect local industry.', () => { addR(S.player, x.o, -1); fac(me(), 'business', -1); return 'You decline politely.'; }),
  ] });
ev('spyRing', { cat: 'intl', cd: 14, w: () => 0.5,
  ctx: () => { const o = hostile(S.player, -15).filter(x => C(x).tech >= 2); return o.length ? { o: pick(o) } : null; },
  title: x => 'Spy ring linked to ' + nm(x.o), text: x => 'Your counter-intelligence service has uncovered a network of agents working for ' + nm(x.o) + '.',
  options: x => [
    opt('Expel their diplomats', 'A firm response.', () => { addR(S.player, x.o, -12); me().prest = clamp(me().prest + 1, 0, 100); return 'Diplomats are expelled and ' + nm(x.o) + ' retaliates.'; }),
    opt('Turn the agents', 'Risky but valuable.', () => { if (chance(0.6)) { S.intel[x.o] = S.turn; return 'The agents are turned. You now have a window into ' + nm(x.o) + '.'; } addR(S.player, x.o, -6); return 'The operation is blown. Nothing gained.'; }),
    opt('Go public', 'Rally opinion.', () => { ap(me(), 3, 4); addR(S.player, x.o, -15); return 'You expose the ring on television. The public is outraged.'; }),
  ] });
ev('cyberRival', { cat: 'intl', cd: 12, w: () => 0.55,
  ctx: () => { const o = hostile(S.player, -20).filter(x => C(x).tech >= 3); return o.length ? { o: pick(o) } : null; },
  title: x => 'Cyberattack from ' + nm(x.o), text: x => 'A wave of cyberattacks has disrupted banks and utilities. The trail leads to ' + nm(x.o) + '.',
  options: x => [
    opt('Retaliate in kind', 'Tension up.', () => { addR(S.player, x.o, -12); S.world.tension = clamp(S.world.tension + 1, 0, 100); if (chance(0.5)) { ap(me(), 3, 4); return 'Your counterstrike hits its target. The public is pleased.'; } return 'Your response is largely blocked.'; }),
    opt('Attribute publicly', 'Diplomatic pressure. Raises tension, and may not stick.', () => { addR(S.player, x.o, -8); S.world.tension = clamp(S.world.tension + 1, 0, 100); if (chance(0.4)) { ap(me(), -1, 4); return nm(x.o) + ' denies it convincingly and the accusation does not stick.'; } me().prest = clamp(me().prest + 1, 0, 100); return 'Friendly governments back your attribution. Sanctions are discussed.'; }),
    opt('Harden defences', 'Costs 0.2% of GDP.', () => { spendPct(me(), 0.2); me().secIdx = clamp(me().secIdx + 5, 0, 100); return 'Networks are patched and segmented.'; }),
  ] });
ev('refugees', { cat: 'intl', cd: 14, w: () => 0.6,
  ctx: () => { const o = nbrs(S.player).filter(x => underAttack(x) || C(x).stab < 25); if (!o.length) return null; return { o: pick(o) }; },
  title: x => 'Refugees flee ' + nm(x.o), text: x => 'Tens of thousands of people are crossing your border from ' + nm(x.o) + '. Aid groups want you to open the gates.',
  options: x => [
    opt('Open the borders', 'Costs 0.4% of GDP.', () => { spendPct(me(), 0.4); me().pop *= 1.002; me().prest = clamp(me().prest + 4, 0, 100); ap(me(), isDemo(me().gov) ? -3 : -1, 8); st(me(), -1, 8); return 'Camps go up along the frontier. The world praises you. Locals are anxious.'; }),
    opt('Controlled admission', 'Costs 0.2% of GDP.', () => { spendPct(me(), 0.2); ap(me(), -1, 6); me().prest = clamp(me().prest + 1, 0, 100); return 'You admit a limited number under an orderly programme.'; }),
    opt('Close the border', 'Popular, harsh.', () => { me().prest = clamp(me().prest - 3, 0, 100); ap(me(), 2, 6); addR(S.player, x.o, -5); return 'Soldiers seal the crossings.'; }),
  ] });
ev('neighbourCoup', { cat: 'intl', cd: 20, w: () => 0.3,
  ctx: () => { const o = nbrs(S.player).filter(x => C(x).stab < 50 && x !== S.player && !warBetween(S.player, x) && !atWar(x)); return o.length ? { o: pick(o) } : null; },
  enter: x => { const c = C(x.o); if (c) regimeChange(c, 'coup'); },
  title: x => 'Coup in ' + nm(x.o), text: x => 'A sudden change of power has shaken your neighbour ' + nm(x.o) + '. The new authorities are asking for recognition.',
  options: x => [
    opt('Recognise the new government', 'Pragmatic.', () => { addR(S.player, x.o, 6); return 'You recognise the new authorities. Relations warm cautiously.'; }),
    opt('Condemn the takeover', 'Principled.', () => { addR(S.player, x.o, -8); me().prest = clamp(me().prest + 1.5, 0, 100); return 'You condemn the takeover. Their relations with you chill.'; }),
    opt('Wait and see', 'Neutral.', () => { return 'You issue a bland statement urging calm.'; }),
  ] });
ev('armsDeal', { cat: 'intl', cd: 12, w: () => 0.45,
  ctx: () => { const o = aliveList().filter(x => x !== S.player && R(S.player, x) > 15 && C(x).tech >= 3 && C(x).army > 20); return o.length ? { o: pick(o) } : null; },
  title: x => nm(x.o) + ' offers advanced weapons', text: x => 'Arms manufacturers from ' + nm(x.o) + ' are offering a package of advanced systems on favourable terms.',
  options: x => [
    opt('Buy the package', 'Costs 1% of GDP.', () => { spendPct(me(), 1); me().army *= 1.06; fac(me(), 'military', 5); addR(S.player, x.o, 8); return 'The hardware arrives on schedule. Your generals are delighted.'; }),
    opt('Sign a cheaper deal', 'Costs 0.4% of GDP.', () => { spendPct(me(), 0.4); me().army *= 1.02; fac(me(), 'military', 2); addR(S.player, x.o, 3); return 'A smaller deal is agreed.'; }),
    opt('Decline', 'Save the money.', () => { return 'You decline. The salesmen will be back.'; }),
  ] });
ev('nukeTest', { cat: 'intl', cd: 18, w: () => 0.5,
  ctx: () => { const o = aliveList().filter(x => x !== S.player && C(x).nukes && R(S.player, x) < -20); return o.length ? { o: pick(o) } : null; },
  title: x => nm(x.o) + ' tests a new missile', text: x => 'Satellites show ' + nm(x.o) + ' has test-fired a long-range missile. The world is on edge.',
  options: x => [
    opt('Push for sanctions', 'Diplomatic response.', () => { addR(S.player, x.o, -8); me().prest = clamp(me().prest + 1, 0, 100); return 'You lead calls for tougher measures.'; }),
    opt('Boost defences', 'Costs 0.5% of GDP.', () => { spendPct(me(), 0.5); me().army *= 1.02; fac(me(), 'military', 3); return 'Air defences and early-warning systems are upgraded.'; }),
    opt('Offer talks', 'Try to de-escalate.', () => { addR(S.player, x.o, 4); S.world.tension = clamp(S.world.tension - 1, 0, 100); return 'Your offer of talks is noted, if not accepted.'; }),
  ] });
ev('unVote', { cat: 'intl', cd: 10, w: () => 0.6,
  ctx: () => { const r = S.rivals.filter(r => alive(r.a) && alive(r.b) && r.a !== S.player && r.b !== S.player && r.n >= 2); if (!r.length) return null; const p = pick(r); return { a: p.a, b: p.b }; },
  title: x => 'UN vote: ' + nm(x.a) + ' and ' + nm(x.b), text: x => 'A General Assembly resolution on the dispute between ' + nm(x.a) + ' and ' + nm(x.b) + ' is coming to a vote. Both are lobbying hard.',
  options: x => [
    opt('Vote with ' + nm(x.a), '', () => { addR(S.player, x.a, 6); addR(S.player, x.b, -6); return 'Your vote is recorded. ' + nm(x.b) + ' takes note.'; }),
    opt('Vote with ' + nm(x.b), '', () => { addR(S.player, x.b, 6); addR(S.player, x.a, -6); return 'Your vote is recorded. ' + nm(x.a) + ' takes note.'; }),
    opt('Abstain', 'Annoys both a little.', () => { addR(S.player, x.a, -1); addR(S.player, x.b, -1); return 'You abstain. Both sides sigh.'; }),
  ] });
ev('aidRequest', { cat: 'intl', cd: 12, w: () => 0.55,
  ctx: () => { const o = aliveList().filter(x => x !== S.player && !warBetween(S.player, x) && !sanctioned(S.player, x) && R(S.player, x) > -10 && ((C(x).tier <= 2 && (NB[S.player] || []).includes(x)) || (C(x).tier <= 1 && R(S.player, x) > 10 && chance(0.15)))); return o.length ? { o: pick(o) } : null; },
  title: x => nm(x.o) + ' appeals for help', text: x => 'After a crisis, ' + nm(x.o) + ' has appealed to friendly governments for emergency aid.',
  options: x => [
    opt('Generous aid', 'Costs ' + money(aidCost() * 2) + '.', () => { me().treasury -= aidCost() * 2; addR(S.player, x.o, 20); me().prest = clamp(me().prest + 2, 0, 100); return 'Your generosity is widely reported.'; }),
    opt('Token aid', 'Costs ' + money(aidCost()) + '.', () => { me().treasury -= aidCost(); addR(S.player, x.o, 7); return 'A modest package is sent.'; }),
    opt('Refuse', 'Save the money.', () => { addR(S.player, x.o, -5); return 'You decline. They remember.'; }),
  ] });
ev('seaDispute', { cat: 'intl', cd: 14, w: () => 0.5,
  ctx: () => { if (LANDLOCKED.has(S.player)) return null; const o = aliveList().filter(x => x !== S.player && !LANDLOCKED.has(x) && canReach(S.player, x) && R(S.player, x) < 25 && dist(S.player, x) < 2600 && C(x).army > 3 && C(x).gdp > 30 && !warBetween(S.player, x)); return o.length ? { o: pick(o) } : null; },
  title: x => 'Waters dispute with ' + nm(x.o), text: x => 'Survey ships from ' + nm(x.o) + ' have been spotted in waters you claim. Oil and fishing rights are at stake.',
  options: x => [
    opt('Press your claim with the navy', 'Tension up.', () => { addR(S.player, x.o, -12); fac(me(), 'military', 3); ap(me(), 2, 4); S.world.tension = clamp(S.world.tension + 1.5, 0, 100); return 'Warships shadow their vessels. Both governments issue stern statements.'; }),
    opt('Joint development', 'Share the spoils.', () => { addR(S.player, x.o, 8); gr(me(), 0.1, 24); return 'A joint development scheme is announced.'; }),
    opt('Go to international arbitration', 'Slow, respectable. The ruling could go either way.', () => { if (chance(0.5)) { me().prest = clamp(me().prest + 2, 0, 100); return 'You submit the case to a tribunal. It will be years before it rules, but the move plays well abroad.'; } return 'You submit the case to a tribunal. It draws a shrug: arbitration is what everyone expects.'; }),
  ] });
ev('greatPower', { cat: 'intl', cd: 20, w: c => c.camp === 0 ? 1 : 0.25,
  ctx: () => { if (GREATS.includes(S.player)) return null; const al = defenceAllies(S.player); if (al.some(x => GREATS.includes(x))) return null; const gp = GREATS.filter(x => x !== S.player && alive(x) && !warBetween(S.player, x)); if (gp.length < 1) return null; const o = pick(gp); const r = GREATS.filter(x => x !== o && x !== S.player && alive(x))[0]; if (!r) return null; return { o, r }; },
  title: x => nm(x.o) + ' wants you on side', text: x => nm(x.o) + ' is pressing you to align with it in its rivalry with ' + nm(x.r) + '. Staying out of it is getting harder.',
  options: x => [
    opt('Side with ' + nm(x.o), 'Gains a patron, makes an enemy.', () => { addR(S.player, x.o, 12); addR(S.player, x.r, -10); me().treasury += me().gdp * 0.004; return 'You align with ' + nm(x.o) + '. Aid and investment follow.'; }),
    opt('Stay non-aligned', 'Principled.', () => { me().prest = clamp(me().prest + 1, 0, 100); addR(S.player, x.o, -2); addR(S.player, x.r, -1); return 'You reaffirm neutrality.'; }),
    opt('Play both sides', 'High risk, high reward.', () => { if (chance(0.55)) { addR(S.player, x.o, 4); addR(S.player, x.r, 4); me().treasury += me().gdp * 0.003; return 'Both courtiers sweeten their offers. You come out ahead.'; } addR(S.player, x.o, -8); addR(S.player, x.r, -8); return 'Both suspect you of double-dealing.'; }),
  ] });

// how plausible each random event is for this country: rich, stable, orderly states do not see insurgencies or coup scares often
const stableRich = c => c.tier >= 3 && !c.fragile && c.stab >= 55 && c.free >= 50;
const EV_MULT = {
  separatists: c => stableRich(c) ? 0.15 : 1, ethnicClash: c => stableRich(c) ? 0.08 : 1, insurgency: c => stableRich(c) ? 0 : 1,
  milDemand: c => stableRich(c) ? 0.2 : 1, coupRumours: c => stableRich(c) ? 0.2 : 1, brainDrain: c => c.tier >= 4 ? 0 : 1,
  attempt: c => stableRich(c) ? 0.5 : 1, seaDispute: c => LANDLOCKED.has(c.iso) ? 0 : 1,
};

// ---------------- WORLD ----------------
function addShock(k, v, months) { S.world.shocks = S.world.shocks || []; S.world.shocks.push({ k, v, t: months, T: months }); }
ev('recession', { cat: 'world', cd: 48, w: () => 0.5,
  enter: () => { addShock('cycle', -2.0, 18); news('The global economy slides into recession.', 'economy'); },
  title: () => 'Global recession', text: () => 'A slump in global demand has hit every major economy. Trade is falling and credit is tightening.',
  options: () => [
    opt('Stimulate the economy', 'Costs 1.5% of GDP.', () => { spendPct(me(), 1.5); gr(me(), 0.6, 8); ap(me(), 1, 6); return 'A stimulus package softens the blow.'; }),
    opt('Protect key industries', 'Costs 0.6% of GDP.', () => { spendPct(me(), 0.6); addMod(me(), 'unemp', -0.3, 10); fac(me(), 'business', 3); return 'Subsidies keep major employers afloat.'; }),
    opt('Ride it out', 'Save money.', () => { ap(me(), -2, 6); return 'You hold your nerve and your budget.'; }),
  ] });
ev('oilShock', { cat: 'world', cd: 36, w: () => 0.5,
  enter: () => { addShock('oil', 0.6, 12); news('Oil prices jump sharply on supply fears.', 'economy'); },
  title: () => 'Oil price shock', text: () => me().rent > 0.04 ? 'Global oil prices have spiked after a supply disruption. As an exporter you are collecting a windfall, though your own fuel users and voters still feel the pinch.' : 'Global oil prices have spiked after a supply disruption. Fuel and transport costs are rising across your economy.',
  options: () => [
    opt('Release strategic reserves', 'Costs 0.3% of GDP.', () => { spendPct(me(), 0.3); addMod(me(), 'infl', -0.4, 6); return 'Reserves are tapped to cool the market.'; }),
    opt('Do nothing', 'Ride it out.', () => { return 'Prices work their way through the economy.'; }),
    opt('Subsidise fuel', 'Costs 0.6% of GDP.', () => { spendPct(me(), 0.6); ap(me(), 3, 6); return 'Fuel subsidies protect voters from the worst.'; }),
  ] });
ev('finCrash', { cat: 'world', cd: 60, w: () => 0.3,
  enter: () => { addShock('cycle', -3.0, 12); news('A financial crash rattles global markets.', 'economy'); },
  title: () => 'Global financial crash', text: () => 'A major financial institution has collapsed and markets everywhere are in freefall.',
  options: () => [
    opt('Emergency liquidity for banks', 'Costs 1.2% of GDP.', () => { spendPct(me(), 1.2); gr(me(), 0.3, 6); fac(me(), 'business', 3); return 'Your banking system holds up better than most.'; }),
    opt('Let markets settle', 'Cheap, exposed.', () => { gr(me(), -0.5, 8); fac(me(), 'business', -3); return 'The shock hits your economy full force.'; }),
  ] });
ev('techBoom', { cat: 'world', cd: 60, w: () => 0.35,
  enter: () => { addShock('cycle', 1.0, 24); news('A global technology boom lifts economies worldwide.', 'economy'); },
  title: () => 'Global technology boom', text: () => 'A wave of innovation is lifting growth around the world. Capital is looking for a home.',
  options: () => [
    opt('Court investors', 'Cut red tape.', () => { gr(me(), 0.3, 18); me().corr = clamp(me().corr + 1, 0, 100); return 'Investors take notice.'; }),
    opt('Invest in skills', 'Costs 0.6% of GDP.', () => { spendPct(me(), 0.6); gr(me(), 0.2, 24); return 'Training programmes prepare workers for the boom.'; }),
  ] });
ev('foodCrisis', { cat: 'world', cd: 48, w: () => 0.35,
  enter: () => { addShock('food', 1.4, 10); news('Global food prices surge, threatening poorer nations.', 'economy'); },
  title: () => 'Global food crisis', text: () => 'A run of poor harvests worldwide has pushed grain prices to record highs. Poorer countries are especially exposed.',
  options: () => [
    opt('Subsidise staples', 'Costs 0.7% of GDP.', () => { spendPct(me(), 0.7); ap(me(), 2, 6); st(me(), 2, 6); return 'Bread and cooking oil stay affordable.'; }),
    opt('Do nothing', 'Ride it out.', () => { ap(me(), -3, 6); st(me(), -2, 6); return 'Food inflation bites.'; }),
  ] });
ev('globalPandemic', { cat: 'world', cd: 120, w: () => 0.2,
  enter: () => { addShock('cycle', -2.5, 10); news('A new pandemic spreads across the globe.', 'world'); aliveList().forEach(i => addMod(C(i), 'stab', -3, 8)); },
  title: () => 'Global pandemic', text: () => 'A fast-spreading illness is sweeping the world. Borders are closing and economies are seizing up.',
  options: () => [
    opt('Lockdown and border controls', 'Safe but costly.', () => { gr(me(), -0.8, 6); ap(me(), -2, 6); st(me(), 3, 8); return 'Hard measures slow the spread.'; }),
    opt('Targeted measures', 'Balance.', () => { gr(me(), -0.4, 6); if (chance(0.3)) { st(me(), -4, 8); return 'Cases surge in your cities.'; } return 'Careful management pays off.'; }),
    opt('Vaccine diplomacy', 'Costs 0.8% of GDP.', () => { spendPct(me(), 0.8); me().prest = clamp(me().prest + 4, 0, 100); friends(S.player, 10).slice(0, 5).forEach(f => addR(S.player, f, 4)); return 'Doses shipped abroad win you friends.'; }),
  ] });

// ---------------- SYSTEM ----------------
const allyEnemy = x => { const w = S.wars.find(w => w.id === x.war); if (!w) return null; const side = warSideOf(w, x.ally) || x.side; return w.lead[side === 'a' ? 'b' : 'a']; };
const goalWords = { conquest: 'conquest', regime: 'toppling the enemy government', humiliate: 'forcing concessions' };
ev('allyCall', { cat: 'system',
  title: x => { const en = allyEnemy(x); const e = en ? nm(en) : 'an enemy'; return x.kind === 'defensive' ? nm(x.ally) + ' is attacked by ' + e : nm(x.ally) + ' goes to war with ' + e; },
  text: x => {
    const w = S.wars.find(w => w.id === x.war); const en = allyEnemy(x); const e = en ? nm(en) : 'an enemy';
    const via = x.via ? (x.via.t === 'bloc' ? 'the ' + x.via.n + ' mutual defence commitment' : 'your defence pact with ' + nm(x.ally)) : 'your ties with ' + nm(x.ally);
    let t;
    if (x.kind === 'defensive') t = e + ' has attacked ' + nm(x.ally) + '. Under ' + via + ', an attack on one is an attack on all, and you are expected to stand with them. The world is watching to see whether your word holds.';
    else t = nm(x.ally) + ' has chosen to start a war against ' + e + (w && w.goal ? ' (aim: ' + goalWords[w.goal] + ')' : '') + '. ' + (x.via ? 'The mutual defence clause of ' + via + ' is not triggered, because it covers attacks on a member, not wars of choice.' : 'You have no treaty obligation here.') + ' ' + nm(x.ally) + ' is asking for your support anyway.';
    if (w) {
      const side = warSideOf(w, x.ally) || x.side, opp = side === 'a' ? 'b' : 'a';
      const sameSide = w[side].filter(i => i !== x.ally).map(nm), otherSide = w[opp].map(nm);
      t += ' Fighting beside ' + nm(x.ally) + (sameSide.length ? ' (with ' + sameSide.join(', ') + ')' : '') + ' means fighting ' + otherSide.join(', ') + '.';
    }
    if (needsVote()) t += ' Sending troops needs a vote in parliament.';
    return t;
  },
  options: x => {
    const w = S.wars.find(w => w.id === x.war);
    const o = [];
    if (!w) return [opt('Stand down', '', () => 'The situation has changed.')];
    const en = allyEnemy(x); const e = en ? nm(en) : 'the enemy';
    const vk = x.kind === 'defensive' ? 'defend' : 'join';
    o.push(opt('Join the war', 'Send your forces. ' + nm(x.ally) + ' +12, ' + e + ' -30.' + (needsVote() ? ' Parliament backs it: ' + Math.round(voteOdds(vk, x.ally) * 100) + '%.' : ''), () => {
      const side = warSideOf(w, x.ally); if (!side) return 'The war has ended.';
      const vt = parliamentVote(vk, x.ally, null, 0);
      if (vt) { addR(S.player, x.ally, x.kind === 'defensive' ? -10 : -2); if (x.kind === 'defensive') me().prest = clamp(me().prest - 3, 0, 100); return vt + ' ' + nm(x.ally) + ' is disappointed.'; }
      w[side].push(S.player); addR(S.player, x.ally, 12); w[side === 'a' ? 'b' : 'a'].forEach(en2 => addR(S.player, en2, -30)); fac(me(), 'military', 3); logPlayer('Joined the war beside ' + nm(x.ally) + '.'); news(nm(S.player) + ' enters the war beside ' + nm(x.ally) + '.', 'war', S.player); return 'Your forces are committed beside ' + nm(x.ally) + '.';
    }));
    o.push(opt('Send military aid', 'Arms and money, no troops. Costs about 0.12% of GDP a year.', () => { const side = warSideOf(w, x.ally); if (!side) return 'The war has ended.'; w.sup[side].push(S.player); me().flags.supporting = (me().flags.supporting || []).concat([x.ally]); addR(S.player, x.ally, 6); w[side === 'a' ? 'b' : 'a'].forEach(e2 => addR(S.player, e2, -18)); return 'Arms and money flow to ' + nm(x.ally) + '. Your troops stay home.'; }));
    o.push(opt('Diplomatic support only', 'Words, not weapons.', () => { addR(S.player, x.ally, x.kind === 'defensive' ? -8 : -1); if (x.kind === 'defensive' && sharedBloc(S.player, x.ally, ['defence'])) me().prest = clamp(me().prest - 2, 0, 100); return 'You condemn the aggression and call for talks.'; }));
    o.push(opt('Refuse to get involved', x.kind === 'defensive' ? 'Breaks a commitment. Prestige and trust suffer.' : 'Perfectly legitimate. This was a war of choice.', () => { if (x.kind === 'defensive') { addR(S.player, x.ally, -25); me().prest = clamp(me().prest - 6, 0, 100); if (hasPact(S.player, x.ally)) { S.pacts = S.pacts.filter(p => !((p[0] === S.player && p[1] === x.ally) || (p[1] === S.player && p[0] === x.ally))); } } else addR(S.player, x.ally, -5); S.dirtyBase = true; return 'You decline to join. ' + nm(x.ally) + ' will remember.'; }));
    return o;
  } });
ev('warDeclared', { cat: 'system',
  title: x => nm(x.by) + ' declares war on you', text: x => 'Forces of ' + nm(x.by) + ' have crossed your frontier. ' + ({ conquest: 'Their stated aim is conquest.', regime: 'They demand a change of government.', humiliate: 'They demand humiliating concessions.' }[x.goal] || '') + (x.why ? ' ' + x.why : '') + ' You have hours to decide.',
  options: x => {
    const hold = C(x.by);
    return [
      opt('Fight', 'Full national defence.', () => { const w = startWar(x.by, S.player, { goal: x.goal, cb: true }); ap(me(), 4, 4); fac(me(), 'military', 5); westSanctions(w); logPlayer('Defending against ' + nm(x.by) + '.'); return 'Your country is at war. Your allies are being called.'; }),
      opt('Appeal to allies and the UN', 'May avert the war. May not.', () => {
        const backing = defenceAllies(S.player).reduce((s, a) => s + power(C(a)), 0) + power(me());
        const p = clamp(0.2 + 0.4 * Math.log(1 + backing / (power(hold) + 1)) / 2, 0.05, 0.6);
        if (chance(p)) { addR(S.player, x.by, -5); S.world.tension = clamp(S.world.tension + 4, 0, 100); return 'Diplomatic pressure and allied warnings force ' + nm(x.by) + ' to stand down. For now.'; }
        const w = startWar(x.by, S.player, { goal: x.goal, cb: true }); westSanctions(w); return 'The appeals fail. ' + nm(x.by) + ' presses on. You are at war.';
      }),
      opt('Sue for terms', 'Concede and hope for mercy.', () => {
        if (x.goal === 'conquest' && canAnnex(x.by, S.player) && chance(0.5)) { annex(x.by, S.player); S.over = { type: 'conquered', title: 'Your country is absorbed', text: nm(x.by) + ' accepted your surrender, then annexed the country anyway. The flag comes down.' }; return 'Annexed.'; }
        const c = me(); c.prest = clamp(c.prest - 10, 0, 100); c.stab = clamp(c.stab - 8, 0, 99); c.appr = clamp(c.appr - 12, 0, 100); c.treasury -= c.gdp * 0.02; fac(c, 'military', -12); addR(S.player, x.by, 10); return 'You accept humiliating terms. Your government survives, barely.';
      }),
    ];
  } });
ev('ceasefireOffer', { cat: 'system',
  title: x => nm(x.from) + ' proposes a ceasefire', text: x => x.dictated ? nm(x.from) + ', which is winning, offers you terms: end the fighting and accept concessions.' : nm(x.from) + ' has proposed an immediate ceasefire to open peace talks.',
  options: x => {
    const w = S.wars.find(w => w.id === x.war);
    if (!w) return [opt('Continue', '', () => 'The war has ended already.')];
    if (x.dictated) return [
      opt('Accept their terms', 'Ends the war on their terms.', () => { const ps = warSideOf(w, S.player); finishWar(w, ps === 'a' ? 'b' : 'a', 'concede'); return 'You accept the terms. The war ends.'; }),
      opt('Fight on', 'Risky.', () => { ap(me(), 2, 3); return 'You reject the offer. The war continues.'; }),
    ];
    return [
      opt('Accept the ceasefire', 'Ends the fighting.', () => { finishWar(w, null); return 'The guns fall silent.'; }),
      opt('Reject', 'Press on.', () => { return 'You reject the offer and the war continues.'; }),
    ];
  } });
ev('victoryTerms', { cat: 'system',
  title: x => x.limited ? 'A limited victory: press your terms' : 'Victory: dictate the peace', text: x => { const w = S.wars.find(w => w.id === x.war); if (!w) return 'The war has ended.'; const lo = nm(w.lead[x.side === 'a' ? 'b' : 'a']); return x.limited ? 'Your forces hold the upper hand, but ' + (x.nuker ? nm(x.nuker) + '\'s nuclear arsenal means total victory is out of reach. ' : 'the enemy has not been broken. ') + lo + ' knows it cannot win and is ready to talk. What will you demand?' : 'The enemy can fight no longer. ' + lo + ' awaits your terms. What will you demand?'; },
  options: x => {
    const w = S.wars.find(w => w.id === x.war); if (!w) return [opt('Continue', '', () => 'Done.')];
    const lose = w.lead[x.side === 'a' ? 'b' : 'a'];
    const o = [];
    o.push(opt('Annex the country', canAnnex(S.player, lose) ? 'It becomes a territory you must garrison and integrate. Expect resentment, upkeep and the world\'s disapproval.' : 'Not possible against this opponent.', () => { finishWar(w, x.side, 'annex'); return 'The flag of ' + nm(lose) + ' is lowered for the last time.'; }, { ok: canAnnex(S.player, lose), why: 'Cannot annex a nuclear power or a much larger nation.' }));
    o.push(opt('Force regime change', x.limited && x.nuker ? 'Not possible against a nuclear-armed side.' : 'Install a friendly government.', () => { finishWar(w, x.side, 'regime'); return nm(lose) + ' gets a new government friendly to you.'; }, x.limited && x.nuker ? { ok: false, why: 'A nuclear-armed government would not accept it, and pushing invites a nuclear response.' } : {}));
    o.push(opt('Impose reparations and concessions', 'Solid gains.', () => { finishWar(w, x.side, 'concede'); return 'They accept your terms and pay.'; }));
    o.push(opt('Magnanimous peace', 'Prestige and goodwill.', () => { finishWar(w, x.side, 'magnanimous'); me().prest = clamp(me().prest + 6, 0, 100); return 'A generous peace wins you respect.'; }));
    if (x.limited) o.push(opt('Fight on', 'Keep the pressure up and ask again in about six months.', () => { w.pending = false; return 'You turn down the chance to settle. The war goes on.'; }));
    return o;
  } });
ev('nuclearSignal', { cat: 'system',
  title: x => nm(x.from) + ' raises its nuclear alert', text: x => 'Losing on the battlefield, ' + nm(x.from) + ' has placed nuclear forces on heightened alert. Every capital is watching.',
  options: x => [
    opt('Press allies to de-escalate', 'Diplomacy.', () => { S.world.nukeAlert = Math.max(0, (S.world.nukeAlert || 0) - 10); me().prest = clamp(me().prest + 2, 0, 100); return 'Back-channel messages go out. The alert eases slightly.'; }),
    opt('Raise your own readiness', 'Tension up.', () => { S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + 8); fac(me(), 'military', 4); me().flags.readyBoost = 10; return 'Your forces are put on alert. The standoff hardens.'; }),
    opt('Do not respond', 'Stay calm.', () => { return 'You keep your counsel.'; }),
  ] });
ev('blocResult', { cat: 'system',
  title: x => x.ok ? 'Welcome to ' + S.blocs[x.bloc].name : S.blocs[x.bloc].name + ' rejects your application',
  text: x => x.ok ? 'Members have voted to admit you. The ceremony is scheduled and your new partners are eager to move.' : (x.veto ? nm(x.veto) + ' blocked your application. Members close ranks around the veto.' : 'Members were not convinced. Your application was turned down.'),
  options: x => [opt('Continue', '', () => x.ok ? 'You are now a member.' : 'You may apply again later.')] });
ev('campaign', { cat: 'system',
  title: () => 'Election campaign', text: () => 'Voting is two months away. Your strategists want a decision on how to fight the campaign. Current odds of victory: ' + Math.round(electionOdds(me()) * 100) + '%.',
  options: () => [
    opt('Big spending campaign', 'Costs 1% of GDP. +6 points. You promise voters no tax rises for 30 months.', () => { spendPct(me(), 1); S.flags.campaign = 0.06; return 'Ads and rallies everywhere.'; }),
    opt('Attack the opposition', '+3 points. Liberty and prestige dip.', () => { S.flags.campaign = 0.03; me().prest = clamp(me().prest - 1, 0, 100); return 'It gets ugly. Whether it works is another matter.'; }),
    opt('Run on your record', 'No change.', () => { S.flags.campaign = 0; return 'You let your record speak.'; }),
    opt('Give-away budget', 'Costs 1.5% of GDP. +9 points. You promise voters no tax rises for 30 months.', () => { spendPct(me(), 1.5); S.flags.campaign = 0.09; me().corr = clamp(me().corr + 2, 0, 100); return 'Handouts flow. The opposition cries foul.'; }),
  ] });
ev('electionResult', { cat: 'system',
  title: x => x.won ? 'You win the election' : 'You lose the election',
  text: x => x.won ? 'You have won ' + Math.round(x.share) + '% of the vote.' + (x.rigged ? ' The opposition alleges irregularities.' : '') + ' Your term is renewed.' : 'The voters have spoken.',
  options: x => [opt('Continue', '', () => 'A new term begins.')] });

// ---------------- VARIATION: alternate titles and wording so repeat events feel different ----------------
const VARIANTS = {
  strike: [
    null,
    () => LANDLOCKED.has(S.player) ? ['Rail workers walk out', 'Rail unions have voted to strike. Freight is piling up at the depots and commuters face weeks of chaos.'] : ['Rail and port workers walk out', 'Rail unions and dockers have voted to strike together. Freight is piling up at the ports and commuters face weeks of chaos.'],
    ['Nurses and teachers threaten action', 'Public sector unions are balloting for coordinated strikes over pay that has fallen behind prices. Hospitals and schools brace for disruption.'],
    ['Lorry drivers blockade the highways', 'Hauliers are threatening to block the main motorways over fuel costs. Supermarkets are already warning of empty shelves.'],
  ],
  scandal: [
    null,
    x => ['Expenses row: ' + x.minister, 'Leaked receipts show your ' + ministerLabel(x) + ' billing the state for a string of lavish personal expenses. Your own ' + legTerm(me()) + ' are demanding action.'],
    x => ['Donor scandal reaches ' + x.minister, 'A newspaper investigation links your ' + ministerLabel(x) + ' to a wealthy donor who won a large contract. ' + (isDemo(me().gov) ? 'The opposition is calling it corruption.' : 'Even ' + legTerm(me()) + ' are calling it corruption.')],
    x => [x.minister + '\'s past comes out', 'Your ' + ministerLabel(x) + ' has been caught having lied about their record. Party managers say the story will not go away by itself.'],
  ],
  protests: [
    null,
    ['Fuel price protests spread', 'Demonstrators have blocked roads in several cities after another jump in fuel prices. Police are stretched thin.'],
    ['Farmers drive tractors into the capital', 'Thousands of farmers have converged on the capital in protest at rising costs and falling prices. They say they will stay as long as it takes.'],
    x => x.sev >= 3 ? ['Angry crowds fill the squares', 'Rallies over living costs are growing each night. Opposition leaders have joined the marches and are calling for your resignation.'] : null,
  ],
  terror: [
    null,
    ['Attack on a transport hub', 'An attack on a crowded railway station has killed and injured many. Emergency services are overwhelmed and the country is on edge.'],
    ['Gunmen strike a public event', 'Armed men have opened fire at a festival. The security services have seized several suspects and the public wants reassurance.'],
  ],
  crime: [
    null,
    ['Gang violence spirals', 'A run of shootings linked to rival gangs has shocked several cities. Residents want a visible response from you.'],
    ['Cyber fraud epidemic', 'Organised fraud rings are draining savings through phishing and scam calls. Banks are begging the government to act.'],
    ['Prison overcrowding crisis', 'Jails are full and early releases are making headlines. Critics say the justice system has lost control.'],
  ],
  health: [
    null,
    ['Waiting lists hit a record', 'Patients are waiting longer than ever for treatment, and the press is full of horror stories from overstretched wards.'],
    ['Winter pressures overwhelm hospitals', 'A wave of illness has filled every ward and ambulances are queueing outside hospitals. Medical staff say they are at breaking point.'],
    ['Doctors vote for industrial action', 'Junior doctors have voted to strike over pay and conditions. Clinics are already cancelling appointments.'],
  ],
  leak: [
    null,
    ['Secret cables reach the press', 'A trove of confidential diplomatic cables has been published online. Several allies are embarrassed by what they say about them.'],
    ['Whistleblower alleges a cover-up', 'A civil servant has gone public with claims that ministers hid a costly failure. The press wants documents and you want the story to end.'],
  ],
  youth: [
    null,
    ['Students walk out of lectures', 'Campuses are emptying as students protest over tuition fees and the price of rents. The mood is restless.'],
    ['Young voters turn on the government', 'A wave of youth activism over jobs and housing is filling social media, and the polls show younger voters drifting away.'],
  ],
  housing: [
    null,
    ['Rents surge out of reach', 'Rents have jumped again and a generation of young workers cannot afford anywhere to live. Protest groups are organising.'],
    ['Property developers run into trouble', 'A large developer is on the verge of collapse, dragging banks and thousands of half-built homes with it.'],
  ],
  boom: [
    null,
    ['Tax receipts beat forecasts', 'Revenues are running far above what the treasury projected. Colleagues are already queuing to spend it.'],
    ['Exports surge', 'Foreign orders are flooding in and factories are running extra shifts. The economy is outpacing every forecast.'],
  ],
  celebration: [
    null,
    ['A cup final triumph', 'The national team has won a major tournament and the streets are full of people in national colours. It is a rare feel-good moment.'],
    ['A national hero returns', 'A celebrated scientist, athlete or artist has won a global prize, and the whole country wants to bask in the glow.'],
  ],
  dissident: [
    null,
    ['An outspoken challenger emerges', 'A former ally has broken with you and is drawing crowds. Your aides are debating whether to ignore, buy off or silence them.'],
    ['A new movement finds its voice', 'A grassroots movement led by a charismatic newcomer is filling halls in every region. It is not yet a threat, but it could become one.'],
  ],
  borderIncident: [
    null,
    x => ['Shots fired on the ' + nm(x.o) + ' frontier', 'Border patrols from ' + nm(x.o) + ' and your own forces have exchanged fire near a disputed crossing. Each side says the other shot first.'],
    x => [nm(x.o) + ' patrol crosses the line', 'A patrol from ' + nm(x.o) + ' has been found several kilometres inside your territory. Local commanders are asking for orders.'],
  ],
  summit: [
    null,
    x => ['A gathering hosted by ' + nm(x.o), nm(x.o) + ' is hosting a leaders\' forum on trade and security, and your presence is being requested. It would cost time you might not have.'],
    x => [nm(x.o) + ' proposes a leaders\' meeting', 'A quiet bilateral meeting with the leader of ' + nm(x.o) + ' is on offer. It might smooth relations, or raise expectations.'],
  ],
  tradeOffer: [
    null,
    x => [nm(x.o) + ' wants a trade pact', 'Trade negotiators from ' + nm(x.o) + ' have arrived with a draft agreement covering tariffs and investment.'],
    x => ['Business lobbies for a deal with ' + nm(x.o), 'Exporters are pressing you to sign a trade agreement with ' + nm(x.o) + ' before a rival does.'],
  ],
  aidRequest: [
    null,
    x => [nm(x.o) + ' asks for emergency relief', 'Floods, famine or conflict have left ' + nm(x.o) + ' in need. Its government has sent an urgent request to friendly capitals.'],
    x => ['An aid plea from ' + nm(x.o), 'Charities and the ' + nm(x.o) + ' government are asking wealthier countries for money and supplies. Others are watching to see who gives.'],
  ],
  refugees: [
    null,
    x => ['Border camps fill with people from ' + nm(x.o), 'Camps on your border are swelling as people flee ' + nm(x.o) + '. Local authorities say they cannot cope alone.'],
  ],
  armsDeal: [
    null,
    x => ['Defence deal on the table from ' + nm(x.o), 'A delegation from ' + nm(x.o) + ' is offering to sell advanced equipment at a discount. Your generals are very interested.'],
  ],
  seaDispute: [
    null,
    x => ['Fishing fleets clash with ' + nm(x.o), 'Coastguard vessels from ' + nm(x.o) + ' have detained some of your fishing boats. Each side claims the waters are theirs.'],
    x => ['Survey vessel near disputed waters', 'A research ship linked to ' + nm(x.o) + ' is mapping the seabed in waters you claim. It may be after oil, or after a pretext.'],
  ],
};
function evView(e, d) {
  const V = VARIANTS[e.id]; let ttl = d.title(e.ctx), txt = d.text(e.ctx);
  if (V && e.ctx.v != null) {
    let p = V[e.ctx.v % V.length];
    if (typeof p === 'function') p = p(e.ctx);
    if (p) { ttl = p[0]; txt = p[1]; }
  }
  return { title: ttl, text: txt };
}

// ---------------- ROGUE STATE NUCLEAR SCARE ----------------
function rogueCandidates() {
  return aliveList().filter(i => i !== S.player && C(i).nukes && (i === 'PRK' || (['J', 'P', 'T'].includes(C(i).gov) && C(i).stab < 28)));
}
function rogueTargets(by) {
  return aliveList().filter(x => x !== by && R(by, x) < 20 && !defenceAllies(by).includes(x) && C(x).army > 0.5 &&
    (dist(by, x) < 3600 || (C(x).nukes && rivalryOf(by, x) >= 1)));
}
function rogueRole(by, cands) {
  const me = S.player;
  if (cands.includes(me)) return 'target';
  if (defenceAllies(me).some(a => cands.includes(a))) return 'ally';
  if ((NB[by] || []).includes(me) || dist(by, me) < 2500) return 'neighbour';
  if (ranks().pow[me] <= 4) return 'power';
  return null;
}
function rogueNews() {
  const cs = rogueCandidates(); if (!cs.length) return;
  const by = pick(cs);
  news(nm(by) + ' test-fires a ballistic missile into the sea. Neighbours protest.', 'tension', by);
  S.world.tension = clamp(S.world.tension + 1.5, 0, 100); S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + 2);
}
// a nuclear-armed missile from a small state gets through: heavy damage, no world-ending exchange
function rogueStrike(by, target, severity) {
  const b = C(by), t = C(target); const sev = severity == null ? 1 : severity;
  S.world.nukeUse++; S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + 40); S.world.tension = clamp(S.world.tension + 30, 0, 100);
  news('NUCLEAR DETONATION: a missile launched by ' + b.name + ' has struck ' + t.name + '.', 'nuclear', by);
  t.stab = Math.max(5, t.stab - 25 * sev); t.gdp *= (1 - 0.06 * sev); t.pop *= (1 - 0.004 * sev); t.appr = clamp(t.appr - 3, 3, 97);
  if (target === S.player) { addMod(t, 'stab', -8 * sev, 12); addMod(t, 'growth', -1.5 * sev, 12); }
  aliveList().forEach(i => { if (i !== by) addR(i, by, -30); });
  aliveList().forEach(i => { if (i !== by && C(i).army > 10 && chance(0.5) && !sanctioned(i, by)) S.sanctions.push({ by: i, on: by, turn: S.turn }); });
  b.prest = Math.max(0, b.prest - 40);
  if (!warBetween(by, target)) startWar(by, target, { goal: 'humiliate', cb: false });
  S.dirtyBase = true;
}
const patronOf = by => aliveList().filter(x => x !== by && C(x).army > 30 && R(by, x) > 20).sort((a, b) => power(C(b)) - power(C(a)))[0] || null;

ev('rogueLaunch', { cat: 'intl', cd: 40,
  w: () => { const cs = rogueCandidates(); return cs.length ? 0.25 * (0.6 + S.world.tension / 60) : 0; },
  ctx: () => {
    const cs = rogueCandidates(); if (!cs.length) return null;
    const by = pick(cs); const cands = rogueTargets(by); if (!cands.length) return null;
    const role = rogueRole(by, cands); if (!role) return null;
    const tgt = weighted(cands, x => 1 + 3 * rivalryOf(by, x) + (R(by, x) < -20 ? 2 : 0) + (x === S.player ? 0.6 : 0));
    const r = rnd(); const truth = r < 0.5 ? 'test' : r < 0.75 ? 'shot' : r < 0.87 ? 'fail' : 'attack';
    const q = rnd(); let gkind, guess = null;
    if (truth === 'test') { gkind = q < 0.5 ? 'sea' : q < 0.75 ? 'target' : 'unclear'; }
    else if (truth === 'shot') { gkind = q < 0.75 ? 'target' : 'unclear'; }
    else if (truth === 'fail') { gkind = q < 0.5 ? 'target' : 'unclear'; }
    else { gkind = q < 0.55 ? 'target' : q < 0.75 ? 'unclear' : q < 0.9 ? 'sea' : 'wrong'; }
    if (gkind === 'target') guess = tgt;
    if (gkind === 'wrong') { const o = cands.filter(x => x !== tgt); if (o.length) guess = pick(o); else { gkind = 'target'; guess = tgt; } }
    if (gkind === 'wrong') gkind = 'target';
    const pa = patronOf(by);
    return { by, tgt, truth, role, gkind, guess, mins: 8 + Math.floor(rnd() * 20), patron: pa };
  },
  title: x => 'Launch detected in ' + nm(x.by),
  text: x => {
    const trk = x.gkind === 'target' ? 'Preliminary tracking suggests a trajectory toward ' + nm(x.guess) + ', but the track is not confirmed and may be wrong.' : x.gkind === 'sea' ? 'Early tracking suggests a lofted trajectory over open sea.' : 'The track is unclear and consistent with several destinations.';
    const intro = x.role === 'target' ? 'Alarms are sounding in your defence ministry.' : x.role === 'ally' ? 'Your allies\' warning systems and your own have picked it up.' : x.role === 'neighbour' ? 'Your radars tracked it from the moment of launch.' : 'Allies and rivals alike are asking for your assessment.';
    return 'Early warning satellites have detected a ballistic missile launch from ' + nm(x.by) + '. ' + intro + ' ' + trk + ' The missile class can carry a nuclear warhead. Analysts cannot yet say whether this is a test, a warning shot or an attack. Estimated time to impact: about ' + x.mins + ' minutes. You must decide now.';
  },
  options: x => {
    const c = me(); const by = x.by, bn = nm(by);
    const canReachRogue = canReach(S.player, by) && c.army >= 8;
    const defends = x.role === 'target' || x.role === 'ally' || x.role === 'neighbour';
    const pcOpt = (label, hint, pc, run, ok, why) => opt(label, hint + (pc ? ' (' + pcCost(pc) + ' PC)' : ''), () => { S.pc -= pc ? pcCost(pc) : 0; return run(); }, S.pc < (pc ? pcCost(pc) : 0) ? { ok: false, why: 'Not enough political capital.' } : (ok === false ? { ok: false, why } : {}));
    const out = [];
    out.push(opt('Hold and monitor', 'Wait for more data. Free, but if this is a real attack you take the full damage.', () => rogueResolve(x, 'hold')));
    out.push(pcOpt('Raise alert and warn allies', 'Disperse forces, open shelters, share intelligence. Cuts damage if it is real.', 1, () => rogueResolve(x, 'alert')));
    out.push(pcOpt('Attempt to shoot it down', 'Chance depends on your missile defence and technology. Firing on a harmless test would be a provocation.', 1, () => rogueResolve(x, 'intercept'), defends && c.tech >= 3, defends ? 'You have no missile defence capable of it.' : 'It is not heading anywhere you can defend.'));
    out.push(pcOpt('Call their patron on the hotline', x.patron ? 'Ask ' + nm(x.patron) + ' what is going on and to rein ' + bn + ' in.' : 'Ask their backers what is going on.', 2, () => rogueResolve(x, 'hotline'), !!x.patron && R(S.player, x.patron) > -60, !x.patron ? bn + ' has no patron that could be called.' : 'Relations with ' + nm(x.patron) + ' are too poor for a call.'));
    out.push(pcOpt('Order pre-emptive strikes on their launch sites', 'Starts a war with a nuclear-armed state. Catastrophic if this was only a test.', 3, () => rogueResolve(x, 'strike'), canReachRogue, 'You cannot reach them with enough force.'));
    return out;
  } });

function rogueResolve(x, choice) {
  const c = me(), by = x.by, bn = nm(by), T = x.tgt, tn = nm(T);
  const isMe = T === S.player, ally = !isMe && defenceAllies(S.player).includes(T);
  const near = isMe || ally;
  const patron = x.patron;
  const tens = d => { S.world.tension = clamp(S.world.tension + d, 0, 100); };
  const alertUp = d => { S.world.nukeAlert = Math.min(60, (S.world.nukeAlert || 0) + d); };
  // ---- pre-emptive strike: same for every truth
  const doStrike = (extra) => {
    const real = x.truth === 'attack' || x.truth === 'shot';
    const w = startWar(S.player, by, { goal: 'regime', cb: real });
    if (!real) { c.prest = clamp(c.prest - 12, 0, 100); aliveList().forEach(i => { if (i !== S.player && i !== by) addR(S.player, i, isDemo(C(i).gov) ? -7 : -3); }); if (c.gov === 'D') c.appr = clamp(c.appr - 8, 0, 100); S.cb[pkey(S.player, by)] = S.turn; }
    else { c.appr = clamp(c.appr + 4, 0, 100); }
    fac(c, 'military', 4); S.world.tension = clamp(S.world.tension + 8, 0, 100); alertUp(10);
    logPlayer('Struck ' + bn + ' after a missile launch.');
    let s = 'Your forces hit their launch sites and command posts. You are at war with ' + bn + '.';
    if (x.truth === 'attack') { swing(w, 'a', 8); rogueStrike(by, T, near ? 0.8 : 0.9); s += ' The missile already in the air still lands on ' + tn + ' before it can be stopped: it was a real attack.'; }
    else if (x.truth === 'shot') { swing(w, 'a', 6); s += ' The missile turns out to have been a warning shot that landed harmlessly in the sea. Some capitals say your reaction was justified, others say you overreacted.'; }
    else if (x.truth === 'fail') { s += ' The missile had already failed on its own. The world is calling your strike a reckless overreaction.'; }
    else { s += ' The missile splashed into the sea: it was only a test. The world condemns a strike on a state that had done nothing worse than test a missile.'; }
    return s;
  };
  if (choice === 'strike') return doStrike();

  // ---- harmless outcomes
  if (x.truth === 'fail') {
    if (choice === 'intercept') { tens(2); c.prest = clamp(c.prest - 1, 0, 100); return 'Before your interceptors can fire, the missile tumbles and breaks up on its own. It was a failed launch. Your readiness is noted, and so is the trigger-happy posture.'; }
    if (choice === 'alert') { tens(1); addMod(c, 'growth', -0.1, 3); return 'The missile fails shortly after launch. The all-clear comes within the hour. Some call the alert an overreaction, others call it prudent.'; }
    if (choice === 'hotline') { if (patron) addR(S.player, patron, 3); return nm(patron) + ' admits privately that the launch failed. The crisis fades with no one the wiser.'; }
    tens(1); return 'The missile fails shortly after launch and falls back into ' + bn + '. Nothing happens, and nobody is any the wiser about what it was meant to do.';
  }
  if (x.truth === 'test') {
    if (choice === 'intercept') { addR(S.player, by, -8); tens(4); c.prest = clamp(c.prest - 2, 0, 100); S.cb[pkey(by, S.player)] = S.turn + 24; return 'You fire on a missile that was heading out to sea. It was a test, and ' + bn + ' now has a pretext: it calls the intercept an act of war. Critics say you turned a routine provocation into a crisis.'; }
    if (choice === 'alert') { tens(1); addMod(c, 'growth', -0.1, 3); if (isDemo(c.gov)) addMod(c, 'appr', -1, 3); return 'The missile splashes down in the sea after a long flight. It was a test. The alert is stood down, and some say you overreacted.'; }
    if (choice === 'hotline') { if (patron) addR(S.player, patron, 4); c.prest = clamp(c.prest + 1, 0, 100); return nm(patron) + ' confirms that this is a test and promises to lean on ' + bn + '. The crisis is defused quietly.'; }
    tens(2); alertUp(2); c.prest = clamp(c.prest + 1, 0, 100); return 'The missile splashes into the sea a few minutes later: a test. Analysts say it flew much farther than any previous one. Your calm handling is noted.';
  }
  if (x.truth === 'shot') {
    if (choice === 'intercept') {
      const p = clamp(0.25 + 0.1 * c.tech, 0.2, 0.8);
      if (chance(p)) { c.prest = clamp(c.prest + 4, 0, 100); addR(S.player, by, -6); addR(S.player, T, 8); tens(2); return 'Your interceptors bring the missile down as it crosses ' + tn + '\'s airspace. It was a warning shot. Allies praise your reaction and ' + bn + ' rages.'; }
      c.prest = clamp(c.prest - 1, 0, 100); tens(3); return 'Your interceptors miss. The missile overflies ' + tn + ' and splashes into the sea. It was a warning shot, and the failed attempt makes you look less capable.';
    }
    if (choice === 'alert') { tens(2); if (ally) addR(S.player, T, 3); c.prest = clamp(c.prest + 1, 0, 100); return 'The missile overflies ' + tn + ' and lands in the sea. It was a warning shot. Your early warning spared a panic and ' + (near ? 'you are seen as a steady hand.' : 'allies noted the intelligence.'); }
    if (choice === 'hotline') { if (patron) addR(S.player, patron, 4); tens(-1); return nm(patron) + ' admits it was a warning shot and agrees to rein ' + bn + ' in. Tension eases slightly.'; }
    tens(4); alertUp(3); if (near) { addMod(c, 'appr', -2, 4); if (ally) addR(S.player, T, -3); } return 'The missile overflies ' + tn + ' and lands in the sea. It was a warning shot. ' + (near ? 'Voters and allies ask why nothing was done.' : 'The world condemns it but nobody acts.');
  }
  // ---- truth: a real nuclear attack
  if (choice === 'hotline') {
    if (chance(0.25)) { if (patron) addR(S.player, patron, 4); tens(6); return nm(patron) + ' reaches ' + bn + '\'s leadership in minutes and the missile is destroyed in flight by its own controllers. A catastrophe averted by a phone call.'; }
    if (patron) addR(S.player, patron, 2);
    rogueStrike(by, T, near ? 1 : 1);
    return nm(patron) + ' cannot stop it. The missile detonates over ' + tn + '. It was a real nuclear attack.' + (isMe ? ' Your country has been hit.' : '');
  }
  if (choice === 'alert') {
    if (chance(0.2)) { c.prest = clamp(c.prest + 5, 0, 100); tens(8); alertUp(10); return 'Warning time lets shelters fill and air defences engage. The missile is stopped. It was a real attack, and your early warning may have saved thousands of lives.'; }
    rogueStrike(by, T, near ? 0.5 : 1); if (near) addMod(c, 'appr', 4, 6);
    return 'The missile lands on ' + tn + '. It was a real attack. Because you raised the alert, casualties are far lower than they might have been.';
  }
  if (choice === 'intercept') {
    const p = clamp(0.25 + 0.1 * c.tech + (defenceAllies(S.player).some(a => C(a).tech >= 4 && a !== T) ? 0.1 : 0) - (isMe ? 0 : 0.05), 0.2, 0.85);
    if (chance(p)) { c.prest = clamp(c.prest + 10, 0, 100); addMod(c, 'appr', 6, 8); tens(10); alertUp(12); addR(S.player, by, -20); if (!isMe) addR(S.player, T, 10); return 'Your interceptors destroy the missile in flight. It was a real nuclear attack on ' + tn + ', and you stopped it. The world will remember it.'; }
    rogueStrike(by, T, isMe ? 0.7 : 1); return 'Your interceptors miss. The missile detonates over ' + tn + '. It was a real nuclear attack.';
  }
  // hold
  rogueStrike(by, T, 1);
  if (!isMe) { c.prest = clamp(c.prest - (ally ? 8 : 3), 0, 100); if (ally) addR(S.player, T, -15); }
  return 'The missile detonates over ' + tn + '. It was a real nuclear attack, and you did nothing.' + (isMe ? ' Your country has been hit.' : ally ? ' ' + tn + ' will not forget that you stood by.' : '');
}
