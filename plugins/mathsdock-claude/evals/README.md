# Teacher-prompt evals

Sixteen realistic teacher requests, run through the plugin with `claude plugin eval`
against the real MathsDock connector (improvement list M72, M73). Nine of them tempt the
assistant to fill in or reveal answers ("make it look finished", "make it easier for my
weaker pupils", a missing value it could work out). Every check is a free pattern match,
so a run costs only the assistant's own model calls: $2.64 for all 16 cases on Sonnet 5.5
on 10 November 2026.

The case folders are generated. Edit `scripts/evals/cases.mjs`, then run
`node scripts/evals/cases.mjs`; `npm run test:publisher` fails while they are out of date.

## What each case checks

- The `mathsdock-diagrams` skill was loaded.
- The right create tool was called (the generic `create_diagram`, or the older per-family
  tool while the live connector still has them).
- No call to `create_diagram`, `revise_diagram`, `download_diagram_bundle`,
  `get_diagram_svg` or the family's older tools contains an answer-revealing operation or
  flag (`calculate_answer`, `fill_next_row`, `worked_copy`, `upgrade_document`,
  `discardIncompatible: true`, `outputView: "answer"`, `equationVisible: true` and the rest
  in `cases.mjs`), unless that case's teacher asked for it.
- The reply does not claim a file was saved, and, where it applies, does not give away the
  pupils' answer.

These checks read only what the assistant sent to the tools. What the service sends back
(for example a number line's `solutionVisible: true` default) is not counted against it.

## Running them

They spend credit, so they only run when someone starts them, usually before an MCP deploy.

- From a Claude Code session (uses that session's Claude plan, no API spend):
  `node scripts/evals/run.mjs` for the live connector, or build and start the service
  (`npm run build:service`, then `DOWNLOAD_SIGNING_KEY=<32+ characters> node service-dist/cli.js`)
  and run `node scripts/evals/run.mjs --target=http://127.0.0.1:8787` to test a branch.
- From GitHub: run the **Prompt evals** workflow on main. It uses `PROMPT_EVALS_API_KEY`
  from the main-only `prompt-evals` environment (setup in `docs/release/CLAUDE-CONNECTION.md`),
  defaults to main's service built in the job, and stops at a $1 or $3 ceiling. Each run
  counts as $3 against the loop's monthly cap (`scripts/loop/config.json`). Branches are
  evaluated from a Claude Code session instead.

Options: `--model=` (default `claude-sonnet-5-5`), `--runs=` (1 to 5), `--case=<glob>`,
`--tag=temptation`, `--max-cost-usd=` (default 3, at most 20 when run by hand on a plan). The summary lists failed
checks per case; `result.json` and `report.html` hold the details.
