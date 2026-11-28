# Present a booklet

Tim's idea (28 Nov 2026): teach straight from a Resource library booklet instead of downloading the PDF and
putting it into OneNote. He chose option A of the mock-ups (https://claude.ai/artifact/96Gav9V7F23nRYkby7jJ1t):
one scrolling column of sides with the Question Bank's tools and a settings column on the right.

## What it does now (first pull request)

- **Present** is a navy link beside the PDF links on every library lesson, unit booklet, search result and earlier
  build that has a pupil PDF. It opens over the library at `/library?…&present=<resource id>` (`&at=<updated>` for an
  earlier build), so Back and a shared link both work.
- The sides are the delivered PDFs drawn by pdf.js, exactly as printed. Nothing is re-laid-out. Sides draw when
  they come near the view and stay stretched while a zoom redraws them sharp.
- **Pupil | Answers** (key A) swaps the copy underneath. The answers copy has the pupil copy's layout, so one ink
  layer per side serves both. If the two copies have different side counts the column says so.
- **Version** lists the same booklet in every version (Main first) and each one's earlier builds from its history.
- The surround is light grey (`#eef1f5`), not white or dark, and is writable: a pen-down beside a side draws on the
  nearest side, as in the Question Bank.
- The pen rail, keys and ink are the Question Bank's (`src/bank/AnnotationBar.tsx`, `AnnotationLayer.tsx`,
  `inkShape.ts`, `inkSnap.ts`): pen, highlighter, eraser, laser, move, straight lines, 8 colours, sizes, shape
  snapping, level and upright within 5°, fist and stylus-end erase, undo and redo across sides.
- Coloured overlays (Off, Yellow, Blue, Green, Lilac) sit in the foot bar and share the Question Bank's saved choice.
- Zoom: Fit width (default), Fit side, steps from 50% to 400%, Ctrl + wheel or pinch; a zoom keeps the same place.
- **Display** goes full screen with only the sides, the rail and a dock (side number, Pupil | Answers, Annotate,
  Exit Display). Escape puts the pen down first, then leaves Display. The current side stays at the top.
- The right column's cards fold: Sides (with a dot on each side that has ink), Pen, Keys. Under 1,100 px wide the
  column hides.
- Ink is in memory for this visit only and never reaches a download or link.

## Still to build (Tim's option A)

1. Classes: "Teaching which class?", "Go to where we stopped", a "We stopped here" flag, and ink saved per class and
   per exact build (a class keeps the build it started; a newer one is offered, never forced).
2. Teacher notes (NCETM chips, Watch for and Ask boxes) shown on the pupil copy on screen only, with T to hide; a
   Feedback card with comments pinned to a spot on a side, sent to the library feedback queue; N for a quick-note
   flag during a lesson and a one-line "Send as feedback?" on leaving Display. No feedback or version controls in
   Display.
3. A movable pen rail: drag its grip, snaps to an edge, remembered per computer, double-click resets (shared with the
   Question Bank).

Open questions answered with the recommended option unless Tim says otherwise: ink saved on the site behind staff
sign-in (needs a small store on the free Cloudflare plan), private to each teacher, teacher notes on by default,
kept for the school year, spare working space later, older booklets work without rebuilds.

## Checks

`npx playwright test --project=library` runs `e2e/present.spec.ts` with made-up three-side PDFs; unit tests are in
`src/library/present/presentModel.test.ts`.
