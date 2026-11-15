import { test, expect } from "./release-fixtures";

const key = "maths-booklet-tools:graph-envelope:v1";
const saved = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document;

test("a shape for a transformation is added, edited, shaded, hidden as an answer, moved and undone", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  const canvas = page.locator(".graph-canvas");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await expect(canvas.locator(".graph-polygon")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Shape", exact: true })).toBeVisible();
  await expect(canvas.locator(".object-name text").first()).toHaveText("A");

  const corners = page.getByLabel("Shape corners", { exact: true });
  await corners.fill("(1, 1) (1, 1) (2, 3)");
  await corners.press("Enter");
  await expect(page.getByText(/corner 1 repeats/)).toBeVisible();
  await corners.fill("(1, 1) (4, 1) (4, 3) (1, 3)");
  await corners.press("Enter");
  await expect.poll(async () => (await saved(page))?.objects[0]?.vertices).toHaveLength(4);

  await page.getByLabel("Shade the shape").check();
  await expect(canvas.locator(".graph-polygon--shaded")).toHaveCount(1);
  await page.getByRole("button", { name: "On the pupil copy" }).click();
  await expect(canvas.locator(".graph-polygon--answer")).toHaveCount(1);

  await page.locator(".graph-stage").click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.getByLabel("Shape corners", { exact: true }).blur();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await saved(page))?.objects[0]?.vertices[0].x).toBe(1.5);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.objects[0]?.vertices[0].x).toBe(1);
  await expect.poll(async () => (await saved(page))?.objects[0]).toMatchObject({ kind: "polygon", shaded: true, answerOnly: true, name: "A" });
});
