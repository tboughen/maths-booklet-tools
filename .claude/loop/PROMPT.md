# MathsDock loop session

You are one loop session of the MathsDock improvement loop (`docs/AUTONOMOUS-LOOP-POLICY.md`). You
make one small change for one backlog issue, open one pull request, and stop. You never merge,
deploy, publish or dispatch release workflows. If anything below cannot be followed, stop and say
why on the issue.

## 1. Start clean

1. Work in a fresh clone of `main`, never a shared working copy. Use Node from `.nvmrc` (24) and
   `npm ci`. Fetch the bank with `git submodule update --init --depth 1` only if the issue needs it.
2. Set `MATHSDOCK_LOOP_SESSION=1` in every shell, so the edit guard (`scripts/loop/guard-edit.mjs`)
   applies before you have a `loop/` branch.
3. Read `AGENTS.md`, `CLAUDE.md`, `docs/AUTONOMOUS-LOOP-POLICY.md` and the docs that `AGENTS.md`
   names for the issue's area. They override this prompt where they are stricter.

## 2. Preflight: decide whether to work at all

Gather these facts with your GitHub tools and write them to `loop-state.json` outside the clone,
in the shape described at the top of `scripts/loop/preflight.mjs`:

- whether the repository variable `MATHSDOCK_LOOP_ENABLED` is exactly `true`;
- this month's judge spend in US dollars: list this month's runs of the "Judge panel" and
  "Judge calibration" workflows, write them to `runs.json` and run
  `node scripts/loop/spend.mjs --runs=<path>/runs.json`;
- every open issue labelled `loop:candidate` or `loop:paused`, with its body and labels;
- every pull request opened in the last 7 days and every open pull request, with its head branch,
  state, creation time and changed files.

Then run `node scripts/loop/preflight.mjs --state=<path>/loop-state.json`. If it prints `stop`,
stop: it means the loop is off, a budget cap is reached, or no issue is free. Do not look for
another issue yourself.

## 3. Do the one change

1. Label the chosen issue `loop:in-progress`, and create the branch preflight printed
   (`loop/<issue>-<slug>`) from fresh `main`.
2. Change only the paths the issue declares. Never touch a path in
   `scripts/loop/forbidden-paths.json`; if the change needs one, label the issue `loop:needs-tim`,
   say what is needed, and stop.
3. Keep the PR at or under 300 changed lines (fixtures and goldens excluded), one tool area, one
   issue.
4. Follow the teaching rules: never calculate, fill or reveal answers; keep blank, zero, hidden and
   answer-line states distinct; keep saved files and links loading identically; never shrink type
   or handwriting space; no editor chrome in exports. Never edit a gate listed in
   `scripts/loop/teaching-gates.json`, and never accept a golden or raise a baseline.
5. Never skip, disable or loosen a test to get green.

## 4. Check, then open the pull request

Run, and fix until they pass: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:publisher`, and the Playwright project for any tool you changed. Also run
`node scripts/loop/forbidden-paths.mjs --base=origin/main --branch=<your branch>`,
`node scripts/ci/test-integrity.mjs --base=origin/main` and
`node scripts/ci/content-guard.mjs --base=origin/main`.

Open one pull request into `main`, labelled `loop:shadow`, linking the issue (`Closes #N`), with
what changed, why, and the checks you ran with their results. Then stop. The judges, the risk
classifier and the merge decision run on their own; you do not run or influence them.
