import { expect, test, type Page } from "./release-fixtures";

/**
 * U21: what is selected is edited in one place, the first settings card,
 * in every editor that has a selection card. The number line's card stays mounted with nothing selected,
 * so the Draw card below does not jump as the selection comes and goes. (Cuboids and the classic bar model
 * show a "Selected …" picker only when there are several shapes or bars; it already sits at the top.)
 * Probability, frequency and factor trees, sample spaces, two-way tables, spinners, function machines, the bubble method, written methods, algebra tiles, angle diagrams, area and perimeter, geometry figures, 3D solids, nets, constructions and ratio tables edit what is selected in the options box
 * beside it instead (the 21–22 Nov 2026 usability pilot); each tool leaves this list as it takes up the box.
 */
// Number lines and triangles took up the box on 23 Nov 2026; no tool is left on this list.
const tools: { tool: string; select?: (page: Page) => Promise<void> }[] = [];

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

test("number line: the Draw buttons stay put as a tick's box opens and closes", async ({ page }) => {
  await page.goto("/tools/number-line");
  const point = page.getByRole("button", { name: "Point", exact: true });
  const empty = (await point.boundingBox())!.y;
  await page.getByRole("button", { name: "Tick 3", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tick 3", exact: true })).toBeVisible();
  expect(Math.abs((await point.boundingBox())!.y - empty)).toBeLessThan(1);
  // Choosing a drawing mode clears the selection and its box.
  await point.click();
  await expect(page.locator(".md-options-box")).toHaveCount(0);
  expect(Math.abs((await point.boundingBox())!.y - empty)).toBeLessThan(1);
});
