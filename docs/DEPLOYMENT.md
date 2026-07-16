# Deployment — Netlify + Cloudflare

HIVEMIND is a static site with no build step. Netlify publishes the repo root
(configured in `netlify.toml`); Cloudflare provides DNS for the custom domain.

## The setup

| Piece | Where | Value |
|---|---|---|
| Hosting | Netlify | site `hive-mind-game`, publishes `main`, deploy previews per PR |
| Live URLs | — | https://hive-mind-game.com and https://hive-mind-game.netlify.app |
| Domain registrar + DNS | Cloudflare | zone `hive-mind-game.com` |

## Cloudflare DNS records

Both records point at Netlify and stay **DNS only** (grey cloud):

| Type | Name | Content | Proxy status |
|---|---|---|---|
| CNAME | `hive-mind-game.com` | `hive-mind-game.netlify.app` | DNS only |
| CNAME | `www` | `hive-mind-game.netlify.app` | DNS only |

**Why "DNS only" and not proxied?** Netlify is already a CDN and issues the
site's TLS certificate via Let's Encrypt. Proxying through Cloudflare (orange
cloud) puts a second CDN in front of Netlify, which breaks Netlify's
certificate provisioning and can cause redirect loops. Netlify's own docs
recommend DNS-only records — so Cloudflare's "Proxying is required…" banner is
safe to ignore for this site. (Cloudflare still handles registrar + DNS;
DDoS protection and caching come from Netlify.)

Cloudflare flattens the apex CNAME automatically, which is why a CNAME on the
root domain works here.

## Netlify domain settings

For the DNS records to actually serve the site, both hostnames must be added
in Netlify:

1. Netlify → Site configuration → **Domain management** → Add domain alias:
   add `hive-mind-game.com` and `www.hive-mind-game.com`.
2. Set `hive-mind-game.com` as the **primary domain**.
3. Wait for **HTTPS → Verify DNS configuration** to go green and the
   Let's Encrypt certificate to provision (usually minutes once DNS
   propagates).

The Cloudflare dashboard's "Visitors cannot reach…" warnings clear on their
own once Netlify serves the domain and DNS has propagated.

`netlify.toml` also 301-redirects `www.hive-mind-game.com` to the apex, so
there is one canonical address. The `hive-mind-game.netlify.app` URL is left
un-redirected on purpose — both addresses work, and the `<link rel="canonical">`
tag in `index.html` tells search engines the `.com` is the real one.

## Security headers

All responses get security headers from `netlify.toml`:

- A `Content-Security-Policy` that only allows the game's own inline
  script/styles and Google Fonts — no other origins can load code.
- `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a locked-down
  `Permissions-Policy` (no camera, mic, geolocation, payment, or USB).
- HTML caching is Netlify's default (`public, max-age=0, must-revalidate`),
  so players always get the latest version immediately after a deploy —
  no extra configuration needed.

If you add an external script/analytics/API someday, extend the CSP in
`netlify.toml` or the browser will block it.

## Site pages

| Path | Purpose |
|---|---|
| `/` (`index.html`) | the game |
| `/about.html` | about the game & ErrerLabs |
| `/privacy.html` | privacy policy (no data collected; saves are localStorage-only) |
| `/terms.html` | terms of use |
| `/404.html` | not-found page (Netlify serves it automatically) |
| `/robots.txt`, `/sitemap.xml` | search engine hints, canonical domain `hive-mind-game.com` |

## Deploying changes

Push to `main` (usually by merging a PR) and Netlify builds and publishes
automatically. Every PR gets a deploy preview at
`deploy-preview-<PR#>--hive-mind-game.netlify.app` — playtest there before
merging.
