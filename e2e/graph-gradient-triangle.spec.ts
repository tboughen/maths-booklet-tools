import { test, expect } from "./release-fixtures";

const key = "maths-booklet-tools:graph-envelope:v1";
const saved = async (page: import("@playwright/test").Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document;

test("a gradient triangle is added to a line, resized, labelled blank, warned off the grid and undone", async ({ page }) => {
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  const canvas = page.locator(".graph-canvas");
  await page.getByRole("button", { name: "Line by equation", exact: true }).click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.getByRole("button", { name: "Add gradient triangle", exact: true }).click();
  await expect(canvas.locator(".gradient-triangle path")).toHaveCount(1);
  await expect.poll(async () => (await saved(page))?.objects?.[0]?.gradientTriangle).toBeTruthy();

  await page.getByLabel("Gradient triangle run", { exact: true }).fill("0");
  await page.getByLabel("Gradient triangle run", { exact: true }).press("Enter");
  await expect(page.getByText("The run cannot be zero.")).toBeVisible();
  await page.getByLabel("Gradient triangle run", { exact: true }).press("Escape");

  await page.getByLabel("Gradient triangle labels").selectOption("blank");
  await expect(canvas.locator(".gradient-triangle .point-label--answer text:not(.text-halo)")).toHaveCount(2);
  await expect.poll(async () => (await saved(page))?.objects?.[0]?.gradientTriangle?.labels).toBe("blank");

  await page.getByLabel("Gradient triangle starts at x", { exact: true }).fill("4");
  await page.getByLabel("Gradient triangle starts at x", { exact: true }).press("Enter");
  await expect(page.getByText(/runs off the grid/)).toBeVisible();

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText(/runs off the grid/)).toHaveCount(0);
  await page.getByRole("button", { name: "Remove gradient triangle" }).click();
  await expect(canvas.locator(".gradient-triangle")).toHaveCount(0);
  await expect.poll(async () => (await saved(page))?.objects?.[0]?.gradientTriangle).toBeUndefined();
});
