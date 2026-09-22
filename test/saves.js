const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/wls/dist/test.html'); await p.waitForTimeout(400);
  await p.click('[data-act="start"]'); await p.click('[data-act="closemodal"]');
  const adv = async n => { for (let i = 0; i < n; i++) { const st = await p.evaluate(() => ({ m: window.__hos.UI.modalOpen, o: !!window.__hos.E.S.over })); if (st.o) return; if (st.m) { const o = await p.$('.opt:not([disabled])'); if (o) await o.click(); await p.waitForTimeout(60); i--; continue; } await p.evaluate(() => { window.__hos.E.S.pc = 12; }); await p.keyboard.press('Space'); await p.waitForTimeout(60); } };
  const clear = async () => { for (let g = 0; g < 12; g++) { const m = await p.evaluate(() => window.__hos.UI.modalOpen); if (!m) return; const o = await p.$('.opt:not([disabled])'); if (o) await o.click(); await p.waitForTimeout(60); } };
  await adv(8); await clear();
  await p.click('[data-act="menu"]'); await p.click('[data-act="saves"]'); await p.waitForTimeout(200);
  await p.click('[data-act="saveslot"][data-id="hos.slot.1"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/saves.png' });
  await p.click('[data-act="closemodal"]');
  const info = await p.evaluate(() => ({ t: window.__hos.E.S.turn, keys: Object.keys(localStorage) }));
  console.log(info);
  await adv(6); await clear();
  // corrupt autosave, reload
  await p.evaluate(() => { localStorage.setItem('hos.v3', '{bad json'); });
  await p.reload(); await p.waitForTimeout(600);
  console.log('after corrupt reload, mode:', await p.evaluate(() => window.__hos.UI.mode), 'prev exists', await p.evaluate(() => !!localStorage.getItem('hos.v3.prev')), 'bad raw kept', await p.evaluate(() => localStorage.getItem('hos.v3')));
  await p.screenshot({ path: '/tmp/saves2.png' });
  // load slot from setup
  const has = await p.$('[data-act="saves"]'); console.log('setup saves button', !!has);
  if (has) { await has.click(); await p.click('[data-act="loadslot"][data-id="hos.slot.1"]'); await p.waitForTimeout(400); console.log('loaded turn', await p.evaluate(() => window.__hos.E.S && window.__hos.E.S.turn), await p.evaluate(() => window.__hos.UI.mode)); }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
