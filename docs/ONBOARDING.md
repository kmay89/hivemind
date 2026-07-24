# Onboarding notes — what the best-played games do, and where HIVEMIND stands

*Research summary (2026-07) + the decisions taken for Play Together. Kept as a
doc so future onboarding work doesn't re-litigate the basics.*

## What the most-played "learn in a living room" games do

Distilled from party/cozy-game onboarding practice (Jackbox, Among Us, mobile
onboarding literature, Apple's game-onboarding guidance):

1. **Teach through play, not screens.** First actions should *be* the
   tutorial. No rules wall; each mechanic arrives the moment it matters.
2. **One action per step, quick wins early.** Small tasks, immediate feedback,
   visible progress.
3. **Role cards over manuals** (Jackbox/Among Us): tell each player *only
   their own job*, in one or two lines, at the moment play starts.
4. **Social recovery**: in a room, the best tutorial is the other players —
   design so experienced players can see and help ("lean over and talk her
   into it"), and new players can't ruin anyone else's game.
5. **Multiple safety nets**: contextual tips + a pause-menu reference for
   whoever missed the moment.

## Where single-player HIVEMIND already stands

The solo game already implements most of this (keep it that way):

- Cold open: touch a cell, a bee wakes — *hands before words*; the "why bees"
  essay is a link, not a wall.
- Founding coach: progressive, one brush at a time, gated on actual actions
  (`checkCoachProgress`), with lessons held until the *second* pass
  (`LESSON_AT=4`) so the first tap is never interrupted.
- Returning players: Continue is the big pulsing button; new-keeper flows
  step back. First-timers get a recommended queen ("✦ best first hive").
- Contextual teaching: Hazel's tips fire on state, not on timers; teaching
  confirms warn once before costly overwrites; undo forgives.

## What Play Together adds (the party-onboarding layer)

- **Role cards at start** — Queen: "You hold time and the forage dial; your
  vote breaks ties." Worker: "Paint *your* comb. When the hive calls a vote,
  dance your answer." One card, three lines, then play.
- **Sectors as guardrails**: a new player physically cannot damage another
  keeper's comb — the failure mode of mixed-skill co-op is removed by the
  ownership rule, not by more tutorial.
- **Votes as teachable moments**: each vote card carries one line of real bee
  biology (waggle-dance quorums, winter stores, syrup trade-offs). Players
  learn the sim's economy by arguing about it out loud — the room is the
  tutorial.
- **Denials teach**: painting outside your sector answers with *whose* comb
  it is and *which* comb is yours; the Queen-only forage dial answers "lean
  over and talk her into it" — social recovery by design.
- **No coach in party mode**: the solo coach is deliberately off (`onboard=false`);
  eight people reading eight coach bubbles is noise. The room + role cards +
  contextual denials carry it.

## The "grandma bar" for joining (Play Together)

The joining flow is held to a stricter standard than the rest of the game:
**a first-time player who has never installed anything should get in within
ten seconds, feel clever doing it, and never see a failure state that blames
them.** Concretely:

- Nobody types anything except a name (remembered afterwards). QR scan with
  the camera app in; QR scan by the host out. Share links and copy/paste are
  fallbacks behind a fold, not the main path.
- Every waiting state says what's happening in warm, human words ("brewing a
  fresh invite…", "one step left: show this to your host 📱→📷").
- Every success celebrates: chime on scan, fanfare + "🎉 Pearl is in the
  hive!" on link. Empowerment is the feeling of *the room cheering*.
- Every failure is recoverable and never the player's fault ("that one's
  gone stale — nothing broke; just ask for a fresh one").

## Candidate future work (solo)

- A "skip ahead, I've kept bees before" fast-path on the founding coach.
- Surfacing the pause-menu "keeper's notes" as the post-coach reference net.
- First-session analytics are off the table (no accounts, no analytics — a
  privacy feature, not a gap); use playtests instead.
