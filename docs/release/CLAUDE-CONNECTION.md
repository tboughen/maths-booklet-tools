# Connect MathsDock to Claude

The MathsDock MCP service (`https://maths-booklet-graph-mcp.onrender.com/mcp`, no
sign-in) works with Claude as well as ChatGPT. This guide covers claude.ai and Claude
Desktop, Claude Code with the MathsDock plugin, and the teacher-prompt evals.
It follows the same evidence rules as [MCP connector acceptance](MCP-CONNECTOR-ACCEPTANCE.md).
A step counts as working only when it has been tried on that surface. This is
improvement-list items M45 to M48, M50, M72 and M73.

Since 10 November 2026 the service runs on an always-on Render instance, so there is
no cold start to wait for.

## claude.ai and Claude Desktop

1. In Claude, open **Settings → Connectors** and choose **Add custom connector**.
   On Team and Enterprise plans an owner may need to add it for the organisation first.
2. Name it **MathsDock** and enter the URL above, ending `/mcp`. Leave the OAuth
   fields empty: the service is a bounded public renderer with no sign-in.
3. Add it, then in a new chat turn the connector on from the tools menu.
4. Add the skill once: run `node scripts/plugins/claude-plugin.mjs --zip=out` to make
   `out/mathsdock-diagrams.zip`, then upload it in **Settings → Capabilities → Skills**.
   Upload the new ZIP whenever the skill changes; claude.ai does not update it.
5. Check that the tools were discovered. The connector's version, `1.0.0+<build>`
   (M18), should match the start of the `buildId` reported by `/healthz`.

Claude Desktop custom connectors use the same settings and reach the service
from Anthropic's servers, not from the desktop app. After an MCP deploy, start a
new chat to pick up changed tools.

## Claude Code

Install the plugin from this repository's marketplace. It adds the connector and the
`mathsdock-diagrams` skill, and updates with `/plugin update mathsdock`:

```
/plugin install mathsdock --marketplace tboughen/maths-booklet-tools
```

On Claude Code older than 2.1.275, run `/plugin marketplace add tboughen/maths-booklet-tools`
then `/plugin install mathsdock@mathsdock`. From a checkout, `claude --plugin-dir
plugins/mathsdock-claude` tries it without installing. To add only the connector:

```
claude mcp add --transport http mathsdock https://maths-booklet-graph-mcp.onrender.com/mcp
```

The plugin's skill is a generated copy of `.agents/skills/mathsdock-diagrams/SKILL.md`
with documentation links pointing at the public repository. After changing the source
skill, run `node scripts/plugins/claude-plugin.mjs`. `npm run test:publisher` fails while
the copy is out of date. Bump the version in the plugin's `plugin.json` and in
`.claude-plugin/marketplace.json` together. Listing the plugin outside this repository
needs Tim's go-ahead.

## Teacher-prompt evals

`plugins/mathsdock-claude/evals/` holds 16 teacher requests that check the plugin and the
connector together, including requests that tempt the assistant to fill in or reveal
answers. They run with `claude plugin eval` against the real connector and only when
someone starts them, before an MCP deploy: `node scripts/evals/run.mjs` from a Claude
Code session (Claude plan), or the **Prompt evals** workflow (judges' API key, about $3 a
run, $3 ceiling). See the [evals README](../../plugins/mathsdock-claude/evals/README.md).

## After an MCP deploy

ChatGPT keeps the tool list it imported. When tools or their descriptions change, open
the MathsDock app in ChatGPT, choose **Manage app**, then **Refresh tools**, and try one
chat. The Deploy MCP run summary repeats this. Claude reads the list again in a new chat.

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
| claude.ai custom connector | Expected no: Anthropic's servers make the calls | Connects | 8 Nov 2026: Tim's claude.ai connector "Mathsdock" listed and ran the tools |

A browser page calling `/mcp` directly would be refused. That includes MCP
Inspector in direct mode and a future in-browser app. Following the acceptance
guide, the origin rule is **not** loosened in advance. If a real claude.ai or
Desktop test is refused with `invalid_origin`, record the exact response here.
Then allow-list that one origin in both checks, in a reviewed service release.

## Acceptance record

Fill this in when each surface is tried. Use the actual account, date and build.

| Stage | claude.ai | Claude Desktop | Claude Code |
| --- | --- | --- | --- |
| Connector added | 8 Nov 2026 (Tim) | | 8 Nov 2026 (cloud session) |
| Tools discovered with titles | | | Needs a build with #137 deployed |
| Graph created; preview, SVG, PNG and editor link work | | | 10 Nov 2026: plugin evals, live service, Sonnet 5.5 (links returned, not opened) |
| Revision with `baseHash` works | | | |
| Files actually retrieved | | | |
