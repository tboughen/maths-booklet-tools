# MathsDock release pipeline

Website publication uses one identified build and complete qualification evidence.
The controlled main workflow was activated on 15 October 2026. Retain the latest
verified production pointer; main, a successful qualification and a live deployment
are distinct states. Implementing workflow changes does not activate them, deploy
the website or service, or refresh client definitions. Honour review-only requests.

## Keep the release context compact

Start release work with these facts, and links to existing evidence:

```text
Requested scope and approval: implementation / qualification / publication
Checkout and candidate commit/tree:
Exact comparison commit and changed paths:
Prior verified publication run, package and current Worker version:
Required checks; inventory preflight mode/reasons and last full audit:
Current run ID, watcher record, next action or blocker:
```

Read the applicable guide and relevant evidence once; keep full logs and historical
detail in files. Use one watcher per exact qualification/publication run rather than
repeated `gh run view` calls through model turns:

```powershell
node scripts/cloudflare/watch-run.mjs --run=EXACT_RUN_ID --commit=EXACT_RUN_HEAD_SHA --output=cloudflare-release/watch-UNIQUE.json
```

It queries read-only, backs off from 30 to 60 seconds, prints changed states only,
and ends within 45 minutes by default (maximum 60). Each API query has a deadline;
timeout or failure never reports success. In an agent terminal, launch it once as
an ongoing process and inspect incremental output at bounded intervals, continuing
independent work and concise user updates. Do not start parallel watchers or keep
fetching the same full run. The output file must be new; a fresh invocation can
watch the same run after a timeout. Its success means workflow success only:
inspect qualification or deployment receipts before claiming qualified/live.

The compact context reduces repeated input, but no fixed token saving or automatic
token-budget enforcement is claimed. Measure comparable real releases separately
from test runs; do not deploy merely to benchmark.

### Existing chats and older checkouts

Publishing the repository workflows does not rewrite existing chat context or
update an older worktree. An existing chat can use these fixes: explicitly ask it
to read current main's `AGENTS.md` and this guide, reconcile its intended changes
into an isolated checkout based on current main, supply the previous verified
publication as `BaselineRun`, and use the bounded watcher. Preserve its original
worktree and unfinished changes. Do not reset it merely to get newer tooling.

Automatic instruction discovery happens when Codex builds a run's instruction
chain; do not assume an already-running chat silently reloads changed files.
Explicitly reading the current files supplies them to that chat. A new chat in the
updated repository is an alternative for a compact context; it is not required
for the GitHub workflow fixes to work. No MCP/plugin refresh or sign-in is needed
for these repository changes. See [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

For audit reuse, the baseline must still be trusted, at most seven days old and
match the observed policy and verifier. Omitting `BaselineRun` deliberately selects
a cold/full audit. Catalogue reuse during preparation is a separate optimisation.

## Prepare and qualify

Use Node 24 and a clean isolated checkout. Never reset someone else's changes to
make qualification pass. Commit the candidate normally, then run:

```powershell
npm ci
npm run release:qualify -- --base=EXACT_COMPARISON_COMMIT
```

The comparison must account for all intended changes. A missing or unrelated
baseline selects broad qualification. Do not choose a convenient last commit to
hide earlier unpublished changes. The package records the whole Git tree, bank
tree, lockfile, policy versions and file hashes. Identical-tree merge commits may
reuse it; other trees require a fresh package and qualification.

`release:prepare` builds once. `release:check -- --check=NAME` executes one required
check; `release:seal` rejects absent, failed, skipped or overlapping results.
`release:qualify` orchestrates those commands locally. GitHub runs independent
jobs and two isolated browser shards. The required aggregate is
`release-qualification`; do not infer qualification from just one green job.

Checks include normal website unit tests, one complete-catalogue PDF integration
case, publisher failure tests, built-package acceptance and full browser coverage.
Shared/service or uncertain changes also require service tests, actual vector
consumption and the bounded Linux container smoke. Browser fixtures are generated
through the real local MCP protocol even for website-only changes.

No individual test pass is cached across candidates. The expensive complete-bank
export runs once, alongside other independent checks. Service images are omitted
only when classification establishes that their inputs are unaffected.

The release package is `cloudflare-release/package`. Qualification and timing
records are under `cloudflare-release/evidence`. The GitHub artifact is
`qualified-release`, retained for 90 days subject to account policy. Its exact run
and artifact IDs matter; an artifact named “latest” is insufficient. Copy retained
current/previous packages before their retention expires.

Built browser rehearsal uses locally intercepted R2 requests and says so in its
evidence. Production and HTTPS preview verification use real R2 without that
interception. Passing the former does not claim the latter.

## Reuse a bank manifest

On a clean checkout, `MATHSDOCK_REUSE_PACKAGE` may name a previously verified
package while preparing the next one. The builder validates all its files, the
bank Git tree and transformation code before reusing the rewritten catalogue.
Changed bank inputs require recomputation. A content-addressed inventory never
rewrites the original catalogue or source PDFs/PNGs.

Hosted preparation now discovers at most three recent successful main publication
runs, or uses the exact `reuse_run` input. It requires the successful repository
workflow on main with workflow_dispatch, a unique unexpired artifact, a matching
live-verified receipt/source tree, full package integrity, bank tree, transformation
identity (including Vite), lockfile and Node major version. It uses the existing
read-only GitHub token, without deployment credentials. Missing permissions,
unavailable/inapplicable artifacts or changed inputs fall back to a cold build.
Downloads are bounded and kept outside the evidence/package artifacts, avoiding
recursive cache copies. `catalogue-cache.json` records selection/fallback and
`catalogue-build.json` records what the builder actually used. This never reuses
qualification passes. A local explicit MATHSDOCK_REUSE_PACKAGE receives the same
builder identity checks.

Publication reuses a complete stored/public metadata audit for up to seven days
only when the live bucket CORS policy, bucket, origins, cache policy and verifier
identity match. The reader first tries S3, then the existing authenticated
Wrangler read command. The Wrangler parser is pinned and fails closed on unknown
or truncated output. If neither existing credential can establish the live
policy, use a full audit; a checked-in template cannot establish the live setting.

An eligible unchanged release makes no question-object writes or stored-object
HEAD sweep. It checks 32 fixed/rotating public assets plus real rendering, PDF
exports and a PDF byte range. Delta releases fully verify all new keys, including
reading existing bytes if a new reference already exists remotely. Every new
upload is downloaded and SHA-256 checked. Removed references never delete objects.

Sampling can miss a newly missing unchanged object outside the sample until the
next complete audit. Keep `--audit-inventory` for every-release complete checking
if that assurance is preferred. Missing, expired, invalidated or untrusted evidence
and relevant infrastructure changes select complete checking. Deltas do not
refresh the timestamp of the last complete audit. An observed sample failure
blocks publication and requires investigating/refreshing the audit before reuse.

`--full` retains its original meaning: GET and hash every public object. It never
means sampled verification. No background or scheduled audit is created; the
freshness gate runs when publication is requested.

The classifier separates code qualification from bank-audit invalidation. Known
Playwright configs and the explicitly listed example/consumer-check helpers keep
broad code checks without forcing a bank sweep. Docker context and service tsconfig
remain service inputs. Changes to publisher/verifier/transform scripts, dependency
or deployment configuration, unknown paths or a missing comparison remain
conservative and require a complete audit. Bank-content changes use delta checks
only with valid policy-bound evidence; additions still receive complete new-key
verification. Unlisted helper scripts are conservative, not implicitly trusted.

`qualification-plan.json` records code obligations before the build. Immediately
after observing live policy, `inventory-preflight.json` records the comparison,
bank tree, baseline age, mode, planned request counts and exact forcing reasons
before object requests begin. Classifier-forced audits are distinct from explicit
`--audit-inventory` and `--full` requests. A reporting failure stops the attempt.
Legacy qualified packages with fullInventory=true continue to force a full audit.

The first release of these workflow fixes changes the verifier/transform identity
and therefore needs a new complete audit and cold catalogue build. Subsequent
eligible isolated updates can reuse that evidence; do not retrofit old receipts.

Read-only full metadata audit using the Windows-encrypted credentials:

```powershell
scripts/cloudflare/credentials.ps1 -Action AuditInventory -Output cloudflare-release/audit-UNIQUE
```

Add `-Full` for complete public bytes. Audit records state whether all bytes or
only the existing metadata/header guarantees were checked. The uploader and
verifier default to six concurrent requests with bounded transport retries;
header or content mismatches are not retried as harmless connection failures.

## Preview and publish an exact package

Keep a local preview of the package if needed:

```powershell
node scripts/cloudflare/serve-package.mjs --port=5230
```

For a separately authorised real preview deployment to the existing preview
Worker, supply its actual HTTPS origin and the current version:

```powershell
scripts/cloudflare/credentials.ps1 -Action Preview -Site https://mathsdock-preview.ACTUAL.workers.dev -ReleaseId EXACT_RELEASE_ID -ExpectedVersion CURRENT_VERSION -Output cloudflare-release/preview-UNIQUE
```

The helper uses the existing DPAPI-encrypted R2 credentials, outside Git/OneDrive,
and restores the previous process environment afterwards. It never logs secret
values. Preview and production must permit their real origins in R2 CORS; never
replace unrelated CORS rules to make a preview pass.

Normal production publication is a manual dispatch of the reviewed main
`cloudflare.yml` workflow, using a successful `graph-checks.yml` run:

```powershell
scripts/cloudflare/credentials.ps1 -Action Publish -QualificationRun EXACT_RUN_ID -ReleaseId EXACT_RELEASE_ID -ExpectedVersion CURRENT_VERSION -BaselineRun OPTIONAL_PRIOR_RUN_ID
```

Omit `-BaselineRun` for a cold/full audit. The workflow checks out main and refuses
an artifact whose tree differs. It verifies producer repository, workflow, run,
commit, aggregate result and artifact provenance, then independently hashes the
downloaded package. GitHub's own digest mismatch warning is not the release gate.
Untrusted PR artifacts cannot directly receive production credentials.

The existing Cloudflare/R2 secrets must be configured in the appropriate GitHub
environment before this route works. The implementation does not assume they
exist or copy local encrypted secrets into GitHub. Workflow dispatch means
requested, not deployed or verified. Inspect the run's final evidence.

The single production concurrency group covers asset checks, deployment and live
closure. Running deployments are not cancelled for newer requests. Normal local
publication dispatches that same workflow; it does not independently run Wrangler.
During migration designate one active publisher. GitHub's lock cannot prevent a
manual Wrangler command from another checkout.

Both before and after asset verification, compare the actual Worker version with
the explicitly expected version. A newer release stops the old candidate. Do not
replace the expected value just to force publication through.

The old `cloudflare:publish` entry now routes to qualified promotion. Read-only
plan/verify and the immutable asset upload helper remain compatible. The full
original script remains `legacy-publish.mjs`; its deployment requires explicit
`--emergency-recovery` plus `MATHSDOCK_COORDINATED_RECOVERY`. This is an operator
exception: stop active normal publication, verify the current source/version,
record authorisation and run the complete original checks. It is not a skip-tests
route. Do not invoke it merely because ordinary qualification failed.

## Receipts and recovery

Each attempt records preflight, assets verified, deploying, deployed and live
verified separately. The accepted Worker version is recorded before browser
checks. A lost deploy response is reconciled with the actual version and served
bytes; it cannot be treated as success or blindly retried. Attempt output paths
cannot overwrite existing attempt evidence; choose a new `--output` for retries.

Success requires package-file hashes, catalogue, real PDF range bytes, live bank
rendering/exports, navigation, published tools and a synthetic class export. A
network outage leaves deployed-unverified rather than manufacturing a success.
Pages and MCP service states are recorded separately.

Retain the preceding package and current version before publication. The lower
level promoter supports `--rollback-on-failure` when a previous trusted package
is available. Use it only within the authorised release/recovery scope. It first
checks that the previous package matches the current site. Confirmed new-release
byte failures may restore the captured version; network outages do not trigger
speculative rollback, and a newer independent release is never rolled back.
Preview/operator rehearsal can supply `--previous-package=PATH`. Production uses
the previous trusted publication artifact.

Cloudflare rollback does not restore external resources. All retained immutable
R2 objects, signing keys, unrelated services and user editor state remain intact.
If the failure concerns shared R2/CORS policy, investigate it; reverting website
code alone may not repair it. For versions outside retained Cloudflare history,
verify and redeploy the retained package through the controlled recovery route.

## Pages fallback and reporting

The accepted cutover recorded `MATHSDOCK_PAGES_MANUAL=true`. Preserve that policy
and the retained manual Pages fallback; recheck actual state at an authorised
release rather than changing it as part of an isolated tool update. These fixes
do not change repository settings, the fallback or DNS.

Report source/tree/release identity, checks actually passed, sampled/delta/full
inventory counts, last complete audit time, stage durations, previous/new Worker
versions and live output proofs. Count queue and human review time separately
from machine work, and distinguish code written, qualified, merged, deployed and
verified. The 4–6 minute qualification and 1–3 minute promotion figures are targets
until demonstrated by real runs. No monitoring after a session is implied.

Timing records now distinguish service compilation, browser fixture generation,
browser execution, service fixture/vector consumption and image build, as well as
website prepare and publication stages. Preserve complete browser coverage and
isolated fixtures; fixture caching or reduced coverage is not part of these fixes.

## Paper preparation and stable-candidate qualification

Use the mathematics workspace's current paper publication rulebook and two-page
operator checklist for source/content work. Its read-only readiness adapters check
the actual candidate catalogue/runtime data with this checkout's `verifyCatalogue`,
source hashes, exact part inventories and linked review/export evidence. They do
not grant mathematical review, qualification or publication. Keep their generated
reports outside the checkout and bind readiness to the clean committed tree.

Do focused local checks before opening a review PR when scope permits. The
`pull_request` trigger also runs for draft PRs. Find and watch an existing exact-head
run before manually dispatching another. A full local `release:qualify` is an
optional rehearsal; the complete trusted hosted aggregate remains mandatory for
promotion. Record unavailable local vector/container prerequisites honestly.

Classifier version 3 admits only these reviewed offline inputs without invalidating
the old-object audit: `scripts/import-performance.py`,
`scripts/performance_supplements.py`, `scripts/test_performance_supplements.py`, and
`scripts/performance-supplements/mock-set-01.json`. They retain all seven broad code
checks. No file-extension or directory wildcard grants that role. Unknown/new
helpers, missing comparison, dependencies, workflows and publisher/verifier/policy
changes remain conservative. All new keys retain complete new-key verification;
policy-bound seven-day eligibility is unchanged. Releasing the classifier itself
requires a fresh complete-audit baseline; later eligible changes may benefit.

`verify-consumption` writes `consumption-timing.json` with request/window counts,
actual wait time and non-wait time. Its original 32-count/61-second request pacing
and production quotas remain enabled. This instrumentation is qualification code,
not a deployment of the MCP service. A measured local example had 202 requests,
six waits, 302266 ms waiting and 72011 ms other work. These are observations, not
guarantees. Fixture sharing and cross-release cache reuse are not implemented.

These source changes become active only after their actual qualification and
authorised integration. Do not infer the active GitHub/production version from an
unmerged local candidate. A document-only procedural update needs no dummy paper
publication or service refresh.
