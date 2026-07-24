# CLAUDE.md

Orientation for working in this repo — read this before editing `index.html`.

## What this is

HIVEMIND is a single-player browser game (a beekeeping survival sim) shipped
as **one self-contained `index.html` file** — one inline `<style>`, one
inline `<script>`, no build step, no dependencies, no server. That's
deliberate (see README.md): `open index.html` must always work, and Netlify
publishes the repo root as-is. Don't introduce a build step, a bundler, or a
runtime dependency into the shipped page. Dev-only tooling (see `tools/`) is
fine as long as it never runs in the browser.

There is no framework, no module system, no test runner in the shipped
artifact. The whole `<script>` is one closure: ~280 functions and ~600
top-level `let`/`const` declarations, all sharing scope. Section-banner
comments (`// ===== name =====`) mark logical regions, but they are
*signage, not isolation* — nothing enforces that a "section" only touches
its own state. When editing, grep for every call site of a function/global
you're changing; don't assume a banner boundary means the blast radius is
contained to it.

## Section map (`index.html`, current as of this file's last edit — line
numbers drift as the file changes; re-grep `// =====` banners if they look off)

| Lines | Section |
|---|---|
| 1-934 | `<head>` + the ~900-line inline `<style>` block |
| 934-1324 | body markup: canvas, panels, modals, HUD, advisor widget |
| 1324-1453 | `press()`, typewriter, splash FX, ErrerLabs studio splash |
| 1453-1539 | **CONFIG** — economy constants (population, forage, wax, temperature) |
| 1539-1610 | flowers & the honey cellar |
| 1610-1629 | the saga: apiary legacy titles |
| 1629-1638 | queen's gifts (roguelite meta-progression) |
| 1638-1686 | queen lines (starting temperaments) |
| 1686-1713 | **hex grid geometry** — `SQ3`/`cube`/`hexDist`/`neighbors`/`cellCenter`/`idx`; small, pure, reused everywhere. Model for how the rest of the file should look. |
| 1713-1728 | cell definitions |
| 1728-1753 | core mutable **state** banner (~25 bindings — NOT the only game state, see below) |
| 1753-1775 | season goals & badges |
| 1775-1830 | daily challenge |
| 1830-1936 | share card renderer |
| 1936-1952 | particles (cosmetic) |
| 1952-2049 | sound (WebAudio, synthesized) / music |
| 2049-2088 | juicy buttons (`press()`-adjacent feedback) |
| 2088-2141 | hornet raids |
| 2141-2165 | emergent seasonal weather, `difficulty()` |
| 2165-2240 | cosmetic bees, layout, meadow seeding |
| 2240-2427 | input handling, undo, teaching confirms, gentle-attention coaching |
| 2427-2518 | harvest (push-your-luck) |
| 2437-2518 | jar rendering |
| 2518-2539 | emergency feed |
| 2539-2585 | Hazel (the advisor character) |
| 2585-2657 | toast / advisor log |
| 2657-2810 | **sim core** — `stepDay()`, thermal field (`stepThermal`) |
| 2810-2873 | cosmetic bee animation (inside view) |
| 2873-3138 | **rendering: INSIDE** view |
| 3138-3250 | **rendering: MEADOW** view |
| 3250-3309 | HUD (`syncHUD`, `setN`) |
| 3309-3319 | season interstitials |
| 3319-3385 | grading / year transition |
| 3385-3411 | **persistence** — `serialize()`/`deserialize()`, `SAVE_KEY` |
| 3411-3546 | trends, ledger, `forecastToSpring()` |
| 3546-3640 | founding coach (onboarding), `COACH[]`/`BRIDGE[]` |
| 3640-3654 | grounded beekeeping facts |
| 3654-3743 | cinematic intro |
| 3743-3864 | cinematic backdrop (canvas-painted) |
| 3864-3915 | `LESSONS{}` |
| 3915-4017 | year-end review |
| 4017-4030 | dance break minigame |
| 4030-4157 | pause menu |
| ~4640-4930 | **hive link** — same-room multiplayer (WebRTC, sectors, votes); see docs/MULTIPLAYER.md |
| 4157-4230 | boot sequence |
| 4230-4300 | **main loop** — `frame()` |
| 4300-4328 | PWA: offline play, update banner |

## Shared primitives — reuse these, don't re-derive them

- `$('id')` — `document.getElementById` shorthand.
- `press(el, fn)` (1334) — the one place the iOS Safari synthesized-click
  bug is handled. Every tappable control should go through this or the
  delegated pointerdown listener (2080), not a raw `addEventListener('click', …)`.
- `toast(msg)` → `logMsg()` (2614) — the single funnel for all player-facing
  messages. Don't invent a new popup/banner for a new notification.
- `openOverlay(id)` / `closeOverlay(id)` — the shared modal primitive (see
  below). Every `.ov` panel opens/closes through this, never by hand-toggling
  `.hide` or the `paused` flag directly.
- `hexPathOn(ctx, x, y, s)` — the one hexagon-path helper. Don't hand-roll
  `Math.PI/180*(60*i-30)` again.
- `tempAt(day)` / `currentTemp()` — the one temperature formula. `tempAt(day)`
  is for projecting a *future* day (forecasts) and must not include today's
  transient cold-snap term; `currentTemp()` is the live-moment value used by
  rendering/audio/sim.
- `gradFor(ctx, key, factory)` (2895) — a profiling-driven canvas gradient
  cache ("keeps 180 bees + a full pantry at 60fps on a phone"). Any canvas
  gradient built inside a per-frame draw call should go through this, not be
  constructed fresh every frame.
- `resetColonyIdentity()` — resets the *identity* slice of per-run state
  (`roster`/`corpses`/`mix`/`coldSnap`) and is called from all three places a
  colony restarts (`seedAndPlay`, `seedDaily`, `ovRestart`). It is **not** a
  general per-run reset — each of those three call sites still hand-resets
  its own copy of `P`/`honeyU`/`day`/`year`/`mite`/etc. next to the call,
  so a new scalar (e.g. `mite`, added by the varroa mechanic) must be added
  to all three by hand or it silently carries over from the previous colony.
  If a piece of state needs the guarantee "reset everywhere identity is,"
  fold it into `resetColonyIdentity()` itself instead of relying on the
  three call sites staying in sync.
- `NET{}` / `netClient()` — the hive-link (multiplayer) switchboard. Rules
  that MUST stay true: `saveGame()` no-ops while `NET.on` (a party never
  touches the solo save); the sim block in `frame()` is gated on
  `!netClient()` (joiners render, the host simulates); every paint — local or
  remote — passes a `netPaintOk`/`netApplyPaint` sector check; snapshots are
  `serialize()` itself, so any new field added to the save schema is
  automatically shared (but `netApplySnap()` must be taught to *apply* it —
  update both or the field silently stays host-only). Undo is disabled in a
  linked hive. See docs/MULTIPLAYER.md.
- `M{}` — the stat-modifier reducer over `GIFTS`(owned) + `QUEENS`(mods).
  A gift or queen mod that should affect gameplay must be wired through here
  (additive *or* multiplicative, see the function's own comment), not read
  directly off `owned.*`/`QL()` from inside sim code.

## Game state — where it actually lives

There is no single canonical state object; treat the following as the
*practical* definition of "shared game state" (anything else declared at top
level is probably section-local):

- The ~25-binding `state` banner (1728-1753).
- `roster` (1561), `CELLAR` (1620), `owned` (1672), `cells[]` (1713),
  `corpses`, `mix`, `coldSnap`, `day`, `P`, `honeyU`, and the handful of other
  fields listed explicitly in `serialize()`/`deserialize()` (3385-3411) — that
  pair is the closest thing to a state schema, so when in doubt, check what
  they read/write.
- Anything touched by `resetColonyIdentity()` or hand-reset alongside its
  three call sites (`seedAndPlay`, `seedDaily`, `ovRestart`) is per-run state
  and must be included there, in `serialize`/`deserialize`, and in any
  save-shape version bump.

When adding a new piece of per-run state: reset it at all three colony-start
call sites (or fold it into `resetColonyIdentity()` if it should always
travel with roster/corpses/mix), add it to `serialize()`/`deserialize()`,
bump the save version if the field isn't safely optional, and confirm it's
reset correctly on every reset path (new colony, new year, daily challenge,
colony death) — don't assume one reset path implies the others.

## Content tables — add a row, not a branch

`FLOWERS`, `QUEENS`, `GIFTS`, `BADGES`, `WEATHERS`, `PATCHES`, `COACH[]` are
flat data tables. Adding new content (a flower, a gift, a badge, a weather
event, a tutorial step) should mean **appending one row**, not adding a new
`if`/`else` branch somewhere else in the file. If you find yourself writing
`if (id === 'newThing')` in sim/render/UI code to special-case a new content
row, that's a sign the table needs a field instead.

## Dev tooling (never shipped, never a runtime dependency)

- `tools/economy-sim.js` — headless multi-year economy simulation used to
  validate CONFIG/QUEENS/GIFTS balance changes before they ship. Run it
  manually before retuning the economy: `node tools/economy-sim.js`.
- `.github/workflows/ci.yml` — pre-merge checks only (syntax check, DOM-id
  integrity, manifest validation). Does not touch `netlify.toml` or the
  deploy pipeline.

## What NOT to do

- Don't add a bundler, module system, or `import`/`export` to `index.html`.
  If the file ever genuinely outgrows this map, the right shape is a
  `src/*.js` split with a trivial concatenation build that still checks in
  the built `index.html` — a deliberate, separate decision, not a drive-by
  refactor.
- Don't add a runtime npm dependency. `package.json` (if present) is
  dev-tooling-only.
- Don't touch `netlify.toml`'s CSP without checking whether the change
  requires loosening `script-src`/`style-src` — the whole security model
  assumes everything is inline and same-origin.

## Known deferred work

- **`M{}` is not a generic reducer over `GIFTS`/`QUEENS`, and that's a
  deliberate scope decision, not an oversight.** Each of `M{}`'s ~10 stats
  combines gifts and queen mods differently — most are multiplicative
  (`owned.x ? factor : 1`), `temp`/`snap`/`hHP` are base-switches with an
  additive queen term, and `guard`/`insulated` each touch two stats at once.
  A faithful generic reducer needs to encode that heterogeneity (a
  `{stat,mult|delta|base}` effect shape per gift, plus a stat→kind table) to
  avoid silently changing balance — real work, not a mechanical refactor.
  What *is* fixed: the two outright bypasses found so far (`QL().swarm` used
  to skip `M{}` entirely, now `M.swarm()`; the varroa mechanic's `hygienic`
  gift read `owned.hygienic` directly in `stepDay`, now `M.mite()`). New
  gifts/mods have kept landing with a direct `owned.*`/`QL()` read instead of
  going through `M{}` — watch for it in review, it's an easy thing to miss.
  If you take the full generic-reducer refactor on, do it as its own
  pass and diff `node tools/economy-sim.js --years=3 --verbose` before/after
  across every queen+gift combo, not just a syntax check.
