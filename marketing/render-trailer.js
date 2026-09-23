#!/usr/bin/env node
// Renders trailer.html to MP4: steps renderAt() frame by frame in headless
// Chromium, synthesizes a soundtrack (music + sound effects on the page's
// CUES), and muxes both with ffmpeg. Dev-only tooling, never shipped.
//
//   node render-trailer.js [--w=1920 --h=1080] [--out=hivemind-trailer.mp4]
// Env: CHROMIUM (default /opt/pw-browsers/chromium), FFMPEG (default: ffmpeg on PATH)
'use strict';
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), OUT = path.resolve(arg('out', `hivemind-trailer-${W}x${H}.mp4`));
const ROOT = __dirname;
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const FF = process.env.FFMPEG || 'ffmpeg';
const TMP = path.join(ROOT, `.render-${W}x${H}`);

// ------------------------------------------------------------------ audio
const SR = 44100;
function synth(DUR, CUES) {
  const N = Math.ceil((DUR + 1) * SR), L = new Float32Array(N), R = new Float32Array(N);
  const put = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * Math.cos((pan + 1) * Math.PI / 4); R[i] += v * Math.sin((pan + 1) * Math.PI / 4); };
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  let seed = 7; const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  const lpA = fc => 1 - Math.exp(-2 * Math.PI * fc / SR);

  const pluck = (t0, f, dur, amp, pan = 0) => { const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR);
    for (let i = 0; i < n; i++) { const t = i / SR, e = Math.exp(-t / 0.22) * Math.min(1, t * 400);
      put(s0 + i, amp * e * (Math.sin(2 * Math.PI * f * t) + 0.45 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t / 0.08) + 0.2 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t / 0.05)), pan); } };
  const pad = (t0, fs, dur, amp, fc = 1400) => { const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR); let yl = 0, yr = 0; const a = lpA(fc);
    const ph = fs.map(() => [Math.random(), Math.random(), Math.random()]);
    for (let i = 0; i < n; i++) { const t = i / SR; const env = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.4);
      let xl = 0, xr = 0; fs.forEach((f, k) => { const d = [0.997, 1, 1.004]; d.forEach((dd, j) => { const p = (ph[k][j] + f * dd * t) % 1; const saw = 2 * p - 1; if (j === 0) xl += saw; else if (j === 2) xr += saw; else { xl += saw * 0.5; xr += saw * 0.5; } }); });
      yl += a * (xl - yl); yr += a * (xr - yr); const g = amp * env / fs.length;
      if (s0 + i < N) { L[s0 + i] += yl * g; R[s0 + i] += yr * g; } } };
  const bass = (t0, f, dur, amp) => { const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR);
    for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t * 300) * Math.exp(-t / 0.35) * Math.min(1, (dur - t) * 60);
      const x = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t); put(s0 + i, amp * Math.tanh(1.6 * x) * e); } };
  const kick = (t0, amp = 1) => { const n = Math.floor(0.45 * SR), s0 = Math.floor(t0 * SR); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = 45 + 110 * Math.exp(-t / 0.045); ph += f / SR; put(s0 + i, amp * 0.95 * Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.16)); } };
  const clap = (t0, amp = 1) => { const n = Math.floor(0.25 * SR), s0 = Math.floor(t0 * SR); let lp = 0, hp = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; const x = noise(); lp += lpA(3500) * (x - lp); const y = lp - (hp += lpA(700) * (lp - hp));
      const e = (t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.6 : 1) : 1) * Math.exp(-t / 0.07); put(s0 + i, amp * 0.6 * y * e * 2, 0.1); } };
  const hat = (t0, amp = 1, dec = 0.035, pan = 0.25) => { const n = Math.floor(dec * 6 * SR), s0 = Math.floor(t0 * SR); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp += lpA(7000) * (x - lp); put(s0 + i, amp * 0.28 * (x - lp) * Math.exp(-t / dec), pan); } };
  const crash = (t0, amp = 1) => { const n = Math.floor(2 * SR), s0 = Math.floor(t0 * SR); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp += lpA(5000) * (x - lp); const v = amp * 0.3 * (x - lp) * Math.exp(-t / 0.55); put(s0 + i, v, -0.3); put(s0 + i, v * 0.8, 0.3); } };
  const bell = (t0, f, amp = 0.5, dec = 0.9, pan = 0) => { const n = Math.floor(dec * 5 * SR), s0 = Math.floor(t0 * SR);
    for (let i = 0; i < n; i++) { const t = i / SR; put(s0 + i, amp * Math.min(1, t * 800) * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / dec) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / (dec * 0.3)) + 0.15 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t / (dec * 0.12))), pan); } };
  const sweep = (t0, dur, f0, f1, amp, up = true) => { const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR); let lp = 0;
    for (let i = 0; i < n; i++) { const u = i / n; const fc = f0 * Math.pow(f1 / f0, u); lp += lpA(fc) * (noise() - lp);
      const e = up ? Math.pow(u, 1.6) : Math.sin(Math.PI * u); put(s0 + i, amp * lp * e * 1.6, Math.sin(u * 6) * 0.5); } };
  const buzz = (t0, dur, amp) => { const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR); let ph = 0, lp = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = 215 + 14 * Math.sin(t * 31) + 30 * Math.sin(t * 2.3); ph += f / SR; const saw = 2 * (ph % 1) - 1; lp += lpA(1400) * (saw - lp);
      const e = Math.sin(Math.PI * t / dur) * (0.7 + 0.3 * Math.sin(t * 57)); put(s0 + i, amp * lp * e, Math.sin(t * 1.7) * 0.8); } };
  const boom = (t0, amp) => { const n = Math.floor(1.4 * SR), s0 = Math.floor(t0 * SR); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = 38 + 40 * Math.exp(-t / 0.1); ph += f / SR; put(s0 + i, amp * Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.5)); } };

  // --- music: 120 bpm, F major, I–V–vi–IV, one chord per bar (2 s)
  const B = 0.5, CH = [[53, 57, 60], [48, 52, 55], [50, 53, 57], [46, 50, 53]], ROOT = [41, 36, 38, 34];
  const ARP = [0, 1, 2, 1, 2, 3, 2, 1];   // indices into chord tones + octave
  const sec = t => (t < 8 ? 'intro' : t < 28 ? 'full' : t < 32 ? 'break' : t < 56 ? 'full' : t < 62 ? 'soft' : t < 70 ? 'full' : 'end');
  for (let bar = 0; bar * 2 < 70; bar++) {
    const t0 = bar * 2, c = CH[bar % 4], s = sec(t0);
    pad(t0, c.map(m => mf(m + 12)), 2.05, s === 'break' || s === 'soft' ? 0.2 : 0.13, s === 'break' ? 700 : 1600);
    for (let k = 0; k < 16; k++) { const t = t0 + k * B / 4; const tones = [...c, c[0] + 12];
      if (s === 'intro' && (t < 2 || k % 2)) continue; if (s === 'break' && k % 4) continue;
      const m = tones[ARP[k % 8]] + 24; pluck(t, mf(m), 0.5, s === 'intro' ? 0.09 : s === 'break' ? 0.1 : 0.075, (k % 2 ? 0.35 : -0.35)); }
    if (s === 'full' || s === 'soft') {
      for (let b = 0; b < 4; b++) { const t = t0 + b * B;
        if (s === 'full') { kick(t, 0.9); if (b % 2) clap(t, 0.8); }
        hat(t + B / 2, s === 'soft' ? 0.5 : 0.9); if (t >= 22 && t < 28) { hat(t + B / 4, 0.5); hat(t + 3 * B / 4, 0.5); }
        if (s === 'full') { bass(t, mf(ROOT[bar % 4]), B * 0.45, 0.32); bass(t + B / 2, mf(ROOT[bar % 4] + (b === 3 ? 7 : 12)), B * 0.4, 0.22); }
        else if (b === 0) bass(t, mf(ROOT[bar % 4]), 1.8, 0.2); } }
  }
  pad(70, [65, 69, 72, 77].map(mf), 2.8, 0.26, 2200); bell(70, mf(84), 0.25, 1.6); bell(70.02, mf(89), 0.18, 1.6); kick(70, 1); crash(70, 1);

  // --- sound design on the page's cues
  for (const c of CUES) { const t = c.t, v = c.v || 1;
    switch (c.k) {
      case 'buzz': buzz(t, 3.6, 0.22 * v); break;
      case 'hit': kick(t, v); crash(t, 0.8 * v); break;
      case 'drop': boom(t, 0.9); crash(t, 1); break;
      case 'chime': bell(t, mf(84), 0.22 * v, 0.8, -0.2); bell(t + 0.09, mf(91), 0.18 * v, 0.9, 0.2); break;
      case 'ding': bell(t, mf(79) * v, 0.22, 0.6, 0.15); break;
      case 'pop': { const n = Math.floor(0.09 * SR), s0 = Math.floor(t * SR); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += (950 - 600 * u) / SR; put(s0 + i, 0.32 * Math.sin(2 * Math.PI * ph) * (1 - u)); } break; }
      case 'whoosh': sweep(t - 0.25, 0.55, 400, 6000, 0.55 * v, false); break;
      case 'riser': sweep(t, 2.5, 200, 9000, 0.5 * v, true); break;
      case 'riserShort': sweep(t, 0.45, 500, 8000, 0.4, true); break;
      case 'ring': [79, 84, 88, 91, 96].forEach((m, i) => bell(t + i * 0.06, mf(m), 0.2, 1.1, (i - 2) * 0.2)); break;
      case 'fanfare': [[72, 76], [76, 79], [79, 84]].forEach((p, i) => { bell(t + i * 0.11, mf(p[0] + 12), 0.2, 0.7); bell(t + i * 0.11, mf(p[1] + 12), 0.16, 0.7); }); break;
      case 'smash': kick(t, 1); boom(t, 0.45); crash(t, 0.5); sweep(t - 0.18, 0.2, 800, 8000, 0.4, true); break;
      case 'tick': hat(t, 1.4, 0.012, 0); bell(t, mf(96), 0.06, 0.1); break;
    } }

  // --- master: soft clip, normalize to -1 dBFS, fade tail
  let peak = 0; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const g = 0.89 / (peak || 1), end = Math.floor(DUR * SR);
  const buf = Buffer.alloc(44 + end * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + end * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(end * 4, 40);
  for (let i = 0; i < end; i++) { const f = Math.min(1, (end - i) / (0.4 * SR));
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * f)) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * f)) * 32767), 46 + i * 4); }
  return buf;
}

// ------------------------------------------------------------------ video
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.json': 'application/json' };
(async () => {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const PORT = srv.address().port;
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const pg = await browser.newPage({ viewport: { width: 800, height: 600 } });
  pg.on('pageerror', e => console.log('page error:', e.message));
  await pg.goto(`http://localhost:${PORT}/trailer.html?render=1&w=${W}&h=${H}`);
  const info = await pg.evaluate(async () => { await window.TRAILER.ready; const T = window.TRAILER; return { FPS: T.FPS, DUR: T.DUR, CUES: T.CUES }; });
  const n = Math.round(info.DUR * info.FPS);
  for (let i = 0; i < n; i++) {
    const d = await pg.evaluate(i => window.TRAILER.frame(i), i);
    fs.writeFileSync(path.join(TMP, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(TMP, 'audio.wav'), synth(info.DUR, info.CUES));
  execFileSync(FF, ['-loglevel', 'error', '-y', '-framerate', String(info.FPS), '-i', path.join(TMP, 'f%05d.jpg'), '-i', path.join(TMP, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT], { stdio: 'inherit' });
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('wrote ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
