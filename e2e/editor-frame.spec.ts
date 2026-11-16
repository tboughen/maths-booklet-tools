// The editor frame (docs/tools/APP-HOUSE-STYLE.md): at 1920 x 1080 every diagram tool fills the
// window under the app bar, the page itself does not scroll, and the diagram's stage takes the
// room the bars leave. The foot strip holds zoom, print size and one note; a message takes the
// hint's place in it, so it never resizes the diagram.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

const STAGE = ".site-page:not([hidden]) .editor-card > .editor-stage";
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
    expect(at.stage).toBeGreaterThanOrEqual(["two-way-table", "sample-space"].includes(tool) ? 480 : 800);
  });

test.describe("a message in the foot strip", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  // The Graph tool has its own toast.
  for (const tool of toolIds.filter((id) => id !== "graph"))
    test(`${tool}: "Image copied" takes the hint's place in the foot strip and leaves the diagram's stage the same size`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/tools/${tool}`);
      await expect(page.locator(STAGE)).toBeVisible();
      const before = await frame(page);
      await page.getByRole("button", { name: "Copy image", exact: true }).click();
      const line = page.locator(".site-page:not([hidden]) .editor-foot").getByRole("status").filter({ hasText: /copied/i });
      await expect(line).toBeVisible();
      await expect(page.locator(".site-page:not([hidden]) .editor-foot .editor-hint:not(.editor-hint--prompt)")).toBeHidden();
      const box = (await line.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(before.stageBottom - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(before.cardBottom + 1);
      expect((await frame(page)).stage).toBe(before.stage);
    });

  test("a recovery panel under the card is never covered by the foot strip", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("maths-booklet-tools:venn:v1", "{broken"));
    await page.goto("/tools/venn");
    const line = page.locator(".site-page:not([hidden])").getByRole("status").filter({ hasText: /needs recovery/ });
    await expect(line).toBeVisible();
    const box = (await line.boundingBox())!;
    const at = await frame(page);
    expect(box.y).toBeGreaterThanOrEqual(at.stageBottom - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(at.cardBottom + 1);
    const panel = (await page.locator(".vn-recovery").boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(at.cardBottom);
    expect(panel.y + panel.height).toBeLessThanOrEqual(1000);
  });

  test("a recovery block inside the card sits above the foot strip, with its button free to press", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("maths-booklet-tools:cuboids:v1", "not-json"));
    await page.goto("/tools/cuboids");
    const button = page.getByRole("button", { name: "Download recovery data", exact: true });
    await expect(button).toBeVisible();
    const line = page.locator(".site-page:not([hidden]) .editor-foot .resource-feedback");
    await expect(line).toBeVisible();
    const at = await frame(page), box = (await line.boundingBox())!, press = (await button.boundingBox())!;
    expect(press.y + press.height).toBeLessThanOrEqual(box.y);
    expect(box.y + box.height).toBeLessThanOrEqual(at.cardBottom + 1);
    const download = page.waitForEvent("download");
    await button.click();
    await download;
  });

  test("in a card that scrolls, the foot strip stays at the visible foot", async ({ page }) => {
    // Sample space keeps its entry grid under the diagram, so on a small window its card scrolls.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools/sample-space");
    const card = page.locator(".site-page:not([hidden]) .editor-card");
    expect(await card.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(40);
    await page.getByRole("button", { name: "Copy image", exact: true }).click();
    const line = page.locator(".site-page:not([hidden])").getByRole("status").filter({ hasText: /copied/i });
    await expect(line).toBeVisible();
    for (const top of [0, 40, 10_000]) {
      await card.evaluate((el, y) => el.scrollTo(0, y), top);
      const at = await frame(page), box = (await page.locator(".site-page:not([hidden]) .editor-foot").boundingBox())!;
      expect(Math.abs(box.y + box.height - at.cardBottom), `scrolled to ${top}`).toBeLessThanOrEqual(2);
      await expect(line).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
  });
});

for (const [width, height, why] of [[600, 900, "narrow"], [1280, 720, "short"]] as const)
  test(`a ${why} window keeps the stacked page that scrolls`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/charts");
    await expect(page.locator(STAGE)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

test("print keeps the stacked page: the frame is for screens only", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/bar-model");
  await expect(page.locator(STAGE)).toBeVisible();
  const styles = () =>
    page.evaluate(() => ({
      app: getComputedStyle(document.querySelector(".site-app")!).display,
      card: getComputedStyle(document.querySelector(".site-page:not([hidden]) .editor-card")!).overflowY,
    }));
  expect(await styles()).toEqual({ app: "flex", card: "auto" });
  await page.emulateMedia({ media: "print" });
  expect(await styles()).toEqual({ app: "block", card: "hidden" });
});
