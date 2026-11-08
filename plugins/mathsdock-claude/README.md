# MathsDock plugin for Claude Code (draft)

Connects Claude Code to the MathsDock MCP service and adds the `mathsdock-diagrams`
skill, so Claude can create and revise editable teaching diagrams with real print
files and editor links.

Try it from a checkout of this repository:

```
claude --plugin-dir plugins/mathsdock-claude
```

- `.mcp.json` points at `https://maths-booklet-graph-mcp.onrender.com/mcp` (no sign-in).
- `skills/mathsdock-diagrams/SKILL.md` is generated from
  `.agents/skills/mathsdock-diagrams/SKILL.md`, so don't edit it here. Run
  `node scripts/plugins/claude-plugin.mjs` after changing the source.

The plugin is not published, and there is no marketplace entry. Publishing it is a
separate step that needs Tim's go-ahead. See
[Connect MathsDock to Claude](../../docs/release/CLAUDE-CONNECTION.md).
