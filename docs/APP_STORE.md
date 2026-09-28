# App Store submission: HIVEMIND for iPhone and iPad

*Everything needed to build, list and submit the iOS/iPadOS app. `docs/RELEASE.md` explains
why the app is a thin wrapper; this is the practical checklist.*

The game is the repo's own `index.html`, unmodified, inside a Capacitor shell in
`platforms/ios/`. Inside the app `IS_APP` is true, and that changes only four things:

- no service worker;
- the Play Together mailbox and shared links point at hive-mind-game.com;
- the trailer streams from the site;
- saves are mirrored to native storage (`@capacitor/preferences`), so iOS evicting web storage
  can't erase a colony.

Everything else is the same game the website ships.

## 1. Build it (on a Mac)

Prerequisites: Xcode 16 or later, Node 20 or later, and an Apple Developer Program membership.

```sh
cd platforms/ios
npm install              # Capacitor + the Preferences and Haptics plugins (Package.swift points into node_modules)
npm run sync             # copies index.html, the legal pages, fonts/ and icons/ into the app, then `cap sync ios`
npm run open             # opens ios/App/App.xcodeproj in Xcode
```

Then in Xcode:

1. **Signing.** Select the *App* target → Signing & Capabilities → choose your Team. The
   bundle ID is `com.errerlabs.hivemind`; it must match the App ID you register in App Store
   Connect. To change it, edit `capacitor.config.json` and the target's bundle identifier,
   then `npm run sync`.
2. **Version.** On the *App* target, set *Version* (`MARKETING_VERSION`, e.g. 1.0) and
   *Build* (`CURRENT_PROJECT_VERSION`, bump it on every upload). The in-game version
   (`GAME_VER`, shown in the pause menu) tells you which web build is inside.
3. **Archive.** Product → Destination "Any iOS Device (arm64)" → Product → Archive →
   Distribute App → App Store Connect → Upload.

**The app always carries the current game.**
- The Xcode target's first build phase, **"Bundle the current web game"**, runs
  `scripts/sync-www.js --app` on every build. That copies the repo's current `index.html`, the
  legal pages, `fonts/` and `icons/` into the app bundle, so an archive can't ship a stale copy.
  The build log prints the game build it bundled (for example `game build 2026.09.28.48`), and
  the pause menu shows the same string on the device.
- `npm run sync` is still needed once after cloning, and again whenever the Capacitor plugins
  change. It generates the native side, which the build phase doesn't touch.
- The phase needs `node` on Xcode's PATH. It looks in Homebrew, `/usr/local`, Volta and nvm. If
  node isn't found it prints a warning and the app keeps the copy from the last sync.
- CI (`npm run check:ios`) fails if the phase goes missing or stops running the sync, if a file
  it copies disappears, or if `GAME_VER` and the service worker version disagree.

Already set in the project:

- **App icon.** 1024², opaque RGB, drawn by `scripts/make-art.js`.
- **Launch screen.** Dark, with the glowing cell.
- **Device support.**
  - iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`), iOS 15 or later, arm64.
  - All iPad orientations, so iPad multitasking works; portrait and landscape on iPhone.
  - Status bar hidden.
- **Info.plist entries.**
  - `ITSAppUsesNonExemptEncryption = false`, so no export-compliance questions.
  - `NSCameraUsageDescription` for the optional QR join.
  - `NSLocalNetworkUsageDescription`, because WebRTC links phones on the same Wi-Fi.
  - `LSApplicationCategoryType = public.app-category.simulation-games`.

Regenerating assets (dev-only; needs Chromium and ffmpeg):

```sh
CHROMIUM=/path/to/chromium FFMPEG=/path/to/ffmpeg node platforms/ios/scripts/make-art.js   # icon + splash
CHROMIUM=/path/to/chromium node tools/app-store-shots.js                                    # store screenshots
```

## 2. App Store Connect listing

| Field | Value |
|---|---|
| Name (30) | HIVEMIND: A Beekeeping Story |
| Subtitle (30) | Keep a honeybee colony alive |
| Primary category | Games → Simulation |
| Secondary category | Education |
| Price | Free (no in-app purchases, no ads) |
| Age rating | 4+ (answer "None" to every content question; "Unrestricted Web Access": No) |
| Copyright | 2026 ErrerLabs |
| Support URL | https://github.com/kmay89/hivemind/issues |
| Marketing URL | https://hive-mind-game.com |
| Privacy Policy URL | https://hive-mind-game.com/privacy.html |

**Keywords (100):**
`bees,honey,hive,cozy,simulation,survival,family,co-op,party,nature,pollinator,learn,strategy,farm`
Words already in the name ("beekeeping", "story") are indexed from the name, so they aren't repeated here.

**Promotional text (170).** This field can change without a new build:
> Forty thousand bees, one year, and winter is coming. Paint the comb, aim the foragers, make a real keeper's calls, and learn how honeybees actually survive.

**Description:**

> After forty years, a beekeeper is hanging up her veil, and her hillside of hives needs a new pair of hands. Yours.
>
> HIVEMIND is a cozy survival game about keeping one honeybee colony alive through the seasons. You don't command bees; you shape the comb they live in and the choices they face, and forty thousand of them think as one.
>
> PAINT THE HIVE
> • Brood cells become the nursery where the queen lays.
> • Honey cells become the pantry the colony eats all winter.
> • Expand flags fresh wax for the builders to draw.
> Every cell is a trade-off between growing now and surviving later.
>
> AIM THE FORAGERS
> Slide the mixer between nectar and pollen, and send the scouts to the patch in bloom. Near flowers fly cheap; far ones must bloom rich.
>
> MAKE A KEEPER'S CALLS
> Queen cells on the comb, robbers at the entrance, a heatwave, the ivy flow, a mouse at the door in the first frosts. Each dilemma is real beekeeping, each choice shows its effect on the winter forecast, and each one files a field note of true bee biology.
>
> SURVIVE THE WINTER
> Did you store enough honey? A small cluster can't hold its heat, and a full one can starve with a nursery too big. Earn stars, unlock queen lines and Queen's Gifts, fill a cellar of rare honeys, and grow your apiary year after year: Year 2 brings varroa mites.
>
> PLAY TOGETHER
> 2 to 8 keepers in the same room share one hive. Everyone paints their own part of the comb, votes together at hive meetings, drives off hornets, and asks each other for a hand. Join with a four-letter code. Family mode brings easy words and gentle bees for younger keepers.
>
> LEARN WHILE YOU PLAY
> Why bees shiver to keep the queen warm, how a waggle dance works as a map, why a single bee makes a twelfth of a teaspoon of honey in her life, and why it's the wild bees that need us most.
>
> No accounts. No ads. No tracking. Plays offline.

**What's New (for updates):**
> Initial release.

## 3. App Privacy ("nutrition label")

Answer **Data Not Collected**. The reasoning, in case review asks:

- No accounts, analytics, advertising or tracking SDKs. Saves stay on the device.
- **Play Together** leaves a WebRTC handshake, the auto-generated hive name and the keeper name
  typed for the party in the hive mailbox at hive-mind-game.com.
  - It exists only to connect devices in real time, and it is deleted within 8 minutes.
  - Apple's definition of "collect" excludes data used only to serve the request in real time.
  - Game data then flows peer-to-peer.
- A public STUN server sees the device's IP address during link-up, as any network request would.
- The camera, used for the optional QR join, is processed on the device and never transmitted.

The privacy policy states all of this under "Play Together" and "The iOS and iPadOS app".

## 4. Notes for the reviewer (App Review Information → Notes)

> HIVEMIND needs no login and works offline. To see the core loop: on first launch tap the glowing cell, then "Begin", and follow the pointing hand through the short founding tutorial (or tap ✕ to skip it), then press ▶ Start. Later launches open on the title screen ("▶ Play"). Paint cells with the Brood / Honey / Expand brushes and move the Pollen ↔ Nectar mixer. A year takes about 7 minutes at the default pace; the ⏩ button (available after the first task) speeds it up.
>
> Play Together (optional) links 2–8 devices in the same room. To try it with one test device: on the device, tap Play Together → Host a hive to get a four-letter code; on any second device or a Mac, open https://hive-mind-game.com in Safari, tap Play Together → Join a hive and type the code. The camera is only used, optionally, to read a QR code from another screen; every step also works by typing.
>
> The app contains the complete game. It downloads no executable code; the network is used only for the optional Play Together handshake and for streaming the optional trailer video.

Contact info: your name, phone and email (required by App Store Connect).

## 5. Screenshots

`tools/app-store-shots.js` writes captioned, store-ready frames to
`platforms/ios/store/screenshots/`. Every frame is the real game, set under a one-line caption.

| Slot | Size | Files |
|---|---|---|
| iPhone 6.9" display | 1290 × 2796 | `iphone-6.9-1…6-*.png` |
| iPad 13" display | 2048 × 2732 | `ipad-13-1…6-*.png` |

Upload them in order:

1. comb: "Keep 40,000 bees alive"
2. event: "Make a real keeper's call"
3. meadow: "Send foragers to the flowers"
4. year end: "Make it through winter"
5. party: "Play together, one hive"
6. field notes: "Learn real bee biology"

App Store Connect scales the 6.9" set down for smaller iPhones.

An app preview video is optional. `marketing/hivemind-trailer-1080x1920.mp4` is 1080×1920
and 72 s, so it would need re-rendering at 886×1920 and trimming to 30 s to qualify.

## 6. Guideline check (the ones HTML5 games get rejected on)

- **4.2 Minimum functionality.** A full game with a tutorial, progression, meta-progression and
  multiplayer, plus native storage, a native icon and a launch screen. It is not a website
  in a frame: no browser chrome, and no web navigation away from the game except explicit
  outside links, which open Safari.
- **2.5.2 No downloaded code.** All code ships in the bundle. The mailbox exchanges only
  connection handshakes (data, not code).
- **1.2 User-generated content.**
  - The only free text is a keeper's name for a party, shown only to the players in that room.
  - The public "waiting hives" list shows only the auto-generated hive name and a code, never
    a typed name.
  - There is no chat; reactions are fixed emoji.
- **2.3.10.** The listing names no other platforms.
- **5.1.1 Privacy.**
  - Camera and local-network prompts carry clear purpose strings.
  - The app is fully usable with both declined.
  - Data Not Collected is accurate (see §3).
- **3.1.1.** No payments, tips or external purchase links.

## 7. TestFlight checklist (on real devices, before submitting)

Automated coverage before this checklist: headless playthroughs of a first colony,
a neglected colony (death, rewind, restart), the daily challenge, Family mode, a
returning keeper and a full-year party found no page errors, no stuck screens and no
"undefined"/"NaN" text (see the QA note in the PR). What only a real device can show:

- [ ] Cold launch: the dark splash, then the studio sting, then the title, with no white flash.
- [ ] Sound starts only after the first tap. The Sound toggle mutes it.
- [ ] Haptics: buttons tick, painting comb clicks lightly, a hornet sting thuds, a badge or year-end plays the success pattern. Pause menu → Haptics Off silences all of it.
- [ ] A founding tutorial played start to finish on an iPhone SE-size screen: every button is reachable, and nothing hides under the notch or home indicator.
- [ ] Rotate the iPad mid-game, and try Split View and Slide Over: the comb re-fits.
- [ ] Play a year. Quit the app from the app switcher mid-season and relaunch: the colony continues ("Continue" shows the bee count).
- [ ] Settings → Apps → HIVEMIND: offload and reinstall, and check that progress is restored (via native storage).
- [ ] Airplane mode: the whole solo game works. The trailer shows its poster, then fails politely.
- [ ] Play Together, app ↔ app: host on one iPhone, join by code on another. Allow the local-network prompt. Paint, hold a hive meeting, send a 🙋 flare, and reach the year-end "decided together" scorecard.
- [ ] Play Together, app ↔ Safari: an iPad app hosts, and Safari on a Mac joins by code.
- [ ] Decline the camera and the local network: Play Together still offers typed codes and links.
- [ ] Share the year-end card: the share sheet opens, or the game says honestly that sharing isn't available.
- [ ] The About, Privacy and Terms links open inside the app. Outside links (GitHub, Netlify) open Safari.
- [ ] VoiceOver on the title screen reads the buttons, and Dynamic Type doesn't break the HUD.
