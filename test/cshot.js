const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
  await p.evaluate(() => {
    const { E } = window.__hos; E.newGame({ player: 'GBR', leader: 'B', seed: 5, diff: 1, temper: 1, termLimits: false });
    const S = E.S; S.pc = 12; let found = false;
    for (let t = 0; t < 60 && !found; t++) { let g = 0; while (E.currentEvent() && g++ < 9) { const e = E.currentEvent(); if (e.advice && e.advice.length) { found = true; break; } E.resolveEvent(e.options.findIndex(o => o.ok)); } if (found) break; S.pc = 12; E.endTurn(); }
    window.__hos.UI.tab = 'home'; window.__hos.enter();
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/advice.png' });
  await p.evaluate(() => { const { E } = window.__hos; const e = E.currentEvent(); E.resolveEvent(e.options.findIndex(o => o.ok)); window.__hos.enter(); });
  await p.evaluate(() => { document.querySelectorAll('.overlay').forEach(x => x.remove()); const o = document.querySelector('#overlay'); o.innerHTML = ''; o.hidden = true; });
  await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('#dockbody').scrollTop = 330; });
  await p.click('[data-act="reshuffle"] >> nth=0'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/cab.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
