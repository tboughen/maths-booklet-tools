# Shared booklet editor contract

Implemented on the consistency preview, 15 October 2026. This document describes browser behaviour; implementation, qualification, merge and publication are separate stages. The existing document schemas, mathematical cores and service defaults are unchanged.

## Common utilities

Reuse `EditorToolbar`, `EditorDownloadMenu`, `ResourceSize` and `resource-utilities.css`. Keep Undo, Redo, Reset, Copy to clipboard, Copy for Word and Download options in that order. The common menu contains Download SVG, Download PNG (600 ppi), Save editable file, Open editable file and Copy editable link, followed by genuine help. File inputs and import/recovery dialogs must remain mounted outside the menu.

The menu is a bounded, scrolling portal with one `role=menu`, matched `aria-controls`, focusable actions and disabled/busy guards. Arrows, Home and End select actions; Escape restores the trigger; Tab continues page navigation; outside clicks preserve the clicked control's focus. A successful action closes it. A failure leaves an actionable message and the failed action focused. Do not return focus from a newly opened picker or help dialog. Navigation closes inactive editors' menus; asynchronous completion must not steal focus from another tool.

Use the shared action labels and operation-specific feedback. A browser download message says “download started”, since a browser event cannot prove a native save completed. Image clipboard and Word clipboard are distinct actions. Link supporting text explains that saved data includes hidden answers. Keep useful storage/clipboard fallbacks and recovery downloads.

Show actual export dimensions near preview zoom, rounded only for display. Use renderer/export metrics, never an editor DOM box. Cuboids uses the existing font-aware `prepareImage` crop without rasterising a PNG for measurement: cache a bounded set of results by document identity, clear stale displayed dimensions, ignore stale completion and report measurement failure. Its layout size remains secondary information.

## Graph drafts and artwork

Graph numeric drafts live at editor level, keyed by field/object. Valid Enter or blur commits once; invalid input retains its exact text and error. Escape or Cancel restores the committed value. Moving focus to Apply/Cancel must not trigger a blur commit before the chosen action. Equation Add/Update commits the whole form; opening an unchanged form does not create a pending draft.

Pending drafts block copies, downloads, editable-file/link exports and conflicting drawing, deletion, replacement, Reset and document history. Handlers enforce this as well as disabled controls. Explain the pending field and the Apply/Cancel route. Native input undo remains available. Navigation retains the session draft without blocking other editors. Autosave contains only valid committed work. Compare the saved envelope before writing and preserve a newer tab's data through recovery.

Graph's full white resource bounds derive from export metrics. Eight native 48 × 48 CSS pixel range controls sit in blue gutters outside that rectangle. They do not scale with artwork. Fit and percentage zoom affect viewing only, with internal scrolling where necessary. Use the SVG screen transform for pointer mapping. Precise axis minimum/maximum fields map to the existing grid steps and square limits and use the same draft contract.

Fresh browser Graph documents and confirmed Reset use `newBrowserGraph()` with `portable-v1`. Recovered/imported/linked/example documents preserve their profiles; absent means legacy. The explicit profile choice in Print settings is undoable. Core/service defaults retain their previous behaviour. Self-contained SVG font loading failures remain export failures, rather than silently producing an output dependent on recipient fonts.

## Editable Venn links

Browser helpers use the existing validated canonical envelope, UTF-8 and base64url in `?tool=venn#venn=...`. The complete URL is limited to 16,000 characters, with the existing bounded decoded representation. Oversize or malformed data is rejected with an editable-file fallback; no region or hidden answer may be omitted to shorten a link.

Only the active Venn editor parses its fragment. Show the pupil-view preview and replacement confirmation. Cancel preserves current data; accept is undoable. Consume only the Venn fragment, and permit reopening the same link later. Save/link use pupil visibility regardless of the temporary Show saved answers preview, including reverse-nested arrangements. No server sharing service or schema change is involved.

## Verified quadratic examples

Source metadata lives in `src/value-graph/examples.ts`; original mathematical presets stay in the shared core. All five source cards open the exact Question bank question separately. Fractions is labelled a teaching example. Blank cells are retained until an explicit calculation. Worked and corrected copies open with separate draft storage and leave the current scaffold untouched.

| Example | Verified source ID | Preserved intent |
| --- | --- | --- |
| June 2018 | `1MA1_JUN_2018_2H_Q5` | Q5(a–b), y = x² − x − 6; source given cells and scaffold blanks |
| November 2018 | `1MA1_NOV_2018_3H_Q3` | Q3(a–b), y = x² + x − 4; source given cells and blanks |
| November 2021 | `1MA1_NOV_2021_2H_Q4` | Q4(a–b), y = x² − 2x + 2; source given cells and blanks |
| November 2017 error | `1MA1_NOV_2017_1H_Q7` | Correct table/points for y = x² + 1, deliberately joined by straight segments |
| Mock Set 8 | `1MA1_MOCK_SET_08_1H_Q13` | Q13(a–b), y = 2x² + 4x + 1; source given cells and blanks; later solving parts excluded |

Question images and complete scheme rows were inspected from the existing reviewed catalogue. Values and the intentional straight-join error were checked against those primary assets. Source evidence is retained in the implementation report; source papers and the catalogue are unchanged.

## Acceptance and release

`e2e/consistency.spec.ts` parameterises menu, clipboard, real file, size and reopening behaviour over all six editors, plus Graph draft/control/recovery/profile and quadratic/Venn cases. Keep existing mathematical, crop, navigation and compatibility suites. `e2e/resource-actions.ts` follows the real menu route and reopens after successful actions. Do not add compatibility buttons to satisfy an obsolete test selector.

Check desktop through 320 px, scrolling, large structures, long labels, fractions, focus/error visibility, keyboard/touch and view zoom. Inspect actual SVG/600 ppi PNG and clipboard/Word HTML size and pixels, and compare existing resources with retained outputs. Native Word insertion and physical monochrome printing require their own evidence; browser checks do not establish them.

For publication, reconcile current main/production and follow `RELEASE-PIPELINE.md` on the exact committed candidate. A local build or test pass does not establish hosted qualification, merge, deployment or live acceptance.


## Eight-editor usability workspace

Use `PreviewControls` and the shared viewport fit calculation with a small renderer-specific adapter. Fit whole resource contains the complete export bounds plus fixed-size control gutters in both dimensions, with a 400% preview ceiling. Explicit percentages scroll inside the preview. Neither choice belongs in a resource definition, hash, writing-cell size or export. Measure hidden editors only when their viewport is nonzero. Keep labelled Edit settings / Return to diagram focus routes on stacked layouts.

Keep a single visible Start from an example entry point for each editor. `ExampleGallery` uses local renderer-derived pupil SVG thumbnails from `galleryCatalogue`; regenerate with `node scripts/generate-example-previews.mjs` after changing an example. Preserve intentional errors, adaptation notes and verified source links. The native modal is mounted only while open and active, so it cannot interfere with inactive-editor shortcuts. Close/Escape restores its trigger.

Open scaffold follows the editor's existing pupil-preview replacement confirmation and one-step Undo. Open worked copy saves a distinct browser document before opening a new tab and provides a retry link if the popup is blocked. The copy has isolated storage after reload, clearly says Separate worked copy, and must never overwrite its parent scaffold. Test opening another worked copy from a worked tab as well as from the original editor. A resource without an automatic worked variant explains that limit.

Number-line quick input is a bounded interaction adapter for a single ray, interval or included point. It accepts exact finite numbers/fractions and the current single-letter variable, preserves teaching annotations and saved visibility, and never solves expressions or silently extends the axis. Range edits are a draft; the combined range/drawing change is atomic. Replacing an existing drawing shows a pupil preview. The visible summary is derived from the actual model, with Custom drawing for unsupported combinations.

Graph Type equation is an alternative within Line by equation, retaining Use m and c. Accept only y=mx+c, y=mx, y=c and x=a with bounded finite coefficients. Unsupported syntax remains a correctable draft; adding/updating commits the existing straight-object model once. A link to Plotting quadratics preserves the graph rather than transferring mathematical content.

Keep shared copy actions and menu order unchanged. Qualify all eight editors, including blank/zero/hidden-answer states, maximum structures, legacy files, exact exports, grouped cancellation, focus, transformed pointer mapping, storage failures and separate worked reloads. Automated checks establish behaviour; teacher completion times, native Word insertion, physical printing and a real phone keyboard require their own observations.
