import { test, expect } from "./release-fixtures";

const key = "maths-booklet-tools:graph-envelope:v1";
const saved = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document;

test("an inequality region is added, edited, shaded on the other side, hidden as an answer and undone (U73)", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  const canvas = page.locator(".graph-canvas");
  await page.getByRole("button", { name: "Shade a region", exact: true }).click();
  await expect(canvas.locator(".graph-region")).toHaveCount(1);
  await expect(canvas.locator(".graph-region-boundary")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Shaded region", exact: true })).toBeVisible();
  await expect(canvas.locator(".object-name text").first()).toHaveText("R");

  const field = page.getByLabel("Inequalities", { exact: true });
  await field.fill("y > 2z");
  await field.press("Enter");
  await expect(page.getByText(/uses x, y and numbers only/)).toBeVisible();
  await field.fill("y > 2x − 1, x ≤ 3, y ≥ 0");
  await field.press("Enter");
  await expect
    .poll(async () => (await saved(page))?.objects[0]?.inequalities)
    .toEqual(["y > 2x − 1", "x ≤ 3", "y ≥ 0"]);
  await expect(canvas.locator(".graph-region-boundary[stroke-dasharray]")).toHaveCount(1);

  await page.getByRole("button", { name: "Shade the rest", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.objects[0]?.shade).toBe("unwanted");
  await page.getByRole("button", { name: "On the pupil copy" }).click();
  await expect(canvas.locator(".graph-region--answer")).toHaveCount(1);
  await expect
    .poll(async () => (await saved(page))?.objects[0])
    .toMatchObject({ kind: "region", shade: "unwanted", answerOnly: true, boundaries: true, name: "R" });

  // Arrow keys leave a region alone: it follows its inequalities.
  await page.keyboard.press("ArrowRight");
  expect((await saved(page))?.objects[0]?.inequalities).toEqual(["y > 2x − 1", "x ≤ 3", "y ≥ 0"]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.objects[0]?.answerOnly).toBeUndefined();
});
