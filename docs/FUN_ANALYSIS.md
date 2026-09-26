# Why HIVEMIND isn't fun yet, and how to fix it

*A playtest-driven analysis from 2026-09. `GAME_DESIGN.md` is the long-range design
audit. This document covers the smaller, harder question: **why does a new player
quit?** Every claim below comes from an actual playthrough or a headless run of
the real simulation. The commands to reproduce each one are in the appendix.*

---

## Status: implemented (2026-09)

Every recommendation below has shipped. Here is what changed and what the numbers say now.

| | Before | After |
|---|---|---|
| Zero-input strategy (nectar-pinned dial, flag once, walk away) | **15/15 survive 3 years** | **0/15 survive 2 years**; CI now asserts it |
| Strategy the game teaches (grow in spring, bank in summer, brood breaks) | 0/15 over 3 years (worse than the exploit) | 14–15/15 year one, 7–10/15 over 3 years |
| Seasonal dial vs dial pinned on nectar, 3 years | pinned wins | seasonal 9/15, pinned 0/15 |
| Newcomer who follows Hazel and the ★ | not measured | 14–15/15 survive year one |
| Page load to first real decision | ~45–60 s, 6 screens | **18 s**, 3 story beats, no queen menu |
| Decision prompts in spring | a dance call every ~25 days | a card or dance call every 15–30 s |
| One year at 1× | ~20 min | ~6–7 min (Calm pace keeps the long year) |
| Founding colony on the HUD | "15 bees" | "4,500 bees", rising in +300 hatches |

What went in, by recommendation:

- **#1** `tools/economy-sim.js` plays archetypes and CI asserts the *spread* (the agency contract).
- **#2** Pollen gates laying for real now that growth pays, and the ★ is a year-one aid.
  The economy change underneath is the **winter cluster** (`beeCost`/`clusterF`/`chillLoss`):
  big clusters burn less honey per bee, and small ones chill. Before it the economy was
  scale-free, so small was optimal. `NEC_PF` 4 → 6 lets a strong summer bank a surplus.
- **#3** Bees shown ×300 (`beeN`/`beeK`), with a `+300` floater on each hatch.
- **#4** Hazel's advice matches the sim: a spring nursery bigger than the colony, a
  pollen-starved queen, a too-small winter cluster, and a countdown to the first hatch.
- **#5** Routine deaths fold into one line a fortnight.
- **#6** First-timers skip the queen menu, the studio card plays in full only once, and the
  story is 3 beats (the full tale stays in the menu).
- **#7** One voice: the advisor doesn't echo into the log, and the brush help and wax-bank
  sentence retire once learned.
- **#8** Easy is a ~6-minute year, and a Calm pace keeps the old one.
- **#9** `EVENTS[]`: 11 cards. Frame check, queen cells, main flow, robbing, drones, cold
  snap, mites, spraying, winter wrap, plus two comeback cards for weak colonies (a stray
  swarm, spring syrup).
- **#10** Hatch waves (a golden sweep when a cohort emerges together) and wax-capping puffs.
- **#11** The frame check: a 10-second mini-game to find the queen, tap the mites and cut
  the queen cells.
- **#12** A death card naming the cause and one thing to try, plus a one-time
  "rewind to autumn".
- **#13** `QUESTS[]`: three small goals per season, paying ✧.
- **#14** The meadow gets its own readable unit, bigger blooms and denser forager streams.
- **#15** The Daily is a fixed 3-minute session.
- **#16** Field notes: 17 to collect, one per event plus the sim's big moments.
- **#17** The apiary: splits and each surviving year add a hive to the hillside.
- **#18** The mastery ramp: from year three the forecast stops naming the exact day.

### Round 3: approachable from the first tap (2026-09)

A bot that played the founding tutorial **exactly as instructed** found the worst traps yet:

- **The clock ran during the tutorial.** A player reading at their own pace reached day ~90
  inside the coach, with the founding colony down from 15 to ~1.5 bees. The coach now holds
  the calendar.
- **Finishing the tutorial broke the comb.** It teaches one cell per craft and left 15 of 16
  founding cells unzoned, and stores only fit on Honey shelves, so the pantry drained away the
  moment it ended. Now the rest of the comb is zoned the way "skip" already did.
- **An inert Next button** if a brush was picked before it was asked for.

Then the changes that make the first year teach itself:

- **Expand now means grow.** In spring, while the nursery is smaller than the colony needs,
  every other new cell moves the queen into the nearest shelf. A newcomer who only ever taps
  Expand now sees the founding year (15/15 on the CI seed) but usually not the next (4/15):
  a learning curve, not a cliff. Both are new CI contract lines.
- **Pollen is priced like the real thing.** Brood eats 0.5 pollen/larva-day (was 0.2). Real
  colonies use pollen on the same order as honey, and at 0.2 a nectar-pinned dial could still
  feed a nursery indefinitely.
- **One clear next job.** A first colony's first spring is taught as a sequence of quests
  (build comb → a 14-cradle nursery → send foragers → hatch 3,000), each announced once, with
  its control pulsing. Tapping any quest chip says how.
- **Lessons are offered, not forced**: a line from Hazel and a dot on `?`, instead of five
  full-screen interruptions in the first minutes.
- **Consequences you can see.** Active event effects sit in the HUD as chips with countdowns;
  every choice and every dial move floats its change to the winter forecast; the dial ends in
  a live "❄ winter covered / dry" verdict.
- **The one-more-year pull.** Year-end shows three stars with plain criteria (surviving always
  earns one, where the old letter grade gave most survivors a D) and a teaser: next year's
  threat, ✧ toward the next gift, the next rank, field notes found.

| Contract (CI seed) | Round 2 | Round 3 |
|---|---|---|
| Expand-only newcomer, year 1 | not measured | 15/15 |
| Expand-only newcomer, year 2 | not measured | 4/15 |
| Skilled, 3 years | 8/15 | 10/15 |
| Nectar exploit, 2 years | 0/15 | 0/15 |

Multi-year lines swing with the weather roll (across seeds 1–2: expand-only year 2 ranges
4–13/15, skilled 3-year 4–10/15), so read them as a regression guard, not a promise.

### Round 4: what the best games teach, applied to a first colony and a party (2026-09)

We asked what the games people can't put down do in their **first ten minutes** and in
**co-op**, and took only what fits a cozy, educational game with no ads and no timers.

| Game | What it does | What we took |
|---|---|---|
| **Tetris** | One verb, one goal, readable with zero text. It gets harder as you get better. | Every control must explain itself the moment it appears. The comb brush stays the only verb in the first minute. |
| **Minecraft** | No tutorial wall. Survive the first night is the goal nobody has to state. | Winter is our first night. It was already the frame; the stars and hook from round 3 keep it. |
| **Hay Day** | The first minutes are one guided crop cycle. Features (the shop, the truck, the boat) **unlock by level, one at a time, each with its own small fanfare**, just when they become useful. Neighbours **ask for help** and helping earns rewards. | The tray arrives a control at a time. A 🙋 help flare lets keepers help each other on purpose. |
| **Clash Royale / Brawl Stars** | The first match *is* the tutorial. **Emotes** let strangers and kids be social without a chat box. | One-tap reactions on every screen. We deliberately added no free-text chat, because Family mode has kids in it. |
| **Clash of Clans** | Clan donations: asking for troops makes your friends useful, and giving is how you're recognised. | The help flare pays the helper 🌾 Good-Neighbor merit, not the asker. |
| **Among Us / Jackbox** | Time stops for a meeting, and everyone argues out loud, then votes. | The event deck in a party becomes a **hive meeting**. |

**What we did not take:** energy, timers, waits you pay to skip, daily-login streaks and
leaderboards. They drive retention by pressure, not by fun, and a leaderboard would turn the
party's Stag Hunt back into a race (see `MULTIPLAYER.md`).

**Onboarding: the tray arrives one control at a time.** After the coach, a first colony
still saw every button at once, including Fast, both lenses and the report. They were
buried under a wall of chips a player didn't need yet. The `DISCOVER` table (the existing
reveal system) now also holds those four controls:

- **Fast-forward** arrives when the first quest (draw comb) is done.
- **ⓘ** arrives in late spring, and the **heat lens** at the start of summer.
- **The report** comes in summer, when the forecast starts to matter.

Each arrives lit, with one line on what it's for. A second colony, a daily or a party sees
the whole tray.

**Multiplayer: the party gets the best part of solo.** Round 2's event deck, the decisions
that make a year a story, was solo-only. Parties had orders and votes about patches and
jars, but no dilemmas.

- **Hive meetings.** Every ~2–3 minutes of party play, the Queen's device deals an event
  card to every screen as a vote. The two buttons *are* the card's two options, with their
  costs, and it has 35 s on the clock. The majority picks, and a tie takes the second,
  steadier option, so a meeting always decides something. The choice plays out on the
  host exactly as in solo, the winter-forecast change is announced to everyone, and
  **every keeper files the field note in their own career**. Learning in a party counts.
  Cards that need a solo mini-game (the frame check) or ✧ the hive can't afford stay out.
- **Reactions.** 👏 😂 😱 💛 on a slim right-edge rail float on every screen, with your
  name in your colour, even over a vote card. That's where "😱" is funniest.
- **🙋 Ask for a hand.** For 40 s the other keepers may paint your wedge, which pulses on
  every comb. Every cell they tend there is 🌾 aid merit for *them*. Before this, the
  wedges that make mixed-skill groups safe also meant that a struggling friend couldn't
  be helped until they left the game. Now helping is one tap away, and it is the
  merit-dominant move, as the Stag Hunt design wants.

A new spring card, **the dandelions are out** (pollen for the nursery, or early nectar?),
gives a party its first meeting about 50 s in. Before, no party-eligible card was ready
until day ~55. Solo sees it from the second colony on; a first colony's first spring stays
with the guided quests.

`tools/mp-lobby-smoke.js` now plays a meeting, a reaction and a help flare across three
browsers. `tools/mp-smoke.js`'s paint-replication check had been red on main: it tapped a
cell hidden under the HUD pane. It now picks a cell the canvas can actually hear, and it
passes.

The analysis below is kept as written, since it's the reasoning behind the changes.

---

## TL;DR

HIVEMIND is beautiful, scientifically honest and warm, and in its current shape it
is **a screensaver with a quiz at the end.** Five problems cause most of that:

1. **Your decisions don't matter much.** The game's own sim says a player who drags
   the forage dial to "nectar", taps every edge cell once on day 0 and **never touches
   the game again** survives three straight years in all 15 queen and gift scenarios.
   That beats the "attentive player" autopilot CI uses. A game with a zero-input
   winning strategy is solved, and a solved game isn't fun.
2. **Nothing visibly happens for minutes at a time.** In a real 9-minute playthrough
   at 3× speed, the comb at **spring day 76 and autumn day 206 looked almost
   identical**: 7 bees, 8 honey, the same ~19 cells. A full year runs ~10 minutes at 3×
   and ~20 minutes at 1×, and it has very few visible state changes.
3. **Cause and effect are 20 or more game-days apart.** A brood cell pays off three
   weeks later, honey ripens over weeks, and the verdict (a letter grade) arrives only
   at the end of the year. The player can't link *what I did* to *what happened*.
4. **The feedback is mostly sad or contradictory.** Named obituaries scroll by in
   spring even when you play well. Hazel repeated *"the nursery is small, paint more
   Brood"* all year while the build rule refused new comb because *"the colony is too
   small"*. You get stuck in a trap and the game tells you to do two opposite things.
5. **Too much reading before any doing, and too much reading during.** It takes ~45 s and
   six screens before the first real decision. After that, up to eight text surfaces
   compete at once: the living log, Hazel, wax-bank line, brush help, dial caption,
   season goal, stat tips and lessons.

The fix isn't more content. It is **tempo, consequence and visibility**:

> **Every 30 seconds a decision. Every 3 minutes a payoff. Every year a story.**

The rest of this document gives the evidence, the diagnosis and a prioritized list of
changes that fit the single-file architecture.

---

## 1. How this was measured

- **Live playtest.** Fresh profile, 1280×800, headless Chromium driving the shipped
  `index.html`: studio splash, cold open, title, queen pick, story, coach skipped, a
  sensible opening paint (a 7-cell brood core, a 12-cell honey ring, 12 expand
  flags), then 3× speed with overlays auto-dismissed. Screenshots every ~30 s and a
  state sample (`window.__hm()`) every 5 s.
- **Sim experiments.** `tools/economy-sim.js` runs the *real* `stepDay()` in a VM.
  I swapped its autopilot for four player archetypes and swept the forage dial.
  Nothing in the shipped game was modified.

## 2. The evidence

### 2.1 Decisions barely matter (the solved-game problem)

Survival across all 15 scenarios (7 queens + 7 gifts + baseline, fixed seed):

| Player archetype | Forage dial | Year 1 | 3 years |
|---|---|---|---|
| Does nothing at all | 0.6 (default) | 0/15, dies ~day 320 | 0/15 |
| Flags every edge cell **once**, day 0 | 0.6 | **15/15** | 2/15 |
| CI autopilot (4 flags every 14 days) | 0.6 | 15/15 | 0/15 |
| Flags every edge cell every 3 days | 0.6 | – | 1/15 |
| Flags once, day 0 | 0.1 (pollen) | 0/15 | – |
| **Flags once, day 0, then walks away** | **0.95 (nectar)** | **15/15, 3× the stores** | **15/15** |
| CI autopilot | 0.95 | – | 14/15 |

Two conclusions:

- **The forage dial has one correct setting, and it's an extreme.** Nectar-heavy
  beats "a steady mix" in every scenario and every year. Pollen, which the story and
  lessons spend real effort explaining, has no winning use. The ★ recommendation and
  Hazel's "lean to honey" tip give the answer away.
- **Doing more makes things worse.** Flagging aggressively (every 3 days) does no
  better than flagging once, and the diligent CI autopilot does *worse* over three
  years than the one-tap player. Attention isn't rewarded, so the player learns to
  stop paying it.

### 2.2 Tempo: long stretches where nothing changes

| Moment | Real time (fresh player) |
|---|---|
| Page load to first tap possible (studio splash + title splash) | **~11 s** |
| First tap to first real decision (cold open, title, queen pick among 7, 10-beat story, 3 framing beats, coach) | **~35–60 s** |
| One in-game day at 1× on Easy | 3.4 s |
| One full year at 1× / 3× | **~20 min / ~10 min** |
| Visible change to the comb between day 76 and day 206 (3× speed, ~4.5 real minutes) | **almost none** |

The live colony went 15 → 7 bees in the first 50 days and stayed at 6–8 all year.
The "Grow the colony to 30 bees" goal stalled at 7/30 and the year ended with a
**D**. The HUD numbers are single digits ("BEES 7"), while the story promised
*forty thousand bees*.

### 2.3 The stagnation trap (a concrete bug-like loop)

- `buildFromFlags` refuses new comb when `builtN >= P*2.4+14`
  (`index.html`, "The colony is too small to tend more comb — grow the brood nest
  first"). At P≈7 the cap is ~31 cells, and the player's opening paint already
  reaches it.
- The advisor fires *"The nursery is small… paint more comb as Brood"* whenever
  `broodCells() < max(6, P*0.45)`.
- The player can't grow the nest without comb and can't get comb without a bigger
  nest. The founding cohort dies (summer lifespan 35 days) before the first brood
  replaces it. That's realistic (package colonies dwindle), but nothing on screen
  explains it, and every named death arrives as a gentle obituary card. Playing
  correctly *feels* like failing.

### 2.4 Text load

- 87 `toast()` call sites, 20 `tip()` sites, 16 direct `logMsg()` sites, plus
  `LESSONS{}`, `COACH[]`, the story and year-end prose.
- During ordinary play, a single screenshot showed **eight concurrent text
  surfaces**: the living log, Hazel's advisor bubble, the wax-bank line, the brush-help
  line, the dial caption, the season goal, stat sub-labels and a teaching confirm. The bottom tray takes
  ~35% of a 16:10 screen. In the meadow, flowers render only a few pixels tall under
  a large empty sky.

## 3. Diagnosis: why it isn't fun

Each problem is stated as the principle it breaks.

### D1 · No meaningful choice (Sid Meier: "a series of interesting decisions")
A choice is interesting only if the options carry different, legible trade-offs.
Today the forage dial is a knob with one right answer, the brushes are set once at
founding, and expansion is "tap everything". **Once the player finds the right
setting, the game has nothing left to ask them.**

### D2 · Low rate of visible change (the "is anything happening?" problem)
Engagement follows how often the screen tells you something new. The sim is rich,
but its interesting changes (a thermal gradient, a slowly dropping mite load, a honey
cell ripening 2%) are invisible at a glance. The screen can look the same for
minutes, and the player's attention goes elsewhere.

### D3 · Delayed, diffuse feedback (the learning-loop problem)
Fun is largely *learning a system*. Learning needs a tight loop: act, see the result,
adjust. HIVEMIND's loop is *act, wait 20 days, see a blend of five causes, get a
grade at year end*. The year-end review is the first clear feedback, and it arrives
~15 minutes after the decisions it grades.

### D4 · Punishment without drama (the "sad slide" problem)
Losing is fine when it's dramatic, readable and your own fault. Here, loss is
a slow ambient drip of obituaries. There is no moment where the player *almost* lost
and pulled it back. Tension needs a spike, and a slow slide never produces one.

### D5 · Tiny, abstract stakes
"7 bees" doesn't feel like a superorganism. The model's unit (a cohort) is right for
the sim and wrong for the HUD. Kids and adults both respond to big, climbing numbers.

### D6 · Front-loaded ceremony, then under-loaded play
The first minute is all ceremony: a studio logo, two title screens, seven queens, ten
story beats and three framing beats. Minutes 2–20 are nearly idle. This is backwards.
Minute one should be all play, and the story should come through the play.

### D7 · Passive verbs
The only verb with *skill* in it is tapping a hornet. Painting a zone is a label, and
the bees do the work later and off-screen. Nothing in moment-to-moment play has
**timing, aim or risk**, so there's nothing to get *good* at by hand.

### What is genuinely great (protect it)
The thermal-diffusion nest, the forward forecast, the waggle-dance quorum, queen
lines, the Chronicle and Cellar, Hazel's voice, the one-tap cold open, the ring-
completion fanfare, Family mode, and Play Together. The raw material for a great game
is here. The **shape** and **tempo** are what's wrong.

---

## 4. How to make it fun: prioritized changes

Design pillars for every change below:

1. **Every 30 s: a decision** that has a visible trade-off.
2. **Every 3 min: a payoff** such as a hatch wave, a ring, a jar or a season goal.
3. **Every year: a story** made of named events you *caused*.
4. **Show, don't tell.** If a number changes, something on screen moves.

### P0: quick wins (days, low risk, mostly presentation or tuning)

| # | Change | Why | Where |
|---|---|---|---|
| 1 | **Add a "decisions must matter" guard to CI.** Put a *passive* scenario (flag once, dial fixed) in `tools/economy-sim.js` that must **fail** by year 2, and a *skilled* scenario that must pass. Track the survival *spread* between archetypes as a KPI. | You can't balance for agency you don't measure. Today CI only proves the game is winnable, never that it's *losable by neglect*. | `tools/economy-sim.js` (`autopilot`, `runScenario`) |
| 2 | **Make pollen matter.** Brood laying should be gated by pollen stores (no pollen, no new eggs, and the queen visibly idles). Pollen should be the scarce resource in spring and nectar in summer and autumn, so the right dial setting **changes by season**. Remove the static ★ once the player has used the dial twice. | Turns the dial from a knob with one answer into a seasonal decision. It also teaches the real biology the story already tells. | `stepDay` laying term, `recForageIdx()`, dial caption |
| 3 | **Show bees ×1,000.** Display `P` as "7,000 bees", then "15,000 bees", with a rolling counter and `+120` floaters on hatch. The sim stays the same. | Big climbing numbers feel like growth and match the "forty thousand" story. | `syncHUD`/`setN`, the one stat formatter |
| 4 | **Break the stagnation trap.** Align the build cap with the advisor (never tell the player to paint brood when the cap is binding), and show a **"first hatch in N days"** countdown on capped brood during the founding dwindle, e.g. *"The old bees are tired — your first daughters hatch in 6 days. Hold on."* | Turns the realistic dwindle into anticipation instead of confusion. | `buildFromFlags` (`buildStall='small'`), advisor rule at `broodCells()<max(6,P*0.45)` |
| 5 | **Replace the obituary drip with a tally.** Keep named memorials for notable bees only (queen, first-born, hornet victims). Show routine deaths as a quiet "−3 old foragers" tick. | Removes the feeling that you're failing while playing correctly. | `logMsg('🕯️'…)` in the undertaker path |
| 6 | **Shorten the front door.** Show the studio splash at most once and make it skippable. Auto-crown Queen Meadow on the first run and unlock the choice on colony 2. Cut the story from 10 beats to 3 and deliver the rest as in-play Hazel lines when each mechanic first happens. | First decision in under 15 s instead of ~45 s. | `STORY[]`, `renderQueens`, splash |
| 7 | **One text voice at a time.** Keep one channel open during play (Hazel *or* the living log). Collapse the brush-help and dial-caption lines once each has been used, and hide the wax-bank sentence once the pips have been seen filling. | Reading load down, eyes back on the comb. | `syncBrushHelp`, `syncWaxBank`, `pushFeed` |

### P1: fix the core loop (1–3 weeks, the part that changes how it *feels*)

| # | Change | Details |
|---|---|---|
| 8 | **Shorter years.** Default to a ~6-minute year at 1× (~1 s per day, with winter auto-compressed further). Keep the long, calm year as a "Zen/Slow" pace. | 20 minutes is too long between the start and the verdict. A 6-minute year gives three full runs in a lunch break, and roguelites live on run count. |
| 9 | **A hive-event deck: the decision every 30–60 s.** Generalize the scouts' dance call (`openDanceCall`) into a data table `EVENTS[]` (add a row, not a branch). Each event is one real beekeeping moment with two honest options and a visible consequence. See the examples below. | This is the single biggest change. Each event is interesting, educational and short. |
| 10 | **Make every hatch, cap and fill visible.** Add a hatch "pop" with a bee crawling out of the cell, a wax cap sliding over ripe honey, and honey rising inside the cell. The whole nest should pulse on a **hatch wave**, and the ring-completion fanfare should fire more often by counting rings of *any* zone. | Satisfies pillar 4: the screen changes every few seconds because the sim does. |
| 11 | **Give one verb real skill: the frame inspection.** Once per season, lift a frame (full-screen comb close-up). You have ~10 s to **spot the queen**, **count mites** (tap the red specks) and **find queen cells** (the swarm warning). Faster and more accurate spotting reduces mite load and gives swarm warning. | Timing and aim, taught through play. It is exactly what real keepers do, so it teaches as it tests. |
| 12 | **Readable failure with a rewind.** On colony death, show a **cause-of-death card** with the one graph that explains it and the one thing to try, e.g. *"Starved day 318 — 6 cells short. Your dial sat on 'mix' through the summer flow."* Offer **"Rewind to autumn"** as well as "New colony". | Losing teaches instead of ending the session. It also makes the harder years tolerable. |
| 13 | **Many small goals, not one big one.** Chain 3 visible micro-goals per season, e.g. *hatch 10 bees; fill 5 honey cells before day 60; beat the hornet without losses*. Each pays a small instant reward: royal jelly, a jar label, a flower for the meadow. | Short-term goals keep you going through the long year-long goal. The season-goal system already exists, so this is more rows. |
| 14 | **A meadow worth looking at.** Draw flowers 3–5× bigger and let patches visibly bloom and fade. Show forager streams flying to the active patch, with thicker streams for richer patches, so the waggle-dance decision is *seen*. | The meadow is currently empty sky over a thin grass strip. It should be the prettiest screen in the game. |

**Example `EVENTS[]` rows** (every option is real practice, and each teaches one fact):

| Event | Option A | Option B | Teaches |
|---|---|---|---|
| **Queen cells found!** (swarm pressure high) | *Split the colony*: lose half the bees now and gain a second hive next year | *Add room*: costs honey, and the swarm risk may remain | Why colonies swarm |
| **Robbers at the entrance** (late-summer dearth) | *Narrow the entrance*: less forage, safe stores | *Leave it*: risk losing ~10% of stores | Robbing in dearth |
| **Main flow starts!** (big bloom) | *All foragers on nectar* | *Keep raising brood* for autumn | Timing the flow |
| **Cold snap tonight** | *Cluster*: brood on the edges may chill | *Keep the brood warm*: burn extra honey | Thermoregulation |
| **Mite count rising** (year 2+) | *Brood break*: queen rests 2 weeks | *Treat*: costs jelly, no brood loss | Varroa and brood breaks |
| **Drone season** | *Raise drones*: honey cost, genetics bonus | *Skip*: save honey | The reproductive economy |

### P2: make it come back (retention and identity)

| # | Change | Details |
|---|---|---|
| 15 | **Daily Challenge as a 3-minute puzzle.** A fixed seed, one season, one target and a share card. It already exists, so shorten it and put the streak flame on the title. | The session shape that brings people back each day. |
| 16 | **Field Notes, a bee-dex.** Each mechanic you *experience* unlocks a one-card fact with a tiny animation: first swarm, first hornet, first waggle dance, first winter cluster. Track the collection as "32 / 48 field notes". | Turns the educational layer into a collection, so learning becomes the reward. |
| 17 | **Your apiary as a place.** Surviving colonies (and splits from event #9) sit on the hillside as extra hive boxes, so the saga becomes something visible instead of a rank name. | Identity and pride of ownership. |
| 18 | **Mastery ramp.** Hints fade as you climb: ★ gone in year 2, forecast blurred in year 3 (already planned in `GAME_DESIGN.md` §3C). | Keeps the skill ceiling honest. |

---

## 5. How to know it worked

No analytics (a deliberate privacy choice), so measure with the sim and playtests:

- **Agency spread** (new CI KPI): the survival and store gap between the *passive*,
  *default* and *skilled* archetypes in `economy-sim.js`. Target: passive dies in
  year 1–2, skilled survives 3+ years, and the gap in stores is at least 2×.
- **Decisions per minute** (headless count of events plus dial and brush changes
  that the sim rewards): target ≥ 2/min during spring and summer.
- **Time to first decision:** target ≤ 15 s on a first visit.
- **Visible-change rate:** in a headless 3× run, screenshots 10 s apart should differ
  meaningfully (e.g. a >2% pixel diff on the comb region). Today day 76 and day 206
  are near-identical.
- **Five-person hallway test:** after one session, can each player name one thing they
  decided and what it caused? Today, most won't be able to.

## 6. Suggested order of work

1. **Week 1:** P0 #1–#7. They're cheap, mostly presentation, and #1 sets the guard
   rail for everything after.
2. **Weeks 2–3:** #8 (shorter year) and #9 (event deck with 6 rows), then playtest.
   This is where it starts to *feel* like a game.
3. **Week 4:** #10 (visible hatch and cap), #12 (readable failure and rewind), #13
   (micro-goals).
4. **Then:** #11 (frame inspection), #14 (meadow), and P2.

Every economy change goes through `node tools/economy-sim.js --years=3 --verbose`
before and after, per `CLAUDE.md`.

---

## Appendix: reproduce the sim findings

`tools/economy-sim.js` with its `autopilot()` replaced (a scratch copy, not committed):

```js
// MODE=none   → return immediately (never touch the game)
// MODE=once   → on day 0 only, flag every unbuilt cell adjacent to built comb
// MODE=greedy → same, every 3 days
// FORAGE=x    → replaces the hard-coded G.forage = 0.6 at founding
```

```
MODE=once FORAGE=0.95 node esim.js --years=3   # 15/15 survive: the zero-input strategy
MODE=once FORAGE=0.6  node esim.js --years=3   #  2/15
MODE=none             node esim.js --years=1   #  0/15
```

The seed is the harness's fixed default (`0x5eed1e`). Probe with `--seed=random`
before trusting any single margin.
