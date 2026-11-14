# Booklet maker

The Booklets page (`/booklets`, its own section of the site) makes an A4 portrait unit booklet, one
lesson per scheme-of-work objective, with the teacher's own AI key. Every question stays editable,
and the page downloads pupil and answers PDFs and Word files for the whole booklet or one lesson
(Word files: `docs/content/WORD-OUTPUT.md`). Code:
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
  about 180,000 output tokens including thinking, roughly $2 to $2.50 on Sonnet 5.5.

## The lesson standard

A worksheet follows teaching: it is used after the teacher has modelled the method. A booklet is used
with the teaching and is the one-stop shop, so it also holds the check-in, the worked example and the
"we do". Tim agreed the split on 14 Nov 2026, after the pedagogy comparison trial on A7.03 and A7.07;
the model is lesson 3 of his A07 booklet (positive gradients) with the best ideas from its other lessons.
The prompt asks for, in order:

1. A one or two sentence key idea that names the new vocabulary.
2. A check in first: four or five questions on exactly this lesson's prerequisites, with one
   fill-in-the-blank on the new words.
3. Where the idea can be discovered, a short discovery set followed by a boxed generalisation.
4. Worked example beside Our turn, with the same numbered steps (a four-step method such as table,
   coordinates, plot, join where it fits). Our turn keeps the step labels and leaves the work blank.
5. Your turn: near-identical questions with the same pre-drawn diagram or empty table, help fading.
6. Diagnostic questions for mini whiteboards: multiple choice A to D, each wrong option built on one
   named misconception.
7. Practice that fades (support given, then bare, then a changed presentation, then reasoning), with
   at least three unaided questions for every case the lesson names.
8. Spot the mistake: one explain-or-correct card on a named pupil's wrong working for each
   misconception, so every known error is targeted in both forms.
9. A short "From earlier" strip on earlier lessons or units.
10. A challenge, such as "Is this the only answer?" or a near case that cannot be judged by eye.
11. Exam-style questions last, in Edexcel wording, with marks as text ("(Total for Question 2 is 3
    marks)").

Throughout: the school's method, named the same way wherever the skill returns; one new step at a
time; room for every table, triangle or working asked for; sort, classify and mixed-representation
sets and self-check tick boxes where they suit. A lesson is about 25 to 35 cards, 5 to 8 pages.

School methods are school information, so they never go in this repository. A scheme file may list
them as optional `methods` (`topic`, `method`, `layout`); the department scheme in the private bank
can carry them, and the plan and lesson requests then name them. Without a list, the plan names the
method and every lesson section uses it.

## Editing

The outline beside the preview edits everything: cover and introduction, each lesson's fields and
teacher notes, sections (kind, cards per row, heading, instruction, order) and cards (order, move
between sections, duplicate, delete, every item field). Edits are undoable (60 steps), the booklet
is saved on the device, and the File menu saves and opens editable `.json` files. Layout problems
show in the Checks panel with the lesson and card they belong to, and PDFs and Word files are refused
until they are fixed.

The File menu also downloads the pupil and answers Word files, and each lesson has a Lesson Word
button beside Lesson PDF. The page writes them with the connector's own writer and the same resvg
version compiled to WebAssembly (`src/export/word.ts`, loaded only when a Word file is first asked
for), so the website and a chat give byte-identical files.

## Tests

`packages/resource-core/src/booklet.test.ts` checks the schema and layout rules on the A7 example.
`src/booklet/ai/booklet-ai.test.ts` checks the prompts stay stable, the lesson checks (schema
paths, layout problems in millimetres, no answers on pupil diagrams), placeholders and structural
edits. `e2e/booklet.spec.ts` (`npx playwright test --project=booklet`) edits and undoes the example,
downloads the booklet and one lesson as vector PDFs and as Word files (checked byte for byte against
the connector's writer), plans and writes a unit against a mocked Claude stream, and refuses a
worksheet file. `packages/resource-core/src/docx.test.ts` checks the booklet Word files' pages,
page numbers, pinned rows and footers, and its answer canary covers the example booklet.

## Connector tool

One call takes a whole unit: an MCP request may be up to 512 KiB for `create_booklet` (64 KiB for
every other tool, unchanged). Tim's first real A7 run (11 Nov 2026) hit the old 64 KiB limit at
about 88 KB for 11 lessons.

`create_booklet {booklet}` on the MCP connector makes the same booklet in chat (Claude or ChatGPT).
`worksheet_capabilities` lists its layout, limits and section kinds. The reply has previews of the
cover and the first page of up to three lessons, the layout issues (lesson, section, question and
page), and, only when the booklet fits:

- whole-booklet pupil PDF, answers PDF, pupil and answers Word files and editable JSON as signed
  seven-day links. A small
  booklet travels inside its link; a whole unit is too big for that, so the service keeps it for
  eight days in Cloudflare Workers KV (the namespace the daily byte counter uses, keys
  `graph-mcp-document:<sha256>`) and the link names its hash, which is checked again on download.
  Without KV (local runs) it is kept in memory and its links stop at a restart. Files are never
  pushed into the reply, so a unit costs no extra chat tokens;
- a pupil and an answers PDF link for every lesson. Each carries a one-lesson booklet plus
  numbering offsets, so the lesson prints exactly as it does in the full booklet, with the same
  lesson and page numbers. A lesson too large for a link is named in the reply;
- a pupil and an answers Word link for every lesson, numbered the same way. When the whole booklet
  is kept in the store, a lesson's Word link names the stored booklet and the lesson (about 400
  characters), so twelve lessons add little to the reply; the service saves the booklet once per
  reply.

The output schema gives the returned booklet as a plain object rather than repeating its schema,
which keeps the tool list about 12 KB smaller.

## Not yet done

- A real run with a key to tune the prompt against Tim's A07 booklet.
