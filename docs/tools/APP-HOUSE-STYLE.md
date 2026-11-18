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

One navy bar, 44 px high, on every page: the logo, then the seven pages. The current page is white
with a white underline. Up to 1,200 px wide the links lose their icons (seven names with icons
need about 1,185 px, and an upright monitor is 1,080 px wide), below about 900 px they fold onto
a second line, and on a phone they sit behind the Menu button. A page added to the bar needs
this width checked again: `editor-frame.spec.ts` fails if a 1,080 px window scrolls sideways.

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

**The same finder on the Diagram builder page** (Tim's choice, 17 November 2026). A click in the
page's search box, the `/` key, typing in the box or the down arrow drops the finder down under it:
the favourites line and every tool in the four strand columns. Tab into the box does not open it,
so the keyboard's way through the page is not through every tool. What the finder holds is one
component (`src/site/ToolFinder.tsx`), and its keys and the ways it closes are shared too
(`src/site/toolFinderBehaviour.ts`), so it looks and works the same in both places.

- The page's search box is the finder's search box. There is no second box, and one search cuts
  down the finder and the pictures behind it together. The page says how many tools were found
  once, in its own status line.
- The arrows move through the tools and Enter opens the first tool found, as in a tool. Tab passes
  the finder by (its links are reached with the arrows), so Tab still goes from the box to Clear
  search and the views. A screen reader hears how to use the finder when it opens.
- The finder always has every strand. The strand buttons choose which pictures the page shows.
- Escape closes the finder and keeps the search and the focus, so the pictures behind are the ones
  the search found. A click elsewhere, Tab out of it, or choosing a tool closes it too. Clear
  search empties the box and puts the focus back in it.
- Pictures, Compact, Topics, the strand buttons, Favourite tools and House style are unchanged.
- Tests: `e2e/tool-switcher.spec.ts`. A test that fills the search box and then clicks a picture
  closes the finder first (Escape).

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

- **"What do you need today?"** and one search box. It finds the pages by name or by what
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
- **Tools.** One card for each of the seven pages: a large icon, the name and what it does. Seven
  to a row from 1,600 px wide, then four (four and three), two and one.
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
- Each pane has its own zoom and place. An answer opens afresh at fit each time it is switched on.
  A zoomed pane keeps the same part of the page at its top left when a neighbour is switched on or
  off, and the question comes back where it was left. The fit mode (Fit view, Fit width) is shared,
  so choosing one puts every pane back at fit.
- The footer (zoom, fit, Whole question, Copy image, PNG, Previous and Next) and the keys act on
  the pane last used: the one last switched on, clicked, touched, pinched or tabbed to. Its header
  has a blue line, and the footer names it beside the view count.
- The browser's Back within one question keeps the panes; Back to another question shows only the
  question. Pane headers never print.
- M switches the mark scheme. Annotations work on every pane on screen, and undo follows the
  order they were drawn in.
- On a window that is upright or under 1,000 px wide the panes stack, each at the full width.
- Tests: `e2e/question-bank-panes.spec.ts`, with the helpers `paneSwitch`, `pane` and `showOnly`
  in `e2e/question-bank-panes.ts` for any test that shows an answer.

## Paper builder: your paper beside the codes (in the site)

The Paper builder has two parts side by side (`src/bank/TopicPaperBuilder.tsx`,
`src/bank/PaperSummary.tsx`, styles in `src/bank/paper-builder.css`, which loads with the page and
stays out of the first-load stylesheet).

- **The codes, on the left.** One row of filters with no labels above them (each option says what
  it is, and the name is in the tooltip and for screen readers), one line of counts, and the table
  of Sparx codes with 32 px rows. A ticked row is blue.
- **Your paper, on the right.** The counts and the ticked codes at the top, then one row for each
  question with a picture of the top of the question, its paper, tier, calculator, the codes that
  matched and its marks. The cross removes that one question, and "Restore removed" brings back
  everything removed. Clear paper and Review paper stay at the bottom.
- The picture keeps one scale, so the question can be read. A narrower panel shows less of its
  width. Pictures load only when their row comes near the screen.
- An upright window, or one under 1,000 px wide, puts your paper under the codes. On a phone the
  codes scroll as one page and your paper, with its Review button, stays in view.
- The order of the questions, the page layout and the downloads stay in Review paper.
- The Question bank keeps the short "Your paper" bar under the question.
- Tests: `e2e/paper-builder.spec.ts`.

## The settings kit

One look for the buttons, fields, notes and cards in a tool's settings column, in
`src/site/settings-kit.css`. A tool opts in: it puts the class `md-kit` on its `.inspector-stack`
and imports the file itself, so the kit loads with the tools that use it and stays out of the
first-load stylesheet. Bar modelling is the first (`src/bar-model/LessonBarModelPage.tsx`),
Statistical charts the second (`src/charts/ChartsPage.tsx`), Probability trees, Frequency trees
and Factor trees the next three, Plans and elevations the sixth, then Two-way tables, Sample
space diagrams and Spinners, dice and bags, then Algebra tiles, Bubble method, Function
machines and Written methods, then Angle diagrams, Area and perimeter and Geometry figures, and
then Constructions and loci, Nets of 3D shapes and 3D solids. The older tools, with settings
classes of their own, follow: Expanding and factorising, then Venn diagrams and Number lines,
then Cuboids. The rest move over a few at a time, and each one drops its own button and field
styles as it does.

- The kit changes how the settings look, never what they do. Every control keeps its name, its
  behaviour and its place in its card, so saved work, links and tests are untouched. A whole card
  may move when the two columns need it, and the tool's entry below says so.
- Text is 13 px, with 12 px labels and notes. Buttons, fields and lists are 32 px high
  (`--md-control`), and 44 px for a finger or a window under 768 px wide, like the foot strip.
- A card's heading keeps the shared 17 px, and fields keep the shared outline (`--field-line`).
- The kit styles what is inside a card (`.site-panel` or `.panel-card`) and nothing else. A dialog
  or a skip link in the same column keeps its own look. A `.panel-card` stacks what is in it with
  one 8 px gap.
- In a group of choices the one that is on (`aria-pressed="true"`) has a blue outline on soft blue.
  A field whose value cannot be used (`aria-invalid="true"`) is outlined in red.
- A table of values keeps its own field widths. The tool sets them with one more class than the
  kit's rule, because the kit would stretch each field across its cell.
- A list starts its words where a text field does (4 px of its own padding, because a list has an
  inset already). Beside a label that takes two lines, a field keeps its height and sits level with
  its neighbour.
- A button that is off is grey on the page colour at full strength, never faded as well.
- A named group inside a card (one tree of several, one data set) is a `fieldset` with the class
  `md-kit-group`: a thin outline, its name in the outline, and the same 8 px gap as a card.
- What a part that opens (`details`) holds is spaced like the rest of a card: rows, tables and
  buttons 8 px apart, paragraphs 6 px. Its name (`summary`) is 13 px at weight 500 with a
  pointer, so it reads as something to press; the rule weighs nothing (`:where`), so a tool's own
  summary keeps its look.
- In the tools that share the `pt-` settings, two fields side by side (`.pt-fields`) share the row
  evenly, and a field on its own takes the whole row. So does a field with the class `pt-wide`.
- A message that says what went wrong (`role="alert"`) is red and 13 px, never a quiet grey note.
- In a card, headings, notes, fields and lists take the full width. Buttons sit in rows at their
  own width, so three short buttons take one line and not three.
- A name with buttons that belong to it (a section, an example) has a line to itself, with its
  buttons under it.
- **Two columns on a wide window.** From 1,800 px wide (and landscape, at least 800 px high) the
  settings column is about a third of the window and the cards sit in two fixed columns. The tool
  wraps its cards in `.md-kit-cards` with one `div` for each column. The columns are fixed, not
  balanced, so a card stays where it is when another card opens, closes or grows. Everywhere else
  the two groups have no box of their own and the cards run in the one order. A third `div` sits
  under the first column: it holds a card that comes last in the settings (Printing) but fits the
  shorter column, so the cards keep their order wherever there is one column. On a wide window
  the keyboard reaches that card last too, after the right column.
- Beside two columns the diagram's card is about 1,230 px wide at 1920 × 1080. The foot strip
  under it still keeps to one row: the note shares the row, and a long hint takes two lines. The
  message keeps at least 220 px there (280 px elsewhere), which leaves the longest hint, 116
  characters in Geometry figures, its two lines.
- At 1920 × 1080 Bar modelling's settings were 3,369 px long in a 967 px column. They are now
  1,065 px, so nearly everything is in view without scrolling.
- **Statistical charts.** Every chart type has a data card and one or more cards of settings. The
  chart type and the data are the left column, and the settings (axes, key, readings, help) are the
  right. A card component for a chart type takes `part="data"` or `part="rest"`, so the page can
  put each part in its column. At 1920 × 1080 the settings were 1,432 px long in a 944 px column
  and are now all in view for most chart types.
- **The tree tools.** The left column is what is on the tree (the selected branch, group or
  number, then the list of them). The right column is what is done with it (fill or work out,
  questions, layout). A Hide tick sits under its field with a 3 px gap. The list of branches
  scrolls inside its card from 460 px, but not in a window under 768 px wide, where it is as long
  as it needs to be. With something selected, the settings at 1920 × 1080 were 1,597 px (Probability trees),
  1,531 px (Frequency trees) and 1,157 px (Factor trees) long in a 967 px column. All three
  are now in view.
- **The shared `pt-` classes.** Seventeen tools use the settings classes in
  `src/probability-tree/probability-tree.css` (`pt-panel`, `pt-row`, `pt-fields` and the rest).
  All seventeen are on the kit, so inside a card that file no longer gives a button, a field or a
  heading its look: the kit does. What stays there is layout (a row, two fields sharing a row, a
  field that may be narrower than its words) and the buttons of the "Protect saved data" card
  (`.pt-recovery`), which sits outside the kit. A row or a pair of fields can also sit outside the
  settings, under a diagram (Two-way tables, Sample space diagrams), so a row keeps its own space
  above with `:where(:not(.md-kit *))` and the kit itself knows nothing of `pt-`.
- **Plans and elevations.** The solid is the left column, the list of panels is the right, and
  Printing is the third group under the solid, so in one column Printing still comes last. The grid of
  heights stays a small grid at the left of its card (`justify-self: start`, because a card is a
  grid and would stretch it), and a square with cubes on it keeps its blue mark (`--md-blue-soft`) with one
  more class in its selector than the kit's rule. Six columns of heights, the most there can be,
  fit the card at the narrowest two-column window. At 1920 × 1080 the settings were 1,693 px long in a
  967 px column and are now 997 px with the usual four panels.
- **Two-way tables, Sample space diagrams, and Spinners, dice and bags.** The selected cell or
  label is the left column, and what is done with the diagram and its layout are the right. In
  Spinners, dice and bags the list of objects is the right column on its own and Layout is the
  third group under the selected label, so Layout stays in view however many objects there are and
  still comes last in one column. Each object is a `md-kit-group`. With their starting diagrams all
  three are in view at 1920 × 1080 (Spinners, dice and bags was 1,168 px long in a 967 px column).
- **Algebra tiles, Bubble method, Function machines and Written methods.** The selected item is
  the left column (with Tiles in Algebra tiles and Machines in Function machines), and what is
  worked out and the layout are the right. In Bubble method the list of steps is the right column
  on its own and Layout is the third group under the selected item, as in Spinners, dice and bags: eight steps
  are longer than the screen, and Layout stays in view. The other three are in view at
  1920 × 1080 even when they are full (16 terms, three machines of five boxes, twelve digits);
  Algebra tiles was 1,111 px long and Written methods 1,182 px in a 967 px column. A step, a
  machine and the small digits of a number are each a `md-kit-group`. The two columns
  of `.pt-fields` are equal (`minmax(0, 1fr)`), so two lists side by side never overlap; in
  Written methods a small digit keeps its narrow field.
  Bubble method's own classes now start `bub-`: they started `bm-`, which is Bar modelling's
  prefix, so Bar modelling's rules stacked every tick above its words and made the Show hidden
  answers switch differ from every other tool's.
- **Angle diagrams, Area and perimeter and Geometry figures.** The selected angle, label or
  object is the left column and the figure itself is the right: Figure and Point names; Shape,
  Hole and shading and Point names; Add to the figure and Shading and captions. Printing is a
  third group: it stays last in the settings, and on a wide window it sits under the selected
  card. With their folded parts shut all three are in view at 1920 × 1080 (they were 1,026, 1,072
  and 1,293 px long in a 967 px column). Area and perimeter's table of corners has five columns
  and used to run out of its card: it now fills the card, with the numbers 18% of the table
  each, the side taking what is left (its full name is its tooltip) and "Right angle" on two
  lines. A short field in a row keeps its place beside its button with one more class than the
  kit's rule (`.md-kit .pt-row.ang-ray input`). "Print every saved answer on the pupil copy"
  keeps its name, so in a narrow column it takes two lines; the test names it as the one button
  that may.
- **Constructions and loci, Nets of 3D shapes and 3D solids.** Constructions and loci has six
  cards, four of them lists that grow, so it cannot fit one screen: the points and the lines are
  the left column, and the constructions, the shaded regions and the drawing's own settings are
  the right. Its settings were 2,025 px long in a 967 px column and are now 1,132 px. The three
  parts of a scale ("1 cm represents 5 km") sit on one line. In Nets the selected face and Shape
  are the left column, the list of nets is the right column on its own, and Paper is the third
  group under Shape. In 3D solids the selected object and View are the left column, and Add to
  the drawing and Printing the right. Nets and 3D solids are in view at 1920 × 1080 (they were
  1,136 and 1,530 px long). A net is a `md-kit-group`, and the point that is selected in
  Constructions and loci is marked as the choice that is on (`aria-pressed`), where it had its
  own colours. A list with long choices beside a short
  field takes the whole row with the class `pt-wide` (the grid of a net's paper, the kind of
  construction, the condition of a shaded region); Geometry figures and 3D solids used their own
  `fig-wide` for this and now use `pt-wide` too.
- **Expanding and factorising.** The first tool on the kit that has its own settings classes
  (`ag-`) and not the shared `pt-` ones. Teaching resource is the left column and Print size the
  right. "Notation and help" was a card of its own that opened; it is now the last thing in the
  Print size card, as the help is in the other tools. The three sizes (Compact, Default, Larger)
  stay two-line choices with their millimetres underneath. The four buttons under the task keep
  their own width; they used to stretch across the card. The tool's stylesheet no longer styles
  the settings: its rules for labels, fields and buttons are for the diagram's own controls and
  the box that opens on a cell, and each is written `:where(:not(.md-kit *))`, so the kit's look
  never depends on which stylesheet loads last. At 1920 × 1080 the settings were 1,337 px long in a 967 px column
  and are now all in view.
- **Venn diagrams.** Diagram tools, Diagram and Print size are the left column and Region
  contents, or Region shading in Shade mode, is the right, so the Tab key meets the cards in the
  order they are seen. Print size was a part that opened inside the Diagram card and is now a
  card after it, as in the other tools. The help was a card of its own and now closes the right
  column's card; it stays open when the mode changes. Edit and Shade sit beside the number of
  sets; the three arrangements are two-line choices in one row, a picture over its name. A row for
  a region, a label or a definition is one line, its name on the left and what it holds on the
  right (they were two lines). The `vn-layout-tools`, `vn-inspector` and `vn-check` classes and
  their rules are gone, with the tool's rules in `refinement.css`; `vn-view-note` stays as a name
  for tests only. At 1920 × 1080 the settings were 1,060 px long in a 967 px column and are now
  all in view, even with three sets and the labels open.
- **Number lines.** The selected item, Draw and Scale are the left column, with More settings
  under them as the third group, and Second scale has the right column to itself, because it is
  the card that grows (a label for every tick). The names of the parts that open (More settings
  and the six inside it) are rows as tall as a control, 32 px and 44 px for a finger, since they
  are how a teacher finds a setting. The way of drawing that is on is marked as the kit marks a
  choice; it was a filled dark blue button. The typed inequality (`NotationPanel`) takes the
  kit's field and buttons. The tool's own rules for cards, labels, fields, buttons and notes are
  gone, with `nl-compact-card`, `nl-actions` and `nl-note`. A field keeps its place at the top of
  its label (`nl-field`), so three fields in a row stay level when one shows what is wrong.
- **Cuboids.** Shape is the left column, and Labels, Shading and Print settings the right. A
  click on a label or a face still brings its card to the top: the top of the left column, where
  the other tools show what is selected, and Shape goes to the right. With more than one cuboid,
  the list that picks one runs across both columns, over the cards. The cards share one parent
  and are placed by `cuboid.css` (the card on top takes the left column), so a card is never
  rebuilt when it changes column and keeps its open parts, what is being typed and the focus.
  The list of units and the list of views each share a row with the tick or button that goes
  with them, and the two lists of the Labels card share a row. The tool's own card, label, field
  and button rules are gone, with `cb-settings`, `cb-action`, `cb-quick-cubes` and `cb-note` in
  the settings; `cb-field` keeps its look in the box that opens on a label.
- The diagram's own buttons ("+ Section", "− Section") are not settings and keep their 44 px.
- Tests: `e2e/settings-kit.spec.ts`.
