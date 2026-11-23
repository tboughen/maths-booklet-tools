import { switchTool } from "./tool-switcher";
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
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
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(bars(page)).toHaveCount(10);
  await page.getByLabel("Teacher copy: show answers").uncheck();
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
  await switchTool(page, "Venn diagrams");
  await switchTool(page, "Statistical charts");
  await expect(page.getByLabel("Category 5 label")).toHaveValue("Train");
  await page.reload();
  await expect(page.getByLabel("Category 5 label")).toHaveValue("Train");
});

test("bold lines are saved, printed and undoable; the grid keeps its weight (U111)", async ({ page }) => {
  await boot(page);
  const art = page.getByTestId("chart-resource").locator("svg").first();
  const axis = async () => Number((await art.innerHTML()).match(/stroke="black" stroke-width="([\d.]+)" fill="none"/)![1]);
  const grid = async () => (await art.innerHTML()).match(/stroke="#a6a6a6" stroke-width="([\d.]+)"/)?.[1];
  const normal = await axis(),
    gridWeight = await grid();
  const lines = page.getByLabel("Lines", { exact: true });
  await lines.selectOption("bold");
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
  // The preview is the printed SVG: the axes are 1.5 times as heavy, the grid is unchanged.
  await expect.poll(axis).toBeCloseTo(normal * 1.5, 3);
  expect(await grid()).toBe(gridWeight);
  await expect(art.locator("rect[stroke-width='0.45']:not([width='8'])")).toHaveCount(8);
  await lines.selectOption("normal");
  await expect.poll(async () => JSON.stringify(await saved(page))).not.toContain('"lines"');
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
});

test("downloads pupil and answers copies in one ZIP without changing the view (U28)", async ({ page }) => {
  await boot(page, examples[0].make(false));
  await expect(bars(page)).toHaveCount(9);
  const before = JSON.stringify(await saved(page));
  const pending = page.waitForEvent("download");
  await clickResourceAction(page, "Download pupil and answers (ZIP)");
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^mathsdock-charts-.*\d{4}-\d{2}-\d{2}\.zip$/);
  const path = resolve(report, "both-copies.zip");
  await download.saveAs(path);
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  const names = Object.keys(files).sort();
  expect(names).toHaveLength(4);
  const pupilSvg = names.find((n) => n.endsWith(".svg") && !n.includes("-answers-"))!,
    answerSvg = names.find((n) => n.endsWith(".svg") && n.includes("-answers-"))!;
  expect(names.filter((n) => n.endsWith(".png"))).toHaveLength(2);
  // The pupil copy keeps the hidden bar out; the answers copy draws it in the answer colour.
  const count = (svg: string) => (svg.match(/<rect [^>]*stroke-width="0.3"/g) ?? []).length;
  expect(count(strFromU8(files[answerSvg]))).toBeGreaterThan(count(strFromU8(files[pupilSvg])));
  for (const name of names.filter((n) => n.endsWith(".png"))) {
    const e = examples[0].make(false), g = layout(e), size = printRasterSize(g.width / 10, g.height / 10);
    verifyPrintBytes(files[name], size.width, size.height);
  }
  // The editor still shows the pupil copy, and the saved chart is unchanged.
  await expect(bars(page)).toHaveCount(9);
  expect(JSON.stringify(await saved(page))).toBe(before);
});

test("pie charts: switching type keeps the data, sectors edit from the chart and hidden sectors stay answers", async ({ page }) => {
  const pieExample = examples.find((x) => x.id === "pie-complete")!.make(false);
  await boot(page, pieExample);
  const art = page.getByTestId("chart-resource").locator("svg").first();
  await expect(art.locator("circle")).toHaveCount(1);
  await expect(page.getByLabel("Angle for football")).toHaveText("144°");
  await expect(art).not.toContainText("rugby");
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art).toContainText("rugby");
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Edit sector: tennis" }).click();
  const field = page.getByLabel("Value for tennis");
  await expect(field).toBeFocused();
  await field.fill("");
  await field.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "tennis: enter a number" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByLabel("Sector labels").selectOption("name-angle");
  await expect(art).toContainText("144°");
  await page.getByLabel("Pie chart radius").selectOption("60");
  await expect.poll(async () => (await saved(page)).document.pie).toEqual({ radiusMm: 60, labels: "name-angle" });
  await expect(page.getByRole("heading", { name: "Axes and grid" })).toHaveCount(0);
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  await expect(bars(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Pie chart" }).click();
  const doc = (await saved(page)).document;
  expect(doc.series[0].values[2]).toEqual({ value: "12", show: "hidden" });
});

test("pictograms: rows edit from the chart, the key can be hidden and hidden rows stay answers", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "pictogram-cycles")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  await expect(art).toContainText("represents");
  await expect(art.locator("line[stroke-dasharray]")).toHaveCount(1);
  const symbols = () => art.locator("circle[stroke='black'], path[stroke='black'][fill='white']");
  // Tuesday 1, Wednesday 2½ (3 shapes), Thursday 1½ (2 shapes), plus the key's symbol.
  await expect(symbols()).toHaveCount(7);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art.locator("line[stroke-dasharray]")).toHaveCount(0);
  await expect(art.locator("[stroke='#b0125b']")).toHaveCount(6);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Edit row: Tuesday" }).click();
  const field = page.getByLabel("Value for Tuesday");
  await expect(field).toBeFocused();
  await field.fill("8");
  await field.press("Enter");
  await expect(symbols()).toHaveCount(8);
  await page.getByLabel("Symbol", { exact: true }).selectOption("square");
  await expect(art.locator("rect[stroke='black'][fill='white']")).not.toHaveCount(0);
  await page.getByLabel("Hide the key value (pupils complete the key)").uncheck();
  await expect(art.locator("text").filter({ hasText: /^4$/ })).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).document.pictogram).toEqual({ symbol: "square", symbolMm: 10, key: { value: "4", show: "show" }, unit: "cycles" });
  await page.getByLabel("Key value", { exact: true }).fill("0");
  await page.getByLabel("Key value", { exact: true }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "The key value must be a positive number." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  await page.getByRole("button", { name: "Pictogram" }).click();
  expect((await saved(page)).document.series[0].values[4]).toEqual({ value: "15", show: "hidden" });
});

test("scatter graphs: points edit from the graph, hidden answers stay saved and the line of best fit is the teacher's", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "scatter-judges")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  const crosses = (ink: string) => art.locator(`path[stroke='${ink}'][stroke-width='0.35'][fill='none']:not([d*='H'])`);
  await expect(crosses("black")).toHaveCount(11);
  await expect(art.locator("line")).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(crosses("#b0125b")).toHaveCount(1);
  await expect(art.locator("line[stroke='#b0125b']")).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Edit point 1: (2, 1)" }).click();
  const x = page.getByLabel("Point 1 x");
  await expect(x).toBeFocused();
  await x.fill("9");
  await x.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Point 1: (9, 1) is outside the axes." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(x).toHaveValue("2");
  await page.getByRole("button", { name: "Add a point at the end" }).click();
  await expect(page.getByLabel("Point 13 x")).toBeFocused();
  await page.getByLabel("Point 13 x").fill("1");
  await page.getByLabel("Point 13 x").press("Tab");
  await page.getByLabel("Point 13 y").fill("5");
  await page.getByLabel("Point 13 y").press("Enter");
  await page.getByLabel("Ring point 13 (outlier)").check();
  await expect(art.locator("circle")).toHaveCount(1);
  await page.getByLabel("Hide the line (pupils draw it)").uncheck();
  await expect(art.locator("line[stroke='black']")).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).document.scatter.points[12]).toEqual({ x: "1", y: "5", show: "show", ring: true });
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  await page.getByRole("button", { name: "Scatter graph" }).click();
  expect((await saved(page)).document.scatter.points).toHaveLength(13);
});

test("scatter graphs: a table of values and a broken axis are options that undo", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "scatter-judges")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  await page.getByLabel("Table of values").selectOption("plot");
  // Only the hidden point (4.6, 3.8) is listed, for pupils to plot.
  await expect(art.locator("text", { hasText: /^4\.6$/ })).toHaveCount(1);
  await expect(art.locator("text", { hasText: /^5\.5$/ })).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).document.scatter.table).toBe("plot");
  await page.getByLabel("Vertical axis start").fill("1");
  await page.getByLabel("Vertical axis start").press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Break the vertical axis").check();
  await expect(art.locator("path[d*='v-1.5l-2,-1l4,-1.5l-2,-1']")).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).document.scatter.yAxis.broken).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(art.locator("path[d*='v-1.5l-2,-1l4,-1.5l-2,-1']")).toHaveCount(0);
});

test("histograms, frequency polygons and cumulative frequency share one class table", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "histogram-complete")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  const outlines = (ink: string) => art.locator(`rect[fill='none'][stroke='${ink}']`);
  await expect(outlines("black")).toHaveCount(4);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(outlines("#b0125b")).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A bar opens its frequency; a density above the axis is a specific error that blocks export.
  await page.getByRole("button", { name: /Edit class 1: 0 to 2.5/ }).click();
  const f = page.getByLabel("Class 1 frequency");
  await expect(f).toBeFocused();
  await f.fill("20");
  await f.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Class 1: the frequency density 8 is above the vertical axis." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(f).toHaveValue("3");
  // The same classes draw a frequency polygon and a cumulative frequency graph, each on its own vertical axis.
  await page.getByRole("button", { name: "Frequency polygon" }).click();
  await page.getByLabel("Vertical axis end").fill("16");
  await page.getByLabel("Vertical axis end").press("Enter");
  await page.getByLabel("Vertical axis step", { exact: true }).fill("2");
  await page.getByLabel("Vertical axis step", { exact: true }).press("Enter");
  await page.getByLabel("Vertical axis step length").selectOption("10");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(art.locator("path[stroke-width='0.353']")).toHaveCount(2 + 4); // the hidden class hides both lines that reach it: 2 lines and 4 crosses
  await page.getByRole("button", { name: "Cumulative frequency graph" }).click();
  await page.getByLabel("Vertical axis end").fill("40");
  await page.getByLabel("Vertical axis end").press("Enter");
  await page.getByLabel("Vertical axis step", { exact: true }).fill("5");
  await page.getByLabel("Vertical axis step", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Add a reading" }).click();
  await page.getByLabel("Reading 1 value").fill("20");
  await page.getByLabel("Reading 1 value").press("Enter");
  await expect(art.locator("path[stroke-dasharray]")).toHaveCount(1);
  const doc = (await saved(page)).document;
  expect(doc.grouped.classes).toHaveLength(5);
  expect(doc.grouped.classes[3]).toMatchObject({ frequency: "8", graph: "hidden" });
  expect(doc.grouped.polygon.yAxis).toMatchObject({ max: "16", step: "2", stepMm: 10 });
  expect(doc.grouped.histogram.yAxis.max).toBe("4");
});

test("box plots: values edit from the plot, hidden values stay answers and an empty band is left for pupils", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "boxplot-heights")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  const ends = (ink: string) => art.locator(`path[stroke='${ink}'][d$='v10']`);
  // Year 11 is hidden for pupils; Year 7 prints its five 1 cm lines.
  await expect(ends("black")).toHaveCount(5);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(ends("#b0125b")).toHaveCount(5);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A plot opens its median; a value out of order is a specific error that blocks export.
  await page.getByRole("button", { name: /Edit box plot 2/ }).click();
  const median = page.getByLabel("Box plot 2 median");
  await expect(median).toBeFocused();
  await median.fill("150");
  await median.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Box plot 2: the median is less than the lower quartile." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(median).toHaveValue("158");
  await expect(page.getByRole("alert")).toHaveCount(0);
  // + adds an empty band where pupils draw a plot; it prints nothing and blocks nothing.
  await page.getByRole("button", { name: "Add a box plot at the end" }).click();
  await expect(page.getByLabel("Box plot 3 smallest value")).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(ends("black")).toHaveCount(5);
  await page.getByLabel("Axis line").selectOption("line");
  const doc = (await saved(page)).document;
  expect(doc.boxplot.rows).toHaveLength(3);
  expect(doc.boxplot.rows[0].median).toEqual({ value: "165", show: "hidden" });
  expect(doc.boxplot.rows[2].min).toEqual({ value: "", show: "show" });
  expect(doc.boxplot.line).toBe("line");
});

test("stem-and-leaf diagrams: rows edit from the diagram, hidden leaves and an empty key box stay answers", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "stemleaf-heights")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  const ink = (colour: string) => art.locator(`text[fill='${colour}']`);
  // Pupils see three empty ruled rows and an empty key box.
  await expect(ink("black")).toHaveText(["Key:"]);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(ink("#b0125b")).toHaveCount(3 + 12 + 2);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A row opens its leaves; a two-digit leaf is a specific error that blocks export.
  await page.getByRole("button", { name: "Edit row 2: stem 14" }).click();
  const leaves = page.getByLabel("Row 2 leaves");
  await expect(leaves).toBeFocused();
  await leaves.fill("2 4 66 7 9");
  await leaves.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Row 2: each leaf is one digit, 0 to 9." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(leaves).toHaveValue("2 4 6 6 7 9");
  // Show all prints the diagram and the key.
  await page.getByRole("group", { name: "Values", exact: true }).getByRole("button", { name: "Show", exact: true }).click();
  await expect(ink("black")).toHaveCount(3 + 12 + 3);
  await page.getByRole("button", { name: "Add a row at the end" }).click();
  await expect(page.getByLabel("Row 4 stem")).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const doc = (await saved(page)).document;
  expect(doc.stemleaf.rows).toHaveLength(4);
  expect(doc.stemleaf.rows[1]).toEqual({ stem: "14", leaves: "2 4 6 6 7 9", stemShow: "show", leavesShow: "show" });
  expect(doc.stemleaf.key.show).toBe("show");
});

test("time series graphs: values edit from the graph, hidden values stay answers and labels change without the values", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "timeseries-quarters")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  // Crosses and the lines joining them are the 1 pt paths.
  const ink = (colour: string) => art.locator(`path[stroke='${colour}'][stroke-width='0.353']`);
  // Pupils see a labelled blank grid: twelve hidden values, so twelve crosses and eleven lines are answers.
  await expect(ink("black")).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(ink("#b0125b")).toHaveCount(12 + 11);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A time opens its value; a word is a specific error that blocks export.
  await page.getByRole("button", { name: "Edit time 1: 1 2023" }).click();
  const value = page.getByLabel("Time 1 value");
  await expect(value).toBeFocused();
  await value.fill("lots");
  await value.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Time 1 (1): enter a number for the value, or leave it blank." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(value).toHaveValue("34");
  // Show all prints the graph; relabelling keeps the values and groups.
  await page.getByRole("group", { name: "Values", exact: true }).getByRole("button", { name: "Show", exact: true }).click();
  await expect(ink("black")).toHaveCount(12 + 11);
  await page.getByRole("button", { name: "Label as months" }).click();
  await expect(page.getByLabel("Time 2 label")).toHaveValue("Feb");
  await page.getByRole("button", { name: "Add a time at the end" }).click();
  await expect(page.getByLabel("Time 13 value")).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const doc = (await saved(page)).document;
  expect(doc.timeseries.points).toHaveLength(13);
  expect(doc.timeseries.points[1]).toEqual({ label: "Feb", labelShow: "show", group: "2023", value: "41", show: "show", value2: "", show2: "show" });
  expect(doc.timeseries.points[12]).toEqual({ label: "", labelShow: "show", group: "", value: "", show: "show", value2: "", show2: "show" });
});

test("frequency polygon mistakes and a second polygon, and misleading time series options, undo", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "polygon-mistakes")!.make(false));
  const art = page.getByTestId("chart-resource").locator("svg").first();
  await page.getByLabel("Plot points at").selectOption("lower");
  await page.getByText("Join the last point to the first (mistake)").click();
  await page.getByLabel("Table with the graph").selectOption("none");
  await page.getByText("Two frequency polygons, with a key").click();
  await page.getByLabel("First polygon name").fill("Boys");
  await page.getByLabel("First polygon name").press("Enter");
  await page.getByLabel("Second polygon name").fill("Girls");
  await page.getByLabel("Second polygon name").press("Enter");
  await page.getByLabel("Class 1 second frequency").fill("5");
  await page.getByLabel("Class 1 second frequency").press("Enter");
  await page.getByLabel("Class 2 second frequency").fill("9");
  await page.getByLabel("Class 2 second frequency").press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(art.locator("path[stroke-dasharray]")).toHaveCount(2);
  await expect(art.locator("text", { hasText: "Girls" })).toHaveCount(1);
  let doc = (await saved(page)).document;
  expect(doc.grouped.polygon).toMatchObject({ plotAt: "lower", close: false, second: true, names: ["Boys", "Girls"] });
  await page.getByRole("button", { name: "Undo" }).click();
  doc = (await saved(page)).document;
  expect(doc.grouped.classes[1].frequency2).toBe("");

  await boot(page, examples.find((x) => x.id === "timeseries-gas")!.make(false));
  await page.getByLabel("Join the points with").selectOption("curve");
  await page.getByLabel("Hide the label for time 3 for pupils").check();
  await expect(art.locator("text", { hasText: /^Mar$/ })).toHaveCount(0);
  doc = (await saved(page)).document;
  expect(doc.timeseries.join).toBe("curve");
  expect(doc.timeseries.points[2].labelShow).toBe("hidden");
});
