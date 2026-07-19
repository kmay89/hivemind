# HIVEMIND — Design Audit & Roadmap

*A full inspection of what we've built, and a plan to make it a game people play for
years — as legible as Paperclips, as inviting as Minecraft, as re-playable as chess.*

This is a working design document, not a spec. It's opinionated on purpose. It reads
the actual code (`index.html`, ~4,200 lines, single file, zero dependencies), names
what's genuinely strong, and identifies the specific things we don't yet have.

---

## TL;DR

HIVEMIND is already an unusually deep, science-literate colony simulator with a
beautiful teaching layer. **The problem isn't quality — it's shape.** Right now the
game is one optimization problem (*survive the winter*) simulated brilliantly and
replayed at rising difficulty. To be played for years it needs three things:

1. **A moving bottleneck** (the Paperclips lesson). New resource axes that
   *recontextualize* the honey race instead of just making it harder — varroa load,
   queen genetics, product mix, colony splits. The thing you optimize should keep
   changing.
2. **Less telling, more showing** (the Minecraft lesson). The sim already models real
   physics (heat diffusion, flight economics). Let more of the teaching happen through
   *visible cause-and-effect* and less through Hazel's prose. Cut the reading wall
   before the first tap.
3. **A mastery ramp that removes the training wheels** (the chess lesson). The game
   sometimes tells you the optimal move (`recForageIdx()`, the ★ on the mixer, the
   advisor). That's right for hour one and wrong for year two. Make the hints *come
   off* as you climb.

Everything below expands these three, grounds new mechanics in real hive science, and
ends with a prioritized, buildable roadmap.

---

## 1. What we've actually built

An honest inventory, because you can't plan the next move without respecting the
position. This is a lot of game.

### The simulation (the crown jewel)

This is not a clicker with a bee theme. It's a real agent-and-field model.

- **Population dynamics.** True brood pipeline — egg (3d) → larva (5d) → pupa (12d) →
  bee, ~20 days end to end (`EGG_D/LAR_D/PUP_D`, line ~1455). **Age polyethism**: a bee
  is a house bee, then a nurse, then a forager, sorted by age (`beeRole`, ~1565).
  Winter bees live far longer than summer bees (`LIFE_S=35`, `LIFE_W=135`). Deaths are
  continuous, capped population, and the dead are *carried out* by undertakers
  (necrophoresis, `undertake()` ~2691).
- **Thermoregulation as heat diffusion** (`stepThermal`, ~2666). This is the standout.
  No bee knows the nest temperature; each warms its own cell, and heat conducts across
  the wax to neighbors. Nurses shiver over brood; the winter cluster is a radial
  furnace. Compact comb holds heat, scattered comb bleeds it. **The optimal nest shape
  emerges — it isn't scripted.** That is, literally, the hivemind.
- **Forage economics with flight cost** (`patchEff`, ~1534). Eight real patches at real
  distances; each blooms on its own seasonal phase. Net worth = bloom richness − cost
  of the flight (`quality * (1.15 - 0.45*dist)`). Every flower has a near-modest and a
  far-lush patch, so *purity has a price*. The waggle dance encodes exactly the two
  numbers a real dance encodes: direction and distance.
- **Comb economy.** Wax costs ~8 honey per cell (the real ratio, `WAX_H`), build
  radiates outward from the nest and stalls legibly when stores run thin
  (`buildFromFlags`, ~2712). Nectar ripens into honey (`RIPE`). Storage caps scale with
  built honey cells.
- **Swarm pressure** (~2776). Crowding accumulates; past a threshold the colony throws
  a swarm and you lose ~42% of your bees. Give the queen room or pay for it.
- **Queen aging & supersedure.** Vigour declines with age; workers can raise a
  replacement (~2803).
- **Emergent weather & threats.** Seven weather archetypes drawn per year (Great Bloom,
  Dry Summer, Late Frost, Golden Autumn, Wandering Swarm, Year of the Bear…), plus
  telegraphed hornet raids (scout → raid, tap to defend), bear raids, and cold snaps.
  Difficulty ramps year over year (`difficulty()`, ~2161).

### The legibility layer (Paperclips-grade transparency)

- **Live ledger** (`ledger()`, ~3307) — income / eaten / brood / wax / net per day,
  computed with *the same math the sim runs*.
- **Forward forecast to spring** (`forecastToSpring`, ~3378) — a full forward
  simulation projecting honey to day 360, flagging the exact day you'd starve, drawn as
  a sparkline with the winter band shaded. This is genuinely excellent and rare.
- **Season plan** with per-season target rows, and **per-dial yield readouts** (+honey /
  +pollen per week) so every lever shows its price.

### Meta & progression

- **Queen lines** (7) — pick a temperament at founding; each bends the same numbers one
  honest way with one honest cost (Aster forages more but swarms faster, Juniper is
  thrifty but lays slow…). Some are badge-locked. *This is the chess principle already
  in the game: the rules never change, but who leads does.*
- **Queen's Gifts** (6) — roguelite upgrades bought with royal jelly between years.
- **Badges** (12), **season goals** (reward cadence inside each year), **Daily
  Challenge** (seeded 90-day scenario, streaks, adaptive targets).
- **The keepsakes** — an auto-written **Chronicle** (one page per year, survives every
  colony), a career-deep **Cellar** of jars with rarity/purity/provenance, an **apiary
  rank/saga** (Fledgling → Legendary at ten winters), a lifetime **apiary score**, and a
  **legacy heirloom** jar that carries across colonies.

### The teaching stack

Layered and thoughtful: cinematic intro (Hazel's story), a **7-step founding coach**
(action-first — "Pick up Brood", "Tap the rippling cell"), **five full-screen lessons**
(each three beats: what it is / how it works / *when to pick it*), paced Hazel tips
(deferred fun-facts to year two), a ~20-state context-aware **advisor**, and rotated
grounded bee facts.

### Presentation & juice

Single-file canvas game, PWA/offline, mobile-safe. A **colour-identity system** (one
hue per function via `color-mix`), skeuomorphic press physics, the forage **crossfader
as a DJ mixer**, live per-tile brush yields, seasonal frost creeping from the screen
edges, generative ambient music, synthesized SFX, particle bursts, screen shake,
shareable cards.

**Verdict:** the foundation is excellent and, in places (thermal model, forecast,
queen-line design), genuinely special. The work ahead is not "make it better" — it's
"give it a longer arc and a lighter touch."

---

## 2. The design DNA we're aiming for

The touchstones you named, distilled to one load-bearing principle each — and an honest
read of where HIVEMIND sits against it.

| Touchstone | The principle | HIVEMIND today |
|---|---|---|
| **Universal Paperclips** | The bottleneck *moves*. Every phase makes a different resource the scarce one, and new mechanics recontextualize old ones. | One bottleneck (winter honey) the whole game. Difficulty rises; the *problem* never changes. **Biggest gap.** |
| **Minecraft** | No text. You learn from the physics of the world. Systems are legible *through play*, and the tools compose into things nobody scripted. | Teaches mostly through prose. The sim *could* teach itself (heat view already does) but Hazel does most of the talking. |
| **Tetris** | Trivial rules, perfect information, infinite depth, and a core action that *feels* incredible (lock, clear). One minute to learn, a lifetime to master. | Deep, but the moment-to-moment verb (paint a cell, nudge a slider) is slow and quiet. Where's the "line clear"? |
| **Supercell** | The first session is engineered to guarantee a win + a dopamine hit fast, then unlocks complexity gradually. Every session is short, complete, and leaves a hook. | Strong here — coach guarantees early wins, Daily + streaks pull you back. The *return hook* and *3-minute session shape* could be sharper. |
| **Nintendo / Zelda** | Teach through *designed encounters*, not tutorials. Mario 1-1 teaches every mechanic wordlessly. Introduce → develop → twist → resolve. | Year-names (The Long Frost, Hornet Summer) gesture at this but are difficulty knobs, not taught encounters. Typography/"syntactic highlighting" is already a strength (semantic ink classes). |
| **Chess** | Minimal rules, maximal depth, perfect legibility, no hint arrows. Every loss teaches because it's your fault and you can see why. | Queen lines are beautifully chess-like. But the game sometimes *shows you the answer* — which caps the skill ceiling it's trying to build. |

---

## 3. The core diagnosis

> **HIVEMIND is a gorgeous simulation of a single optimization problem, replayed at
> rising difficulty. Three moves turn it into a game with a years-long mastery arc.**

### Move A — Give the bottleneck somewhere to move (Paperclips)

Right now the optimal-play arc is the same every year: *grow in spring, bank in summer,
seal in autumn, hold in winter.* The forecast even draws it for you. Mastery plateaus
once you internalize that loop, because there's no second loop underneath it.

The fix is not "more numbers." It's **new axes that interact with the honey race and
take turns being the thing that kills you.** Real beekeeping hands us these for free —
see §4. The design test for any new mechanic: *does it change what "the right move" is,
or just how hard the same right move is?* Only ship the former.

### Move B — Let the world teach (Minecraft)

The heat view is the proof this works: toggle it and you *see* cold corners; no
paragraph needed. Every place Hazel currently *explains* a system is a place the sim
could *show* it. Prose should become the fallback, not the default. Concretely: before
a crowd swarms, the bees should visibly beard and roar; chilled brood should visibly
pull nurses into a pile; a rich patch should visibly out-dance a poor one. Teach the
verb by making the consequence impossible to miss.

### Move C — Take the training wheels off on the way up (chess)

The advisor, the ★ recommendation on the mixer, `recForageIdx()`, the forecast
sparkline — these are wonderful for a first-timer and quietly insulting to an expert.
They should **fade as you climb**: full guidance on Easy / year one, then the ★ goes
away, then the forecast blurs to a trend, then on the hardest tier you fly by feel and
the *Chronicle* becomes the only feedback. A game "as well designed as chess" cannot
tell you your move.

---

## 4. Deepen the optimization: real hive science as new axes

You asked for the coolest, truest hive dynamics. The wonderful thing is that the
mechanics that make real beekeeping a lifelong craft are exactly the mechanics that
would give HIVEMIND its moving bottleneck. Each of these is a *new thing to optimize*,
not just a new hazard.

Ranked by leverage (impact on depth ÷ build cost).

### ⭐ 1. Varroa & brood health — *the axis the game is already begging for*

The game's own fact deck says it: *"The real threat to a hive isn't hornets. It's a
pinhead-sized mite called varroa."* We name-drop the most important mechanic in modern
beekeeping and don't model it.

- **What it is.** A mite that rides adult bees and breeds inside *capped brood*,
  spreading deformed-wing virus. Mite load compounds through the season and peaks in
  autumn — exactly when you need healthy winter bees.
- **What it teaches.** A *second* exponential running underneath your population one.
  Now "more brood" isn't free — more capped brood is more mite nursery. The optimizer
  has to weigh growth against infestation.
- **What it recontextualizes.** Brood (now a health liability, not just an asset),
  autumn (the danger window shifts), and the queen (a *brood break* — a pause in laying —
  is a real, free mite treatment, which makes the laying slider a health decision too).
- **Build sketch.** A hidden `miteLoad` that grows with capped-brood-days, damages
  emerging winter bees above a threshold, and can be knocked down by (a) a deliberate
  brood break, (b) hygienic-line queens (see genetics), or (c) a treatment item.
  Surface it as a subtle stipple on capped cells that a "mite lens" reveals — *show,
  don't tell.* This single system probably adds more depth than any other item here.

### ⭐ 2. Queen genetics & breeding — *the long-game investment layer*

Queen lines are currently a per-run *choice*. Real queen breeding is a multi-year
*optimization* — and Paperclips taught us that an investment layer under the core loop
is what turns minutes of play into months.

- **What it teaches.** Compounding returns across colonies. You graft larvae from your
  best survivors, select on traits (honey yield, temperament, mite-resistance/hygienic
  behavior, overwintering), and slowly breed a line that's *yours*.
- **What it recontextualizes.** The Chronicle and roster (already tracking named bees)
  become a *lineage*. Royal jelly — currently an abstract currency — becomes diegetic:
  it's literally what makes a queen, so spending it to raise a better queen makes sense.
- **Build sketch.** Each queen carries a small trait vector; at year-end you may raise a
  daughter that inherits a noisy average of the mother plus whatever the year selected
  for. Ship it as a simple "graft from your best" choice at first; deepen later.

### ⭐ 3. Waggle-dance recruitment & quorum — *make foraging emergent, not a slider*

The bones are already built. There's a live `danceVotes` consensus that eases toward
each patch's true worth and is *drawn* in the meadow (~3071), plus a `'quorum'` tip that
already cites Tom Seeley's *Honeybee Democracy* by name (~3074). The colony already
visibly votes — it just doesn't yet *drive* where the foragers go. Closing that gap is
mostly wiring, not new invention.

- **What it is.** Real foragers dance with intensity proportional to a patch's *net*
  worth and recruit more scouts; the colony's attention converges by positive feedback
  (Seeley, *Honeybee Democracy*). Nobody decides — the swarm does.
- **What it teaches.** Emergent allocation. Instead of *setting* where foragers go, you
  *seed and nudge* a self-organizing decision, and learn to read momentum.
- **What it recontextualizes.** The meadow becomes a live system you influence rather
  than a menu you pick from. Chasing a fading patch has inertia; committing early to a
  far-lush patch pays off later. This makes the meadow view a place you *watch*, not
  just visit.
- **Build sketch.** Ease each patch's vote toward its true `patchEff`; foragers
  distribute across patches by vote share; the player boosts a patch (send scouts) but
  can't teleport the whole force. Keep the current slider as the "how much nectar vs
  pollen" macro on top.

### 4. Products beyond honey — *the diversification phase*

Real hives yield wax, propolis, pollen, royal jelly, and **pollination itself** (the
actual economic engine of modern beekeeping — almonds don't grow without rented hives).

- **What it teaches.** Product mix / opportunity cost. Honey becomes *one* output among
  several, each with a different season and a different colony cost.
- **What it recontextualizes.** The whole autumn "harvest a jar" beat becomes a
  portfolio decision. Pollination contracts turn a strong spring colony into rentable
  income — a reason to grow *beyond* winter need.
- **Build sketch.** Add propolis (an insulation/health resource — ties to varroa and
  winter warmth) first, since it plugs into systems that already exist. Pollination
  contracts are a bigger, later feature but a strong candidate for the "phase 2" that
  moves the bottleneck off pure honey.

### 5. Drones & the reproductive economy — *pure invest-now, pay-later texture*

Drones do no work, eat honey all summer, exist only for genetics, and get evicted before
winter. They're a beautiful little optimization sink: a strong colony *should* raise
some (for breeding/robustness), a struggling one shouldn't. Cheap to add, and pairs
naturally with the genetics layer.

### 6. Disease & comb hygiene — *the maintenance axis*

Nosema, chalkbrood, foulbrood; old comb accumulates pathogens and shrinks cells. Ties
directly to the existing hygiene/undertaker mechanic. Turns "comb" from a monotonic
asset into something you *rotate and maintain* — a slow axis that rewards attention over
years. Lower priority (risk of feeling like chores) but high realism.

### 7. Dearth & nectar-flow timing — *sharpen the calendar*

Real nectar comes in sharp *flows* with *dearths* between (the mid-summer gap is famous).
The bloom curves already exist; carving a real dearth into the summer would make forage
timing a genuine planning problem instead of a smooth ramp. Very cheap — it's a tuning
of existing curves plus one taught encounter.

**How these stack into a moving bottleneck:** Year 1–2, honey is the constraint (as
today). Introduce varroa and suddenly *brood health* in autumn is the thing that kills
you. Add genetics and the meta-optimization becomes *breeding a line that survives with
less babysitting*. Add products/pollination and honey becomes a *choice* rather than the
only goal. Each phase makes a different number the scarce one — which is the whole trick.

---

## 5. Onboarding & feel — "just make sense, feel awesome, not too much text"

You were emphatic about this, and you're right. Here's the specific problem and the
specific fixes.

### The problem, measured

A new player currently passes through **up to six screens before touching anything**:
studio splash → title → a **four-paragraph ecology essay** (`#welcome`, ~150 words) →
intro → queen pick → a ten-beat cinematic. The writing is genuinely lovely. It is also
a *wall* standing exactly where a new player most wants to touch the toy. Minecraft
gives you a verb in second one. We give an essay.

The teaching that follows is also prose-first: lessons, coach, Hazel, and a large body
of `title=` tooltips that **are invisible on touch devices** — where most players are.

### The fixes

1. **Hands before story. Cold-open on one delightful tap.** Before any monologue, drop
   the player straight onto a tiny comb with one rippling cell and a single prompt: *tap
   it.* A bee unfolds her wings with a chime within ~10 seconds. *Then* let Hazel talk,
   and make her opening skippable by default. The story is a reward for the curious, not
   a toll gate. Move the ecology essay to where it belongs — the About page, the
   Chronicle, an optional "Hazel's tale" (which already exists as a replay!).

2. **Every explanatory tip must point at a visible thing.** Audit each Hazel line: if it
   explains a system, there must be a corresponding animation or lens that *shows* it. If
   there isn't, build the visual and cut the words. The heat lens is the template. Add
   lenses for mites, warmth, and forage momentum; let the lens replace the paragraph.

3. **Kill the touch-invisible copy.** Anything currently taught only via `title=` must
   have a tap-target equivalent (you already have `#tipPop`/`#cellSheet` — route
   through them). No lesson should exist only on hover.

4. **Lean into the typographic strengths you already have.** The semantic ink classes
   (`.kb` brood-blue, `.kh` honey-gold, `.kc` nectar-cyan, `.kg` grow-green,
   `.kp` pollen, `.kw` winter) are exactly the "syntactic highlighting" you admire in
   Nintendo's phrasing. Make the mapping *absolute and everywhere*: the same blue means
   brood in the comb, on the brush, in the ledger, and in every sentence. When color is
   this consistent, prose can shrink because the words are pre-parsed by hue.

5. **Find the "line clear."** Tetris feels good because the core action resolves with a
   bang. Name HIVEMIND's satisfying beat and make it frequent and juicy: the **ring
   completion** (comb reaching a centered-hexagonal number, 1·7·19·37…) is the best
   candidate — it's mathematically meaningful *and* visual. Lean all the way into it:
   a ring-snap animation, a chord, a brief golden pulse across the whole nest. Make
   players *chase* the next ring.

6. **Sharpen the session shape (Supercell).** Define the 3-minute loop explicitly — open,
   read the forecast, make 2–3 decisions, watch a season turn, bank a win. The Daily is
   the right return hook; give it a visible streak flame on the title and a one-tap
   "resume yesterday's apiary."

### What NOT to change

The warmth is the brand. Don't sand HIVEMIND into a cold optimizer — the goal is *less
text at the start and more show throughout*, not a personality transplant. Hazel, the
Chronicle, the memorials, the literary tone: keep all of it. Just stop making it
mandatory reading before the fun.

---

## 6. Moment-to-moment "aliveness"

You want it to *feel truly alive and responsive to how it should behave.* The bees
already do lovely emergent things (retinue around the queen, fanning, dancing, winter
cluster breathing, undertaking). The lever is: **every meaningful colony state should
have an unmistakable visible tell,** so the hive reads like a living body reacting to
your hands.

- **Crowding / pre-swarm:** bearding on the comb face, a rising roar in the audio bed,
  agitation — *before* the swarm leaves, so the warning is diegetic, not a toast.
- **Chill:** nurses visibly pile onto cold brood; the cluster contracts.
- **Forage momentum:** more, faster dancers for a rich patch; the meadow view shows the
  colony's attention converging (ties to §4.3).
- **Hunger:** the hum thins; bees slow; the whole scene desaturates slightly as stores
  fall — an ambient dread that arrives before the starvation toast.
- **Health (varroa):** the mite lens shows the load; without it, subtle ragged-wing bees
  start appearing as infestation climbs.

The rule: *if a number is changing, something on screen should be moving because of it.*

---

## 7. Prioritized roadmap

Phased so each stage ships something playable and de-risks the next. Effort is rough
(S/M/L). Nothing here requires abandoning the single-file architecture.

### Phase 0 — Feel & onboarding (ship first; highest ratio of delight to risk)

*No economy changes. Pure presentation and flow. Safe to do immediately.*

- **S** — Cold-open: one-tap comb before any story; story becomes skippable-by-default.
- **S** — Move the ecology essay off the critical path into About / Hazel's tale.
- **S** — Ring-completion "line clear" juice (animation + chord + nest pulse).
- **M** — Touch-parity for every hover-only tooltip; route through `#tipPop`/`#cellSheet`.
- **M** — Aliveness tells: bearding, nurse-pile, hunger desaturation (cosmetic only).
- **S** — Streak flame + one-tap resume on the title (Supercell return hook).

### Phase 1 — The first moving bottleneck (the big one)

*This is what makes it a years-long game. Introduce ONE new interacting axis, done well.*

- **L** — **Varroa & brood health** (§4.1), with a mite lens (show-don't-tell). Autumn
  becomes a health-management problem; brood breaks become a real tool. Gate its
  appearance to year 2+ so year one stays exactly as gentle as it is now.
- **M** — **Dearth** carved into the summer flow (§4.7) + one taught encounter, to make
  forage timing bite.
- **S** — **Mastery ramp:** hide the ★ recommendation, then the forecast detail, as pace
  and year climb (§3C). Make the training wheels visibly come off — it should feel like
  earning your license.

### Phase 2 — The long game (depth for the devoted)

- **L** — **Queen genetics & breeding** (§4.2). Turns the Chronicle into a lineage and
  royal jelly into something diegetic. The multi-year meta-optimization.
- **M** — **Drones** (§4.5) as the invest-now reproductive sink; pairs with genetics.
- **L** — **Products & pollination contracts** (§4.4). Honey becomes one goal among
  several; a strong colony gains a reason to grow past winter need.
- **M** — **Propolis** as an insulation/health resource linking winter warmth and varroa.

### Phase 3 — Systems maturity & endgame

- **M** — **Comb hygiene / disease** (§4.6) as the slow maintenance axis (only if it
  reads as meaningful, not chores).
- **M** — Full **quorum-sensing forage** (§4.3) if the stubbed `danceVotes` proves fun in
  a prototype.
- **S** — Endless/prestige framing: the Legendary saga already exists; give post-ten-year
  play a fresh optimization target (e.g., a breeding masterpiece, a record jar) so the
  ceiling keeps rising.

### Sequencing logic

Phase 0 makes the *first ten minutes* land — which is what converts a curious visitor
into a player. Phase 1 makes the *first ten hours* land — the moving bottleneck that
rewards a returning player with a genuinely new problem. Phase 2+ makes the *first
hundred hours* land. Do them in order; don't start genetics before varroa proves the
"new axis that recontextualizes" pattern works in this codebase.

---

## 8. Risks & architecture notes

- **The economy is fragile and interconnected** (the config header literally warns
  *"validated headless — do not retune casually"*). Every new axis must be validated the
  same way: a headless multi-year simulation checking that year one stays winnable and
  the difficulty curve stays fair. Build/keep that harness — it's the safety net for all
  of Phase 1–3.
- **Single-file is a feature, not a bug** — it's why the game boots instantly, runs
  offline, and has zero supply chain. Don't trade that away. But at ~4,200 lines it's at
  the edge of what one file wants to hold. As Phase 1+ lands, consider a *documented
  internal section map* (the `// =====` banners are already a good start) and possibly a
  build step that concatenates modules into the single artifact — *only if* it never
  costs the zero-dependency, instant-boot property.
- **Don't let "more systems" become "more chrome."** Every new axis needs a lens or a
  tell (§6), not another HUD readout. The screen is already dense (~22 controls). New
  depth should mostly appear *in the comb and the meadow*, not in new panels.
- **Protect the tone.** The single biggest way to ruin this game is to make it feel like
  a spreadsheet. The literary warmth and the conservation heart are the reason people
  will love it for years. Add rigor *underneath* the warmth, never in place of it.

---

*This document is a starting position, not a verdict. The next concrete step is Phase 0
— it's low-risk, high-delight, and it's the part that decides whether a new player ever
reaches the depth we're building. Say the word and we'll start there.*
