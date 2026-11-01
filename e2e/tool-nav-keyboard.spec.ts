// Site item 60: when the booklet tool row overflows sideways, a keyboard user must see where focus
// goes. Every link Tab reaches in the row has to be scrolled fully into the row's visible area.
import { test, expect } from "@playwright/test";

for (const width of [820, 390])
  test(`each booklet tool link is fully visible when it takes keyboard focus at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tools/graph");
    const nav = page.getByRole("navigation", { name: "Booklet tools", exact: true });
    const links = nav.getByRole("link");
    await expect(links.first()).toBeVisible();
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
    const overflows = await nav.evaluate(n => [n, ...n.querySelectorAll("*")].some(e => e.scrollWidth > e.clientWidth + 1));
    // At phone width the row must really overflow, or this test would pass without checking anything.
    if (width === 390) expect(overflows, "the tool row overflows at 390 px").toBe(true);
    await links.first().focus();
    const hidden: string[] = [];
    for (let i = 0; i < count; i++) {
      const link = page.locator(":focus");
      await expect(link).toHaveRole("link");
      // Let any smooth scrolling settle before measuring.
      await expect.poll(async () => {
        const box = await link.boundingBox(), area = await nav.boundingBox();
        return !!box && !!area && box.x >= area.x - 1 && box.x + box.width <= area.x + area.width + 1;
      }, { timeout: 2000 }).toBe(true).catch(async () => hidden.push((await link.textContent())?.trim() ?? `link ${i + 1}`));
      if (i < count - 1) await page.keyboard.press("Tab");
    }
    expect(hidden, "links that took focus while scrolled out of view").toEqual([]);
  });
