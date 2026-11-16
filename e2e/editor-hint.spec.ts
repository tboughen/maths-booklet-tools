import { test, expect } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U22: one hint in the same place in every tool, hidden for good, outside the resource. */
for (const tool of toolIds) {
  test(`${tool}: the hint ends the foot strip and can be hidden for good`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const hint = page.getByTestId("editor-hint").filter({ visible: true });
    await expect(hint).toHaveCount(1);
    await expect(hint.locator(".editor-hint")).toBeVisible();
    // In the foot strip with the zoom controls, under the resource.
    const placed = await hint.evaluate((el) => {
      const foot = el.closest(".editor-foot");
      const stage = foot?.parentElement?.querySelector(".editor-stage");
      return (
        !!foot?.querySelector('[aria-label="Preview zoom"]') &&
        !el.closest("svg") &&
        (!stage || foot.getBoundingClientRect().top >= stage.getBoundingClientRect().bottom - 1)
      );
    });
    expect(placed).toBe(true);
    await hint.getByRole("button", { name: "Hide this tip" }).click();
    await expect(hint.locator(".editor-hint")).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[aria-label="Preview zoom"]').filter({ visible: true })).toHaveCount(1);
    await expect(page.locator(".editor-hint:visible")).toHaveCount(0);
  });
}

test("number-line: a drawing prompt takes the hint's place and cannot be hidden, even after the tip was hidden", async ({ page }) => {
  await page.goto("/tools/number-line");
  const hint = page.getByTestId("editor-hint").filter({ visible: true });
  await hint.getByRole("button", { name: "Hide this tip" }).click();
  await page.getByRole("button", { name: "Interval", exact: true }).filter({ visible: true }).first().click();
  await expect(hint.locator('[aria-live="polite"]')).toHaveText("Choose the first endpoint.");
  await expect(hint.getByRole("button", { name: "Hide this tip" })).toHaveCount(0);
});
