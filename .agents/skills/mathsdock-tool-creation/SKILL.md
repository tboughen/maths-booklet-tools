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
- For MCP print output, follow docs/MCP-DIAGRAM-OUTPUTS.md: keep print facts outside the definition/hash, qualify actual vector consumption, and keep placement advice and bundles optional, bounded and stateless. The consuming AI owns booklet assembly and saving.
- For original SVG delivery when a client cannot fetch signed downloads, follow [direct SVG retrieval](../../../docs/DIRECT-SVG-DELIVERY.md). Preserve exact artifact bytes and verify checksums through saved SVG into vector PDF. A restricted local SDK simulation does not establish actual ChatGPT acceptance.

Briefly identify which principles shape the proposed design, then use the task's scope to decide the necessary detail and checks. A small existing-tool fix does not require a full new-tool brief. A plan request remains a plan; skill invocation does not grant merge, deployment, hosting changes or expenditure.

## Handover

For the refined bar editor read [Bar model v2](../../../docs/BAR-MODEL-V2.md).
Keep the frozen v1 path and explicit undoable upgrade; independent section slots,
fixed/dynamic annotation scope, exact total-preserving repartitioning and retained
answer states are common-core rules. Qualify dense actual output under unchanged
limits. Website bridge, service/package adoption and actual client acceptance are
separate gates; a prepared overlay is not a published plugin.

State what changed, the actual checks and results, repository/branch/PR where known, remaining decisions and the exact completed release stages. Use the guide's acceptance checklist and explain meaningful deviations. When improving a reusable convention, update the canonical guidance and any portable skill copies delivered with it.


For the eight-editor usability workspace, follow [the shared preview, example and quick-input contract](../../../docs/BOOKLET-CONSISTENCY.md#eight-editor-usability-workspace): whole-resource fit with fixed control gutters, real pupil thumbnails, confirmed scaffold replacement, immediate worked-version replacement with one-step Undo and bounded input adapters. Preview choices never change saved mathematics or physical output. Preserve grouped Apply/Cancel and inactive-editor guards.


## Usability refinement, 17 October — local candidate

Tim authorised implementing the follow-up plan. Preserve connector/output whitespace and physical dimensions; keep a calm white screen surround while reclaiming space from interface furniture. The preview uses measured available screen height and leaves completion feedback below the resource so copying does not shrink it. Keep fixed accessible structure controls outside the white resource. Grouped Triangle label editing is docked in the inspector with explicit Apply/Cancel. Graph and Number-line mathematical input is initially visible; calculations remain explicit. Copy image and Copy for Word retain their distinct existing payloads; extra file actions use an independent labelled File dropdown. Worked versions replace in the current editor without confirmation and are restored by one Undo, with Redo and earlier history retained. Preserve existing saved worked-file/link compatibility and pending-input guards. These are local candidate conventions, not publication evidence.

## Bar modelling

For bar-model resources or development read [Bar-model MCP](../../../docs/BAR-MODEL-MCP.md) and [the implementation brief](../../../docs/BAR-MODEL-BRIEF.md). Call bar_model_capabilities/create_bar_model/revise_bar_model only when actually discovered. Preserve shared unit widths, anchored spans, original variables and hidden answers; do not infer answers or reconstruct artwork from previews. New guidance alone does not establish service or intended-client availability.
