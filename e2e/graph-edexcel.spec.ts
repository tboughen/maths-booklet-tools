import { test, expect } from "./release-fixtures";
import { createGraph } from "../packages/graph-core/src/interchange";

const key = "maths-booklet-tools:graph-envelope:v1";
const SHOTS = process.env.GRAPH_EDEXCEL_SHOTS;
const travel = createGraph({
  axes: {
    x: { negativeSquares: 0, positiveSquares: 15, unitsPerSquare: 10, origin: 720, labelEvery: 3, format: "time", title: "Time of day" },
    y: { negativeSquares: 0, positiveSquares: 6, unitsPerSquare: 5, labelEvery: 2, title: "Distance from home (km)" },
  },
  grid: "2mm",
  objects: [
    { kind: "segment", id: "out", start: { x: 720, y: 0 }, end: { x: 765, y: 25 }, name: "L" },
    { kind: "point", id: "back", position: { x: 840, y: 0 }, name: "B", answerOnly: true },
  ],
});
const saved = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document;

test("a saved Edexcel-style graph shows its titles, times, fine grid, names and answers in the editor", async ({ page }) => {
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw: JSON.stringify(travel) });
  await page.goto("/tools/graph");
  const canvas = page.locator(".graph-canvas");
  await expect(canvas.locator(".axis-title")).toHaveText(["Time of day", "Distance fromhome (km)"]);
  await expect(canvas.locator(".axis-number text").first()).toHaveText("12 00");
  await expect(canvas.locator(".axis-name")).toHaveCount(0);
  await expect(canvas.locator(".grid-lines--fine line")).toHaveCount(15 * 4 + 6 * 4);
  await expect(canvas.locator(".object-name")).toHaveCount(2);
  await expect(canvas.locator(".object-name--answer")).toHaveCount(1);
  await expect(canvas.locator(".graph-point--answer")).toHaveCount(1);
  if (SHOTS) await page.locator(".graph-stage").screenshot({ path: `${SHOTS}/editor-travel.png` });
});

test("exam-style axis, grid, name and answer-only controls are undoable edits", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.getByRole("button", { name: "Line by equation", exact: true }).click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();

  await page.getByLabel("Name printed beside the line").fill("l1");
  await page.getByLabel("Name printed beside the line").press("Enter");
  await expect(page.getByRole("alert")).toContainText("capital letter");
  await page.getByLabel("Name printed beside the line").fill("L1");
  await page.getByLabel("Name printed beside the line").press("Enter");
  await page.getByRole("button", { name: "On the pupil copy" }).click();
  await expect(page.locator(".graph-canvas .object-name--answer")).toHaveCount(1);

  await page.getByText("Exam-style axes and grid").click();
  await page.getByRole("group", { name: "Grid squares" }).getByRole("button", { name: "2 mm" }).click();
  await page.getByRole("group", { name: "Origin label" }).getByRole("button", { name: "O" }).click();
  await page.getByLabel("x-axis title").fill("Time (s)");
  await page.getByLabel("x-axis title").press("Enter");
  await page.getByLabel("y-axis units per square").fill("10");
  await page.getByLabel("y-axis units per square").press("Enter");
  await page.getByLabel("y-axis numbering").selectOption("2");

  await expect(page.locator(".graph-canvas .axis-title")).toHaveText(["Time (s)"]);
  await expect(page.locator(".graph-canvas .axis-number--origin")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.axes.y.labelEvery).toBe(2);
  const doc = await saved(page);
  expect(doc.grid).toBe("2mm");
  expect(doc.originLabel).toBe("O");
  expect(doc.axes.x.title).toBe("Time (s)");
  expect(doc.axes.y).toMatchObject({ unitsPerSquare: 10, labelEvery: 2 });
  expect(doc.objects[0]).toMatchObject({ name: "L1", answerOnly: true });

  // Each change is one undo step; undoing the numbering keeps the new scale.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.axes.y).toEqual({ negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 10 });

  // Times of day are typed as clock times.
  await page.getByRole("group", { name: "x-axis number format" }).getByRole("button", { name: "Times of day" }).click();
  await page.getByLabel("x-axis value where the axes cross").fill("09:00");
  await page.getByLabel("x-axis value where the axes cross").press("Enter");
  await expect.poll(async () => (await saved(page))?.axes.x.origin).toBe(540);
  expect((await saved(page)).axes.x).toMatchObject({ format: "time", origin: 540, title: "Time (s)" });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-controls.png`, fullPage: true });
});

test("sketch axes show no grid or numbers, with the line's labels in the answer colour", async ({ page }) => {
  const sketch = createGraph({
    grid: "none",
    originLabel: "O",
    axes: { x: { negativeSquares: 3, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 3, positiveSquares: 4, unitsPerSquare: 1 } },
    objects: [{ kind: "line", id: "l", equation: { kind: "slope", slope: -1.5, intercept: 3 }, answerOnly: true, labels: [{ at: { x: 0, y: 3 }, text: "3" }, { at: { x: 2, y: 0 }, text: "2" }] }],
  });
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key, raw: JSON.stringify(sketch) });
  await page.goto("/tools/graph");
  const canvas = page.locator(".graph-canvas");
  await expect(canvas.locator(".point-label--answer text:not(.text-halo)")).toHaveText(["3", "2"]);
  await expect(canvas.locator(".grid-lines line")).toHaveCount(0);
  // The only axis mark left is the italic O.
  await expect(canvas.locator(".axis-number text")).toHaveText(["𝑂"]);
  if (SHOTS) await page.locator(".graph-stage").screenshot({ path: `${SHOTS}/editor-sketch.png` });

  // The grid control turns sketch axes back into a numbered grid, as one undoable edit.
  await page.getByText("Exam-style axes and grid").click();
  await page.getByRole("group", { name: "Grid squares" }).getByRole("button", { name: "1 cm" }).click();
  await expect(canvas.locator(".grid-lines line")).toHaveCount(7 + 1 + 7 + 1);
  await expect.poll(async () => (await saved(page))?.grid).toBeUndefined();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.grid).toBe("none");
  expect((await saved(page)).objects[0].labels).toHaveLength(2);
});
