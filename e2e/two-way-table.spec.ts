import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/two-way-table-core/src";
import { examples } from "../packages/two-way-table-core/src/examples";

const key = "maths-booklet-tools:two-way-table:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/two-way-table");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("two-way-table-resource").locator("svg");
const complete = () => examples.find((x) => x.id === "complete")!.make(false);

test("edits a cell from the table, hides it as an answer, shows it only in the teacher copy and undoes", async ({ page }) => {
  await boot(page, complete());
  // 18 (Year 7, Walk) is a hidden answer: not on the pupil copy.
  await expect(art(page).locator("text", { hasText: /^18$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show hidden answers").check();
  await expect(art(page).locator("text", { hasText: /^18$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show hidden answers").uncheck();

  await page.getByRole("button", { name: "Edit the cell for Year 8, Car" }).click();
  const field = page.getByRole("textbox", { name: "Cell for Year 8, Car" });
  await expect(field).toBeFocused();
  await field.fill("15");
  await field.press("Enter");
  expect((await saved(page)).document.rows[1].cells[2]).toEqual({ text: "15", show: "show" });
  // Hidden answers still count: 9 + 15 disagrees with the column total of 21.
  await expect(page.getByText("Teacher note: The parts of column Car add to 24, not 21.")).toBeVisible();
  await page.getByLabel("Hide for pupils (keep as an answer)").check();
  expect((await saved(page)).document.rows[1].cells[2]).toEqual({ text: "15", show: "hidden" });
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field).toHaveValue("12");
});

test("keeps an unreadable number in its box with the reason", async ({ page }) => {
  await boot(page, complete());
  const field = page.getByRole("textbox", { name: "Cell for Year 7, Bus" });
  await field.fill("lots");
  await field.press("Enter");
  await expect(field).toHaveValue("lots");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status")).toContainText('"lots"');
  expect((await saved(page)).document.rows[0].cells[1].text).toBe("25");
  await field.press("Escape");
  await expect(field).toHaveValue("25");
});

test("completes totals only when asked, exactly, and keeps them hidden as answers", async ({ page }) => {
  await boot(page, create(["Red", "Blue"], ["A", "B"]));
  const fill = async (label: string, v: string) => {
    const f = page.getByRole("textbox", { name: label });
    await f.fill(v);
    await f.press("Enter");
  };
  await fill("Cell for A, Red", "1/4");
  await fill("Cell for A, Blue", "1/8");
  await fill("Cell for B, Red", "3/8");
  await fill("Cell for B, Blue", "1/4");
  expect((await saved(page)).document.totalRow.every((c: { text: string }) => c.text === "")).toBe(true);
  await page.getByRole("button", { name: "Complete totals" }).click();
  const d = (await saved(page)).document;
  expect(d.rows.map((r: { cells: { text: string }[] }) => r.cells[2])).toEqual([{ text: "3/8", show: "hidden" }, { text: "5/8", show: "hidden" }]);
  expect(d.totalRow.map((c: { text: string }) => c.text)).toEqual(["5/8", "3/8", "1"]);
  // Stacked fractions on the artwork: no inline slash.
  await page.getByLabel("Teacher copy: show hidden answers").check();
  await expect(art(page).locator("text", { hasText: "/" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.totalRow[2].text).toBe("");
});

test("adds and removes rows, columns and totals", async ({ page }) => {
  await boot(page, complete());
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("button", { name: "Add column" }).click();
  let d = (await saved(page)).document;
  expect([d.rows.length, d.columns.length, d.rows[0].cells.length]).toEqual([3, 4, 5]);
  await page.getByRole("button", { name: "Remove row Year 8" }).click();
  await page.getByLabel("Total row").uncheck();
  d = (await saved(page)).document;
  expect(d.rows.map((r: { heading: string }) => r.heading)).toEqual(["Year 7", ""]);
  expect(d.totalRow).toBeNull();
  await page.getByLabel("This table has a deliberate error").check();
  expect((await saved(page)).document.intentionalError).toBe(true);
});
