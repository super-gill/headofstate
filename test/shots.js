const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(500);
  await p.click('[data-act="pickc"][data-id="DEU"]'); await p.click('[data-act="start"]'); await p.click('[data-act="closemodal"]');
  for (let i = 0; i < 7; i++) {
    await p.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    for (let g = 0; g < 6; g++) { if (await p.$('.modal [data-act="evopt"]:not(:disabled)')) { await p.click('.modal [data-act="evopt"]:not(:disabled) >> nth=0'); await p.click('[data-act="evnext"]'); } else if (await p.$('.modal [data-act="closemodal"]')) await p.click('.modal [data-act="closemodal"]'); else break; }
  }
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/home.png' });
  await p.evaluate(() => window.__hos.UI.sel = 'FRA');
  await p.click('[data-act="tab"][data-id="world"]'); await p.click('[data-act="mapmode"][data-id="ten"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/ten.png' });
  const m = await b.newPage({ viewport: { width: 400, height: 800 } });
  m.on('pageerror', e => errs.push('M PAGEERR ' + e.message));
  await m.goto('file:///home/claude/wls/dist/test.html'); await m.waitForTimeout(500);
  await m.click('[data-act="pickc"][data-id="JPN"]'); await m.click('[data-act="start"]'); await m.click('[data-act="closemodal"]'); await m.waitForTimeout(600);
  await m.screenshot({ path: '/tmp/mobile.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
