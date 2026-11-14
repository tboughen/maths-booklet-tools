import { test, expect, type Page, type Locator } from "./release-fixtures";

/**
 * U43: on touch screens the triangle's vertex handles and label targets are 44 CSS px (28 px for a
 * mouse); the printed marks keep their size. Venn regions already take a tap anywhere inside them, and a
 * tap on the number line's axis band picks the nearest tick within 22 px.
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
  test("a tap beside a number-line tick selects that tick", async ({ page }) => {
    await page.goto("/tools/number-line");
    const tick = (await page.getByRole("button", { name: "Tick 3", exact: true }).boundingBox())!;
    const resource = page.getByTestId("number-line-resource");
    const origin = (await resource.boundingBox())!;
    await resource.tap({ position: { x: tick.x + tick.width / 2 - origin.x + 18, y: tick.y + tick.height / 2 - origin.y + 16 } });
    await expect(page.getByRole("combobox", { name: "Tick label state" })).toBeVisible();
    await expect(page.locator("label", { hasText: /^Tick 3/ })).toBeVisible();
  });
});

test("with a mouse, triangle targets keep their 28 px size", async ({ page }) => {
  await page.goto("/tools/triangle");
  await expectAtLeast(page, ".tr-vertex", 28);
  const vertices = await boxes(page.locator(".tr-vertex"));
  for (const v of vertices) expect(v.w).toBeLessThanOrEqual(28.5);
});
