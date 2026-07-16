# Security Policy

HIVEMIND is a fully client-side static site: one HTML file, no server code, no
database, no user accounts. Game saves live in the player's own browser
(localStorage) and are never transmitted anywhere.

## Reporting a vulnerability

If you find a security issue — for example an XSS vector, a problem with the
site's security headers, or a supply-chain concern — please report it privately
via [GitHub's private vulnerability reporting](https://github.com/kmay89/hivemind/security/advisories/new)
rather than opening a public issue.

Please include steps to reproduce and, if you have one, a suggested fix. You
can expect an acknowledgement within a few days. Once fixed, you're welcome to
disclose publicly.

## Scope

- `index.html` and the other pages served at hive-mind-game.com and
  hive-mind-game.netlify.app
- The security headers configured in `netlify.toml`

Hosting-infrastructure issues (Netlify, Cloudflare, Google Fonts) should go to
those providers' own security programs.
