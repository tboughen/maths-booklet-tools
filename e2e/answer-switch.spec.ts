// The answers switch of the house style (docs/tools/APP-HOUSE-STYLE.md, choice 6A): it sits in the
// action bar, reads "Show hidden answers" in every tool, and turns pink while it is on, with a
// small pink label over the corner of the diagram. Pink means teacher only.
import { test, expect } from "@playwright/test";

// The ratio table shows its switch only once a table has hidden answers (e2e/ratio-table.spec.ts).
const copies = ["venn", "charts", "probability-tree", "frequency-tree", "construction", "elevations", "two-way-table", "sample-space", "factor-tree", "function-machine", "nets", "written-method", "angles", "area"];
const previews = ["expanding-factorising", "triangle"];
const PINK = "rgb(176, 18, 91)";

for (const tool of [...copies, ...previews])
  test(`${tool}: the answers switch is in the action bar and turns pink with a pink label`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tools/${tool}`);
    const shown = page.locator(".site-page:not([hidden])");
    const stage = shown.locator(".editor-card > .editor-stage");
    await expect(stage).toBeVisible();
    const name = copies.includes(tool) ? "Teacher copy: show hidden answers" : "Teacher preview: show hidden answers";
    const input = shown.getByRole("checkbox", { name, exact: true });
    const label = shown.locator(".editor-toolbar .editor-view-actions label.answer-switch");
    await expect(label).toHaveText("Show hidden answers");
    await expect(label.locator("input")).toHaveAccessibleName(name);
    await expect(shown.locator(".editor-foot .answer-switch")).toHaveCount(0);
    // It comes before the copy buttons.
    const copy = (await shown.getByRole("button", { name: "Copy image", exact: true }).boundingBox())!;
    const at = (await label.boundingBox())!;
    expect(at.x + at.width).toBeLessThanOrEqual(copy.x);
    const chip = shown.locator(".answer-chip");
    await expect(chip).toHaveCount(0);
    const before = (await stage.boundingBox())!;

    await input.check();
    await expect(chip).toContainText("Teacher view: answers showing");
    await expect(chip).toContainText(copies.includes(tool) ? "Downloads show the answers too." : "Screen only: downloads keep the pupil version.");
    await expect(label.locator(".answer-switch-track")).toHaveCSS("background-color", PINK);
    await expect(label).toHaveCSS("color", PINK);
    await expect(chip).toHaveCSS("pointer-events", "none");
    // The label lies over the top corner of the stage and moves nothing.
    await expect.poll(async () => (await stage.boundingBox())!.y).toBeGreaterThanOrEqual(before.y);
    const now = (await stage.boundingBox())!, box = (await chip.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(now.y);
    expect(box.y + box.height).toBeLessThanOrEqual(now.y + 40);
    expect(box.x + box.width).toBeLessThanOrEqual(now.x + now.width);

    // The keyboard works it too.
    await input.focus();
    await page.keyboard.press("Space");
    await expect(input).not.toBeChecked();
    await expect(chip).toHaveCount(0);
    expect((await stage.boundingBox())!.height).toBe(before.height);
  });

test("on a phone the label wraps inside the card and the switch is a full-height target", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/venn");
  const shown = page.locator(".site-page:not([hidden])");
  await shown.getByRole("checkbox", { name: "Teacher copy: show hidden answers", exact: true }).check();
  const card = (await shown.locator(".editor-card").boundingBox())!, chip = (await shown.locator(".answer-chip").boundingBox())!;
  expect(chip.x).toBeGreaterThanOrEqual(card.x);
  expect(chip.x + chip.width).toBeLessThanOrEqual(card.x + card.width);
  expect((await shown.locator("label.answer-switch").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// The action bar keeps to one row where the site is mostly used; Examples and Start again give up
// their words first (docs/tools/APP-HOUSE-STYLE.md, "The action bar").
for (const tool of ["venn", "number-line"])
  test(`${tool}: the action bar is one row from a 1920 px window down to 1200 px`, async ({ page }) => {
    for (const width of [1920, 1440, 1280, 1200]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/tools/${tool}`);
      const bar = page.locator(".site-page:not([hidden]) .editor-toolbar");
      await expect(bar).toBeVisible();
      expect((await bar.boundingBox())!.height, `at ${width}`).toBeLessThanOrEqual(60);
      // With or without their words, both buttons keep their names.
      await expect(bar.getByRole("button", { name: "Examples", exact: true })).toBeVisible();
      await expect(bar.getByRole("button", { name: "Start again", exact: true })).toBeVisible();
    }
  });

test("the Worksheet builder's switch turns pink without a label, so nothing beside it moves", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/worksheets");
  const input = page.getByRole("checkbox", { name: "Teacher preview: show hidden answers", exact: true });
  await expect(input).toBeVisible();
  const bar = page.locator(".ws-preview-bar").first();
  const before = await bar.boundingBox();
  await input.check();
  await expect(page.locator("label.answer-switch .answer-switch-track").first()).toHaveCSS("background-color", PINK);
  await expect(page.locator(".answer-chip")).toBeHidden();
  expect(await bar.boundingBox()).toEqual(before);
});
