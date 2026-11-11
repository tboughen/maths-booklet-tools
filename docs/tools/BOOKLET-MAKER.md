# Booklet maker

The Booklets page (`/booklets`, its own section of the site) makes an A4 portrait unit booklet, one
lesson per scheme-of-work objective, with the teacher's own AI key. Every question stays editable,
and the page downloads pupil and answers PDFs for the whole booklet or one lesson. Code:
`src/booklet/` (page, editor, AI) and `packages/resource-core/src/booklet*.ts` (schema, layout).

## The booklet document

- `kind: "booklet-a4"` in the shared resource schema (`tool: "resource"`, `schemaVersion: 1`). A
  booklet has a cover (title, unit code, year or tier, contents, name and class lines, an optional
  note), an optional unit introduction (what to remember, what you will learn, how it progresses,
  key words) and 1 to 12 lessons.
- A lesson has a title, objective code, objective, a one or two sentence key idea (shown in a pale
  card under the lesson heading) and 1 to 12 sections. Section kinds: check in, worked example,
  practice ("Your turn"), diagnostic questions, spot the mistake, challenge, discover and notes.
  Each section has a heading (empty uses the kind's name), an instruction line, one or two cards a
  row, and 1 to 16 cards.
- Cards use exactly the worksheet item vocabulary (text, answer lines, boxes, tables, diagrams from
  the shared registry, choices and so on). Booklets added three items that worksheets can use too:
  `steps` (numbered "Step 1:" lines for worked examples), `checklist` (tick boxes for self-checks)
  and choice mode `letters` (circled A to D for diagnostic questions).
- Worked example and notes cards carry no number tile. Worked example sections are laid out in
  pairs: the left card is the teacher's worked example, the right card is "Our turn" with the same
  steps for the class to do together.

## Layout

- A4 portrait, 12 mm margins, the MathsDock style at 11 pt with nothing below 10 pt, vector PDF.
  Nothing is ever shrunk to fit.
- The renderer paginates itself: every lesson starts on a new page, a card is never split, a
  section heading stays with its first row of cards, and a section that continues onto the next
  page repeats its heading with "(continued)". Spare height on a page is shared between working
  and drawing spaces, up to 40 mm extra each.
- The cover's contents list and the footer page numbers come from the real layout. The pupil and
  answers copies place every card identically; answers print only in the answers copy.
- File names follow `[code]_[title]_Booklet_A4.pdf` and `..._Booklet_Answers_A4.pdf`.

## The AI maker

- Choose a scheme unit (the department scheme from the private bank is the default) and tick its
  objectives, or type your own unit and objectives. Add the year or tier, whether lesson 1 is a
  prerequisite check-in lesson, and any notes. The panel shows a cost and time estimate before you
  click.
- One plan request first (`submit_booklet_plan`): the unit introduction, key words, and for each
  lesson a title, key idea, prerequisites to retrieve, the misconceptions to diagnose, and how the
  practice fades. Then one request per lesson (`submit_lesson`). The first lesson runs on its own
  so the provider caches the system prompt; the rest run three at a time and reuse the cache.
- Each lesson is checked before it is accepted: the schema, that no answer is printed in a pupil
  card, that diagrams resolve, and the A4 layout of that lesson on its own. Problems go back to the
  model; it has four submissions. A lesson that still fails, or is stopped, becomes a placeholder
  that keeps its plan, marked "not made yet", so it can be rebuilt without redoing the rest.
- "Change a lesson" sends one lesson plus the teacher's words and replaces only that lesson, as one
  undoable change. "Rebuild lesson" writes it again from its plan. Neither touches other lessons,
  which keeps spend low.
- The system prompt holds the house rules, the lesson standard below, the whole design guide and
  one complete example lesson. It is byte-identical on every request.
- Providers, keys, prices and the "Spent in this tab" total are shared with the worksheet maker
  (`src/worksheet/ai/useAi.tsx`; see [WORKSHEET-AI.md](WORKSHEET-AI.md)). A unit of 11 lessons is
  about 160,000 output tokens including thinking, roughly $1.50 to $2 on Sonnet 5.5.

## The lesson standard

Taken from Tim's A07 booklet (10 Nov 2026). Lesson 3 of that booklet, positive gradients, is the
model; a few strong features of other lessons are added. The prompt asks for:

1. A one or two sentence key idea that names the new vocabulary.
2. A check in of four or five questions that retrieves exactly this lesson's prerequisites, with
   one fill-in-the-blank on the new words.
3. Worked example and Our turn side by side, with the same numbered steps (a four-step method such
   as table, coordinates, plot, join where it fits). Our turn's step text fades.
4. Your turn: several near-identical questions with the same pre-drawn diagram or empty table.
5. Diagnostic questions: multiple choice A to D, each wrong option built on one named
   misconception.
6. Practice that fades: support given, then bare, then a harder variant.
7. Spot the mistake: a named pupil's wrong working to find and correct.
8. A self-check list where it helps, and an open challenge such as "Is this the only answer?".
9. Where the idea can be discovered, a short discovery set followed by a boxed generalisation.

It also rules out what the weaker lessons did: mixed styles, pasted sheets, screenshots and wrong
lesson numbers.

## Editing

The outline beside the preview edits everything: cover and introduction, each lesson's fields and
teacher notes, sections (kind, cards per row, heading, instruction, order) and cards (order, move
between sections, duplicate, delete, every item field). Edits are undoable (60 steps), the booklet
is saved on the device, and the File menu saves and opens editable `.json` files. Layout problems
show in the Checks panel with the lesson and card they belong to, and PDFs are refused until they
are fixed.

## Tests

`packages/resource-core/src/booklet.test.ts` checks the schema and layout rules on the A7 example.
`src/booklet/ai/booklet-ai.test.ts` checks the prompts stay stable, the lesson checks (schema
paths, layout problems in millimetres, no answers on pupil diagrams), placeholders and structural
edits. `e2e/booklet.spec.ts` (`npx playwright test --project=booklet`) edits and undoes the example,
downloads the booklet and one lesson as vector PDFs, plans and writes a unit against a mocked Claude
stream, and refuses a worksheet file.

## Not yet done

- A connector tool (`create_booklet`) so Claude and ChatGPT can produce booklets in chat. Download
  links are size-limited, so a whole booklet needs stored files rather than a link.
- A real run with a key to tune the prompt against Tim's A07 booklet.
