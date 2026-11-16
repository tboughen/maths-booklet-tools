import { test, expect } from "./release-fixtures";

const key = "maths-booklet-tools:graph-envelope:v1";
const saved = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document;

test("a travel graph through points and its reading lines are added, edited, hidden and undone", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  const canvas = page.locator(".graph-canvas");

  await page.getByRole("button", { name: "Graph through points", exact: true }).click();
  await expect(canvas.locator(".graph-curve")).toHaveCount(1);
  const points = page.getByLabel("Graph points", { exact: true });
  await points.fill("(0, 0) (0, 0) (2, 3)");
  await points.press("Enter");
  await expect(page.getByText(/point 1 repeats/)).toBeVisible();
  await points.fill("(-4, -2) (-1, 1) (1, 1) (4, 3)");
  await points.press("Enter");
  await expect.poll(async () => (await saved(page))?.objects[0]?.points).toHaveLength(4);
  await page.getByRole("button", { name: "Smooth curve" }).click();
  await expect.poll(async () => (await saved(page))?.objects[0]?.smooth).toBe(true);

  await page.getByRole("button", { name: "Reading lines", exact: true }).click();
  await expect(canvas.locator(".graph-reading")).toHaveCount(1);
  await page.getByRole("button", { name: "x value" }).click();
  await page.getByRole("button", { name: "On the pupil copy" }).click();
  await expect.poll(async () => (await saved(page))?.objects[1]).toMatchObject({ kind: "reading", read: "x", answerOnly: true });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.objects[1]?.answerOnly).toBeUndefined();
});

test("an axis letter such as t prints at the arrow beside the title", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  await page.getByText("Exam-style axes and grid").click();
  const letter = page.getByLabel("x-axis letter", { exact: true });
  await letter.fill("tt");
  await letter.press("Enter");
  await expect(page.getByText("Use one letter, such as t or v.")).toBeVisible();
  await letter.fill("t");
  await letter.press("Enter");
  await expect.poll(async () => (await saved(page))?.axes.x.name).toBe("t");
  await expect(page.locator(".graph-canvas .axis-name--x")).toHaveText("𝑡");
});
