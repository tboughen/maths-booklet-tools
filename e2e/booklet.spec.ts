import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { a7Booklet } from "../packages/resource-core/src/booklet-fixtures";
import { singleLessonBooklet, type Booklet } from "../packages/resource-core/src/index";
import { bookletDocx } from "../services/graph-mcp/worksheet-docx";
import { FAMILIES } from "../packages/diagram-core/src/registry";

const key = "maths-booklet-tools:booklet:v1";
const out = resolve("test-results/booklet-artifacts");
mkdirSync(out, { recursive: true });

async function boot(page: Page, b?: Booklet) {
  if (b) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(b)]);
  await page.goto("/booklets");
  await expect(page.getByTestId("booklet-pages").locator(".ws-art > svg").first()).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key) as Promise<Booklet>;

function claudeStream(tool: string, input: unknown, id: string) {
  const json = JSON.stringify(input);
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return [
    ev("message_start", { message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 1, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 } } }),
    ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: `toolu_${id}`, name: tool, input: {} } }),
    ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: json } }),
    ev("content_block_stop", { index: 0 }),
    ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 9000 } }),
    ev("message_stop", {}),
  ].join("");
}

test("shows the example booklet with a contents page, edits a lesson title and undoes it", async ({ page }) => {
  await boot(page);
  await expect(page.locator(".resource-size")).toHaveText("A4 portrait, 12 pages");
  await page.locator("details.bk-lesson").nth(1).locator(":scope > summary").click();
  const title = page.getByRole("textbox", { name: "Lesson 2 title" });
  await title.fill("Gradients of lines");
  await title.press("Enter");
  expect((await saved(page)).document.lessons[1].title).toBe("Gradients of lines");
  await expect(page.getByTestId("booklet-pages").locator("svg").first()).toContainText("Gradients of lines");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.lessons[1].title).toBe(a7Booklet.document.lessons[1].title);
  // Maths printing (stacked fractions and maths typesetting) is a cover setting, undoable like any edit.
  const stacked = page.getByRole("checkbox", { name: /Maths printing/ });
  await expect(stacked).toBeChecked();
  await stacked.uncheck();
  expect((await saved(page)).document.notation).toBe("plain");
  await expect(page.getByTestId("booklet-pages")).toContainText("{1/3}");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.notation).toBe("maths");
  // Answers appear only in the teacher preview.
  // The check-in's ratio tables hold their answers as hidden cells and hidden ÷ 4 steps.
  const hiddenOnPage5 = page.locator("#bk-page-5 .ratio-hidden-answer");
  const answerInk = page.locator('#bk-page-5 [fill="#b0125b"]');
  await expect(hiddenOnPage5).toHaveCount(0);
  await expect(answerInk).toHaveCount(0);
  await expect(page.locator("#bk-page-5")).not.toContainText("÷");
  await page.getByLabel("Teacher preview: show answers").check();
  await expect(hiddenOnPage5).toHaveCount(2);
  await expect(answerInk).not.toHaveCount(0);
  await expect(page.locator("#bk-page-5")).toContainText("÷");
});

test("downloads the A4 booklet and one lesson as vector PDFs", async ({ page }) => {
  // A whole-booklet PDF and a lesson PDF are written in the browser.
  test.setTimeout(60_000);
  await boot(page, a7Booklet);
  const [pupil] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pupil PDF" }).click()]);
  expect(pupil.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Booklet_A4.pdf");
  const file = resolve(out, "pupil.pdf");
  await pupil.saveAs(file);
  const bytes = readFileSync(file);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(12);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4, 1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo((297 * 72) / 25.4, 1);
  expect(bytes.toString("latin1")).not.toContain("/Subtype /Image");

  await page.locator("details.bk-lesson").nth(1).locator(":scope > summary").click();
  // The pinned Chromium exposes buttons inside a closed lesson to role queries, so name the lesson.
  const lessonPdf = page.getByRole("group", { name: "Lesson 2" }).getByRole("button", { name: "Lesson PDF" });
  const [lesson] = await Promise.all([page.waitForEvent("download"), lessonPdf.click()]);
  expect(lesson.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Lesson 2_A4.pdf");
  await lesson.saveAs(resolve(out, "lesson.pdf"));
  expect((await PDFDocument.load(readFileSync(resolve(out, "lesson.pdf")))).getPageCount()).toBe(8);
});

test("downloads the booklet and one lesson as Word files identical to the connector's", async ({ page }) => {
  // The page writes Word files with the connector's writer and the same resvg version (as WebAssembly),
  // so a teacher gets the same bytes from the website as from a chat.
  test.setTimeout(90_000);
  await boot(page, a7Booklet);
  const roots = { text: resolve("assets/resource-fonts"), diagrams: resolve("assets/graph-fonts") };
  const version = "MathsDock booklet renderer, Word output 1";
  await page.getByRole("button", { name: "File" }).click();
  const [answers] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Download answers Word file" }).click()]);
  expect(answers.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Booklet_Answers_A4.docx");
  await answers.saveAs(resolve(out, "answers.docx"));
  const expected = await bookletDocx(a7Booklet, "answers", roots, version);
  expect(Buffer.compare(readFileSync(resolve(out, "answers.docx")), Buffer.from(expected.bytes))).toBe(0);
  expect(expected.pages).toBe(12);

  await page.locator("details.bk-lesson").nth(1).locator(":scope > summary").click();
  const lessonWord = page.getByRole("group", { name: "Lesson 2" }).getByRole("button", { name: "Lesson Word" });
  const [lesson] = await Promise.all([page.waitForEvent("download"), lessonWord.click()]);
  expect(lesson.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Lesson 2_A4.docx");
  await lesson.saveAs(resolve(out, "lesson.docx"));
  const one = singleLessonBooklet(a7Booklet, 1);
  const lessonExpected = await bookletDocx(one.booklet, "pupil", roots, version, one.numbering);
  expect(Buffer.compare(readFileSync(resolve(out, "lesson.docx")), Buffer.from(lessonExpected.bytes))).toBe(0);
  expect(lessonExpected.pages).toBe(8);
});

test("plans a unit and writes each lesson with the teacher's own Claude key, then undoes it", async ({ page }) => {
  const scheme = {
    schemaVersion: 1,
    kind: "scheme-of-work",
    name: "Department scheme",
    units: [{ code: "A7", title: "Algebraic proficiency: visualising", years: [9], objectives: [{ code: "A7.01", text: "Plot graphs of functions of the form y = m x ± c" }, { code: "A7.03", text: "Find the gradient of a straight line (positive)" }, { code: "A7.11", text: "Plot and interpret distance-time graphs" }] }],
  };
  const object = `bank/assets/sha256/${"b".repeat(64)}.json`;
  await page.route("**/bank/schemes.json", (route) => route.fulfill({ json: { schemaVersion: 1, school: object } }));
  await page.route(`**/${object}`, (route) => route.fulfill({ json: scheme }));
  const [plot, gradient] = a7Booklet.document.lessons;
  const plan = {
    plan: "Plot first, then read gradients from the plotted lines.",
    flags: "",
    title: "Straight-line graphs",
    coverNote: "Bring a ruler.",
    intro: a7Booklet.document.intro,
    lessons: [plot, gradient].map((l) => ({ title: l.title, code: l.code, objective: l.objective, keyIdea: l.keyIdea, plan: l.teacherNotes })),
  };
  const asked: string[] = [];
  await page.route("https://api.anthropic.com/**", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = route.request().postDataJSON() as { tools: { name: string }[]; messages: { content: string }[]; system: { cache_control?: object }[] };
    const tool = body.tools[0].name;
    asked.push(tool);
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    const input = tool === "submit_booklet_plan" ? plan : { flags: "", lesson: body.messages[0].content.includes("Title: Plot") ? plot : gradient };
    await route.fulfill({ headers: { ...cors, "content-type": "text/event-stream" }, body: claudeStream(tool, input, String(asked.length)) });
  });
  await boot(page, a7Booklet);
  const ai = page.getByRole("region", { name: "Make with AI" });
  await ai.getByLabel("Your API key").fill("sk-ant-api03-test-key-0000000000000000");
  await ai.getByRole("combobox", { name: "Unit", exact: true }).selectOption("A7");
  await expect(ai.getByLabel("Year or tier")).toHaveValue("Year 9");
  await ai.getByLabel(/A7\.11/).uncheck();
  await ai.getByLabel(/check-in lesson/).uncheck();
  await expect(ai.locator(".bk-estimate")).toContainText("2 lessons");
  await ai.getByRole("button", { name: "Make booklet" }).click();
  await expect(page.locator(".ws-message")).toContainText("Booklet made by claude-opus-5-5: 2 lessons");
  expect(asked).toEqual(["submit_booklet_plan", "submit_lesson", "submit_lesson"]);
  const made = await saved(page);
  expect(made.document.title).toBe("Straight-line graphs");
  expect(made.document.code).toBe("A7");
  expect(made.document.lessons.map((l) => l.code)).toEqual(["A7.01", "A7.03"]);
  await expect(ai).toContainText("Spent in this tab: about $");
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("sk-ant-api03");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.title).toBe(a7Booklet.document.title);
});

test("refuses a worksheet file with a pointer to the Worksheet builder", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "File" }).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Open booklet file" }).click()]);
  await chooser.setFiles({ name: "sheet.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ tool: "resource", schemaVersion: 1, document: { kind: "worksheet-a3" } })) });
  await expect(page.locator(".ws-message")).toContainText("Open it in the Worksheet builder");
});

test("edits a card on the page: click it, change its words, close it and undo", async ({ page }) => {
  await boot(page);
  const pages = page.getByTestId("booklet-pages");
  await pages.getByRole("button", { name: "Edit question A, lesson 1" }).click();
  const pop = page.getByRole("region", { name: "Edit Question A" });
  await expect(pop).toBeVisible();
  await expect(pages.getByRole("button", { name: "Edit question A, lesson 1" })).toHaveAttribute("aria-pressed", "true");
  const title = pop.getByRole("textbox", { name: "Card title" });
  await title.fill("Substitute into each expression");
  await title.press("Enter");
  expect((await saved(page)).document.lessons[0].sections[0].cards[0].title).toBe("Substitute into each expression");
  const drawn = pages.locator(".bk-page.editing .ws-art > svg");
  await expect(drawn).toContainText("Substitute into each expression");
  // The page controls never reach the drawn page or its exports.
  expect(await drawn.evaluate((svg) => /bk-spot|bk-selected|<button/.test(svg.outerHTML))).toBe(false);
  // Escape in a field restores its words, as everywhere on the site; outside a field it closes the editor.
  await pop.getByRole("heading", { name: "Question A" }).click();
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.lessons[0].sections[0].cards[0].title).toBe("Substitute");
});

test("opens a lesson source from a booklet build and runs the build's checks live", async ({ page }) => {
  await boot(page);
  const lesson = singleLessonBooklet(a7Booklet, 0).booklet;
  const source = { code: "A7.01", sides: 6, lessonNumber: 1, working: [], booklet: lesson };
  await page.getByRole("button", { name: "File" }).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Open booklet file" }).click()]);
  await chooser.setFiles({ name: "source.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(source)) });
  await page.getByRole("alertdialog").getByRole("button", { name: "Open" }).click();
  const checks = page.getByTestId("build-checks");
  await expect(checks).toContainText("Build checks, lesson 1");
  await expect(checks).toContainText("M1");
  await expect(checks).not.toContainText("N13");
  // A retrieval heading must name its lessons (N13): the check shows as soon as the edit lands.
  const heading = page.getByRole("textbox", { name: "Heading (empty uses the kind)" }).first();
  await heading.fill("From earlier");
  await heading.press("Enter");
  await expect(checks).toContainText("N13");
  // Saving keeps the stored working and sides beside the edited booklet.
  await page.getByRole("button", { name: "File" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Save lesson source file" }).click()]);
  const written = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(written.sides).toBe(6);
  expect(written.working).toEqual([]);
  expect(written.lessons).toBeUndefined();
  expect(written.booklet.document.lessons[0].sections[0].title).toBe("From earlier");
  // Undoing the open puts the source aside with its booklet; redoing brings both back.
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(checks).toBeHidden();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(checks).toBeVisible();
});

test("edits a card's diagram in its own tool, in a dialog over the booklet, then undoes it", async ({ page }) => {
  // Question A carries the example's ratio table, so the test reaches it by its label.
  const b = structuredClone(a7Booklet);
  const all = b.document.lessons.flatMap((l) => l.sections.flatMap((s) => s.cards.flatMap((c) => c.items)));
  const table = all.find((i) => i.type === "diagram" && i.diagram.tool === "ratio-table")!;
  b.document.lessons[0].sections[0].cards[0].items.push(structuredClone(table));
  await page.addInitScript(() => localStorage.setItem("maths-booklet-tools:ratio-table-envelope:v1", '{"teacher":"own work"}'));
  await boot(page, b);
  const before = JSON.stringify((await saved(page)).document.lessons[0].sections[0].cards[0].items.at(-1));
  await page.getByTestId("booklet-pages").getByRole("button", { name: "Edit question A, lesson 1" }).click();
  const card = page.getByRole("region", { name: "Edit Question A" });
  await card.getByRole("button", { name: "Edit the ratio table in its tool" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit the ratio table" });
  await expect(dialog).toBeVisible();
  const tool = page.frameLocator(".bk-diagram-frame");
  // The real tool, on its own: no site header, and the card's table loaded.
  await expect(tool.getByRole("heading", { name: "Ratio tables" })).toBeVisible();
  await expect(tool.locator(".site-header")).toHaveCount(0);
  // Cancel leaves the card as it was.
  await tool.getByLabel("Show arrows", { exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(JSON.stringify((await saved(page)).document.lessons[0].sections[0].cards[0].items.at(-1))).toBe(before);
  // Done puts the changed table back as one undo step.
  await card.getByRole("button", { name: "Edit the ratio table in its tool" }).click();
  await tool.getByLabel("Show arrows", { exact: true }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("The diagram is back in the card.")).toBeVisible();
  const after = (await saved(page)).document.lessons[0].sections[0].cards[0].items.at(-1)!;
  expect(after.type === "diagram" && after.diagram.envelope).toBeTruthy();
  expect(JSON.stringify(after)).not.toBe(before);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(JSON.stringify((await saved(page)).document.lessons[0].sections[0].cards[0].items.at(-1))).toBe(before);
  // The teacher's own ratio table work is untouched, and the copies are tidied away.
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("maths-booklet-tools:ratio-table-envelope:v1")));
  expect(stored).toEqual(["maths-booklet-tools:ratio-table-envelope:v1"]);
  expect(await page.evaluate(() => localStorage.getItem("maths-booklet-tools:ratio-table-envelope:v1"))).toBe('{"teacher":"own work"}');
});

test("opens the five most used diagram tools from a card with the card's diagram, untouched by Done", async ({ page }) => {
  test.setTimeout(150000);
  const kinds = [
    ["graph", "Graph tool", "graph"],
    ["number-line", "Number lines", "number line"],
    ["bar-model", "Bar modelling", "bar model"],
    ["charts", "Statistical charts", "statistical chart"],
    ["value-graph", "Plotting quadratics", "table of values and graph"],
  ] as const;
  const b = structuredClone(a7Booklet);
  for (const [kind] of kinds) b.document.lessons[0].sections[0].cards[0].items.push({ type: "diagram", diagram: { tool: kind, envelope: FAMILIES[kind].create({ spec: kind === "graph" ? { objects: [] } : {} }) as Record<string, unknown> } });
  await boot(page, b);
  const start = JSON.stringify((await saved(page)).document.lessons[0].sections[0].cards[0]);
  await page.getByTestId("booklet-pages").getByRole("button", { name: "Edit question A, lesson 1" }).click();
  const card = page.getByRole("region", { name: "Edit Question A" });
  for (const [kind, heading] of kinds) {
    await card.getByRole("button", { name: `Edit the ${FAMILIES[kind].label} in its tool` }).click();
    const dialog = page.getByRole("dialog", { name: `Edit the ${FAMILIES[kind].label}` });
    const tool = page.frameLocator(".bk-diagram-frame");
    await expect(tool.getByRole("heading", { name: heading, exact: true })).toBeVisible({ timeout: 20000 });
    await expect(tool.getByText("Copy for the booklet card")).toBeVisible();
    await expect(tool.getByText(/needs recovery|cannot be read/i)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
  }
  expect(JSON.stringify((await saved(page)).document.lessons[0].sections[0].cards[0])).toBe(start);
});
