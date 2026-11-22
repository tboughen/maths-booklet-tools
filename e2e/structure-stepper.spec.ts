import { test, expect } from "./release-fixtures";

/** U6 (frequency trees left on 22 Nov 2026: their levels are links in the Total and groups card): every structure control (+/− row, column, stage, level, category, cuboid) looks and sizes the same. */
const tools: [string, string][] = [
  ["ratio-table", "Rows"],
  ["value-table-graph", "x values"],
  ["cuboids", "Cuboids"],
  ["charts", "Categories"],
];
for (const [tool, name] of tools) {
  test(`${tool}: the ${name} control is the shared stepper`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const group = page.getByRole("group", { name, exact: true }).filter({ visible: true });
    await expect(group).toHaveClass(/structure-stepper/);
    const buttons = group.getByRole("button");
    await expect(buttons).toHaveCount(2);
    for (const b of await buttons.all()) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      expect(await b.evaluate((el) => getComputedStyle(el).borderRadius)).toBe("999px");
    }
  });
}
