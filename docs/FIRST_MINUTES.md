# The first minutes: what the classics already discovered

*How the most sticky games open, what each one proved, and where HIVEMIND now does the
same thing. Read this before changing anything a new player sees in their first five
minutes. docs/ONBOARDING.md has the older history. CLAUDE.md has the word-budget rules.*

## What they trailblazed

| Game | The opening | What it proved |
|---|---|---|
| **Super Mario Bros., World 1-1** | You press start and you are playing. The first Goomba walks at you on flat, safe ground, so you discover jump yourself. Jumping over it tends to bump a ? block, which teaches where power-ups come from. There is no tutorial text. | The level teaches, not a lesson. The first threat is built to be beaten. The first reward arrives by accident within seconds. ([Wikipedia: World 1-1](https://en.wikipedia.org/wiki/World_1-1); [Miyamoto on 1-1](https://blog.adafruit.com/2025/09/14/miyamoto-explains-how-super-mario-bros-world-1-1-was-created/)) |
| **Tetris** | A piece is already falling. There is one rule, and every placement leaves the stack slightly unfinished. | The Zeigarnik effect: an open task nags you back ("one more"). There is zero setup before the first input, and the next reward is always unpredictable. ([Pacific Standard](https://psmag.com/social-justice/theres-name-zeigarnik-effect-65365/)) |
| **Minecraft** | You stand in a world. The first verb (punch a tree) is also the first resource, and the recipes are discovered, not explained. The first night gives the day a purpose. | A single clock-driven threat turns a sandbox into a goal. Knowledge is on tap (the recipe book), not pushed. ([minecraft.net: first night](https://www.minecraft.net/en-us/article/how-survive-your-first-night-minecraft)) |
| **Hay Day (Supercell)** | You plant and harvest your first crop inside the tutorial, dragging a finger across the field. Coins and XP stars fly to their counters, and a level-up fanfare comes within the first minutes. | The core verb must feel good in the hand, and a drag should beat a tap. Rewards should travel to where they are kept. The first "harvest" happens before the player can get bored. ([Wikipedia: Hay Day](https://en.wikipedia.org/wiki/Hay_Day)) |
| **Clash Royale (Supercell)** | You are in a real, winnable battle in seconds, with almost no text or coach marks. It ends in a chest that opens immediately. Right after, you see progress toward the next chest (1/10 crowns). | Teach inside the real game, not a fake one. End the first session on a win plus visible progress toward the next reward. ([Training Camp](https://clashroyale.fandom.com/wiki/Training_Camp); [Chests](https://clashroyale.fandom.com/wiki/Chests)) |
| **Industry FTUE data** | The top casual games put a meaningful action in the first seconds and keep tutorials to about 30 s. Median day-1 retention is about 22%. | Every screen before the first real action costs players. Show, don't tell. An early achievement with visible progress in session one is worth several points of D1. ([Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/first-time-user-experience); [Playio](https://blog.playio.co/mobile-game-onboarding-retention)) |

## The checklist, and where HIVEMIND stands

1. **Playing within seconds of "start"** (Mario, Clash, Brawl Stars).
   - *Before:* a first visit went through the studio sting, a "tap to begin" wordmark, the
     cold open, a title card, three story pages, and then the hive. That is five taps before
     the first comb cell.
   - *Now:* the studio sting, then the cold open (tap the cell: a bee hatches), then **Begin**
     goes straight into the hive. The wordmark steps aside when the cold open is waiting, and
     the first visit skips the title and the story, because the cold open *is* the story.
     Returning visits keep the title, the modes and the story.
2. **The first input is the core verb, and it pays at once** (Mario's ? block, Minecraft's
   tree). The cold-open tap hatches a bee. The first comb tap ends on a recipe card
   (🥚 → 🐝) and +1 ✧.
3. **Teach by pointing, not paragraphs** (Mario, Clash). A ghost hand shows each step, and
   labels are one to three words (see CLAUDE.md, "the word budget").
4. **The first harvest inside the tutorial** (Hay Day). The founding comb carries capped brood
   timed to hatch during the tutorial. A colony's **first bee** is now an event: a burst,
   "🐝 first bee!", a chime and a success haptic, and she flies up to the Bees counter.
5. **Rewards fly to their counters** (Hay Day coins, Clash chests). `flyTo()` arcs the earned
   icon from where it was earned to the counter that keeps it, and the counter bumps.
   - Hatchlings fly to 🐝 Bees, at most one every ~2 s.
   - A paying quest sends ✧ to Keeper.
6. **The core verb feels good in the hand** (Hay Day's swipe, Tetris's line clear). A drag
   across the comb climbs a note per cell, and the haptic firms up as the stroke grows. A
   stroke of five or more cells lands a "×N" flourish with a burst and a chime. It is pure
   feedback, and the economy never sees it.
7. **The first threat is built to be beaten** (the first Goomba). The first hornet raid a
   keeper meets comes with the ghost hand following the hornet, showing the tap. Family
   mode's hornet is already gentler.
8. **One clock-driven purpose** (Minecraft's first night). Winter is the night: the season
   bar and the "❄ ✓ / ✗" forecast on the forager slider keep it in view, and Hazel's advice
   points at the one control that answers it.
9. **Always one unfinished task** (Tetris). Three quest chips are always open, the next
   one's control is pointed at, and a finished chip is replaced at once.
10. **End the session on a win and a visible next reward** (Clash's 1/10 crowns). The
    year-end card shows the stars earned, then chips for what is next: ✧ toward a Queen's
    Gift, the next rank, and field notes.

## Measured (phone, 390×844, a bot doing only what the hand shows)

| | Before | Now |
|---|---|---|
| Screens before the hive | 6 (sting, wordmark, cold open, title, story, hive) | 3 (sting, cold open, hive) |
| Taps before the first comb cell | 9 | 4 |
| Seconds to the first comb cell | 11.8 | ~7 |
| First reward, first bee | 11.8 s | ~7 s |

The bot never pauses to read, so a real newcomer saves far more than 5 s: three screens they
used to read are simply gone.

## How to check it

`tools/first-minute.js` plays a brand-new keeper on a phone-sized screen and reports:
- the screens and taps before the first comb cell;
- the seconds to the first comb cell, the first reward and the first bee;
- the visible words on the way.

Run it after any change to the front door:

```sh
NODE_PATH=/path/to/node_modules node tools/first-minute.js
```

(It needs `playwright-core` and Chromium, like the other dev tools; nothing ships.)
