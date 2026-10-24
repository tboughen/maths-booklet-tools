# MathsDock MCP publication playbook

Version 1.0, 24 October 2026. Use this for routine MCP publication and qualification
work. Read the [operator checklist](MCP-RELEASE-CHECKLIST.md) first on resumption.
The [shared release pipeline](RELEASE-PIPELINE.md) owns website commands;
[connector acceptance](MCP-CONNECTOR-ACCEPTANCE.md) owns actual-client incidents.
Family pages own their payloads, versions and mathematics. This guide does not
grant merge, deployment, package publication, account or expenditure permission.
Commands require the qualified repository checkout; portable/plugin references
do not themselves contain these scripts.

## 1. Identify the candidate and scope

Resolve current main, the actual website/service/package identities and concurrent
candidates. Use an isolated clean committed checkout; preserve unfinished work.
Compare the complete intended baseline to the candidate, including unpublished
changes. Missing ancestry or unknown inputs selects broad requirements.

`classify.mjs` derives independent impacts from the actual diff: guidance, website,
service runtime, advertised metadata, shared interchange, qualification and
infrastructure. Mixed changes union requirements. Optional operator declarations
must include every derived impact. Qualification collectors keep broad code
checks; service-only code gets its own lint/types, protocol, vector and Linux proof.
No directory exemption or convenient comparison commit may conceal a change.

Maintain one compact record, not several manually synchronised reports:

```powershell
node scripts/cloudflare/mcp-release.mjs plan --base=EXACT_BASE --purpose="Describe the change" --scope=qualification --output=cloudflare-release/context-UNIQUE.json
```

The command requires clean committed source and refuses existing output. It
records commit/tree, impacts, policy, required checks and separate stage states.
`--declared=FILE.json` checks declared impacts against the actual classification.
Publication needs its recorded scope and the project's existing authorisation.
The helper records and guards decisions; it does not deploy or refresh tools.

Preflight intended-client access early. If unavailable, record it as pending and
continue independent authorised work; do not repeatedly ask for sign-in or claim
SDK proof establishes that client's acceptance.

## 2. Readiness and evidence

Retain the prior complete named catalogue, full input/output metadata, saved
envelopes and artwork controls. Record the independently reviewed expected added,
removed and changed names. `compareCatalogues` compares complete descriptors while
ignoring tool-list order; duplicate names, lost definitions or undeclared metadata
changes fail. Discovery follows all pages, with duplicate/cursor-loop bounds.
Keep the historical homogeneous-array negative control; it is not a universal
host validator. Count alone never proves the expected tools are present.

```powershell
node scripts/cloudflare/mcp-release.mjs catalogue --before=BEFORE.json --after=AFTER.json --delta=EXPECTED-DELTA.json --output=cloudflare-release/catalogue-UNIQUE.json
```

Catalogue files contain `{ "tools": [...] }`; the independent delta contains
explicit `added`, `removed` and `changed` name arrays, including empty arrays.

Each evidence item needs producer, relevant inputs, assertion IDs, hashes,
provenance, completion time and invalidation conditions. Keep logs/artifacts on
disk and reference them from the compact record. Verify immutable bytes once at
each trust boundary. Observe mutable live identities again before consequential
steps. File-transfer, link-expiry, artifact-retention and client changes have
different invalidation rules; the website bank audit's seven-day rule is not a
universal MCP receipt lifetime.

Freeze an explicit unique list of material files after readiness:

```powershell
node scripts/cloudflare/mcp-release.mjs freeze --record=cloudflare-release/context-UNIQUE.json --paths=cloudflare-release/material-paths.json --output=cloudflare-release/frozen-UNIQUE.json
```

`material-paths.json` is a JSON array of actual files relative to this checkout.
Include contract/coverage/expected-delta and relevant saved evidence. The helper
rejects outside/symlink paths, wrong candidate/policy and source movement during
hashing. It does not confer mathematical, live or client acceptance.

## 3. Qualify once for the exact stable candidate

Use focused local checks while developing. See the shared pipeline for the full
optional local rehearsal and mandatory trusted hosted aggregate. A draft PR also
triggers CI: inspect an existing exact-head run before dispatching another.
Use the bounded watcher, save full logs and report changed states only.
Failed publisher subprocesses retain stdout/stderr in `publisher-tap.json` as
well as their failed check receipt; inspect that artifact before repeating tests.

No cross-candidate test-pass cache exists. Reuse a successful identical-tree
qualification only with the same applicable policy, required checks and trusted
artifact. Failed/cancelled attempts are retained; never stitch partial unrelated
attempts into a manufactured pass. The aggregate rejects incomplete browser
coverage, overlapping shards, retries and skips.

Browser shards request `verify-consumption --profile=browser`. This creates the
nine actual editable sources, five bundles and metadata consumed by the unchanged
18 MCP browser cases. The independent full profile retains all source/SVG/600ppi
PNG checks, graph label/refresh controls, maximum cases, placement, all bundles,
direct SVG controls and shading/vector consumers. See the
[coverage map](MCP-RELEASE-COVERAGE.json). Production quotas/pacing remain enabled.

Each producer gets a fresh output directory. A fixture manifest binds every file
to source tree, service build, producer, workflow run and attempt. Validate before
and after browser use. Missing, extra, corrupt or wrong-source fixtures fail;
there is no silent regeneration. A fallback is a new explicitly recorded attempt.
Shared/cross-release fixture caching is not enabled. Local signed URLs do not
remain usable after the producing service stops; browser imports use saved files
and MathsDock links, not those dead download URLs.

Service qualification runs lint/types independently, full service tests, real
protocol fixtures, independent vector consumption and the bounded Linux image.
CI retains `qualified-service` for both mixed and service-only changes, with the
compiled service, fonts, locks/build-input hashes, full schemas and saved controls.
The artifact's `checked-service-artifact` record alone is not qualification: require
the matching sealed aggregate and trusted repository/run/attempt/artifact digest.
The final seal rehashes the service artifact against its service-check receipt.

Service-only and documentation-only preparation uses a source qualification
package without a dummy website build. Documentation references/frontmatter are
checked. A source-only package is explicitly rejected by website promotion.
Service-only qualification still needs live website interoperability at release.

Keep the existing service buildId interpretation. The artifact separately records
root/runtime locks, Docker/context/tsconfig, all compiled files and bundled fonts.
Verification files can still change the legacy buildId; this does not justify a
runtime deploy for a guidance-only change. A new runtime identity, registry or
identical-image promotion needs its own demonstrated benefit and compatibility
review. Render's current manual route rebuilds source; record it honestly.

## 4. Check compatibility before authorised mutation

Record current/current, current/new, new/current, new/new website-service pairs
and saved-legacy files, with versions, routes, pupil-state and output evidence.
`verifyCompatibility` requires explicit unique pairs; pending/incompatible rows
cannot report compatible-for-publication. Use the JSON matrix with:
Start from the [pending matrix template](MCP-COMPATIBILITY-TEMPLATE.json) and replace
its identity placeholders. A verified row needs evidence objects with actual
`path`, `bytes` and `sha256`. Each JSON receipt must say `status: "passed"` and
contain matching `websiteIdentity`, `serviceIdentity` and explicit `provenance`.
The checker reopens and hashes the receipt; strings alone cannot prove a pair.

```powershell
node scripts/cloudflare/mcp-release.mjs compatibility --matrix=cloudflare-release/compatibility.json --output=cloudflare-release/compatibility-result-UNIQUE.json
```

For additive work, publish compatible website support first if needed, then the
service, changed package guidance and actual-client acceptance. If a pair is
incompatible, design the compatibility window/recovery before publication.
The independent surfaces are not an atomic transaction. A website already
supporting the exact unchanged files need not be redeployed.

Use the existing controlled website publisher and existing manually deployed
service. Compare expected previous live identity before mutation, then compare
actual health build, complete schemas, HTTPS responses and saved outputs with
the authorised candidate. Do not change hosting, auto-deploy, endpoint, signing
keys, quotas or App identity to speed the release. Do not stop production simply
to repeat website-independence onboarding: use an isolated blocked-service test.

The graph runbook retains initial free-host/account setup, limits, key rotation,
old-link consequences and recovery. Those remain constraints, not mandatory
account-creation steps for every routine release. [Render deployment guidance](https://render.com/docs/deploys)
describes the provider's source-build/manual-deploy surface; inspect actual state.

## 5. Guard package and portable-guidance updates

Prepare an overlay from canonical source. Read the actual existing package and
compare expected base, current contents and proposed patch. `guardedOverlay`
preserves unrelated edits and rejects conflicts, deletions, unsafe paths, broken
relative links and App/presentation/audience manifest changes. Both version
manifests must agree. Preserve the stronger connector-acceptance text; never
replace it with an older repository snapshot. Include affected portable references.

```powershell
node scripts/cloudflare/mcp-release.mjs overlay --base=BASE-TEXTS.json --current=CURRENT-TEXTS.json --patch=PATCH-TEXTS.json --output=cloudflare-release/overlay-UNIQUE.json
```

The JSON inputs map package paths to exact UTF-8 text. Preserve binary assets
through the provider's existing partial-overlay mechanism and verify their
inventory; do not claim their bytes were re-downloaded if only sizes were read.
Re-read immediately before authorised upload, use conditional release checks if
available and verify readback. A provider without CAS has a race window; do not
claim the local guard creates a cross-provider lock. A verified no-op needs no
package publication. Installed and published copies have separate identities.

## 6. Resume without duplicate publication

Record planned/running/verified/failed/unknown per stage, with client/human pending
states separate. `stageDecision` requires distinct prior/target and freshly
observed identities. It rejects a newer independent release, reuses an applicable
verified stage, and asks for reconciliation after an interrupted response.
`recordStage` requires actual saved bytes and matching observed identity for a
verified result; SDK provenance cannot establish intended-client acceptance.
These are decision/record helpers, not a new deployment orchestrator.

```powershell
node scripts/cloudflare/mcp-release.mjs decision --record=RECORD.json --observation=OBSERVATION.json --output=cloudflare-release/decision-UNIQUE.json
node scripts/cloudflare/mcp-release.mjs stage --record=RECORD.json --observation=OBSERVATION.json --output=cloudflare-release/record-UNIQUE.json
```

For a decision supply `stage`, `before`, `target` and actual `observed` identity.
For a stage receipt supply `stage`, `status`, `target`, `observed`, `provenance`
and evidence objects with actual `path`, `bytes` and `sha256`. Commands recheck
candidate/policy and refuse existing outputs. Verified publication stages need
publication scope; a helper never grants permission to make the mutation.

After response loss inspect actual provider/build/package state before retrying.
Do not redeploy because a local process lost its place. Keep the prior compatible
source/package/build and signing-key support. On partial failure report each
surface's state. Recover only within authorised scope and version compatibility;
never roll back a newer unrelated release or rotate keys to hide a fault.

## 7. Prove the complete consuming journey

Use a synthetic resource through complete discovery, actual named create/revise,
returned MathsDock link/file, cancel/preserve current draft, apply, edit, Undo/Redo,
save JSON, revise that exact saved envelope/hash, actual artifact retrieval and
independent saved-byte/native-size verification. Reopen or assemble the verified
output and inspect it. Preserve blank/answer-line/zero/hidden states and stable IDs.
Retain affected desktop/mobile, old files, oversized-file fallback, maximum,
multi-chunk, UTF-8, stale-hash, vector, large-file and idle/wake requirements.
Record actual Codex, actual ChatGPT, SDK, browser rehearsal and user reports
separately. Native Word, phone keyboard, print and teacher checks remain explicit.

For directly connected custom MCP servers, after metadata changes refresh the
existing connection, inspect the advertised definitions and test affected calls
in a fresh conversation. Published distributions have a separate reviewed update
process. Follow the current [official connection/testing guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)
and [distribution guide](https://developers.openai.com/plugins/deploy/submission),
checked 24 October 2026; account/workspace access still applies. Do not treat a
package update or an ending spinner as proof of import or saving.

Use the bounded incident guide when tools are missing: reconcile identities,
inspect actual import error, make one relevant fresh-client comparison, then
test a discriminating hypothesis. No indefinite refresh loop, invented cache
cause, speculative schema change or promised waiting period. If access is
unavailable keep acceptance pending while finishing independent authorised work.

## 8. Measure and adopt

Measure qualification and website/service/package/client closure separately.
Report queue/setup, quota waits, processing, provider/cold-start, client and human
delays; distinguish critical-path wall time from overlapping runner minutes.
Retain request/byte counts, fixture runs, manual steps, retries and recovery cost.
For a general speed claim use at least three comparable observations with exact
product/harness identity, suite size, environment and warm/cold conditions; report
median/range. Do not create duplicate full hosted runs or dummy deployments to
populate a benchmark. Token/cost counters remain unknown when unavailable.

Targets are complete coverage, no unnecessary duplicate exact-candidate runs,
no guidance-only runtime deploy, <=720-second browser jobs under the existing
900-second limit, and a measured reduction in matched qualification time. Faster
fixtures do not establish faster end-to-end publication. Reject an optimisation
that adds recovery burden or complexity without demonstrated benefit.

Run component failure tests during implementation, then one stable-candidate
trusted qualification. Adopt on the next authorised relevant release. Report
implemented/tested/qualified/merged/deployed/live-verified/client-accepted stages
separately; do not call a candidate active on main. Only Tim confirms Done.
