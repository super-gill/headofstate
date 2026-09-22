// Mobile viewport UI pass for Head of State.
// Launches at 390x844 (iPhone 12/13-ish), plays ~18-24 months through the real
// rendered mobile UI, screenshots key states, and captures console/page errors.
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => chromium.launch());
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  await p.goto('file:///home/claude/wls/dist/test.html');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/mobile_01_setup.png' });

  // --- setup flow ---
  await p.click('[data-act="pickc"][data-id="FRA"]');
  await p.fill('#lname', 'Mobile Tester');
  await p.click('[data-act="start"]');
  await p.waitForTimeout(300);
  // dismiss any intro modal(s)
  for (let i = 0; i < 3; i++) {
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) { await cm.click(); await p.waitForTimeout(150); } else break;
  }

  await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/mobile_02_home.png' });

  // --- meters bar: check it is present and scrollable/usable ---
  const metersInfo = await p.evaluate(() => {
    const el = document.querySelector('.meters');
    if (!el) return null;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX };
  });
  console.log('meters bar:', JSON.stringify(metersInfo));

  // --- visit every dock tab ---
  const tabs = ['home', 'budget', 'policy', 'dip', 'war', 'world'];
  for (const t of tabs) {
    await p.click('[data-act="tab"][data-id="' + t + '"]');
    await p.waitForTimeout(150);
  }

  // --- budget tab: screenshot + adjust a slider by touch/drag and by direct fill ---
  await p.click('[data-act="tab"][data-id="budget"]');
  await p.waitForTimeout(150);
  const sliderHandle = await p.$('#bs-tax');
  if (sliderHandle) {
    const box = await sliderHandle.boundingBox();
    if (box) {
      // simulate a touch/drag across the slider
      await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 8 });
      await p.mouse.up();
      await p.waitForTimeout(100);
    }
    // also do a direct value fill to be sure the budget updates
    await p.$eval('#bs-tax', el => { el.value = 32; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(150);
  }
  await p.screenshot({ path: '/tmp/mobile_03_budget.png' });

  // --- map area alone (top ~36% of screen per CSS) ---
  const mapBox = await p.evaluate(() => {
    const el = document.querySelector('#mapwrap');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  console.log('mapwrap box:', JSON.stringify(mapBox));
  if (mapBox) {
    await p.screenshot({ path: '/tmp/mobile_04_map.png', clip: { x: 0, y: 0, width: 390, height: Math.ceil(mapBox.height + mapBox.y) } });
  }

  // --- tap a country on the map, then try a diplomacy action ---
  await p.click('[data-act="tab"][data-id="dip"]');
  await p.waitForTimeout(150);
  await p.evaluate(() => window.__hos.UI.sel = null);
  const tapped = await p.evaluate(() => {
    const el = document.querySelector('#map path[data-iso="DEU"]') || document.querySelector('#map [data-iso="DEU"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: 'touch' }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerType: 'touch' }));
    return true;
  });
  console.log('tapped DEU on map:', tapped);
  await p.waitForTimeout(200);
  await p.click('[data-act="tab"][data-id="dip"]');
  await p.waitForTimeout(150);
  const dipBtn = await p.$('[data-act="dip"]:not(:disabled)');
  if (dipBtn) {
    await dipBtn.click();
    await p.waitForTimeout(200);
    // close any resulting modal/toast-triggering overlay so play can continue
    const cm = await p.$('.modal [data-act="closemodal"]');
    if (cm) await cm.click();
  }
  console.log('diplomacy action attempted:', !!dipBtn);

  // --- play ~20 in-game months, resolving every event modal ---
  let turns = 0, events = 0, annualSeen = false, eventShot = false;
  const TARGET_MONTHS = 20;
  for (let i = 0; i < TARGET_MONTHS + 6; i++) {
    if (turns >= TARGET_MONTHS) break;
    await p.evaluate(() => { const c = document.querySelector('[data-act="endturn"]'); c && c.click(); });
    turns++;
    for (let g = 0; g < 12; g++) {
      const evOpt = await p.$('.modal [data-act="evopt"]:not(:disabled)');
      const annualModal = await p.$('.modal [data-act="annualdone"]');
      if (annualModal && !annualSeen) {
        annualSeen = true;
        await p.screenshot({ path: '/tmp/mobile_06_annual.png' });
        await p.waitForTimeout(100);
        await annualModal.click();
      } else if (evOpt) {
        events++;
        if (!eventShot) {
          await p.waitForTimeout(300); // let modal fade-in animation finish before capturing
          await p.screenshot({ path: '/tmp/mobile_05_event.png' });
          eventShot = true;
        }
        await evOpt.click();
        const nxt = await p.$('[data-act="evnext"]');
        if (nxt) await nxt.click();
      } else if (await p.$('.modal [data-act="newgame"]')) {
        break;
      } else if (await p.$('.modal [data-act="closemodal"]')) {
        await p.click('.modal [data-act="closemodal"]');
      } else {
        break;
      }
      await p.waitForTimeout(60);
    }
    if (await p.$('.modal [data-act="newgame"]')) break;
  }

  console.log('turns played', turns, 'events resolved', events, 'annual report seen', annualSeen);
  console.log('game over state:', await p.evaluate(() => window.__hos.E.S.over && window.__hos.E.S.over.type));

  // final full-page screenshot of wherever we landed, for extra context
  await p.click('[data-act="tab"][data-id="home"]').catch(() => {});
  await p.waitForTimeout(150);
  await p.screenshot({ path: '/tmp/mobile_07_final.png' });

  console.log('--- errors ---');
  console.log(errs.length ? errs.join('\n') : 'no console/page errors');

  await b.close();
})();
