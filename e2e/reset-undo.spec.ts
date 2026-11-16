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
    await page.getByRole("button", { name: "Examples", exact: true }).click();
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

    await bar.getByRole("button", { name: "Start again", exact: true }).click();
    const confirm = page.getByRole("dialog").last();
    await expect(confirm).toBeVisible();
    // Every confirmation asks a reset question; its confirm button is the dialog's last action, after Cancel.
    await expect(confirm.getByRole("heading").first()).toHaveText(/^(Reset|Start a (new|fresh))\b/);
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await confirm.getByRole("button").last().click();
    // The notice sits in an always-mounted polite live region.
    const notice = page.locator('[aria-live="polite"] .editor-reset-notice').filter({ hasText: "Resource reset." });
    await expect(notice).toBeVisible();
    await expect(bar.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", /^Undo (reset|start a new)/);
    await expect.poll(() => saved(page)).not.toBe(before);

    await notice.getByRole("button", { name: "Undo reset", exact: true }).click();
    await expect(notice).toHaveCount(0);
    await expect.poll(() => saved(page)).toBe(before);
    // Focus stays in the toolbar, and redoing the reset does not bring the notice back.
    await expect(bar.locator(":focus")).toHaveCount(1);
    await bar.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(notice).toHaveCount(0);
  });
}
