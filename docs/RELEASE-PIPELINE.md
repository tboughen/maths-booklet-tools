# MathsDock release pipeline

Website publication uses one identified build and complete qualification evidence.
GitHub main becomes the canonical production source only after the reconciled
candidate is reviewed, published and verified. Until that receipt exists, retain
the latest production pointer in the workspace release records. Implementing this
pipeline does not deploy the website, MCP service or client definitions.

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

## Pages transition and reporting

The existing Pages workflow remains automatic until the Cloudflare cutover is
accepted. After Tim authorises that change, set repository variable
`MATHSDOCK_PAGES_MANUAL=true` through the normal settings process. The last Pages
deployment remains available; manual dispatch can refresh it. This implementation
does not set that variable, delete the fallback or change DNS.

Report source/tree/release identity, checks actually passed, sampled/delta/full
inventory counts, last complete audit time, stage durations, previous/new Worker
versions and live output proofs. Count queue and human review time separately
from machine work, and distinguish code written, qualified, merged, deployed and
verified. The 4–6 minute qualification and 1–3 minute promotion figures are targets
until demonstrated by real runs. No monitoring after a session is implied.
