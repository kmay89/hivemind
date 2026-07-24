# Hive Link — same-room multiplayer (2–8 keepers, one hive)

*Design + protocol notes for the `Play Together` mode. Read CLAUDE.md first for
the single-file architecture rules; everything here lives inside `index.html`'s
`// ===== hive link =====` section and a handful of marked hooks.*

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
  and **breaks tied votes**. Can paint anywhere (so she can rescue a
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

Votes: 25 s, majority of cast ballots, tie → Queen's ballot decides, one vote
at a time, 8 s per-player proposal cooldown. Voting pauses the sim on the
host (a "hive meeting" — time stops, exactly like an Among Us meeting).

## Networking (zero-server, by design)

The repo rule is *no server, no dependencies* — so there is **no signaling
server**. Connection is WebRTC `RTCDataChannel` with **manual signaling**:

1. Host taps *Host a hive* → an **invite code** (~850 chars, base64url SDP,
   prefix `HIVE1.`) appears with Copy / Share buttons (Share = AirDrop /
   iMessage on iOS, which is the natural same-room flow).
2. Joiner pastes it, taps *Answer the call* → gets a **reply code** back.
3. Host pastes the reply, taps *Welcome them in* → data channel opens, next
   invite auto-generates. One handshake per joiner, chained.

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

## Deliberate v1 scope (roadmap, not bugs)

- **Hornet defense is Queen-screen-only** (joiners get the raid toast).
  Next: forward tap-to-defend intents.
- **Harvest is executed by the host after the vote**; the push-your-luck
  frame-pull could become "proposer pulls the frames" with intent relay.
- **No mid-game join / rejoin** — lobby only.
- **No hidden-role mode.** A "Wasp in the Walls" traitor variant (Among Us
  proper) would be a season-2 feature; co-op first.
- Invite codes could compress (`CompressionStream`) or ride QR codes; both
  sides must feature-detect, so v1 ships plain base64url.
