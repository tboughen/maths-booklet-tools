# Connect MathsDock to Claude

The MathsDock MCP service (`https://maths-booklet-graph-mcp.onrender.com/mcp`, no
sign-in) works with Claude as well as ChatGPT. This guide covers three surfaces:
claude.ai and Claude Desktop, Claude Code, and the draft Claude Code plugin.
It follows the same evidence rules as [MCP connector acceptance](MCP-CONNECTOR-ACCEPTANCE.md).
A step counts as working only when it has been tried on that surface. This is
improvement-list items M45 to M47.

The free Render service sleeps after 15 idle minutes. Before connecting, open
`https://maths-booklet-graph-mcp.onrender.com/healthz` and wait for its JSON
(about a minute) so the first discovery does not time out.

## claude.ai and Claude Desktop

1. In Claude, open **Settings → Connectors** and choose **Add custom connector**.
   On Team and Enterprise plans an owner may need to add it for the organisation first.
2. Name it **MathsDock** and enter the URL above, ending `/mcp`. Leave the OAuth
   fields empty: the service is a bounded public renderer with no sign-in.
3. Add it, then in a new chat turn the connector on from the tools menu.
4. Check that the tools were discovered. A current build shows titles such as
   "Create a coordinate graph" (M4). The connector's version, `1.0.0+<build>`
   (M18), should match the start of the `buildId` reported by `/healthz`.

Claude Desktop custom connectors use the same settings and reach the service
from Anthropic's servers, not from the desktop app.

## Claude Code

Either add the server directly:

```
claude mcp add --transport http mathsdock https://maths-booklet-graph-mcp.onrender.com/mcp
claude mcp list        # mathsdock ... √ Connected
```

or try the draft plugin from a checkout of this repository. The plugin adds the
same server plus the `mathsdock-diagrams` skill:

```
claude --plugin-dir plugins/mathsdock-claude
```

The plugin is a draft. It has no marketplace entry, and teachers are not pointed
to it until Tim agrees to publish it. Its skill is a generated copy of
`.agents/skills/mathsdock-diagrams/SKILL.md` with documentation links pointing at
the public repository. After changing the source skill, run
`node scripts/plugins/claude-plugin.mjs`. `npm run test:publisher` fails while
the copy is out of date.

## Origin check (M46)

The service rejects any request whose `Origin` header is not the service's own
origin (`services/graph-mcp/server.ts`). The SDK's DNS-rebinding protection
applies the same rule. This stops a web page from driving the service through a
visitor's browser.

| Client | Sends `Origin`? | Result | Evidence |
| --- | --- | --- | --- |
| Claude Code (`claude mcp add`, plugin) | No | Connects | 8 Nov 2026: `claude mcp list` and `--plugin-dir` both reported √ Connected against the live service |
| A request with `Origin: https://claude.ai` | Yes | 400 `invalid_origin` | 8 Nov 2026: probe of the live `/mcp` |
| A request without `Origin` | No | 200 | 8 Nov 2026: same probe |
| claude.ai / Claude Desktop connector | Expected no: Anthropic's servers make the calls | Not yet tried | Needs Tim's Claude account |

A browser page calling `/mcp` directly would be refused. That includes MCP
Inspector in direct mode and a future in-browser app. Following the acceptance
guide, the origin rule is **not** loosened in advance. If a real claude.ai or
Desktop test is refused with `invalid_origin`, record the exact response here.
Then allow-list that one origin in both checks, in a reviewed service release.

## Acceptance record

Fill this in when each surface is tried. Use the actual account, date and build.

| Stage | claude.ai | Claude Desktop | Claude Code |
| --- | --- | --- | --- |
| Connector added | | | 8 Nov 2026 (cloud session) |
| Tools discovered with titles | | | Needs a build with #137 deployed |
| Graph created; preview, SVG, PNG and editor link work | | | |
| Revision with `baseHash` works | | | |
| Files actually retrieved | | | |
