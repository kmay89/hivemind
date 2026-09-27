#!/usr/bin/env node
// Renders the App Store icon (1024², opaque) and the launch splash (2732²) from code, in
// headless Chromium: the same honeycomb-and-bee mark as icons/icon-maskable-512.png, drawn
// at full resolution instead of upscaled. Dev-only (playwright-core, like tools/store-shots.js):
//   CHROMIUM=/path/to/chromium node scripts/make-art.js
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');
const { spawnSync } = require('child_process');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';   // strips the alpha channel: App Store icons must be opaque RGB
const ASSETS = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets');
const PAGE = (S, mode) => `<!doctype html><html><body style="margin:0;background:#0b0805"><canvas id="c" width="${S}" height="${S}"></canvas><script>
const S=${S}, mode='${mode}', g=document.getElementById('c').getContext('2d');
const hex=(x,y,r)=>{ g.beginPath(); for(let i=0;i<6;i++){ const a=Math.PI/3*i; g.lineTo(x+r*Math.cos(a), y+r*Math.sin(a)); } g.closePath(); };
// background: warm near-black with a soft glow toward the centre
const bg=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S*0.72); bg.addColorStop(0,'#241808'); bg.addColorStop(1,'#0b0805');
g.fillStyle=bg; g.fillRect(0,0,S,S);
const k = mode==='icon' ? 1 : 0.34;           // the splash shows the mark small, centred
const R=S*0.17*k, cx=S/2, cy=S/2, dx=R*1.5, dy=R*Math.sqrt(3);
// faint outer comb
g.lineWidth=S*0.006*k; g.strokeStyle='rgba(120,88,40,.28)';
for(let q=-4;q<=4;q++) for(let r=-4;r<=4;r++){ const x=cx+q*dx, y=cy+(r+q/2)*dy; if(Math.hypot(x-cx,y-cy)>R*6) continue; hex(x,y,R*0.93); g.stroke(); }
// the ring of empty cells around the heart
g.lineWidth=S*0.014*k; g.strokeStyle='rgba(176,132,64,.62)';
for(let i=0;i<6;i++){ const a=Math.PI/6+Math.PI/3*i, x=cx+Math.cos(a)*dy, y=cy+Math.sin(a)*dy; hex(x,y,R*0.9); g.stroke(); }
// the honey cell: glow, fill, rim, shine
g.save(); g.shadowColor='rgba(255,190,70,.75)'; g.shadowBlur=S*0.09*k; hex(cx,cy,R*0.92);
const hg=g.createRadialGradient(cx-R*0.3,cy-R*0.35,R*0.1,cx,cy,R*1.05); hg.addColorStop(0,'#ffd97a'); hg.addColorStop(0.55,'#ffb42b'); hg.addColorStop(1,'#e08f1f');
g.fillStyle=hg; g.fill(); g.restore();
hex(cx,cy,R*0.92); g.lineWidth=S*0.016*k; g.strokeStyle='#ffe7a8'; g.stroke();
g.save(); hex(cx,cy,R*0.9); g.clip(); g.fillStyle='rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(cx-R*0.18,cy-R*0.42,R*0.62,R*0.26,-0.25,0,Math.PI*2); g.fill(); g.restore();
// the bee, up and to the right of the heart
const bx=cx+R*1.05, by=cy-R*1.05, br=R*0.36; g.save(); g.translate(bx,by); g.rotate(0.35);
g.fillStyle='rgba(225,235,255,.85)'; g.beginPath(); g.ellipse(-br*0.1,-br*0.85,br*0.62,br*0.34,-0.5,0,Math.PI*2); g.fill(); g.beginPath(); g.ellipse(br*0.25,-br*0.8,br*0.5,br*0.28,-0.2,0,Math.PI*2); g.fill();
g.fillStyle='#f5b52e'; g.beginPath(); g.ellipse(0,0,br*1.15,br*0.78,0,0,Math.PI*2); g.fill();
g.save(); g.beginPath(); g.ellipse(0,0,br*1.15,br*0.78,0,0,Math.PI*2); g.clip(); g.fillStyle='#2a1706'; g.fillRect(-br*0.35,-br,br*0.28,br*2); g.fillRect(br*0.18,-br,br*0.28,br*2); g.restore();
g.fillStyle='#2a1706'; g.beginPath(); g.arc(-br*1.15,-br*0.1,br*0.42,0,Math.PI*2); g.fill();
g.restore();
</script></body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const pg = await b.newPage();
  const shot = async (S, mode, file) => { await pg.setViewportSize({ width: S, height: S }); await pg.setContent(PAGE(S, mode)); await pg.waitForTimeout(200);
    const tmp = file + '.rgba.png';
    await (await pg.$('#c')).screenshot({ path: tmp, omitBackground: false });
    const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-pix_fmt', 'rgb24', file]);
    if (r.status !== 0) throw new Error('ffmpeg failed (set FFMPEG=/path/to/ffmpeg): ' + String(r.stderr || r.error));
    require('fs').unlinkSync(tmp); console.log('wrote', path.relative(process.cwd(), file), '(RGB, no alpha)'); };
  await shot(1024, 'icon', path.join(ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'));
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    await shot(2732, 'splash', path.join(ASSETS, 'Splash.imageset', f));
  await b.close();
})();
