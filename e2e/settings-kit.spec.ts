import { test, expect, type Page } from "./release-fixtures";

// The settings kit (docs/tools/APP-HOUSE-STYLE.md, "The settings kit"), on Bar modelling.
const card = (page: Page, heading: string) =>
  page.locator(".md-kit .site-panel").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
const box = async (page: Page, heading: string) => (await card(page, heading).boundingBox())!;

test("a wide window sets the settings cards in two fixed columns, with 32 px controls", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/bar-model");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const [model, whole, title, examples] = await Promise.all(
    ["Current model", "Whole labels and ranges", "Title and calculations", "Lesson examples"].map((name) => box(page, name)),
  );
  // Left: the model and its labels. Right: the title, the output and the examples.
  expect(whole.x).toBe(model.x);
  expect(examples.x).toBe(title.x);
  expect(title.x).toBeGreaterThanOrEqual(model.x + model.width);
  expect(whole.y).toBeGreaterThan(model.y + model.height);
  expect(Math.abs(title.width - model.width)).toBeLessThanOrEqual(1);
  // Nothing is squeezed: the diagram keeps most of the window.
  const stage = (await page.locator(".editor-card").first().boundingBox())!;
  expect(stage.width).toBeGreaterThan(1200);
  // The settings were 3,369 px long before the kit.
  expect(await stack.evaluate((el) => el.scrollHeight)).toBeLessThan(1150);

  for (const name of ["Edit quantity name", "Select all sections", "Add bar", "Edit title", "Worked R4"]) {
    const button = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(button.height, name).toBe(32);
  }
  for (const name of ["Bar", "Label position", "Fill", "Output"])
    expect((await page.getByLabel(name, { exact: true }).boundingBox())!.height, name).toBe(32);
  expect(await page.getByLabel("Section 1", { exact: true }).boundingBox()).toMatchObject({ width: 16, height: 16 });
  // The diagram's own buttons are not settings.
  expect((await page.getByRole("button", { name: "+ Section", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // A card stays in its column when another opens or a form appears above it.
  await page.getByText("Start a new model", { exact: true }).click();
  await expect(page.getByLabel("Equal sections", { exact: true })).toBeVisible();
  expect(await box(page, "Title and calculations")).toEqual(title);
  expect((await box(page, "Current model")).x).toBe(model.x);
  await page.getByRole("button", { name: "Edit quantity name", exact: true }).click();
  await expect(page.getByLabel("Saved label", { exact: true })).toBeFocused();
  expect(await box(page, "Title and calculations")).toEqual(title);
  expect((await page.locator(".bm-draft").boundingBox())!.x).toBeLessThan(title.x);
  // What went wrong stands out from the notes around it.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add calculation line", exact: true }).click();
  await page.getByLabel("Saved label", { exact: true }).fill("9/10/2026");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const alert = page.locator(".bm-draft [role=alert]");
  await expect(alert).toBeVisible();
  expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(179, 38, 30)");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // A dialog that opens from the settings is not a settings card and keeps its own buttons.
  await page.getByRole("button", { name: "Pupil model R1", exact: true }).click();
  const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true });
  expect((await cancel.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("a smaller window keeps one column of settings, and a phone gets finger-sized controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tools/bar-model");
  const model = await box(page, "Current model"), title = await box(page, "Title and calculations");
  expect(title.x).toBe(model.x);
  expect(title.y).toBeGreaterThan(model.y + model.height);
  expect((await page.getByRole("button", { name: "Edit quantity name", exact: true }).boundingBox())!.height).toBe(32);
  // Two columns start only where the diagram still has the room it has at 1440.
  await page.setViewportSize({ width: 1790, height: 900 });
  expect((await box(page, "Title and calculations")).x).toBe((await box(page, "Current model")).x);
  await page.setViewportSize({ width: 1800, height: 900 });
  expect((await box(page, "Title and calculations")).x).toBeGreaterThan((await box(page, "Current model")).x);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1100);

  await page.setViewportSize({ width: 375, height: 800 });
  for (const name of ["Edit quantity name", "Edit inside label", "Worked R4"])
    expect((await page.getByRole("button", { name, exact: true }).first().boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel("Bar", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByText("Section 1", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("an upright monitor sets the same cards in three columns under the diagram", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/tools/bar-model");
  const lefts = new Set<number>();
  for (const name of ["Start a new model", "Current model", "Whole labels and ranges", "Title and calculations", "Lesson examples"]) {
    const b = await box(page, name);
    lefts.add(Math.round(b.x));
    expect(b.width, name).toBeLessThan(360);
  }
  expect(lefts.size).toBe(3);
});
