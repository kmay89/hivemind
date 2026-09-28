#!/usr/bin/env node
// The first-minute audit: a brand-new keeper on a phone-sized screen, doing only what the
// game shows them (the ghost hand, the one lit button). It times what the classics taught us
// to watch (docs/FIRST_MINUTES.md): screens and taps before the first comb cell, seconds to
// the first comb cell / first reward / first bee, and the visible words on each screen.
// Fails (exit 1) if the front door regresses past the budget below.
//
// MANUAL-RUN dev tooling (needs a browser):
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node tools/first-minute.js [WxH]
// Dev-only; never a runtime dependency of index.html. See CLAUDE.md.
'use strict';
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8163;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const [VW, VH] = (process.argv[2] || '390x844').split('x').map(Number);
// the budget: what "playing within seconds" means for this game
const BUDGET = { tapsToFirstCell: 5, secToFirstCell: 20, secToFirstBee: 45, wordsPerScreen: 30 };

// one capture-only hook, spliced into the served copy (index.html on disk is untouched)
const CAP = 'window.__fm={ s(){ const c=COACH[coachStep]; const t=onboard&&c&&c.target&&!c.until()?c.target():null;'
  + ' return {onboard, step:coachStep, brush, want:(onboard&&c&&c.brushHint)||null, forage:!!(onboard&&c&&c.unlock==="forage"),'
  + ' px:t?cellCenter(t.c,t.r):null, cells:brushedBrood+paintedHoney+flaggedExpand, born:bornTotal, started}; } };';

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const u = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const p = path.join(ROOT, u);
      fs.readFile(p, (e, d) => {
        if (e) { rq.writeHead(404); rq.end(); return; }
        if (u === '/index.html') d = d.toString().replace('window.__hm=()=>(', CAP + 'window.__hm=()=>(');
        const mime = p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
        rq.writeHead(200, { 'content-type': mime }); rq.end(d);
      });
    });
    srv.listen(PORT, () => res(srv));
  });
}

// visible, un-occluded words on screen right now
const WORDS = `(()=>{ let n=0; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let t;
  while(t=w.nextNode()){ const s=t.nodeValue.trim(); if(!s) continue; const p=t.parentElement; if(!p||!p.getClientRects().length) continue;
    const r=p.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) continue;
    const hit=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)));
    if(!hit||!(p.contains(hit)||hit.contains(p))) continue;
    let a=p, ok=true; while(a){ const cs=getComputedStyle(a); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05){ ok=false; break; } a=a.parentElement; }
    if(ok) n+=s.split(/\\s+/).filter(x=>/[a-z0-9]/i.test(x)).length; }
  return n; })()`;

(async () => {
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, hasTouch: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const T0 = Date.now(), sec = () => +((Date.now() - T0) / 1000).toFixed(1);
  let taps = 0; const screens = []; const ev = {};
  const vis = sel => pg.evaluate(s => { const e = document.querySelector(s); if (!e || e.classList.contains('hide')) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !e.classList.contains('out'); }, sel);
  const tap = async sel => { const ok = await pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false;
    e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); e.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 })); e.click(); return true; }, sel);
    if (ok) taps++; return ok; };
  const seen = async name => { if (screens.length && screens[screens.length - 1].name === name) return;
    await pg.waitForTimeout(450); screens.push({ name, at: sec(), words: await pg.evaluate(WORDS), tapsBefore: taps }); };

  await pg.goto(`http://localhost:${PORT}/`);
  for (let i = 0; i < 400 && sec() < 120; i++) {
    await pg.waitForTimeout(250);
    const s = await pg.evaluate(() => window.__fm ? window.__fm.s() : null).catch(() => null);
    if (s && s.cells > 0 && ev.firstCell == null) { ev.firstCell = sec(); ev.tapsToFirstCell = taps; }
    if (s && s.born > 0 && ev.firstBee == null) ev.firstBee = sec();
    if (ev.firstReward == null && await vis('#unlockChip')) ev.firstReward = sec();
    if (s && s.started && !s.onboard && ev.coachDone == null && ev.firstCell != null) ev.coachDone = sec();
    if (ev.coachDone != null && ev.firstBee != null) break;
    if (await vis('#splash')) { await seen('studio sting'); continue; }
    if (await vis('#gsplash')) { await seen('wordmark'); if (await vis('#gsPlay')) await tap('#gsPlay'); continue; }
    if (await vis('#coldopen')) { await seen('cold open');
      if (await vis('#coBtn')) await tap('#coBtn'); else if (await vis('#coCell') && !(await pg.evaluate(() => document.getElementById('coldopen').classList.contains('hatched')))) await tap('#coCell');
      continue; }
    if (await vis('#intro')) { await seen('title'); await tap('#startNew'); continue; }
    if (await vis('#queenPick')) { await seen('queen pick'); await pg.evaluate(() => { const b = [...document.querySelectorAll('#queenPick button')].filter(b => b.offsetParent && !b.disabled).pop(); b && b.click(); }); taps++; continue; }
    if (await vis('#story')) { await seen('story'); await tap('#storyNext'); continue; }
    if (!s || !s.started) continue;
    if (s.onboard) { await seen('tutorial');
      if (s.want && s.brush !== s.want) { await tap(`[data-brush="${s.want}"]`); continue; }
      if (s.px) { await pg.mouse.click(s.px.x, s.px.y); taps++; continue; }
      if (s.forage) { await pg.evaluate(() => { const e = document.getElementById('forageSlider'); e.value = 1; e.dispatchEvent(new Event('input', { bubbles: true })); }); taps++; continue; }
      if (await vis('#coachBtn')) await tap('#coachBtn');
      continue; }
    // handed over: dismiss the one-shot layout card, press ▶ Start, wait for the first bee
    if (await vis('#combPlan')) { await seen('layout card'); await tap('#combPlanGo'); continue; }
    if (await vis('#dawnChip')) { await seen('start'); await tap('#dawnGo'); continue; }
    await seen('hive');
  }
  await browser.close(); srv.close();

  console.log(`first minute @ ${VW}x${VH}`);
  for (const s of screens) console.log(`  ${String(s.at).padStart(5)}s  ${s.name.padEnd(13)} ${String(s.words).padStart(3)} words  (${s.tapsBefore} taps before)`);
  console.log(`  first comb cell: ${ev.firstCell ?? '—'}s after ${ev.tapsToFirstCell ?? '—'} taps · first reward: ${ev.firstReward ?? '—'}s · first bee: ${ev.firstBee ?? '—'}s · tutorial done: ${ev.coachDone ?? '—'}s`);
  const fails = [];
  if (errs.length) fails.push('page errors: ' + errs.join(' | '));
  if (ev.firstCell == null) fails.push('never reached the first comb cell');
  else { if (ev.tapsToFirstCell > BUDGET.tapsToFirstCell) fails.push(`${ev.tapsToFirstCell} taps before the first cell (budget ${BUDGET.tapsToFirstCell})`);
    if (ev.firstCell > BUDGET.secToFirstCell) fails.push(`${ev.firstCell}s to the first cell (budget ${BUDGET.secToFirstCell}s)`); }
  if (ev.firstBee == null || ev.firstBee > BUDGET.secToFirstBee) fails.push(`first bee at ${ev.firstBee ?? 'never'} (budget ${BUDGET.secToFirstBee}s)`);
  for (const s of screens) if (s.words > BUDGET.wordsPerScreen) fails.push(`${s.name}: ${s.words} words (budget ${BUDGET.wordsPerScreen})`);
  if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('ok — the front door is within budget');
})().catch(e => { console.error(e); process.exit(1); });
