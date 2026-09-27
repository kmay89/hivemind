#!/usr/bin/env node
// App Store screenshot kit: six captioned frames per device, at the exact pixel sizes App
// Store Connect accepts (iPhone 6.9" slot 1290×2796, iPad 13" slot 2048×2732). Every frame is
// the real game. A thriving midsummer colony is staged through a capture-only hook (the served
// copy gets one extra line; index.html on disk is never touched), then each moment is captured
// and set under a one-line caption. Output: platforms/ios/store/screenshots/.
//
// MANUAL-RUN dev tooling (needs a browser):
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node tools/app-store-shots.js [outDir]
// Dev-only; never a runtime dependency of index.html. See CLAUDE.md and docs/APP_STORE.md.
'use strict';
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8143;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const OUT = process.argv[2] || path.join(ROOT, 'platforms', 'ios', 'store', 'screenshots');

const DEVICES = [
  { name: 'iphone-6.9', w: 430, h: 932, dpr: 3, outW: 1290, outH: 2796 },
  { name: 'ipad-13', w: 1024, h: 1366, dpr: 2, outW: 2048, outH: 2732 },
];
// the order a store visitor swipes through: the hook, the verb, the stakes, the payoff, the party, the learning
const FRAMES = [
  { id: 'comb',    cap: 'Keep 40,000 bees alive', sub: 'Paint the comb: nursery, pantry, fresh wax' },
  { id: 'event',   cap: 'Make a real keeper’s call', sub: 'Every choice changes the winter forecast' },
  { id: 'meadow',  cap: 'Send foragers to the flowers', sub: 'Near blooms fly cheap, far ones must bloom rich' },
  { id: 'yearend', cap: 'Make it through winter', sub: 'Earn stars, gifts and a longer legacy' },
  { id: 'party',   cap: 'Play together, one hive', sub: '2–8 keepers in the same room vote on it' },
  { id: 'notes',   cap: 'Learn real bee biology', sub: 'Field notes from every decision' },
];

const HOOK = `window.__shot={
  stage(){ // a healthy midsummer colony: a warm nursery ringed by full shelves
    if(onboard) endCoach(true); try{ hideDawnChip(); }catch(e){}
    for(const c of cells){ const d=cellDist(c.c,c.r); c.flagExpand=false; c.bp=0; c.brood=null;
      c.built=d<4.1; c.zone=!c.built?'none':(d<2.2?'brood':'honey');
      if(c.zone==='brood'){ const r=Math.random(); c.brood=r<0.2?{stage:'egg',t:Math.random()*EGG_D}:r<0.55?{stage:'larva',t:Math.random()*LAR_D}:{stage:'pupa',t:Math.random()*PUP_D}; } }
    for(const c of cells){ if(!c.built&&cellDist(c.c,c.r)<4.7&&Math.random()<0.18) c.flagExpand=true; }
    P=84; peakPop=90; day=150; year=2; swarmP=0; honeyU=caps().total*0.8; pollenU=caps().pollen*0.7; nectarU=HC*3; mite=0.1; activePatch=0;
    discoverAll(); goals=makeGoals(); syncHUD(); forecastCache=forecastToSpring(); },
  yearEnd(){ // a good year, with its real history curve: bees rise through spring, honey banks through summer
    yearHist.length=0; for(let d=3; d<YEAR; d+=3){ const t=d/YEAR; yearHist.push({d, p:Math.round(18+100*Math.sin(Math.PI*Math.min(1,t*1.15))), h:Math.max(2,58*Math.sin(Math.PI*t*0.9)), f:0.55}); }
    if(goals) goals.forEach(g=>g.done=true); P=46;
    yearCalls=[{ic:'🌼',t:'THE DANDELIONS ARE OUT',c:'Pollen for the nursery'},{ic:'🌻',t:'THE MEADOW IS POURING',c:'Chase the flow'},{ic:'🐭',t:'A MOUSE IS LOOKING FOR A HOME',c:'Fit the mouse guard'}];
    day=YEAR-1; bankAtFrost=winterNeed()+6; jarsThisYear=1; endOfYear(); },
  vote(){ NET.myIx=1; netShowVote('ev','ivy',-1,35); },
  notes(){ for(const e of EVENTS.slice(0,9)) noteField(e.id,e.ic,e.title,e.fact); renderNotes(); openOverlay('notes'); },
  quiet(){ advSince=0; try{ advise(); }catch(e){} const f=document.getElementById('msgFeed'); if(f) f.innerHTML=''; try{ feedQ.length=0; }catch(e){} },
  close(){ NET.myIx=-1; for(const o of [...document.querySelectorAll('.ov')]) if(!o.classList.contains('hide')&&o.id!=='intro') closeOverlay(o.id); }
};`;

function serve() {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      const u = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, u);
      fs.readFile(p, (e, d) => { if (e) { rq.writeHead(404); rq.end(); return; }
        if (u === '/index.html') d = d.toString().replace('window.__hm=()=>(', HOOK + 'window.__hm=()=>(');
        rq.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); rq.end(d); });
    });
    srv.listen(PORT, () => res(srv));
  });
}

async function capture(browser, dev) {
  const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr, isMobile: dev.w < 800, hasTouch: true });
  // a returning keeper (no first-run coach), sound off, one colony already in the chronicle
  await ctx.addInitScript(() => { try { localStorage.setItem('hm_coldopen', '1'); localStorage.setItem('hm_chronicle', '[{"y":1,"g":"B","col":1}]'); localStorage.setItem('hm_combplan', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log(`[${dev.name}] PAGE ERROR`, e.message));
  const W = ms => pg.waitForTimeout(ms);
  await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' }); await W(1300); await pg.keyboard.press('Space');
  for (let i = 0; i < 30; i++) { if (await pg.evaluate(() => !document.getElementById('gsplash'))) break; await pg.mouse.click(dev.w / 2, 40); await W(400); }
  await W(800);
  await pg.click('#startNew');
  for (let i = 0; i < 12; i++) {   // queen menu → story → hand-over
    await W(700);
    const ov = await pg.evaluate(() => { const o = [...document.querySelectorAll('.ov')].find(o => !o.classList.contains('hide') && o.id !== 'intro' && getComputedStyle(o).display !== 'none'); return o ? o.id : null; });
    if (ov === 'queenPick') await pg.evaluate(() => { const b = [...document.querySelectorAll('#queenPick button')].filter(b => b.offsetParent && !b.disabled).pop(); b && b.click(); });
    else if (ov === 'story') await pg.click('#storySkip').catch(() => {});
    else if (ov) await pg.evaluate(() => window.__shot.close());
    else if (await pg.evaluate(() => window.__hm().day > 0.5 || !document.getElementById('coach').classList.contains('show'))) break;
    if (await pg.evaluate(() => document.getElementById('coach').classList.contains('show'))) await pg.click('#coachSkip').catch(() => {});
  }
  await pg.evaluate(() => window.__shot.close());
  await pg.evaluate(() => { const d = document.getElementById('dawnChip'); if (d) d.classList.add('hide'); });
  await pg.evaluate(() => window.__shot.stage());
  await pg.evaluate(() => { if (window.__hm().speed === 0) document.getElementById('playToggle').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
  await W(4500);   // bees fly in, brood animates, the feed quiets
  const raw = {};
  const snap = async id => { await pg.evaluate(() => window.__shot.quiet()); await W(150); raw[id] = await pg.screenshot(); };
  await snap('comb');
  await pg.evaluate(() => window.__hmEvent('mainflow')); await W(900); await snap('event'); await pg.evaluate(() => window.__shot.close());
  await pg.evaluate(() => document.getElementById('tabMeadow').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))); await W(2200); await snap('meadow');
  await pg.evaluate(() => document.getElementById('tabHive').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))); await W(900);
  await pg.evaluate(() => window.__shot.vote()); await W(900); await snap('party'); await pg.evaluate(() => window.__shot.close());
  await pg.evaluate(() => window.__shot.notes()); await W(900); await snap('notes'); await pg.evaluate(() => window.__shot.close());
  await pg.evaluate(() => window.__shot.yearEnd()); await W(1800); await snap('yearend');
  await ctx.close();
  return raw;
}

async function compose(browser, dev, raw) {
  const pg = await browser.newPage({ viewport: { width: dev.outW, height: dev.outH }, deviceScaleFactor: 1 });
  const font = f => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
  for (let i = 0; i < FRAMES.length; i++) {
    const f = FRAMES[i], img = 'data:image/png;base64,' + raw[f.id].toString('base64');
    const k = Math.min(dev.outW / 1290, dev.outH / 2796), pad = Math.round(dev.outW * 0.07), capH = Math.round(dev.outH * 0.17);
    const shotH = Math.round(dev.outH - capH - pad * 0.5), shotW = Math.round(shotH * dev.w / dev.h), left = Math.round((dev.outW - shotW) / 2);
    await pg.setContent(`<!doctype html><html><head><style>
      @font-face{ font-family:B; src:url(${font('BricolageGrotesque.woff2')}) format('woff2'); font-weight:200 800; }
      html,body{ margin:0; width:${dev.outW}px; height:${dev.outH}px; overflow:hidden; }
      body{ background:radial-gradient(120% 70% at 50% 0%, #3a2608 0%, #150e05 55%, #0b0805 100%); font-family:B,sans-serif; color:#f7eed9; }
      .cap{ height:${capH}px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 ${pad}px; box-sizing:border-box; }
      h1{ margin:0; font-weight:800; font-size:${Math.round(96 * k)}px; line-height:1.05; letter-spacing:-.01em; color:#ffd97a; }
      p{ margin:${Math.round(22 * k)}px 0 0; font-weight:500; font-size:${Math.round(46 * k)}px; color:rgba(247,238,217,.82); }
      .shot{ position:absolute; left:${left}px; top:${capH}px; width:${shotW}px; height:${shotH}px; border-radius:${Math.round(64 * k)}px; overflow:hidden;
        box-shadow:0 0 0 ${Math.round(6 * k)}px rgba(255,217,122,.22), 0 ${Math.round(40 * k)}px ${Math.round(120 * k)}px rgba(0,0,0,.6); }
      .shot img{ width:100%; height:100%; display:block; }
    </style></head><body><div class="cap"><h1>${f.cap}</h1><p>${f.sub}</p></div><div class="shot"><img src="${img}"></div></body></html>`);
    await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(150);
    const file = path.join(OUT, `${dev.name}-${i + 1}-${f.id}.png`);
    await pg.screenshot({ path: file });
    console.log('wrote', path.relative(ROOT, file), `${dev.outW}×${dev.outH}`);
  }
  await pg.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  for (const dev of DEVICES) { const raw = await capture(browser, dev); await compose(browser, dev, raw); }
  await browser.close(); srv.close();
})().catch(e => { console.error('APP STORE SHOTS FAIL:', e.message); process.exit(1); });
