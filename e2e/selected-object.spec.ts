import { expect, test, type Page } from "./release-fixtures";

/**
 * U21: what is selected is edited in one place, the first settings card under "Start from an example",
 * in every editor that has a selection card.
 */
const tools: { tool: string; select?: (page: Page) => Promise<void> }[] = [
  { tool: "ratio-table" },
  { tool: "number-line", select: (page) => page.getByRole("button", { name: "Tick 3", exact: true }).click() },
  { tool: "triangle" },
  { tool: "probability-tree", select: (page) => page.locator(".pt-hit").filter({ visible: true }).first().click() },
  { tool: "frequency-tree", select: (page) => page.locator(".pt-hit").filter({ visible: true }).first().click() },
  { tool: "two-way-table" },
  { tool: "construction", select: (page) => page.getByRole("button", { name: /^Select point / }).first().click() },
];

for (const { tool, select } of tools) {
  test(`${tool}: the selected object's card comes first in the settings`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    if (select) await select(page);
    const stack = page.locator(".inspector-stack").filter({ visible: true }).first();
    const selected = stack.locator('[aria-label^="Selected"]').filter({ visible: true }).first();
    await expect(selected).toBeVisible();
    const first = await stack.evaluate((el) => {
      const cards = [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.offsetParent !== null);
      const card = cards[0];
      return card?.matches('[aria-label^="Selected"]') || !!card?.querySelector('[aria-label^="Selected"]');
    });
    expect(first).toBe(true);
  });
}
