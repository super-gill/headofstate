const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
  await p.evaluate(() => {
    const { E } = window.__hos; E.newGame({ player: 'GBR', leader: 'B', seed: 8, diff: 1, temper: 1, termLimits: false });
    const S = E.S; S.pc = 12;
    for (let t = 0; t < 10; t++) { let g = 0; while (E.currentEvent() && g++ < 9) { const e = E.currentEvent(); E.resolveEvent(e.options.findIndex(o => o.ok)); } S.pc = 12; E.endTurn(); }
    window.__hos.UI.tab = 'home'; window.__hos.enter();
  });
  await p.waitForTimeout(500);
  await p.click('.tile[data-id="stab"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/why.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
