import { expect, test, type Page } from "./release-fixtures";

/**
 * U21: what is selected is edited in one place, the first settings card,
 * in every editor that has a selection card. The number line's card stays mounted with nothing selected,
 * so the Draw card below does not jump as the selection comes and goes. (Cuboids and the classic bar model
 * show a "Selected …" picker only when there are several shapes or bars; it already sits at the top.)
 */
const tools: { tool: string; select?: (page: Page) => Promise<void> }[] = [
  { tool: "ratio-table", select: (page) => page.getByRole("button", { name: "Edit headings", exact: true }).click() },
  { tool: "number-line", select: (page) => page.getByRole("button", { name: "Tick 3", exact: true }).click() },
  { tool: "triangle" },
  { tool: "probability-tree", select: (page) => page.locator(".pt-hit").filter({ visible: true }).first().click() },
  { tool: "frequency-tree", select: (page) => page.locator(".pt-hit").filter({ visible: true }).first().click() },
  { tool: "two-way-table" },
  { tool: "angles", select: (page) => page.getByRole("button", { name: /^Select angle 1 / }).click() },
  { tool: "area", select: (page) => page.getByRole("button", { name: /^Select the label on side 1 / }).click() },
  { tool: "factor-tree" },
  { tool: "nets", select: (page) => page.getByRole("button", { name: "Edit face 1", exact: true }).click() },
  { tool: "function-machine", select: (page) => page.getByRole("button", { name: "Edit the box 1", exact: true }).click() },
  { tool: "probability-objects", select: (page) => page.getByRole("button", { name: "Edit the spinner, sector 1", exact: true }).click() },
  { tool: "written-method", select: (page) => page.getByRole("button", { name: "Edit the answer", exact: true }).click() },
  { tool: "sample-space" },
  { tool: "construction", select: (page) => page.getByRole("button", { name: /^Select point / }).first().click() },
];

for (const { tool, select } of tools) {
  test(`${tool}: the selected object's card comes first in the settings`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    if (select) await select(page);
    const stack = page.locator(".inspector-stack").filter({ visible: true }).first();
    const selected = stack.locator('[aria-label^="Selected"]').filter({ visible: true }).first();
    await expect(selected).toBeVisible();
    // The first visible settings card is the one that holds the selection.
    const first = await selected.evaluate((el) => {
      const stack = el.closest(".inspector-stack")!;
      const cards = [...stack.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.offsetParent !== null);
      return cards[0] === (el.closest(".panel-card") ?? el);
    });
    expect(first).toBe(true);
  });
}

test("number line: the Draw buttons stay put when a selection clears", async ({ page }) => {
  await page.goto("/tools/number-line");
  const card = page.getByRole("region", { name: "Selected item" });
  await expect(card).toContainText("Select a tick, point or line to edit it here.");
  const point = page.getByRole("button", { name: "Point", exact: true });
  const empty = (await point.boundingBox())!.y;
  await page.getByRole("button", { name: "Tick 3", exact: true }).click();
  await expect(card.getByRole("combobox", { name: "Tick label state" })).toBeVisible();
  // Choosing a drawing mode clears the selection; the card stays, so the button does not move away.
  const selected = (await point.boundingBox())!.y;
  await point.click();
  await expect(card).toContainText("Select a tick, point or line to edit it here.");
  expect(Math.abs((await point.boundingBox())!.y - empty)).toBeLessThan(1);
  expect(selected).toBeGreaterThanOrEqual(empty);
});
