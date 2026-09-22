const { chromium } = require('playwright');

(async () => {
  const shots = [];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  async function shot(name) {
    const path = '/tmp/uimapdock_' + name + '.png';
    await p.screenshot({ path });
    shots.push(path);
    console.log('SHOT', path);
  }
  async function findClickPoint(iso) {
    // The USA/RUS/etc paths can be disjoint (islands, exclaves), so the bbox
    // centre often lands on a different country. Sample a grid within the
    // bbox and use elementFromPoint (same lookup the app's own click handler
    // uses) to find a pixel that actually resolves to this iso.
    return p.evaluate((iso) => {
      const el = document.querySelector('#map path[data-iso="' + iso + '"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cols = 24, rows = 24;
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const x = r.left + (ix + 0.5) / cols * r.width;
          const y = r.top + (iy + 0.5) / rows * r.height;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
          const t = document.elementFromPoint(x, y);
          const node = t && t.closest ? t.closest('[data-iso]') : null;
          if (node && node.getAttribute('data-iso') === iso) return { x, y };
        }
      }
      return null;
    }, iso);
  }
  async function clickCountry(iso) {
    const pt = await findClickPoint(iso);
    if (!pt) { console.log('WARN: no clickable pixel found for', iso, '(offscreen or too small at current zoom)'); return false; }
    await p.mouse.move(pt.x, pt.y);
    await p.mouse.down();
    await p.waitForTimeout(20);
    await p.mouse.up();
    await p.waitForTimeout(250);
    const sel = await p.evaluate(() => window.__hos.UI.sel).catch(() => null);
    if (sel !== iso) console.log('WARN: click on', iso, 'did not select it (UI.sel =', sel, ', pt', JSON.stringify(pt) + ')');
    return sel === iso;
  }
  async function clickDip(iso, id) {
    const sel = 'button[data-act="dip"][data-id="' + id + '"][data-t="' + iso + '"]:not(:disabled)';
    const btn = await p.$(sel);
    if (!btn) return false;
    await btn.click();
    await p.waitForTimeout(300);
    return true;
  }
  async function scrollToHeading(text) {
    return p.evaluate((text) => {
      const hs = Array.from(document.querySelectorAll('#dockbody h3'));
      const h = hs.find(x => x.textContent.includes(text));
      if (h) { h.scrollIntoView({ block: 'start' }); return true; }
      return false;
    }, text);
  }

  await p.goto('file:///home/claude/wls/dist/test.html');
  await p.waitForTimeout(600);
  await shot('00_setup');

  // ---- 1. Setup: mid-sized country with active diplomacy potential ----
  await p.click('[data-act="pickc"][data-id="TUR"]');
  await p.fill('#lname', 'Test Leader');
  await p.waitForTimeout(150);
  await p.click('[data-act="start"]');
  await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) {
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) { await cm.click(); await p.waitForTimeout(200); } else break;
  }
  await p.waitForTimeout(300);
  await shot('01_home_after_start');

  // ---- 2. Cycle every map mode, screenshot, check legend ----
  const modes = ['rel', 'gov', 'eco', 'mil', 'ten', 'bloc'];
  const legends = {};
  for (const m of modes) {
    await p.click('[data-act="mapmode"][data-id="' + m + '"]').catch(() => {});
    await p.waitForTimeout(150);
    legends[m] = await p.$eval('#legend', el => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => '(no legend)');
    await shot('02_mapmode_' + m);
  }

  // ---- 3. Click several different countries, open dossiers ----
  await p.click('[data-act="tab"][data-id="dip"]');
  await p.waitForTimeout(150);
  // fit the whole world first: after setup the map is zoomed/panned on the
  // player's own country (Turkey), so a distant power like the USA can be
  // off the visible canvas (and its Alaska exclave crossing the antimeridian
  // gives it a huge, misleading bounding box) until we zoom out to fit.
  await p.click('#zreset').catch(() => {});
  await p.waitForTimeout(200);
  // neighbor
  await clickCountry('SYR');
  await shot('03_dossier_SYR_neighbor');
  // distant power
  await clickCountry('USA');
  await shot('03_dossier_USA_distant_power');
  // small country
  await clickCountry('MLT');
  await shot('03_dossier_MLT_small');

  // ---- 4. Diplomacy actions from a dossier ----
  await clickCountry('USA');
  const didVisit = await clickDip('USA', 'visit');
  await shot('04_action_delegation_' + (didVisit ? 'toast' : 'unavailable'));
  const didSummit = await clickDip('USA', 'summit');
  await shot('04_action_summit_' + (didSummit ? 'toast' : 'unavailable'));

  await clickCountry('SYR');
  const relSYR = await p.evaluate(() => window.__hos.E.R(window.__hos.E.S.player, 'SYR')).catch(() => null);
  const didSanction = await clickDip('SYR', 'sanction');
  await shot('04_action_sanction_rel' + relSYR + '_' + (didSanction ? 'toast' : 'unavailable'));

  // defence pact: try several neighbours/allies until one is eligible (relations >= 30)
  let didPact = false, pactTarget = null;
  for (const iso of ['GRC', 'GEO', 'ARM', 'AZE', 'BGR', 'IRQ', 'IRN']) {
    await clickCountry(iso);
    const ok = await p.$('button[data-act="dip"][data-id="pact"][data-t="' + iso + '"]:not(:disabled)');
    if (ok) { await ok.click(); await p.waitForTimeout(300); didPact = true; pactTarget = iso; break; }
  }
  await shot('04_action_pact_' + (didPact ? ('toast_' + pactTarget) : 'unavailable'));

  // ---- 5. Zoom in/out and Fit ----
  await p.click('#zin').catch(() => {});
  await p.click('#zin').catch(() => {});
  await p.waitForTimeout(150);
  await shot('05_zoom_in');
  await p.click('#zout').catch(() => {});
  await p.click('#zout').catch(() => {});
  await p.click('#zout').catch(() => {});
  await p.waitForTimeout(150);
  await shot('05_zoom_out');
  await p.click('#zreset').catch(() => {});
  await p.waitForTimeout(150);
  await shot('05_zoom_fit');

  // ---- 6. War tab: try to trigger a war via a declare action ----
  // top up political capital so Declare is reachable through the real UI
  // path (earlier diplomacy/project actions above spent most of it) rather
  // than only via the direct engine fallback below.
  await p.evaluate(() => { window.__hos.E.S.pc = 20; }).catch(() => {});
  await clickCountry('SYR');
  let warStarted = false;
  const declareBtn = await p.$('button[data-act="dip"][data-id="declare"][data-t="SYR"]:not(:disabled)');
  if (declareBtn) {
    await declareBtn.click();
    await p.waitForTimeout(250);
    await shot('06_goal_modal');
    const humiliate = await p.$('.modal [data-act="godeclare"][data-goal="humiliate"]:not(:disabled)');
    const anyGoal = humiliate || await p.$('.modal [data-act="godeclare"]:not(:disabled)');
    if (anyGoal) { await anyGoal.click(); await p.waitForTimeout(300); warStarted = true; }
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) await cm.click();
  } else {
    console.log('declare war on SYR unavailable directly from UI; trying engine call');
    const r = await p.evaluate(() => {
      try {
        const E = window.__hos.E;
        const list = E.dipList('SYR');
        const d = list.find(x => x.id === 'declare');
        if (d && d.ok) { const res = E.doDip('declare', 'SYR', 'humiliate'); return res; }
        return { ok: false, text: d ? d.why : 'no declare entry' };
      } catch (e) { return { ok: false, text: String(e) }; }
    });
    console.log('engine declare result:', JSON.stringify(r));
    if (r && r.ok) warStarted = true;
  }
  await p.waitForTimeout(200);
  await p.click('[data-act="tab"][data-id="war"]');
  await p.waitForTimeout(200);
  await shot('07_war_tab_' + (warStarted ? 'active_war' : 'no_war'));

  // ---- 7. Cycle all dock tabs, including cabinet and projects sections ----
  await p.click('[data-act="tab"][data-id="home"]');
  await p.waitForTimeout(150);
  await shot('08_tab_home_top');
  await scrollToHeading('Your cabinet');
  await p.waitForTimeout(120);
  await shot('08_tab_home_cabinet');

  await p.click('[data-act="tab"][data-id="budget"]');
  await p.waitForTimeout(150);
  const taxSlider = await p.$('#bs-tax');
  if (taxSlider) await p.$eval('#bs-tax', el => { el.value = 30; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(120);
  await shot('08_tab_budget');

  await p.click('[data-act="tab"][data-id="policy"]');
  await p.waitForTimeout(150);
  await shot('08_tab_policy_top');
  await scrollToHeading('National programmes').catch(() => {});
  await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll('#dockbody .catrow')).find(x => x.textContent.includes('National programmes'));
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await p.waitForTimeout(120);
  await shot('08_tab_policy_projects');
  let launched = false;
  const launchBtn = await p.$('[data-act="pjstart"]:not(:disabled)');
  if (launchBtn) {
    await launchBtn.click();
    await p.waitForTimeout(300);
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) await cm.click();
    launched = true;
    await p.waitForTimeout(150);
  }
  await shot('08_tab_policy_projects_' + (launched ? 'launched' : 'none_affordable'));

  await p.click('[data-act="tab"][data-id="dip"]');
  await p.waitForTimeout(150);
  await shot('08_tab_dip');

  await p.click('[data-act="tab"][data-id="war"]');
  await p.waitForTimeout(150);
  await shot('08_tab_war');

  await p.click('[data-act="tab"][data-id="world"]');
  await p.waitForTimeout(150);
  await shot('08_tab_world');

  // ---- 8/9. summary output ----
  console.log('---LEGENDS---');
  for (const m of modes) console.log(m + ': ' + legends[m]);
  console.log('war started:', warStarted, 'pact target:', pactTarget, 'project launched:', launched);
  console.log('screenshots:', shots.join(', '));
  console.log('---ERRORS---');
  console.log(errs.length ? errs.join('\n') : 'no console/page errors captured');

  await b.close();
})();
