const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1300, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/map_setup.png' });
  await p.evaluate(() => { const { E, enter } = window.__hos; E.newGame({ player: 'GBR', leader: 'B', seed: 8, diff: 1, temper: 1, termLimits: false }); enter(); });
  await p.waitForTimeout(400); await p.click('[data-act="closemodal"]').catch(() => { });
  await p.click('[data-act="mapmode"][data-id="gov"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/map_gov.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
