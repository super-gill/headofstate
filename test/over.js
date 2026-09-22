const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
  await p.click('[data-act="pickc"][data-id="GBR"]'); await p.click('[data-act="start"]'); await p.click('[data-act="closemodal"]');
  for (let i = 0; i < 14; i++) { await p.evaluate(() => document.querySelector('[data-act="endturn"]').click());
    for (let g = 0; g < 6; g++) { if (await p.$('.modal [data-act="evopt"]:not(:disabled)')) { await p.click('.modal [data-act="evopt"]:not(:disabled) >> nth=0'); await p.click('[data-act="evnext"]'); } else if (await p.$('.modal [data-act="closemodal"]')) await p.click('.modal [data-act="closemodal"]'); else break; } }
  // dossier with declare available: pick a target
  await p.evaluate(() => { const U = window.__hos.UI; U.sel = 'FRA'; U.tab = 'dip'; });
  await p.click('[data-act="tab"][data-id="dip"]');
  const txt = await p.evaluate(() => [...document.querySelectorAll('#dockbody .row-item .t')].map(e => e.textContent).filter(t => /war|Declare/i.test(t)).join(' || '));
  console.log(txt.slice(0, 400));
  await p.evaluate(() => window.__hos.E.S.pc = 12);
  await p.click('[data-act="menu"]'); await p.click('[data-act="retire"]'); await p.click('[data-act="doretire"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/over.png' });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
