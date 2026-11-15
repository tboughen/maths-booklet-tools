// The editor frame (docs/tools/APP-HOUSE-STYLE.md): at 1920 x 1080 every diagram tool fills the
// window under the app bar, the page itself does not scroll, and the diagram's stage takes the
// room the bars leave. Copy notices float, so they never resize the diagram.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

const STAGE = ".site-page:not([hidden]) .editor-card > :is(.graph-stage, .ratio-stage, .bm-scroll, .tr-scroll, .ag-scroll, .vn-scroll, .nl-scroll, .cb-scroll, .vg-scroll, .ch-scroll, .pt-scroll)";
const frame = (page: Page) =>
  page.evaluate((selector) => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const card = box(".site-page:not([hidden]) .editor-card"), stage = box(selector), settings = box(".site-page:not([hidden]) .inspector-stack");
    return { page: document.documentElement.scrollHeight, cardBottom: card.bottom, stage: stage.height, stageBottom: stage.bottom, settingsBottom: settings.bottom };
  }, STAGE);

for (const tool of toolIds)
  test(`${tool}: the tool fills a 1920 x 1080 window and the page does not scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(STAGE)).toBeVisible();
    const at = await frame(page);
    expect(at.page, "the page is no taller than the window").toBeLessThanOrEqual(1080);
    expect(at.cardBottom).toBeLessThanOrEqual(1080);
    expect(at.settingsBottom).toBeLessThanOrEqual(1080);
    expect(at.stageBottom).toBeLessThanOrEqual(1080);
    // Two tools keep their own entry grid under the diagram; the rest give it nearly everything.
    expect(at.stage).toBeGreaterThanOrEqual(["two-way-table", "sample-space"].includes(tool) ? 400 : 680);
  });

test.describe("copy notices", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  for (const tool of ["cuboids", "venn", "ratio-table", "factor-tree"] as const)
    test(`${tool}: "Image copied" floats and leaves the diagram's stage the same size`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`/tools/${tool}`);
      await expect(page.locator(STAGE)).toBeVisible();
      const before = (await frame(page)).stage;
      await page.getByRole("button", { name: "Copy image", exact: true }).click();
      const notice = page.locator(".site-page:not([hidden])").getByRole("status").filter({ hasText: /copied/i });
      await expect(notice).toBeVisible();
      await expect(notice).toHaveCSS("position", "fixed");
      expect((await frame(page)).stage).toBe(before);
    });
});

test("a narrow window keeps the stacked page that scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto("/tools/charts");
  await expect(page.locator(STAGE)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(900);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(600);
});
