# Staff sign-in and the gated question bank

MathsDock is an internal tool for staff at Tim's school. Cloudflare Access (email
one-time codes) sits in front of the website. Decided 31 October 2026.

Since 31 October 2026 there is **one** Access application, `MathsDock question
bank`, covering the whole host `mathsdock.co.uk`. It allows the school email
domain only (policy `School staff only`) plus the release service token (policy
`Release checks`).

Do not split the site into a whole-host app and a `/bank` path app. The website
loads `/bank/catalogue.json` and `/bank/assets/*` with background requests, and
each Access application needs its own token: a request to the second app is
redirected to the team sign-in page, which a background request cannot follow,
so the bank fails with "network error". This happened on 31 October.

Named guests (rule group `MathsDock guests`) therefore cannot sign in for now.
Letting guests use the tools but not the bank needs a check in the Worker (the
Access token's email), not a second path-based application.

`preview.mathsdock.co.uk` is added back to the application once the preview
Worker has been deployed to that custom domain; until then the name does not
resolve and Access would redirect to it after sign-in.

## How bank files are served

- Question files live in the private R2 bucket `maths-booklet-assets` under
  immutable keys `bank/assets/sha256/<sha256>.<pdf|png>`.
- The website Worker (`scripts/cloudflare/site-worker.mjs`, `main` in
  `wrangler.jsonc`) reads them through the `BANK` R2 binding. `run_worker_first`
  limits the script to `/bank/assets/*`; every other path is plain Workers Static
  Assets.
- The browser fetches them from the same origin (`/bank/assets/...`), so the
  Access cookie covers them. There is no public asset origin and no CORS policy
  to maintain. The Cloudflare build sets `VITE_BANK_ASSET_ORIGIN` to `""`.
- The Worker checks the `Cf-Access-Jwt-Assertion` token again (issuer, audience =
  the Access application, expiry, RS256 signature against the team's certs). If
  `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is unset it answers 503, and without a valid
  token 403, so a missing or mistyped Access rule fails closed.
- Responses use `Cache-Control: private, max-age=31536000, immutable`, support
  `Range` (PDF.js) and `HEAD`, and carry `X-Robots-Tag: noindex`.

`ACCESS_TEAM_DOMAIN` (for example `https://mathsdock.cloudflareaccess.com`) and
`ACCESS_AUD` (the Access application's Application Audience tag) are set in
`wrangler.jsonc` and `wrangler.preview.jsonc`. Neither is secret. The promoter
refuses to deploy until both are set and the configuration keeps
`workers_dev: false`, `preview_urls: false`, the `BANK` binding and the bank-only
Worker route (`scripts/cloudflare/gated-config.mjs`).

## Release checks behind Access

Live checks authenticate with an Access service token from
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (GitHub secrets for
`cloudflare.yml`; set them in the shell for a local preview run). The headers are
sent only to the site itself. After deploying, the promoter also confirms that the
bank answers 302/401/403 **without** the token (`verifyGate`), so a release cannot
succeed while the bank is open.

## Retired copies

- `assets.mathsdock.co.uk` (R2 custom domain): no longer used by the site. Tim
  removes it in the dashboard once the gated release is live.
- GitHub Pages fallback: the workflow was removed because Pages served an ungated
  copy of the bank. Tim unpublishes the Pages site.
- `mathsdock-preview` on workers.dev: the preview now uses
  `preview.mathsdock.co.uk` behind Access, with `workers_dev` and preview URLs off.

## Not affected

The MCP service on Render serves its own diagram downloads, so connector
downloads keep working. Its "open in editor" links point at
`https://mathsdock.co.uk/?tool=...`; a teacher signs in once when they follow one.
Guests cannot follow them until the Worker-side guest split exists.
