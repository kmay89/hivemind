#!/usr/bin/env node
// Records real HIVEMIND gameplay clips for the trailer: CDP screencast jpeg
// frames + timestamps, written to marketing/clips/ with a clips.json index.
// It serves a capture-only copy of index.html with a window.__cap handle
// spliced in (spawn a hornet, jump the calendar, open the dance call), so
// each beat can be staged on cue. The shipped index.html is never modified.
//
// MANUAL-RUN dev tooling (needs a browser), like tools/store-shots.js:
//   npm i --no-save playwright-core
//   CHROMIUM=/path/to/chromium node marketing/capture-gameplay.js [outDir]
const { chromium } = require('playwright-core');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'), OUT=process.argv[2]||path.join(__dirname,'clips'); fs.mkdirSync(OUT,{recursive:true});
const CAP=`window.__cap={
  quiet(){ hints=false; for(const k in LESSONS) lessonSeen[k]=1; seenTips=new Proxy({}, {get:()=>1}); discoverAll(); },
  spawnHornet(){ spawnHornet(); }, hornet(){ return hornet&&{x:hornet.x,y:hornet.y,hp:hornet.hp,state:hornet.state}; },
  sim(days){ const n=Math.round(days/0.2); for(let i=0;i<n;i++){ day+=0.2; stepDay(0.2,false); if(day>=YEAR){ day=0; year++; drawSeason(); } } forecastCache=forecastToSpring(); },
  flag(k){ const built=cells.filter(c=>c.built); const fr=cells.filter(c=>!c.built&&!c.flagExpand&&built.some(b=>hexDist(b.c,b.r,c.c,c.r)===1)); fr.slice(0,k||99).forEach(c=>c.flagExpand=true); return fr.length; },
  set(o){ if('forage' in o) forage=o.forage; if('P' in o) P=o.P; if('honeyU' in o) honeyU=o.honeyU; if('day' in o) day=o.day; if('pollenU' in o) pollenU=o.pollenU; },
  view(v){ setView(v); }, heat(on){ heatView=on; }, dance(){ openDanceCall(); }, harvest(){ harvestSurplus(); },
  ring(){ ringFx={t:0, ring:3, n:37}; burst(hiveCx,hiveCy,36); fanfare(); shake=Math.max(shake,0.34); },
  speed(s){ setSpeed(s); }, zones(){ seedStarterZones(); },
  info(){ return {day,year,P,honeyU,HC,cells:cells.filter(c=>c.built).length}; },
};`;
const srv=http.createServer((q,r)=>{const u=q.url==='/'?'/index.html':q.url.split('?')[0];const p=path.join(ROOT,u);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}
  if(u==='/index.html'){ d=d.toString().replace('window.__hm=()=>(', CAP+'window.__hm=()=>('); }
  r.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8145);
const TOUCH=`addEventListener('DOMContentLoaded',()=>{const d=document.createElement('div');d.id='__touch';d.style.cssText='position:fixed;z-index:99999;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,255,255,.95) 0 30%,rgba(255,236,170,.55) 31% 60%,rgba(255,236,170,0) 61%);box-shadow:0 0 18px rgba(255,220,120,.8);opacity:0;transition:opacity .25s,transform .15s;left:-99px;top:-99px';document.body.appendChild(d);
 addEventListener('pointermove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';},true);
 addEventListener('pointerdown',e=>{if(!e.isTrusted)return;d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';d.style.opacity=1;d.style.transform='scale(.8)';},true);
 addEventListener('pointerup',e=>{if(!e.isTrusted)return;d.style.transform='scale(1)';clearTimeout(d._t);d._t=setTimeout(()=>d.style.opacity=0,500);},true);});`;
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1.5});
  await ctx.addInitScript(TOUCH);
  const pg=await ctx.newPage(); pg.on('pageerror',e=>console.log('ERR',e.message));
  const cdp=await ctx.newCDPSession(pg);
  let clip=null, meta={};
  cdp.on('Page.screencastFrame',async f=>{ try{ await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}); }catch(e){}
    if(!clip) return; const i=clip.frames.length; const fn=`${clip.name}_${String(i).padStart(4,'0')}.jpg`;
    fs.writeFileSync(path.join(OUT,fn),Buffer.from(f.data,'base64')); clip.frames.push({f:fn,t:f.metadata.timestamp}); });
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
  const rec=name=>{ clip={name,frames:[]}; };
  const stop=()=>{ if(!clip) return; const fr=clip.frames; const t0=fr.length?fr[0].t:0; meta[clip.name]=fr.map(x=>({f:x.f,t:+(x.t-t0).toFixed(3)})); console.log('clip',clip.name,fr.length,'frames',fr.length?(fr[fr.length-1].t-t0).toFixed(1)+'s':''); clip=null; fs.writeFileSync(path.join(OUT,'clips.json'),JSON.stringify(meta)); };
  const W=ms=>pg.waitForTimeout(ms);
  const pd=sel=>pg.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));e.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));return true;},sel);
  const cap=(fn,...a)=>pg.evaluate(([fn,a])=>window.__cap[fn](...a),[fn,a]);
  const glide=async(x,y,steps=14)=>{ await pg.mouse.move(x,y,{steps}); };
  const tap=async(x,y,hold=90)=>{ await glide(x,y,10); await pg.mouse.down(); await W(hold); await pg.mouse.up(); await W(160); };
  const clearOv=async()=>{ for(let k=0;k<5;k++){ const r=await pg.evaluate(()=>{const o=[...document.querySelectorAll('.ov')].find(o=>!o.classList.contains('hide')&&o.id!=='intro'&&getComputedStyle(o).display!=='none'); if(!o)return null; const bs=[...o.querySelectorAll('button')].filter(b=>b.offsetParent); const b=bs.find(b=>/▶|got it|let them|continue|begin|back to the hive|next|onward|carry on|keep|close|done/i.test(b.innerText))||bs[bs.length-1]; if(b){b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0}));b.click();return o.id;} return o.id+'!';}); if(!r) return; await W(500);} };

  await pg.goto('http://localhost:8145/',{waitUntil:'load'});
  await W(11000); await pg.mouse.click(640,440); await W(1200);
  // 1 · cold open
  rec('coldopen'); await W(1200); await tap(640,370,140); await W(4200); stop();
  await pg.click('#coBtn'); await W(1500);
  rec('title'); await W(3200); stop();
  await pg.click('#startNew'); await W(1200);
  rec('queen'); await glide(640,370,25); await W(600); await glide(640,470,25); await W(900); await glide(640,265,25); await W(700); stop();
  await pg.click('#queenGo'); await W(1500);
  rec('story'); await W(5500); stop();
  await pg.click('#storySkip').catch(()=>{}); await W(2500);
  await pg.click('#coachSkip').catch(()=>console.log('nocoachskip')); await W(1500);
  await cap('quiet'); await clearOv();
  const v=await pg.evaluate(()=>window.__hm().view); console.log('view',JSON.stringify(v));
  // 2 · paint the comb (real brush strokes)
  await pd('[data-brush="brood"]'); await W(300);
  rec('paint');
  await glide(v.hiveCx+200,v.hiveCy+260,20); await W(300);
  await tap(v.hiveCx,v.hiveCy);
  for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6; await tap(v.hiveCx+Math.cos(a)*v.size*1.73,v.hiveCy+Math.sin(a)*v.size*1.73,70);}
  await pd('[data-brush="honey"]'); await W(350);
  for(let k=0;k<12;k++){const a=k*Math.PI/6; await tap(v.hiveCx+Math.cos(a)*v.size*3.1,v.hiveCy+Math.sin(a)*v.size*3.1,60);}
  await pd('[data-brush="expand"]'); await W(350);
  for(let k=0;k<8;k++){const a=k*Math.PI/4+0.3; await tap(v.hiveCx+Math.cos(a)*v.size*4.5,v.hiveCy+Math.sin(a)*v.size*4.5,60);}
  await W(800); stop();
  await clearOv(); await cap('quiet');
  // 3 · the hive comes alive
  await cap('set',{forage:0.75}); await cap('flag',18); await pd('#playToggle'); await W(300); await cap('speed',1);
  await cap('sim',40); await cap('flag',18); await W(1500); await clearOv();
  rec('alive'); await W(6500); stop();
  await cap('speed',3); rec('fast'); await W(5000); stop(); await cap('speed',1); await clearOv();
  // 4 · heat lens
  rec('heat'); await cap('heat',true); await W(4200); await cap('heat',false); await W(600); stop();
  // 5 · ring completion
  rec('ring'); await W(400); await cap('ring'); await W(3200); stop();
  // 6 · meadow + waggle dance
  await cap('view','meadow'); await W(900); await clearOv();
  rec('meadow'); await W(2500); const mv=await pg.evaluate(()=>window.__hm().view);
  await tap(mv.W*0.3,mv.Hh*0.62,120); await W(2200); await tap(mv.W*0.72,mv.Hh*0.7,120); await W(2500); stop();
  await cap('view','hive'); await W(900); await clearOv();
  rec('dancecall'); await cap('dance'); await W(4500); stop(); await clearOv();
  // 7 · hornet raid
  await cap('spawnHornet'); rec('hornet');
  for(let i=0;i<40;i++){ await W(150); const h=await cap('hornet'); if(h&&h.state==='raid') break; }
  for(let i=0;i<14;i++){ const h=await cap('hornet'); if(!h||h.state!=='raid') break; await tap(h.x,h.y,50); }
  await W(2500); stop(); await clearOv();
  // 8 · autumn: bank honey, harvest a jar
  await cap('sim',150); await cap('flag',24); await cap('sim',20); await clearOv(); await cap('quiet');
  const inf=await cap('info'); console.log('autumn',JSON.stringify(inf));
  await cap('set',{honeyU:inf.HC*70}); await W(1200); await clearOv();
  rec('autumn'); await W(3000); await cap('harvest'); await W(3500); stop(); await clearOv();
  // 9 · winter
  await cap('sim',80); await clearOv(); await cap('quiet'); await W(800);
  console.log('winter',JSON.stringify(await cap('info')));
  rec('winter'); await W(6000); stop();
  await cap('heat',true); rec('winterheat'); await W(4000); stop(); await cap('heat',false);
  // 10 · year end: jump to the last evening of the year and let the review open
  await cap('set',{day:358.2}); await cap('speed',1); rec('yearend');
  for(let i=0;i<80;i++){ await W(250); const o=await pg.evaluate(()=>{const e=document.getElementById('yearEnd');return e&&!e.classList.contains('hide');}); if(o){ await W(4500); break; } }
  stop();
  await W(500);
  await b.close(); srv.close();
})().catch(e=>{console.error(e);process.exit(1);});
