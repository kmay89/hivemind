#!/usr/bin/env node
// End-to-end smoke test for HIVEMIND hive link (same-room multiplayer):
// two headless Chromium pages act as host + joiner, exchange the real
// invite/reply codes, start a party, and verify snapshots, sector-guarded
// paint replication, the vote loop, and disconnect handling.
//
// MANUAL-RUN dev tooling — not part of `npm run check` (needs a browser):
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node tools/mp-smoke.js
// Dev-only; never a runtime dependency of index.html. See CLAUDE.md.
'use strict';
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8123;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      fs.readFile(p, (e, d) => {
        if (e) { rq.writeHead(404); rq.end(); return; }
        const mime = p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/octet-stream';
        rq.writeHead(200, { 'content-type': mime }); rq.end(d);
      });
    });
    srv.listen(PORT, () => res(srv));
  });
}

async function waitVal(page, sel, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const v = await page.$eval(sel, el => el.value).catch(() => '');
    if (v && v.length > 50) return v;
    await page.waitForTimeout(250);
  }
  throw new Error('no value appeared in ' + sel);
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const mk = async name => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('hm_coldopen', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`[${name}] PAGE ERROR:`, e.message));
    page.on('console', m => { if (m.type() === 'error') console.log(`[${name}] console.error:`, m.text()); });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    // skip the studio splash (keydown ends it), then tap the title splash away
    await page.keyboard.press('Space');
    await page.waitForFunction(() => { const g = document.getElementById('gsplash'); return g && !g.classList.contains('hide'); }, null, { timeout: 15000 });
    for (let i = 0; i < 30; i++) {
      const gone = await page.evaluate(() => !document.getElementById('gsplash'));
      if (gone) break;
      await page.mouse.click(200, 200);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);
    return page;
  };

  const host = await mk('host');
  const join = await mk('join');

  // --- host: title -> Play Together -> Host a hive ---
  await host.click('#startParty');
  await host.fill('#mpName', 'Queenie');
  await host.click('#mpHostBtn');
  const invite = await waitVal(host, '#inviteCode');
  console.log('✓ invite code generated (' + invite.length + ' chars)');

  // --- joiner: Play Together -> Join -> paste invite -> reply ---
  await join.click('#startParty');
  await join.fill('#mpName', 'Buzz');
  await join.click('#mpJoinBtn');
  await join.fill('#joinIn', invite);
  await join.click('#joinGo');
  const reply = await waitVal(join, '#replyCode');
  console.log('✓ reply code generated (' + reply.length + ' chars)');

  // --- host: paste reply, welcome them in ---
  await host.fill('#answerIn', reply);
  await host.click('#answerAdd');
  await host.waitForFunction(() => window.__hm().net.players.length === 2, null, { timeout: 15000 });
  console.log('✓ data channel open — 2 keepers in the lobby');
  await join.waitForFunction(() => window.__hm().net.on && window.__hm().net.ix === 1, null, { timeout: 5000 });
  console.log('✓ joiner got lobby roster, ix=1');

  // --- start the party ---
  await host.click('#mpStart');
  await host.waitForFunction(() => window.__hm().net.started, null, { timeout: 5000 });
  await join.waitForFunction(() => window.__hm().net.started, null, { timeout: 5000 });
  console.log('✓ party started on both devices');

  // role cards visible?
  const roleH = await host.$eval('#mpRole', el => !el.classList.contains('hide'));
  const roleJ = await join.$eval('#mpRole', el => !el.classList.contains('hide'));
  console.log(roleH && roleJ ? '✓ role cards shown' : '✗ role cards missing: ' + roleH + '/' + roleJ);
  const roleName = await join.$eval('#roleName', el => el.textContent);
  console.log('  joiner post: ' + roleName);

  // dismiss role cards; host sim should run and stream snapshots
  await host.click('#roleGo');
  await join.click('#roleGo');
  const d0 = await join.evaluate(() => window.__hm().day);
  await host.waitForTimeout(4000);
  const dHost = await host.evaluate(() => window.__hm().day);
  const dJoin = await join.evaluate(() => window.__hm().day);
  console.log(`  host day=${dHost.toFixed(2)} join day=${dJoin.toFixed(2)} (join started at ${d0.toFixed(2)})`);
  if (dJoin > d0 && Math.abs(dHost - dJoin) < 2) console.log('✓ snapshots flow — joiner tracks the Queen\'s clock');
  else console.log('✗ snapshot drift problem');

  // strip visible on both
  const chips = await join.$eval('#mpStrip', el => el.children.length);
  console.log(chips === 2 ? '✓ keeper strip shows 2 chips' : '✗ strip chips: ' + chips);

  // --- vote flow: host proposes a patch via selectPatch path is canvas-bound;
  // instead simulate joiner proposing an invalid harvest -> host replies whyNot;
  // then a real vote: host meadow patch tap is hard headless, so we skip UI and
  // check that vote overlay machinery works via a synthetic proposal is not
  // reachable from outside the closure. UI-level: joiner taps harvest (off-season)
  await join.$eval('#harvestBtn', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await join.waitForTimeout(1500);
  console.log('✓ off-season harvest tap did not crash (toast path)');

  // paint intent: joiner paints brood on a built, non-brood cell in their own sector,
  // and the change must replicate to the host via the paint op
  const ownBuilt = await join.evaluate(() => window.__hm().net.ownBuilt);
  console.log(ownBuilt > 0 ? `✓ joiner owns ${ownBuilt} built cells at start` : '✗ joiner owns no built comb!');
  const px = await join.evaluate(() => window.__hm().net.ownCellPx);
  if (px) {
    const before = await host.evaluate(() => window.__hm().zones.brood);
    await join.mouse.click(px.x, px.y);   // default brush is brood
    await join.waitForTimeout(1500);
    const after = await host.evaluate(() => window.__hm().zones.brood);
    console.log(after > before ? `✓ joiner's paint replicated to host (brood ${before} → ${after})` : `✗ paint did not replicate (brood ${before} → ${after})`);
  } else console.log('✗ no paintable own cell found');

  // --- vote flow: joiner proposes a meadow patch, both vote yes, host applies ---
  await join.$eval('#tabMeadow', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await join.waitForTimeout(600);
  const patch = await join.evaluate(() => window.__hm().patches.filter(p => p.q > 0.05).sort((a, b) => b.q - a.q)[0]);
  if (!patch) console.log('✗ no bloomable patch found');
  else {
    await join.mouse.click(patch.x, patch.y);
    await join.waitForFunction(() => !document.getElementById('mpVote').classList.contains('hide'), null, { timeout: 5000 });
    await host.waitForFunction(() => !document.getElementById('mpVote').classList.contains('hide'), null, { timeout: 5000 });
    console.log('✓ vote overlay opened on both devices');
    await join.$eval('#voteYes', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await host.$eval('#voteYes', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    await host.waitForFunction(() => document.getElementById('mpVote').classList.contains('hide'), null, { timeout: 8000 });
    await join.waitForFunction(() => document.getElementById('mpVote').classList.contains('hide'), null, { timeout: 8000 });
    const apHost = await host.evaluate(() => window.__hm().ap);
    await join.waitForTimeout(1500);
    const apJoin = await join.evaluate(() => window.__hm().ap);
    console.log(apHost === patch.i ? `✓ vote passed — host steers foragers to patch ${apHost}` : `✗ host activePatch=${apHost}, expected ${patch.i}`);
    console.log(apJoin === patch.i ? '✓ decision replicated to joiner via snapshot' : `✗ joiner activePatch=${apJoin}`);
  }

  // --- disconnect: joiner leaves, host should keep running ---
  await join.close();
  await host.waitForTimeout(2000);
  const gone = await host.evaluate(() => window.__hm().net.players[1].g);
  console.log(gone ? '✓ host marked the joiner gone' : '✗ disconnect not detected');

  await browser.close();
  srv.close();
  console.log('SMOKE TEST DONE');
})().catch(e => { console.error('SMOKE FAIL:', e); process.exit(1); });
