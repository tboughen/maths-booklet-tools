# MathsDock project guidance

## Website release pipeline implementation

The publishing improvements are implemented for review in the publishing branch.
Read `docs/RELEASE-PIPELINE.md` and `docs/CLOUDFLARE-PUBLISHING.md` before release
work. Do not declare this source production or main canonical until a reviewed
cutover actually succeeds. Preserve the workspace's latest verified production
pointer and any newer concurrent release. Qualification, merge, deployment and
live verification are distinct. Normal promotion consumes an exact qualified
package; it does not rebuild or bypass missing checks. Pages automation remains
unchanged until the cutover gate and Tim's authorisation are satisfied.

## Booklet tool development

Before planning, creating or substantially changing a MathsDock booklet tool or its MCP integration, read:

- `docs/TOOL-CREATION-GUIDE.md`
- `docs/TOOL-EVOLUTION.md`
- `docs/TOOL-BRIEF-TEMPLATE.md`

Apply the relevant principles throughout design and implementation. Use the brief for new tools and the guide's acceptance checklist for review. Briefly identify the relevant principles before proposing changes. For edits to an existing tool, preserve its teaching purpose and saved-file compatibility without requiring a new full brief for a small fix.

Every new tool's first release includes an All tools output preview alongside its small icon. Follow `docs/TOOL-CARD-PREVIEWS.md` for accurate examples, shared card integration and responsive verification.

The reusable development workflow is `.agents/skills/mathsdock-tool-creation/SKILL.md`. For conversations producing diagrams with the existing MCP connector, use `.agents/skills/mathsdock-diagrams/SKILL.md` and the capabilities exposed by the current connection. User requests and the project's existing approval rules govern implementation and release.

## Maintaining the guidance

Keep the documents in `docs/` as the canonical source. When changing guidance or skills, refresh the portable copies installed locally or included in the Maths Booklet Tools plugin, as applicable. Validate the skill frontmatter and reference links. Do not assume that publishing a plugin update rewrites definitions already cached in a conversation.

See `docs/USING-TOOL-GUIDANCE.md` for locations, invocation and a fresh-conversation check.
