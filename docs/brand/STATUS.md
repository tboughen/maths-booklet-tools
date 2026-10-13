# Branding published to production — 11 October 2026

Approved draft converted into outlined SVG full/inverse logos and standalone
symbols, with PNG favicons/mobile icons, a web manifest and sharing image.
Download package: `docs/brand/mathsdock-brand-assets.zip`.

Website header, accessible home-link label, page titles, social
metadata and question-bank PDF creator now say Maths Dock. Existing browser
storage keys, question content, asset URLs and section names are preserved.

Repository: `tboughen/maths-booklet-tools`, isolated `.cloudflare/mathsdock/site`
checkout, branch `codex/mathsdock-cloudflare`. These branding changes are
uncommitted; PR #7 remains the existing migration draft, not a merged branding
release. No changes were made in the original dirty checkout or in Trello.

Preview: https://mathsdock-preview.tjboughen.workers.dev/?tool=home

Final preview Worker version: `dd14274d-0ec8-4ab6-a7d1-d041301ad866`.
Production: https://mathsdock.co.uk/?tool=home

Production Worker version: `466530f0-489d-4383-a0bf-e89620d5d9f0`.
Tim explicitly approved publication with “perfect. Please publish”.
The source catalogue and all 9,057 R2 objects are unchanged; no R2
upload, overwrite or deletion was performed during this branding task.

## Verification completed

- ESLint, TypeScript and Cloudflare production build passed.
- Existing Vitest suite: 25 files / 139 tests passed.
- Two existing local navigation/layout browser tests passed, including home,
  overview, graph, ratio and question-bank screens at 1280/768/375/320 pixels.
- Final live branding check passed at 1440/768/375/320 pixels: logo loaded,
  correct accessible labels/title/heading, no horizontal overflow, mobile menu
  opened and dismissed with Escape. The 320px header remains on one row.
- Eleven live files, including logo/icons/manifest/sharing image/catalogue,
  matched the final build byte for byte. No browser page errors.
- Two live R2 browser tests passed: question/scheme canvases, PNG previews,
  compact/writing PDF downloads, graph and ratio editing.
- All four downloaded PDFs (13 pages total) have creator
  `Maths Dock question bank`. The final subsequent deployment changed CSS only;
  exported-PDF JavaScript stayed unchanged.
- Normal, inverse, standalone and final desktop/mobile screenshots inspected.
- `git diff --check` passed.

Evidence: `cloudflare-release/brand-review/proof.json`, screenshots in the same
directory; `cloudflare-release/brand-export-proof/`; `pdf-metadata-proof.json`;
`review-board.svg`, `review-board.png` and `approved-draft.png` in this directory.

## Publication completed

The production release passed service build, lint, 10 publishing checks, all
139 unit tests, typecheck and the Cloudflare build. All 9,057 R2 objects matched
and were reused, with zero uploads. Public verification passed for every object
(size, ETag, MIME type, caching and production-origin CORS).

Two initial public-check attempts stopped before deployment on transient fetch
failures. Added a bounded transport retry to the publisher; header/CORS/content
mismatches remain outside the retry and still stop publication. Publishing
tests and publisher lint passed. Resumed at the public-verification phase,
then deployed the qualified build with the production Wrangler configuration.

Live production routes/catalogue, two real-R2 browser tests, four downloaded
PDFs (13 pages, Maths Dock creator), branding at four viewport widths and eleven
exact served assets all passed. No browser page errors. Production mobile
screenshot inspected. Social image is now available at its production URL.

Final receipt: `docs/brand/production-release.json`. Production branding proof:
`cloudflare-release/brand-review/proof.json`; exports:
`cloudflare-release/brand-production-exports`. Preview proofs and earlier
migration browser evidence retained separately before publication.

Redirects, domains, CueCurve, catalogue, R2 contents and GitHub Pages were not
changed. Source changes remain uncommitted in the isolated checkout; no PR was
merged and no GitHub Pages release occurred. Website publication is complete.

## Homepage follow-up before publication — 11 October 2026

At Tim's request, removed the separate homepage “Maths Dock” heading and
“Questions and diagrams for your next lesson.” tagline. The three cards now
start directly below the navigation. Booklet-tools heading, logo and page titles
are retained. Homepage main landmark remains named Home; keyboard navigation
can focus the main content without an unintended visible border.

This follow-up passed lint/typecheck/build, both existing local navigation/layout
checks and final live checks at 1440/768/375/320 pixels. Live proof confirms no
homepage heading/tagline, all three cards, correct logo/nav, eleven exact served
assets including unchanged catalogue, and zero browser page errors. Inspected
the final mobile screenshot. One initial live attempt timed out during Worker
propagation; the final propagation-aware check passed. No repeat PDF run was
needed for this heading/focus-only preview change. The full production release
above subsequently verified all four PDF exports again.
