# MathsDock documentation

These files are the canonical guidance for MathsDock. `AGENTS.md` at the repository
root says which documents to read before each kind of work; this page maps the rest.

The [autonomous loop merge policy](AUTONOMOUS-LOOP-POLICY.md) says which pull requests may merge
without Tim, which gates they pass first, and what always needs his go-ahead.

## tools/ — designing and building booklet tools

Start here for any new tool or substantial tool change.

- [Creating MathsDock tools](tools/TOOL-CREATION-GUIDE.md): design principles and acceptance checklist.
- [Lessons from Graph tool and Ratio tables](tools/TOOL-EVOLUTION.md): worked examples behind the guide.
- [New tool brief](tools/TOOL-BRIEF-TEMPLATE.md): copy this for each proposed tool.
- [Adding a booklet tool](tools/ADDING-BOOKLET-TOOLS.md) and the [shared booklet editor contract](tools/BOOKLET-CONSISTENCY.md).
- [All tools card previews](tools/TOOL-CARD-PREVIEWS.md).
- [Using the guidance in future conversations](tools/USING-TOOL-GUIDANCE.md).

Per-tool records:

- Graph: [MCP diagram outputs](tools/MCP-DIAGRAM-OUTPUTS.md), [direct SVG delivery](tools/DIRECT-SVG-DELIVERY.md), [six-tool MCP](tools/SIX-TOOL-MCP.md).
- Ratio tables: [editor](tools/RATIO-TABLE-TOOL.md), [MCP](tools/RATIO-TABLE-MCP.md).
- Plotting quadratics: [VALUE-GRAPH-TOOL.md](tools/VALUE-GRAPH-TOOL.md).
- Expanding and factorising: [editor](tools/EXPANDING-FACTORISING.md), [MCP](tools/ALGEBRA-GRID-MCP.md).
- Bar modelling: [brief](tools/BAR-MODEL-BRIEF.md), [MCP](tools/BAR-MODEL-MCP.md), [v3](tools/BAR-MODEL-V3.md), frozen [v2](tools/BAR-MODEL-V2.md), [emitted schemas](tools/BAR-MODEL-EMITTED-SCHEMAS.json).
- [Cuboids](tools/CUBOID-TOOL.md), [Number lines](tools/NUMBER-LINE-TOOL.md), [Triangles](tools/TRIANGLE-TOOL.md), [Venn](tools/VENN-TOOL.md), [Assessment follow-up](tools/ASSESSMENT-FOLLOW-UP.md).

## release/ — website and MCP publication

- [Release pipeline](release/RELEASE-PIPELINE.md) and [Cloudflare hosting](release/CLOUDFLARE-PUBLISHING.md).
- [Staff sign-in and the gated question bank](release/STAFF-SIGN-IN.md).
- [CI throughput](release/CI-THROUGHPUT.md): what each pull request runs, the lite bank, caches and batching.
- [MCP release playbook](release/MCP-RELEASE-PLAYBOOK.md), [checklist](release/MCP-RELEASE-CHECKLIST.md), [coverage map](release/MCP-RELEASE-COVERAGE.json) and [compatibility template](release/MCP-COMPATIBILITY-TEMPLATE.json).
- [MCP connector acceptance](release/MCP-CONNECTOR-ACCEPTANCE.md).
- Graph service: [runbook](release/GRAPH-MCP-RUNBOOK.md) and [ChatGPT connection](release/GRAPH-MCP-CONNECTION.md).

## content/ — questions, worked solutions and lesson resources

- [Maths Resource Design Guide](content/MATHS-RESOURCE-DESIGN-GUIDE.md) (text copy; the [.docx](content/MATHS-RESOURCE-DESIGN-GUIDE.docx) is the master) and the [lesson resource project instructions](content/RESOURCE-PROJECT-INSTRUCTIONS.md), including the PLAN, FINALISE and PRODUCE commands.
- [Per-question worked solutions](content/WORKED-SOLUTION-REGISTRATION.md).
- [Automatic question accessibility](content/ACCESSIBILITY-TESTING.md).
- [Past-paper examples in Graph tool and Ratio tables](content/TOOL-SOURCE-EXAMPLES.md).
- [Mock set 1](mock-set-01/README.md).

## archive/ — historical records

Kept for context; do not follow them as current instructions.

- [Editor layout audit, 14 October 2026](archive/EDITOR-LAYOUT-AUDIT.md).
- [Free ChatGPT graph setup, 6 October 2026](archive/GRAPH-MCP-FREE-SETUP.md).

## Example and data folders

The example folders (`*-examples/`, `mock-set-01/`, `brand/`, `number-line-card-example.json`,
`performance-import-report.json`) stay at the top of `docs/` because scripts, unit tests and
browser tests read or regenerate them at these paths.
