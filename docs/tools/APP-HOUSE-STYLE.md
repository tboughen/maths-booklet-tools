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
- The foot of the card (`--md-status-line`, 36 px) is kept for the status line: "Image copied", a
  failed copy, a protected draft. It always sits there, so a message never resizes or moves the
  diagram. A long message grows upwards. Warnings about the diagram itself stay where the tool
  draws them.
- If a tool's own rows under the diagram leave the stage less than 280 px, the card scrolls
  instead of squeezing the diagram.
- From 1,500 px wide the tool's name and its one-line description share a row.

Narrower or shorter windows, and print, keep the stacked page that scrolls, with the stage heights
each tool had before.

A new tool gets the frame by using the shared shell (`.booklet-editor`, `.workspace`,
`.editor-card`, `.inspector-stack`), giving the element that scrolls the diagram the class
`editor-stage` as a direct child of the card, and showing its message in a `.resource-feedback`
paragraph inside the card. A tool that fits its diagram in script must measure the stage element, not the window.

The frame changes screen furniture only. Preview zoom still never changes print size.

## Decided, and built in later steps

- **Tall windows.** Settings go underneath the work in three columns, so the work keeps the full
  width.
- **Answers showing.** While hidden answers are on screen, the switch turns pink and a small pink
  label marks the teacher's view.
- **Question bank.** Question, Mark scheme and Worked solution are three separate toggles. Whatever
  is on sits side by side, and switching one off lets the rest grow.
- **Paper builder.** The paper so far sits beside the Sparx codes, with a picture of each question.
- **Home.** A start page: search, Carry on, a row called Tools with one clean card for each page,
  and favourites below as small picture cards. Card size carries meaning: a bigger card lets you
  do more, so a Tools card is much larger than a favourite.
