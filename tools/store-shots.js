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
    // a living comb: run the daily a while at fast-forward so stores and brood fill in
    await page.click('#startDaily');
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-sp="3"]'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    await page.waitForTimeout(22000);   // ~60+ game days: zoned comb, stores, capped honey
    await page.evaluate(() => { const b = document.querySelector('[data-sp="1"]'); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
    await page.waitForTimeout(800);
    // the scouts may have interrupted mid-fast-forward (they do that) — clear the floor
    for (let i = 0; i < 3; i++) {
      const closed = await page.evaluate(() => {
        const dc = document.getElementById('danceCall');
        if (dc && !dc.classList.contains('hide')) { document.getElementById('dcSkip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); return false; }
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
