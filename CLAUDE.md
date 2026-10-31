# MathsDock

MathsDock (https://mathsdock.co.uk/) is Tim Boughen's maths teaching-resource website
and optional MCP diagram service. Continue the existing project and its conventions.
`AGENTS.md` and the canonical guidance in `docs/` apply in full; this file adds the
working rules for Claude and never weakens them.

## Start each task

- Read `AGENTS.md` and the docs it names for the area you are changing.
- Work on a branch from fresh `main`. Preserve other people's work and existing checkouts.
- Dated notes in docs and reports are evidence for that date, not current production state.

## Architecture

- React 19 + TypeScript + Vite frontend in `src/`; shared schemas, maths and renderers in
  `packages/*-core`; optional stateless Streamable HTTP MCP service in `services/graph-mcp/`.
- Browser editing and exports must work without the MCP service.
- Add tools through `src/site/registry.ts` and the shared shell (`docs/ADDING-BOOKLET-TOOLS.md`).
- Production website: Cloudflare Worker static assets, question-bank files in R2 at
  `assets.mathsdock.co.uk`. MCP service: Render free plan, manual deploys. GitHub Pages is a
  manual fallback only.

## Question-bank files

`public/bank/assets/` (about 20,000 PDFs and PNGs, 1.6 GB) is the separate
`tboughen/mathsdock-bank` repository, linked as a submodule. `catalogue.json` and
`public/bank/pdfjs/` stay here. Tests and builds need the files, so fetch them with
`git submodule update --init --depth 1` (needs read access to the private bank; CI
checks it out with the `BANK_READ_TOKEN` secret). Bank changes are
committed in the submodule first, then the link is updated here
(`docs/WORKED-SOLUTION-REGISTRATION.md`).

## Checks

Node 24 (`.nvmrc`), `npm ci`. Every pull request runs `.github/workflows/quick-checks.yml`:

```
npm run lint
npm run typecheck
npm test                 # also builds the service first
npm run test:publisher
MATHSDOCK_SKIP_BANK_ASSETS=1 npm run build   # skips copying the bank; never for releases
```

Run the relevant Playwright suite for UI changes: `npm run test:e2e`, or one named project
from `playwright.config.ts` such as `npx playwright test --project=venn`. Full release qualification (`graph-checks.yml`) is dispatched on main before a
release; read `docs/RELEASE-PIPELINE.md` first.

## Teaching and output rules

- Preserve pupil blanks, answer lines, hidden answers, exact fractions and saved intent.
  Blank, zero, hidden and answer-line states are distinct.
- Never calculate, fill, reveal answers or change a saved schema implicitly.
- Meaningful edits are undoable. Keep invalid drafts visible with specific errors.
- Keep editor handles, controls, focus rings and warnings out of exports.
- Physical size is part of the product: preview zoom never changes print size. Check the actual
  SVG, PNG, PDF and editable files. Never shrink type or handwriting space to make things fit.
- Keep saved-file and link compatibility; upgrades are explicit and undoable.
- Bar models: read `docs/BAR-MODEL-BRIEF.md`, `BAR-MODEL-MCP.md` and `BAR-MODEL-V3.md`.
- Worksheets and booklets follow the Maths Resource Design Guide (PLAN, FINALISE, PRODUCE).

## Release and safety

- Implementation, qualification, merge, website deploy, service deploy, plugin publication
  and client adoption are separate stages. None of them happens without Tim's explicit go-ahead.
- Keep the free hosting, manual Render deploys, keys, quotas and the ChatGPT App identity
  unless Tim asks to change them.
- Original papers, official mark schemes, full worked masters, pupil data, school
  information and credentials never go into the repository.
- Worked solutions use the current rulebook: black maths, nearby dark-pink guidance without
  leaders by default; a straight leader only if needed; no deliberate L-shaped leaders.
