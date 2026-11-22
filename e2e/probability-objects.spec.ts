import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/probability-objects-core/src";
import { examples } from "../packages/probability-objects-core/src/examples";

const key = "maths-booklet-tools:probability-objects:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/probability-objects");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("probability-objects-resource").locator("svg");

test("labels a sector, makes it a pupil space, changes its angle and undoes", async ({ page }) => {
  await boot(page, create());
  // A click opens the options box with the label selected: typing replaces it (typing first, 22 Nov 2026).
  const target = page.getByRole("button", { name: /^Edit the spinner, sector 2\b/ });
  await target.click();
  await expect(page.getByRole("textbox", { name: "Text of the spinner, sector 2" })).toBeFocused();
  await page.keyboard.type("Red");
  await page.keyboard.press("Enter");
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(1);
  // A double-click makes it a pupil space; the box stays open for the angle.
  await target.dblclick();
  expect((await saved(page)).document.objects[0].sectors[1].label).toEqual({ text: "Red", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // The switch closed the box; the sector's own settings are in it.
  await target.click();
  const angle = page.getByRole("textbox", { name: "Sector angle" });
  await angle.fill("180");
  await angle.press("Enter");
  expect((await saved(page)).document.objects[0].sectors[1].angle).toBe(180);
  await angle.fill("400");
  await angle.press("Enter");
  await expect(angle).toHaveAttribute("aria-invalid", "true");
  await angle.press("Escape");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.objects[0].sectors[1]).toEqual({ label: { text: "2", show: "show" }, fill: "none", angle: null });
});

test("adds a dice and a bag beside the spinner and flags an impossible dice", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "dice-and-spinner")!.make(false));
  await page.getByRole("button", { name: /^Edit the dice, top face\b/ }).click();
  await page.keyboard.type("4");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Teacher note: First dice: 3 and 4 are on opposite faces of an ordinary dice, so they cannot both show.")).toBeVisible();
  await page.getByRole("button", { name: "Add a bag" }).click();
  expect((await saved(page)).document.objects.map((o: { type: string }) => o.type)).toEqual(["dice", "spinner", "bag"]);
  await page.getByRole("button", { name: /^Edit the bag, group of counters 2\b/ }).first().click();
  await page.getByRole("combobox", { name: "Counter fill" }).selectOption("hatched");
  expect((await saved(page)).document.objects[2].groups[1].fill).toBe("hatched");
});

test("what pupils see: a switch per kind of object, leave out prints no blank, clearing pupil spaces is one undo step", async ({ page }) => {
  await boot(page, create());
  const sectors = page.getByRole("group", { name: "Spinner sectors" });
  await sectors.getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.objects[0].sectors.every((x: { label: { show: string } }) => x.label.show === "omit")).toBe(true);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^2$/ })).toHaveCount(0);
  await expect(art(page).locator("line[stroke-dasharray]")).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await sectors.getByRole("button", { name: "Pupil space" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.objects[0].sectors.every((x: { label: { show: string } }) => x.label.show === "show")).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.objects[0].sectors.every((x: { label: { show: string } }) => x.label.show === "hidden")).toBe(true);
});
