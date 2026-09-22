const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(async () => chromium.launch());
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file:///home/claude/wls/dist/test.html');
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/setup.png' });
  await p.click('[data-act="pickc"][data-id="FRA"]');
  await p.fill('#lname', 'Test Leader');
  await p.click('[data-act="start"]');
  await p.click('[data-act="closemodal"]');
  for (const t of ['budget', 'policy', 'dip', 'war', 'world', 'home']) { await p.click('[data-act="tab"][data-id="' + t + '"]'); }
  await p.click('[data-act="tab"][data-id="budget"]');
  await p.$eval('#bs-tax', el => { el.value = 30; el.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const m of ['gov', 'eco', 'mil', 'ten', 'bloc', 'rel']) await p.click('[data-act="mapmode"][data-id="' + m + '"]');
  // select a country and do an action
  await p.evaluate(() => window.__hos.UI.sel = null);
  await p.click('[data-act="tab"][data-id="dip"]');
  await p.evaluate(() => { document.querySelector('#map path[data-iso="DEU"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); });
  let turns = 0, events = 0;
  for (let i = 0; i < 60; i++) {
    await p.evaluate(() => { const c = document.querySelector('[data-act="endturn"]'); c && c.click(); });
    turns++;
    for (let g = 0; g < 12; g++) {
      const has = await p.$('.modal [data-act="evopt"]:not(:disabled)');
      if (has) { events++; await p.click('.modal [data-act="evopt"]:not(:disabled) >> nth=0'); await p.click('[data-act="evnext"]'); }
      else if (await p.$('.modal [data-act="newgame"]')) break;
      else if (await p.$('.modal [data-act="closemodal"]')) await p.click('.modal [data-act="closemodal"]');
      else break;
    }
    if (await p.$('.modal [data-act="newgame"]')) break;
  }
  console.log('turns', turns, 'events', events, 'over', await p.evaluate(() => window.__hos.E.S.over && window.__hos.E.S.over.type));
  await p.screenshot({ path: '/tmp/play.png' });
  console.log(errs.slice(0, 10).join('\n') || 'no errors');
  await b.close();
})();
