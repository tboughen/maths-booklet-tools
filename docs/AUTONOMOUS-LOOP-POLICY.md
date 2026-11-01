# Autonomous improvement loop: merge policy

Version 2, 1 November 2026 (phase 2 under the unanimous-pass rule); version 1 (draft), 31 October
2026. This policy is guidance (tier T7 below): it changes only when Tim approves the change.

The loop lets Claude sessions make many small MathsDock improvements and merge the safe ones, so
that Tim reviews only what needs his judgement. This file says what may merge without him, what
must pass first, and what never happens without his explicit go-ahead. The research behind it is
chapter L of the improvement list (`improvement-list/06-autonomous-loop.md` in the project files).

## 1. What Tim has authorised

On 31 October 2026 Tim gave **standing authorisation for auto-merge**: Claude may merge pull
requests into `main` without asking each time, within this policy.

The grant covers the **merge stage only**. Everything else in the CLAUDE.md stage list still needs
Tim's explicit go-ahead each time: release qualification sign-off, website deploy
(`cloudflare.yml`), preview deploy, Render service deploy, plugin publication, client adoption,
DNS, R2 and CORS, secrets, quotas, paid services and the ChatGPT App identity. A merge never
starts a deploy. A bad merge can at worst reach production in Tim's next authorised release, and
the release summary lists every merge since the last publication (section 7).

Tim can narrow or withdraw the grant at any time with a message in any thread.

## 2. Two kinds of pull request

| Kind | Who asked for it | Merge path |
| --- | --- | --- |
| **Thread PR** | Tim asked for the work in a project thread | The thread opens one PR, keeps it green and reports to the coordinator. The coordinator decides when it merges, alone or in a batch, once required checks pass. A thread merges its own PR only when the coordinator asks. |
| **Loop PR** | Nobody; picked from the backlog (`loop:candidate` issue) | Branch `loop/<issue>-<slug>`. Merges automatically only when its tier is enabled for the current phase (section 4), every gate for that tier passes, and all three judges pass (the unanimous-pass rule, section 4). Otherwise it waits for Tim with `loop:needs-tim`. |

Tim asking for a piece of work approves merging the result, including guidance, workflow or
schema changes he asked for. It does not approve anything outside that ask.

## 3. Risk tiers

`scripts/loop/classify-risk.mjs` will assign the tier from the changed paths, building on
`scripts/cloudflare/classify.mjs`, then raise it on observed behaviour: any change in golden
output, saved-file round trips, schema or MCP catalogue, or the bundle budget moves the PR up.
Unknown paths are the highest tier. A PR takes the tier of its riskiest file.

| Tier | Name | Paths (examples) | Extra conditions | Loop PR merge |
| --- | --- | --- | --- | --- |
| T0 | Test additions | new `**/*.test.ts(x)`, new `e2e/*.spec.ts`, new fixtures | no assertion removed or weakened; no golden accepted | auto from phase 2 |
| T1 | Non-guidance docs | tool records in `docs/tools/*.md` other than canonical guides | links and frontmatter valid | auto from phase 2 |
| T2 | Screen-only UI polish | `src/**/*.css`, `src/site/**`, non-export copy | every output golden unchanged; only declared screens differ; no new axe violations; all three judges pass | auto from phase 3 |
| T3 | One tool's editor behaviour | `src/<tool>/**` except storage, interchange and export code | goldens and saved-file corpus unchanged; undo tests run; all three judges pass | auto from phase 4 if metrics hold |
| T4 | Core maths and renderers | `packages/*-core/src/**`, `assets/graph-fonts/**` | unchanged goldens: as T3. Any golden change: Tim | Tim when output changes |
| T5 | Saved schema, interchange, storage keys | `**/interchange*`, `**/schema*`, `**/storage*`, emitted schemas | always | Tim |
| T6 | MCP service and advertised metadata | `services/**`, `Dockerfile*`, `render.yaml`, `tsconfig.service.json` | always | Tim |
| T7 | Guidance and teaching rules | `AGENTS.md`, `CLAUDE.md`, canonical docs, this policy, `.agents/skills/**`, judge rubrics | always | Tim |
| T8 | Release, infrastructure, bank, credentials | `scripts/cloudflare/**`, `scripts/ci/**`, `.github/**`, `package*.json`, `wrangler*`, `vite.config.ts`, Playwright configs, `public/bank/**`, `bankAssets.ts` | loop sessions must not author these | never by the loop |

Loop PRs are capped at 300 changed lines (fixtures excluded), one tool area and one issue. Larger
PRs go to `loop:needs-tim`.

## 4. Phases

Phases never advance automatically. Tim approves each step from the weekly digest.

**Unanimous-pass rule (Tim, 1 November 2026).** From phase 2, a loop PR in an enabled tier
auto-merges only when the teacher, product and adversarial judges all return `pass` and every gate
passes. Any `concerns` or `fail` from any judge, or a judge that did not run, sends the PR to Tim
with `loop:needs-tim`; a concern is a reason to ask, not a veto. "Agreement" in the exit criteria
and in section 7 therefore means: of the PRs the panel passed unanimously, the share Tim accepts
when he reviews them (in the shadow log, then in the digest sample). The digest also reports the
share of loop PRs the panel sent to Tim, so a panel that raises too many concerns is visible even
though it cannot cause a bad merge.

**Phase 1 result (1 November 2026).** 20 loop PRs (#82 to #102, not counting the rubric change
#96). Strict agreement was 14 of 20 (70%), below the 85% written in version 1. All six
disagreements were judge concerns on PRs Tim chose to merge; the panel never passed a PR Tim
rejected. Under the unanimous-pass rule agreement was 14 of 14, calibration recall was 7 of 7 and
there was no false pass on a teaching-rule class, so Tim approved phase 2. This redefines the
version 1 measure after the result, openly and by Tim's choice; strict agreement keeps being
reported alongside it. Evidence:
`loop/shadow-log.md` in the project files.

| Phase | What happens | Exit criteria |
| --- | --- | --- |
| 0 Foundations (done 31 October 2026) | Wave 1 gates (section 5) built as thread PRs. No loop PRs. | Gates run in CI on every PR; branch protection on. |
| 1 Shadow (done 1 November 2026) | The loop opens `loop:shadow` PRs nightly and every gate and judge runs, but **nothing auto-merges**. Tim's verdict on each PR is logged against the judges'. | 20 or more PRs; judge recall at least 0.9 on the calibration set; agreement with Tim at least 85% (unanimous-pass agreement, above); no false pass on a teaching-rule class. |
| 2 (approved 1 November 2026; starts when section 8 items 2 and 7 are done) | Auto-merge T0 and T1 under the unanimous-pass rule. Everything else still goes to Tim. | Two weeks with no escaped defects or loop reverts. |
| 3 | Add T2. | Escaped defects at most 1 in 30 merged PRs; unanimous-pass agreement at least 90%, measured over at least 30 PRs that all three judges passed (Tim, 1 November 2026: a minimum, so a panel that rarely passes anything cannot score well). |
| 4 (optional) | Add T3 and golden-identical T4 refactors. | Phase 3 metrics held for four weeks. |

T5 to T8 never auto-merge from the loop.

## 5. Gates

Deterministic gates decide; judges only add evidence on top. Measured facts (millimetres, point
sizes, hashes) are never left to a judge.

**Every PR, every tier (quick checks, `docs/release/CI-THROUGHPUT.md`):** lint, type check, unit
tests (affected or all), publisher tests and a build.

**Wave 1, built next as ordinary PRs:**

1. Every Playwright config runs headless in CI, plus a short browser smoke job for UI changes.
2. A lite bank fixture so tests run without the full private bank (done in quick checks).
3. In-repo output goldens rendered in Node (resvg and the bundled fonts, no system fonts), checking
   canonical JSON, SVG hash, millimetre size, PNG pixel size and 600 ppi.
4. A physical-size gate: SVG and PDF page millimetres, minimum type size and handwriting space.
5. Teaching-rule gates: blank, zero, hidden and answer-line states stay distinct through save and
   load, and exact fractions stay exact.
6. An export-chrome gate: no editor handles, controls, focus rings or warnings in any export.
7. An answer canary: a sentinel answer in every hidden-answer fixture must never appear in a
   pupil-mode SVG, PNG text or PDF text layer.
8. A schema and MCP catalogue diff against committed contracts.
9. axe accessibility checks that fail only on new serious or critical violations.
10. A test-integrity check: deleted or loosened assertions, new `skip`/`only`, deleted tests or
    changed golden values escalate the PR to Tim.
11. Branch protection on `main` with these checks required (Tim's setting, section 8).

**Wave 2:** the tier classifier, the judge panel (teacher, product and adversarial judges with no
shared context, scored against rubrics drawn from the Maths Resource Design Guide and the tool
acceptance checklist), a seeded known-bad calibration set, and the shadow-mode runner.

Goldens change only through an explicit accept command that records the reason. A PR that changes a
golden is T4 or higher and waits for Tim.

## 6. Rules that always apply

These hold for every PR, whoever wrote it, and no golden update inside a loop PR can override them:

- Never calculate, fill or reveal answers, and never change a saved schema implicitly.
- Blank, zero, hidden and answer-line states stay distinct; exact fractions stay exact.
- Saved files and links keep loading identically; upgrades are explicit and undoable.
- Meaningful edits are undoable; invalid drafts stay visible with specific errors.
- No editor chrome in exports; physical size, type size and handwriting space never shrink.
- Never skip, disable or quarantine a test to get green; never weaken an assertion to pass.
- Original papers, mark schemes, full worked masters, pupil or school data and credentials never
  enter the repository.
- Loop sessions get no Cloudflare, R2, Render or deploy secrets, and no workflow runs judge code
  with secrets on fork PRs (the repository is public; no `pull_request_target`).
- The loop never rebases, force-pushes or reverts anyone else's work, and skips any issue whose
  files overlap an open PR that is not its own.

## 7. Reversal, suspension and reporting

- **Revert.** If a loop merge breaks `main`, the loop reverts its own commit and pauses until the
  cause is fixed. It never reverts anyone else's commit; it opens an issue instead.
- **Suspension.** Auto-merge stops when: the repository variable `MATHSDOCK_LOOP_ENABLED` is not
  `true`; a PR has `loop:hold`; judge calibration falls below threshold; Tim rejects or reverts
  any PR the panel passed unanimously (until he reviews why and resumes it; resumed misses still
  count against the phase 3 target); two loop reverts happen within seven
  days; or a budget cap is reached.
- **Who applies a suspension.** The auto-merge workflow checks only the variable and the
  `loop:hold` label itself; the other triggers have no automation yet, so they still bind but are
  applied by people. When the loop or the coordinator sees one, it stops opening loop PRs, adds
  `loop:hold` to any open loop PR (which cancels a queued merge) and tells Tim. Only Tim changes
  `MATHSDOCK_LOOP_ENABLED` (to stop: set it to `false`, then run "Loop auto-merge" from the Actions
  tab to cancel every queued merge) and only Tim switches it back on.
- **Pausing for a release.** While a release is being qualified or published, new loop PRs stay
  drafts (no CI, no judges, no auto-merge) or carry `loop:hold`, so `main` does not move under the
  release. They are marked ready once the release is published.
- **CI budget.** Job slots are the scarce resource. Loop and thread PRs push rarely, open drafts
  while working, and the coordinator batches merges (`docs/release/CI-THROUGHPUT.md`). The loop
  never dispatches release qualification.
- **Weekly digest for Tim** (aim: under 15 minutes): merged PRs grouped by tool with before and
  after images, PRs waiting for him and why, reverts, flaky tests, judge calibration, spend, and a
  sample of ten merged or rejected PRs for him to agree or disagree with.
- **Release summary.** When Tim dispatches qualification, the evidence lists every merge since the
  last publication with its tier, so he sees what a release would ship.

## 8. Still needed from Tim

Each of these is a one-off decision; none is needed until the matching phase.

1. Protect `main`: require PRs and the quick-checks job, block direct and force pushes (before phase 1).
2. Turn on `allow_auto_merge` and `delete_branch_on_merge` in the repository settings (before phase 2).
3. An `ANTHROPIC_API_KEY` repository secret with a spending limit, for the judges (before phase 1).
4. The loop runner: a scheduled cloud session trigger, and a monthly spend cap in pounds (before phase 1).
5. Approve the judge rubrics and the calibration set as the definition of good enough (before phase 3).
6. Each phase change, from the digest.
7. Approve the auto-merge step itself: a workflow change (tier T8, so a thread PR, never a loop PR)
   that merges a loop PR only under the unanimous-pass rule (before the first phase 2 merge).
   Done 1 Nov: `loop-auto-merge.yml` merged in #105 and switched on by Tim at 17:10.
