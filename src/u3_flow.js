// ===================== SETUP, EVENTS, FLOW, BOOT =====================
const DIFFS = [[0.7, 'Relaxed', 'Forgiving. Plots and coups are rarer.'], [1, 'Standard', 'A fair fight.'], [1.4, 'Hard', 'Enemies at home are sharper.'], [1.9, 'Brutal', 'Everything wants you gone.']];
const TEMPERS = [[0, 'Calm world', 'No wars at the start, cooler rivalries.'], [1, 'Realistic', 'Starts roughly like the real world.'], [1.6, 'Volatile', 'More wars, more risk of escalation.']];
const GOV_ORDER = ['D', 'H', 'M', 'O', 'J', 'T', 'P'];

function standing(r) {
  const tags = [];
  if (r.gdp > 10000) tags.push('Superpower'); else if (r.gdp > 1500 || r.nukes) tags.push('Major power'); else if (r.gdp > 300) tags.push('Middle power'); else if (r.gdp > 40) tags.push('Small state'); else tags.push('Micro-state');
  if (r.nukes) tags.push('Nuclear-armed'); if (r.fragile) tags.push('Fragile');
  return tags;
}
function startWarsOf(iso) { try { return (WORLDDATA.startWars || []).filter(w => w[0] === iso || w[1] === iso).map(w => w[0] === iso ? w[1] : w[0]); } catch (e) { return []; } }
function blocsOfStart(iso) { try { return WORLDDATA.blocs.filter(b => b.members.includes(iso)).map(b => b.id); } catch (e) { return []; } }

function countryListHtml() {
  const q = UI.setup.q.trim().toLowerCase();
  const all = E.ISOS.map(i => E.ROW[i]).filter(r => !q || r.name.toLowerCase().includes(q) || r.iso.toLowerCase() === q).sort((a, b) => b.gdp - a.gdp);
  if (!all.length) return '<div class="muted" style="padding:10px">No country matches.</div>';
  return all.map(r => '<button data-act="pickc" data-id="' + r.iso + '" class="' + (r.iso === UI.setup.iso ? 'on' : '') + '"><span>' + esc(r.name) + '</span><span class="faint mono">' + esc(E.money(r.gdp)) + '</span></button>').join('');
}
function setupView() {
  const st = UI.setup, r = E.ROW[st.iso], gov = st.gov || r.gov;
  const sw = startWarsOf(st.iso), bl = blocsOfStart(st.iso);
  let out = '<div class="setup"><h1>Head<br>of State</h1><div class="lede">Run a country for as long as you can hold it. Balance a budget, keep your power base loyal, and survive a world of rivals, allies and wars. Figures are simplified and approximate.</div>';
  const saved = store.get(SAVE_KEY);
  if (saved) out += '<button class="btn big primary" data-act="continue" style="width:100%;margin-bottom:6px">Continue saved game</button>';
  if (saveRows().some(r => r.has)) out += '<button class="btn" data-act="saves" style="width:100%;margin-bottom:8px">Saved games and earlier autosaves</button>';
  out += '<div class="field"><div class="lab">1. Your nation <small style="text-transform:none;letter-spacing:0" class="faint">Or click it on the map</small></div>' +
    '<input class="input" id="cq" type="search" placeholder="Search countries" value="' + esc(st.q) + '" autocomplete="off"><div class="countrylist" id="clist">' + countryListHtml() + '</div></div>';
  out += '<div class="field" id="csum">' + countrySummary(r, sw, bl) + '</div>';
  out += '<div class="field"><div class="lab">2. Form of government</div><div class="pickers">' + GOV_ORDER.map(k => {
    const g = E.GOV[k]; const cr = g.coup < 0.04 ? 'low' : g.coup < 0.11 ? 'moderate' : 'high';
    return '<button class="pick ' + (gov === k ? 'on' : '') + '" data-act="pickg" data-id="' + k + '"><b>' + esc(g.name) + (k === r.gov ? '<span class="chip">Current</span>' : '') + '</b><span>' + esc(g.desc) + '</span><span class="faint">' + (g.term ? 'Elections every ' + g.term / 12 + ' years' : 'No elections') + ', coup risk ' + cr + ', room to act ' + (g.pcMax >= 13 ? 'wide' : g.pcMax >= 12 ? 'good' : 'limited') + '</span></button>';
  }).join('') + '</div></div>';
  out += '<div class="field"><label for="lname">3. Your name</label><input class="input" id="lname" maxlength="32" placeholder="Leave blank for a default" value="' + esc(st.leader) + '"></div>';
  out += '<div class="field"><div class="lab">4. Difficulty</div><div class="seg" style="width:100%">' + DIFFS.map(d => '<button style="flex:1" data-act="pickd" data-id="' + d[0] + '" class="' + (st.diff === d[0] ? 'on' : '') + '">' + d[1] + '</button>').join('') + '</div><div class="faint" style="font-size:12px;margin-top:4px">' + esc(DIFFS.find(d => d[0] === st.diff)[2]) + '</div></div>';
  out += '<div class="field"><div class="lab">5. State of the world</div><div class="seg" style="width:100%">' + TEMPERS.map(d => '<button style="flex:1" data-act="pickt" data-id="' + d[0] + '" class="' + (st.temper === d[0] ? 'on' : '') + '">' + d[1] + '</button>').join('') + '</div><div class="faint" style="font-size:12px;margin-top:4px">' + esc(TEMPERS.find(d => d[0] === st.temper)[2]) + '</div></div>';
  { const SC = E.SCENARIOS(), AM = E.AMBITIONS();
    out += '<div class="field"><div class="lab">6. Starting situation</div><div class="pickers">' + Object.keys(SC).map(k => '<button class="pick ' + (st.scenario === k ? 'on' : '') + '" data-act="picks" data-id="' + k + '"><b>' + esc(SC[k].n) + '</b><span>' + esc(SC[k].d) + '</span></button>').join('') + '</div></div>';
    const defA = SC[st.scenario].amb;
    out += '<div class="field"><div class="lab">7. Your ambition</div><div class="pickers">' +
      '<button class="pick ' + (st.ambition === 'auto' ? 'on' : '') + '" data-act="picka" data-id="auto"><b>' + (defA ? 'Suggested: ' + esc(AM[defA].n) : 'None') + '</b><span>' + (defA ? esc(AM[defA].d) : 'Play for the score alone.') + '</span></button>' +
      Object.keys(AM).filter(k => k !== defA).map(k => '<button class="pick ' + (st.ambition === k ? 'on' : '') + '" data-act="picka" data-id="' + k + '"><b>' + esc(AM[k].n) + '</b><span>' + esc(AM[k].d) + '</span></button>').join('') +
      '<button class="pick ' + (st.ambition === 'none' ? 'on' : '') + '" data-act="picka" data-id="none"><b>No ambition</b><span>Play for the score alone.</span></button></div></div>'; }
  if (gov === 'D') out += '<div class="field"><label class="check"><input type="checkbox" id="tl" ' + (st.term ? 'checked' : '') + '> Two-term limit. Democratic presidents must step down after eight years.</label></div>';
  out += '<button class="btn big primary" data-act="start" style="width:100%;margin-top:18px">Take office as leader of ' + esc(r.name) + '</button>';
  out += '<div class="notice">Loosely based on the world of the mid 2020s. Stats are rough approximations and no real leaders appear in the game. Your saved game stays in this browser.</div></div>';
  return out;
}
function countrySummary(r, sw, bl) {
  const tags = standing(r);
  return '<div class="war-card" style="margin:0"><h4><span>' + esc(r.name) + '</span><span class="faint" style="font-size:13px;font-family:var(--font-body)">' + esc(r.region) + '</span></h4>' +
    '<div class="chips" style="margin:6px 0">' + tags.map(t => '<span class="chip acc">' + t + '</span>').join('') + bl.map(b => '<span class="chip info">' + esc(b) + '</span>').join('') + sw.map(x => '<span class="chip bad">At war with ' + esc(E.ROW[x] ? E.ROW[x].name : x) + '</span>').join('') + '</div>' +
    '<div class="grid2"><div class="stat"><span class="k">Population</span><span class="v">' + esc(E.popStr(r.pop)) + '</span></div><div class="stat"><span class="k">Economy</span><span class="v">' + esc(E.money(r.gdp)) + '</span></div>' +
    '<div class="stat"><span class="k">GDP per person</span><span class="v">' + (r.gdp * 1000 / r.pop >= 1000 ? '$' + f1(r.gdp / r.pop) + 'k' : '$' + f0(r.gdp * 1000 / r.pop)) + '</span></div><div class="stat"><span class="k">Military budget</span><span class="v">' + esc(E.money(r.mil)) + '</span></div></div></div>';
}

function setCountry(iso, fromMap) {
  UI.setup.iso = iso; UI.setup.gov = null;
  renderMap(); if (fromMap) MapView.focus(iso, 2.2);
  const keepQ = $('#cq'); const qv = keepQ ? keepQ.value : '';
  renderDock(); const q = $('#cq'); if (q) q.value = qv;
  const on = $('#clist .on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}

function startGame() {
  const st = UI.setup; const r = E.ROW[st.iso];
  const nameEl = $('#lname'); if (nameEl) st.leader = nameEl.value.trim();
  const gov = st.gov || r.gov;
  E.newGame({ player: st.iso, gov: gov, leader: st.leader || defaultName(gov), diff: st.diff, temper: st.temper, termLimits: gov === 'D' ? st.term : false, scenario: st.scenario, ambition: st.ambition === 'auto' ? undefined : st.ambition });
  UI.mode = 'play'; UI.tab = 'home'; UI.sel = null; UI.mapMode = 'rel';
  MapView.buildLabels(); renderAll({ resetScroll: true }); MapView.focus(st.iso, 2.4);
  save(); showIntro();
}
const NAMES = ['Ada Okoro', 'Mateo Rios', 'Lena Voss', 'Kenji Aoki', 'Nadia Farouk', 'Tomas Brandt', 'Priya Nair', 'Idris Mbeki', 'Sofia Marek', 'Daniel Achterberg', 'Yara Haddad', 'Emil Sorensen', 'Amara Diallo', 'Rafael Costa'];
function defaultName(gov) { return NAMES[Math.floor(Math.random() * NAMES.length)]; }

function showIntro() {
  const c = E.me(), g = E.GOV[c.gov];
  const brief = E.briefing();
  openModal('<div class="mh"><div class="eyebrow">' + esc(E.dateLabel()) + '</div><h2>You are the ' + esc(g.leader.toLowerCase()) + ' of ' + esc(c.name) + '</h2></div><div class="mb"><p>' + esc(g.desc) + '</p>' +
    '<ul class="brief">' + brief.map(b => '<li class="' + b.lvl + '">' + esc(b.text) + '</li>').join('') + '</ul>' +
    '<p class="muted" style="font-size:13px">Each turn is a month. Use <b>political capital</b> (the pips at the top) on policies and diplomacy, set your budget, watch your power base, then press <b>End month</b> or Space. Click any country on the map to deal with it.</p>' +
    '<div class="opts"><button class="opt" data-act="closemodal" data-focus="1"><b>Begin</b><span>Take the first month</span></button></div></div>');
}

// ---------- events ----------
const CATLAB = { domestic: 'Home affairs', intl: 'International', politics: 'Politics', economy: 'Economy', world: 'World affairs', war: 'War', crisis: 'Crisis', social: 'Society', security: 'Security', scandal: 'Scandal', diplomacy: 'Diplomacy', system: 'Developing', story: 'Storyline' };
function pump() {
  if (UI.modalOpen || !S()) return;
  const s = S();
  if (s.over) { showGameOver(); return; }
  if (E.annualPending()) { showAnnual(E.annualLatest(), true); return; }
  const ev = E.currentEvent();
  if (ev) showEvent(ev);
}
function showEvent(ev) {
  const opts = ev.options.map(o => '<button class="opt" data-act="evopt" data-i="' + o.i + '" ' + (o.ok ? '' : 'disabled') + '><b>' + esc(o.label) + '</b>' + (o.hint ? '<span>' + esc(o.hint) + '</span>' : '') + (!o.ok && o.why ? '<span class="bad">' + esc(o.why) + '</span>' : '') + '</button>').join('');
  const advH = (ev.advice && ev.advice.length) ? '<div style="margin:4px 0 12px">' + ev.advice.map(a => { const f = ev.options[a.favours], o = a.opposes >= 0 ? ev.options[a.opposes] : null; return '<div class="newsi info"><small>' + esc(a.title) + ', ' + esc(a.who) + '</small>Leans toward "' + esc(f ? f.label : '') + '"' + (o && o !== f ? ' and against "' + esc(o.label) + '"' : '') + '.</div>'; }).join('') + '</div>' : '';
  openModal('<div class="mh"><div class="eyebrow">' + esc(CATLAB[ev.cat] || 'Decision') + ' &middot; ' + esc(E.dateLabel()) + '</div><h2>' + esc(ev.title) + '</h2></div><div class="mb"><p>' + esc(ev.text) + '</p>' + advH + '<div class="opts">' + opts + '</div></div>', { dismiss: false });
}
function resolveEv(i) {
  const r = E.resolveEvent(i); if (!r) { closeModal(); return; }
  save();
  openModal('<div class="mh"><div class="eyebrow">Outcome</div><h2>' + esc(r.title || 'Decision made') + '</h2></div><div class="mb"><div class="outcome">' + esc(r.text) + '</div>' + chipsHtml(r.chips) + '<div class="opts"><button class="opt" data-act="evnext" data-focus="1"><b>Continue</b></button></div></div>', { dismiss: false });
  renderAll();
}
function showGameOver() {
  const s = S(), o = s.over; if (!o) return;
  if (!o.legacy) E.legacy();
  const L = o.legacy || E.legacy();
  const rows = L.parts.filter(p => p.pts !== 0).map(p => '<div class="lr"><span>' + esc(p.label) + '</span><span class="mono ' + (p.pts >= 0 ? 'good' : 'bad') + '">' + sgn(p.pts, 0) + '</span></div>').join('');
  const c = E.me();
  clearSave(); UI.overOpen = true;
  openModal('<div class="mh"><div class="eyebrow">' + esc(o.date || E.dateLabel()) + '. ' + Math.floor(s.turn / 12) + ' years and ' + E.mo(s.turn % 12) + ' in power</div><h2>' + esc(o.title) + '</h2></div><div class="mb"><p>' + esc(o.text) + '</p>' +
    reportHtml() +
    '<div class="legacy"><div class="eyebrow">Your legacy score</div>' + rows + '<div class="tot">' + L.total + ' <span style="font-size:20px;color:var(--ink-2)">' + esc(L.rank) + '</span></div></div>' +
    '<div class="muted" style="font-size:12.5px;margin-bottom:12px">' + esc(c.name) + ' ended at ' + esc(E.money(c.gdp)) + ' GDP, ' + f0(c.appr) + '% approval. Wars won ' + s.stat.warsWon + ', lost ' + s.stat.warsLost + '. Policies passed ' + s.stat.policies + '.</div>' +
    '<div class="opts"><button class="opt" data-act="newgame" data-focus="1"><b>Play again</b><span>Choose a new country or the same one</span></button><button class="opt" data-act="closemodal"><b>Look at the map</b><span>See how the world you left is doing</span></button></div></div>', { dismiss: false });
}

function reportHtml() {
  const r = E.report();
  const mark = v => v === 'better' ? '<span class="good">Better</span>' : v === 'worse' ? '<span class="bad">Worse</span>' : '<span class="faint">Same</span>';
  const col = r.score >= 2 ? 'good' : r.score <= -2 ? 'bad' : 'warn';
  return '<div class="legacy" style="margin-top:0"><div class="eyebrow">Did you leave it better than you found it?</div><div class="outcome" style="border-left-color:var(--' + (col === 'good' ? 'good' : col === 'bad' ? 'bad' : 'warn') + ')"><b class="' + col + '">' + esc(r.verdict) + '.</b> ' + esc(r.headline) + '</div>' +
    '<table class="rank"><tr><td class="faint" style="font-family:var(--font-body)">Measure</td><td class="faint" style="text-align:right;font-family:var(--font-body)">Start</td><td class="faint" style="text-align:right;font-family:var(--font-body)">Now</td><td class="faint" style="text-align:right;font-family:var(--font-body)"></td></tr>' +
    r.rows.map(x => '<tr><td style="font-family:var(--font-body)">' + esc(x.label) + '</td><td style="text-align:right">' + esc(x.from) + '</td><td style="text-align:right">' + esc(x.to) + '</td><td style="text-align:right;font-family:var(--font-body)">' + mark(x.verdict) + '</td></tr>').join('') + '</table></div>';
}

// ---------- menu, help ----------
function showMenu() {
  const th = store.get(THEME_KEY) || 'auto';
  openModal('<div class="mh"><h2>Menu</h2></div><div class="mb"><div class="opts">' +
    '<button class="opt" data-act="help"><b>How to play</b><span>The rules of the game in one page</span></button>' +
    '<button class="opt" data-act="theme"><b>Theme: ' + th + '</b><span>Cycle between automatic, dark and light</span></button>' +
    '<button class="opt" data-act="monthlypref"><b>Month-end report: ' + (monthlyOn() ? 'on' : 'off') + '</b><span>A short money summary that slides in after each month</span></button>' +
    '<button class="opt" data-act="saves"><b>Saved games</b><span>Manual slots and earlier autosaves</span></button>' +
    '<button class="opt" data-act="export"><b>Export or import save</b><span>Copy your game as text, or paste one to restore it</span></button>' +
    '<button class="opt" data-act="retire"><b>Retire from office</b><span>End your rule now and see your legacy</span></button>' +
    '<button class="opt" data-act="newgame"><b>New game</b><span>Abandon this game and start over</span></button>' +
    '<button class="opt" data-act="closemodal"><b>Back to the game</b></button></div></div>');
}
function showHelp() {
  openModal('<div class="mh"><h2>How to play</h2></div><div class="mb help"><ul style="padding-left:18px;margin:8px 0 14px;font-size:14px">' +
    '<li><b>Stay in power.</b> Every government has a power base: voters, business, the army and the party or court. Let one of them turn on you and you can be voted out, deposed or overthrown. The Home tab shows the loyalty of each and your yearly risk.</li>' +
    '<li><b>Political capital</b> is your action currency. It refills every month. Autocrats have more room to act, democrats have more legitimacy but more friction.</li>' +
    '<li><b>Run the country.</b> Set taxes and spending on Budget. Enact policies. Deal with the events that land on your desk each month.</li>' +
    '<li><b>Deal with the world.</b> Click a country on the map for its dossier and actions: delegations, trade, sanctions, defence pacts, ultimatums, war. Join blocs like NATO, the EU or BRICS if you qualify.</li>' +
    '<li><b>Fighting a war.</b> On the War tab pick a campaign plan (attrition, manoeuvre, air campaign, defence in depth) and issue one-off operations such as offensive pushes, air strikes, raids, blockades and cyber attacks. Each has a cost and a cooldown.</li>' +
    '<li><b>Nuclear scares.</b> Rogue states with a bomb can launch. You may get minutes to decide with poor information: hold, raise the alert, shoot it down, call their patron or strike first. Guess wrong in either direction and it costs you.</li>' +
    '<li><b>Alliances.</b> Defence blocs like NATO and bilateral pacts are called in when a member is attacked. A war a member starts itself is a war of choice: you are asked for support but not obliged to give it. Refusing a real commitment costs trust and prestige.</li>' +
    '<li><b>Democracy has limits.</b> In a liberal democracy, declaring war or sending troops to join one needs parliament, and it can say no. The odds depend on your party loyalty, your approval and whether you have a just cause. Autocrats need no vote.</li>' +
    '<li><b>War.</b> Wars are tugs of war. Allies are called in, weariness builds at home, and losing badly can end your rule. Nuclear powers cannot be beaten conventionally and cornered ones get dangerous.</li>' +
    '<li><b>Tension.</b> The world tension meter climbs with wars and rivalries. When it is high, more wars break out.</li>' +
    '<li><b>Your cabinet and rivals.</b> Five advisers lean toward certain choices and remember whether you listen. Rival leaders have traits and long memories. Click Stability, Approval, Economy or the Budget tile to see exactly why it moved.</li>' +
    '<li><b>Territories.</b> A conquered country becomes a territory with its own unrest. Garrison it, invest in it or leave it alone, and integrate it before it revolts.</li>' +
    '<li><b>Programmes and storylines.</b> On the Policy tab you can launch long national programmes that cost money every month and pay off if you look after them. Some decisions come back later, so keep an eye on the storylines panel.</li>' +
    '<li><b>Reports.</b> A month-end report shows what came in and went out. Each January an annual report grades the year. Turn the monthly one off in the menu if you prefer.</li>' +
    '<li><b>Ambition.</b> You can pick a personal goal at the start. It adds to your legacy score if you achieve it.</li>' +
    '<li><b>Legacy.</b> When your time ends you are scored on growth, living standards, liberty, prestige and how you handled war and peace.</li></ul>' +
    '<p class="muted" style="font-size:12.5px">The map is a simplified projection. Statistics are approximate and heavily simplified. Press Space to end the month.</p>' +
    '<div class="opts"><button class="opt" data-act="closemodal" data-focus="1"><b>Got it</b></button></div></div>');
}
function showExport() {
  const s = S();
  const txt = s && !s.over ? E.serialize() : '';
  openModal('<div class="mh"><h2>Save data</h2></div><div class="mb"><p class="muted" style="font-size:13px">The game saves automatically in this browser after every month. To move a game elsewhere, copy the text below. To restore one, paste it in the box and load it.</p>' +
    '<label class="lab" for="exp" style="display:block;font-size:12px" >Current save</label><textarea id="exp" class="input mono" rows="4" readonly style="font-size:11px">' + esc(txt) + '</textarea>' +
    '<div class="btnrow"><button class="btn sm" data-act="copyexp">Copy</button></div>' +
    '<label class="lab" for="imp" style="display:block;font-size:12px;margin-top:14px">Paste a save here</label><textarea id="imp" class="input mono" rows="4" style="font-size:11px"></textarea>' +
    '<div class="btnrow"><button class="btn sm primary" data-act="doimport">Load save</button><button class="btn sm ghost" data-act="closemodal">Close</button></div><div id="impmsg" class="bad" style="font-size:12.5px;margin-top:6px"></div></div>', { width: 620 });
}
function confirmModal(title, text, actId, extraAttrs, okLabel) {
  openModal('<div class="mh"><h2>' + esc(title) + '</h2></div><div class="mb"><p>' + esc(text) + '</p><div class="opts"><button class="opt" data-act="' + actId + '" ' + (extraAttrs || '') + '><b>' + esc(okLabel || 'Confirm') + '</b></button><button class="opt" data-act="closemodal" data-focus="1"><b>Cancel</b></button></div></div>');
}
function goalModal(t) {
  const me = E.S.player;
  const goals = [['conquest', 'Conquest', 'Seize the country outright. It becomes a territory you must hold, integrate and pay for.'], ['regime', 'Regime change', 'Topple their government and install a friendlier one.'], ['humiliate', 'Punish and deter', 'A limited war to teach a lesson. Easier to end.']];
  const cb = E.hasCB(me, t); const why = E.annexReason(me, t);
  const vote = E.needsVote();
  const ta = E.defenceAllies(t).filter(a => E.alive(a) && a !== me).map(a => E.nm(a));
  const warn = ta.length ? '<p class="warn" style="margin-top:0">Its defence partners (' + esc(ta.slice(0, 5).join(', ')) + (ta.length > 5 ? ' and ' + (ta.length - 5) + ' more' : '') + ') are likely to join against you. Expect sanctions from countries that side with the victim, a running cost of the war on your budget, and a rally at home that fades within months.</p>' : '<p class="muted" style="margin-top:0">Expect sanctions from countries that side with the victim, a running cost of the war on your budget, and a rally at home that fades within months.</p>';
  openModal('<div class="mh"><div class="eyebrow">War declaration</div><h2>War with ' + esc(E.nm(t)) + '</h2></div><div class="mb"><p>' + (cb ? 'You have grounds: <b>' + esc(cb) + '</b>. The world will understand.' : 'You have no casus belli. Striking without cause costs prestige, sours relations with most nations and unsettles democracies at home.') + ' Their allies may join them. Choose your war aim.' + (vote ? ' As a democracy, parliament must approve the declaration.' : '') + '</p>' + warn + '<div class="opts">' +
    goals.map(g => { const off = g[0] === 'conquest' && why; const pv = vote && !off ? ' Parliament backs it: ' + Math.round(E.warVoteOdds('declare', t, g[0]) * 100) + '%.' : ''; return '<button class="opt" data-act="godeclare" data-t="' + t + '" data-goal="' + g[0] + '" ' + (off ? 'disabled' : '') + '><b>' + g[1] + '</b><span>' + g[2] + (off ? ' Not possible: ' + esc(why) : pv) + '</span></button>'; }).join('') +
    '<button class="opt" data-act="closemodal" data-focus="1"><b>Stand down</b></button></div></div>');
}


function explainModal(kind) {
  const x = E.explain(kind); if (!x) return;
  const mx = Math.max(1, ...x.rows.filter(r => !r.base).map(r => Math.abs(r.v)));
  const rows = x.rows.map(r => {
    const good = r.v >= 0; const w = r.base ? 0 : Math.max(3, Math.abs(r.v) / mx * 100);
    const val = (x.unit === '% of GDP' || x.kind === 'budget') ? (r.v >= 0 ? '+' : '') + r.v.toFixed(1) + '%' : (r.base ? r.v.toFixed(0) : (r.v >= 0 ? '+' : '') + r.v.toFixed(x.dec));
    return '<div class="fac"><div class="n">' + esc(r.label) + '</div><div class="val ' + (r.base ? '' : good ? 'good' : 'bad') + '">' + val + '</div>' + (r.base ? '' : '<div class="bar ' + (good ? 'good' : 'bad') + '"><i style="width:' + w + '%"></i></div>') + '</div>';
  }).join('');
  openModal('<div class="mh"><div class="eyebrow">Why?</div><h2>' + esc(x.title) + '</h2></div><div class="mb"><p>' + esc(x.lead) + (x.why ? ' ' + esc(x.why) : '') + '</p>' + rows +
    '<div class="opts" style="margin-top:14px"><button class="opt" data-act="closemodal" data-focus="1"><b>Close</b></button></div></div>');
}


function reshuffleModal(role) {
  const cs = E.candidatesFor(role), R = E.ROLES()[role];
  openModal('<div class="mh"><div class="eyebrow">Reshuffle</div><h2>New ' + esc(R.title) + '</h2></div><div class="mb"><p>Replacing an adviser costs 2 political capital, unsettles their faction a little, and the newcomer has opinions of their own.</p><div class="opts">' +
    cs.map((c, i) => '<button class="opt" data-act="hire" data-id="' + role + '" data-i="' + i + '"><b>' + esc(c.name) + '</b><span>' + esc(c.lean) + '. Skill ' + '●'.repeat(c.comp) + '○'.repeat(5 - c.comp) + '</span></button>').join('') +
    '<button class="opt" data-act="closemodal" data-focus="1"><b>Keep the current post-holder</b></button></div></div>');
}


// ---------- fiscal reports ----------
const PREF_MONTHLY = 'wls_monthly_v1';
function monthlyOn() { return store.get(PREF_MONTHLY) !== '0'; }
let mrepTimer = 0;
function hideMonthly() { clearTimeout(mrepTimer); const m = $('#mrep'); if (m && m.parentNode) m.parentNode.removeChild(m); }
function showMonthly() {
  const m = E.monthlyReport(); const wrap = $('#mapwrap'); if (!m || !wrap) return;
  hideMonthly();
  const d = document.createElement('div'); d.id = 'mrep'; d.className = 'mrep';
  d.innerHTML = '<div class="mh2"><b>Month-end report <span class="faint" style="font-size:13px;letter-spacing:0">' + esc(m.date) + '</span></b><button class="x" data-act="mrepclose" aria-label="Close">&times;</button></div>' + monthlyHtml(m, true) +
    '<div style="text-align:right;margin-top:6px"><button class="btn sm ghost" data-act="mrepopen">Open budget</button></div>';
  wrap.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => { d.querySelectorAll('i[data-w]').forEach(i => { i.style.width = i.getAttribute('data-w') + '%'; }); }));
  mrepTimer = setTimeout(hideMonthly, 11000);
}
function annualHtml(a) {
  const f = a.fiscal, sgnm = v => (v >= 0 ? '+' : '-') + E.money(Math.abs(v));
  const gr = '<div class="grades">' + a.grades.map(g => '<div class="gr ' + g.g + '" title="' + esc(g.note) + '"><div class="l">' + g.g + '</div><div class="a">' + esc(g.area) + '</div></div>').join('') + '</div>' +
    '<div class="muted" style="font-size:12.5px">' + a.grades.map(g => esc(g.note)).join(' ') + '</div>';
  const mx = Math.max(1e-9, ...f.rev.map(x => x[1]), ...f.spend.map(x => x[1]));
  const line = (x, cls) => '<div class="rrow"><div class="t"><span>' + esc(x[0]) + '</span><span class="mono">' + esc(E.money(x[1])) + '</span></div><div class="rbar ' + cls + '"><i style="width:' + Math.max(2, x[1] / mx * 100).toFixed(1) + '%"></i></div></div>';
  const fisc = '<div class="rcols"><div class="rcol"><h5><span>Money in</span><span class="mono">' + esc(E.money(f.totRev)) + '</span></h5>' + f.rev.map(x => line(x, 'in')).join('') + '</div><div class="rcol"><h5><span>Money out</span><span class="mono">' + esc(E.money(f.totSpend)) + '</span></h5>' + f.spend.map(x => line(x, 'out')).join('') + '</div></div>' +
    (Math.abs(f.oneOff) > f.gdpAvg * 0.0001 ? '<div class="rrow" style="margin-top:6px"><div class="t"><span>One-off items from your decisions and events (not in the totals above)</span><span class="mono ' + (f.oneOff >= 0 ? 'good' : 'bad') + '">' + esc(sgnm(f.oneOff)) + '</span></div></div>' : '') +
    '<div class="rfoot"><div><div class="k">Yearly balance, including one-offs</div><div class="v ' + (f.balance >= 0 ? 'good' : 'bad') + '">' + esc(sgnm(f.balance)) + '</div><div class="d">' + (f.balPct >= 0 ? '+' : '') + f.balPct.toFixed(1) + '% of GDP</div></div>' +
    '<div><div class="k">Debt</div><div class="v">' + esc(E.money(f.debt1)) + '</div><div class="d">' + esc(sgnm(f.debt1 - f.debt0)) + ' on the year</div></div>' +
    '<div><div class="k">Treasury</div><div class="v">' + esc(E.money(f.treasury1)) + '</div><div class="d">one-offs ' + esc(sgnm(f.oneOff)) + '</div></div></div>';
  const stats = a.stats.map(s => { const cl = s.flat ? 'faint' : s.good ? 'good' : 'bad'; const pc = s.pct != null ? ' (' + (s.pct >= 0 ? '+' : '') + s.pct + '%)' : ''; return '<div class="srow"><span>' + esc(s.label) + '</span><span class="mono ' + cl + '">' + s.from + esc(s.unit) + ' &rarr; ' + s.to + esc(s.unit) + pc + '</span></div>'; }).join('');
  const rel = (a.gain.length || a.lose.length) ? '<div class="sec"><h3>Relations</h3>' + a.gain.map(x => '<div class="srow"><span>' + esc(x.name) + '</span><span class="mono good">' + x.from + ' &rarr; ' + x.to + '</span></div>').join('') + a.lose.map(x => '<div class="srow"><span>' + esc(x.name) + '</span><span class="mono bad">' + x.from + ' &rarr; ' + x.to + '</span></div>').join('') + '</div>' : '';
  const w = a.wars, bits = [];
  bits.push('Economy rank ' + a.ranks.gdp[0] + (a.ranks.gdp[1] !== a.ranks.gdp[0] ? ' &rarr; ' + a.ranks.gdp[1] : ' (unchanged)') + ', power rank ' + a.ranks.pow[0] + (a.ranks.pow[1] !== a.ranks.pow[0] ? ' &rarr; ' + a.ranks.pow[1] : ' (unchanged)') + '.');
  if (a.allies[0] !== a.allies[1]) bits.push('Defence partners ' + a.allies[0] + ' &rarr; ' + a.allies[1] + '.');
  if (w.declared || w.won || w.lost || w.annexed || w.active) bits.push('War: ' + w.declared + ' declared, ' + w.won + ' won, ' + w.lost + ' lost, ' + w.annexed + ' annexed' + (w.active ? ', ' + w.active + ' still running' : '') + '.');
  if (a.intel.right + a.intel.wrong) bits.push('Intelligence calls: ' + a.intel.right + ' right, ' + a.intel.wrong + ' wrong.');
  bits.push(a.decisions + ' decisions landed on your desk.');
  const amb = a.ambition ? '<div class="sec"><h3>Your ambition</h3><div class="muted">' + esc(a.ambition.name) + '. ' + esc(a.ambition.text) + '</div><div class="bar ' + (a.ambition.ok ? 'good' : 'info') + '" style="margin-top:6px"><i style="width:' + Math.round(a.ambition.prog * 100) + '%"></i></div></div>' : '';
  const hi = a.highlights.length ? '<div class="sec"><h3>Moments of the year</h3>' + a.highlights.map(h => '<div class="srow"><span>' + esc(h.text) + '</span><span class="faint" style="white-space:nowrap">' + esc(h.d) + '</span></div>').join('') + '</div>' : '';
  return '<div style="display:flex;gap:14px;align-items:center;margin-bottom:6px"><div class="bigg ' + (a.overall === 'A' || a.overall === 'B' ? 'good' : a.overall === 'C' ? 'warn' : 'bad') + '">' + a.overall + '</div><div class="muted" style="font-size:13.5px">' + esc(a.summary) + '</div></div>' + gr +
    '<div class="sec"><h3>The books</h3>' + fisc + '</div><div class="sec"><h3>Year in numbers</h3>' + stats + '</div>' + rel +
    '<div class="sec"><h3>Standing</h3><div class="muted" style="font-size:13px">' + bits.join(' ') + '</div></div>' + amb + hi;
}
function showAnnual(a, first) {
  if (!a) return;
  openModal('<div class="mh"><div class="eyebrow">Annual report</div><h2>' + a.year + ' in review</h2></div><div class="mb">' + annualHtml(a) +
    '<div class="opts" style="margin-top:14px"><button class="opt" data-act="' + (first ? 'annualdone' : 'closemodal') + '" data-focus="1"><b>' + (first ? 'Continue' : 'Close') + '</b></button></div></div>', { dismiss: !first, width: 640 });
}

// ---------- action handlers ----------
function afterAction(res) {
  save(); renderAll();
  if (res && res.text) toast(res.text, res.ok === false ? 'bad' : '', res.chips);
  const s = S(); if (s.over || E.currentEvent()) { pump(); }
}
function doEndTurn() {
  const s = S(); if (!s || s.over || UI.modalOpen || UI.mode !== 'play') return;
  const top = s.news[0];
  E.endTurn();
  save(); renderAll();
  if (monthlyOn() && !s.over) showMonthly();
  // surface notable headlines
  const fresh = []; for (const n of E.S.news) { if (n === top) break; fresh.push(n); }
  const rank = { nuclear: 0, war: 1, peace: 2, politics: 3, you: 3 };
  fresh.filter(n => n.tag in rank && (n.tag !== 'politics' || n.iso === E.S.player)).sort((a, b) => rank[a.tag] - rank[b.tag]).slice(0, 2).forEach(n => toast(n.text, n.tag === 'nuclear' || n.tag === 'war' ? 'bad' : ''));
  pump();
}

function onAction(el, ev) {
  const a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
  switch (a) {
    case 'endturn': return doEndTurn();
    case 'closemodal': closeModal(); renderAll(); return;
    case 'help': return showHelp();
    case 'menu': return showMenu();
    case 'theme': { const t = cycleTheme(); if (UI.modalOpen) showMenu(); toast('Theme: ' + t); return; }
    case 'tab': UI.tab = id; renderTabs(); renderDock(); $('#dockbody').scrollTop = 0; return;
    case 'mapmode': UI.mapMode = id; renderMapChrome(); renderMap(); return;
    case 'bloc': UI.blocSel = id; renderMapChrome(); renderMap(); return;
    case 'sel': return selectCountry(id, true);
    case 'continue': return loadSaved();
    case 'pickc': return setCountry(id, true);
    case 'pickg': UI.setup.gov = id; { const q = $('#lname'); if (q) UI.setup.leader = q.value; } renderDock(); return;
    case 'pickd': UI.setup.diff = +id; { const q = $('#lname'); if (q) UI.setup.leader = q.value; } renderDock(); return;
    case 'picks': UI.setup.scenario = id; { const q = $('#lname'); if (q) UI.setup.leader = q.value; } renderDock(); return;
    case 'picka': UI.setup.ambition = id; { const q = $('#lname'); if (q) UI.setup.leader = q.value; } renderDock(); return;
    case 'pickt': UI.setup.temper = +id; { const q = $('#lname'); if (q) UI.setup.leader = q.value; } renderDock(); return;
    case 'start': return startGame();
    case 'enact': { const r = E.enact(id); return afterAction(r); }
    case 'apply': return afterAction(E.applyToBloc(id));
    case 'leave': return afterAction(E.leaveBloc(id));
    case 'mob': { const ok = E.setMobilisation(+id); if (!ok) toast('You need 1 political capital to raise mobilisation.', 'bad'); save(); renderAll(); return; }
    case 'plan': { const r = E.setPlan(+id, el.getAttribute('data-v')); save(); renderAll(); toast(r.text, r.ok ? '' : 'bad'); return; }
    case 'op': { const r = E.doOp(+id, el.getAttribute('data-v')); save(); renderAll(); toast(r.text, r.ok ? '' : 'bad', r.chips); if (E.S.over || E.currentEvent()) pump(); return; }
    case 'posture': { const r = E.setPosture(id, el.getAttribute('data-v')); save(); renderAll(); toast(r.text, r.ok ? '' : 'bad'); return; }
    case 'pjstart': return afterAction(E.startProject(id));
    case 'pjcancel': return confirmModal('Cancel this programme?', 'Money already spent is lost, the people behind it will be angry, and there is no refund.', 'dopjcancel', 'data-id="' + id + '"', 'Cancel it');
    case 'dopjcancel': { closeModal(); return afterAction(E.cancelProject(id)); }
    case 'explain': return explainModal(id);
    case 'annual': { const a = E.annualByYear(+id); if (a) showAnnual(a, false); return; }
    case 'annualdone': E.annualAck(); closeModal(); save(); renderAll(); pump(); return;
    case 'monthlypref': store.set(PREF_MONTHLY, monthlyOn() ? '0' : '1'); if (!monthlyOn()) hideMonthly(); showMenu(); return;
    case 'mrepclose': hideMonthly(); return;
    case 'mrepopen': hideMonthly(); UI.tab = 'budget'; renderTabs(); renderDock(); return;
    case 'reshuffle': return reshuffleModal(id);
    case 'hire': { const r = E.hireAdviser(id, +el.getAttribute('data-i')); closeModal(); save(); renderAll(); toast(r.text, r.ok ? '' : 'bad'); return; }
    case 'stance': E.setStance(+id, el.getAttribute('data-v')); save(); renderAll(); return;
    case 'dip': {
      const t = el.getAttribute('data-t');
      if (id === 'declare') return goalModal(t);
      const r = E.doDip(id, t); if (id === 'spy' && r.ok) { openModal('<div class="mh"><div class="eyebrow">Intelligence report</div><h2>' + esc(E.nm(t)) + '</h2></div><div class="mb"><div class="outcome">' + esc(r.text) + '</div><div class="opts"><button class="opt" data-act="closemodal" data-focus="1"><b>Close</b></button></div></div>'); save(); renderAll(); return; }
      return afterAction(r);
    }
    case 'godeclare': { const t = el.getAttribute('data-t'); const r = E.doDip('declare', t, el.getAttribute('data-goal')); closeModal(); UI.tab = 'war'; save(); renderAll(); if (r.text) toast(r.text, r.ok ? '' : 'bad', r.chips); if (E.S.over || E.currentEvent()) pump(); return; }
    case 'nuke': return confirmModal('Authorise a nuclear strike?', 'You will kill vast numbers of people and the world will never forgive you. Approval and stability will collapse, and retaliation may end civilisation. This cannot be undone.', 'donuke', 'data-t="' + el.getAttribute('data-t') + '"', 'Launch');
    case 'donuke': { const r = E.playerNuke(el.getAttribute('data-t')); closeModal(); save(); renderAll(); if (r.text) toast(r.text, 'bad'); pump(); return; }
    case 'evopt': return resolveEv(+el.getAttribute('data-i'));
    case 'evnext': closeModal(); renderAll(); pump(); return;
    case 'retire': return confirmModal('Retire from office?', 'You will step down now and be scored on your time in power.', 'doretire', '', 'Step down');
    case 'doretire': closeModal(); E.retire(); save(); renderAll(); pump(); return;
    case 'newgame': return confirmNew();
    case 'donew': clearSave(); closeModal(); goSetup(); return;
    case 'saves': return showSaves();
    case 'saveslot': { const ok = putSave(id, E.serialize(), saveMeta()); showSaves(); toast(ok ? 'Game saved.' : 'Could not save. Browser storage is full or blocked.', ok ? '' : 'bad'); return; }
    case 'loadslot': { if (UI.mode === 'play' && S() && !S().over) return confirmModal('Load this game?', 'Your current game will be replaced by the saved one. Save it to a slot first if you want to keep it.', 'doloadslot', 'data-id="' + id + '"', 'Load it'); return void loadKey(id); }
    case 'doloadslot': { if (loadKey(id)) { save(); toast('Game loaded.'); } return; }
    case 'export': return showExport();
    case 'copyexp': { const t = $('#exp'); if (t) { t.select(); try { document.execCommand('copy'); toast('Copied to clipboard.'); } catch (e) { toast('Select the text and copy it manually.'); } } return; }
    case 'doimport': return doImport();
  }
}
function confirmNew() {
  const s = S();
  if (s && !s.over && UI.mode === 'play') return confirmModal('Start a new game?', 'Your current game will be abandoned.', 'donew', '', 'Abandon and start over');
  clearSave(); closeModal(); goSetup();
}
function goSetup() {
  UI.mode = 'setup'; UI.sel = null; UI.setup.gov = null;
  MapView.reset(); renderAll({ resetScroll: true }); MapView.buildLabels();
  MapView.focus(UI.setup.iso, 1.6);
}
function doImport() {
  const t = $('#imp'); const msg = $('#impmsg'); const txt = t ? t.value.trim() : '';
  if (!txt) { msg.textContent = 'Paste a save first.'; return; }
  try { E.hydrate(txt); } catch (e) { msg.textContent = 'That does not look like a valid save from this version of the game.'; return; }
  enterPlay(); closeModal(); renderAll({ resetScroll: true }); save(); toast('Save loaded.');
}
function enterPlay() { UI.mode = 'play'; UI.tab = 'home'; UI.sel = null; MapView.buildLabels(); MapView.focus(E.S.player, 2.2); }
function saveError(e) { return e && e.message === 'newer' ? 'This save was made by a newer version of the game.' : e && e.message === 'older' ? 'This save is from an older version that is no longer supported.' : 'That save could not be read. It may be damaged.'; }
function loadKey(key, quiet) {
  const raw = store.get(key); if (!raw) return false;
  try { E.hydrate(raw); } catch (e) { if (!quiet) toast(saveError(e), 'bad'); return false; }
  enterPlay(); closeModal(); renderAll({ resetScroll: true }); pump(); return true;
}
function loadSaved() {
  if (loadKey(SAVE_KEY, true)) return;
  if (loadKey(PREV_KEY, true)) { toast('The latest autosave could not be read, so an earlier one was loaded.', 'bad'); return; }
  toast('No save could be loaded. Your data is untouched and can still be exported from the menu.', 'bad'); renderDock();
}
function showSaves() {
  const rows = saveRows(); const inGame = UI.mode === 'play' && S() && !S().over;
  const desc = m => m ? esc(m.name) + (m.leader ? ', ' + esc(m.leader) : '') + '. ' + esc(m.date) + ', month ' + m.turn : 'Saved game';
  openModal('<div class="mh"><h2>Saved games</h2></div><div class="mb"><p class="muted" style="font-size:13px">The game autosaves every month. An earlier autosave is kept from up to six months back, in case a decision goes badly wrong. Use the slots to keep games you never want to lose.</p>' +
    rows.map(r => '<div class="row-item"><div class="t">' + esc(r.label) + '</div><div class="a">' +
      (r.has ? '<button class="btn sm" data-act="loadslot" data-id="' + r.key + '">Load</button> ' : '') +
      (!r.auto && inGame ? '<button class="btn sm primary" data-act="saveslot" data-id="' + r.key + '">' + (r.has ? 'Overwrite' : 'Save here') + '</button>' : '') + '</div>' +
      '<div class="d">' + (r.has ? desc(r.meta) : 'Empty') + '</div></div>').join('') +
    '<div class="opts" style="margin-top:12px"><button class="opt" data-act="closemodal" data-focus="1"><b>Close</b></button></div></div>');
}
function selectCountry(iso, jump) {
  if (UI.mode === 'setup') { setCountry(iso, false); return; }
  UI.sel = iso; if (jump !== false) UI.tab = iso === S().player ? 'home' : 'dip';
  renderTabs(); renderMap(); renderDock(); $('#dockbody').scrollTop = 0;
}

// ---------- boot ----------
function boot() {
  applyTheme(store.get(THEME_KEY) || 'auto');
  MapView.init($('#map'), $('#mapwrap'), {
    name: id => (S() ? E.nm(id) : (E.ROW[id] ? E.ROW[id].name : '')),
    tip: mapTip,
    select: id => selectCountry(id, true),
  });
  $('#zin').addEventListener('click', () => MapView.zoomIn());
  $('#zout').addEventListener('click', () => MapView.zoomOut());
  $('#zreset').addEventListener('click', () => MapView.reset());
  document.addEventListener('click', ev => {
    const ov = ev.target.closest && ev.target.closest('[data-ov]');
    const el = ev.target.closest && ev.target.closest('[data-act]');
    if (el && !el.disabled) { onAction(el, ev); return; }
    if (ov && ev.target === ov && UI.modalDismiss) { closeModal(); }
    const row = ev.target.closest && ev.target.closest('tr[data-iso], .newsi[data-iso]');
    if (row) selectCountry(row.getAttribute('data-iso'), true);
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'cq') { UI.setup.q = t.value; $('#clist').innerHTML = countryListHtml(); }
    else if (t.id === 'lname') UI.setup.leader = t.value;
    else if (t.getAttribute && t.getAttribute('data-bud')) { const k = t.getAttribute('data-bud'); E.setBudget(k, +t.value); updateBudgetLive(k); }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'tl') UI.setup.term = t.checked;
    else if (t.getAttribute && t.getAttribute('data-bud')) { save(); renderHud(); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && UI.modalOpen && UI.modalDismiss) { closeModal(); return; }
    if ((ev.code === 'Space' || ev.key === ' ') && UI.mode === 'play' && !UI.modalOpen) {
      const tg = ev.target; const tn = tg && tg.tagName;
      if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || tn === 'BUTTON') return;
      ev.preventDefault(); doEndTurn();
    }
  });
  // setup first
  UI.mode = 'setup'; MapView.buildLabels(); renderAll({ resetScroll: true });
  const raw = store.get(SAVE_KEY);
  if (raw) {
    let ok = false; try { E.hydrate(raw); ok = true; } catch (e) { UI.bootErr = saveError(e); }
    if (!ok && store.get(PREV_KEY)) { try { E.hydrate(store.get(PREV_KEY)); ok = true; setTimeout(() => toast('Your latest autosave could not be read, so an earlier one was loaded.', 'bad'), 400); } catch (e) { } }
    if (ok) { enterPlay(); renderAll({ resetScroll: true }); pump(); } else setTimeout(() => toast((UI.bootErr || 'Your save could not be read.') + ' It has been left untouched until you start a new game.', 'bad'), 400);
  }
  if (UI.mode === 'setup') setTimeout(() => { MapView.focus(UI.setup.iso, 1.5); const on = $('#clist .on'); if (on) on.scrollIntoView({ block: 'nearest' }); }, 60);
}
boot();
window.__hos = { E, UI, enter: () => { enterPlay(); renderAll({ resetScroll: true }); pump(); } };
