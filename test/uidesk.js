const { chromium } = require('playwright');

(async () => {
  const shots = [];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  async function shot(name) {
    const path = '/tmp/uidesk_' + name + '.png';
    await p.screenshot({ path });
    shots.push(path);
    console.log('SHOT', path);
  }

  await p.goto('file:///home/claude/wls/dist/test.html');
  await p.waitForTimeout(600);
  await shot('01_setup');

  // ---- setup flow: pick GBR, name leader, start ----
  await p.click('[data-act="pickc"][data-id="GBR"]');
  await p.fill('#lname', 'Alex Vance');
  await p.waitForTimeout(150);
  await shot('02_setup_named');
  await p.click('[data-act="start"]');
  await p.waitForTimeout(300);
  // dismiss any intro modal(s)
  for (let i = 0; i < 3; i++) {
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) { await cm.click(); await p.waitForTimeout(200); } else break;
  }

  await p.waitForTimeout(300);
  await shot('03_home_tab');

  // ---- visit every tab ----
  const tabs = ['home', 'budget', 'policy', 'dip', 'war', 'world'];
  for (const t of tabs) {
    await p.click('[data-act="tab"][data-id="' + t + '"]');
    await p.waitForTimeout(150);
  }

  // ---- budget tab: adjust a slider ----
  await p.click('[data-act="tab"][data-id="budget"]');
  await p.waitForTimeout(150);
  const hasTaxSlider = await p.$('#bs-tax');
  if (hasTaxSlider) {
    await p.$eval('#bs-tax', el => { el.value = 32; el.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  await p.waitForTimeout(150);
  await shot('04_budget_tab');

  // ---- policy tab: enact a policy if affordable ----
  await p.click('[data-act="tab"][data-id="policy"]');
  await p.waitForTimeout(150);
  await shot('05_policy_tab');
  const enactBtn = await p.$('[data-act="enact"]:not(:disabled)');
  if (enactBtn) {
    await enactBtn.click();
    await p.waitForTimeout(250);
    // enacting may open a confirmation/event modal; close/continue if present
    const closeM = await p.$('.modal [data-act="closemodal"]');
    if (closeM) await closeM.click();
    await p.waitForTimeout(150);
  }

  // ---- map mode switching ----
  const modes = ['gov', 'eco', 'mil', 'ten', 'bloc', 'rel'];
  for (const m of modes) {
    await p.click('[data-act="mapmode"][data-id="' + m + '"]').catch(() => {});
    await p.waitForTimeout(80);
  }

  // ---- dip tab: click a country on the map, try a diplomacy action ----
  await p.click('[data-act="tab"][data-id="dip"]');
  await p.waitForTimeout(150);
  const deuBox = await p.evaluate(() => {
    const el = document.querySelector('#map path[data-iso="DEU"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (deuBox) {
    await p.mouse.move(deuBox.x, deuBox.y);
    await p.mouse.down();
    await p.mouse.up();
  }
  await p.waitForTimeout(250);
  await shot('06_dossier_panel');
  const dipBtn = await p.$('[data-act="dip"]:not(:disabled)');
  if (dipBtn) {
    await dipBtn.click();
    await p.waitForTimeout(250);
    const closeM = await p.$('.modal [data-act="closemodal"]');
    if (closeM) await closeM.click();
    await p.waitForTimeout(150);
  }
  await shot('06b_dip_after_action');

  // ---- war tab / world tab ----
  await p.click('[data-act="tab"][data-id="war"]');
  await p.waitForTimeout(200);
  await shot('07_war_tab');
  await p.click('[data-act="tab"][data-id="world"]');
  await p.waitForTimeout(200);
  await shot('08_world_tab');

  // ---- cabinet: try a reshuffle if visible on home tab ----
  await p.click('[data-act="tab"][data-id="home"]');
  await p.waitForTimeout(150);
  const reshuffleBtn = await p.$('[data-act="reshuffle"]');
  if (reshuffleBtn) {
    await reshuffleBtn.click();
    await p.waitForTimeout(200);
    await shot('09_cabinet_reshuffle_modal');
    const pickOpt = await p.$('.modal [data-act]:not([data-act="closemodal"])');
    if (pickOpt) { await pickOpt.click(); await p.waitForTimeout(150); }
    const closeM = await p.$('.modal [data-act="closemodal"]');
    if (closeM) await closeM.click();
  }

  // ---- play through ~20 months, resolving events, capturing an event modal + annual report ----
  let turns = 0, events = 0, eventShotTaken = false, annualShotTaken = false;
  const TARGET_MONTHS = 20;
  for (let i = 0; i < TARGET_MONTHS + 10 && turns < TARGET_MONTHS; i++) {
    const endBtn = await p.$('[data-act="endturn"]');
    if (!endBtn) break;
    await endBtn.click();
    await p.waitForTimeout(150);
    turns++;
    for (let g = 0; g < 12; g++) {
      const evOpt = await p.$('.modal [data-act="evopt"]:not(:disabled)');
      const annualBtn = await p.$('.modal [data-act="annualdone"]');
      if (annualBtn && !annualShotTaken) {
        await shot('10_annual_report');
        annualShotTaken = true;
      }
      if (evOpt) {
        events++;
        if (!eventShotTaken) { await shot('11_event_modal'); eventShotTaken = true; }
        await p.click('.modal [data-act="evopt"]:not(:disabled) >> nth=0');
        await p.waitForTimeout(120);
        const next = await p.$('[data-act="evnext"]');
        if (next) await next.click();
        await p.waitForTimeout(120);
      } else if (annualBtn) {
        await annualBtn.click();
        await p.waitForTimeout(150);
      } else if (await p.$('.modal [data-act="newgame"]')) {
        break;
      } else if (await p.$('.modal [data-act="closemodal"]')) {
        await p.click('.modal [data-act="closemodal"]');
        await p.waitForTimeout(120);
      } else {
        break;
      }
    }
    if (await p.$('.modal [data-act="newgame"]')) break;
  }

  await p.waitForTimeout(200);
  await shot('12_home_after_play');

  const over = await p.evaluate(() => window.__hos.E.S.over && window.__hos.E.S.over.type).catch(() => null);
  console.log('turns played:', turns, 'events resolved:', events, 'game over:', over);
  console.log('screenshots:', shots.join(', '));
  console.log('---ERRORS---');
  console.log(errs.length ? errs.join('\n') : 'no console/page errors captured');

  await b.close();
})();
