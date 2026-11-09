import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { comparativeBarCharts, treeDiagrams } from "../packages/resource-core/src/fixtures";
import type { Resource } from "../packages/resource-core/src/index";

const key = "maths-booklet-tools:worksheet:v1";
const out = resolve("test-results/worksheet-artifacts");
mkdirSync(out, { recursive: true });

async function boot(page: Page, r?: Resource) {
  if (r) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(r)]);
  await page.goto("/tools/worksheet");
  await expect(page.getByTestId("worksheet-pages").locator(".ws-art > svg")).toHaveCount(2);
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key) as Promise<Resource>;
const question = (page: Page, n: number) => page.locator("details.ws-card", { has: page.locator(".ws-q", { hasText: new RegExp(`^${n}$`) }) });

test("edits wording, saves it, shows it on the sheet and undoes", async ({ page }) => {
  await boot(page);
  await question(page, 1).locator("summary").click();
  const title = page.getByRole("textbox", { name: "Question 1 title" });
  await title.fill("Read the tree diagram");
  await title.press("Enter");
  expect((await saved(page)).document.sides[0].columns[0].cards[0].title).toBe("Read the tree diagram");
  await expect(page.getByTestId("worksheet-pages").locator(".ws-art > svg").first()).toContainText("Read the tree diagram");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.sides[0].columns[0].cards[0].title).toBe(treeDiagrams.document.sides[0].columns[0].cards[0].title);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(title).toHaveValue("Read the tree diagram");
});

test("switches a table cell between given, blank and hidden answer without losing its text", async ({ page }) => {
  await boot(page, comparativeBarCharts);
  await question(page, 3).locator("summary").click();
  const state = page.getByRole("combobox", { name: "Row 1 cell 2 shows" }).first();
  await state.selectOption("hidden");
  let cell = (await saved(page)).document.sides[0].columns[1].cards[0].items.find((i) => i.type === "table");
  expect(cell && cell.type === "table" && cell.rows[0][1]).toEqual({ text: "6", state: "hidden" });
  // Pupils see an empty box; the teacher preview shows the saved answer.
  const side1 = page.getByTestId("worksheet-pages").locator(".ws-art > svg").first();
  await page.getByLabel("Teacher preview: show hidden answers").check();
  await expect(side1.locator('text[fill="#b0125b"]', { hasText: /^6$/ })).toHaveCount(1);
  await page.getByLabel("Teacher preview: show hidden answers").uncheck();
  await expect(side1.locator('text[fill="#b0125b"]')).toHaveCount(0);
  await state.selectOption("blank");
  cell = (await saved(page)).document.sides[0].columns[1].cards[0].items.find((i) => i.type === "table");
  expect(cell && cell.type === "table" && cell.rows[0][1]).toEqual({ text: "6", state: "blank" });
});

test("reports overflow, blocks the PDF and recovers when a question moves", async ({ page }) => {
  await boot(page, treeDiagrams);
  await expect(page.locator(".ws-checks li.problem")).toHaveCount(0);
  await question(page, 4).locator("summary").click();
  const space = page.getByRole("spinbutton", { name: /drawing space/ }).first();
  await space.fill("200");
  await space.press("Enter");
  await expect(page.locator(".ws-checks li.problem")).toContainText("needs");
  await expect(page.getByRole("button", { name: "Pupil PDF" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".ws-checks li.problem")).toHaveCount(0);
  await page.getByRole("button", { name: "Move question 4 up" }).click();
  const doc = await saved(page);
  expect(doc.document.sides[0].columns[1].cards[0].title).toBe("Draw a tree diagram");
});

test("downloads two-page A3 vector PDFs named by the guide and opens a saved file", async ({ page }) => {
  await boot(page, treeDiagrams);
  const [pupil] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pupil PDF" }).click()]);
  expect(pupil.suggestedFilename()).toBe("SP7.01_List outcomes of combined events using a tree diagram_A3.pdf");
  const file = resolve(out, "pupil.pdf");
  await pupil.saveAs(file);
  const bytes = readFileSync(file);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((420 * 72) / 25.4, 1);
  expect(bytes.toString("latin1")).toContain("/FontFile2");
  expect(bytes.toString("latin1")).not.toContain("/Subtype /Image");

  const changed = structuredClone(comparativeBarCharts);
  const upload = resolve(out, "upload.json");
  writeFileSync(upload, JSON.stringify(changed));
  await page.getByRole("button", { name: "File" }).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Open worksheet file" }).click()]);
  await chooser.setFiles(upload);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  expect((await saved(page)).document.title).toBe("Comparative bar charts");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.title).toBe(treeDiagrams.document.title);
});
