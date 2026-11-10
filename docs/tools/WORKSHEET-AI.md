# Worksheet AI maker

The Worksheets page (`/worksheets`, its own section of the site; the old `/tools/worksheet` address opens it) can make a two-sided A3 worksheet from a learning
objective with the teacher's own AI key, then apply change requests. Code: `src/worksheet/ai/`.

## How it works

- One request per click. The model runs the design guide's PLAN, FINALISE and PRODUCE stages inside
  one turn and calls a single tool, `submit_worksheet`, with `{plan, flags, resource}`. The resource
  schema is the same `packages/resource-core` schema the editor and MCP `create_worksheet` use.
- The page checks every submission: schema first, then the fixed A3 layout (`renderResource`). Any
  problem goes back to the model as the tool result; it gets four submissions in total. Text never
  shrinks; the model must move cards, trim wording or reduce working space.
- The system prompt holds the house rules, the whole `docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md`
  and one example sheet. It is byte-identical on every request so providers cache it.
- A change request sends the current worksheet plus the teacher's words; the result replaces the
  sheet as one undoable change. The plan and flags show under "Teacher notes from the AI" and are
  never printed.

## Providers

- Claude: `@anthropic-ai/sdk` in the browser (`dangerouslyAllowBrowser`), streaming, adaptive
  thinking with `output_config.effort`, prompt caching, eager tool-input streaming and, on Opus 5.5 and
  Sonnet 5.5, the server-side refusal fallback. No forced `tool_choice` (current models reject it).
- ChatGPT: `openai` Responses API in the browser, `reasoning.effort`, `store: false` with encrypted
  reasoning carried between fix attempts. The model list comes from the key's own `models.list`.
- A ChatGPT or claude.ai subscription does not include API use; each teacher needs an API key.

## Keys and privacy

- Keys are kept in `sessionStorage` (this tab) unless the teacher ticks "Remember my key on this
  device" (`localStorage`). They are never written into worksheet files, links or exports, and they
  go only to the chosen provider. The site CSP allows `connect-src` to `api.anthropic.com` and
  `api.openai.com` for this.
- Schemes of work are school information and never enter this repository. The department scheme
  is `schemes/school.json` in the private bank repository (`public/bank/assets/schemes/`), and it is
  the default objective list. `public/bank/schemes.json` names it; a release (`prepareSchemes` in
  `scripts/cloudflare/release.ts`) uploads it to R2 as an immutable `bank/assets/sha256/<hash>.json`
  object and rewrites the index to that key, and the site Worker serves it only to signed-in staff,
  like the question files. Packaging refuses an index that names an object outside the inventory.
  To update the scheme, commit the new file in the bank repository, update the submodule link
  here, and release. A teacher can also import another scheme file (MathsDock scheme JSON, or CSV
  `code,objective,unit`), kept on their device. Without the bank (quick pull-request builds) the
  index names a file that is not there, and the page offers typed objectives.

## Tests

`src/worksheet/ai/ai.test.ts` drives both SDKs against recorded-shape streams (no key needed),
including the layout-fix loop. `e2e/worksheet.spec.ts` makes a worksheet in the browser from a
scheme objective against a mocked Claude stream.
