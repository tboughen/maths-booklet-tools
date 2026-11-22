import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/written-method-core/src";
import { examples } from "../packages/written-method-core/src/examples";

const key = "maths-booklet-tools:written-method:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/written-method");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("written-method-resource").locator("svg");
const enter = async (page: Page, row: string, text: string) => {
  // A click opens the options box with the digits selected, ready to type (typing first, 22 Nov 2026).
  await page.getByRole("button", { name: new RegExp(`^Edit ${row}\\b`) }).click();
  await expect(page.getByRole("textbox", { name: `Digits of ${row}` })).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
};

test("types a column addition, writes a carry, makes the answer a pupil space and undoes", async ({ page }) => {
  await boot(page, create("add"));
  await enter(page, "number 1", "4758");
  await enter(page, "number 2", "2696");
  await enter(page, "the answer", "7464");
  await expect(page.getByText("Teacher note: 4758 + 2696 is 7454, not 7464.")).toBeVisible();
  await page.getByRole("textbox", { name: "Small digit in the tens column" }).fill("1");
  await page.getByRole("textbox", { name: "Small digit in the tens column" }).press("Enter");
  expect((await saved(page)).document.marks).toEqual([{ row: "answer", place: 1, text: "1", show: "show" }]);
  // A double-click makes it a pupil space.
  await page.getByRole("button", { name: /^Edit the answer\b/ }).dblclick();
  expect((await saved(page)).document.answer).toEqual({ text: "7464", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^6$/ })).toHaveCount(2);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^6$/ })).toHaveCount(3);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Undo" }).click();
  const d = (await saved(page)).document;
  expect(d.numbers.map((n: { value: { text: string } }) => n.value.text)).toEqual(["", ""]);
  expect(d.marks).toEqual([]);
});

test("works long multiplication out only when asked, and changes method and squares", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "long-multiplication")!.make(false));
  expect((await saved(page)).document.answer.text).toBe("");
  await page.getByRole("button", { name: "Work the method out", exact: true }).click();
  await page.getByRole("button", { name: "Work out", exact: true }).click();
  let d = (await saved(page)).document;
  expect(d.answer).toEqual({ text: "23478", show: "hidden" });
  expect(d.working.map((w: { value: { text: string } }) => w.value.text)).toEqual(["1638", "21840"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.answer.text).toBe("");
  await page.getByRole("button", { name: /^Edit working row 1\b/ }).click();
  await page.getByRole("button", { name: "Move one column left" }).click();
  expect((await saved(page)).document.working[0].place).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("combobox", { name: "Square size" }).selectOption("8");
  expect((await saved(page)).document.cellMm).toBe(8);
  await page.getByRole("combobox", { name: "Method", exact: true }).selectOption("short-division");
  d = (await saved(page)).document;
  expect(d.method).toBe("short-division");
  expect(d.working).toEqual([]);
  await expect(page.getByRole("button", { name: /^Edit the number to divide by\b/ })).toBeVisible();
});

test("what pupils see: a switch per kind, leave out prints nothing in either copy, clearing pupil spaces is one undo step", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "long-multiplication")!.make(true));
  const answer = page.getByRole("group", { name: "Answer", exact: true });
  await answer.getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.answer.show).toBe("omit");
  // The teacher copy prints none of the answer's digits: one digit per answer digit fewer than with the answer shown.
  await page.getByLabel("Teacher copy: show answers").check();
  const without = await art(page).locator("text").count();
  await answer.getByRole("button", { name: "Show" }).click();
  const digits = ((await saved(page)).document.answer.text as string).replace(/\D/g, "").length;
  await expect(art(page).locator("text")).toHaveCount(without + digits);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await answer.getByRole("button", { name: "Pupil space" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.answer.show).toBe("show");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.answer.show).toBe("hidden");
});
