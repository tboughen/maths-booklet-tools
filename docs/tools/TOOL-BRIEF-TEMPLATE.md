# MathsDock new tool brief

Copy this brief for a proposed booklet tool. Use [Creating MathsDock tools](TOOL-CREATION-GUIDE.md) as the design baseline and [Adding a booklet tool](ADDING-BOOKLET-TOOLS.md) for implementation. Fill in concrete examples and expected behaviour; mark a section not applicable with a reason where appropriate.

## Purpose and scope

- **Tool name and stable route:**
- **Teacher task:** What resource will this make, and where will it be used?
- **Pupil task:** What should pupils see, supply or work out?
- **First release:** The smallest useful complete workflow.
- **Outside this release:**
- **Constraints:** Physical dimensions, supported notation, structure limits, hosting and cost.

## Reference outputs

Provide a sketch or example of each relevant case. Record the desired print dimensions and what must remain blank.

| Example | Input and teaching purpose | Expected pupil output |
| --- | --- | --- |
| Simple | | |
| Scaffold | | |
| Worked | | |
| Difficult values | Fractions, negatives, long valid labels or other subject-specific cases | |
| Largest supported structure | | |
| Deliberate error | If useful for teaching | |

## All tools card preview

Use [the preview convention](TOOL-CARD-PREVIEWS.md); include this in the first release.

- **Representative sample:** What should a teacher recognise before entering the tool? Which pupil blanks remain?
- **Editable example and renderer:** Saved example location, real export renderer and generation route.
- **Website SVG and alternative text:** `src/assets/tool-previews/<tool-slug>.svg` and its registry `preview` entry; preserve the small icon.
- **Layout review:** Preview on the right on desktop/tablet; stacked on narrow phones; check actual card size, complete labels and image/link keyboard behaviour.
- **Verification evidence:** Source reopening, mathematical checks, screenshots and built/live asset checks where publication is authorised.

## Source-linked examples

List suitable published past-paper questions, their verified paper/tier/question links and the teaching purpose of each editable preset. Specify pupil blanks and explicit worked variants. If no suitable source exists, explain why.

## Interaction plan

| Teacher action | Direct interaction | Keyboard or labelled control | Placement | Undo and validation behaviour |
| --- | --- | --- | --- | --- |
| Edit a value or label | | | | |
| Add or remove structure | | | | |
| Add or edit a relationship | | | | |
| Hide or show scaffolding | | | | |
| Export | | | | |

Specify the default state, Enter/Escape/Tab behaviour, click-away selection clearing and handling of invalid drafts. Identify which values appear more than once and must stay synchronized. Identify the clean white snip area and position visible utilities beyond it in the blue workspace, aligned with their effect. Show desktop and narrow-screen control placement; state what scrolls if the diagram is too wide.

## Mathematical and teaching rules

- **Content model:** Objects, stable IDs and relationships.
- **Number handling:** Exactness, rounding, units, allowed notation and bounds.
- **Cell or answer states:** How blank, answer space and zero differ, if applicable.
- **Presentation:** Labels and annotations that can be hidden without losing data.
- **Explicit calculations:** Which action, if any, supplies answers; when existing values need overwrite confirmation.
- **Errors and warnings:** Invalid structures to reject versus teacher-entered disagreements to retain.
- **Editor state:** Selection, handles and other items excluded from pupil exports.

## Saving and outputs

Apply the [shared editor contract](BOOKLET-CONSISTENCY.md): common file/action labels, one bounded keyboard menu, retained invalid drafts with guarded exports, actual export dimensions and explicit hidden-answer link information. Identify compatibility/default rules separately for fresh browser resources, imported files and services.

- **Print contract:** Dimensions, typography, line weights, margins and overflow behaviour.
- **Exports:** Image-only Copy image first, Copy for Word, SVG, PNG and editable file; explain any variation from the existing pattern.
- **Saving:** Distinct storage key, document version, recovery and import confirmation.
- **Compatibility:** Existing files or links to preserve and fixtures to prove it.
- **Navigation:** What survives changing tools, reloads and browser Back/Forward.
- **Fallback:** What the teacher can do if copying, storage or a service is unavailable.

## Optional connector

State whether AI-assisted creation is part of this release. If it is, define capabilities, creation and revision payloads, returned artifacts, hash checking, version handling and exact preservation of pupil blanks. Identify the existing core and service code to reuse. Include one complete create → revise → open in editor example and how it will be checked in the actual consuming client.

## Acceptance examples

Write observable outcomes, including failure behaviour. For example:

> Given a scaffold with an answer line, when an annotation is changed and hidden, then the answer line and entered values remain unchanged in the preview, exports and reopened editable file.

> Given an invalid number draft, when the user attempts to export, then export is blocked with a useful error and the draft remains available to correct or cancel.

Add cases for a clean snip area at every composition/zoom, actual image clipboard contents, verified source-question links, mathematical boundaries, Undo/Redo, structural deletion, keyboard/touch use, maximum size on a narrow screen, recovery, old files and actual Word output. Use the guide's acceptance checklist to check coverage.

## Implementation and release record

- **Repository and branch or worktree:**
- **Shared code to reuse and specialist code to add:**
- **Review examples and retained files:**
- **Checks actually run and results:**
- **Visual and real Word checks:**
- **Connector and target-account checks, if relevant:**
- **Current stage:** Planned / implemented / reviewed / merged / website deployed / service deployed / client accepted. Record each applicable stage independently.
- **Production destination and exact release evidence:**
- **Unresolved issues and next action:**
- **What Tim needs to review or decide:**

The brief does not grant implementation or deployment permission. Follow the current request and the repository's existing approval rules.


For the eight-editor usability workspace, follow [the shared preview, example and quick-input contract](BOOKLET-CONSISTENCY.md#eight-editor-usability-workspace): whole-resource fit with fixed control gutters, real pupil thumbnails, confirmed scaffold replacement, immediate worked-version replacement with one-step Undo and bounded input adapters. Preview choices never change saved mathematics or physical output. Preserve grouped Apply/Cancel and inactive-editor guards.


## Usability refinement, 17 October — local candidate

Tim authorised implementing the follow-up plan. Preserve connector/output whitespace and physical dimensions; keep a calm white screen surround while reclaiming space from interface furniture. The preview uses measured available screen height and leaves completion feedback below the resource so copying does not shrink it. Keep fixed accessible structure controls outside the white resource. Grouped Triangle label editing is docked in the inspector with explicit Apply/Cancel. Number-line mathematical input is initially visible; Graph equation input is one click away (Line by equation opens it with the cursor in the equation; changed 1 Nov 2026 on Tim's decision); calculations remain explicit. Copy image and Copy for Word retain their distinct existing payloads; extra file actions use an independent labelled File dropdown. Worked versions replace in the current editor without confirmation and are restored by one Undo, with Redo and earlier history retained. Preserve existing saved worked-file/link compatibility and pending-input guards. These are local candidate conventions, not publication evidence.
