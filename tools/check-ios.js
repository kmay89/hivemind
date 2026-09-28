#!/usr/bin/env node
// CI guard for the App Store build (platforms/ios): the app must always carry the repo's
// current game. Checks, with no Mac and no dependencies:
//   1. the Xcode target still runs "Bundle the current web game" first, which calls
//      `scripts/sync-www.js --app`, with user-script sandboxing off (the phase reads the repo);
//   2. every file sync-www.js copies still exists at the repo root;
//   3. the game build (GAME_VER) and the service worker VERSION agree, so a release bump
//      can't land half-done.
// Dev-only; never a runtime dependency of index.html. See docs/APP_STORE.md.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fails = [];

const pbx = read('platforms/ios/ios/App/App.xcodeproj/project.pbxproj');
const phases = (pbx.match(/buildPhases = \(([\s\S]*?)\);/) || [])[1] || '';
const first = (phases.match(/\/\* ([^*]+) \*\//) || [])[1];
if (first !== 'Bundle the current web game') fails.push(`the App target's first build phase is "${first}", not "Bundle the current web game"`);
if (!/isa = PBXShellScriptBuildPhase;[\s\S]*?sync-www\.js --app/.test(pbx)) fails.push('the bundle phase no longer runs `node scripts/sync-www.js --app`');
if ((pbx.match(/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g) || []).length < 2) fails.push('ENABLE_USER_SCRIPT_SANDBOXING = NO is missing from the Debug/Release target settings');

const sync = read('platforms/ios/scripts/sync-www.js');
const list = re => JSON.parse(((sync.match(re) || [])[1] || '[]').replace(/'/g, '"'));
const files = list(/const FILES = (\[[^\]]*\])/), dirs = list(/const DIRS = (\[[^\]]*\])/);
if (!files.includes('index.html')) fails.push('sync-www.js no longer copies index.html');
for (const f of files.concat(dirs)) if (!fs.existsSync(path.join(ROOT, f))) fails.push(`sync-www.js copies ${f}, which is missing from the repo root`);

const gv = (read('index.html').match(/let GAME_VER='([^']+)'/) || [])[1];
const sv = (read('sw.js').match(/const VERSION = '([^']+)'/) || [])[1];
if (!gv || gv !== sv) fails.push(`GAME_VER (${gv}) and sw.js VERSION (${sv}) disagree: bump both`);

if (fails.length) { console.error('iOS build check FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`ok — the iOS app bundles the current game on every build (game build ${gv}, ${files.length} files + ${dirs.join(', ')})`);
