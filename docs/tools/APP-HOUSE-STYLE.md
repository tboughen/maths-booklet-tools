# MathsDock app house style

The look of the website itself: its bars, buttons, text and icons. It does not cover diagrams,
worksheets, booklets or anything that is exported or printed. Those keep their own fonts, colours
and sizes, and nothing here may change a diagram, an export, a saved file or a print size.

Agreed with Tim on 15 November 2026. It is being built in small steps, and each section below says
whether it is in the site yet. Implementation, merge and website release are separate stages.

## What it is for

- The content is the point. The diagram, question or sheet gets the space, and controls stay quiet.
- The site is usually used at 1920 × 1080, so design and measure for that first. A portrait
  monitor (1080 × 1920) comes second, then narrower windows and phones.
- Keep the warm background: the page colour, with soft blue behind the work. Never flat grey.
- Things sit in the same obvious place on every page.

## Named values (in the site)

Every value lives in `src/site/house-style.css` as a custom property. Use the name, not the number,
in new or changed styles, and move old styles over as each area is rebuilt. Until then the older
names in `src/site/site.css` (`--ink`, `--line`, `--blue-soft` and the rest) still style the areas
that have not moved, and the two sets are not yet the same values. Do not add to the older set.

| Use | Names |
| --- | --- |
| Words | `--md-ink`, `--md-ink-2` (secondary), `--md-ink-3` (hints) |
| Surfaces | `--md-page`, `--md-stage` (soft blue behind the work), `--md-paper`, `--md-line`, `--md-line-strong` |
| Brand | `--md-navy`, `--md-blue`, `--md-blue-soft` |
| Meaning | `--md-green` (done), `--md-amber` (check), `--md-red` (error), `--md-pink` (teacher only) |
| App bar | `--md-bar`, `--md-bar-ink`, `--md-bar-ink-2`, `--md-bar-accent`, `--md-bar-height` (44 px) |
| Text sizes | `--md-text-2xs` 11 (key hints only), `--md-text-xs` 12, `--md-text-sm` 13, `--md-text-md` 14, `--md-text-lg` 18, `--md-text-xl` 20 |
| Controls | `--md-control` (32 px high), `--md-radius` (6 px), `--md-radius-card` (8 px), `--md-radius-key` (4 px, key hints), `--md-radius-pill` (chips), `--md-shadow-pop` (a panel that opens over the page) |

Pink means one thing: the teacher's view, with hidden answers showing. Do not use it for anything else.

## Font (in the site)

The interface uses Inter, shipped with the site as the family "MathsDock UI" (`--md-font`).
`src/assets/fonts/README.md` records the files. Diagrams keep STIX Two.

## Icons (in the site)

`src/site/MathsDockIcons.tsx` is the MathsDock icon bank: one icon for each page, each diagram tool
and the maths actions that general icon sets lack.

- 24 × 24 grid, 2 px line, round ends and joins, so they sit beside Lucide icons. Lucide stays for
  general actions such as undo, copy and download.
- Each icon draws its diagram in the text colour and one part, the maths idea, in the accent colour
  (`--md-icon-accent`, blue by default, pale blue on the navy bar).
- A selected or current item is one colour all over.
- Always show an icon with its label. An icon is never the only name for something.
- A new tool gets a new icon in the same style, added to the bank and to `src/site/registry.ts`.

## App bar (in the site)

One navy bar, 44 px high, on every page: the logo, then the six pages. The current page is white
with a white underline. Below about 1,055 px the links lose their icons, below about 900 px they
fold onto a second line, and on a phone they sit behind the Menu button.

## Moving between tools (in the site)

A diagram tool's page heading is "Diagram builder ›" and then the tool's name. The name is a button
that opens the tool switcher (`src/site/ToolSwitcher.tsx`): a search by tool or teaching topic,
the teacher's favourite tools, and every tool grouped by strand. There is no row of tool links.

- The strands are the four of the school's scheme of learning: Number and proportion, Algebra,
  Geometry and measure, Statistics and probability (`src/site/toolCatalogue.ts`), one column each
  in that order. Graph tools are Algebra. The Diagram builder page uses the same four.
- `PageHeading` adds the switcher by itself on every registered tool's page. A tool does nothing.
- The switcher's code, styles and search words load with a tool's page (`toolPage` in
  `src/site/toolPage.ts`), not with the site's first load. If they cannot be fetched the page
  still opens with a plain heading.
- Up and down arrows move through the tools, Enter opens one, and Escape closes the switcher and
  returns focus to the name. While searching, Enter opens the first tool found.
- While the switcher is open its keys are its own: none reaches the editor behind it, so arrows,
  Delete and Escape never change the diagram.
- The open switcher sits above the editor and below the app bar.
- The star beside the name adds the tool to favourites. Favourites are kept in the browser and
  shared with the Diagram builder page (`src/site/favouriteTools.ts`).
- Clicking the tool's name no longer moves focus harmlessly, so browser tests that need a neutral
  click use `clickAway` from `e2e/tool-switcher.ts`, and move between tools with `switchTool`.

## The editor frame

On a screen window at least 768 px wide and 800 px high a diagram tool fills the window under the
app bar and the page itself does not scroll (`src/site/editor-frame.css`):

- The card with the diagram and the settings column share the height the heading leaves.
- Inside the card, the bars keep their own height and the diagram's stage takes all the rest.
- The settings column scrolls on its own.
- The foot strip sits straight under the stage (see below).
- If a tool's own rows under the diagram leave the stage less than 280 px, the card scrolls
  instead of squeezing the diagram.
- From 1,500 px wide the tool's name and its one-line description share a row.

Narrower or shorter windows, and print, keep the stacked page that scrolls, with the stage heights
each tool had before.

### A tall window

On a tall window, such as a portrait monitor (at least 1,000 px wide and 1,200 px high, and no
wider than four fifths of its height), the settings go underneath the work so that the diagram
keeps the full width:

- The card with the diagram takes two thirds of the height, whatever the settings hold, so
  nothing done in the settings resizes the diagram.
- The settings sit under it in three columns, each read from top to bottom. A settings card is
  never split between two columns. The browser balances the columns, so a card can change column
  when another grows.
- Settings longer than the last third scroll underneath the card. The card stays where it is, so
  the diagram is in view while a setting changes. The scroll bar sits at the window's edge and
  takes no width from the diagram.
- The action bar has the whole width, so it keeps its words for longer (see The action bar).

A tool needs nothing of its own for this. Its settings cards must be direct children of
`.inspector-stack`. The Graph tool and Ratio tables keep theirs inside groups that have no box of
their own, and `editor-frame.css` names those two groups. Script that scrolls the settings must
scroll `.workspace` as well, because that is what scrolls on a tall window.

A new tool gets the frame by using the shared shell (`.booklet-editor`, `.workspace`,
`.editor-card`, `.inspector-stack`), giving the element that scrolls the diagram the class
`editor-stage` as a direct child of the card, and putting an `EditorFoot` straight after it. A tool
that fits its diagram in script must measure the stage element, not the window.

The frame changes screen furniture only. Preview zoom still never changes print size.

## The foot strip

Every diagram tool has one strip straight under its stage (`EditorFoot` in
`src/site/EditorFoot.tsx`, styled by `src/site/editor-foot.css`, 36 px high as `--md-foot-strip`
when it fits on one row). It replaces the preview bar above the diagram, the hint banner under it
and the separate status line. From the left:

- **Zoom.** Minus, the "Preview zoom" list and plus. Fit says the size the diagram is drawn at
  ("Fit · 245%"), and the steps start from that size. The list keeps one width, so nothing beside
  it moves when the zoom changes.
- **Actual size.** Shows the diagram at 100%, its print size; pressing it again returns to Fit.
- **The print size.** "Prints at 12.00 × 8.50 cm, whatever the zoom" (`ResourceSize`).
- **View-only switches.** Editing guides, the number line's "Finish drawing". Anything that
  changes the resource belongs in the settings, and the answers switch is in the action bar.
- **The note, at the right.** The tool's hint (`EditorHint`) or its drawing prompt ("Choose the
  other endpoint") at the far right, and the latest message ("Image copied", a failed copy, a
  protected draft) beside it. Room is kept for the message, so when one arrives the hint does not
  move. Neither hides the other.

The strip's height follows the width of the card, not what the note says. Room is always kept
for a message and for a hint of up to two lines, so a message arriving, or a drawing prompt taking
the tip's place, does not resize the diagram. Text is never cut off: a rare longer message grows
the strip.

- A card at least 1,500 px wide (a 1920 px window) keeps everything on one row.
- From 700 to 1,499 px the note always has a row of its own under the controls.
- Under 700 px the message has its own line above the hint, and the controls wrap.
- Under 1,200 px the print size drops ", whatever the zoom".

Touch screens and windows under 768 px get 44 px controls. On a window too short for the editor
frame the stage is sized so that the strip still ends inside the window; rows a tool keeps
under it follow on. The Graph tool still
shows its messages in its own toast.

The strip is in the page in the same place it is drawn, straight after the stage, so the
keyboard and screen readers meet it in the order the eye does. Rows a tool keeps under its diagram
(an entry grid, a cuboid's notes, a pending note) follow the strip. A tool passes its message as
`status` and never draws a status line of its own. The "Edit settings" jump for keyboards follows
the action bar, so one press still skips the diagram; it shows over the corner of the stage, so
nothing moves when it appears.

## The action bar

The bar above the diagram is the same in every tool (`EditorToolbar`). From the left: Undo, Redo,
**Examples**, **Start again**. At the right: the answers switch where a tool has hidden answers,
then Copy image, Copy for Word, **Download** and **File**.

- **Examples** opens the "Start from an example" gallery. It used to be a wide button at the top
  of the settings column, which now starts with the tool's own settings.
- **Start again** is the reset: it asks first, and Undo brings the work back.
- **Download** holds what leaves as a picture: SVG, PNG, PDF and, where a tool has them, the
  answers copies and the ZIP of both. **File** holds the editable file: Title and note, Worked
  notes, Save, Open, Copy editable link, and the first-time Word setup. `diagramFileMenu`
  (`src/site/fileMenu.ts`) decides which menu lists an item; a tool passes one list.
- Where the bar would not fit on one row it gives up room in two steps. First Examples and Start
  again show their icons only: up to 1,279 px wide in every tool, and up to 1,500 px in a tool
  with an answers switch. Then the copy, Download and File buttons show their words only: up to
  1,180 px, and up to 1,365 px in a tool with an answers switch. On a tall window, where the bar
  has the whole width, only a tool with an answers switch gives up room: icons only up to
  1,172 px wide, words only up to 1,037 px.
- On a phone the four buttons at the right sit two by two.

## The answers switch

A tool with hidden answers has one switch in the action bar, before the copy buttons. It reads
"Show hidden answers" in every tool (`AnswerPreviewToggle` and `AnswerCopyToggle` in
`src/site/AnswerPreviewToggle.tsx`, styled by `answer-switch.css`). The Worksheet and Booklet
builders use the same switch, without the label.

- Off, it is a plain grey switch.
- On, the switch and its words turn pink, and a small pink label appears over the top corner of
  the diagram: "Teacher view: answers showing", then what a download will hold. A teacher preview
  says "Screen only: downloads keep the pupil version." A teacher copy says "Downloads show the
  answers too."
- The label lies over the stage and lets clicks through, so nothing moves when it appears. It is
  never part of an export.
- The switch's full name for screen readers still says which kind it is ("Teacher preview: show
  hidden answers" or "Teacher copy: show hidden answers").

A tool passes its switch to `EditorToolbar` as `answers`.

## Home

Home is the start page (`src/site/Home.tsx`, styled by `home.css`). Its code loads when Home is
the page opened, like every other page, so a tool's first load does not carry it. From the top:

- **"What do you need today?"** and one search box. It finds the six pages by name or by what
  they do, and diagram tools by name or teaching topic (`searchHome` in `homeSearch.ts`, using
  the Diagram builder's search words). A Sparx code, a letter and three digits, is offered
  as a link to that code in the Question bank; Home cannot tell whether the code has questions. `/` moves to the box, Down moves into what it found, Enter
  opens the first, Escape clears. It does not search exam questions: the bank's catalogue is too
  large to load on Home.
- **Carry on.** The last three places where the teacher changed something on this device, newest
  first, each saying when. A place is recorded when a change is made, never for only opening a
  page, and the row is left out until there is one. `recentWork.ts` keeps a place and a time,
  never the work. The site shell gives each diagram tool and builder a recorder for its own page
  (`DocumentChangeContext` in the editor kit, `workRecorder` in `recentWork.ts`), and the shared
  document history tells it about every new step, undo and redo. Undoing every step puts back
  what the row said before. The Question bank records the paper being built when the teacher
  changes its codes or questions, not when a newer catalogue reconciles it, and drops it when
  the paper is cleared.
- **Tools.** One card for each of the six pages: a large icon, the name and what it does. Six to
  a row from 1,400 px wide, then three, two and one.
- **Favourites.** The teacher's starred diagram tools as small picture cards. Stars are added in
  the Diagram builder and the tool switcher.

Card size carries meaning: a bigger card lets you do more, so a Tools card is much larger than a
favourite. Small words that sit straight on the page colour use `--md-ink-2`, because
`--md-ink-3` is too pale there.

## Question bank: three switches (in the site)

The viewer has three switches in the question's header: **Question**, **Mark scheme** and
**Worked solution** (`src/bank/QuestionBank.tsx`; each pane's views, fit, zoom and pan are
`usePane` in `src/bank/usePane.ts`). A switch that is on is blue, like every pressed button in the
bank.

- Whatever is on sits side by side, always in that order, and switching one off lets the rest
  grow. One pane always stays on: the only pane cannot be switched off, and switching off the last
  answer brings the question back.
- A question opens by itself. Another question, a filter or a reload shows only the question
  again, so answers are never on screen by accident, and links never carry an answer.
- With two or three panes on, each has a small header with its icon and name. A pane by itself
  has none, so the page gets the room. The worked solution's header also holds its own options,
  Mark notes and Step by step, so using them never moves the page.
- Each pane has its own zoom and place. An answer opens at fit. A zoomed pane keeps the same part
  of the page at its top left when a neighbour is switched on or off, and when it comes back.
- The footer (zoom, fit, Whole question, Copy image, PNG, Previous and Next) and the keys act on
  the pane last used: the one last switched on or last touched. Its header has a blue line, and
  the footer names it beside the view count.
- M switches the mark scheme. Annotations work on every pane on screen, and undo follows the
  order they were drawn in.
- On a window that is upright or under 1,000 px wide the panes stack, each at the full width.
- Tests: `e2e/question-bank-panes.spec.ts`, with the helpers `paneSwitch`, `pane` and `showOnly`
  in `e2e/question-bank-panes.ts` for any test that shows an answer.

## Decided, and built in later steps

- **Paper builder.** The paper so far sits beside the Sparx codes, with a picture of each question.
