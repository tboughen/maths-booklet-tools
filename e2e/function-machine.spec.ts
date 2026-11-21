import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/function-machine-core/src";
import { examples } from "../packages/function-machine-core/src/examples";

const key = "maths-booklet-tools:function-machine:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/function-machine");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("function-machine-resource").locator("svg");
const ops = (d: { machines: { steps: { op: { text: string } }[] }[] }, i = 0) => d.machines[i].steps.map((s) => s.op.text);

test("types operations on the machine, hides the output and undoes", async ({ page }) => {
  await boot(page, create());
  await page.getByRole("button", { name: "Edit the box 1", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Selected operation" });
  await expect(field).toBeFocused();
  await field.fill("x3");
  await field.press("Enter");
  await page.getByRole("button", { name: "Edit the box 2", exact: true }).click();
  await field.fill("-8");
  await field.press("Enter");
  expect(ops((await saved(page)).document)).toEqual(["x3", "-8"]);
  await expect(art(page).locator("text", { hasText: "× 3" })).toHaveCount(1);
  await expect(art(page).locator("text", { hasText: "− 8" })).toHaveCount(1);
  await page.getByRole("button", { name: "Edit the start", exact: true }).click();
  await page.getByRole("textbox", { name: "Selected value" }).fill("6");
  await page.getByRole("textbox", { name: "Selected value" }).press("Enter");
  await page.getByRole("button", { name: "Edit the end", exact: true }).click();
  await page.getByRole("textbox", { name: "Selected value" }).fill("12");
  await page.getByRole("textbox", { name: "Selected value" }).press("Enter");
  await expect(page.getByText("Teacher note: 6 × 3 − 8 is 10, not 12.")).toBeVisible();
  await page.getByLabel("Hide for pupils (keep as an answer)").check();
  expect((await saved(page)).document.machines[0].end).toEqual({ text: "12", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(ops((await saved(page)).document)).toEqual(["", ""]);
});

test("works the machine out only when asked, then adds its inverse", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "find-input")!.make(false));
  await page.getByRole("button", { name: "Add the inverse machine" }).click();
  const d = (await saved(page)).document;
  expect(ops(d, 1)).toEqual(["+ 5", "÷ 3"]);
  expect(d.machines[1].direction).toBe("left");
  await page.getByRole("button", { name: "Work out" }).click();
  const m = (await saved(page)).document.machines[1];
  expect(m.steps[0].out).toEqual({ text: "18", show: "hidden" });
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.machines[1].steps[0].out).toBeNull();
  await page.getByRole("combobox", { name: "Box shape" }).selectOption("rectangle");
  expect((await saved(page)).document.boxShape).toBe("rectangle");
});
