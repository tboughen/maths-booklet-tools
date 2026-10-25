---
name: mathsdock-tool-creation
description: Plan, build or substantially improve MathsDock booklet tools and their MCP integrations using the Graph tool and Ratio tables design guidance. Use for tool-development work, not ordinary requests to generate a graph or ratio-table resource.
---

# MathsDock tool creation

Make a complete teacher workflow: create a mathematically precise resource, edit it, preserve pupil scaffolds, export at a dependable physical size, save and reopen.

## Read the project guidance

Read [Creating MathsDock tools](../../../docs/TOOL-CREATION-GUIDE.md) before proposing a new tool or a substantial tool change. Read the relevant examples in [Tool evolution](../../../docs/TOOL-EVOLUTION.md). For a new tool, use [the brief](../../../docs/TOOL-BRIEF-TEMPLATE.md) to define reference outputs, interactions and acceptance cases. For repository implementation, read [Adding a booklet tool](../../../docs/ADDING-BOOKLET-TOOLS.md).

When running from a portable installation, prefer the current versions in an accessible `tboughen/maths-booklet-tools` checkout. Use the bundled references when the repository is unavailable. Keep tool-development work distinct from generating a resource through the existing connector.

Routine MCP releases use the [publication playbook](../../../docs/MCP-RELEASE-PLAYBOOK.md) and
[short checklist](../../../docs/MCP-RELEASE-CHECKLIST.md). Preserve the stronger
[connector-acceptance rules](../../../docs/MCP-CONNECTOR-ACCEPTANCE.md); service,
package and intended-client evidence are separate. Commands require an accessible
qualified repository checkout; a plugin does not bundle the release scripts.

## Apply the relevant decisions

- For new/changed MCP calls, follow [connector acceptance](../../../docs/MCP-CONNECTOR-ACCEPTANCE.md); distinguish service discovery,actual client calls and verified saved files. Algebra contract: [Expanding/factorising MCP](../../../docs/ALGEBRA-GRID-MCP.md).

- Follow the current [shared booklet editor contract](../../../docs/BOOKLET-CONSISTENCY.md): reuse the bounded download menu and actual-size readout, retain invalid drafts with guarded actions, preserve file/default compatibility and distinguish browser preview verification from publication.

- Start from what the teacher needs to produce and what the pupil should see, including print dimensions and deliberate blanks.
- Use the shared MathsDock shell, styles and tool registry. Make common values and labels editable on the diagram, with labelled keyboard alternatives and contextual settings.
- Reuse EditorToolbar for common utilities. Put specialist modes and settings in the right-hand inspector, retaining useful direct value editing and paired structure controls beside the resource.
- Include an actual output preview on every new tool's All tools card while preserving its small icon. Follow [All tools card previews](../../../docs/TOOL-CARD-PREVIEWS.md) for editable examples, renderer-derived SVGs, registry integration and responsive acceptance checks.
- Keep the white resource rectangle clean for snipping; visible utilities belong beyond it in blue space, aligned with their effect.
- Include editable examples linked to verified past-paper questions wherever suitable sources exist, preserving pupil blanks and making worked variants explicit.
- Put image-only Copy image first, keeping Copy for Word for physical-size insertion and a download fallback.
- Group structural controls beside their effect and pair adding with removing. Keep Copy for Word prominent. Check the largest supported structure and focused inputs on narrow screens.
- Distinguish mathematical content, teaching presentation and temporary editor state. Preserve empty cells, answer lines and zero as different states. Supply answers only through an explicit requested calculation action.
- Use one stored value for representations that share meaning. A repeated scaling factor must stay synchronized without silently changing the table values.
- Preserve invalid input for correction and block misleading exports. Keep local edits undoable, and preserve valid work through navigation, import cancellation and recovery.
- Validate actual SVG/PNG content, crops, dimensions and density. Check real Word insertion when changing that path, or record the outstanding check.
- Keep browser editing independent of the optional service. Share schemas, mathematics and rendering between delivery routes, and preserve compatible older files and links.
- If adding MCP access, document complete payloads and version/default distinctions; check actual discovery, create/revise, downloads and reopening in the editor. Website, service and client acceptance are distinct stages.
- For MCP print output, follow [MCP diagram outputs](../../../docs/MCP-DIAGRAM-OUTPUTS.md): keep print facts outside the definition/hash, qualify actual vector consumption, and keep placement advice and bundles optional, bounded and stateless. The consuming AI owns booklet assembly and saving.
- For original SVG delivery when a client cannot fetch signed downloads, follow [direct SVG retrieval](../../../docs/DIRECT-SVG-DELIVERY.md). Preserve exact artifact bytes and verify checksums through saved SVG into vector PDF. A restricted local SDK simulation does not establish actual ChatGPT acceptance.

Briefly identify which principles shape the proposed design, then use the task's scope to decide the necessary detail and checks. A small existing-tool fix does not require a full new-tool brief. A plan request remains a plan; skill invocation does not grant merge, deployment, hosting changes or expenditure.

## Handover

State what changed, the actual checks and results, repository/branch/PR where known, remaining decisions and the exact completed release stages. Use the guide's acceptance checklist and explain meaningful deviations. When improving a reusable convention, update the canonical guidance and any portable skill copies delivered with it.


For the eight-editor usability workspace, follow [the shared preview, example and quick-input contract](../../../docs/BOOKLET-CONSISTENCY.md#eight-editor-usability-workspace): whole-resource fit with fixed control gutters, real pupil thumbnails, confirmed scaffold replacement, immediate worked-version replacement with one-step Undo and bounded input adapters. Preview choices never change saved mathematics or physical output. Preserve grouped Apply/Cancel and inactive-editor guards.


## Usability refinement, 17 October — local candidate

Tim authorised implementing the follow-up plan. Preserve connector/output whitespace and physical dimensions; keep a calm white screen surround while reclaiming space from interface furniture. The preview uses measured available screen height and leaves completion feedback below the resource so copying does not shrink it. Keep fixed accessible structure controls outside the white resource. Grouped Triangle label editing is docked in the inspector with explicit Apply/Cancel. Graph and Number-line mathematical input is initially visible; calculations remain explicit. Copy image and Copy for Word retain their distinct existing payloads; extra file actions use an independent labelled File dropdown. Worked versions replace in the current editor without confirmation and are restored by one Undo, with Redo and earlier history retained. Preserve existing saved worked-file/link compatibility and pending-input guards. These are local candidate conventions, not publication evidence.

## Bar models

Use `bar_model_capabilities`, `create_bar_model` and `revise_bar_model` only when
actually discovered. Read [the implementation brief](../../../docs/BAR-MODEL-BRIEF.md),
[Bar-model MCP](../../../docs/BAR-MODEL-MCP.md),
[v2 compatibility](../../../docs/BAR-MODEL-V2.md), [v3 rules](../../../docs/BAR-MODEL-V3.md) and the
[complete emitted schemas](../../../docs/BAR-MODEL-EMITTED-SCHEMAS.json) for exact payloads.

| Resource or request | Version to use |
| --- | --- |
| New empty browser model | schema3 / bar-model-3 / lesson-v3 |
| Bare or legacy MCP creation | preserved v1 default |
| Explicit `spec.schemaVersion:2` | frozen v2 |
| New MCP output with current notation/writing space | explicitly request `spec.schemaVersion:3` |
| Supplied envelope | preserve its exact version, content and hash |

Preserve original variables, shared unit widths, exact weights/offsets, stable IDs, independent
inside/above/below slots, semantic fills and fixed versus whole-bar annotation
scope. Whole annotations follow the bar; fixed ranges retain endpoints. Exact
total-preserving repartitioning requires explicit discard of affected content.
Do not mask dividers, silently reanchor or add L-shaped callout leaders. Follow
departmental ratio-table guidance where applicable.

Pupil blank, question, line, hidden and zero states are distinct. Retain saved
text under blank/hidden displays. Editable files and links may contain hidden
answers. Never calculate, simplify, solve, reveal answers or make worked copies
implicitly. Captions are manual input. Maths is the default and typesets simple
a/b fractions horizontally across the full statement. Plain text is an explicit
choice for dates/literal slashes. Ambiguous or nested Maths retains the draft and
blocks export without automatic fallback or evaluation.

Every answer line reserves 12 mm clear above its upper stroke edge, a 0.25 mm
underline and 3 mm below its lower edge; the underline is 8 mm long. Inside lines
require uniform actual bars at least 20 mm high. Stored `barHeightMm` is a minimum
of 8..24 mm. Never change horizontal weights, offsets or shared units, shrink
fonts or compress handwriting space to fit. Use original returned SVG and native
dimensions; resizing changes the physical writing space.

Upgrade only explicitly. `upgrade_document` with `targetSchemaVersion:3` is once,
first in the batch: check the original `baseHash` before changes and roll back
the whole batch on later failure. Without a target it retains its v1-to-v2
meaning. Browser upgrades are previewed; one Undo restores the original version
and earlier history. Old dates may be explicitly kept as Plain text. There is no
read-time upgrade, lossy downgrade or silent answer reveal.

Original SVG retrieval, placement and bundles use `kind:"bar-model"` with the
exact saved envelope. Bars have pupil output only: do not pass `outputView`;
revealing saved answers requires an explicitly requested source revision.
Website readers for all issued versions must precede service issuance. Follow
the [dated publication/client evidence](../../../docs/BAR-MODEL-RELEASE-STATUS-2026-10-25.md); package publication
and SDK/browser proof do not establish actual Codex/ChatGPT or human acceptance.
