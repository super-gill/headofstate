const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
  await p.evaluate(() => {
    const { E } = window.__hos; E.newGame({ player: 'CHN', leader: 'B', seed: 34, diff: 1, temper: 0, termLimits: false });
    const S = E.S; S.pc = 12; S.pcMax = 20; E.C('CHN').army *= 3; E.doDip('declare', 'VNM', 'conquest');
    for (let t = 0; t < 60 && !S.terr.VNM; t++) { let g = 0; while (E.currentEvent() && g++ < 9) { const e = E.currentEvent(); let i = e.options.findIndex(o => o.ok && /Annex/.test(o.label)); if (i < 0) i = e.options.findIndex(o => o.ok); E.resolveEvent(i); } S.pc = 12; E.endTurn(); }
    S.terr.VNM.unrest = 72; S.terr.VNM.integ = 22;
    window.__hos.UI.tab = 'home'; window.__hos.enter();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('#dockbody').scrollTop = 260; });
  await p.click('[data-act="posture"][data-v="invest"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/tmp/empire.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
