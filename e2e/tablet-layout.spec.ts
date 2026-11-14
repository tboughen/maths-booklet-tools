import { test, expect } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U63: from 768 px the resource sits left and the settings right, each scrolling on its own. */
for (const width of [768, 820]) {
  for (const tool of toolIds) {
    test(`${tool} at ${width} px: resource left, settings right`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/tools/${tool}`);
      const workspace = page.locator(".workspace").filter({ visible: true }).first();
      const columns = await workspace.evaluate((el) =>
        [...el.children]
          .filter((c) => (c as HTMLElement).offsetParent !== null)
          .map((c) => {
            const r = c.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, cls: c.className };
          }),
      );
      const settings = columns.find((c) => /inspector-stack/.test(String(c.cls)));
      expect(settings, JSON.stringify(columns)).toBeTruthy();
      const resource = columns.find((c) => c !== settings)!;
      expect(settings!.left).toBeGreaterThanOrEqual(resource.right - 1);
      expect(Math.abs(settings!.top - resource.top)).toBeLessThan(80);
      const stack = page.locator(".inspector-stack").filter({ visible: true }).first();
      expect(await stack.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
      expect(await stack.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
}

test("below 768 px the editor stacks", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 1000 });
  await page.goto("/tools/venn");
  const stack = page.locator(".inspector-stack").filter({ visible: true }).first();
  const card = page.locator(".workspace > :first-child").filter({ visible: true }).first();
  const [a, b] = [await card.boundingBox(), await stack.boundingBox()];
  expect(b!.y).toBeGreaterThan(a!.y + 50);
});
