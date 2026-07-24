# Hive Link — same-room multiplayer (2–8 keepers, one hive)

*Design + protocol notes for the `Play Together` mode. Read CLAUDE.md first for
the single-file architecture rules; everything here lives inside `index.html`'s
`// ===== hive link =====` section and a handful of marked hooks.*

**Design targets** (in priority order): two players on a couch is the primary
case; join must be a tap, not a ritual; the link must degrade gracefully and
heal itself; a session is a short, replayable "year" you immediately want to
run again with the same crew.

## What it is

Up to **8 people in the same room** (or on a call) keep **one shared colony**
through a year. It's co-op with friction in the right places, borrowing from
the games that do couch play best:

- **Jackbox**: near-zero onboarding — you get a *role card* with one line of
  instructions, and the game teaches the rest in context. No rules screen.
- **Among Us**: the emergency-meeting beat — any keeper can call a **vote**,
  time freezes, everyone gets two big buttons and 25 seconds.
- **Civilization**: shared strategic stakes — the vote decides colony-wide
  policy (forage patch, harvest, emergency feed), and the consequences play
  out in the shared sim.
- **Real bees** (the educational hook): honeybee colonies genuinely decide by
  quorum — scouts waggle-dance for sites and patches until the hive commits
  (Seeley, *Honeybee Democracy*). The vote cards say so.

## Roles

- **The Queen Keeper (host).** Runs the one true simulation. Holds **time**
  (pause/speed), the **forage dial**, tends the **royal core** of the comb,
  and can invite new keepers mid-game from her 👑 chip. Can paint anywhere (so she can rescue a
  struggling keeper's sector).
- **Workers (joiners).** Each gets a compass **wedge of the comb** ("the East
  Comb") in their color. They paint brood/honey/wax freely *inside their
  sector*, propose patch changes from the meadow, propose harvests and syrup
  feeds — all of which go to a hive vote. Good players optimize their wedge
  and lobby in the room; new players can't break anyone else's comb, which is
  what makes mixed-skill groups work.

## Decisions

| Action | Who | How |
|---|---|---|
| Paint own sector | any keeper | direct, replicated instantly |
| Paint anywhere | Queen | direct |
| Forage dial (nectar↔pollen) | Queen only | direct ("talk her into it") |
| Meadow patch target | anyone proposes | **vote** (thematically: the waggle dance) |
| Harvest a jar | anyone proposes | **vote** |
| Emergency syrup | anyone proposes | **vote** |
| Time (pause/speed) | Queen only | direct |

Votes: 25 s, majority of cast ballots, **proposing auto-casts your own Yes**
(so in a duo only your partner needs to answer — a one-tap consent flow), and
**ties fail** (a real quorum: the hive doesn't move without a majority). One
vote at a time, 8 s per-player proposal cooldown. Voting pauses the sim on
the host (a "hive meeting" — time stops, exactly like an Among Us meeting).

## Hive orders (the Overcooked layer)

Short shared micro-goals keep the room talking: every ~30–60 s of warm-season
play the host draws an order from the `NET_ORDERS` table ("🍼 Paint 5 new
nursery cells", "🏺 Bank 4 cells of honey"), a golden chip with a countdown
appears on every screen, **anyone's comb counts toward it**, and filling it
pays +1 ✧ with a fanfare. Misses are a shrug, not a punishment ("the dusk
took that one"). Orders pause while a vote is live or the host has a modal
open. Filled orders land on the end-of-year scorecard. Add new orders as
table rows (id/lo/hi/txt/meas), not branches.

Hornet raids are also a shared moment: the hornet is mirrored to every
screen (position travels in comb units, so screen sizes don't matter) and
**everyone taps to defend** — joiner swats travel as intents, damage lands on
the host's sim, local screens keep the juice (shake, hitstop, puff).

## Networking (zero-server, by design)

The repo rule is *no server, no dependencies* — so there is **no signaling
server**. Connection is WebRTC `RTCDataChannel` with **manual signaling**,
dressed up as links so the ritual disappears (the Roblox lesson):

1. Host taps *Host a hive* → an **invite link**
   (`https://…/#hive=HIVE1.<base64url SDP>`) appears with Copy / Share
   (Share = AirDrop / iMessage on iOS — the natural same-room flow).
2. Joiner **taps the link**: the game boots straight to the join door — no
   studio splash, no cold open, code prefilled; they pick a name once
   (remembered), tap *Join*, and get a **reply link** back.
3. Joiner shares the reply link back. When it opens on the host's device it
   becomes a **courier tab**: it drops the reply into `localStorage`, the
   running game tab hears the `storage` event and welcomes them in
   automatically — the host never pastes anything. (Pasting either code
   still works everywhere — `netDec` finds `HIVE1.` codes inside any text —
   and is the fallback when the link opens in a different browser, or on
   `file://` where codes stay raw.)
4. The next invite auto-generates. One handshake per joiner, chained, and
   the same door stays open **mid-game**: the Queen taps her 👑 chip in the
   keeper strip to invite more hands at any time.

Notes:
- ICE gathering is **non-trickle** (wait for `icegatheringstatechange:
  complete`, 3.5 s cap) so one code carries all candidates.
- STUN (`stun.l.google.com`) is included because **iOS Safari withholds host
  candidates unless camera/mic permission is granted** — same-room iPhones
  connect via server-reflexive candidates instead. On desktop Chrome/Firefox
  LAN, mDNS host candidates alone would usually suffice.
- CSP: WebRTC/STUN is not governed by `connect-src`, so `netlify.toml` is
  untouched.

## Topology & sync

Star, host-authoritative:

- **Host → all:** `snap` every 0.4 s — the payload is literally
  `serialize()`, the game's existing save schema, so multiplayer state can
  never drift from the single-player state definition. Plus `vote`/`vst`/
  `tally`, `ev` (relayed toasts: hornet raids, keeper departures), `lob`
  (roster), `start`, `end`.
- **Joiner → host:** `hi` (name), `p` (paint op: cell index + resulting
  state, idempotent), `prop` (proposal), `bal` (ballot).
- Joiners **do not run `stepDay`** (`netClient()` gates the sim in
  `frame()`); they run cosmetic rendering + `netApplySnap()` (a trimmed,
  side-effect-free `deserialize`).
- Joiners paint optimistically; the host validates sector ownership and the
  next snapshot reconciles.

## Self-healing (the "never frustrate the player" rules)

- **Drop-in / drop-out is normal, not an error.** Anyone can join mid-game
  (the comb redraws its wedges); a departed keeper's sector becomes
  free-for-all; a keeper who reconnects **with the same name reclaims their
  old seat and wedge** ("their wedge was kept warm").
- **Silence ≠ death.** Joiners watch snapshot freshness: >6 s quiet shows a
  calm "🔗 re-linking…" chip and a Hazel-toned toast, and recovery announces
  itself — the Queen's phone locking is a pause, not a crash. Only a closed
  data channel or `iceConnectionState: failed` ends the session. Joiners
  send a 2 s keepalive to hold NAT bindings open.
- **The `hi` handshake is idempotent and sent three times** — a channel-open
  race can't eat a keeper's name (names are what seat-reclaim keys on).
- **Replay without re-linking.** Year end offers the Queen
  *Another year — same crew ▶*: one tap re-seeds and re-broadcasts `start`
  over the still-open channels. Joiners' end card says to hold on. This is
  the replay loop — short years, same room, again.

## Invariants (keep these true)

- `saveGame()` returns early when `NET.on` — **a party never touches the solo
  save**, in either role.
- Undo is disabled in a shared comb (host restoring a comb snapshot would
  stomp everyone's paints).
- All paints — local and remote — flow through `applyBrush`/`netApplyPaint`,
  both guarded by the sector map (`netSector`, `Int8Array`: `0` = royal core,
  `1..7` = player wedge, `-2` = free/abandoned).
- A departed keeper's sector becomes free-for-all; the host marks them gone
  and (if a vote is live) records their ballot as "against".
- Host death / link loss on a joiner → `THE LINK DISSOLVED` card → reload
  (reload is the session teardown — deliberate, keeps state clean).
- One party = **one year** ("The Founding Party"). Year-end or colony death
  sends `end` with a shared scorecard on every screen.

## Testing

`npm run check` covers syntax/DOM ids as usual. The full two-browser
handshake (invite → reply → lobby → start → paint replication → vote →
disconnect) is exercised by a Playwright smoke script driving two headless
Chromium pages; it was green as of this doc. If you touch the hive-link
section, re-run something equivalent — the handshake is the part unit checks
can't see.

## Deliberate scope (roadmap, not bugs)

- **Harvest is executed by the host after the vote**; the push-your-luck
  frame-pull could become "proposer pulls the frames" with intent relay.
- **No host migration** — the Queen's device is the sim; if it truly dies,
  the session ends (serverless makes migration a real project).
- **No hidden-role mode.** A "Wasp in the Walls" traitor variant (Among Us
  proper) would be a season-2 feature; co-op first.
- Invite codes could compress (`CompressionStream`) or ride QR codes; both
  sides must feature-detect, so plain base64url ships for now.
- Orders are hive-wide; per-sector orders ("East Comb: 3 nursery cells")
  would sharpen the Overcooked role-friction further once the base loop is
  playtested.
