import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical, layout, type Envelope } from "../packages/chart-core/src";
import { examples } from "../packages/chart-core/src/examples";
import { printRasterSize, verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { clickResourceAction } from "./resource-actions";

const report = resolve(process.env.CHART_REPORT_DIR ?? "test-results/chart-artifacts");
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:charts:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/charts");
  await expect(page.getByTestId("chart-resource").locator("svg")).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const bars = (page: Page) => page.getByTestId("chart-resource").locator("svg rect[stroke-width='0.3']:not([width='8'])");

test("edits a bar from the chart, keeps invalid drafts visible and undoes", async ({ page }) => {
  await boot(page);
  await expect(bars(page)).toHaveCount(8);
  await page.getByRole("button", { name: "Edit bar: Walk, girls" }).click();
  const field = page.getByLabel("Value for Walk, girls");
  await expect(field).toBeFocused();
  await field.fill("six");
  await field.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Walk, girls: enter a number" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await expect(field).toHaveValue("six");
  await field.fill("9");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: "Copy image" })).toBeEnabled();
  expect((await saved(page)).document.series[1].values[2].value).toBe("9");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field).toHaveValue("6");
});

test("hidden values stay saved answers and switching type keeps every data set", async ({ page }) => {
  await boot(page, examples[0].make(false));
  await expect(bars(page)).toHaveCount(9);
  await page.getByLabel("Show saved answers").check();
  await expect(bars(page)).toHaveCount(10);
  await page.getByLabel("Show saved answers").uncheck();
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  await expect(page.getByText(/draws only the first data set/)).toBeVisible();
  await page.getByRole("button", { name: "Vertical line chart" }).click();
  await expect(page.getByTestId("chart-resource").locator("svg line[stroke-width='0.6']")).toHaveCount(5);
  await expect(page.getByText(/vertical line chart draws only the first data set/)).toBeVisible();
  const doc = (await saved(page)).document;
  expect(doc.series).toHaveLength(2);
  expect(doc.series[1].values[2]).toEqual({ value: "3", show: "hidden" });
});

test("exports a 600 ppi PNG and an SVG at the stated physical size", async ({ page }) => {
  const e = examples[1].make(false);
  await boot(page, e);
  const g = layout(e);
  const pngPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const path = resolve(report, "composite-600ppi.png");
  await (await pngPromise).saveAs(path);
  const size = printRasterSize(g.width / 10, g.height / 10);
  verifyPrintBytes(new Uint8Array(readFileSync(path)), size.width, size.height);
  const svgPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download SVG");
  const svgPath = resolve(report, "composite.svg");
  await (await svgPromise).saveAs(svgPath);
  const svg = readFileSync(svgPath, "utf8");
  expect(svg).toContain(`width="${g.width}mm"`);
  expect(svg).not.toMatch(/ch-hit|button/);
});

test("adds a category beside the chart and work survives leaving the page", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Add a category at the end" }).click();
  await expect(page.getByLabel("Category 5 label")).toBeFocused();
  await page.getByLabel("Category 5 label").fill("Train");
  await page.getByLabel("Category 5 label").press("Enter");
  await page.getByRole("link", { name: "Venn diagrams" }).first().click();
  await page.getByRole("link", { name: "Bar and line charts" }).first().click();
  await expect(page.getByLabel("Category 5 label")).toHaveValue("Train");
  await page.reload();
  await expect(page.getByLabel("Category 5 label")).toHaveValue("Train");
});
