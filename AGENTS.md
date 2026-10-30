# MathsDock project guidance

## Website release work

Read `docs/release/RELEASE-PIPELINE.md` before release work. Use the current main workflow,
an exact comparison baseline and the prior trusted publication. Keep qualification,
merge, deployment and live verification distinct; promote the exact qualified
package. Preserve newer concurrent work and the recorded live version. A request
for local implementation or review does not authorise publication.

Use the guide's compact release context and bounded `watch-run.mjs` command.
Read relevant evidence once, keep verbose logs on disk and report changed states.
Do not repeatedly read full histories or poll unchanged runs through model turns.
Explain preflight audit reasons; never remove required checks to obtain sampling.
Workflow changes require review and a separately authorised release before becoming
active on GitHub. Keep historical detail in linked reports.

For routine MCP publication read `docs/release/MCP-RELEASE-PLAYBOOK.md` and the short
checklist. Keep one source-bound release record and separate website/service/
package/client stages. Retain complete browser/full-service guarantees.

## Booklet tool development

Before planning, creating or substantially changing a MathsDock booklet tool or its MCP integration, read:

- `docs/tools/TOOL-CREATION-GUIDE.md`
- `docs/tools/TOOL-EVOLUTION.md`
- `docs/tools/TOOL-BRIEF-TEMPLATE.md`

Apply the relevant principles throughout design and implementation. Use the brief for new tools and the guide's acceptance checklist for review. Briefly identify the relevant principles before proposing changes. For edits to an existing tool, preserve its teaching purpose and saved-file compatibility without requiring a new full brief for a small fix.

Every new tool's first release includes an All tools output preview alongside its small icon. Follow `docs/tools/TOOL-CARD-PREVIEWS.md` for accurate examples, shared card integration and responsive verification.

The reusable development workflow is `.agents/skills/mathsdock-tool-creation/SKILL.md`. For conversations producing diagrams with the existing MCP connector, use `.agents/skills/mathsdock-diagrams/SKILL.md` and the capabilities exposed by the current connection. User requests and the project's existing approval rules govern implementation and release.

## Lesson resources

Before planning or producing a worksheet, booklet or other lesson resource, read
`docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md` (the `.docx` beside it is the master copy)
and `docs/content/RESOURCE-PROJECT-INSTRUCTIONS.md`. PLAN, FINALISE and PRODUCE are
the guide's Appendix A commands. Tim's current brief and latest corrections override
guide defaults.

## Maintaining the guidance

Keep the documents in `docs/` as the canonical source. `docs/README.md` maps them:
`tools/` for building tools, `release/` for publication, `content/` for questions and
lesson resources, and `archive/` for historical records that are not current instructions.
Put new guidance in the matching folder as Markdown and add it to that map. When changing guidance or skills, refresh the portable copies installed locally or included in the Maths Booklet Tools plugin, as applicable. Validate the skill frontmatter and reference links. Do not assume that publishing a plugin update rewrites definitions already cached in a conversation.

See `docs/tools/USING-TOOL-GUIDANCE.md` for locations, invocation and a fresh-conversation check.

## Bar modelling

Read `docs/tools/BAR-MODEL-BRIEF.md`, `docs/tools/BAR-MODEL-MCP.md` and the complete emitted
schemas before changing bar-model resources or their integration. Preserve shared
unit widths, stable part/span anchors and pupil/hidden-answer states. Removing
referenced structure requires an explicit brace choice; ordinary edits never
calculate answers. Actual service, plugin and intended-client adoption remain
separate from implementation and qualification.

The handwriting follow-up is [schema 3](docs/tools/BAR-MODEL-V3.md). Fresh browser
sessions use v3; frozen v1/v2 source, hashes and artwork remain controls. Preserve
12 mm above the upper answer-line stroke edge and 3 mm below its lower edge,
with actual uniform bars at least 20 mm for inside lines. Maths captions use
horizontal fractions; explicit Plain text is for literal slashes. No automatic
upgrade, evaluation, answer reveal, font reduction or horizontal resizing.
