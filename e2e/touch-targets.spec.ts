import { test, expect, type Page, type Locator } from "./release-fixtures";

/** U43: invisible direct-edit targets are at least 44 CSS px; printed marks keep their size. */
async function boxes(locator: Locator) {
  await expect(locator.filter({ visible: true }).first()).toBeVisible();
  return locator.evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height, x: r.left + r.width / 2 };
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

test("Venn regions and labels are 44 px targets", async ({ page }) => {
  await page.goto("/tools/venn");
  await expectAtLeast(page, "[data-region-hit]");
  await expectAtLeast(page, ".vn-label-hit");
});

test("triangle labels and vertices are 44 px targets", async ({ page }) => {
  await page.goto("/tools/triangle");
  await expectAtLeast(page, ".tr-vertex");
  await expectAtLeast(page, ".tr-hit");
});

test("number-line ticks are 44 px tall and as wide as the tick gap allows", async ({ page }) => {
  await page.goto("/tools/number-line");
  const ticks = (await boxes(page.locator(".nl-tick"))).sort((a, b) => a.x - b.x);
  expect(ticks.length).toBeGreaterThan(1);
  const gap = ticks[1].x - ticks[0].x;
  for (const t of ticks) {
    expect(t.h).toBeGreaterThanOrEqual(43.5);
    expect(t.w).toBeGreaterThanOrEqual(Math.min(44, gap) - 0.5);
    expect(t.w).toBeLessThanOrEqual(gap + 0.5);
  }
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -1", exact: true }).click();
  await page.getByRole("button", { name: "Tick 4", exact: true }).click();
  await expectAtLeast(page, ".nl-endpoint");
  const line = await boxes(page.locator(".nl-line-hit"));
  expect(line[0].h).toBeGreaterThanOrEqual(43.5);
});
