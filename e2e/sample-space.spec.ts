import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/sample-space-core/src";
import { examples } from "../packages/sample-space-core/src/examples";

const key = "maths-booklet-tools:sample-space:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/sample-space");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("sample-space-resource").locator("svg");
const diceSum = () => examples.find((x) => x.id === "dice-sum")!.make(false);

test("edits a cell from the diagram, hides and circles it, shows it only in the teacher copy and undoes", async ({ page }) => {
  await boot(page, diceSum());
  // 12 (6 and 6) is a hidden answer: not on the pupil copy.
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show hidden answers").check();
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show hidden answers").uncheck();

  await page.getByRole("button", { name: "Edit the cell for 6, 6" }).click();
  const field = page.getByRole("textbox", { name: "Cell for 6, 6" });
  await expect(field).toBeFocused();
  await field.fill("13");
  await field.press("Enter");
  expect((await saved(page)).document.rows[5].cells[5]).toEqual({ text: "13", show: "hidden" });
  await expect(page.getByText("Teacher note: The cell for 6 and 6 holds 13; the sum is 12.")).toBeVisible();
  await page.getByLabel("Hide for pupils (keep as an answer)").uncheck();
  await page.getByLabel("Circle this outcome").check();
  expect((await saved(page)).document.rows[5].cells[5]).toEqual({ text: "13", show: "show", ring: true });
  await expect(art(page).locator("ellipse")).toHaveCount(1);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  await expect(field).toHaveValue("12");
  await expect(art(page).locator("ellipse")).toHaveCount(0);
});

test("fills empty cells only when asked, exactly, and keeps them hidden as answers", async ({ page }) => {
  await boot(page, create(["H", "T"], ["1", "2"]));
  const cell = page.getByRole("textbox", { name: "Cell for H, 1" });
  await cell.fill("H1");
  await cell.press("Enter");
  await page.getByRole("combobox", { name: "Fill with" }).selectOption("sum");
  await page.getByRole("button", { name: "Fill empty cells" }).click();
  await expect(page.getByRole("status")).toContainText("must be a number");
  expect((await saved(page)).document.rows[1].cells[0].text).toBe("");
  await page.getByRole("combobox", { name: "Fill with" }).selectOption("pair");
  await page.getByRole("button", { name: "Fill empty cells" }).click();
  const d = (await saved(page)).document;
  expect(d.rows.map((r: { cells: { text: string; show: string }[] }) => r.cells)).toEqual([
    [{ text: "H1", show: "show" }, { text: "(H, 2)", show: "hidden" }],
    [{ text: "(T, 1)", show: "hidden" }, { text: "(T, 2)", show: "hidden" }],
  ]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.rows[1].cells[1].text).toBe("");
});

test("keeps fractions stacked and names the events beside the table", async ({ page }) => {
  await boot(page, create(["1/2", "1/4"], ["1/3"]));
  await page.getByRole("button", { name: "Fill empty cells" }).click();
  await page.getByLabel("Teacher copy: show hidden answers").check();
  await expect(art(page).locator("text", { hasText: "/" })).toHaveCount(0);
  const name = page.getByRole("textbox", { name: "Event across the top" });
  await name.fill("Spinner");
  await name.press("Enter");
  await expect(art(page).locator("text", { hasText: /^Spinner$/ })).toHaveCount(1);
  expect((await saved(page)).document.columnTitle).toBe("Spinner");
});

test("adds and removes outcomes and keeps the lines choice", async ({ page }) => {
  await boot(page, create(["H", "T"], ["1", "2", "3"]));
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("button", { name: "Remove column 2" }).click();
  await page.getByRole("combobox", { name: "Lines" }).selectOption("bold");
  const d = (await saved(page)).document;
  expect([d.rows.length, d.columns.map((c: { heading: string }) => c.heading), d.lines]).toEqual([3, ["1", "3"], "bold"]);
});
