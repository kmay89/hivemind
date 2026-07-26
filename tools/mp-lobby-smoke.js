#!/usr/bin/env node
// End-to-end smoke test for the MAILBOX join path — four-letter room codes and
// the waiting-hives list (tools/mp-smoke.js covers the serverless paste/QR
// fallback, which must keep working when this is unreachable).
//
// The local server here mirrors netlify/functions/hive.js's contract with an
// in-memory Map instead of Netlify Blobs, so the client flow is exercised for
// real without a deploy. If you change the function's API shape, change it here
// too — this mock is the contract's second copy on purpose.
//
// MANUAL-RUN dev tooling — not part of `npm run check` (needs a browser):
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node tools/mp-lobby-smoke.js
// Dev-only; never a runtime dependency of index.html. See CLAUDE.md.
'use strict';
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8151;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function serve() {
  const rooms = new Map();
  const jsonRes = (rq, body, status = 200) => {
    rq.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    rq.end(JSON.stringify(body));
  };
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const u = new URL(req.url, `http://localhost:${PORT}`);
      if (u.pathname === '/api/hive') {
        const a = u.searchParams.get('a') || '';
        let raw = '';
        req.on('data', d => { raw += d; });
        req.on('end', () => {
          let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) {}
          const now = Date.now();
          if (a === 'list') {
            const out = [];
            for (const [code, r] of rooms) {
              if (r.started || !r.slots.some(s => !s.claimed)) continue;
              out.push({ code, name: r.name, host: r.host, keepers: r.keepers, age: Math.round((now - r.born) / 1000) });
            }
            return jsonRes(rq, { rooms: out });
          }
          if (a === 'host') {
            let code = ''; for (let k = 0; k < 4; k++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
            rooms.set(code, { born: now, host: b.host || 'A keeper', name: b.name || 'A hive', keepers: 1,
              started: false, seq: 1, slots: [{ id: 1, offer: b.offer, claimed: false, answer: null }] });
            return jsonRes(rq, { code });
          }
          if (a === 'dbg') return jsonRes(rq, { rooms: [...rooms.entries()].map(([c,r])=>({code:c,seq:r.seq,
            slots:r.slots.map(x=>({id:x.id,claimed:!!x.claimed,ans:!!x.answer,taken:!!x.taken}))})) });
          const room = rooms.get((b.code || u.searchParams.get('code') || '').toUpperCase());
          if (!room) return jsonRes(rq, { error: 'that hive has flown' }, 404);
          if (a === 'offer') { room.seq++; room.slots.push({ id: room.seq, offer: b.offer, claimed: false, answer: null });
            return jsonRes(rq, { slot: room.seq }); }
          if (a === 'join') {
            const slot = room.slots.find(s => !s.claimed);
            if (!slot) return jsonRes(rq, { error: 'That hive is full up.' }, 409);
            slot.claimed = true; slot.who = b.name || 'A keeper';
            return jsonRes(rq, { slot: slot.id, offer: slot.offer, name: room.name, host: room.host });
          }
          if (a === 'answer') { const slot = room.slots.find(s => s.id === b.slot);
            if (!slot) return jsonRes(rq, { error: 'gone' }, 404);
            slot.answer = b.answer; return jsonRes(rq, { ok: true }); }
          if (a === 'poll') {
            const fresh = room.slots.filter(s => s.answer && !s.taken);
            for (const s of fresh) s.taken = true;
            if (fresh.length) room.keepers = Math.min(8, room.keepers + fresh.length);
            return jsonRes(rq, { answers: fresh.map(s => ({ slot: s.id, answer: s.answer, who: s.who })),
              keepers: room.keepers, free: room.slots.filter(s => !s.claimed).length });
          }
          if (a === 'close') { if (b.started) room.started = true; else rooms.delete(b.code.toUpperCase());
            return jsonRes(rq, { ok: true }); }
          return jsonRes(rq, { error: 'unknown' }, 400);
        });
        return;
      }
      const p = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
      fs.readFile(p, (e, d) => { if (e) { rq.writeHead(404); rq.end(); return; }
        rq.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' }); rq.end(d); });
    });
    srv.listen(PORT, () => res({ srv, rooms }));
  });
}

(async () => {
  const { srv } = await serve();
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const mk = async name => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('hm_coldopen', '1'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`[${name}] PAGE ERROR:`, e.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1300);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => { const g = document.getElementById('gsplash'); return g && !g.classList.contains('hide'); }, null, { timeout: 15000 });
    for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !document.getElementById('gsplash'))) break;
      await page.mouse.click(200, 200); await page.waitForTimeout(400); }
    await page.waitForTimeout(400);
    return page;
  };

  const host = await mk('host');
  const join = await mk('join');
  const trip = await mk('trip');

  // --- host: two taps to an open hive with a spoken code ---
  await host.click('#startParty');
  await host.fill('#mpName', 'Queenie');
  await host.click('#mpHostBtn');
  await host.waitForFunction(() => !document.getElementById('roomWrap').classList.contains('hide'), null, { timeout: 20000 });
  const code = await host.$eval('#roomCode', el => el.textContent.trim());
  console.log(/^[A-Z]{4}$/.test(code) ? `✓ host opened a hive with a four-letter code: ${code}` : `✗ bad room code: "${code}"`);
  const qrHidden = await host.$eval('#handshakeWrap', el => el.classList.contains('hide'));
  console.log(qrHidden ? '✓ QR/paste handshake stays out of sight when the mailbox works' : '✗ handshake block still showing');

  // --- joiner: the hive is simply waiting in a list ---
  await join.click('#startParty');
  await join.fill('#mpName', 'Buzz');
  await join.click('#mpJoinBtn');
  await join.waitForFunction(() => document.querySelectorAll('#lobbyList .lobbyRow').length > 0, null, { timeout: 15000 });
  const row = await join.$eval('#lobbyList .lobbyRow', el => el.textContent.replace(/\s+/g, ' ').trim());
  console.log(`✓ waiting hive appears in the joiner's list: ${row}`);

  // --- one tap in ---
  await join.$eval('#lobbyList .lobbyRow', el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
  await host.waitForFunction(() => window.__hm().net.players.length === 2, null, { timeout: 20000 });
  await join.waitForFunction(() => window.__hm().net.on && window.__hm().net.ix === 1, null, { timeout: 10000 });
  console.log('✓ ONE TAP joined — no code typed, no reply, no paste');

  // --- a third keeper types the code by hand ---
  await trip.click('#startParty');
  await trip.fill('#mpName', 'Trip');
  await trip.click('#mpJoinBtn');
  await trip.waitForTimeout(700);
  await trip.fill('#roomIn', code);   // 4th letter auto-fires the join
  await host.waitForFunction(() => window.__hm().net.players.length === 3, null, { timeout: 20000 });
  await trip.waitForFunction(() => window.__hm().net.on && window.__hm().net.ix === 2, null, { timeout: 10000 });
  console.log('✓ typing the code joined too — auto-submits on the fourth letter');

  // --- one tap starts the hive ---
  await host.click('#mpStart');
  await host.waitForFunction(() => window.__hm().net.started, null, { timeout: 6000 });
  await join.waitForFunction(() => window.__hm().net.started, null, { timeout: 6000 });
  await trip.waitForFunction(() => window.__hm().net.started, null, { timeout: 6000 });
  console.log('✓ ONE TAP started — party live on all three devices');

  // --- the woken hive leaves the public list but still takes latecomers ---
  const late = await mk('late');
  await late.click('#startParty');
  await late.fill('#mpName', 'Pearl');
  await late.click('#mpJoinBtn');
  await late.waitForTimeout(1200);
  const listed = await late.$$eval('#lobbyList .lobbyRow', els => els.length);
  console.log(listed === 0 ? '✓ a started hive is hidden from the public list' : `✗ started hive still listed (${listed})`);
  await late.fill('#roomIn', code);
  await host.waitForFunction(() => window.__hm().net.players.length === 4, null, { timeout: 20000 });
  console.log('✓ latecomer still joined mid-game by code (drop-in play intact)');

  await browser.close(); srv.close();
  console.log('LOBBY SMOKE DONE');
})().catch(e => { console.error('LOBBY SMOKE FAIL:', e.message); process.exit(1); });
