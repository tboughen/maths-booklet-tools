import { test, expect, type Page } from "./release-fixtures";
import { pane, paneSwitch } from "./question-bank-panes";

// June 2018 2H Q5: (c) is mapped to U601 and needs the answer to (b); (a) is mapped elsewhere.
const address = "/question-bank?code=U601&question=1MA1_JUN_2018_2H_Q5";
const drawn = (page: Page, count: number) => expect.poll(() => page.locator(".qb-stage canvas").evaluateAll(nodes => nodes.length && nodes.every(n => (n as HTMLCanvasElement).width > 0) ? nodes.length : 0)).toBe(count);

test("a matching part shows on its own with the earlier part it needs, and the whole question is one click away", async ({ page }) => {
  await page.goto(address);
  const info = page.locator(".qb-view-info");
  await expect(info).toContainText("Parts (b) and (c)");
  await expect(info).toContainText("Comes with (b). 4 marks.");
  // (b) and (c) are stacked in one view, (b) above (c), left edges aligned as on the paper.
  await drawn(page, 2);
  const [b, c] = await page.locator(".qb-stage .qb-pdf").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect()).map(r => ({left: r.left, top: r.top, bottom: r.bottom})));
  expect(c.top).toBeGreaterThan(b.bottom);
  expect(Math.abs(c.left - b.left)).toBeLessThan(1);
  await expect(page.locator(".qb-navigation")).toContainText("View 1 of 1");
  await page.getByRole("button", { name: "Show whole question" }).click();
  await expect(info).toContainText("Question 5, page 1 of 2");
  await expect(page.getByRole("button", { name: "Show only parts (b) and (c)" })).toBeVisible();
  await expect(page.locator(".qb-navigation")).toContainText("of 2");
  // The mark scheme is the whole question's: beside the parts it is one whole view, and by itself it has no parts choice.
  await page.getByRole("button", { name: "Show only parts (b) and (c)" }).click();
  await paneSwitch(page, "Mark scheme").click();
  await expect(pane(page, "Question").locator(".qb-pdf")).toHaveCount(2);
  await expect(pane(page, "Mark scheme").locator(".qb-pdf")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Show whole question" })).toBeVisible();
  await paneSwitch(page, "Question").click();
  await expect(page.getByRole("button", { name: "Show whole question" })).toHaveCount(0);
});
