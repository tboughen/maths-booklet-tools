# CI throughput

Pull requests share a small pool of GitHub Actions job slots, so the limit is concurrent jobs,
not minutes. `quick-checks.yml` is therefore one short job per pull request that runs only the
steps the changed files can affect. Release qualification (`graph-checks.yml`) stays manual and
runs on `main` before a release (`RELEASE-PIPELINE.md`).

## What runs

`scripts/ci/plan.mjs` compares a pull request's merge commit with its first parent (the current
base) and writes a plan to the job outputs. Its unit tests are in `scripts/ci/plan.test.mjs`.

| Change | Bank checkout | Lint and types | Unit tests | Build |
| --- | --- | --- | --- | --- |
| Only Markdown in `docs/` or the repository root | none | skipped | skipped | skipped |
| Website or shared package code | lite | yes | affected only | yes, without the solution-file check |
| MCP service code only | lite | yes | affected only | skipped |
| Example data in `docs/`, `public/`, test setup, config, workflows, scripts, unknown paths | lite | yes | all | yes |
| Catalogue, bank link, `scripts/bank/`, `workedSolution.ts`, `bankAssets.ts`, `vite.config.ts`, package files | full | yes | all | yes, with the solution-file check |

Pushes to `main`, the nightly run (02:17 UTC) and manual runs always use the full bank and run
every step, so anything a pull-request plan skipped is still checked within a day.

- **Restricted content.** Every pull request runs `scripts/ci/content-guard.mjs`, which fails when
  the change adds a PDF, image or office file outside the allowlisted folders (bank files belong in
  the `mathsdock-bank` submodule), a file named like an original paper, mark scheme, worked master,
  class list or pupil data, or a line with a local machine path such as `C:\Users\<name>`. Only
  additions are checked. A new artwork folder is allowed by adding it to `allowedBinaryFolders` in
  the same pull request.
- **Bundle budget.** Whenever the build runs, `scripts/ci/bundle-budget.mjs` measures the gzip size
  of first-load JavaScript and CSS (what `index.html` loads before any page), the largest chunk and
  all JavaScript, and fails when one passes `scripts/ci/bundle-budget.json`. Lazy-load new code, or
  raise the budget in the same pull request and say why.
- **Test integrity.** Every pull request runs `scripts/ci/test-integrity.mjs`. A new `.only` fails
  the job. Removed or loosened assertions, new `skip`/`fixme`, deleted test files and changed
  control hashes appear as warnings and in the job summary for review
  (`docs/AUTONOMOUS-LOOP-POLICY.md`, gate 10).
- **Risk tier (shadow).** Every pull request runs `scripts/loop/classify-risk.mjs`, which reports
  the policy tier (T0 to T8) and the files that set it in the job summary. It decides nothing until
  Tim enables a phase (`docs/AUTONOMOUS-LOOP-POLICY.md`, sections 3 and 4).
- **Output gates** live in `src/gates/` and run with the unit tests whenever a core, renderer or
  gallery example changes. `answer-canary.test.ts` plants a sentinel in every hidden-answer slot of
  every example and fails if a pupil SVG shows it. `export-output.test.ts` renders every gallery
  example, pupil and worked, and fails on editor chrome, a non-absolute print size, a distorted
  aspect, or declared type smaller than `print-baseline.json`. Raise the baseline after a deliberate
  increase with `UPDATE_PRINT_BASELINE=1 npx vitest run src/gates`; lowering it needs Tim.
  The size checks come from `src/testing/print-size.ts`, the shared millimetre library: the SVG's
  printed size, the smallest type in points, a PNG's printed size from its pixels and `pHYs`
  density, and whether a PNG prints at the same size as its SVG. The browser export goldens
  (`e2e/export-goldens.spec.ts`) use the same library to check that every downloaded SVG and
  600 ppi PNG print at the same size.
  `saved-states.test.ts` saves every example as its editable file (and link, where the tool has
  a link codec), reloads it through the real parser, and repeats that with each teaching slot set
  to blank, zero, hidden answer, answer line and value; any lost or merged state fails.
  `corpus.test.ts` keeps old saved files opening: `src/gates/corpus/<date>/<tool>/` holds every
  example's editable file as saved on that date (first frozen 8 November 2026), and each must load
  through today's parser unchanged, save again the same and survive its link. Dated files are never
  edited (test integrity warns if one is); freeze a new date with
  `WRITE_CORPUS=YYYY-MM-DD npx vitest run src/gates/corpus.test.ts`. A deliberate upgrade that
  rewrites old files on load is listed file by file in `corpus/UPGRADES.json` with Tim's approval.
- **Property tests** use the seeded generator in `src/testing/random.ts` (`forAll`), so every run
  is reproducible. `src/testing/exact-numbers.property.test.ts` checks exact fractions, decimals,
  scaling and quadratic table values against plain bigint arithmetic, and `saved-states.test.ts`
  sets random mixes of teaching states across a whole file at once. A failure names its seed:
  replay it with `PROPERTY_SEED=<seed>`, and search longer with `PROPERTY_RUNS=<multiplier>`.
- **Judge panel (shadow).** `judge-panel.yml` runs beside quick checks on every non-draft pull
  request: three judges (teacher, product, adversarial; rubrics in `review/rubrics/`) review the
  diff with the Claude API and report verdicts and findings in the job summary and the
  `judge-panel` artifact. It is not a required check and never fails on a verdict. The job holds
  the API key, so it runs no pull-request code: it reads the PR only as a diff and runs the judge,
  rubrics, guidance and dependencies from the base branch, so a PR cannot read the key or change
  the panel that judges it (changes to the panel take effect from the next PR after merge).
  Generated files are listed by name, not sent; a diff over 400,000 characters makes the panel
  abstain. Spend is capped only by the limit on the API key's workspace; each run costs roughly
  three Opus requests. The `Judge calibration` workflow (manual, spends credit) runs the panel over
  the seeded known-bad changes in `review/calibration/` and reports how many it catches.
- **Output goldens.** `src/gates/goldens.test.ts` renders every gallery example, pupil and worked,
  in Node with resvg and only the bundled STIX fonts, and compares it with
  `src/gates/golden/outputs.json`: the saved-envelope hash, the SVG hash, the printed millimetres,
  the 600 ppi PNG pixel size and a pixel hash (150 ppi, compared only on the recording platform,
  `linux-x64`). One example per tool also goes through the full 600 ppi PNG path. A change that
  alters only the SVG hash keeps the same pixels (a golden-identical refactor). Goldens change only
  with `ACCEPT_GOLDENS="reason" npx vitest run src/gates/goldens.test.ts`, which appends the reason
  and the changed outputs to `src/gates/golden/ACCEPTED.md`; such a pull request is T4 or higher.
- **Contracts.** `src/gates/contracts.test.ts` compares every saved-file schema (as JSON Schema)
  and the advertised MCP catalogue (`tools/list` from a local service) with snapshots in
  `src/gates/contracts/`. Any difference fails; after Tim approves a schema or MCP change, refresh
  with `UPDATE_CONTRACTS=1 npx vitest run src/gates/contracts.test.ts`. Test integrity flags every
  snapshot change.
- **Browser gates.** When the plan builds the site, the job also runs `npx playwright test
  --project=gates` (`e2e/gates.spec.ts`, about a minute): every page within two clicks of home must
  load without a page error, and axe must find no serious or critical WCAG 2 A/AA rule beyond
  `e2e/a11y-baseline.json`. The baseline only shrinks; refresh it with `UPDATE_A11Y_BASELINE=1`
  after fixing a rule. Pages are found by following links, so new addresses need no changes.
- **Drafts use no CI.** Open a pull request as a draft while it is in progress; marking it
  ready for review starts the checks. Each new push cancels the run in progress for that ref.
- **Affected tests** use `vitest --changed HEAD^1`, which follows the import graph. Files that
  tests read from disk instead of importing (docs examples, `public/`) always run every test.
- **Lite bank.** `scripts/ci/lite-bank.txt` lists the 20 question folders (about 28 MB) that the
  unit tests read. The job checks out only those folders instead of the whole private bank. If a
  new test reads another bank folder, add it to the list (keep it sorted) in the same pull request.
- **Solution-file check.** The build normally verifies every registered worked solution against
  the bank. With the lite bank it sets `MATHSDOCK_SKIP_SOLUTION_FILES=1`, which `vite.config.ts`
  refuses in release (`cloudflare`) builds.
- **Caches.** `node_modules` is cached by Node version and lockfile, so `npm ci` runs only when
  dependencies change. ESLint (content-based), TypeScript build info and Vitest caches are
  restored from the newest run. Pushes to `main` and the nightly run refresh the caches every
  pull request can read.

## Batching pull requests

GitHub's merge queue needs an organisation-owned repository, so batches are made by hand:

1. Keep each pull request open and green on its own branch.
2. Create `batch/<date>-<n>` from fresh `main`, merge the pull-request branches into it, and
   open one pull request for the batch. One quick-checks run then qualifies the whole batch.
3. Merge the batch with a merge commit (not squash) so the individual pull requests show as merged.
4. If the batch fails, bisect by dropping branches; do not push fixes onto someone else's branch.

## Running it locally

```
node scripts/ci/plan.mjs --event=pull_request --base=origin/main
npm test -- --changed origin/main --passWithNoTests
git submodule update --init --depth 1   # or a sparse checkout of scripts/ci/lite-bank.txt
```
