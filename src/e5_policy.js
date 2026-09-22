// ===================== DOMESTIC POLICIES =====================
const spendPct = (c, pct) => { c.treasury -= c.gdp * pct / 100; };
const gain = (c, pct) => { c.treasury += c.gdp * pct / 100; };
const hi = (c, pct) => c.gdp * pct / 100;

function diffChips(a, b) {
  const defs = [
    ['appr', 'Approval', 1, 1, 0.8], ['stab', 'Stability', 1, 1, 0.8], ['growth', 'Growth', 1, 1, 0.08], ['infl', 'Inflation', 1, -1, 0.15],
    ['unemp', 'Unemployment', 1, -1, 0.1], ['debt', 'Debt', 1, -1, 0.8], ['free', 'Liberty', 1, 1, 0.8], ['corr', 'Corruption', 1, -1, 0.8],
    ['prest', 'Prestige', 1, 1, 0.5], ['army', 'Army power', 1, 1, 1.5],
  ];
  const out = [];
  defs.forEach(([k, label, , good, th]) => {
    const d = b[k] - a[k];
    if (Math.abs(d) >= th) out.push({ label, text: (d > 0 ? '+' : '') + (Math.abs(d) >= 10 ? d.toFixed(0) : d.toFixed(1)), good: (d * good) > 0 });
  });
  const dt = b.treasury - a.treasury;
  if (Math.abs(dt) > 0.02 * Math.max(1, me().gdp) / 100) out.push({ label: 'Treasury', text: (dt > 0 ? '+' : '') + money(dt), good: dt > 0 });
  return out;
}

const POLICIES = [
  // ---- economy
  { id: 'stimulus', cat: 'Economy', name: 'Fiscal stimulus', pc: 2, cool: 10, desc: 'Costs 1.5% of GDP. Boosts growth and jobs for 8 months, nudges inflation up.',
    avail: c => debtPct(c) > 150 ? 'Markets would not fund it at this debt level.' : null,
    run: c => { spendPct(c, 1.5); addMod(c, 'growth', 1.1, 8); addMod(c, 'unemp', -0.8, 8); addMod(c, 'infl', 0.6, 10); addMod(c, 'appr', 3, 6); fac(c, 'business', 3); return 'The stimulus package is passed. Spending flows into the economy.'; } },
  { id: 'austerity', cat: 'Economy', name: 'Austerity package', pc: 3, cool: 12, desc: 'Raises 1.5% of GDP and calms markets. Drags growth and angers the public for a year.',
    avail: c => null,
    run: c => { gain(c, 1.5); addMod(c, 'growth', -0.7, 10); addMod(c, 'appr', -6, 10); fac(c, 'business', 5); fac(c, 'party', -4); c.flags.creditHit = Math.max(0, (c.flags.creditHit || 0) - 0.6); return 'Deep spending cuts are pushed through. Markets are reassured; voters are not.'; } },
  { id: 'privatise', cat: 'Economy', name: 'Privatise state assets', pc: 3, cool: 24, desc: 'One-off windfall of 3% of GDP. Business loves it, corruption may creep in.',
    avail: c => null,
    run: c => { gain(c, 3); c.corr = clamp(c.corr + 4, 0, 100); fac(c, 'business', 8); addMod(c, 'appr', -4, 6); addMod(c, 'growth', 0.2, 12); return 'State enterprises go under the hammer. The treasury is flush, and insiders are richer.'; } },
  { id: 'nationalise', cat: 'Economy', name: 'Nationalise strategic industries', pc: 3, cool: 24, desc: 'Costs 2% of GDP. Popular with the public, alarms business, slows growth.',
    avail: c => c.flags.nationalised ? 'Already done.' : null,
    run: c => { spendPct(c, 2); c.flags.nationalised = 1; fac(c, 'business', -10); addMod(c, 'growth', -0.3, 18); addMod(c, 'appr', 4, 10); c.prest = clamp(c.prest - 2, 0, 100); return 'Key industries are brought under state control. Investors flee; workers celebrate.'; } },
  { id: 'opentrade', cat: 'Economy', name: 'Liberalise trade', pc: 2, cool: 24, desc: 'Growth +0.35 for two years. Some job losses. Business approves.',
    avail: c => c.flags.tariffs ? 'Tariffs are in force. Repeal them first by choosing this policy after 24 months.' : null,
    run: c => { addMod(c, 'growth', 0.35, 24); addMod(c, 'unemp', 0.4, 12); fac(c, 'business', 5); addMod(c, 'appr', -2, 8); return 'Tariffs fall and markets open. Exporters cheer, some factories close.'; } },
  { id: 'tariffs', cat: 'Economy', name: 'Impose tariffs', pc: 2, cool: 24, desc: 'Raises about 0.35% of GDP a year. Dents growth, raises prices, irritates trade partners.',
    avail: c => c.flags.tariffs ? 'Tariffs already in place.' : null,
    run: c => { c.flags.tariffs = 1; addMod(c, 'growth', -0.3, 36); addMod(c, 'infl', 0.5, 24); S.deals.filter(d => d.includes(S.player)).forEach(d => addR(d[0], d[1], -6)); aliveList().filter(i => i !== S.player && C(i).gdp > 1500).forEach(i => addR(S.player, i, -2)); return 'New tariffs take effect. Trade partners protest.'; } },
  { id: 'megaproject', cat: 'Economy', name: 'Infrastructure megaproject', pc: 3, cool: 18, desc: 'Costs 2.5% of GDP. Lasting boost to infrastructure and growth.',
    avail: c => c.infraIdx > 85 ? 'Your infrastructure is already excellent.' : null,
    run: c => { spendPct(c, 2.5); c.infraIdx = clamp(c.infraIdx + 12, 0, 100); addMod(c, 'appr', 3, 12); addMod(c, 'growth', 0.2, 24); c.flags.prestige = (c.flags.prestige || 0) + 1; return 'Ground is broken on a flagship national project. Cranes fill the skyline.'; } },
  { id: 'green', cat: 'Economy', name: 'Green transition programme', pc: 3, cool: 24, desc: 'Costs 1.5% of GDP. Cuts exposure to energy shocks and lifts prestige. Business grumbles.',
    avail: c => c.flags.green ? 'Programme already running.' : null,
    run: c => { spendPct(c, 1.5); c.flags.green = 1; c.flags.prestige = (c.flags.prestige || 0) + 5; addMod(c, 'growth', -0.1, 12); addMod(c, 'appr', 2, 10); fac(c, 'business', -3); return 'A long-term energy transition is announced. Allies applaud.'; } },
  { id: 'ratehike', cat: 'Economy', name: 'Tighten monetary policy', pc: 1, cool: 12, desc: 'Knocks about 1.8 points off inflation over a year. Slows growth, lifts unemployment.',
    avail: c => EUROZONE.has(c.iso) ? 'Interest rates are set by the European Central Bank, not by you.' : c.infl < c.baseInfl + 1 ? 'Inflation is already under control.' : null,
    run: c => { addMod(c, 'infl', -1.8, 12); addMod(c, 'growth', -0.5, 8); addMod(c, 'unemp', 0.4, 10); addMod(c, 'appr', -2, 6); fac(c, 'business', -2); return 'Interest rates go up. Mortgage holders wince.'; } },
  { id: 'printmoney', cat: 'Economy', name: 'Print money', pc: 1, cool: 12, desc: 'Instant 1.5% of GDP. Inflation surges for over a year. Emergency use only.',
    avail: c => EUROZONE.has(c.iso) ? 'The euro is issued by the European Central Bank, not by you.' : null,
    run: c => { gain(c, 1.5); addMod(c, 'infl', 2.5, 18); fac(c, 'business', -3); c.flags.creditHit = (c.flags.creditHit || 0) + 0.4; return 'The central bank creates the money. It will show up in prices soon enough.'; } },
  { id: 'debtdeal', cat: 'Economy', name: 'Renegotiate national debt', pc: 3, cool: 36, desc: 'Cuts debt by 10%. Lenders punish you with higher rates and lost prestige.',
    avail: c => debtPct(c) < 80 ? 'Your debt is not high enough to justify it.' : null,
    run: c => { writeDown(c, c.debtAbs * 0.1); c.prest = clamp(c.prest - 5, 0, 100); c.flags.creditHit = (c.flags.creditHit || 0) + 1.5; fac(c, 'business', -6); return 'Creditors accept a haircut, and remember it.'; } },
  { id: 'paydebt', cat: 'Economy', name: 'Pay down debt', pc: 1, cool: 6, desc: 'Costs 1% of GDP, paid straight off the national debt instead of into new spending.',
    avail: c => c.debtAbs <= c.gdp * 0.01 ? 'Your debt is already negligible.' : null,
    dyn: c => 'Costs ' + money(c.gdp * 0.01) + ', paid straight off the national debt (' + money(c.debtAbs) + ' owed) instead of into new spending.',
    run: c => { const pay = Math.min(c.gdp * 0.01, c.debtAbs); spendPct(c, pay * 100 / c.gdp); c.debtAbs = Math.max(0, c.debtAbs - pay); c.netMark = c.treasury - c.debtAbs; return 'You direct ' + money(pay) + ' straight off the national debt instead of into new spending. Debt now stands at ' + money(c.debtAbs) + '.'; } },
  { id: 'subsidy', cat: 'Economy', name: 'Cost-of-living subsidies', pc: 1, cool: 6, desc: 'Costs 0.6% of GDP. Quick approval boost for 8 months.',
    avail: c => null,
    run: c => { spendPct(c, 0.6); addMod(c, 'appr', 3, 8); addMod(c, 'infl', -0.3, 8); return 'Food and fuel subsidies are extended. The public breathes easier.'; } },
  { id: 'warbonds', cat: 'Economy', name: 'Issue war bonds', pc: 2, cool: 12, desc: 'Raises 2% of GDP in debt while at war. Public sentiment goes up a little.',
    avail: c => atWar(c.iso) ? null : 'Only during wartime.',
    run: c => { gain(c, 2); c.debtAbs += hi(c, 2); addMod(c, 'appr', 2, 4); return 'War bonds sell out. Patriotic fervour helps.'; } },
  // ---- society
  { id: 'health', cat: 'Society', name: 'Expand public healthcare', pc: 3, cool: 24, desc: 'Permanently adds 1.5% of GDP to social spending. Popular, stabilising, expensive.',
    avail: c => c.spend.social > 30 ? 'Already generous.' : null,
    run: c => { c.spend.social = clamp(c.spend.social + 1.5, 0, 40); addMod(c, 'appr', 4, 8); addMod(c, 'stab', 2, 12); fac(c, 'party', 3); return 'Healthcare access widens. Clinics open across the country.'; } },
  { id: 'pensions', cat: 'Society', name: 'Reform pensions', pc: 3, cool: 24, desc: 'Cuts social spending by 0.8% of GDP. Brings protests.',
    avail: c => c.spend.social < 5 ? 'Nothing left to cut.' : null,
    run: c => { c.spend.social = clamp(c.spend.social - 0.8, 0, 40); addMod(c, 'appr', -8, 10); fac(c, 'business', 4); fac(c, 'party', -4); addMod(c, 'stab', -2, 8); return 'The retirement age rises and benefits are trimmed. Trade unions call demonstrations.'; } },
  { id: 'education', cat: 'Society', name: 'Education and skills drive', pc: 2, cool: 18, desc: 'Costs 1% of GDP. Slow growth dividend and steadier society.',
    avail: c => null,
    run: c => { spendPct(c, 1); addMod(c, 'growth', 0.15, 36); addMod(c, 'stab', 1, 24); addMod(c, 'appr', 2, 10); return 'A national skills programme launches. The payoff will take years.'; } },
  { id: 'immig+', cat: 'Society', name: 'Open immigration', pc: 2, cool: 24, desc: 'Population and growth up. Some backlash.',
    avail: c => c.flags.immig === 1 ? 'Already open.' : null,
    run: c => { c.flags.immig = 1; c.pop *= 1.004; addMod(c, 'growth', 0.2, 24); addMod(c, 'appr', -3, 10); fac(c, 'party', -2); addMod(c, 'stab', -1, 12); return 'Visa rules are relaxed. Businesses welcome new workers, nationalists do not.'; } },
  { id: 'immig-', cat: 'Society', name: 'Restrict immigration', pc: 2, cool: 24, desc: 'Pleases nationalists and lowers migrant flows. Costs some growth.',
    avail: c => c.flags.immig === -1 ? 'Already restricted.' : null,
    run: c => { c.flags.immig = -1; addMod(c, 'appr', 2, 10); fac(c, 'business', -3); addMod(c, 'growth', -0.1, 24); return 'Border and visa rules tighten. Nationalists cheer.'; } },
  { id: 'housing', cat: 'Society', name: 'National housing programme', pc: 2, cool: 18, desc: 'Costs 1.2% of GDP. Builds goodwill and jobs. Contracts attract graft.',
    avail: c => null,
    run: c => { spendPct(c, 1.2); addMod(c, 'appr', 4, 10); addMod(c, 'unemp', -0.3, 12); c.corr = clamp(c.corr + 2, 0, 100); return 'Housing construction ramps up. Cement companies are thrilled.'; } },
  { id: 'execoffice', cat: 'Power', name: 'Expand the executive office', pc: 7, cool: 999, desc: 'A one-time investment in state capacity, not a recurring cost. Lets you run a third national programme alongside your existing ones.',
    avail: c => c.flags.thirdSlot ? 'Already expanded.' : null,
    run: c => { c.flags.thirdSlot = 1; c.corr = clamp(c.corr + 2, 0, 100); logPlayer('The executive office is expanded. A third national programme slot is now available.'); return 'New ministries and planning staff are stood up. You can now run a third national programme at once, though the bigger apparatus adds a little friction and corruption.'; } },
  { id: 'anticorr', cat: 'Society', name: 'Anti-corruption drive', pc: 3, cool: 18, desc: 'Cuts corruption sharply. Powerful people will resist.',
    avail: c => c.corr < 25 ? 'Corruption is already low.' : null,
    run: c => { c.corr = clamp(c.corr - 9, 0, 100); fac(c, 'party', -6); fac(c, 'business', -4); addMod(c, 'appr', 4, 8);
      if (chance(0.3)) { fac(c, 'party', -5); addMod(c, 'stab', -3, 6); return 'Arrests begin, but entrenched interests hit back hard. Your party is nervous.'; }
      return 'Senior officials are prosecuted. The public approves. Insiders are furious.'; } },
  { id: 'reshuffle', cat: 'Society', name: 'Cabinet reshuffle', pc: 1, cool: 6, desc: 'Refreshes your team. Clears the stench of scandal and settles your party.',
    avail: c => null,
    run: c => { fac(c, 'party', 5); c.flags.recentScandal = 0; addMod(c, 'appr', 1, 4); const t = reshuffleCabinet(); return 'You bring in new faces. ' + (t ? t + ' ' : '') + 'The old guard sulks, the press has a new story.'; } },
  // ---- security and power
  { id: 'emergency', cat: 'Power', name: 'Declare state of emergency', pc: 2, cool: 12, desc: 'Stability up sharply for six months. Liberty and prestige suffer.',
    avail: c => c.stab > 65 ? 'There is no emergency to speak of.' : null,
    run: c => { addMod(c, 'stab', 8, 6); c.free = clamp(c.free - 8, 0, 100); addMod(c, 'appr', -5, 6); c.prest = clamp(c.prest - 3, 0, 100); fac(c, 'military', 4); fac(c, 'business', -3); addMod(c, 'growth', -0.2, 6); return 'Curfews and emergency powers are in force. The streets go quiet.'; } },
  { id: 'press', cat: 'Power', name: 'Tighten media controls', pc: 2, cool: 12, desc: 'Fewer scandals and better coverage. Liberty and prestige drop.',
    avail: c => c.free < 12 ? 'There is little left to tighten.' : null,
    run: c => { c.free = clamp(c.free - 10, 0, 100); addMod(c, 'appr', 3, 12); addMod(c, 'stab', 2, 8); c.prest = clamp(c.prest - 4, 0, 100); c.corr = clamp(c.corr + 2, 0, 100); c.flags.press = S.turn + 24; fac(c, 'business', -4); addMod(c, 'growth', -0.15, 12); return 'Editors get calls from the ministry. Coverage turns friendlier.'; } },
  { id: 'pressfree', cat: 'Power', name: 'Expand civil liberties', pc: 2, cool: 12, desc: 'Liberty and prestige up. Short-term messiness.',
    avail: c => c.free > 88 ? 'Liberties are already extensive.' : null,
    run: c => { c.free = clamp(c.free + 10, 0, 100); addMod(c, 'appr', 3, 8); c.corr = clamp(c.corr - 3, 0, 100); addMod(c, 'stab', -2, 6); c.prest = clamp(c.prest + 3, 0, 100); c.flags.press = 0; return 'Restrictions are lifted. Critics speak more freely, and more loudly.'; } },
  { id: 'purge', cat: 'Power', name: 'Purge the armed forces', pc: 3, cool: 18, desc: 'Removes disloyal officers. Coup risk falls for a year. Army effectiveness and support suffer.',
    avail: c => null,
    run: c => { fac(c, 'military', -14); addMod(c, 'fmilitary', -4, 12); c.flags.coupProof = S.turn + 12; c.readiness = Math.max(10, c.readiness - 10); c.army *= 0.96; return 'Dozens of officers are retired, jailed or vanish. The rest learn to keep quiet.'; } },
  { id: 'milpay', cat: 'Power', name: 'Military pay and modernisation', pc: 2, cool: 12, desc: 'Costs 1.2% of GDP. Wins the generals and slowly improves technology.',
    avail: c => null,
    run: c => { spendPct(c, 1.2); fac(c, 'military', 12); c.techProg = (c.techProg || 0) + 1; c.flags.readyBoost = 6; let extra = ''; if (c.techProg >= 4 && c.tech < 5) { c.tech++; c.techProg = 0; extra = ' Your armed forces reach a new technological tier.'; } return 'Salaries rise and new equipment arrives.' + extra; } },
  { id: 'conscript', cat: 'Power', name: 'Introduce conscription', pc: 2, cool: 24, desc: 'Army power +12%. Youth unemployment eases. Unpopular with families.',
    avail: c => c.flags.conscript ? 'Already in force.' : null,
    run: c => { c.flags.conscript = 1; c.army *= 1.12; addMod(c, 'unemp', -0.4, 24); addMod(c, 'appr', isDemo(c.gov) ? -6 : -3, 12); fac(c, 'military', 5); return 'A national service law is passed. Recruiters are busy.'; } },
  { id: 'propaganda', cat: 'Power', name: 'Run a public information campaign', pc: 1, cool: 8, desc: 'Costs 0.3% of GDP. Approval up for eight months. Works better where the media is controlled.',
    avail: c => null,
    run: c => { spendPct(c, 0.3); addMod(c, 'appr', c.free < 40 ? 4 : 2, 8); if (c.free < 40) c.free = clamp(c.free - 2, 0, 100); return 'A slick campaign fills screens and billboards. Numbers tick upward.'; } },
  { id: 'snap', cat: 'Power', name: 'Call a snap election', pc: 2, cool: 24, desc: 'Go to the country early. A win renews your mandate. A loss ends your leadership.', dyn: c => 'Go to the country early. A win renews your mandate. A loss ends your game. Your odds today: about ' + Math.round((electionOdds(c) - 0.03) * 100) + '%.',
    avail: c => !isDemo(c.gov) ? 'Not available under your system.' : S.turn < 12 ? 'Too soon after taking office. Try again after your first year.' : S.electionIn < 12 ? 'An election is due within the year, so an early vote gains you nothing.' : atWar(c.iso) ? 'Not during a war.' : null,
    run: c => { const p = electionOdds(c) - 0.03; if (chance(p)) { S.electionIn = GOV[c.gov].term; S.terms = (S.terms || 1) + 0; addMod(c, 'appr', 6, 8); fac(c, 'party', 8); S.pc = Math.min(S.pcMax, S.pc + 2); return 'You win a fresh mandate at the ballot box. The opposition is in disarray.'; } S.over = { type: 'election', title: 'Lost the snap election', text: 'The gamble did not pay off. Voters chose someone else, and your time in office is over.' }; return 'Defeat.'; } },
  { id: 'consolidate', cat: 'Power', name: 'Concentrate executive power', pc: 6, cool: 36, desc: 'Weaken checks on your rule. Hollows out democracy. Approval and party support take a hit.',
    avail: c => c.gov === 'D' || c.gov === 'H' ? null : 'Your power is already concentrated.',
    run: c => { const to = c.gov === 'D' ? 'H' : 'P'; c.gov = to; const g = GOV[to]; c.free = Math.max(15, c.free - 22); c.corr = clamp(c.corr + 8, 0, 100); addMod(c, 'appr', -6, 10); fac(c, 'party', -8); fac(c, 'military', 8); S.pcMax = g.pcMax; S.electionIn = to === 'H' ? Math.max(S.electionIn, 24) : 0; c.flags.customGov = 1; S.dirtyBase = true; c.prest = clamp(c.prest - 8, 0, 100); news(c.name + ' moves toward one-man rule.', 'politics', c.iso); return 'Term limits loosen and courts are packed. You are now running a ' + g.name.toLowerCase() + '.'; } },
  { id: 'opening', cat: 'Power', name: 'Political opening and reform', pc: 6, cool: 36, desc: 'Move toward a freer, more accountable system. Hardliners may not accept it.',
    avail: c => c.gov === 'D' ? 'You are already a liberal democracy.' : null,
    run: c => {
      const to = c.gov === 'H' ? 'D' : 'H'; const g = GOV[to];
      if (chance(clamp((60 - c.fac.military) / 60 * 0.35, 0, 0.35))) { S.over = { type: 'coup', title: 'Hardliners strike first', text: 'The generals and old guard decided your reforms went too far. They moved before the first free vote could be held.' }; return 'Coup.'; }
      c.gov = to; c.free = clamp(c.free + 25, 0, 100); c.corr = clamp(c.corr - 6, 0, 100); addMod(c, 'stab', -8, 14); addMod(c, 'growth', -0.4, 12); fac(c, 'party', -10); fac(c, 'military', -10); fac(c, 'public', 8); c.appr = clamp(c.appr + 8, 0, 100); c.prest = clamp(c.prest + 8, 0, 100);
      S.pcMax = g.pcMax; if (isDemo(to)) S.electionIn = 18; c.flags.customGov = 1; S.dirtyBase = true; news(c.name + ' begins a political opening.', 'politics', c.iso); return 'The system opens. You are now leading a ' + g.name.toLowerCase() + '. The world takes notice.'; } },
  { id: 'amnesty', cat: 'Power', name: 'Amnesty and dialogue with dissidents', pc: 2, cool: 12, desc: 'Defuses unrest and separatist tensions. Hardliners grumble.',
    avail: c => null,
    run: c => { addMod(c, 'stab', 4, 8); c.free = clamp(c.free + 4, 0, 100); fac(c, 'military', -3); fac(c, 'party', -2); c.flags.dialogue = S.turn + 18; return 'Prisoners are released and talks begin. Tensions ease.'; } },
  { id: 'cyber', cat: 'Power', name: 'Cyber defence programme', pc: 2, cool: 24, desc: 'Costs 0.6% of GDP. Hardens your networks against attack and sabotage.',
    avail: c => c.flags.cyber ? 'Already in place.' : null,
    run: c => { spendPct(c, 0.6); c.flags.cyber = 1; c.secIdx = clamp(c.secIdx + 8, 0, 100); return 'A national cyber command is created.'; } },
  { id: 'space', cat: 'Power', name: 'National prestige project', pc: 3, cool: 24, desc: 'Costs 1.5% of GDP. A space programme or global sporting event lifts prestige and mood.',
    avail: c => null,
    run: c => { spendPct(c, 1.5); c.flags.prestige = (c.flags.prestige || 0) + 6; addMod(c, 'appr', 4, 10); return 'The world tunes in. National pride swells.'; } },
  { id: 'nukeprog', cat: 'Power', name: 'Launch nuclear weapons programme', pc: 5, cool: 999, desc: 'Costs 3% of GDP. Two years to a bomb. Sanctions, alarm and possible pre-emption if discovered.',
    avail: c => c.nukes ? 'You already have nuclear weapons.' : c.flags.nukeProg ? 'Programme underway.' : c.tech < 3 ? 'Your technology base is too weak.' : c.gdp < 60 ? 'Economy too small to sustain it.' : null,
    run: c => { spendPct(c, 3); c.flags.nukeProg = 24; fac(c, 'military', 8); c.flags.prestige = (c.flags.prestige || 0) + 2; return 'A secret programme is launched. The clock is ticking. Discovery would be a crisis.'; } },
];
const POLICY_BY = {}; POLICIES.forEach(p => POLICY_BY[p.id] = p);

function policyList() {
  const c = me();
  return POLICIES.map(p => {
    let why = p.avail(c);
    const need = pcCost(p.pc);
    if (!why && S.cool[p.id] && S.cool[p.id] > S.turn) why = 'Available again in ' + mo(S.cool[p.id] - S.turn) + '.';
    if (!why && S.pc < need) why = 'Not enough political capital.';
    return { id: p.id, cat: p.cat, name: p.name, desc: p.dyn ? p.dyn(c) : p.desc, pc: need, ok: !why, why };
  });
}
function enact(id) {
  const p = POLICY_BY[id]; if (!p) return { ok: false, text: 'Unknown policy.' };
  const info = policyList().find(x => x.id === id);
  if (!info.ok) return { ok: false, text: info.why };
  const c = me(); const before = snapshot(c);
  S.pc -= info.pc; S.cool[id] = S.turn + (p.cool || 6);
  const text = withSrc(p.name, () => p.run(c));
  S.stat.policies++;
  logPlayer(p.name + ': ' + text);
  return { ok: true, text, chips: diffChips(before, snapshot(c)) };
}

// budget sliders
const BUDGET_LIM = { tax: [5, 60], social: [0, 30], mil: [0.1, 15], infra: [0, 12], sec: [0, 10] };
function setBudget(key, val) {
  const c = me(); const lim = BUDGET_LIM[key]; if (!lim) return false;
  val = clamp(Math.round(val * 10) / 10, lim[0], lim[1]);
  if (key === 'tax') c.tax = val; else c.spend[key] = val;
  return true;
}
function setMobilisation(level) {
  const c = me(); level = clamp(Math.round(level), 0, 3);
  if (level > c.mob && S.pc < 1) return false;
  if (level > c.mob) { S.pc -= 1; addMod(c, 'appr', -1.5 * (level - c.mob), 6); }
  c.mob = level; return true;
}
function setStance(warId, stance) {
  const w = S.wars.find(x => x.id === warId); if (!w) return false;
  const side = warSideOf(w, S.player); if (!side) return false;
  w.stance[side] = stance; return true;
}
