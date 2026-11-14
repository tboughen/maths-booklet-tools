import { test, expect, type Page } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** L24: in every tool one edit is one undo step, and Ctrl+Z / Ctrl+Shift+Z restore the saved resource exactly. */
const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify(
      Object.keys(localStorage)
        .filter((key) => !/pref|hint|annotate|guide|zoom|recent|welcome/i.test(key))
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
async function settled(page: Page) {
  let last: string | null = null;
  await expect
    .poll(async () => {
      const now = await saved(page);
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [700] })
    .toBe(true);
  return last!;
}

for (const tool of toolIds) {
  test(`${tool}: one edit is one undo step and the keys restore it exactly`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const bar = page.getByRole("group", { name: "Resource utilities", exact: true });
    const undo = bar.getByRole("button", { name: "Undo", exact: true });
    const redo = bar.getByRole("button", { name: "Redo", exact: true });
    await expect(undo).toBeDisabled();
    let start = await settled(page);
    await page.getByRole("button", { name: "Start from an example", exact: true }).click();
    const gallery = page.getByRole("dialog");
    await gallery.getByRole("button", { name: /worked|answers|complete/i }).first().click();
    await expect(gallery).toHaveCount(0);
    await expect(undo).toBeEnabled();
    const edited = await settled(page);
    expect(edited).not.toBe(start);
    await page.locator("h1").click();
    await page.keyboard.press("ControlOrMeta+z");
    // One step: the history is empty again and the saved resource is exactly the starting one.
    await expect(undo).toBeDisabled();
    // The bar model saves nothing until its first edit; then the restored starter is saved instead.
    if (start === "[]") {
      start = await settled(page);
      expect(start).not.toBe(edited);
    }
    await expect.poll(() => saved(page)).toBe(start);
    await expect(redo).toBeEnabled();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect.poll(() => saved(page)).toBe(edited);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => saved(page)).toBe(start);
    await page.keyboard.press("ControlOrMeta+y");
    await expect.poll(() => saved(page)).toBe(edited);
  });
}
