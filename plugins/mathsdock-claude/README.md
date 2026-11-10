# MathsDock plugin for Claude Code

Connects Claude Code to the MathsDock MCP connector and adds the `mathsdock-diagrams`
skill, so Claude makes and revises editable teaching diagrams and A3 worksheets, keeps
pupil blanks and hidden answers, and returns real print files and editor links.

## Install

In Claude Code:

```
/plugin install mathsdock --marketplace tboughen/maths-booklet-tools
```

On Claude Code older than 2.1.275, add the marketplace first:

```
/plugin marketplace add tboughen/maths-booklet-tools
/plugin install mathsdock@mathsdock
```

To try a checkout without installing: `claude --plugin-dir plugins/mathsdock-claude`.

The plugin holds only the public connector address and the skill. There are no keys and
no sign-in. In claude.ai, add the connector by hand and upload the skill ZIP instead
(see [Connect MathsDock to Claude](../../docs/release/CLAUDE-CONNECTION.md)).

## What's inside

- `.mcp.json` points at `https://maths-booklet-graph-mcp.onrender.com/mcp`.
- `skills/mathsdock-diagrams/SKILL.md` is generated from
  `.agents/skills/mathsdock-diagrams/SKILL.md`, so don't edit it here. Run
  `node scripts/plugins/claude-plugin.mjs` after changing the source;
  `npm run test:publisher` fails while the copy is out of date.
- `evals/` holds the teacher-prompt evals (see `evals/README.md`). They spend API credit
  and run only when someone starts them.

## Releasing a new version

Bump `version` in `.claude-plugin/plugin.json` and in the repository's
`.claude-plugin/marketplace.json` together. Installed copies update with
`/plugin update mathsdock`. Listing the plugin anywhere outside this repository, such as
a public plugin directory, needs Tim's go-ahead.
