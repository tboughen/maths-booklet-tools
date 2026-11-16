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

test("labels a sector, hides it as an answer, changes its angle and undoes", async ({ page }) => {
  await boot(page, create());
  await page.getByRole("button", { name: "Edit the spinner, sector 2", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Selected label" });
  await expect(field).toBeFocused();
  await field.fill("Red");
  await field.press("Enter");
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(1);
  await page.getByLabel("Hide for pupils (keep as an answer)").check();
  expect((await saved(page)).document.objects[0].sectors[1].label).toEqual({ text: "Red", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show hidden answers").check();
  await expect(art(page).locator("text", { hasText: /^Red$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show hidden answers").uncheck();
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
  await page.getByRole("button", { name: "Edit the dice, top face", exact: true }).click();
  await page.getByRole("textbox", { name: "Selected label" }).fill("4");
  await page.getByRole("textbox", { name: "Selected label" }).press("Enter");
  await expect(page.getByText("Teacher note: First dice: 3 and 4 are on opposite faces of an ordinary dice, so they cannot both show.")).toBeVisible();
  await page.getByRole("button", { name: "Add a bag" }).click();
  expect((await saved(page)).document.objects.map((o: { type: string }) => o.type)).toEqual(["dice", "spinner", "bag"]);
  await page.getByRole("button", { name: "Edit the bag, group of counters 2" }).first().click();
  await page.getByRole("combobox", { name: "Counter fill" }).selectOption("hatched");
  expect((await saved(page)).document.objects[2].groups[1].fill).toBe("hatched");
});
