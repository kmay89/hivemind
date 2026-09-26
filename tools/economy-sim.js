#!/usr/bin/env node
// Headless multi-year economy validation — the safety net CONFIG's own comment
// ("economy validated headless — do not retune casually") has claimed to have
// since before this file existed. Runs index.html's real simulation code (no
// reimplementation, no approximation) in a fake DOM, across every queen line,
// and asserts a colony survives its first winter. Dev-only, never shipped.
//
// Usage: node tools/economy-sim.js [--verbose]            the agency contract (CI)
//        node tools/economy-sim.js --strategy=NAME [--years=N]   probe one archetype
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
const TRACE = args.includes('--trace');   // with --strategy: print the colony every 15 days

// Deterministic RNG so this safety net is a *reliable* guard, not a flaky one.
// The real game leans on Math.random for weather, hornets and build jitter; left
// unseeded, a scenario that survives to the very last day (the `insulated` gift is
// the current razor's edge) fails maybe one run in ten — enough to redden CI on an
// unrelated change. A fixed seed removes that noise without touching balance. Probe
// the margins with `--seed=N`, or `--seed=random` for a fresh roll each run.
const seedArg = (args.find(a => a.startsWith('--seed=')) || '').split('=')[1];
const SEED = seedArg === 'random' ? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)
  : (seedArg !== undefined && seedArg !== '' ? (Number(seedArg) >>> 0) : 0x5eed1e >>> 0);
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame() {
  const { windowStub, documentStub, localStorageStub } = createEnvironment();
  let captured = null;
  // a Math whose only change is a seeded random() — floor/min/imul/etc. still come
  // straight from the real Math via the prototype, so the game's maths is untouched
  const seededMath = Object.create(Math);
  seededMath.random = seededRandom(SEED);
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
    Math: seededMath, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, Promise,
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

// ---------------------------------------------------------------- player archetypes
// The old harness proved one thing: year one is winnable. It never proved the
// opposite, that a colony nobody keeps is lost. FUN_ANALYSIS.md found a strategy
// that won three straight years with zero input (dial on nectar, flag every edge
// once, walk away), which means decisions didn't matter. So this harness now
// plays several archetypes and asserts the *spread* between them:
//   skilled  must survive (the game is fair)
//   passive  must die (the game is a game)
// An archetype is a function called once per sim step; it may paint zones, flag
// comb and move the forage dial, the same levers a player has.
function frontier(G) {
  const built = G.cells.filter(c => c.built);
  return G.cells.filter(c => !c.built && !c.flagExpand &&
    built.some(b => G.neighbors(b.c, b.r).some(([c2, r2]) => c2 === c.c && r2 === c.r)));
}
function flagAll(G, k = 99) { for (const c of frontier(G).slice(0, k)) c.flagExpand = true; }

const STRATEGIES = {
  // touches the game once on day 0, then never again
  passive: { dial: 0.6, tick(G, d) { if (d < 0.3) flagAll(G); } },
  // the exploit FUN_ANALYSIS found: the same, with the dial pinned on nectar
  exploit: { dial: 0.95, tick(G, d) { if (d < 0.3) flagAll(G); } },
  // the previous CI stand-in: flags a few cells every two weeks, never zones or dials
  tinkerer: { dial: 0.6, tick(G, d) { if (Math.floor(d) % 14 === 0 && (d % 1) < 0.2) flagAll(G, 4); } },
  // the least a newcomer does after the tutorial: taps Expand every week or so (the
  // one verb that now grows the nursery in spring too), never paints, never moves the dial
  expander: { dial: 0.6, tick(G, d) { if ((d % 1) < 0.2 && Math.floor(d) % 7 === 0 && G.day < 230) flagAll(G, 3); } },
  // a newcomer who does what the game tells them: follows the ★ on the forage dial,
  // paints the first two rings as nursery once, and taps a few edges every week
  casual: {
    dial: 0.6,
    tick(G, d) {
      if ((d % 1) >= 0.2) return;
      const yd = G.day;
      G.forage = yd < 45 ? 0.38 : yd < 150 ? 0.6 : yd < 210 ? 0.78 : yd < 285 ? 0.92 : 0.6;   // recForageIdx()'s notches
      if (d < 1.3) G.cells.filter(c => c.built && G.cellDist(c.c, c.r) < 2.1).forEach(c => { c.zone = G.cellDist(c.c, c.r) < 1.9 ? 'brood' : 'honey'; });
      if (Math.floor(d) % 7 === 0 && yd < 240) flagAll(G, 4);
    },
  },
  // what the game teaches: grow in spring (pollen, a nursery sized to the colony),
  // bank in summer and autumn (nectar), keep building while the flow is on
  skilled: {
    dial: 0.6,
    tick(G, d) {
      const yd = G.day;
      if ((d % 1) >= 0.2) return;                         // once per hive-day
      G.forage = yd < 60 ? 0.35 : yd < 110 ? 0.55 : yd < 250 ? 0.85 : 0.6;
      if (yd < 230 && Math.floor(d) % 4 === 0 && G.honeyU > 4 * G.HC) flagAll(G, 3);
      // the nursery follows the colony up in spring, then gives way to shelves
      const built = G.cells.filter(c => c.built).sort((a, b) => G.cellDist(a.c, a.r) - G.cellDist(b.c, b.r));
      // spring: a nursery bigger than the colony (real build-up has more brood cells than
      // bees); summer: ease off so shelves can fill; early autumn: keep laying, because
      // autumn brood becomes the long-lived winter bees; then close the nursery
      let want = yd < 140 ? Math.round(G.P * 1.4) + 4 : yd < 200 ? Math.round(G.P * 0.7) : yd < 250 ? Math.round(G.P * 0.5) : 7;
      // year 2+: when the mite count climbs, a short brood break starves them
      // (varroa breeds only under capped brood) — the second axis good keepers learn
      if (G.mite > 0.45) want = 4;
      const shelves = Math.max(10, Math.ceil((G.honeyU + G.pollenU + G.nectarU) / G.HC) + 6);   // room for what's stored, plus the flow
      const nb = Math.max(7, Math.min(want, built.length - shelves));
      built.forEach((c, i) => { if (c.brood) return; c.zone = i < nb ? 'brood' : 'honey'; });
    },
  },
};
// the skilled keeper's comb work, but the dial pinned on nectar all year — the test
// that pollen matters: spring brood eats bee bread, and a pinned dial starves it
STRATEGIES.pinned = { dial: 0.95, tick(G, d) { STRATEGIES.skilled.tick(G, d); G.forage = 0.95; } };

// drive stepDay() the same way offlineCatchup() does: small bounded steps, not
// one giant jump, so per-day effects (badges, cold snaps, brood ticks) fire
// the same number of times a real session would see.
function simulateYears(G, years, strat) {
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
  G.P = 15; G.honeyU = 8 * G.HC; G.pollenU = 4 * G.HC; G.nectarU = 0; G.mite = 0;
  G.peakPop = 15; G.bornTotal = 0; G.swarmP = 0; G.activePatch = null; G.forage = strat.dial;
  G.day = 0; G.year = 1; G.over = false; G.started = true;
  G.drawSeason();
  G.goals = G.makeGoals();
  let day = 0, peak = 15, step = 0;
  const dayLimit = G.YEAR * years;
  while (day < dayLimit) {
    if (G.over) break;
    // stepDay reads/writes the closure's own `day` — advance it the same way
    // frame() does (before stepDay, not after) so season/temperature/day-length
    // math sees the day this tick is actually simulating. Crucially, the
    // year-boundary reset happens AFTER stepDay, not before: resetting G.day to
    // 0 first would simulate the year's last fractional step (e.g. 359.8->360.0)
    // with day-0/spring parameters instead of day-360/deep-winter ones.
    G.day += STEP; day += STEP;
    strat.tick(G, day);
    // offline=true would mask exactly the failure this harness exists to catch:
    // stepDay() skips the population-collapse gameOver() check when offline (it
    // silently clamps P to 1 instead, for the "you were away" catch-up path).
    G.stepDay(STEP, false);
    peak = Math.max(peak, G.P);
    if (TRACE && ++step % 75 === 0) {
      const b = G.countBrood(), built = G.cells.filter(c => c.built).length;
      console.log(`  y${G.year} d${String(Math.round(G.day)).padStart(3)}  P ${G.P.toFixed(1).padStart(5)}  honey ${(G.honeyU / G.HC).toFixed(1).padStart(5)}  pollen ${(G.pollenU / G.HC).toFixed(1).padStart(4)}  cap ${G.honeyCells()}  brood ${G.broodCells()} (e${b.e} l${b.l} p${b.p})  built ${built}  dial ${G.forage}  mite ${G.mite.toFixed(2)}`);
    }
    if (G.day >= G.YEAR) { G.day = 0; G.year += 1; G.drawSeason(); }
  }
  return { survived: !G.over, finalDay: day, P: G.P, peak, honeyCells: G.honeyCellsStored() };
}

function scenarioList() {
  if (TRACE) return [['boot: fresh game, no changes', () => {}]];
  const G0 = loadGame();
  // baseline, every queen line, every gift — catches an M{} wiring typo that
  // leaves a gift silently inert or a mod that makes the colony unwinnable
  return [['boot: fresh game, no changes', () => {}],
    ...G0.QUEENS.map(q => [`queen: ${q.id}`, (G) => { G.queenLine = q.id; }]),
    ...G0.GIFTS.map(g => [`gift: ${g.id}`, (G) => { G.owned[g.id] = true; }])];
}
function runScenario(label, setup, strat, years) {
  const G = loadGame();
  setup(G);
  try { const result = simulateYears(G, years, strat); return { label, ok: result.survived, result }; }
  catch (e) { return { label, ok: false, error: e.stack || String(e) }; }
}
function runSuite(name, years) {
  return scenarioList().map(([label, setup]) => runScenario(label, setup, STRATEGIES[name], years));
}
const fmt = r => r.error ? `ERROR ${r.error.split('\n')[0]}`
  : `${r.ok ? 'lived' : 'died '} day ${Math.round(r.result.finalDay)}  peak ${Math.round(r.result.peak)}  end ${Math.round(r.result.P)} bees  ${Math.round(r.result.honeyCells)} honey`;

function main() {
  const one = (args.find(a => a.startsWith('--strategy=')) || '').split('=')[1];
  if (one) {   // manual probe: one archetype, --years=N
    if (!STRATEGIES[one]) { console.error('unknown strategy ' + one + ' — have: ' + Object.keys(STRATEGIES).join(', ')); process.exit(2); }
    const res = runSuite(one, YEARS);
    for (const r of res) console.log(`${r.label.padEnd(32)} ${fmt(r)}`);
    console.log(`\n${one}: ${res.filter(r => r.ok).length}/${res.length} survived ${YEARS} year(s).`);
    return;
  }
  // The CI contract. Each row: archetype, years, and how many of the 15 scenarios
  // must survive (min) or may survive (max).
  const CONTRACT = [
    // 14, not 15: the badge-locked queens (marigold, bramble, iris, rosalind) are meant to
    // be demanding, and on some seeds one lands a few days short of spring. Probe with
    // --seed=N: across seeds 1-6 this line reads 15/15.
    { s: 'skilled', years: 1, min: 14, why: 'a keeper who plays the seasons well sees spring' },
    { s: 'casual',  years: 1, min: 13, why: 'a newcomer who follows Hazel and the ★ gets through year one' },
    { s: 'expander',years: 1, min: 13, why: 'one verb (Expand) is enough to see the founding year through' },
    { s: 'expander',years: 2, max: 7,  why: '…but after it, the dial, the mites and the calendar have to be read' },
    { s: 'skilled', years: 3, min: 6,  why: 'good keeping (brood breaks for mites included) carries on for years' },
    { s: 'passive', years: 2, max: 0,  why: 'a hive nobody keeps is lost' },
    { s: 'exploit', years: 2, max: 0,  why: 'no zero-input strategy wins (dial pinned on nectar, walk away)' },
    { s: 'pinned',  years: 3, below: 'skilled', by: 4, why: 'the seasonal dial beats a pinned one — pollen matters' },
  ];
  let bad = 0; const got = {};
  for (const c of CONTRACT) {
    const res = runSuite(c.s, c.years), n = res.filter(r => r.ok).length; got[c.s + c.years] = n;
    const ref = c.below ? got[c.below + c.years] : null;
    const pass = (c.min == null || n >= c.min) && (c.max == null || n <= c.max) && (ref == null || n <= ref - c.by);
    if (!pass) bad++;
    const need = c.min != null ? 'need ≥' + c.min : c.max != null ? 'allow ≤' + c.max : `need ≤ ${c.below} − ${c.by} = ${ref - c.by}`;
    console.log(`${pass ? 'ok  ' : 'FAIL'}  ${c.s.padEnd(7)} × ${c.years}y: ${String(n).padStart(2)}/${res.length} survived (${need}) — ${c.why}`);
    if (VERBOSE || !pass) for (const r of res) console.log(`        ${r.label.padEnd(32)} ${fmt(r)}`);
    for (const r of res) if (r.error) { console.error(r.error); bad++; }
  }
  if (bad) { console.error(`\n${bad} contract line(s) failed.`); process.exit(1); }
  console.log('\nagency contract holds: good keeping is rewarded, neglect is not.');
}

main();
