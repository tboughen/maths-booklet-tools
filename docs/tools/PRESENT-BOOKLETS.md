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
- The pen is one shared component with the Question Bank: `src/bank/usePen.ts` holds the pen's state, settings,
  undo and redo, pointer and keys, and both pages draw with `AnnotationBar.tsx`, `AnnotationLayer.tsx`,
  `inkShape.ts` and `inkSnap.ts`. Change the pen there, never in one page. It has pen, highlighter, eraser, laser,
  move, straight lines, 8 colours, sizes, shape snapping, level and upright within 5°, stylus-end erase, and undo
  and redo across sides. Fist erase works only on boards that report contact size to the browser; Tim's SMART
  board does not (tested with CueCurve, Nov 2026), so it is not promised.
- Coloured overlays (Off, Yellow, Blue, Green, Lilac) sit in the foot bar and share the Question Bank's saved choice.
- Zoom: Fit width (default), Fit side, steps from 50% to 400%, Ctrl + wheel or pinch; a zoom keeps the same place.
- **Display** goes full screen with only the sides, the rail and a dock (side number, Pupil | Answers, Annotate,
  Exit Display). Escape puts the pen down first, then leaves Display. The current side stays at the top.
- The right column's cards fold: Sides (with a dot on each side that has ink), Pen, Keys. Under 1,100 px wide the
  column hides.
- Ink never reaches a download or link.

## Classes and where you got to (second step)

- The Class card (top of the column, foldable; the teal pill in the top bar opens it) asks "Teaching which class?"
  with recent classes as buttons. A class is a short label of letters and digits (`9 x` becomes `9X`, `10x-Ma` becomes
  `10XMA`), never pupil data. Ink drawn before a class is chosen goes with the class.
- With a class chosen, its ink and place are saved for that exact build (`src/library/present/presentStore.ts`):
  in this browser at once (key `present-ink|<class>|<resource id>@<updated>.<tag>`, where the tag comes from the
  pupil file so two builds published on the same day keep apart) and on the site ten seconds later, or
  as soon as the teacher leaves Present or the page closes. Another class has its own ink.
- The place follows the current side; **⚑ We stopped here** pins it by hand and shows a flag on that side's thumbnail.
  Next time, "Last time … You stopped at side N" offers **Go to where we stopped** (never forced).
- If the class has ink on a different build of this booklet, the card says so and offers to open that build, so a
  rebuilt booklet never moves a class's ink.
- Without a class, ink is kept until you leave.
- The site copy follows the teacher between computers. When a class opens, Present reads the site copy and keeps
  whichever copy is newer, adding any ink drawn while it waited; nothing is saved until that is settled (at most 4 s),
  and opening a class saves nothing, only new ink or a new place does. Ink drawn just before closing is saved as
  Present closes. When the site cannot be
  reached (or on a preview without sign-in) the card says "saved in this browser" and carries on; a failed site save
  is tried again every 30 seconds.

### Site store

- `/api/present/ink` in the site Worker (`scripts/cloudflare/present-ink.mjs`), behind the same Cloudflare Access
  sign-in as the library. It reuses the existing private R2 bucket (`BANK`), so there is nothing to switch on.
- One JSON object per teacher, class and build: `present-ink/<first 32 hex of SHA-256 of the signed-in email>/<class>/<build>.json`.
  Addresses never appear in object names. Only the signed-in teacher reads or writes their own records.
- `GET ?class=9X&build=<id>@<updated>` returns `{record}` (or `null`); `GET ?class=9X` lists that class's builds
  (newest first, at most 200); `PUT` takes JSON `{class, build, record}` only (a cross-site form cannot write), up to
  1.5 MB, and checks the record's shape. Class labels are `A-Z0-9`, at most 12; build keys match the library ids.
- Writes are debounced to one every ten seconds while drawing, well inside R2's free monthly operations.
- Nothing clears old records yet; a yearly clear-out of `present-ink/` is a later step if Tim wants one.

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
sign-in (built: reuses the private R2 bucket), private to each teacher, teacher notes on by default,
kept for the school year, spare working space later, older booklets work without rebuilds.

## Checks

`npx playwright test --project=library` runs `e2e/present.spec.ts` with made-up three-side PDFs; unit tests are in
`src/library/present/*.test.ts`; the site store's tests are in `scripts/cloudflare/site-worker.test.mjs`.
