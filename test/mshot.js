const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/m_setup.png', fullPage: false });
  const h = await p.evaluate(() => { const d = document.querySelector('#dockbody'); return [d.scrollHeight, d.clientHeight, document.documentElement.scrollWidth, innerWidth]; }); console.log('setup dock', h);
  await p.click('[data-act="start"]'); await p.click('[data-act="closemodal"]');
  await p.click('[data-act="tab"][data-id="policy"]'); await p.evaluate(() => { const d = document.querySelector('#dockbody'); d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/m_policy.png' });
  console.log('overflow-x', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
