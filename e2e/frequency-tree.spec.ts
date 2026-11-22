import { switchTool } from "./tool-switcher";
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical, layout, type Envelope } from "../packages/frequency-tree-core/src";
import { examples } from "../packages/frequency-tree-core/src/examples";
import { printRasterSize, verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { clickResourceAction } from "./resource-actions";

const report = resolve(process.env.FREQUENCY_TREE_REPORT_DIR ?? "test-results/frequency-tree-artifacts");
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:frequency-tree:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/frequency-tree");
  await expect(page.getByTestId("frequency-tree-resource").locator("svg")).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("frequency-tree-resource").locator("svg");

test("edits a count from the tree, shows hidden answers only in the teacher copy and undoes", async ({ page }) => {
  await boot(page);
  await expect(art(page).locator("text", { hasText: /^37$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^37$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A click opens the options box with the text selected: typing replaces it (typing first, 22 Nov 2026).
  const target = page.getByRole("button", { name: /^Edit count for men\b/ }).first();
  await target.click();
  await expect(page.getByRole("textbox", { name: "Text of count for men", exact: true })).toBeFocused();
  await page.keyboard.type("30");
  await page.keyboard.press("Enter");
  expect((await saved(page)).document.nodes[0].count).toEqual({ text: "30", show: "hidden" });
  const field = page.getByRole("textbox", { name: "Count for men", exact: true });
  await expect(field).toHaveValue("30");
  // A double-click brings the value back from a pupil space.
  await target.dblclick();
  expect((await saved(page)).document.nodes[0].count.show).toBe("show");
  await expect(art(page).locator("text", { hasText: /^30$/ })).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field).toHaveValue("32");
});

test("works out missing counts and calculates a question only on request", async ({ page }) => {
  await boot(page);
  for (const label of ["Count for men", "Count for women", "Count for women, like coffee", "Count for women, do not like coffee"]) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    await field.fill("");
    await field.press("Enter");
  }
  await page.getByRole("button", { name: "Work out counts", exact: true }).click();
  await page.getByRole("button", { name: "Work out missing counts" }).click();
  // Men follow from their two branches; the women's branches cannot follow without the women's count.
  expect((await saved(page)).document.nodes.map((b: { count: { text: string } }) => b.count.text)).toEqual(["32", "24", "8", "48", "", ""]);
  const women = page.getByRole("textbox", { name: "Count for women, like coffee", exact: true });
  await women.fill("37");
  await women.press("Enter");
  await page.getByRole("button", { name: "Work out missing counts" }).click();
  expect((await saved(page)).document.nodes[5].count).toEqual({ text: "11", show: "hidden" });
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByText("Groups for calculating").click();
  await page.getByLabel("women, like coffee is in the top", { exact: true }).check();
  await page.getByLabel("men, like coffee is in the bottom", { exact: true }).check();
  await page.getByLabel("women, like coffee is in the bottom", { exact: true }).check();
  expect((await saved(page)).document.questions[0].answer).toEqual({ text: "", show: "hidden" });
  await page.getByRole("button", { name: "Calculate answer" }).click();
  expect((await saved(page)).document.questions[0].answer).toEqual({ text: "37/61", show: "hidden" });
});

test("changes the tree's shape from a selected group", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: /^Edit group name for women\b/ }).first().click();
  await page.getByRole("button", { name: "End the path here" }).click();
  expect((await saved(page)).document.nodes).toHaveLength(4);
  await page.getByRole("button", { name: "Add a branch beside it" }).click();
  expect((await saved(page)).document.nodes).toHaveLength(5);
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("combobox", { name: "Group names" }).selectOption("node");
  await page.getByLabel("Shape", { exact: true }).selectOption("box");
  const doc = (await saved(page)).document;
  expect([doc.labelPlace, doc.nodeShape]).toEqual(["node", "box"]);
  await expect(art(page).locator("ellipse")).toHaveCount(0);
});

test("exports a 600 ppi PNG and an SVG at the stated physical size, without editor furniture", async ({ page }) => {
  const e = examples.find((x) => x.id === "coffee")!.make(false);
  await boot(page, e);
  const g = layout(e);
  const pngPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const path = resolve(report, "frequency-tree-600ppi.png");
  await (await pngPromise).saveAs(path);
  const size = printRasterSize(g.width / 10, g.height / 10);
  verifyPrintBytes(new Uint8Array(readFileSync(path)), size.width, size.height);
  const svgPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download SVG");
  const svgPath = resolve(report, "frequency-tree.svg");
  await (await svgPromise).saveAs(svgPath);
  const svg = readFileSync(svgPath, "utf8");
  expect(svg).toContain(`width="${g.width}mm"`);
  expect(svg).not.toMatch(/pt-hit|button|37\/61|>37</);
});

test("work survives leaving the page and reloading", async ({ page }) => {
  await boot(page);
  const total = page.getByRole("textbox", { name: "Total", exact: true });
  await total.fill("120");
  await total.press("Enter");
  await switchTool(page, "Venn diagrams");
  await switchTool(page, "Frequency trees");
  await expect(total).toHaveValue("120");
  await page.reload();
  await expect(total).toHaveValue("120");
});

test("bold lines are saved, printed and undoable; normal lines are not saved (U111)", async ({ page }) => {
  await boot(page);
  const art = page.getByTestId("frequency-tree-resource").locator("svg").first();
  const first = async () => Number((await art.innerHTML()).match(/stroke-width="([\d.]+)"/)![1]);
  const normal = await first();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  const lines = page.getByLabel("Lines", { exact: true });
  await lines.selectOption("bold");
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
  // The preview is the printed SVG: every stroke is 1.5 times as heavy.
  await expect.poll(first).toBeCloseTo(normal * 1.5, 3);
  await lines.selectOption("normal");
  await expect.poll(async () => JSON.stringify(await saved(page))).not.toContain('"lines"');
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
});

test("what pupils see: a switch per kind, leave out prints nothing in either copy, clearing pupil spaces is one undo step", async ({ page }) => {
  await boot(page);
  const counts = page.getByRole("group", { name: "Counts" });
  await counts.getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.nodes.every((b: { count: { show: string } }) => b.count.show === "omit")).toBe(true);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^37$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await counts.getByRole("button", { name: "Pupil space" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.nodes.every((b: { count: { show: string } }) => b.count.show === "show")).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.nodes.every((b: { count: { show: string } }) => b.count.show === "hidden")).toBe(true);
});
