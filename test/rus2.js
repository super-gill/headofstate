const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1500, height: 720 } });
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { const { E, enter } = window.__hos; E.newGame({ player: 'RUS', leader: 'B', seed: 8, diff: 1, temper: 1, termLimits: false }); enter(); });
  await p.waitForTimeout(300); await p.click('[data-act="closemodal"]').catch(() => { });
  await p.click('#zreset'); await p.waitForTimeout(400); await p.screenshot({ path: '/tmp/map_fit.png' }); await b.close();
})();
