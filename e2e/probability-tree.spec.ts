import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical, layout, type Envelope } from "../packages/probability-tree-core/src";
import { examples } from "../packages/probability-tree-core/src/examples";
import { printRasterSize, verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { clickResourceAction } from "./resource-actions";

const report = resolve(process.env.TREE_REPORT_DIR ?? "test-results/probability-tree-artifacts");
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:probability-tree:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/probability-tree");
  await expect(page.getByTestId("tree-resource").locator("svg")).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

test("edits a probability from the tree, hides it for pupils and undoes", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Edit probability for Red, Blue" }).click();
  const field = page.getByRole("textbox", { name: "Probability for Red, Blue" });
  await expect(field).toBeFocused();
  await field.fill("4/7");
  await field.press("Enter");
  expect((await saved(page)).document.branches[2].probability).toEqual({ text: "4/7", show: "show" });
  await page.getByLabel("Hide probability for Red, Blue").check();
  await expect(page.getByTestId("tree-resource").locator("svg line[stroke-dasharray]")).toHaveCount(1);
  await page.getByLabel("Show saved answers").check();
  await expect(page.getByTestId("tree-resource").locator("svg line[stroke-dasharray]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field).toHaveValue("5/8");
});

test("grows an unequal tree, fills from a bag and calculates a given-that answer only on request", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Edit outcome for Red, Red" }).click();
  await page.getByRole("button", { name: "Add branches after this" }).click();
  expect((await saved(page)).document.branches).toHaveLength(8);
  await page.getByRole("button", { name: "Fill from bag" }).click();
  await page.getByRole("button", { name: "Use this tree" }).click();
  expect((await saved(page)).document.branches.map((b: { probability: { text: string } }) => b.probability.text)).toEqual([
    "5/8", "4/7", "3/6", "3/6", "3/7", "3/8", "5/7", "2/7",
  ]);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByText("Paths for calculating").click();
  await page.getByLabel("Blue, Red is in the event").check();
  await page.getByLabel("Blue, Red is in the condition").check();
  await page.getByLabel("Blue, Blue is in the condition").check();
  expect((await saved(page)).document.questions[0].answer.text).toBe("");
  await page.getByRole("button", { name: "Calculate answer" }).click();
  expect((await saved(page)).document.questions[0].answer).toEqual({ text: "5/7", show: "hidden" });
});

test("exports a 600 ppi PNG and an SVG at the stated physical size", async ({ page }) => {
  const e = examples.find((x) => x.id === "without-replacement")!.make(false);
  await boot(page, e);
  const g = layout(e);
  const pngPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const path = resolve(report, "tree-600ppi.png");
  await (await pngPromise).saveAs(path);
  const size = printRasterSize(g.width / 10, g.height / 10);
  verifyPrintBytes(new Uint8Array(readFileSync(path)), size.width, size.height);
  const svgPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download SVG");
  const svgPath = resolve(report, "tree.svg");
  await (await svgPromise).saveAs(svgPath);
  const svg = readFileSync(svgPath, "utf8");
  expect(svg).toContain(`width="${g.width}mm"`);
  expect(svg).not.toMatch(/pt-hit|button|5\/14/);
});

test("work survives leaving the page and reloading", async ({ page }) => {
  await boot(page);
  await page.getByLabel("Stage 1 title").fill("Bag A");
  await page.getByLabel("Stage 1 title").press("Enter");
  await page.getByRole("link", { name: "Venn diagrams" }).first().click();
  await page.getByRole("link", { name: "Probability trees" }).first().click();
  await expect(page.getByLabel("Stage 1 title")).toHaveValue("Bag A");
  await page.reload();
  await expect(page.getByLabel("Stage 1 title")).toHaveValue("Bag A");
});
