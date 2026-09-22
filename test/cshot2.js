const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html');
  await p.evaluate(() => { const h = window.__hos; h.E.newGame({ player: 'ITA', gov: 'D', leader: 'T', diff: 1, temper: 1, seed: 4 }); h.enter && h.enter(); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/home.png' });
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act="explain"][data-id="credit"]')][0]; if (b) b.click(); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/credit.png' });
  console.log('errors', errs);
  await b.close();
})();
