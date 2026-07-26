#!/usr/bin/env node
// Store-listing screenshot kit — captures App Store-resolution frames of the
// four listing moments from docs/RELEASE.md: the title, the living comb, the
// report's long view, and the scouts' dance. Drafts for the store page; final
// marketing frames may still want device bezels / copy overlaid.
//
// MANUAL-RUN dev tooling — not part of `npm run check` (needs a browser):
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node tools/store-shots.js [outDir]
// Dev-only; never a runtime dependency of index.html. See CLAUDE.md.
'use strict';
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8141;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const OUT = process.argv[2] || path.join(ROOT, '..', 'store-shots');

// App Store required sizes (portrait, points × scale = pixels)
const DEVICES = [
  { name: 'iphone-6_7', width: 430, height: 932, dpr: 3 },   // 1290×2796
  { name: 'ipad-12_9', width: 1024, height: 1366, dpr: 2 },  // 2048×2732
];

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      fs.readFile(p, (e, d) => { if (e) { rq.writeHead(404); rq.end(); return; }
        rq.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' }); rq.end(d); });
    });
    srv.listen(PORT, () => res(srv));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  for (const dev of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: dev.width, height: dev.height }, deviceScaleFactor: dev.dpr, isMobile: dev.width < 800, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('hm_coldopen', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => { const g = document.getElementById('gsplash'); return g && !g.classList.contains('hide'); }, null, { timeout: 15000 });
    for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !document.getElementById('gsplash'))) break;
      await page.mouse.click(220, 220); await page.waitForTimeout(400); }
    await page.waitForTimeout(600);
    const shot = n => page.screenshot({ path: path.join(OUT, `${dev.name}-${n}.png`) });
    await shot('1-title');
    // a living comb: actually keep bees for a minute — zone a nursery ring and
    // honey shelves (blind taps snap to cells via the game's own hit-testing),
    // then fast-forward so brood, stores, and capped honey fill in
    await page.click('#startDaily');
    await page.waitForTimeout(2500);
    const v = await page.evaluate(() => window.__hm().view);
    const tap = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(45); };
    await tap(v.hiveCx, v.hiveCy);   // brood brush is the default
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6;
      await tap(v.hiveCx + Math.cos(a) * v.size * 1.73, v.hiveCy + Math.sin(a) * v.size * 1.73); }
    await page.evaluate(() => { const b = document.querySelector('[data-brush="honey"]'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    await page.waitForTimeout(250);
    for (const rr of [2.9, 3.5]) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + (rr > 3 ? Math.PI / 12 : 0);
      await tap(v.hiveCx + Math.cos(a) * v.size * rr, v.hiveCy + Math.sin(a) * v.size * rr); }
    // painting arms the keeper's-page lessons (LESSON_AT) — thank them and move on
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
    await page.evaluate(() => { const b = document.getElementById('fastToggle'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    await page.waitForTimeout(6500);   // ~18 game days: peak spring — stores golden, brood capped, wax fresh
    await page.evaluate(() => { const b = document.getElementById('fastToggle'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });   // 3× → back to 1×
    await page.waitForTimeout(800);
    // the scouts may have interrupted mid-fast-forward (they do that) — clear the floor
    for (let i = 0; i < 3; i++) {
      const closed = await page.evaluate(() => {
        const dc = document.getElementById('danceCall');
        if (dc && !dc.classList.contains('hide')) { document.getElementById('dcLet').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); return false; }
        return true;
      });
      if (closed) break;
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(400);
    await shot('2-comb');
    await page.$eval('#reportBtn', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await page.waitForTimeout(700);
    await page.$eval('#reportFullBtn', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await page.waitForTimeout(800);
    await shot('3-report');
    await page.$eval('#reportFullX', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__hmDance());
    await page.waitForTimeout(700);
    await shot('4-dance');
    console.log(`${dev.name}: 4 frames captured`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log('store shots in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
