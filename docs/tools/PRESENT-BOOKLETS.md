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
- Ink never reaches a download or link.

## Classes and where you got to (second step)

- The Class card (top of the column, foldable; the teal pill in the top bar opens it) asks "Teaching which class?"
  with recent classes as buttons. A class is a short label (`9 x` becomes `9X`), never pupil data.
- With a class chosen, its ink and place are saved for that exact build (`src/library/present/presentStore.ts`,
  this browser's storage for now, key `present-ink|<class>|<resource id>@<updated>`). Another class has its own ink.
- The place follows the current side; **⚑ We stopped here** pins it by hand and shows a flag on that side's thumbnail.
  Next time, "Last time … You stopped at side N" offers **Go to where we stopped** (never forced).
- If the class has ink on a different build of this booklet, the card says so and offers to open that build, so a
  rebuilt booklet never moves a class's ink.
- Without a class, ink is kept until you leave.
- Saving on the site behind staff sign-in (so ink follows a teacher between computers) waits for a small store on the
  free Cloudflare plan that Tim switches on; the record shape is already the one the site will keep.

## Teacher notes on both copies (third step)

- `src/library/present/teacherNotes.ts` reads each answers side's NCETM chips (its web links, named by the words
  inside each chip) and its Watch for / Ask band (the text in the misconception band of the footer, whose place
  matches `MISCONCEPTION` in `booklet-render.ts`; a unit test keeps the two in step).
- On the pupil copy, those parts of the answers page are drawn over the pupil side at the same size, clipped to the
  chips and the band, so they look exactly as printed and no answer shows. T (or the card's tick box) hides them.
- Chips are clickable on both copies, except while the pen is out. The "Teacher notes on this side" card lists the
  side's links and its Watch for and Ask words.
- Booklets without notes (older builds) simply show none; no rebuild is needed.

## Feedback while looking or teaching

- The "Feedback on this booklet" card (folded until used): **Pin a comment**, then tap a spot on a side; each pin has
  its own box. **Send** posts one comment to the library feedback for that lesson (or unit booklet part), naming the
  build and each pin's side and place, through the library's own feedback route.
- In a lesson, N drops a quick-note flag on the side under the pointer (or the current side) and nothing else
  happens. Leaving Display with quick notes shows one line, "Send N notes as feedback?", with Send and Not now.
- Display has no feedback or version controls.

## Movable pen rail

- In Present the rail has a grip at the top (`AnnotationBar`'s optional `movable`). Drag it anywhere over the sides;
  let go within 48 px of the left or right edge and it docks there. Double-click the grip (or press Enter on it) to
  put it back. Where it was left is remembered on this computer (`present-rail`).
- The Question Bank's rail stays fixed until Tim asks for the same there.

Open questions answered with the recommended option unless Tim says otherwise: ink saved on the site behind staff
sign-in (needs a small store on the free Cloudflare plan), private to each teacher, teacher notes on by default,
kept for the school year, spare working space later, older booklets work without rebuilds.

## Checks

`npx playwright test --project=library` runs `e2e/present.spec.ts` with made-up three-side PDFs; unit tests are in
`src/library/present/presentModel.test.ts`.
