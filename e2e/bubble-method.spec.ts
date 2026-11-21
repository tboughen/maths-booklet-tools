import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/bubble-method-core/src";
import { examples } from "../packages/bubble-method-core/src/examples";

const key = "maths-booklet-tools:bubble-method:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/bubble-method");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("bubble-method-resource").locator("svg");

test("types bubbles and a line, hides the line and undoes", async ({ page }) => {
  await boot(page, create());
  await page.getByRole("button", { name: "Edit the left bubble of step 1", exact: true }).click();
  const bubble = page.getByRole("textbox", { name: "Selected bubble" });
  await expect(bubble).toBeFocused();
  await bubble.fill("-3");
  await bubble.press("Enter");
  await page.getByRole("button", { name: "Write it in both bubbles" }).click();
  expect((await saved(page)).document.steps[0].right.op.text).toBe("-3");
  await expect(art(page).locator("text", { hasText: "−3" })).toHaveCount(2);
  await page.getByRole("button", { name: "Edit the left side of line 2", exact: true }).click();
  const side = page.getByRole("textbox", { name: "Selected side" });
  await side.fill("2x");
  await side.press("Enter");
  await page.getByLabel("Hide for pupils (keep as an answer)").check();
  expect((await saved(page)).document.steps[0].line.lhs).toEqual({ text: "2x", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^x$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^x$/ })).toHaveCount(2);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Edit the right bubble of step 1", exact: true }).click();
  await bubble.fill("+3");
  await bubble.press("Enter");
  await expect(page.getByText("Teacher note: The bubbles differ (−3 and +3). Balancing does the same to both sides.")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.steps[0].left.op.text).toBe("");
});

test("adds and removes steps, moves a bubble to a term and turns an inequality sign round", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "subject-formula")!.make(false));
  await page.getByRole("button", { name: "Add a step", exact: true }).click();
  expect((await saved(page)).document.steps).toHaveLength(3);
  await page.getByRole("button", { name: "Remove step 3" }).click();
  expect((await saved(page)).document.steps).toHaveLength(2);
  await page.getByRole("button", { name: "Edit the right bubble of step 1", exact: true }).click();
  await page.getByRole("combobox", { name: "Bubble sits under" }).selectOption("whole");
  expect((await saved(page)).document.steps[0].right.under).toBe("whole");
  await page.getByRole("button", { name: "Edit the left side of the first line", exact: true }).click();
  await page.getByRole("combobox", { name: "Sign" }).selectOption("≤");
  expect((await saved(page)).document.first.rel).toBe("≤");
});
