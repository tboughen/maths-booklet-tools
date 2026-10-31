# Staff sign-in and the gated question bank

MathsDock is an internal tool for staff at Tim's school. Cloudflare Access (email
one-time codes) sits in front of the website. Decided 31 October 2026.

| Path | Who gets in | Access application |
| --- | --- | --- |
| `mathsdock.co.uk` (tools, everything else) | school email domain + named guests | `MathsDock` |
| `mathsdock.co.uk/bank` (catalogue, question PDFs/PNGs, worked solutions, PDF.js files) | school email domain only | `MathsDock question bank` |
| `preview.mathsdock.co.uk` (whole host) | school email domain only | `MathsDock question bank` |

Cloudflare applies the most specific path, so `/bank` is staff-only while guests
keep the tools. Both applications also allow the release service token (below).

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
  the bank application, expiry, RS256 signature against the team's certs). If
  `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is unset it answers 503, and without a valid
  token 403, so a missing or mistyped Access rule fails closed.
- Responses use `Cache-Control: private, max-age=31536000, immutable`, support
  `Range` (PDF.js) and `HEAD`, and carry `X-Robots-Tag: noindex`.

`ACCESS_TEAM_DOMAIN` (for example `https://mathsdock.cloudflareaccess.com`) and
`ACCESS_AUD` (the bank application's Application Audience tag) are set in
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
Guests can follow them too, because tools are open to guests.
