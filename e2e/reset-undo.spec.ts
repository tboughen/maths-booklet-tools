import { test, expect, type Page } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U25: Reset is confirmed first, then shows "Resource reset." with Undo, and Undo restores the resource exactly. */
const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify(
      Object.keys(localStorage)
        .filter((key) => !/pref|hint|annotate|guide|zoom|recent|welcome/i.test(key))
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );

for (const tool of toolIds) {
  test(`${tool}: Reset asks first, then offers Undo that restores the resource`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const bar = page.getByRole("group", { name: "Resource utilities", exact: true });
    await expect(bar).toBeVisible();
    // Make a real change first: replace the starter with an example's worked version (one undoable step).
    await page.getByRole("button", { name: "Start from an example", exact: true }).click();
    const gallery = page.getByRole("dialog");
    await gallery.getByRole("button", { name: /worked|answers|complete/i }).first().click();
    await expect(gallery).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo use worked version (Ctrl+Z)");
    // Wait for the autosave to settle on the worked version.
    let before = "";
    await expect.poll(async () => {
      const now = await saved(page);
      const settled = now === before && now !== "[]";
      before = now;
      return settled;
    }, { intervals: [700] }).toBe(true);

    await bar.getByRole("button", { name: /^(Reset|Reset diagram|New model)$/ }).click();
    const confirm = page.getByRole("dialog").last();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button").filter({ hasNotText: /cancel|keep|download/i }).first().click();
    const notice = page.getByRole("status").filter({ hasText: "Resource reset." });
    await expect(notice).toBeVisible();
    await expect(bar.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", /^Undo (reset|start a new)/);
    await expect.poll(() => saved(page)).not.toBe(before);

    await notice.getByRole("button", { name: "Undo reset", exact: true }).click();
    await expect(notice).toHaveCount(0);
    await expect.poll(() => saved(page)).toBe(before);
  });
}
