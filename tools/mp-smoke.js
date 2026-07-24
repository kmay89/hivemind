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

  // --- QR encoder sweep: render QRs of many sizes and decode them with an
  // independent decoder, so every version/table row we can emit is validated.
  // zxing (what real camera stacks use) is preferred; jsqr is the fallback but
  // is only trusted up to ~950 chars — it fails some perfectly valid dense
  // symbols that zxing and phone cameras read fine.
  async function makeQRDecoder() {
    try {
      const pkgDir = path.dirname(require.resolve('zxing-wasm/package.json'));
      const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader');
      await prepareZXingModule({ overrides: { wasmBinary: fs.readFileSync(path.join(pkgDir, 'dist/reader/zxing_reader.wasm')).buffer }, fireImmediately: true });
      return { name: 'zxing', cap: Infinity, fn: async img => { const r = await readBarcodes({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }, { formats: ['QRCode'] }); return r && r[0] ? r[0].text : null; } };
    } catch (e) {}
    try { const jsQR = require('jsqr');
      return { name: 'jsqr', cap: 950, fn: async img => { const r = jsQR(new Uint8ClampedArray(img.data), img.width, img.height); return r ? r.data : null; } };
    } catch (e) { return null; }
  }
  const qrDec = await makeQRDecoder();
  if (!qrDec) console.log('(no QR decoder installed — skipping QR validation: npm i zxing-wasm jsqr)');
  else {
    let allOk = true;
    for (const len of [20, 80, 160, 300, 450, 600, 800, 950, 1100].filter(l => l <= qrDec.cap)) {
      const payload = 'HIVE2.' + 'Ab-_'.repeat(Math.ceil(len / 4)).slice(0, len);
      const img = await host.evaluate(t => { const d = window.__hmQR(t); return d ? { data: Array.from(d.data), width: d.width, height: d.height } : null; }, payload);
      if (!img) { console.log(`✗ QR encode failed at len=${len}`); allOk = false; continue; }
      const got = await qrDec.fn(img);
      if (got !== payload) { console.log(`✗ QR decode mismatch at len=${len} (${qrDec.name}): ${got ? 'wrong data' : 'no decode'}`); allOk = false; }
    }
    console.log(allOk ? `✓ QR encoder sweep: all payload sizes decode correctly (${qrDec.name})` : '✗ QR encoder sweep had failures');
  }

  // --- host: title -> Play Together -> Host a hive ---
  await host.click('#startParty');
  await host.fill('#mpName', 'Queenie');
  await host.click('#mpHostBtn');
  await host.$eval('#mpHost .mpDetails', d => { d.open = true; });   // paste boxes live behind a fold now
  const invite = await waitVal(host, '#inviteCode');
  console.log('✓ invite code generated (' + invite.length + ' chars' + (invite.includes('HIVE2.') ? ', deflated' : '') + ')');
  if (qrDec) {
    const shown = await host.evaluate(() => { const cv = document.getElementById('inviteQR');
      if (!cv || !cv.width) return null; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
      return { data: Array.from(d.data), width: d.width, height: d.height }; });
    if (shown) {
      const got = await qrDec.fn(shown);
      console.log(got === invite ? '✓ on-screen invite QR decodes to the exact invite URL' : '✗ invite QR decode failed');
    } else console.log('✗ invite QR canvas empty');
  }

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

  // --- hive orders: an Overcooked-style micro-goal should appear on both screens ---
  try {
    await host.waitForFunction(() => !document.getElementById('mpOrder').classList.contains('hide'), null, { timeout: 40000 });
    await join.waitForFunction(() => !document.getElementById('mpOrder').classList.contains('hide'), null, { timeout: 8000 });
    const ordTxt = await host.$eval('#mpOrder', el => el.textContent);
    console.log('✓ hive order broadcast to both screens: ' + ordTxt.slice(0, 60));
  } catch (e) { console.log('✗ no hive order appeared: ' + e.message); }

  // --- drop-in join: third keeper joins AFTER the party started, via the crown chip ---
  const pd = el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
  await host.$eval('#mpStrip', pd);
  const invite3 = await waitVal(host, '#inviteCode');
  const trip = await mk('trip');
  await trip.click('#startParty');
  await trip.fill('#mpName', 'Trip');
  await trip.click('#mpJoinBtn');
  await trip.fill('#joinIn', invite3);
  await trip.click('#joinGo');
  const reply3 = await waitVal(trip, '#replyCode');
  await host.fill('#answerIn', reply3);
  await host.click('#answerAdd');
  await trip.waitForFunction(() => window.__hm().net.started, null, { timeout: 15000 });
  const tripIx = await trip.evaluate(() => window.__hm().net.ix);
  console.log(`✓ drop-in join mid-game works (Trip seated at ix=${tripIx})`);
  await host.$eval('#mpHostBack', pd);   // tuck the invite panel away, game continues
  await join.waitForFunction(() => window.__hm().net.players.length === 3, null, { timeout: 8000 });
  console.log('✓ roster update reached the original joiner (3 keepers)');

  // --- disconnect + seat reclaim by name ---
  await join.close();
  await host.waitForFunction(() => window.__hm().net.players[1].g, null, { timeout: 10000 });
  console.log('✓ host marked Buzz gone');
  await host.$eval('#mpStrip', pd);
  const invite4 = await waitVal(host, '#inviteCode');
  const buzz2 = await mk('buzz2');
  await buzz2.click('#startParty');
  await buzz2.fill('#mpName', 'Buzz');
  await buzz2.click('#mpJoinBtn');
  await buzz2.fill('#joinIn', invite4);
  await buzz2.click('#joinGo');
  const reply4 = await waitVal(buzz2, '#replyCode');
  await host.fill('#answerIn', reply4);
  await host.click('#answerAdd');
  await buzz2.waitForFunction(() => window.__hm().net.started, null, { timeout: 15000 });
  const b2 = await buzz2.evaluate(() => window.__hm().net);
  const hostRoster = await host.evaluate(() => window.__hm().net.players);
  console.log(b2.ix === 1 ? '✓ Buzz reclaimed their old seat (ix=1)' : `✗ reclaim failed — Buzz got ix=${b2.ix}`);
  console.log(hostRoster.length === 3 && !hostRoster[1].g ? '✓ host roster healed (3 keepers, none gone)' : `✗ host roster odd: ${JSON.stringify(hostRoster)}`);

  // --- invite links: a tapped #hive= URL should boot straight into the join flow ---
  const invite5 = await waitVal(host, '#inviteCode');
  if (/#hive=/.test(invite5)) {
    const linkCtx = await browser.newContext();
    const linkPage = await linkCtx.newPage();
    await linkPage.goto(invite5.replace('http://localhost:' + PORT + '/', `http://localhost:${PORT}/`), { waitUntil: 'load' });
    await linkPage.waitForTimeout(1500);
    const state = await linkPage.evaluate(() => ({
      home: !document.getElementById('mpHome').classList.contains('hide'),
      splashGone: !document.getElementById('gsplash') && !document.getElementById('splash'),
      prefilled: document.getElementById('joinIn').value.length > 50,
    }));
    console.log(state.home && state.splashGone && state.prefilled
      ? '✓ invite URL boots straight to the join door (splash skipped, code prefilled)'
      : '✗ invite URL boot odd: ' + JSON.stringify(state));
    // finish the join via the link flow, name it Lin
    await linkPage.fill('#mpName', 'Lin');
    await linkPage.click('#mpJoinBtn');   // auto-answers since joinIn is prefilled
    const reply5 = await waitVal(linkPage, '#replyCode');
    // --- reply courier: opening the reply URL in another HOST-context tab must auto-welcome ---
    if (/#reply=/.test(reply5)) {
      const courier = await host.context().newPage();
      await courier.goto(reply5, { waitUntil: 'load' });
      await linkPage.waitForFunction(() => window.__hm().net.started, null, { timeout: 20000 });
      const lin = await linkPage.evaluate(() => window.__hm().net);
      console.log(`✓ reply URL courier tab auto-welcomed Lin (ix=${lin.ix}) — no paste needed`);
      const courierMsg = await courier.evaluate(() => document.body.textContent.includes('Reply delivered'));
      console.log(courierMsg ? '✓ courier tab shows the "reply delivered" card' : '✗ courier card missing');
      await courier.close();
    } else console.log('✗ reply was not a URL: ' + reply5.slice(0, 40));
    await linkCtx.close();
  } else console.log('✗ invite is not a URL: ' + invite5.slice(0, 40));

  // --- party ledger: host dies (reload), resumes the year from autosave, crew re-links ---
  const dayBefore = await host.evaluate(() => window.__hm().day);
  const hostCtx = host.context();
  await host.close();   // the Queen's phone "dies"
  const host2 = await hostCtx.newPage();
  await host2.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await host2.waitForTimeout(1200);
  await host2.keyboard.press('Space');
  await host2.waitForFunction(() => { const g = document.getElementById('gsplash'); return g && !g.classList.contains('hide'); }, null, { timeout: 15000 });
  for (let i = 0; i < 30; i++) { if (await host2.evaluate(() => !document.getElementById('gsplash'))) break;
    await host2.mouse.click(200, 200); await host2.waitForTimeout(400); }
  await host2.click('#startParty');
  await host2.fill('#mpName', 'Queenie');
  await host2.click('#mpHostBtn');
  const resumeVisible = await host2.$eval('#mpResume', el => !el.classList.contains('hide'));
  console.log(resumeVisible ? '✓ ledger resume offered after host death' : '✗ no resume button after reload');
  if (resumeVisible) {
    await host2.$eval('#mpResume', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    const lbl = await host2.$eval('#mpStart', el => el.textContent);
    console.log(/Rekindle/.test(lbl) ? '✓ resume armed (' + lbl.trim() + ')' : '✗ start label did not change: ' + lbl);
    // one keeper re-links, then the year rekindles where the ledger left it
    await host2.$eval('#mpHost .mpDetails', d => { d.open = true; });
    const inviteR = await waitVal(host2, '#inviteCode');
    const back = await mk('back');
    await back.click('#startParty'); await back.fill('#mpName', 'Buzz'); await back.click('#mpJoinBtn');
    await back.fill('#joinIn', inviteR); await back.click('#joinGo');
    const replyR = await waitVal(back, '#replyCode');
    await host2.fill('#answerIn', replyR); await host2.click('#answerAdd');
    await host2.waitForFunction(() => window.__hm().net.players.length === 2, null, { timeout: 15000 });
    await host2.click('#mpStart');
    await host2.waitForFunction(() => window.__hm().net.started, null, { timeout: 5000 });
    const dayAfter = await host2.evaluate(() => window.__hm().day);
    console.log(dayAfter > 3 && dayAfter <= dayBefore + 5
      ? `✓ year rekindled from the ledger (day ${dayAfter.toFixed(1)}, was ${dayBefore.toFixed(1)} at death)`
      : `✗ resume day odd: ${dayAfter.toFixed(1)} vs ${dayBefore.toFixed(1)}`);
    const backDay = await back.evaluate(() => window.__hm().day);
    console.log(backDay > 3 ? '✓ re-linked keeper landed mid-year with the crew' : '✗ keeper day=' + backDay);
  }

  await browser.close();
  srv.close();
  console.log('SMOKE TEST DONE');
})().catch(e => { console.error('SMOKE FAIL:', e); process.exit(1); });
