# Using MathsDock guidance in future conversations

The project `AGENTS.md` directs tool-development work to the design guide, evolution examples and new-tool brief. The skills under `.agents/skills` provide focused workflows for developing tools and producing diagrams with the existing MCP connector.

## Start a development task

For MCP work, also read [connector acceptance and incidents](MCP-CONNECTOR-ACCEPTANCE.md). The development skill requires it for new/changed calls and missing-tool investigations. Plan actual intended-chat import, execution and verified file saving early; retain separate evidence for service, package, connection and consumer stages.

Start the task in the MathsDock repository or a worktree containing the current documentation and `AGENTS.md`. Codex reads project instructions from its working-directory hierarchy; a different project does not automatically inherit this repository's instructions.

The `mathsdock-tool-creation` skill is suitable for a new booklet tool or a substantial change to an existing editor or MCP integration. It reads the guide and relevant examples, uses the brief for new tools, and applies the acceptance checklist during review. Small fixes use the relevant principles without requiring a full new-tool proposal.

An explicit starting prompt is:

> Use $mathsdock-tool-creation to plan this MathsDock tool. Read the tool creation guidance, explain the relevant principles, and complete the new-tool brief before proposing implementation.

For a check in a fresh conversation, ask:

> Which MathsDock instruction files and guidance have you read, and how will you apply them to this task?

The answer should identify the actual documents read and the relevant decisions. Merely listing filenames is not a design review.

## Use the existing connector

For a resource-making conversation, use `mathsdock-diagrams` with the connected Maths Booklet Tools plugin. Its guidance covers Graph, Ratio tables, Plotting quadratics, Cuboids, Number lines and Venn; actual discovery decides which calls are available in a conversation. It preserves pupil scaffolds, revises the returned envelope and hash, and returns real downloads and editor links. See [Six-tool MCP](SIX-TOOL-MCP.md) for the source contracts and release gates. Plugin skill updates and service tool-definition updates are separate; a new release does not rewrite definitions already cached in an existing conversation.

An explicit prompt is:

> Use the MathsDock diagrams skill and Maths Booklet Tools connector to make this resource. Preserve the unanswered cells and return the editable file and MathsDock editor link.

## Keep one maintained source

The repository's `docs/` files and `.agents/skills/` entries are the maintained source. Portable local or plugin installations include the development references so they can work outside a checkout. When changing that source, refresh affected portable copies, validate their links and skill manifests, and record the installed/published version.

Local skill selection is allowed automatically where the task matches its description, and either skill can be explicitly invoked. Project instructions remain the dependable starting point for repository work. An available skill does not guarantee that every unrelated conversation will select it.
