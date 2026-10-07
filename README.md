# Maths Booklet Tools

A teacher-friendly website for creating the fiddly diagrams needed in student-facing maths booklets. The first tool builds Edexcel-style coordinate graphs on a one-centimetre square grid and prepares them for Microsoft Word and high-quality printing.

## Question bank

[Open the question bank](https://tboughen.github.io/maths-booklet-tools/?tool=question-bank).
The initial release contains 97 reviewed GCSE maths questions across 113 Sparx
topics, with original notation, diagrams and separate mark schemes.

Search by Sparx code or topic, filter by tier/calculator/source, and select
questions to export a student paper and matching mark schemes. Compact and
writing-space layouts are available. Some topics await reviewed questions.

Topic links use `?tool=question-bank&code=U851&tier=F`; an optional `question`
parameter selects a stable question ID. Links open with answers hidden.
The graph tool remains the default page and is also available at `?tool=graph`.

Only the current reviewed assets are packaged. The website contains no class
workbooks or pupil data. Questions and graphs are processed in the browser.

## Ratio tables

The new Ratio tables page at `?tool=ratio-table` creates lesson-style two-column
diagrams with values, empty cells or answer lines, exact fractions and optional
paired scaling arrows. Copy for Word or download SVG, verified 600 ppi PNG and
editable JSON; open/share safely and undo changes. Pupil blanks remain blank
until an explicit fill action. The shared MCP service adds ratio capabilities,
creation and revision tools alongside its graph tools, with the same free hosting.
See [ratio editor](docs/RATIO-TABLE-TOOL.txt), [MCP and release](docs/RATIO-TABLE-MCP.txt)
and [reference examples](docs/ratio-table-examples/review-preview.png).

## Current graph tool

- Add any number of independent points, line segments and straight lines.
- Draw a segment by dragging between half-square snap points.
- Turn a selected segment into an infinite line, or a line back into a segment.
- Define or edit a line using `y = mx + c` or `x = a`; fractions such as `1/2` are accepted.
- Show, hide and reposition each line's equation label.
- Add or remove a square at either end of either axis.
- Set each axis independently to 0.5, 1 or 2 units per square.
- Undo and redo changes, with automatic recovery on the same device.
- Copy a Word-ready 600 ppi diagram at its intended physical size, download scalable SVG, or download a 600 ppi PNG.

Selection handles and editing controls never appear in copied or downloaded diagrams.

## Editable graphs and ChatGPT integration

Download options now includes editable JSON files, confirmed file/link imports
and shareable editor links. Imports preserve the current draft until opened
and can be undone. Existing human graphs keep their original font; portable
graphs use bundled STIX fonts consistently.

The optional stateless MCP service exposes `graph_capabilities`, `create_graph`
and `revise_graph` for direct graph creation without computer use. Human drawing
and exports work independently of that service.
See [operations and release](docs/GRAPH-MCP-RUNBOOK.txt) and
[ChatGPT connection and acceptance](docs/GRAPH-MCP-CONNECTION.txt).
Adding these files does not deploy a service or connect a ChatGPT account.

Free hosting is configured in `render.yaml`. Use a free Render workspace without
a payment method and review that the deployment lists only one Free web service.
See [free setup](docs/GRAPH-MCP-FREE-SETUP.txt) for deployment and wake-up limits.

[Deploy the graph integration candidate to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftboughen%2Fmaths-booklet-tools%2Ftree%2Fcodex%2Fchatgpt-graph-integration)

This button uses the review branch. Website import support must also pass the
normal GitHub Pages release checks before the full editor round trip is live.

## Using the tool in Word

1. Set the grid size and scale.
2. Use **Point**, **Segment**, or **Line by equation** to add objects.
3. Choose **Select** and click an object to edit only that object.
4. Choose **Copy for Word**, switch to Word, and press `Ctrl+V`.
5. If clipboard image access is blocked by the browser, use **Download SVG** and insert that file into Word.

The export declares every grid square as exactly 1 cm. Word can automatically shrink an image that is wider than the available page area, so check the image size after pasting an unusually wide graph.

## Local development

Requirements: Node.js 20.19 or later (Node 24 is used by the deployment workflow).

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` tests and builds every push to `main`, then deploys `dist` to GitHub Pages. The production base path is `/maths-booklet-tools/`, matching the intended repository name.

For a new public repository:

1. Create the repository as `maths-booklet-tools` and push this project to its `main` branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions** if GitHub has not selected it automatically.
3. Open the workflow run to confirm deployment; the site will be at `https://<github-user>.github.io/maths-booklet-tools/`.

If the repository is renamed, update the production `base` value in `vite.config.ts`.

## Project structure

- `src/domain` contains grid, geometry, equation and saved-document logic.
- `src/components` contains the GUI editor and settings panels.
- `src/export` produces the clean SVG, physical-size clipboard content and 600 ppi PNG.
- `src/**/*.test.*` covers the domain, exports and core multi-object workflow.

Human drawing and exports stay in the browser, with drafts saved locally.
When you select the optional ChatGPT graph plugin, its graph inputs are sent to
the renderer to produce files; no graph history is stored by the service.
