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

test("types operations on the machine, makes the output a pupil space and undoes", async ({ page }) => {
  await boot(page, create());
  // A click opens the options box with the text selected, ready to type (typing first, 22 Nov 2026).
  const typeInto = async (name: string, text: string) => {
    await page.getByRole("button", { name: new RegExp(`^Edit the ${name}\\b`) }).click();
    await expect(page.getByRole("textbox", { name: `Text of the ${name}` })).toBeFocused();
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    // With nothing more typed, Escape closes the box so the next item is in reach.
    await page.keyboard.press("Escape");
  };
  await typeInto("box 1", "x3");
  await typeInto("box 2", "-8");
  expect(ops((await saved(page)).document)).toEqual(["x3", "-8"]);
  await expect(art(page).locator("text", { hasText: "× 3" })).toHaveCount(1);
  await expect(art(page).locator("text", { hasText: "− 8" })).toHaveCount(1);
  await typeInto("start", "6");
  await typeInto("end", "12");
  await expect(page.getByText("Teacher note: 6 × 3 − 8 is 10, not 12.")).toBeVisible();
  // A double-click makes it a pupil space.
  await page.getByRole("button", { name: /^Edit the end\b/ }).dblclick();
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
  await page.getByRole("button", { name: "Work the machines out", exact: true }).click();
  await page.getByRole("button", { name: "Work out", exact: true }).click();
  const m = (await saved(page)).document.machines[1];
  expect(m.steps[0].out).toEqual({ text: "18", show: "hidden" });
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.machines[1].steps[0].out).toBeNull();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("combobox", { name: "Box shape" }).selectOption("rectangle");
  expect((await saved(page)).document.boxShape).toBe("rectangle");
});

test("what pupils see: a switch per kind, leave out prints no blank, clearing pupil spaces is one undo step", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "find-input")!.make(false));
  const boxes = page.getByRole("group", { name: "Boxes" });
  await boxes.getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.machines[0].steps.every((s: { op: { show: string } }) => s.op.show === "omit")).toBe(true);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: "× 3" })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await boxes.getByRole("button", { name: "Pupil space" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.machines[0].steps.every((s: { op: { show: string } }) => s.op.show === "show")).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.machines[0].steps.every((s: { op: { show: string } }) => s.op.show === "hidden")).toBe(true);
});
