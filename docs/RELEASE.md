# Release path — browser, iOS, iPadOS, macOS

*How HIVEMIND ships beyond the website, without breaking the single-file,
zero-dependency rule. The web page stays the product; the apps are thin
wrappers around it.*

## 0. Browser (shipping today)

- Netlify publishes the repo root; `index.html` **is** the game.
- Installable PWA: `manifest.webmanifest` + `sw.js` give offline play,
  home-screen install, and the in-game update banner. This is already a
  complete "app" on Android and a good one on iOS Safari.

## 1. The wrapper strategy for the App Store

Apple accepts HTML5 games when they feel native and don't look like a bare
website (App Review Guideline 4.2 — "minimum functionality"). The plan:

- **Wrapper**: Capacitor (preferred; maintained, minimal) around the exact
  `index.html` in this repo. The wrapper project lives in a *separate repo or
  a `platforms/` dir excluded from Netlify* — it must never become a runtime
  dependency of the web page. The web asset is copied in at build time from
  this repo, unmodified.
- **One codebase, four targets**: iOS (iPhone), iPadOS, macOS (Catalyst or
  Capacitor's Electron alternative — prefer Catalyst so it's one App Store
  listing), plus the existing web.
- WKWebView notes, already accounted for in the game:
  - Everything is inline/same-origin (CSP-friendly, file-URL-friendly).
  - Audio is user-gesture-gated (the sound invite on the title screen).
  - `press()` already handles the iOS synthesized-click quirk.
  - Saves are `localStorage` — in the wrapper, point WKWebView at a
    persistent, non-purgeable data store; consider mirroring the save into
    `UserDefaults`/files via a tiny bridge later.
  - **Hive Link works in-wrapper**: WebRTC is supported in WKWebView
    (iOS 14.3+); the Share button maps to the native share sheet → AirDrop,
    which is the best same-room signaling UX on iOS.

## 2. What makes it pass review as "an app"

Already true: offline play, no accounts, no trackers, touch-first UI,
installable identity (icons/splash). To add in the wrapper: native app icons
+ launch screen from `icons/`, haptics via a one-line bridge (optional),
Game Center later if wanted (badges → achievements map cleanly).

## 3. Store checklist

- [ ] Apple Developer Program membership; App IDs for iOS/macOS.
- [ ] Privacy nutrition label: **no data collected** (matches
      `privacy.html` — no accounts, no analytics, saves stay on device).
      Hive Link is peer-to-peer; no data leaves the room's devices except
      STUN address discovery — say so in the label notes.
- [ ] Camera usage string (`NSCameraUsageDescription`): "Scans a QR code
      from another player's screen to link your hives. Nothing is recorded
      or uploaded." Camera is optional and feature-gated; the app works
      fully without granting it.
- [ ] Age rating: 4+.
- [ ] Screenshots: 6.7", 6.1", iPad 12.9", Mac — capture the comb in summer,
      a hornet raid, the cellar, a Play Together vote.
- [ ] App name/subtitle: "HIVEMIND — a beekeeping story"; keywords: bees,
      beekeeping, cozy, survival, sim, co-op, party.
- [ ] Export compliance: uses only standard TLS/WebRTC (exempt).
- [ ] TestFlight round with Hive Link on two iPhones over AirDrop signaling.

## 4. Versioning & updates

- Web updates ship on every merge (Netlify). The wrapper pins the asset at
  submission time; keep `GAME_VER` visible in the pause menu so store builds
  are identifiable.
- The PWA update banner must stay web-only (feature-detect `serviceWorker`;
  wrapper builds run without SW so there's no double-update UX).

## 5. Out of scope, on purpose

- No ads, no IAP at launch (a single paid price or free is a product call —
  IAP would drag in StoreKit and review complexity).
- No push notifications (nothing server-side exists to send them).
- Android/Play Store: the PWA already installs on Android; a TWA wrapper is
  cheap if wanted later.
