const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  for (const [name, vp] of [['d', { width: 1200, height: 900 }], ['m', { width: 390, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp }); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
    await p.evaluate(() => { const { E, enter } = window.__hos; E.newGame({ player: 'GBR', leader: 'B', seed: 8, diff: 1, temper: 1, termLimits: false }); E.S.pc = 12; enter(); });
    await p.waitForTimeout(400);
    for (let i = 0; i < 40; i++) {
      const up = await p.evaluate(() => { const s = window.__hos.E.S; return { m: s.date.m, over: !!s.over, modal: window.__hos.UI.modalOpen }; });
      if (up.over) break;
      if (up.modal) { const ann = await p.$('[data-act="annualdone"]'); if (ann) { await p.waitForTimeout(300); await p.screenshot({ path: `/tmp/annual_${name}.png` }); await p.evaluate(() => document.querySelector('.modal').scrollTop = 99999); await p.screenshot({ path: `/tmp/annual2_${name}.png` }); await ann.click(); await p.waitForTimeout(200); continue; }
        const o = await p.$('.opt:not([disabled])'); if (o) await o.click(); await p.waitForTimeout(100); continue; }
      await p.evaluate(() => { window.__hos.E.S.pc = 12; });
      await p.keyboard.press('Space'); await p.waitForTimeout(150);
      if (i === 0) { await p.waitForTimeout(900); await p.screenshot({ path: `/tmp/monthly_${name}.png` }); }
    }
    await p.close();
  }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
