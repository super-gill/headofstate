// ===================== VIEWS =====================
const TABS = [['home', 'Home'], ['budget', 'Budget'], ['policy', 'Policy'], ['dip', 'Diplomacy'], ['war', 'War'], ['world', 'World']];

function renderHud() {
  const hud = $('#hud'); const s = S();
  if (UI.mode === 'setup' || !s) {
    hud.innerHTML = '<div class="brand"><b>Head of State</b><span>A world leader simulation</span></div><div class="meters"></div><div class="hudbtns"><button class="btn ghost" data-act="help">How to play</button><button class="btn ghost" data-act="theme" title="Switch theme">Theme</button></div>';
    return;
  }
  const c = E.me(), g = E.GOV[c.gov], pcOn = Math.floor(s.pc + 0.001);
  const pips = []; for (let i = 0; i < s.pcMax; i++) pips.push('<i class="' + (i < pcOn ? 'on' : '') + '"></i>');
  const ap = c.appr, st = c.stab;
  const tcol = s.world.tension > 65 ? 'bad' : s.world.tension > 45 ? 'warn' : '';
  hud.innerHTML =
    '<div class="brand"><b>' + esc(c.name) + '</b><span>' + esc(g.leader) + ' ' + esc(s.leader) + '</span></div>' +
    '<div class="meters">' +
    '<div class="meter"><span class="k">Date</span><span class="v">' + esc(E.dateLabel()) + '</span></div>' +
    '<div class="meter"><span class="k">Approval</span><span class="v ' + (ap < 35 ? 'bad' : ap > 60 ? 'good' : '') + '">' + f0(ap) + '%</span></div>' +
    '<div class="meter"><span class="k">Stability</span><span class="v ' + (st < 30 ? 'bad' : st > 60 ? 'good' : '') + '">' + f0(st) + '</span></div>' +
    '<div class="meter"><span class="k">Economy</span><span class="v">' + esc(E.money(c.gdp)) + '<small class="' + (c.growth < 0 ? 'bad' : '') + '">' + sgn(c.growth, 1) + '%</small></span></div>' +
    '<div class="meter"><span class="k">Treasury</span><span class="v ' + (c.treasury < c.gdp * 0.002 ? 'warn' : '') + '">' + (c.treasury < 0.05 ? '$0' : esc(E.money(c.treasury))) + '</span></div>' +
    '<div class="meter" title="Political capital: the currency for policies and diplomacy"><span class="k">Capital <small style="text-transform:none;letter-spacing:0">' + f1(s.pc) + '/' + s.pcMax + '</small></span><span class="pcpips">' + pips.join('') + '</span></div>' +
    '<div class="meter"><span class="k">World tension</span><span class="v ' + tcol + '">' + f0(s.world.tension) + '<small>' + esc(tensionWord(s.world.tension)) + '</small></span></div>' +
    '</div>' +
    '<div class="hudbtns"><button class="btn ghost" data-act="menu">Menu</button><button class="btn primary endturn" data-act="endturn" ' + (s.over ? 'disabled' : '') + ' title="Space">End month</button></div>';
}

function renderTabs() {
  const t = $('#tabs');
  if (UI.mode === 'setup') { t.innerHTML = '<button class="on">New game</button>'; return; }
  const s = S();
  const warBadge = E.warsOf(s.player).length > 0;
  t.innerHTML = TABS.map(([id, lab]) => '<button data-act="tab" data-id="' + id + '" class="' + (UI.tab === id ? 'on' : '') + '">' + lab + (id === 'war' && warBadge ? '<span class="badge"></span>' : '') + '</button>').join('');
}

function renderTicker() {
  const t = $('#ticker'); const s = S();
  if (!s || UI.mode === 'setup') { t.innerHTML = '<span class="lab">Briefing</span><div class="items"><span>Choose a country and a system of government. Every country here is playable.</span></div>'; return; }
  const items = s.news.slice(0, 3);
  t.innerHTML = '<span class="lab">Wire</span><div class="items">' + (items.length ? items.map(n => '<span>' + esc(n.text) + '</span>').join('') : '<span>Quiet news day.</span>') + '</div>';
}

function renderMapChrome() {
  const bar = $('#maptools'); const s = S();
  const modes = [['rel', 'Relations'], ['bloc', 'Blocs'], ['gov', 'Government'], ['eco', 'Economy'], ['mil', 'Military'], ['ten', 'Tension']];
  bar.innerHTML = UI.mode === 'setup' ? '' : '<div class="seg" role="group" aria-label="Map layer">' + modes.map(([k, l]) => '<button data-act="mapmode" data-id="' + k + '" class="' + (UI.mapMode === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
  $('#legend').innerHTML = legendHtml();
}

function renderMap() {
  paintMap();
  const o = overlayLines();
  MapView.setOverlay(o.lines, UI.mode === 'play' && S() ? S().player : (UI.mode === 'setup' ? UI.setup.iso : null), o.hots);
  MapView.select(UI.mode === 'setup' ? UI.setup.iso : UI.sel);
}

function renderDock() {
  const b = $('#dockbody'); const keep = b.scrollTop;
  if (UI.mode === 'setup') { b.innerHTML = setupView(); return; }
  const fn = { home: homeView, budget: budgetView, policy: policyView, dip: dipView, war: warView, world: worldView }[UI.tab];
  b.innerHTML = fn();
  b.scrollTop = keep;
}
function renderAll(o) {
  o = o || {};
  renderHud(); renderTabs(); renderTicker(); renderMapChrome(); renderMap();
  const b = $('#dockbody'); const keep = o.resetScroll ? 0 : b.scrollTop; renderDock(); b.scrollTop = keep;
}

// ---------- HOME ----------
function tile(k, v, key, dir, unit, dec) {
  const d = delta12(key); const dtxt = d == null ? '' : (d >= 0 ? '+' : '') + (Math.abs(d) >= 100 ? f0(d) : f1(d)) + unit + ' / yr';
  const exId = { stab: 'stab', appr: 'appr', growth: 'growth', debt: 'credit' }[key]; const ex = exId ? ' data-act="explain" data-id="' + exId + '" role="button" tabindex="0" style="cursor:pointer" title="Why is this the way it is?"' : '';
  return '<div class="tile"' + ex + '><div class="k">' + k + (ex ? ' <span class="faint">?</span>' : '') + '</div><div class="v">' + v + '</div><div class="d">' + esc(dtxt || ' ') + '</div>' + sparkSvg(key, dir) + '</div>';
}
function facBar(name, small, val, w) {
  const col = val < 35 ? 'bad' : val < 50 ? 'warn' : 'good';
  return '<div class="fac"><div class="n">' + esc(name) + '<small>' + esc(small) + '</small></div><div class="val">' + f0(val) + '</div><div class="bar ' + col + '"><i style="width:' + Math.max(2, val) + '%"></i></div></div>';
}


function whySec() {
  const rows = E.whyRows(); if (!rows.length) return '';
  return '<div class="sec"><h3>What moved last month <small class="faint">And why</small></h3>' + rows.map(r =>
    '<div class="newsi ' + (r.good ? 'peace' : 'war') + '"' + (r.k === 'rel' ? ' data-act="explain" data-id="rel:' + esc(r.iso) + '" style="cursor:pointer"' : (['stab', 'appr', 'growth'].includes(r.k) ? ' data-act="explain" data-id="' + r.k + '" style="cursor:pointer"' : '')) + '><small>' + esc(r.label) + ': ' + r.from + ' to ' + r.to + '</small>' + esc(r.why) + '</div>').join('') + '</div>';
}



function ambitionSec() {
  const a = E.ambitionState(); if (!a) return '';
  const done = a.done != null, pct = Math.round(a.prog * 100);
  return '<div class="sec"><h3>Your ambition <small class="faint">' + (done ? 'Achieved' : pct + '%') + '</small></h3><div class="fac"><div class="n"><b>' + esc(a.name) + '</b><small>' + esc(a.desc) + '</small></div><div class="val ' + (done ? 'good' : '') + '">' + (done ? 'Done' : pct + '%') + '</div><div class="bar ' + (done ? 'good' : 'acc') + '"><i style="width:' + Math.max(2, done ? 100 : pct) + '%"></i></div></div><div class="muted" style="font-size:12.5px;margin-top:4px">' + esc(a.text) + '</div></div>';
}
function storySec() {
  const l = E.storyList(), pj = E.projectStatus(); if (!l.length && !pj.length) return '';
  return '<div class="sec"><h3>Storylines and pledges <small class="faint">In motion</small></h3>' + pj.map(p => '<div class="newsi info"><small>Programme, ' + E.mo(p.left) + ' left</small><b>' + esc(p.name) + '</b> ' + esc(p.health) + '.</div>').join('') + l.map(x => '<div class="newsi ' + (x.kind === 'pledge' ? 'you' : 'tension') + '"><small>' + (x.kind === 'pledge' ? 'Pledge' : 'Developing') + ', ' + x.months + ' months ago</small><b>' + esc(x.name) + '</b> ' + esc(x.status) + '</div>').join('') + '</div>';
}
function cabinetSec() {
  const list = E.cabinetList();
  let out = '<div class="sec"><h3>Your cabinet <small class="faint">They watch what you decide</small></h3>';
  list.forEach(a => {
    const col = a.loyalty < 28 ? 'bad' : a.loyalty < 45 ? 'warn' : 'good';
    out += '<div class="fac"><div class="n"><b>' + esc(a.name) + '</b><small>' + esc(a.title) + ', ' + esc(a.lean.toLowerCase()) + '</small></div>' +
      '<div class="val ' + col + '" title="Loyalty">' + esc(a.mood) + '</div><div class="bar ' + col + '"><i style="width:' + Math.max(2, a.loyalty) + '%"></i></div>' +
      '<div class="muted" style="grid-column:1/-1;font-size:12px">' + esc(a.desc) + ' Skill ' + '●'.repeat(a.comp) + '<span class="faint">' + '●'.repeat(5 - a.comp) + '</span> <button class="btn sm ghost" style="float:right" data-act="reshuffle" data-id="' + a.role + '">Replace</button></div></div>';
  });
  return out + '</div>';
}
function empireSec(emp) {
  const P = E.POSTURES();
  let out = '<div class="sec"><h3>Your empire <small class="faint">Conquered land must be held and integrated</small></h3>';
  emp.forEach(t => {
    const ucol = t.unrest > 68 ? 'bad' : t.unrest > 50 ? 'warn' : 'good';
    out += '<div class="war-card" style="margin-bottom:10px"><h4><span>' + esc(t.name) + '</span><span class="chip ' + (t.unrest > 68 ? 'bad' : t.unrest > 50 ? 'warn' : 'good') + '">' + esc(t.risk) + '</span></h4>' +
      '<div class="stat"><span class="k">Integration</span><span class="v">' + f0(t.integ) + ' / 100</span></div><div class="bar info"><i style="width:' + Math.max(2, t.integ) + '%"></i></div>' +
      '<div class="stat"><span class="k">Unrest</span><span class="v ' + ucol + '">' + f0(t.unrest) + ' / 100</span></div><div class="bar ' + ucol + '"><i style="width:' + Math.max(2, t.unrest) + '%"></i></div>' +
      '<div class="stat"><span class="k">Adds to your economy</span><span class="v">' + esc(E.money(t.gdp)) + '</span></div>' +
      '<div class="stat"><span class="k">Upkeep per year</span><span class="v">' + esc(E.money(t.cost)) + '</span></div>' +
      (t.autonomy ? '<div class="muted" style="font-size:12px;margin-top:4px">Has limited home rule.</div>' : '') +
      '<div class="seg" style="width:100%;margin-top:8px">' + Object.keys(P).map(k => '<button style="flex:1" data-act="posture" data-id="' + t.iso + '" data-v="' + k + '" class="' + (t.posture === k ? 'on' : '') + '" title="' + esc(P[k].d) + '">' + esc(P[k].n) + '</button>').join('') + '</div>' +
      '<div class="muted" style="font-size:12px;margin-top:6px">' + esc(P[t.posture].d) + ' Changing posture costs ' + E.pcCost(1) + ' political capital.</div></div>';
  });
  return out + '</div>';
}
function homeView() {
  const s = S(), c = E.me(), g = E.GOV[c.gov], h = E.hazards(c);
  const yr = x => Math.round((1 - Math.pow(1 - x, 12)) * 100);
  const brief = E.briefing();
  const fis = c.fisc;
  let out = '<div class="sec"><div class="hero"><div><div class="eyebrow">' + esc(g.leader) + ' ' + esc(s.leader) + '</div><h2>' + esc(c.name) + '</h2><div class="sub">' + esc(g.name) + ', ' + esc(E.popStr(c.pop)) + ' people, ' + esc(E.money(c.gdp)) + ' economy. Global rank #' + E.countryInfo(c.iso).rankGdp + ' by GDP.</div></div></div></div>';
  out += '<div class="sec"><h3>Briefing</h3><ul class="brief">' + brief.map(b => '<li class="' + b.lvl + '">' + esc(b.text) + '</li>').join('') + '</ul></div>';
  out += whySec();
  { const emp = E.empireList(); if (emp.length) out += empireSec(emp); }
  out += ambitionSec();
  out += storySec();
  out += cabinetSec();
  out += '<div class="sec"><h3>State of the nation</h3><div class="tiles">' +
    tile('Approval', f0(c.appr) + '%', 'appr', 1, ' pts') + tile('Stability', f0(c.stab), 'stab', 1, ' pts') + tile('Economy', esc(E.money(c.gdp)), 'gdp', 1, '') +
    tile('Growth', sgn(c.growth, 1) + '%', 'growth', 1, '') + tile('Inflation', f1(c.infl) + '%', 'infl', -1, '') + tile('Jobless', f1(c.unemp) + '%', 'unemp', -1, '') +
    tile('Debt / GDP', f0(E.debtPct(c)) + '% <span class="faint" style="font-size:12px">' + esc(E.creditInfo().rating) + '</span>', 'debt', -1, ' pts') + tile('Prestige', f0(c.prest), 'prest', 1, ' pts') +
    '<div class="tile" data-act="explain" data-id="budget" role="button" tabindex="0" style="cursor:pointer" title="Where does the money go?"><div class="k">Budget <span class="faint">?</span></div><div class="v ' + (fis && fis.balance < 0 ? 'bad' : 'good') + '">' + (fis ? sgn(fis.balance / c.gdp * 100, 1) + '%' : 'n/a') + '</div><div class="d">of GDP per year</div></div></div></div>';
  // factions
  out += '<div class="sec"><h3>Who keeps you in power <small class="faint">Loyalty 0 to 100</small></h3>';
  ['public', 'business', 'military', 'party'].forEach((f, i) => { out += facBar(g.fl[i], Math.round(g.w[f] * 100) + '% of your power base', c.fac[f]); });
  const risks = [['coup', 'Coup by the armed forces'], ['palace', 'Palace plot'], ['uprising', 'Popular uprising'], ['noconf', 'Loss of party confidence']].filter(r => h[r[0]] > 0.002);
  out += '<div style="margin-top:8px">' + (risks.length ? risks.map(r => '<div class="hz"><span>' + r[1] + '</span><span class="mono ' + (yr(h[r[0]]) >= 15 ? 'bad' : 'warn') + '">' + yr(h[r[0]]) + '% this year</span></div>').join('') : '<div class="hz"><span class="muted">No serious threat to your hold on power.</span></div>') + '</div>';
  if (E.isDemo(c.gov)) out += '<div class="hz"><span>Next election</span><span class="mono">' + (s.electionIn > 0 ? 'in ' + E.mo(s.electionIn) : 'n/a') + ', win odds ' + Math.round(E.electionOdds(c) * 100) + '%' + (s.termLimits && c.gov === 'D' ? ', term ' + s.terms + ' of 2' : '') + '</span></div>';
  out += '</div>';
  // log
  out += '<div class="sec"><h3>Your decisions</h3>' + (s.log.length ? s.log.slice(0, 8).map(l => '<div class="newsi you"><small>' + esc(l.d) + '</small>' + esc(l.text) + '</div>').join('') : '<div class="muted">Nothing yet. Set your budget, pass a policy, or make a call to a friend.</div>') + '</div>';
  return out;
}

// ---------- BUDGET ----------
const BUD = [
  { k: 'tax', n: 'Tax rate', sub: 'Share of GDP raised in taxes', unit: '% of GDP', step: 0.5, get: c => c.tax, base: c => c.taxBase, hint: 'Higher taxes fill the treasury but annoy voters and business.' },
  { k: 'social', n: 'Health, welfare and pensions', unit: '% of GDP', step: 0.1, get: c => c.spend.social, base: c => c.exp.social, hint: 'Voters expect this to stay near its usual level.' },
  { k: 'mil', n: 'Armed forces', unit: '% of GDP', step: 0.1, get: c => c.spend.mil, base: c => c.exp.mil, hint: 'Builds army power slowly. Generals watch this closely.' },
  { k: 'infra', n: 'Infrastructure and industry', unit: '% of GDP', step: 0.1, get: c => c.spend.infra, base: () => 2.5, hint: 'Above 2.5% builds capacity and growth over years.' },
  { k: 'sec', n: 'Police and security', unit: '% of GDP', step: 0.1, get: c => c.spend.sec, base: c => c.exp.sec, hint: 'Keeps a lid on unrest. Cutting it invites trouble.' },
];

function arrow(d, pct, upGood) {
  if (!isFinite(pct) || Math.abs(pct) < 0.5) return '';
  const up = d > 0; const good = upGood ? up : !up;
  return '<span class="ar ' + (good ? 'good' : 'warn') + '">' + (up ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(0) + '%</span>';
}
function monthlyHtml(m, animate) {
  if (!m) return '<div class="muted">No month has been closed yet.</div>';
  const mxIn = Math.max(...m.rev.map(x => x.v), 1e-9), mxOut = Math.max(...m.spend.map(x => x.v), 1e-9), mx = Math.max(mxIn, mxOut);
  const row = (x, cls, upGood) => '<div class="rrow"><div class="t"><span>' + esc(x.label) + '</span><span class="mono">' + esc(E.money(x.v)) + arrow(x.d, x.dPct, upGood) + '</span></div><div class="rbar ' + cls + '"><i data-w="' + Math.max(2, x.v / mx * 100).toFixed(1) + '" style="width:' + (animate ? 0 : Math.max(2, x.v / mx * 100).toFixed(1)) + '%"></i></div></div>';
  const bal = m.bal, balCls = bal >= 0 ? 'good' : 'bad';
  return '<div class="rcols"><div class="rcol"><h5><span>Money in</span><span class="mono">' + esc(E.money(m.totRev)) + '</span></h5>' + m.rev.map(x => row(x, 'in', true)).join('') +
    (m.leak > 0.01 ? '<div class="rrow"><div class="t"><span class="faint">Lost to corruption</span><span class="mono faint">' + esc(E.money(m.leak)) + '</span></div></div>' : '') + '</div>' +
    '<div class="rcol"><h5><span>Money out</span><span class="mono">' + esc(E.money(m.totSpend)) + '</span></h5>' + m.spend.map(x => row(x, 'out', false)).join('') + '</div></div>' +
    (Math.abs(m.oneOff) > m.gdp * 0.0001 ? '<div class="rrow" style="margin-top:6px"><div class="t"><span>One-off items from your decisions and events</span><span class="mono ' + (m.oneOff >= 0 ? 'good' : 'bad') + '">' + (m.oneOff >= 0 ? '+' : '-') + esc(E.money(Math.abs(m.oneOff))) + '</span></div></div>' : '') +
    '<div class="rfoot"><div><div class="k">Balance</div><div class="v ' + balCls + '">' + (bal >= 0 ? '+' : '-') + esc(E.money(Math.abs(bal))) + '</div><div class="d">' + (m.balPct >= 0 ? '+' : '') + m.balPct.toFixed(1) + '% of GDP a year</div></div>' +
    '<div><div class="k">Treasury</div><div class="v">' + esc(E.money(m.treasury)) + '</div><div class="d">' + (m.dTreasury >= 0 ? '+' : '-') + esc(E.money(Math.abs(m.dTreasury))) + '</div></div>' +
    '<div><div class="k">Debt</div><div class="v">' + esc(E.money(m.debt)) + '</div><div class="d">' + f0(m.dpct) + '% of GDP, ' + f1(m.rate) + '% rate</div></div></div>';
}
function budgetView() {
  const c = E.me(); const lim = E.BUDGET_LIM;
  let out = '<div class="sec"><h3>Annual budget <small class="faint">Applied monthly</small></h3><div id="budsum">' + budgetSummary() + '</div></div><div class="sec"><h3>Levers</h3>';
  BUD.forEach(b => {
    const l = lim[b.k], v = b.get(c), base = b.base(c);
    out += '<div class="slider"><div class="top"><b>' + b.n + '</b><span class="amt" id="bv-' + b.k + '">' + f1(v) + '%</span></div>' +
      '<input type="range" id="bs-' + b.k + '" data-bud="' + b.k + '" min="' + l[0] + '" max="' + l[1] + '" step="' + b.step + '" value="' + v + '" aria-label="' + b.n + '">' +
      '<div class="sub"><span>' + b.hint + '</span><span class="mono" id="bd-' + b.k + '">' + budDelta(v, base) + '</span></div></div>';
  });
  out += '</div>';
  const mob = c.mob;
  out += '<div class="sec"><h3>Mobilisation <small class="faint">' + ['Peacetime', 'Alert', 'Partial', 'Total'][mob] + '</small></h3>' +
    '<div class="seg" style="width:100%">' + ['Peace', 'Alert', 'Partial', 'Total'].map((l, i) => '<button style="flex:1" data-act="mob" data-id="' + i + '" class="' + (mob === i ? 'on' : '') + '">' + l + '</button>').join('') + '</div>' +
    '<div class="muted" style="margin-top:6px;font-size:12.5px">Raising the level swells the army (+22% at total) but costs 1 political capital, hurts approval and unsettles business. Lowering it is free.</div></div>';
  out += '<div class="sec"><h3>Last month <small class="faint">' + esc((E.monthlyReport() || {}).date || '') + '</small></h3>' + monthlyHtml(E.monthlyReport(), false) + '</div>';
  const yrs = E.annualList(); if (yrs.length) out += '<div class="sec"><h3>Annual reports</h3><div class="chips">' + yrs.slice().reverse().map(y => '<button class="chip acc" style="cursor:pointer" data-act="annual" data-id="' + y.year + '">' + y.year + ' &middot; ' + y.overall + '</button>').join('') + '</div></div>';
  return out;
}
function budDelta(v, base) { const d = v - base; return Math.abs(d) < 0.05 ? 'normal' : sgn(d, 1) + ' vs normal'; }
function budgetSummary() {
  const c = E.me(); const f = E.fiscalPreview(c); const ci = E.creditInfo();
  const row = (k, v, cl) => '<div class="stat"><span class="k">' + k + '</span><span class="v ' + (cl || '') + '">' + v + '</span></div>';
  return row('Revenue', esc(E.money(f.rev)) + ' <span class="faint">(' + f1(f.revPct) + '% of GDP)</span>') + row('Programmes and admin', esc(E.money(f.prog + f.admin)) + '') + row('Debt interest', esc(E.money(f.interest)) + ' <span class="faint">at ' + f1(f.rate) + '%</span>') +
    row('Balance per year', esc(E.money(f.balance)) + ' <span class="faint">(' + sgn(f.balPct, 1) + '% of GDP)</span>', f.balance >= 0 ? 'good' : 'bad') +
    row('Credit rating', esc(ci.rating) + ' <span class="faint">' + esc(ci.outlook.toLowerCase()) + ' outlook</span>', ci.junk ? 'bad' : ci.outlook === 'Negative' ? 'warn' : '') + row('Treasury', esc(E.money(c.treasury))) + row('National debt', esc(E.money(c.debtAbs)) + ' <span class="faint">(' + f0(E.debtPct(c)) + '% of GDP)</span>', E.debtPct(c) > 100 ? 'warn' : '');
}
function updateBudgetLive(key) {
  const c = E.me(); const b = BUD.find(x => x.k === key); if (!b) return;
  const v = b.get(c); const el = $('#bv-' + key); if (el) el.textContent = f1(v) + '%';
  const d = $('#bd-' + key); if (d) d.textContent = budDelta(v, b.base(c));
  const s = $('#budsum'); if (s) s.innerHTML = budgetSummary();
}

// ---------- POLICY ----------
function policyView() {
  const s = S(); const list = E.policyList();
  let out = '<div class="sec"><h3>Policy <small class="faint">Capital ' + f1(s.pc) + ' of ' + s.pcMax + ', +' + f1(s.pcRegen || 0) + ' a month</small></h3><div class="muted" style="font-size:12.5px">Every big decision costs political capital. It regrows each month, faster when your party and the public are behind you. Unspent capital above the cap is wasted.</div></div>';
  const cats = ['Economy', 'Society', 'Power'];
  cats.forEach(cat => {
    out += '<div class="catrow">' + cat + '</div>';
    list.filter(p => p.cat === cat).sort((a, b) => (b.ok - a.ok)).forEach(p => {
      out += '<div class="row-item" style="' + (p.ok ? '' : 'opacity:.62') + '"><div class="t">' + esc(p.name) + '<span class="cost">' + f1(p.pc) + ' PC</span></div>' +
        '<div class="a"><button class="btn sm ' + (p.ok ? 'primary' : '') + '" data-act="enact" data-id="' + esc(p.id) + '" ' + (p.ok ? '' : 'disabled') + '>Enact</button></div>' +
        '<div class="d">' + esc(p.desc) + '</div>' + (p.ok ? '' : '<div class="why">' + esc(p.why) + '</div>') + '</div>';
    });
  });
  out += projectsSec();
  return out;
}
function projectsSec() {
  const act = E.projectStatus(), list = E.projectList().filter(p => !p.on);
  let out = '<div class="catrow">National programmes</div><div class="muted" style="font-size:12.5px;margin:4px 0 8px">Long projects cost money every month and throw up decisions along the way. Their payoff depends on how well you look after them.</div>';
  act.forEach(p => {
    out += '<div class="row-item"><div class="t">' + esc(p.name) + '<span class="cost">' + E.mo(p.left) + ' left</span></div><div class="a"><button class="btn sm ghost" data-act="pjcancel" data-id="' + esc(p.id) + '">Cancel</button></div>' +
      '<div class="bar ' + (p.q >= 0.7 ? 'good' : p.q >= 0.45 ? 'info' : 'bad') + '" style="margin:6px 0 3px"><i style="width:' + p.pct + '%"></i></div><div class="d">' + esc(p.health) + '. Costs ' + p.cost.toFixed(2) + '% of GDP a year.</div></div>';
  });
  list.forEach(p => {
    out += '<div class="row-item" style="' + (p.ok ? '' : 'opacity:.62') + '"><div class="t">' + esc(p.name) + '<span class="cost">' + f1(p.pc) + ' PC</span></div><div class="a"><button class="btn sm ' + (p.ok ? 'primary' : '') + '" data-act="pjstart" data-id="' + esc(p.id) + '" ' + (p.ok ? '' : 'disabled') + '>Launch</button></div>' +
      '<div class="d">' + esc(p.desc) + ' About ' + E.mo(p.months) + ', ' + p.cost.toFixed(2) + '% of GDP a year.</div>' + (p.ok ? '' : '<div class="why">' + esc(p.why) + '</div>') + '</div>';
  });
  return out;
}

// ---------- DIPLOMACY ----------
const DIPCATS = [['friendly', 'Friendly'], ['economic', 'Economic'], ['security', 'Security'], ['coercive', 'Pressure'], ['war', 'War and peace']];
function relBlock(info) {
  if (info.rel == null) return '';
  const pos = (info.rel + 100) / 2;
  return '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>' + esc(info.relWord) + '</b><span class="mono faint">' + sgn(info.rel, 0) + '</span></div><div class="relmeter"><i style="left:' + pos + '%"></i></div><div class="scale"><span>-100</span><span>0</span><span>+100</span></div>' + (info.iso ? '<button class="btn sm ghost" style="margin-top:6px" data-act="explain" data-id="rel:' + esc(info.iso) + '">Why this relationship?</button>' : '') + '</div>';
}
function isoLink(iso) { return '<button class="chip" data-act="sel" data-id="' + esc(iso) + '" style="cursor:pointer">' + esc(E.nm(iso)) + '</button>'; }
function dossier(iso) {
  const s = S(); const i = E.countryInfo(iso); const isMe = iso === s.player;
  let out = '<div class="sec"><div class="hero"><div><div class="eyebrow">' + esc(i.gov) + '</div><h2>' + esc(i.name) + '</h2><div class="sub">' + esc(E.popStr(i.pop)) + ' people, ' + esc(E.money(i.gdp)) + ' economy' + (i.rankGdp != null ? ' (#' + i.rankGdp + ')' : '') + (i.rankPow != null ? ', military rank #' + i.rankPow : '') + '</div></div></div>';
  const ch = [];
  if (isMe) ch.push('<span class="chip acc">Your country</span>');
  if (!i.alive) ch.push('<span class="chip bad">Annexed' + (i.ownerName ? ' by ' + esc(i.ownerName) : '') + '</span>');
  if (i.nukes) ch.push('<span class="chip bad">Nuclear-armed</span>');
  if (i.pact) ch.push('<span class="chip good">Defence pact with you</span>');
  if (i.deal) ch.push('<span class="chip good">Trade deal</span>');
  if (i.sanctionedByYou) ch.push('<span class="chip warn">You sanction them</span>');
  if (i.sanctionedYou) ch.push('<span class="chip warn">They sanction you</span>');
  i.blocs.forEach(b => ch.push('<span class="chip info">' + esc(b) + '</span>'));
  i.wars.forEach(w => ch.push('<span class="chip bad">At war with ' + esc(E.nm(w.vs)) + '</span>'));
  if (ch.length) out += '<div class="chips" style="margin-top:8px">' + ch.join('') + '</div>';
  out += relBlock(i) + '</div>';
  out += '<div class="sec"><div class="grid2">' +
    '<div class="stat"><span class="k">GDP per person</span><span class="v">' + (i.gdppc >= 1000 ? '$' + f1(i.gdppc / 1000) + 'k' : '$' + f0(i.gdppc)) + '</span></div>' +
    '<div class="stat"><span class="k">Growth</span><span class="v ' + (i.growth < 0 ? 'bad' : '') + '">' + sgn(i.growth, 1) + '%</span></div>' +
    '<div class="stat"><span class="k">Military power</span><span class="v">' + f0(i.power) + '</span></div>' +
    '<div class="stat"><span class="k">Technology</span><span class="v">' + i.tech + ' / 5</span></div>' +
    '<div class="stat"><span class="k">Stability</span><span class="v ' + (i.stab < 30 ? 'bad' : '') + '">' + f0(i.stab) + '</span></div>' +
    '<div class="stat"><span class="k">Prestige</span><span class="v">' + f0(i.prest) + '</span></div></div></div>';
  if (i.leader) out += '<div class="sec"><h3>Leader</h3><div class="stat"><span class="k">' + esc(i.leader.name) + '</span><span class="v">' + esc(i.leader.trait) + '</span></div><div class="muted" style="font-size:12.5px">' + esc(i.leader.traitDesc) + '</div>' + (i.leader.memories.length ? '<div style="margin-top:6px">' + i.leader.memories.map(m => '<div class="newsi ' + (m.good ? 'peace' : 'war') + '"><small>' + (m.good ? 'Remembers fondly' : 'Remembers with resentment') + '</small>' + esc(m.text) + '</div>').join('') + '</div>' : '') + '</div>';
  if (i.rivals.length) out += '<div class="sec"><h3>Rivalries</h3><div class="chips">' + i.rivals.map(r => '<button class="chip bad" data-act="sel" data-id="' + esc(r.iso) + '" style="cursor:pointer" title="' + esc(r.why || '') + '">' + esc(E.nm(r.iso)) + (r.n >= 3 ? ' (bitter)' : r.n === 2 ? ' (serious)' : '') + '</button>').join('') + '</div></div>';
  if (i.allies.length) out += '<div class="sec"><h3>Allies</h3><div class="chips">' + i.allies.map(isoLink).join('') + '</div></div>';
  if (i.intel) out += '<div class="sec"><h3>Intelligence</h3><div class="muted" style="font-size:12.5px">' + esc(E.intelText(iso)) + '</div></div>';
  return out;
}
function dipView() {
  const s = S(); let out = '';
  if (UI.sel && E.C(UI.sel)) {
    const iso = UI.sel;
    out += dossier(iso);
    if (iso !== s.player) {
      if (!E.alive(iso)) out += '<div class="sec muted">This country no longer exists as an independent state.</div>';
      else {
        const list = E.dipList(iso);
        out += '<div class="sec"><h3>Actions <small class="faint">Capital ' + f1(s.pc) + '</small></h3>';
        DIPCATS.forEach(([cat, lab]) => {
          const items = list.filter(d => d.cat === cat); if (!items.length) return;
          const on = items.filter(d => d.ok), off = items.filter(d => !d.ok);
          out += '<div class="catrow">' + lab + '</div>';
          on.concat(off).forEach(d => {
            // hide clearly irrelevant disabled entries to cut noise
            if (!d.ok && /not at war|not in a war|They are not at war|not the enemy|No bilateral|not sanctioned|have not sanctioned|Not supporting|not a member|Already at war|Already a/i.test(d.why || '')) return;
            out += '<div class="row-item" style="' + (d.ok ? '' : 'opacity:.6') + '"><div class="t">' + esc(d.label) + (d.pc ? '<span class="cost">' + f1(d.pc) + ' PC</span>' : '<span class="cost free">free</span>') + (d.cost ? '<span class="cost free">' + esc(E.money(d.cost)) + '</span>' : '') + (d.chance != null ? '<span class="pct">' + Math.round(d.chance * 100) + '% ' + esc(d.chanceLabel || 'odds') + '</span>' : '') + '</div>' +
              '<div class="a"><button class="btn sm ' + (d.ok ? (cat === 'war' && d.id === 'declare' ? 'danger' : 'primary') : '') + '" data-act="dip" data-id="' + esc(d.id) + '" data-t="' + esc(iso) + '" ' + (d.ok ? '' : 'disabled') + '>' + (d.id === 'declare' ? 'Declare' : 'Do it') + '</button></div>' +
              '<div class="d">' + esc(d.desc) + '</div>' + (d.ok ? '' : '<div class="why">' + esc(d.why) + '</div>') + '</div>';
          });
        });
        out += '</div>';
      }
    }
  } else {
    out += '<div class="sec"><h3>Diplomacy</h3><div class="muted">Click any country on the map to see its dossier and open channels: delegations, trade deals, sanctions, pacts, ultimatums and war.</div></div>';
    const al = E.defenceAllies(s.player);
    out += '<div class="sec"><h3>Your allies</h3>' + (al.length ? '<div class="chips">' + al.slice(0, 24).map(isoLink).join('') + '</div>' : '<div class="muted">You have no formal allies. In a crisis you stand alone.</div>') + '</div>';
    const rv = s.rivals.filter(r => r.a === s.player || r.b === s.player);
    if (rv.length) out += '<div class="sec"><h3>Your rivals</h3><div class="chips">' + rv.map(r => isoLink(r.a === s.player ? r.b : r.a)).join('') + '</div></div>';
  }
  out += blocsSection();
  return out;
}
function blocsSection() {
  const s = S(); const ids = Object.keys(s.blocs);
  const mine = ids.filter(id => s.blocs[id].members.includes(s.player));
  const others = ids.filter(id => !mine.includes(id));
  let out = '<div class="sec"><h3>Alliances and blocs' + (s.apps.length ? ' <small class="warn">Application to ' + esc(s.blocs[s.apps[0].bloc].name) + ' pending</small>' : '') + '</h3>';
  const row = id => {
    const b = s.blocs[id], inn = b.members.includes(s.player);
    let btn = '', why = '';
    if (inn) btn = '<button class="btn sm" data-act="leave" data-id="' + id + '">Leave</button>';
    else { const w = E.blocEligible(id, s.player); if (w) why = w; else { const o = E.blocOdds(id, s.player); why = 'Estimated odds ' + Math.round(o.p * 100) + '%' + (o.veto ? ', ' + E.nm(o.veto) + ' would veto' : ''); btn = '<button class="btn sm primary" data-act="apply" data-id="' + id + '">Apply</button>'; } }
    return '<div class="row-item"><div class="t">' + esc(b.name) + '<span class="chip">' + esc(b.type) + '</span><span class="pct">' + b.members.length + ' members</span></div><div class="a">' + btn + '</div><div class="d">' + esc(b.desc || '') + '</div>' + (why ? '<div class="why">' + esc(why) + '</div>' : '') + '</div>';
  };
  out = out.replace('</h3>', '</h3><div class="muted" style="font-size:12.5px;margin:-2px 0 6px">Defence blocs and pacts are called in when a member is <b>attacked</b>. If a member starts a war itself, you are asked for support but not obliged to give it.</div>') + mine.concat(others).map(row).join('') + '</div>';
  return out;
}

// ---------- WAR ----------
function warCard(w) {
  const s = S(); const side = E.warSideOf(w, s.player); const opp = side === 'a' ? 'b' : 'a';
  const sc = side === 'a' ? w.score : -w.score; const enemy = w.lead[opp];
  const months = w.m0 + (s.turn - w.start);
  const names = arr => arr.map(x => E.nm(x)).join(', ');
  const isLead = w.lead[side] === s.player;
  const dl = E.dipList(enemy);
  const cf = dl.find(d => d.id === 'ceasefire'), wd = dl.find(d => d.id === 'withdraw');
  let out = '<div class="war-card"><h4><span>' + esc(E.nm(w.lead[side])) + ' vs ' + esc(E.nm(enemy)) + '</span><span class="' + (sc > 8 ? 'good' : sc < -8 ? 'bad' : 'warn') + '" style="font-size:13px;font-family:var(--font-body)">' + scoreWord(sc) + '</span></h4>';
  out += '<div class="tug you"><i style="left:' + (50 + sc / 2) + '%"></i></div><div class="scale"><span>Defeat</span><span>' + E.mo(months) + ' in</span><span>Victory</span></div>';
  out += '<div class="stat"><span class="k">Aim</span><span class="v">' + ({ conquest: 'Conquest', regime: 'Regime change', humiliate: 'Punish and deter' }[w.goal] || w.goal) + '</span></div>';
  out += '<div class="stat"><span class="k">Your side</span><span class="v">' + esc(names(w[side])) + '</span></div>';
  out += '<div class="stat"><span class="k">Their side</span><span class="v">' + esc(names(w[opp])) + '</span></div>';
  const sup = (w.sup[side] || []), sup2 = (w.sup[opp] || []);
  if (sup.length) out += '<div class="stat"><span class="k">Sending you aid</span><span class="v">' + esc(names(sup)) + '</span></div>';
  if (sup2.length) out += '<div class="stat"><span class="k">Arming them</span><span class="v">' + esc(names(sup2)) + '</span></div>';
  { const wf = E.warForces(w.id); if (wf) { out += '<div class="stat"><span class="k">Balance of forces</span><span class="v ' + (wf.ratio >= 1.2 ? 'good' : wf.ratio < 0.8 ? 'bad' : '') + '">' + esc(wf.verdict) + ' (' + (wf.capped ? 'over 20' : wf.ratio.toFixed(1)) + ' to 1)</span></div><div class="faint" style="font-size:11.5px;margin:-2px 0 4px">Army size times readiness for everyone in the war, plus 30% for those arming a side. It does not count nukes, terrain or morale.</div>'; if (wf.cost) out += '<div class="stat"><span class="k">Cost of the war</span><span class="v">' + wf.cost.toFixed(1) + '% of your GDP a year, more with mobilisation</span></div>'; } }
  out += '<div class="stat"><span class="k">War weariness at home</span><span class="v ' + (E.me().warWeary > 50 ? 'bad' : '') + '">' + f0(E.me().warWeary) + '</span></div>';
  out += '<div class="field" style="margin-top:10px"><div class="lab">Posture</div><div class="seg" style="width:100%">' + [['def', 'Defensive'], ['bal', 'Balanced'], ['off', 'Offensive']].map(([k, l]) => '<button style="flex:1" data-act="stance" data-id="' + w.id + '" data-v="' + k + '" class="' + (w.stance[side] === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div class="faint" style="font-size:11.5px;margin-top:4px">Offensive presses harder (+12% force) but bleeds more. Defensive is steadier.</div></div>';
  const plans = E.planList(w.id), curPlan = plans.find(x => x.on) || plans[0];
  out += '<div class="field" style="margin-top:12px"><div class="lab">Campaign plan</div><div class="seg" style="width:100%;flex-wrap:wrap">' + plans.map(x => '<button style="flex:1 1 auto" data-act="plan" data-id="' + w.id + '" data-v="' + x.id + '" class="' + (x.on ? 'on' : '') + '" ' + (x.ok || x.on ? '' : 'disabled') + ' title="' + esc(x.why || '') + '">' + esc(x.name) + '</button>').join('') + '</div><div class="faint" style="font-size:11.5px;margin-top:4px">' + esc(curPlan.desc) + ' Changing plan costs political capital.</div></div>';
  out += '<div class="field" style="margin-top:12px"><div class="lab">Operations <span style="text-transform:none;letter-spacing:0" class="faint">One-off orders, each on a cooldown</span></div>' + E.opList(w.id).map(o =>
    '<div class="row-item" style="padding:8px 0;' + (o.ok ? '' : 'opacity:.62') + '"><div class="t" style="font-size:13px">' + esc(o.name) + '<span class="cost">' + f1(o.pc) + ' PC</span>' + (o.cost ? '<span class="cost free">' + esc(E.money(o.cost)) + '</span>' : '') + '</div><div class="a"><button class="btn sm ' + (o.ok ? 'primary' : '') + '" data-act="op" data-id="' + w.id + '" data-v="' + o.id + '" ' + (o.ok ? '' : 'disabled') + '>Order</button></div><div class="d" style="font-size:12px">' + esc(o.desc) + '</div>' + (o.ok ? '' : '<div class="why">' + esc(o.why) + '</div>') + '</div>').join('') + '</div>';
  out += '<div class="btnrow">';
  if (isLead && cf) out += '<button class="btn sm primary" data-act="dip" data-id="ceasefire" data-t="' + enemy + '" ' + (cf.ok ? '' : 'disabled') + ' title="' + esc(cf.why || '') + '">Propose ceasefire' + (cf.chance != null ? ' (' + Math.round(cf.chance * 100) + '%)' : '') + '</button>';
  const tm = dl.find(d => d.id === 'terms');
  if (isLead && tm && (tm.ok || sc >= 25)) out += '<button class="btn sm primary" data-act="dip" data-id="terms" data-t="' + enemy + '" ' + (tm.ok ? '' : 'disabled') + ' title="' + esc(tm.why || '') + '">Press for terms' + (tm.chance != null ? ' (' + Math.round(tm.chance * 100) + '%)' : '') + '</button>';
  if (!isLead && wd) out += '<button class="btn sm" data-act="dip" data-id="withdraw" data-t="' + enemy + '" ' + (wd.ok ? '' : 'disabled') + '>Withdraw from war</button>';
  if (E.me().nukes) out += '<button class="btn sm danger" data-act="nuke" data-t="' + enemy + '">Nuclear strike</button>';
  out += '<button class="btn sm ghost" data-act="sel" data-id="' + enemy + '">Dossier</button></div></div>';
  return out;
}
function warView() {
  const s = S(), c = E.me();
  const mine = E.warsOf(s.player);
  let out = '<div class="sec"><h3>Your armed forces</h3><div class="grid2">' +
    '<div class="stat"><span class="k">Army power</span><span class="v">' + f0(E.power(c)) + '</span></div>' +
    '<div class="stat"><span class="k">Global rank</span><span class="v">#' + E.countryInfo(s.player).rankPow + '</span></div>' +
    '<div class="stat"><span class="k">Readiness</span><span class="v">' + f0(c.readiness) + '%</span></div>' +
    '<div class="stat"><span class="k">Technology</span><span class="v">' + c.tech + ' / 5</span></div>' +
    '<div class="stat"><span class="k">Mobilisation</span><span class="v">' + ['Peace', 'Alert', 'Partial', 'Total'][c.mob] + '</span></div>' +
    '<div class="stat"><span class="k">Nuclear weapons</span><span class="v">' + (c.nukes ? (c.nukes > 1 ? 'Major arsenal' : 'Small arsenal') : (c.flags.nukeProg ? 'Programme: ' + c.flags.nukeProg + ' mo' : 'None')) + '</span></div></div>' +
    '<div class="muted" style="font-size:12.5px;margin-top:8px">Set spending and mobilisation on the Budget tab. To go to war, open a country\'s dossier under Diplomacy.</div></div>';
  out += '<div class="sec"><h3>Your wars</h3>' + (mine.length ? mine.map(warCard).join('') : '<div class="muted">You are at peace.</div>') + '</div>';
  const sup = (c.flags.supporting || []).filter(E.alive);
  if (sup.length) out += '<div class="sec"><h3>Military aid you send</h3><div class="chips">' + sup.map(x => '<span class="chip">' + esc(E.nm(x)) + ' <button data-act="dip" data-id="stopsupport" data-t="' + x + '" style="border:0;background:none;color:var(--bad);cursor:pointer;padding:0 0 0 4px">end</button></span>').join('') + '</div><div class="muted" style="font-size:12px;margin-top:6px">Costs about 0.12% of GDP a year per country.</div></div>';
  const others = s.wars.filter(w => !E.playerBelligerentIn(w));
  out += '<div class="sec"><h3>Wars elsewhere</h3>' + (others.length ? others.map(w => {
    const a = w.lead.a, b = w.lead.b;
    const btns = [];
    const push = (id, t, label) => { const d = E.dipList(t).find(x => x.id === id); if (d && d.ok) btns.push('<button class="btn sm" data-act="dip" data-id="' + id + '" data-t="' + t + '">' + label + '</button>'); };
    push('mediate', a, 'Broker peace'); push('support', a, 'Aid ' + esc(E.nm(a))); push('support', b, 'Aid ' + esc(E.nm(b))); push('joinwar', a, 'Join ' + esc(E.nm(a))); push('joinwar', b, 'Join ' + esc(E.nm(b)));
    return '<div class="row-item" style="grid-template-columns:1fr"><div class="t"><button class="chip" data-act="sel" data-id="' + a + '" style="cursor:pointer">' + esc(E.nm(a)) + '</button> vs <button class="chip" data-act="sel" data-id="' + b + '" style="cursor:pointer">' + esc(E.nm(b)) + '</button><span class="pct">' + scoreWord(w.score) + ' for ' + esc(E.nm(w.score >= 0 ? a : b)) + '</span></div>' + (btns.length ? '<div class="btnrow">' + btns.join('') + '</div>' : '') + '</div>';
  }).join('') : '<div class="muted">No other wars are being fought.</div>') + '</div>';
  return out;
}

// ---------- WORLD ----------
function worldView() {
  const s = S(); const t = s.world.tension;
  let out = '<div class="sec"><h3>World tension <small class="' + (t > 65 ? 'bad' : t > 45 ? 'warn' : 'faint') + '">' + esc(tensionWord(t)) + '</small></h3><div class="gauge"><i style="left:' + Math.max(1, Math.min(99, t)) + '%"></i></div><div class="scale"><span>0</span><span>50</span><span>100</span></div><div class="muted" style="font-size:12.5px;margin-top:6px">Driven by wars, rivalries, arms races and nuclear posturing. High tension makes new wars more likely for everyone, including you.</div>' +
    (s.world.nukeUse ? '<div class="bad" style="margin-top:6px">A nuclear weapon has been used ' + s.world.nukeUse + (s.world.nukeUse > 1 ? ' times' : ' time') + '.</div>' : '') + '</div>';
  const list = E.aliveList(); const rk = (fn, n) => list.slice().sort((a, b) => fn(E.C(b)) - fn(E.C(a))).slice(0, n);
  const table = (title, arr, val) => {
    let inTop = arr.includes(s.player); let rows = arr.map((i, k) => '<tr data-iso="' + i + '" class="' + (i === s.player ? 'me' : '') + '"><td class="n">' + (k + 1) + '</td><td>' + esc(E.nm(i)) + '</td><td>' + val(E.C(i)) + '</td></tr>').join('');
    return '<div class="sec"><h3>' + title + '</h3><table class="rank">' + rows + '</table></div>';
  };
  out += table('Largest economies', rk(c => c.gdp, 8), c => esc(E.money(c.gdp)));
  out += table('Strongest militaries', rk(c => E.power(c), 8), c => f0(E.power(c)));
  out += '<div class="sec"><h3>News</h3>' + (s.news.length ? s.news.slice(0, 40).map(n => '<div class="newsi ' + esc(n.tag) + '" ' + (n.iso ? 'data-iso="' + esc(n.iso) + '"' : '') + '><small>' + esc(n.d) + '</small>' + esc(n.text) + '</div>').join('') : '<div class="muted">Nothing to report.</div>') + '</div>';
  return out;
}
