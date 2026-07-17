# 🐝 HIVEMIND

**Keep a honeybee colony alive, year after year.**

HIVEMIND is a cozy-but-punishing beekeeping survival sim that runs entirely in your browser — a single HTML file, no build step, no dependencies, no server. Paint the comb, steer the foragers, fight off hornets, and stock the pantry before winter bites.

## Play

**▶ Play it now at [hive-mind-game.com](https://hive-mind-game.com)** (also at [hive-mind-game.netlify.app](https://hive-mind-game.netlify.app)) — or open `index.html` in any modern browser.

Works on desktop and mobile (touch-friendly, installable as a fullscreen web app).

## How it works

You guide a colony through a 360-day year across four seasons — Spring, Summer, Autumn, Winter — and try to bring it out alive on the other side.

- **Paint the comb.** Use brushes to mark where the queen lays (brood), where honey and pollen get stored, and where fresh wax should be built.
- **Steer the foragers.** Split the field force between nectar (honey — winter fuel) and pollen (protein — brood food), and chase the best bloom patches as the seasons turn.
- **Watch the colony live.** Bees age through jobs — cleaners, nurses, builders, and finally foragers. The queen ages too, and her laying slows each year.
- **Survive the threats.** Hornet raids, cold snaps, late springs, lean blooms, and the long dark of winter all want your bees dead.
- **Hit the season goals.** Each season sets a target — build-out in spring, honey banked by autumn, cells still capped at the midwinter check — and pays out royal jelly ✧ when you make it.
- **Grow stronger between years.** Spend royal jelly on **Queen's Gifts** — roguelite upgrades like Hardy Stock, Wax Masters, Forager Lines, Prolific Queen, Guard Wall, and Insulated Hive — then face a harder year: The Founding, The Long Frost, Lean Blooms, and beyond.

## Tech

- Single-file HTML5 canvas game (`index.html`) — HTML, CSS, and vanilla JavaScript, zero dependencies.
- Simulation-driven: population dynamics, forage yields, comb economy, and weather all tick per in-game day.
- Fonts loaded from Google Fonts (Bricolage Grotesque + JetBrains Mono); everything else is self-contained.
- No accounts, no analytics, no server — saves live in your browser's localStorage. See the [privacy policy](https://hive-mind-game.com/privacy.html).
- Installable PWA: add it to your Home Screen and it runs fullscreen, works offline (service worker), and shows an in-game banner when a new version is deployed.

## Hosting

The site is hosted on Netlify with DNS on Cloudflare. Setup, DNS records, and
security headers are documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md);
Netlify configuration (headers, redirects) lives in [`netlify.toml`](netlify.toml).

## Site pages

[About](https://hive-mind-game.com/about.html) ·
[Privacy](https://hive-mind-game.com/privacy.html) ·
[Terms](https://hive-mind-game.com/terms.html) ·
[Security policy](SECURITY.md)

## License

[MIT](LICENSE) © 2026 ErrerLabs (Karl Meves)
