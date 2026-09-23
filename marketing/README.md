# HIVEMIND trailer

A 72-second trailer in two cuts:

- `hivemind-trailer-1920x1080.mp4`: 16:9 for YouTube, the website and store pages
- `hivemind-trailer-1080x1920.mp4`: 9:16 for TikTok, Reels and Shorts

**All gameplay in it is real.** The clips were captured from the shipped
`index.html`. The motion graphics, titles and soundtrack are generated in code
by the files in this folder, with no stock assets and no external services.

## What it says, and why

The trailer is built to answer the three questions a scrolling viewer has:
*why should I play, what will I learn or do, and why does it matter?* It opens
with a hook in the first two seconds and puts a decision or payoff on screen
roughly every two seconds after that. Every cut lands on a 120 bpm beat grid.

| Time | Beat | On screen |
|---|---|---|
| 0–4 s | **Hook: the stakes** | "1 in 3 bites of the food you eat depends on pollinators like bees." |
| 4–8 s | **The question** | The real cold open: one cell, one tap, a bee wakes. "Could YOU keep a colony alive? 40,000 bees. One year. Winter is coming." |
| 8–14 s | **Drop: the verb** | HIVEMIND logo slam, then real brush strokes: *Brood = nursery, Honey = pantry, Expand = fresh wax.* |
| 14–18 s | **Payoff** | The colony comes alive at 3×, then **RING COMPLETE!** |
| 18–22 s | **Strategy** | The meadow ("near flowers fly cheap"), then the scouts' waggle-dance vote. |
| 22–28 s | **Threats** | Beat-synced smash cuts: Hornets, Cold snaps, Summer drought, Swarms, Mites. |
| 28–32 s | **Tension** | "Then… winter." Day counter climbing, honey counter falling. "Did you store enough honey?" |
| 32–36 s | **Win** | YEAR 1 SURVIVED! "Now it gets harder. Year 2 brings varroa mites." |
| 36–48 s | **What you'll learn** | Five "field notes", each one a mechanic in the game: bees shiver to heat the hive; a waggle dance is a map; one queen lays 1,500 eggs a day; one bee makes 1/12 tsp of honey in her life; varroa is the real enemy. |
| 48–56 s | **What you'll achieve** | Survive your first winter, unlock 7 queen lines, earn 7 Queen's Gifts, fill a cellar of rare honey, collect 12 badges, reach LEGENDARY (ten winters). |
| 56–62 s | **Why it matters** | "Honeybees have keepers. The wild bees don't." Plant the flowers that feed them all. |
| 62–66 s | **Social** | Play solo or with 2–8 friends in one hive; Family mode; hive votes. |
| 66–72 s | **Call to action** | HIVEMIND · "Can you keep them alive?" · hive-mind-game.com · Free, no ads, no download. |

**Fact check:** every claim matches the game's own content or its terms. The
facts come from `FACTS[]` and `STORY[]` in `index.html`, the counts from
`QUEENS`, `GIFTS`, `BADGES` and `RANKS`, and "free, no ads" from `terms.html`.
The "1 in 3 bites" line is the widely cited pollinator-dependence figure, and
it is worded as "depends on pollinators", not "is made by bees". Update the
counts if the tables grow.

## Rebuilding it

Everything here is dev-only tooling. None of it is shipped or loaded by the game.

```sh
npm i --no-save playwright-core
# 1. capture real gameplay into marketing/clips/ (about 3 minutes, git-ignored)
CHROMIUM=/path/to/chromium node marketing/capture-gameplay.js
# 2. render both cuts (needs ffmpeg with libx264 on PATH, or set FFMPEG=...)
node marketing/render-trailer.js --w=1920 --h=1080 --out=marketing/hivemind-trailer-1920x1080.mp4
node marketing/render-trailer.js --w=1080 --h=1920 --out=marketing/hivemind-trailer-1080x1920.mp4
```

- `capture-gameplay.js` drives the real game in headless Chromium and records
  CDP screencast frames. It serves a capture-only copy of `index.html` with a
  `window.__cap` handle spliced in, so it can stage the hornet, the calendar
  jump and the dance call on cue. The committed `index.html` is never touched.
- `trailer.html` is the whole edit: a deterministic canvas page where
  `TRAILER.renderAt(t)` paints the frame at time *t*. Open it in a browser
  (served from this folder, next to `clips/`) for a live preview. Add `?w=1080&h=1920` for
  the vertical layout. Scene timings and the sound cues (`CUES`) live together, so
  retiming a scene moves its sound effects with it.
- `render-trailer.js` steps every frame at 30 fps, synthesizes the soundtrack
  (an F-major I–V–vi–IV groove at 120 bpm plus the cue sound effects), and muxes
  both to H.264/AAC.
- `fonts/`: Bricolage Grotesque and JetBrains Mono (SIL Open Font License),
  the game's own typefaces, bundled so renders don't depend on the network.
