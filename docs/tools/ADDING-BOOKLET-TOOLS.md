# Adding a booklet tool

Use the [shared booklet editor contract](BOOKLET-CONSISTENCY.md) for toolbar/menu adapters, independently mounted file inputs, keyboard/focus behaviour, pending/recovery guards and actual-size readouts. Mathematical settings remain specific to the tool. A successful menu action closes it, so browser tests must reopen the real menu for each subsequent action.

Before implementing an editor, read [Creating MathsDock tools](TOOL-CREATION-GUIDE.md) and complete the [new tool brief](TOOL-BRIEF-TEMPLATE.md). Those documents cover the teaching purpose, direct editing, control placement, recovery, print output and compatibility lessons from [Graph tool and Ratio tables](TOOL-EVOLUTION.md). This page covers integration with the shared site.

The website has two main sections: **Question bank** and **Booklet tools**. Graph tool and Ratio tables belong to Booklet tools. `src/site/SiteApp.tsx` owns the common header, query-based navigation and page lifetime; an editor owns its controls, working document and exports.

## Register the editor

Add one entry to `bookletTools` in `src/site/registry.ts`: a stable URL ID, name, short description, Lucide icon, React component and `preview: { src, alt }`. The overview, tool navigation and page host use this registry. Do not build another header or tool menu in the editor.

Generate a real sample output and import its SVG from `src/assets/tool-previews/`. Keep the icon and use the shared card's preview area on the right, with its narrow-screen stacking. Follow [All tools card previews](TOOL-CARD-PREVIEWS.md) for generation, saved examples, implementation history and acceptance checks. That page also explains how to handle a checkout predating the shared preview-card implementation.

Keep existing IDs stable: the ID is the tool's address. Every page has its own path: `/` is the site overview, `/tools` the tool overview, `/tools/<id>` each editor (for example `/tools/graph`), `/question-bank` and `/assessment-follow-up`. Add the new ID to `toolIds` in `src/site/routes.ts` as well; the registry fails to type-check if the two lists differ. Build links with `pageHref()` rather than writing paths by hand, so they respect the site base path. Unknown addresses show the not-found page. Old `?tool=<id>` links are upgraded to the path form on load (`src/site/upgradeAddress.ts`), so saved links, booklets and MCP editor links keep working.

## Use the shared layout

```tsx
import { PageHeading, Panel } from "../site/PageHeading";
import { EditorToolbar } from "../site/EditorToolbar";

export default function NewTool({ active = true }: { active?: boolean }) {
  return <div className="app-shell booklet-editor">
    <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
      <PageHeading title="New tool" description="Explain what the teacher can create." />
      <section className="workspace">
        <Panel className="editor-card">
          {/* EditorToolbar: Undo, Redo, Reset, Copy for Word and downloads. */}
          {/* Working preview */}
        </Panel>
        <aside className="inspector-stack" aria-label="New tool settings">
          <section className="panel-card specialist-tools">{/* Specialist actions and settings */}</section>
        </aside>
      </section>
    </main>
  </div>;
}
```

Use the shared tokens and interface classes in `src/site/site.css` for colours, typography, spacing, borders, controls and focus. Add narrowly scoped styles for specialist controls. The shared interface follows the Question bank's white and blue-grey appearance. Mathematical content has its own rendering and fonts; interface styles must not change exported diagrams.

Use `EditorToolbar` for common document utilities rather than recreating them. Keep specialist modes and configuration in the inspector, paired structure controls beside the resource, and direct value/label editing on the resource. Keep import dialogs outside any hidden export-menu wrapper so links can open them while that menu is closed. See [the layout audit](../archive/EDITOR-LAYOUT-AUDIT.md).

## Preserve work during navigation

Editors mount on first visit and remain mounted in hidden page containers for the session. This preserves drafts, undo history and pending inputs. `active` controls their visibility-sensitive effects:

- Register keyboard shortcuts and browser model tools only while active; clean up listeners and registrations when inactive.
- Inspect editable-link hashes only while active. Existing imports and recovery flows must retain their confirmation and data-preservation behaviour.
- Render modal overlays only while active. Native dialogs must close when their page is inactive.
- Keep autosave running independently of visibility, using a distinct storage key. Storage errors must remain visible and must not replace recovery data.
- Use real page links (`pageHref(id)`) for internal navigation. The site host intercepts ordinary clicks; modified clicks, downloads and external links keep browser behaviour.

Question bank announces query changes with `maths-tools:route` so its latest deep link can be restored after section navigation. If a future editor changes query state, announce that event after its history update. Ordinary Back/Forward navigation is handled by the page host; page-specific handlers must ignore URLs for other pages.

Session retention does not promise undo or invalid-input persistence after a reload. Valid saved diagram recovery keeps its established behaviour.

## Verify the new page

Check direct links, the overview and active navigation labels; Back/Forward; keyboard operation; leaving immediately after an edit and returning; pending input; storage failure/recovery; and interaction with another mounted editor's shortcuts. Check desktop, tablet and 320–375 px layouts without horizontal page overflow. Verify copy/download/export size and content independently from interface styling.

Review the tool's output preview in the overview at its actual display size. Check the retained icon, SVG load, alternative text, full image and text click target, responsive placement and unchanged Home cards. For an authorised website release, verify the served SVG matches the reviewed bytes.

Run the existing lint, unit, typecheck, build and browser checks. Navigation regression coverage is in `e2e/site-navigation.spec.ts`; graph and ratio export checks remain in their existing test suites.


For the eight-editor usability workspace, follow [the shared preview, example and quick-input contract](BOOKLET-CONSISTENCY.md#eight-editor-usability-workspace): whole-resource fit with fixed control gutters, real pupil thumbnails, confirmed scaffold replacement, immediate worked-version replacement with one-step Undo and bounded input adapters. Preview choices never change saved mathematics or physical output. Preserve grouped Apply/Cancel and inactive-editor guards.


## Usability refinement, 17 October — local candidate

Tim authorised implementing the follow-up plan. Preserve connector/output whitespace and physical dimensions; keep a calm white screen surround while reclaiming space from interface furniture. The preview uses measured available screen height and leaves completion feedback below the resource so copying does not shrink it. Keep fixed accessible structure controls outside the white resource. Grouped Triangle label editing is docked in the inspector with explicit Apply/Cancel. Graph and Number-line mathematical input is initially visible; calculations remain explicit. Copy image and Copy for Word retain their distinct existing payloads; extra file actions use an independent labelled File dropdown. Worked versions replace in the current editor without confirmation and are restored by one Undo, with Redo and earlier history retained. Preserve existing saved worked-file/link compatibility and pending-input guards. These are local candidate conventions, not publication evidence.
