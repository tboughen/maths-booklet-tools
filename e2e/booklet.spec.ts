import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { a7Booklet } from "../packages/resource-core/src/booklet-fixtures";
import type { Booklet } from "../packages/resource-core/src/index";

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
  await expect(page.locator(".resource-size")).toHaveText("A4 portrait, 11 pages");
  await page.locator("details.bk-lesson").nth(1).locator(":scope > summary").click();
  const title = page.getByRole("textbox", { name: "Lesson 2 title" });
  await title.fill("Gradients of lines");
  await title.press("Enter");
  expect((await saved(page)).document.lessons[1].title).toBe("Gradients of lines");
  await expect(page.getByTestId("booklet-pages").locator("svg").first()).toContainText("Gradients of lines");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.lessons[1].title).toBe(a7Booklet.document.lessons[1].title);
  // Answers appear only in the teacher preview.
  // The check-in's ratio tables hold their answers as hidden cells and hidden ÷ 4 steps.
  const hiddenOnPage5 = page.locator("#bk-page-5 .ratio-hidden-answer");
  const answerInk = page.locator('#bk-page-5 [fill="#b0125b"]');
  await expect(hiddenOnPage5).toHaveCount(0);
  await expect(answerInk).toHaveCount(0);
  await expect(page.locator("#bk-page-5")).not.toContainText("÷");
  await page.getByLabel("Teacher preview: show hidden answers").check();
  await expect(hiddenOnPage5).toHaveCount(2);
  await expect(answerInk).not.toHaveCount(0);
  await expect(page.locator("#bk-page-5")).toContainText("÷");
});

test("downloads the A4 booklet and one lesson as vector PDFs", async ({ page }) => {
  await boot(page, a7Booklet);
  const [pupil] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pupil PDF" }).click()]);
  expect(pupil.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Booklet_A4.pdf");
  const file = resolve(out, "pupil.pdf");
  await pupil.saveAs(file);
  const bytes = readFileSync(file);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(11);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((210 * 72) / 25.4, 1);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo((297 * 72) / 25.4, 1);
  expect(bytes.toString("latin1")).not.toContain("/Subtype /Image");

  await page.locator("details.bk-lesson").nth(1).locator(":scope > summary").click();
  const [lesson] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Lesson PDF" }).first().click()]);
  expect(lesson.suggestedFilename()).toBe("A7_Algebraic proficiency visualising_Lesson 2_A4.pdf");
  await lesson.saveAs(resolve(out, "lesson.pdf"));
  expect((await PDFDocument.load(readFileSync(resolve(out, "lesson.pdf")))).getPageCount()).toBe(7);
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

test("refuses a worksheet file with a pointer to the Worksheets page", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "File" }).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Open booklet file" }).click()]);
  await chooser.setFiles({ name: "sheet.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ tool: "resource", schemaVersion: 1, document: { kind: "worksheet-a3" } })) });
  await expect(page.locator(".ws-message")).toContainText("Open it on the Worksheets page");
});
