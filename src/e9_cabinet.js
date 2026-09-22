// ===================== PEOPLE: CABINET AND RIVAL LEADERS =====================
// Advisers have opinions, favour certain kinds of decisions, and lose or gain loyalty as you decide.
// Rival leaders have personalities and long memories of how you have treated them.

const GIVEN = ['Ada', 'Mateo', 'Lena', 'Kenji', 'Nadia', 'Tomas', 'Priya', 'Idris', 'Sofia', 'Daniel', 'Yara', 'Emil', 'Amara', 'Rafael', 'Ingrid', 'Karim', 'Mei', 'Oleg', 'Farah', 'Hugo', 'Zainab', 'Viktor', 'Carla', 'Tariq', 'Elena', 'Bao', 'Sven', 'Lucia', 'Anton', 'Noor', 'Joaquin', 'Freya', 'Dmitri', 'Amina', 'Pavel', 'Isabel', 'Kofi', 'Hana', 'Marek', 'Selim'];
const FAMILY = ['Okoro', 'Rios', 'Voss', 'Aoki', 'Farouk', 'Brandt', 'Nair', 'Mbeki', 'Marek', 'Achterberg', 'Haddad', 'Sorensen', 'Diallo', 'Costa', 'Lindqvist', 'Bashir', 'Zhao', 'Petrenko', 'Rahimi', 'Delacroix', 'Osei', 'Kovacs', 'Mendes', 'Yilmaz', 'Torres', 'Nguyen', 'Halloran', 'Bianchi', 'Volkov', 'Mansour', 'Duarte', 'Eriksen', 'Adeyemi', 'Kuzmin', 'Salazar', 'Tanaka', 'Wójcik', 'Barzani', 'Ferreira', 'Hollis'];
const GIVEN2 = ['Aisha', 'Bruno', 'Chidi', 'Dara', 'Esra', 'Felix', 'Gita', 'Hana', 'Ivo', 'Jamal', 'Keiko', 'Leandro', 'Malak', 'Nkosi', 'Olga', 'Pavel', 'Quinn', 'Rania', 'Sami', 'Thabo', 'Uma', 'Vera', 'Wanjiru', 'Xavier', 'Yusuf', 'Zora', 'Anselm', 'Bettina', 'Cyrus', 'Delia', 'Enzo', 'Freya', 'Gustavo', 'Halima', 'Ilya', 'Jun', 'Kwame', 'Leila', 'Marcus', 'Noor', 'Omar', 'Petra', 'Ravi', 'Selim', 'Talia', 'Ugo', 'Vikram', 'Wen', 'Yasmin', 'Zubair'];
const FAMILY2 = ['Adeyemi', 'Baptiste', 'Cardoso', 'Dragomir', 'Eze', 'Fontaine', 'Gunawan', 'Hoxha', 'Ibrahim', 'Jovanovic', 'Kimura', 'Lambert', 'Mahlangu', 'Novak', 'Okafor', 'Pereira', 'Qureshi', 'Reyes', 'Suleiman', 'Tanaka', 'Uddin', 'Volkov', 'Wanjala', 'Xu', 'Yamada', 'Zielinski', 'Abara', 'Bergstrom', 'Chaudhry', 'Demir', 'Eriksen', 'Ferrari', 'Guerrero', 'Hassan', 'Ivanov', 'Jansen', 'Karimi', 'Lopes', 'Moretti', 'Nwosu', 'Ortega', 'Popov', 'Rossi', 'Santos', 'Tesfaye', 'Umarov', 'Vasquez', 'Wagner', 'Yeo', 'Zaman'];
const randName = () => pick(GIVEN.concat(GIVEN2)) + ' ' + pick(FAMILY.concat(FAMILY2));
// a name nobody in your cabinet or among the rival leaders already has
function uniqueName() {
  const used = new Set(); Object.values(S.cabinet || {}).forEach(a => a && used.add(a.name)); Object.values(S.leaders || {}).forEach(l => l && used.add(l.name));
  let n = randName(), g = 0; while (g++ < 30 && used.has(n)) n = randName(); return n;
}

const ROLES = {
  defence: { title: 'Defence Minister', axis: 'hawk', lo: 'dove', hi: 'hawk', loT: 'Cautious on force', hiT: 'Hawkish', desc: 'Readiness of the armed forces.' },
  treasury: { title: 'Finance Minister', axis: 'spend', lo: 'thrifty', hi: 'spender', loT: 'Fiscal hawk', hiT: 'Big spender', desc: 'How efficiently the state spends.' },
  foreign: { title: 'Foreign Minister', axis: 'hawk', lo: 'multilateralist', hi: 'nationalist', loT: 'Multilateralist', hiT: 'Nationalist', desc: 'Your standing in the world.' },
  security: { title: 'Interior Minister', axis: 'order', lo: 'liberal', hi: 'law-and-order', loT: 'Civil libertarian', hiT: 'Law and order', desc: 'Policing and internal security.' },
  spin: { title: 'Communications Director', axis: 'pop', lo: 'principled', hi: 'populist', loT: 'Principled', hiT: 'Populist', desc: 'How well your decisions are sold.' },
};
const ROLE_KEYS = Object.keys(ROLES);
const REL_FAC = { defence: 'military', treasury: 'business', foreign: null, security: 'party', spin: 'public' };

function newAdviser(role, taken) {
  const lean = Math.round((rnd() * 2 - 1) * 10) / 10;
  const name = uniqueName();
  return { id: 'a' + (S.cabSeq = (S.cabSeq || 0) + 1), role, name, lean, comp: Math.min(5, 2 + Math.floor(rnd() * 3) + (rnd() < 0.22 ? 1 : 0)), ambition: Math.round(rnd() * 10) / 10, loyalty: 60 + Math.round(rnd() * 15), since: S.turn, status: 'serving' };
}
function cabinetEnsure() {
  if (!S.cabinet) { S.cabinet = {}; S.cabSeq = 0; ROLE_KEYS.forEach(r => { S.cabinet[r] = newAdviser(r); }); S.cabCand = {}; }
  if (!S.leaders) initLeaders();
}
function advisers() { cabinetEnsure(); return ROLE_KEYS.map(r => S.cabinet[r]); }
const compBonus = role => { const a = S.cabinet && S.cabinet[role]; return a && a.status === 'serving' ? (a.comp - 3) * (0.6 + a.loyalty / 250) : 0; };

// ---- how a decision reads to each adviser: keyword tags on the option text ----
const TAGS = {
  hawk: [[/retaliat|strike|invade|mobili[sz]|deploy|send in|army|troops|force|declare|sanction|hard|press|pre-?empt|warn|arm |defiant|crack/i, 1], [/talk|negotiat|de-?escalat|ceasefire|peace|accept|concession|apolog|offer|mediat|inspection|stand down|withdraw|let them go|autonomy/i, -1]],
  spend: [[/invest|pay|fund|subsid|relief|deal|stimulus|aid|rebuild|hire|expand|grant|bonus|raise pay/i, 1], [/cut|austerity|refuse|hold firm|ignore|nothing|freeze|save|do not|deny/i, -1]],
  order: [[/police|crack|ban|censor|troops|arrest|curfew|emergency powers|hard|force|detain|purge/i, 1], [/inquiry|reform|release|allow|free|open|amnesty|concede|autonomy|independent|apolog/i, -1]],
  pop: [[/rally|popular|announce|celebrate|grand|promise|tax cut|handout|defiant|bonus/i, 1], [/hard truth|cut|raise tax|unpopular|admit|austerity|quiet/i, -1]],
};
function tagOption(o) {
  const txt = (o.label || '') + ' ' + (o.hint || ''); const t = { hawk: 0, spend: 0, order: 0, pop: 0 };
  Object.keys(TAGS).forEach(k => TAGS[k].forEach(([re, v]) => { if (re.test(txt)) t[k] += v; }));
  const h = o.hint || ''; if (/approval\b.*(rise|up|boost|lift)|popular/i.test(h)) t.pop += 0.5; if (/costs? .*(gdp|money)/i.test(h)) t.spend += 0.5;
  Object.keys(t).forEach(k => { t[k] = clamp(t[k], -1, 1); });
  return t;
}
const affinity = (a, tag) => a.lean * (tag[ROLES[a.role].axis] || 0);

// which advisers care about this decision, and what they'd choose
function adviceFor(opts) {
  cabinetEnsure(); const out = [];
  const tags = opts.map(tagOption);
  ROLE_KEYS.forEach(r => {
    const a = S.cabinet[r]; if (!a || a.status !== 'serving') return;
    const ax = ROLES[r].axis;
    const scores = tags.map((t, i) => ({ i, s: a.lean * (t[ax] || 0), ok: opts[i].ok !== false }));
    const ok = scores.filter(x => x.ok); if (ok.length < 2) return;
    const spread = Math.max(...ok.map(x => x.s)) - Math.min(...ok.map(x => x.s));
    if (spread < 0.35) return;
    const best = ok.slice().sort((x, y) => y.s - x.s)[0], worst = ok.slice().sort((x, y) => x.s - y.s)[0];
    out.push({ role: r, who: a.name, title: ROLES[r].title, favours: best.i, opposes: worst.s < -0.3 ? worst.i : -1, spread, loyalty: a.loyalty, comp: a.comp });
  });
  return out.sort((x, y) => y.spread - x.spread).slice(0, 3);
}
function cabinetReact(opts, chosen) {
  cabinetEnsure(); const tags = opts.map(tagOption); const t = tags[chosen]; if (!t) return;
  ROLE_KEYS.forEach(r => {
    const a = S.cabinet[r]; if (!a || a.status !== 'serving') return;
    const ax = ROLES[r].axis, v = a.lean * (t[ax] || 0);
    if (Math.abs(v) < 0.25) return;
    a.loyalty = clamp(a.loyalty + v * (5 + a.ambition * 3), 0, 100);
    a.lastGrievance = v < 0 ? S.turn : a.lastGrievance;
  });
}

function cabinetStep() {
  cabinetEnsure(); const c = me();
  ROLE_KEYS.forEach(r => {
    const a = S.cabinet[r]; if (!a || a.status !== 'serving') return;
    a.loyalty = clamp(a.loyalty + (62 - a.loyalty) * 0.02 + (c.appr > 60 ? 0.15 : c.appr < 35 ? -0.35 : 0) + (c.stab < 30 ? -0.3 : 0), 0, 100);
    // passive effects of a competent (or incompetent) adviser
    const b = compBonus(r);
    if (r === 'defence') c.readiness = clamp(c.readiness + b * 0.35, 10, 100);
    if (r === 'security') c.secIdx = clamp(c.secIdx + b * 0.18, 0, 100);
    if (r === 'foreign') c.prest = clamp(c.prest + b * 0.05, 0, 100);
  });
  // trouble
  const list = advisers().filter(a => a.status === 'serving');
  if (S.events.length >= 2) return;
  list.forEach(a => {
    if (S.events.some(e => (e.id === 'adviserQuits' || e.id === 'cabinetLeak' || e.id === 'adviserDefects') && e.ctx.id === a.id)) return;
    if (S.turn - (a.lastEv || -99) < 10) return;
    if (a.loyalty < 12 && chance(0.25)) { a.lastEv = S.turn; queueEvent('adviserDefects', { id: a.id }); }
    else if (a.loyalty < 24 && chance(0.12 + a.ambition * 0.06)) { a.lastEv = S.turn; queueEvent('adviserQuits', { id: a.id }); }
    else if (a.loyalty < 40 && chance(0.03 + a.ambition * 0.03)) { a.lastEv = S.turn; queueEvent('cabinetLeak', { id: a.id }); }
  });
}
function adviserById(id) { return advisers().find(a => a.id === id) || null; }
function replaceAdviser(role, why) {
  const old = S.cabinet[role]; if (old) { old.status = why; old.left = S.turn; }
  const n = newAdviser(role); S.cabinet[role] = n; if (S.cabCand) delete S.cabCand[role];
  return n;
}
// a serving minister for an event to be about (so scandals involve people you actually appointed)
function pickServing() { const l = advisers().filter(a => a && a.status === 'serving'); return l.length ? pick(l) : null; }
function ministerTag(a) { return a ? { aid: a.id, minister: a.name, mrole: a.role } : { aid: null, minister: randName(), mrole: null }; }
// remove a minister for real: they leave the cabinet and someone new is appointed
function dismissMinister(aid, why) {
  const a = advisers().find(x => x && x.id === aid);
  if (!a || a.status !== 'serving') return null;
  const old = a.name; const n = replaceAdviser(a.role, why || 'sacked'); n.loyalty = 62;
  if (REL_FAC[a.role]) fac(me(), REL_FAC[a.role], -1.5);
  logPlayer(old + ' leaves as ' + ROLES[a.role].title + '. ' + n.name + ' takes over.');
  return { old, n, title: ROLES[a.role].title };
}
const dismissText = r => r ? r.old + ' is gone. ' + r.n.name + ' takes over as ' + r.title + '.' : '';
// a reshuffle removes your least loyal minister
function reshuffleCabinet() {
  const l = advisers().filter(a => a && a.status === 'serving').sort((a, b) => a.loyalty - b.loyalty); if (!l.length) return '';
  const r = dismissMinister(l[0].id, 'reshuffled'); return r ? dismissText(r) : '';
}
function candidatesFor(role) {
  cabinetEnsure(); if (!S.cabCand) S.cabCand = {};
  if (!S.cabCand[role] || S.cabCand[role].turn !== S.turn) { S.cabCand[role] = { turn: S.turn, list: [newAdviser(role), newAdviser(role)] }; S.cabCand[role].list.forEach(a => { a.loyalty = 65; }); }
  return S.cabCand[role].list;
}
function hireAdviser(role, idx) {
  cabinetEnsure(); const cands = candidatesFor(role), n = cands[idx];
  if (!n) return { ok: false, text: 'No such candidate.' };
  if (S.pc < 2) return { ok: false, text: 'A reshuffle costs 2 political capital.' };
  S.pc -= 2;
  const old = S.cabinet[role]; if (old) { old.status = 'sacked'; old.left = S.turn; }
  n.since = S.turn; S.cabinet[role] = n; delete S.cabCand[role];
  const c = me(); if (REL_FAC[role]) fac(c, REL_FAC[role], -1.5);
  logPlayer('Reshuffle: ' + n.name + ' becomes ' + ROLES[role].title + ', replacing ' + (old ? old.name : 'the post-holder') + '.');
  return { ok: true, text: n.name + ' is your new ' + ROLES[role].title + '.' };
}
function cabinetList() {
  return advisers().map(a => {
    const R_ = ROLES[a.role];
    const leanText = Math.abs(a.lean) < 0.25 ? 'Pragmatist' : a.lean > 0 ? R_.hiT : R_.loT;
    const mood = a.loyalty >= 65 ? 'Loyal' : a.loyalty >= 45 ? 'Steady' : a.loyalty >= 28 ? 'Restless' : 'On the brink';
    return { id: a.id, role: a.role, title: R_.title, name: a.name, lean: leanText, comp: a.comp, loyalty: a.loyalty, mood, desc: R_.desc, months: S.turn - a.since };
  });
}

// ===================== RIVAL LEADERS =====================
const TRAITS = { hawk: { n: 'Hawk', aggr: 1.35, memory: 0.02, d: 'Quick to escalate, slow to forgive.' }, dove: { n: 'Dove', aggr: 0.6, memory: 0.06, d: 'Prefers deals to war and forgives quickly.' }, schemer: { n: 'Schemer', aggr: 1.05, memory: 0.03, d: 'Plays a long game and remembers every slight.' }, pragmatist: { n: 'Pragmatist', aggr: 0.9, memory: 0.04, d: 'Follows interests, not grudges.' }, zealot: { n: 'Zealot', aggr: 1.2, memory: 0.025, d: 'Driven by ideology. Hard to bargain with.' } };
function newLeader(iso) {
  const c = C(iso); const auto = isAuto(c.gov);
  const w = { hawk: 1 + (auto ? 0.8 : 0) + c.aggr, dove: 1 + (isDemo(c.gov) ? 0.7 : 0) - c.aggr * 0.5, schemer: 0.8 + (auto ? 0.5 : 0), pragmatist: 1.4, zealot: 0.4 + (c.gov === 'T' ? 1.4 : 0) };
  const k = Object.keys(w); const t = weighted(k, x => Math.max(0.1, w[x]));
  return { name: uniqueName(), trait: t, since: S.turn, mem: [] };
}
function initLeaders() { S.leaders = {}; ISOS.forEach(i => { if (i !== S.player && C(i).alive) S.leaders[i] = newLeader(i); }); }
function replaceLeader(iso, keepMem) {
  if (!S.leaders || iso === S.player || !C(iso) || !C(iso).alive) return;
  const o = S.leaders[iso], n = newLeader(iso);
  if (o && keepMem) n.mem = o.mem.map(m => ({ src: m.src, w: m.w * 0.4, t: m.t })).filter(m => Math.abs(m.w) > 2);
  S.leaders[iso] = n; if (C(iso).flags) C(iso).flags.regimeSeen = 1;
  return n;
}
const leaderOf = iso => { if (!S.leaders) return null; return S.leaders[iso] || null; };
const leaderAggr = c => c.aggr * (S.leaders && S.leaders[c.iso] ? TRAITS[S.leaders[c.iso].trait].aggr : 1);
const memSum = iso => { const l = leaderOf(iso); return l ? l.mem.reduce((s, m) => s + m.w, 0) : 0; };

function remember(iso, src, d) {
  const l = leaderOf(iso); if (!l || Math.abs(d) < 6) return;
  const m = l.mem.find(x => x.src === src && S.turn - x.t < 6);
  if (m) { m.w = clamp(m.w + d * 0.6, -40, 40); m.t = S.turn; return; }
  l.mem.push({ src, w: clamp(d * 0.8, -40, 40), t: S.turn });
  if (l.mem.length > 6) l.mem.sort((a, b) => Math.abs(b.w) - Math.abs(a.w)), l.mem.length = 6;
}

function leadersStep() {
  cabinetEnsure();
  Object.keys(S.leaders).forEach(iso => {
    const c = C(iso), l = S.leaders[iso];
    if (!c || !c.alive) { delete S.leaders[iso]; return; }
    const rate = TRAITS[l.trait].memory;
    l.mem.forEach(m => { m.w *= 1 - rate; });
    l.mem = l.mem.filter(m => Math.abs(m.w) >= 1.2);
    // leaders change over time
    const turnover = isDemo(c.gov) ? 1 / 110 : c.gov === 'M' ? 1 / 500 : 1 / 260;
    if (chance(turnover)) {
      const o = l.name, n = newLeader(iso); n.mem = l.mem.map(m => ({ src: m.src, w: m.w * 0.5, t: m.t })).filter(m => Math.abs(m.w) > 2);
      S.leaders[iso] = n;
      if (c.army > 5 || R(S.player, iso) > 30 || R(S.player, iso) < -30) news(nm(iso) + ' has a new leader: ' + n.name + ' takes over from ' + o + '.', 'politics', iso);
    }
  });
}
function leaderInfo(iso) {
  const l = leaderOf(iso); if (!l) return null; const T = TRAITS[l.trait];
  return { name: l.name, trait: T.n, traitDesc: T.d, memories: l.mem.slice().sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 3).map(m => ({ text: m.src, good: m.w > 0, w: m.w })), months: S.turn - l.since };
}

Object.assign(Engine, { cabinetList, hireAdviser, candidatesFor: role => candidatesFor(role).map(a => { const R_ = ROLES[a.role]; return { name: a.name, comp: a.comp, lean: Math.abs(a.lean) < 0.25 ? 'Pragmatist' : a.lean > 0 ? R_.hiT : R_.loT }; }), ROLES: () => ROLES, leaderInfo });

// ---------------- CABINET EVENTS (queued by cabinetStep) ----------------
const advOf = x => adviserById(x.id);
const CRIT = { defence: 'the way you handle force', treasury: 'the state of the public finances', foreign: 'your foreign policy', security: 'how you deal with unrest and liberty', spin: 'the way your decisions are presented' };
function defectPenalty(role) {
  const c = me();
  if (role === 'defence') { fac(c, 'military', -9); st(c, -3, 6); }
  else if (role === 'treasury') { fac(c, 'business', -9); gr(c, -0.15, 6); }
  else if (role === 'foreign') { c.prest = clamp(c.prest - 3, 0, 100); }
  else if (role === 'security') { fac(c, 'party', -4); c.secIdx = clamp(c.secIdx - 4, 0, 100); }
  else if (role === 'spin') { ap(c, -4, 6); }
}
ev('adviserQuits', { cat: 'system',
  title: x => { const a = advOf(x); return a ? a.name + ' resigns' : 'A resignation'; },
  text: x => { const a = advOf(x); if (!a) return 'A senior adviser has resigned.'; return a.name + ', your ' + ROLES[a.role].title + ', has delivered a resignation letter. They cite months of disagreement over ' + CRIT[a.role] + ', and say your decisions have left no room for their advice. ' + (a.comp >= 4 ? 'They are widely respected, and their departure will be noticed.' : 'Few will be surprised.'); },
  options: x => {
    const a = advOf(x); if (!a) return [opt('Continue', '', () => 'Done.')];
    const canPlead = S.pc >= pcCost(2), p = clamp(0.35 + a.loyalty / 120, 0.15, 0.75);
    return [
      opt('Accept and appoint a replacement', 'A new face arrives, with unknown opinions.', () => { const n = replaceAdviser(a.role, 'resigned'); if (REL_FAC[a.role]) fac(me(), REL_FAC[a.role], -2); return a.name + ' leaves quietly. ' + n.name + ' takes over as ' + ROLES[a.role].title + '.'; }),
      opt('Persuade them to stay', 'About ' + Math.round(p * 100) + '% to work. (' + pcCost(2) + ' PC)', () => { S.pc -= pcCost(2); if (chance(p)) { a.loyalty = 58; a.lastEv = S.turn; return a.name + ' agrees to stay, for now. They expect to be listened to.'; } const n = replaceAdviser(a.role, 'resigned'); fac(me(), 'party', -2); return a.name + ' will not be moved. ' + n.name + ' is appointed in a hurry.'; }, canPlead ? {} : { ok: false, why: 'Not enough political capital.' }),
      opt('Blame them publicly', 'Lets you frame it your way. It costs you goodwill in the party.', () => { const n = replaceAdviser(a.role, 'sacked'); ap(me(), 1, 3); fac(me(), 'party', -3); return 'You brief the press that ' + a.name + ' was struggling. It plays reasonably well, and it will be remembered inside the party. ' + n.name + ' is the new ' + ROLES[a.role].title + '.'; }),
    ];
  } });
ev('adviserDefects', { cat: 'system',
  title: x => { const a = advOf(x); return a ? a.name + ' goes over to ' + oppTerm(me()) : 'A defection'; },
  text: x => { const a = advOf(x); if (!a) return 'A senior adviser has defected.'; return 'After months of being overruled, your ' + ROLES[a.role].title + ', ' + a.name + ', has walked out and joined ' + oppTerm(me()) + '. They are already giving interviews about what happens behind closed doors.'; },
  options: x => {
    const a = advOf(x); if (!a) return [opt('Continue', '', () => 'Done.')];
    return [
      opt('Denounce the betrayal', 'Rally loyalists, at some cost to your image of calm.', () => { defectPenalty(a.role); const n = replaceAdviser(a.role, 'defected'); fac(me(), 'party', 2); me().prest = clamp(me().prest - 1, 0, 100); news(a.name + ', formerly your ' + ROLES[a.role].title + ', has defected to ' + oppTerm(me()) + '.', 'politics', S.player); return 'You call it a betrayal. The base rallies, and ' + n.name + ' is sworn in to replace ' + a.name + '.'; }),
      opt('Stay above it', 'Say nothing, appoint a successor.', () => { defectPenalty(a.role); const n = replaceAdviser(a.role, 'defected'); news(a.name + ', formerly your ' + ROLES[a.role].title + ', has defected to ' + oppTerm(me()) + '.', 'politics', S.player); return 'You decline to comment. ' + n.name + ' takes the post, and ' + a.name + ' keeps talking.'; }),
    ];
  } });
ev('cabinetLeak', { cat: 'system',
  title: x => 'Cabinet memo leaked',
  text: x => { const a = advOf(x); if (!a) return 'A confidential memo has leaked.'; return 'A confidential memo criticising your approach to ' + CRIT[a.role] + ' has been leaked to the press. It carries the fingerprints of ' + a.name + ', your ' + ROLES[a.role].title + '. ' + (isDemo(me().gov) ? 'The opposition is delighted.' : oppTerm(me())[0].toUpperCase() + oppTerm(me()).slice(1) + ' take note.'); },
  options: x => {
    const a = advOf(x); if (!a) return [opt('Continue', '', () => 'Done.')];
    return [
      opt('Sack the leaker', 'Sends a message. The replacement is unknown.', () => { const n = replaceAdviser(a.role, 'sacked'); ap(me(), 1, 4); if (REL_FAC[a.role]) fac(me(), REL_FAC[a.role], -2); return a.name + ' is gone by lunchtime. ' + n.name + ' is appointed.'; }),
      opt('Deny it', 'Weathers the story, deepens the resentment.', () => { ap(me(), -2, 4); a.loyalty = clamp(a.loyalty - 6, 0, 100); return 'You dismiss the memo as fake. The press does not quite believe you, and ' + a.name + ' knows you know.'; }),
      opt('Take the criticism on board', 'Costs face now, wins loyalty.', () => { ap(me(), -1, 3); a.loyalty = clamp(a.loyalty + 14, 0, 100); return 'You say the memo raises fair points. ' + a.name + ' is surprised, and grateful.'; }),
    ];
  } });
