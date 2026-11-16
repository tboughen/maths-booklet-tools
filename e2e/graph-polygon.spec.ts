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

test("a shape's image is drawn by reflection and enlargement as an undoable hidden answer", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  const canvas = page.locator(".graph-canvas");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  const corners = page.getByLabel("Shape corners", { exact: true });
  await corners.fill("(1, 1) (3, 1) (1, 2)");
  await corners.press("Enter");
  await expect.poll(async () => (await saved(page))?.objects[0]?.vertices).toHaveLength(3);

  const panel = page.locator(".transform-fields");
  await panel.getByRole("button", { name: "Reflect", exact: true }).click();
  await panel.getByLabel("Mirror line").fill("y = q");
  await panel.getByRole("button", { name: "Draw the image" }).click();
  await expect(panel.getByRole("alert")).toContainText("mirror line");
  await panel.getByLabel("Mirror line").fill("y = x");
  await expect(panel.getByText("Reflection in the line y = x")).toBeVisible();
  await panel.getByRole("button", { name: "Draw the image" }).click();
  await expect.poll(async () => (await saved(page))?.objects[1]).toMatchObject({
    kind: "polygon",
    name: "A′",
    answerOnly: true,
    vertices: [{ x: 1, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 1 }],
  });
  await expect(canvas.locator(".graph-polygon--answer")).toHaveCount(1);

  // Undo removes the image in one step and leaves A selected; then enlarge A with rays.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page))?.objects).toHaveLength(1);
  await panel.getByRole("button", { name: "Enlarge", exact: true }).click();
  await panel.getByLabel("Scale factor").fill("-1/2");
  await panel.getByLabel("Draw dashed rays from the centre").check();
  await panel.getByRole("button", { name: "Draw the image" }).click();
  await expect.poll(async () => (await saved(page))?.objects).toHaveLength(5);
  await expect.poll(async () => (await saved(page))?.objects[1]?.vertices[1]).toEqual({ x: -1.5, y: -0.5 });
});
