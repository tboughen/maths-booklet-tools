import { test, expect } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U22: one hint line in the same place in every tool, hidden for good, outside the resource. */
for (const tool of toolIds) {
  test(`${tool}: the hint line sits under the preview bar and can be hidden for good`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const hint = page.getByTestId("editor-hint").filter({ visible: true });
    await expect(hint).toHaveCount(1);
    await expect(hint.locator(".editor-hint")).toBeVisible();
    // Directly after the preview bar (zoom controls), above the resource.
    const placed = await hint.evaluate((el) => {
      const bar = el.previousElementSibling;
      return !!bar?.querySelector('[aria-label="Preview zoom"]') && !el.closest("svg");
    });
    expect(placed).toBe(true);
    await hint.getByRole("button", { name: "Hide this tip" }).click();
    await expect(hint.locator(".editor-hint")).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[aria-label="Preview zoom"]').filter({ visible: true })).toHaveCount(1);
    await expect(page.locator(".editor-hint:visible")).toHaveCount(0);
  });
}
