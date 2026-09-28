#!/usr/bin/env node
// Copies the shipped web game into www/, unmodified, for Capacitor to bundle.
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
