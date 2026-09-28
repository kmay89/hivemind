#!/usr/bin/env node
// Copies the shipped web game into www/, unmodified, for Capacitor to bundle.
// With --app it also refreshes the copy inside the Xcode project (run by an Xcode build phase).
// The page is the product (CLAUDE.md): this script never edits it, it only picks
// which files travel. The trailer videos stay on the website (the app streams them,
// see IS_APP in index.html), so the bundle stays small.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const WWW = path.join(__dirname, '..', 'www');
const FILES = ['index.html', 'about.html', 'privacy.html', 'terms.html', '404.html', 'manifest.webmanifest', 'social-card.png'];
const DIRS = ['fonts', 'icons'];
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(WWW, d), { recursive: true });
// the four pages link to "/" for home; inside the app that is www/index.html, which Capacitor serves at /
const size = FILES.concat(DIRS).reduce((a, f) => {
  const walk = p => fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((s, x) => s + walk(path.join(p, x)), 0) : fs.statSync(p).size;
  return a + walk(path.join(WWW, f));
}, 0);
console.log(`www/ ready: ${FILES.length} files + ${DIRS.join(', ')} (${(size / 1024).toFixed(0)} KB)`);
// which build of the game this is (the pause menu shows the same string), so the log says
// exactly what the app will carry
const ver = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/let GAME_VER='([^']+)'/) || [])[1] || '?';
console.log(`game build ${ver}`);
// --app: also refresh the web game inside the Xcode project's bundle folder. Xcode runs this on
// every build ("Bundle the current web game" phase), so an archive always carries the repo's
// current index.html even if nobody re-ran `npm run sync`. Capacitor's own generated files in
// public/ (cordova.js, plugin lists) are left alone; only the game's files are replaced.
if (process.argv.includes('--app')) {
  const PUB = path.join(__dirname, '..', 'ios', 'App', 'App', 'public');
  if (!fs.existsSync(PUB)) {
    console.log('warning: ios/App/App/public is missing. Run `npm install && npm run sync` once to set the app up.');
  } else {
    for (const f of FILES) fs.copyFileSync(path.join(WWW, f), path.join(PUB, f));
    for (const d of DIRS) { fs.rmSync(path.join(PUB, d), { recursive: true, force: true }); fs.cpSync(path.join(WWW, d), path.join(PUB, d), { recursive: true }); }
    console.log(`app bundle refreshed: ios/App/App/public now carries game build ${ver}`);
  }
}
