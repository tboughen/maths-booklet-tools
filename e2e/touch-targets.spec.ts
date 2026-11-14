import { test, expect, type Page, type Locator } from "./release-fixtures";

/**
 * U43: invisible direct-edit targets grow for touch where the drawing has room, without covering a
 * neighbour's target, and printed marks keep their size. Triangle targets are 44 px on touch screens
 * (28 px for a mouse). Number-line targets fill their tick gap and the space between the tick and
 * solution rows. Venn is unchanged: its stage takes a tap anywhere in a region.
 */
async function boxes(locator: Locator) {
  await expect(locator.filter({ visible: true }).first()).toBeVisible();
  return locator.evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.left + r.width / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
  );
}
async function expectAtLeast(page: Page, selector: string, min = 44) {
  const found = await boxes(page.locator(selector));
  expect(found.length, selector).toBeGreaterThan(0);
  for (const b of found) {
    expect(b.w, selector).toBeGreaterThanOrEqual(min - 0.5);
    expect(b.h, selector).toBeGreaterThanOrEqual(min - 0.5);
  }
}

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } });
  test("triangle labels and vertices are 44 px targets", async ({ page }) => {
    await page.goto("/tools/triangle");
    await expectAtLeast(page, ".tr-vertex");
    await expectAtLeast(page, ".tr-hit");
    expect(await page.evaluate(() => matchMedia("(pointer:coarse)").matches)).toBe(true);
  });
});

test("with a mouse, triangle targets keep their 28 px size", async ({ page }) => {
  await page.goto("/tools/triangle");
  await expectAtLeast(page, ".tr-vertex", 28);
  const vertices = await boxes(page.locator(".tr-vertex"));
  for (const v of vertices) expect(v.w).toBeLessThanOrEqual(28.5);
});

test("number-line targets fill the tick gap and the space between rows, without overlapping", async ({ page }) => {
  await page.goto("/tools/number-line");
  const ticks = (await boxes(page.locator(".nl-tick"))).sort((a, b) => a.x - b.x);
  expect(ticks.length).toBeGreaterThan(1);
  const gap = ticks[1].x - ticks[0].x;
  for (const t of ticks) {
    expect(t.w).toBeGreaterThanOrEqual(Math.min(44, gap) - 0.5);
    expect(t.w).toBeLessThanOrEqual(gap + 0.5);
    expect(t.h).toBeLessThanOrEqual(44.5);
  }
  for (let i = 1; i < ticks.length; i++) expect(ticks[i].left).toBeGreaterThanOrEqual(ticks[i - 1].right - 0.5);
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -1", exact: true }).click();
  await page.getByRole("button", { name: "Tick 4", exact: true }).click();
  const endpoints = await boxes(page.locator(".nl-endpoint"));
  const line = await boxes(page.locator(".nl-line-hit"));
  expect(endpoints.length).toBe(2);
  // The two rows meet but do not overlap, and each row is as tall as that space allows (up to 44 px).
  for (const target of [...endpoints, ...line]) {
    expect(target.bottom).toBeLessThanOrEqual(ticks[0].top + 0.5);
    expect(target.h).toBeGreaterThanOrEqual(Math.min(44, ticks[0].h) - 0.5);
  }
  for (const e of endpoints) expect(e.w).toBeLessThanOrEqual(gap + 0.5);
  // Part of the interval's line stays clear of both endpoint targets, so it can still be selected.
  const [lower, upper] = endpoints.sort((a, b) => a.x - b.x);
  expect(upper.left - lower.right).toBeGreaterThan(4);
});
