// Pulls the inline gameplay <script> out of index.html and injects a hook that
// exports the closure bindings tools/economy-sim.js and CI need to reach in
// (day/state, stepDay, content tables). Dev-only — never shipped, never
// referenced by index.html itself. See CLAUDE.md.
'use strict';
const fs = require('fs');
const path = require('path');

// Reassignable scalars (`day=…`, `P-=…`, `goals=makeGoals()`) need real get/set
// accessors — capturing them as plain object-literal shorthand (`{ day }`) only
// copies the primitive's value at export time, so the harness's writes never
// reach stepDay()'s closure and stepDay()'s writes never reach the harness (this
// is exactly the bug that made an early version of this harness see P/honeyU
// frozen at their starting values for a full simulated year — nothing was
// "connected", it just looked like it because both sides read their own copy).
const ACCESSOR_BINDINGS = [
  'day', 'year', 'P', 'honeyU', 'pollenU', 'nectarU', 'activePatch', 'forage',
  'coldSnap', 'over', 'started', 'peakPop', 'bornTotal', 'swarmP', 'queenLine',
  'goals', 'curSeason',
];
// Objects/arrays/functions/consts: a captured reference points at the same
// underlying value, and only ever-mutated-in-place (never reassigned) here, so
// a plain shorthand property is safe.
const DIRECT_BINDINGS = [
  'cells', 'roster', 'corpses', 'mix', 'owned', 'grades',
  'stepDay', 'resetColonyIdentity', 'tinyComb', 'drawSeason', 'makeGoals', 'seedStarterZones',
  'countBrood', 'honeyCellsStored', 'winterNeed', 'currentTemp', 'forecastToSpring',
  'broodCells', 'honeyCells', 'caps',
  'QUEENS', 'GIFTS', 'WEATHERS', 'FLOWERS',
  'YEAR', 'WIN_TEMP', 'CAP', 'HC', 'DAY_LEN',
];

function extractGameScript(indexHtmlPath) {
  const src = fs.readFileSync(indexHtmlPath, 'utf-8');
  const matches = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!matches.length) throw new Error('no <script> block found in ' + indexHtmlPath);
  // the gameplay script is the largest inline <script> block (there are no others
  // of consequence in this file, but pick the biggest defensively)
  const body = matches.map(m => m[1]).sort((a, b) => b.length - a.length)[0];

  const wrapperStart = body.indexOf('(function(){');
  const wrapperEnd = body.lastIndexOf('})();');
  if (wrapperStart === -1 || wrapperEnd === -1) {
    throw new Error('expected the script to be wrapped in a top-level (function(){...})();');
  }

  const accessors = ACCESSOR_BINDINGS.map(name =>
    `get ${name}(){return ${name};}, set ${name}(v){${name}=v;}`).join(', ');
  const exportLine = `\n  if (typeof globalThis.__exportHarness === 'function') { globalThis.__exportHarness({ ${accessors}, ${DIRECT_BINDINGS.join(', ')} }); }\n  `;
  return body.slice(0, wrapperEnd) + exportLine + body.slice(wrapperEnd);
}

module.exports = { extractGameScript, ACCESSOR_BINDINGS, DIRECT_BINDINGS };

if (require.main === module) {
  const indexPath = path.join(__dirname, '..', 'index.html');
  process.stdout.write(extractGameScript(indexPath));
}
