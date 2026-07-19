#!/usr/bin/env node
// Headless multi-year economy validation — the safety net CONFIG's own comment
// ("economy validated headless — do not retune casually") has claimed to have
// since before this file existed. Runs index.html's real simulation code (no
// reimplementation, no approximation) in a fake DOM, across every queen line,
// and asserts a colony survives its first winter. Dev-only, never shipped.
//
// Usage: node tools/economy-sim.js [--years N] [--verbose]
// Exit code is non-zero if any run fails to survive or the script errors.
'use strict';
const vm = require('vm');
const path = require('path');
const { extractGameScript } = require('./extract-script');
const { createEnvironment } = require('./browser-stub');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');
const args = process.argv.slice(2);
// default 1: the autopilot below is a deliberately simple stand-in for a player
// (see its comment) — good enough to make "does year one stay winnable" a fair
// test, not sophisticated enough to make multi-year failures a confident signal
// of a CONFIG regression by themselves. Pass --years=N for a longer run when
// you want that signal anyway (e.g. investigating a specific late-game change);
// read a multi-year failure as "worth a human playtest", not "proven broken".
const YEARS = Number((args.find(a => a.startsWith('--years=')) || '').split('=')[1]) || 1;
const VERBOSE = args.includes('--verbose');

function loadGame() {
  const { windowStub, documentStub, localStorageStub } = createEnvironment();
  let captured = null;
  const sandbox = {
    document: documentStub,
    localStorage: localStorageStub,
    navigator: windowStub.navigator,
    location: windowStub.location,
    performance: windowStub.performance,
    innerWidth: windowStub.innerWidth,
    innerHeight: windowStub.innerHeight,
    devicePixelRatio: windowStub.devicePixelRatio,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame,
    addEventListener: windowStub.addEventListener,
    removeEventListener: windowStub.removeEventListener,
    matchMedia: windowStub.matchMedia,
    setTimeout, clearTimeout, setInterval, clearInterval,
    console,
    Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Promise,
    __exportHarness(bindings) { captured = bindings; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  const script = extractGameScript(INDEX_PATH);
  vm.runInContext(script, sandbox, { filename: 'index.html (inline script)' });
  if (!captured) throw new Error('the export hook never fired — the script likely threw before reaching the end of its IIFE');
  return captured;
}

// HIVEMIND is explicitly a *managed*-colony game — a comb that's never expanded
// is a hive nobody is keeping, not a balance bug, and would fail every scenario
// regardless of CONFIG. This is a deliberately simple stand-in for "an attentive
// player": periodically flag a few frontier cells for expansion. It does NOT
// choose brood vs. honey zone — stepDay's own comb-building logic already
// auto-zones a newly finished cell by neighbor majority (see the `s.zone=…`
// line in stepDay), same as it would for a player's real paint stroke.
function autopilot(G, day) {
  if (Math.floor(day) % 14 !== 0) return;
  const built = G.cells.filter(c => c.built);
  const frontier = G.cells.filter(c => !c.built && !c.flagExpand &&
    built.some(b => Math.abs(b.c - c.c) <= 1 && Math.abs(b.r - c.r) <= 1));
  for (const c of frontier.slice(0, 4)) c.flagExpand = true;
}

// drive stepDay() the same way offlineCatchup() does: small bounded steps, not
// one giant jump, so per-day effects (badges, cold snaps, brood ticks) fire
// the same number of times a real session would see.
function simulateYears(G, years) {
  const STEP = 0.2;
  // mirror seedAndPlay()'s founding state — tinyComb() only shapes the cells,
  // it doesn't set the starting population/stores (those live in seedAndPlay/
  // seedDaily/ovRestart, none of which this harness calls, to stay clear of
  // their DOM/onboarding side effects).
  G.resetColonyIdentity();
  G.tinyComb();
  // a real new game leaves the comb at zone:'none' and teaches the player to
  // paint brood/honey zones during the founding coach; seedStarterZones() is
  // what the game itself falls back to when that's skipped (see coachSkip) —
  // the reasonable "assume a sensibly laid-out comb" starting point to test.
  G.seedStarterZones();
  G.P = 15; G.honeyU = 8 * G.HC; G.pollenU = 4 * G.HC; G.nectarU = 0;
  G.peakPop = 15; G.bornTotal = 0; G.swarmP = 0; G.activePatch = null; G.forage = 0.6;
  G.day = 0; G.year = 1; G.over = false; G.started = true;
  G.drawSeason();
  G.goals = G.makeGoals();
  let day = 0;
  const dayLimit = G.YEAR * years;
  const series = [];
  while (day < dayLimit) {
    if (G.over) break;
    // stepDay reads/writes the closure's own `day` — advance it the same way
    // frame() does (before stepDay, not after) so season/temperature/day-length
    // math sees the day this tick is actually simulating.
    G.day += STEP; day += STEP;
    if (G.day >= G.YEAR) { G.day = 0; G.year += 1; G.drawSeason(); }
    autopilot(G, day);
    // offline=true would mask exactly the failure this harness exists to catch:
    // stepDay() skips the population-collapse gameOver() check when offline (it
    // silently clamps P to 1 instead, for the "you were away" catch-up path).
    G.stepDay(STEP, false);
    if (Math.floor(day) % 30 === 0) {
      series.push({ day: Math.round(day), P: Math.round(G.P), honey: Math.round(G.honeyCellsStored()) });
    }
  }
  return { survived: !G.over, finalDay: day, P: G.P, honeyCells: G.honeyCellsStored(), series };
}

function runScenario(label, setup) {
  const G = loadGame();
  setup(G);
  let result;
  try {
    result = simulateYears(G, YEARS);
  } catch (e) {
    return { label, ok: false, error: e.stack || String(e) };
  }
  const ok = result.survived && result.honeyCells >= 0 && result.P > 0;
  return { label, ok, result };
}

function main() {
  const scenarios = [];
  // baseline: fresh game load, no queen/gift selection touched
  scenarios.push(['boot: fresh game, no changes', () => {}]);
  // every queen line, no gifts — the foundational balance claim
  {
    const G0 = loadGame();
    for (const q of G0.QUEENS) {
      scenarios.push([`queen: ${q.id}`, (G) => { G.queenLine = q.id; }]);
    }
  }
  // every gift owned individually — catches an M{} wiring typo that leaves a
  // gift silently inert or a mod that makes the colony unwinnable
  {
    const G0 = loadGame();
    for (const g of G0.GIFTS) {
      scenarios.push([`gift: ${g.id}`, (G) => { G.owned[g.id] = true; }]);
    }
  }

  const results = scenarios.map(([label, setup]) => runScenario(label, setup));
  const failed = results.filter(r => !r.ok);

  for (const r of results) {
    if (r.ok) {
      if (VERBOSE) console.log(`ok    ${r.label} — survived to day ${r.result.finalDay}, ${Math.round(r.result.P)} bees, ${Math.round(r.result.honeyCells)} honey cells`);
    } else if (r.error) {
      console.error(`ERROR ${r.label} — ${r.error}`);
    } else {
      console.error(`FAIL  ${r.label} — died day ${r.result.finalDay} (P=${Math.round(r.result.P)}, honey=${Math.round(r.result.honeyCells)})`);
    }
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenarios survived ${YEARS} simulated year(s).`);
  if (failed.length) { console.error(`${failed.length} scenario(s) failed — see above.`); process.exit(1); }
}

main();
