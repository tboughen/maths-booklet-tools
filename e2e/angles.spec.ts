import { test, expect, type Page } from "@playwright/test";
import { canonical, type Envelope } from "../packages/angle-core/src";
import { examples } from "../packages/angle-core/src/examples";

const key = "maths-booklet-tools:angles:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/angles");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("angles-resource").locator("svg").first();
const texts = (page: Page) => art(page).locator("text").allTextContents();
const example = (id: string, worked = false) => examples.find((x) => x.id === id)!.make(worked);

test("selects an angle on the diagram, labels it, keeps its answer for the teacher copy and undoes", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 2 (s2)" }).click();
  const card = page.getByRole("region", { name: "Selected angle" });
  await expect(card.getByRole("heading")).toHaveText("Angle: angle 2");
  const answer = card.getByRole("textbox", { name: "Saved answer (answers copy only)" });
  await answer.fill("67");
  await answer.press("Enter");
  expect((await saved(page)).document.angles.find((a: { id: string }) => a.id === "s2").label).toEqual({ state: "symbol", text: "x", answer: "67" });
  // The pupil copy keeps the letter; the answers copy prints the saved answer.
  expect(await texts(page)).toContain("x");
  expect(await texts(page)).not.toContain("67°");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().check();
  expect(await texts(page)).toContain("67°");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.angles.find((a: { id: string }) => a.id === "s2").label.answer).toBe("");
});

test("Delete removes the selected angle's mark and label in one undo step; Escape deselects", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 1 (s1)" }).click();
  await page.keyboard.press("Delete");
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s2", "s3"]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Selected angle" }).getByRole("heading")).toHaveText("Selected angle");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s1", "s2", "s3"]);
});

test("adds a ray without moving labels to other angles, and refuses a ray past its neighbour", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Add a ray" }).click();
  const d = (await saved(page)).document;
  expect(d.figure.rays).toHaveLength(3);
  // The 48° and 65° labels still sit on the angles that start at the same rays.
  const given = d.angles.filter((a: { label: { state: string } }) => a.label.state === "value").map((a: { label: { text: string } }) => a.label.text);
  expect(given.sort()).toEqual(["48", "65"]);
  const ray = page.getByRole("textbox", { name: "Ray 1 direction" });
  await ray.fill("170");
  await ray.press("Enter");
  await expect(ray).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status")).toContainText("between the neighbouring rays");
});

test("changes the figure to a polygon with an exterior angle, and warns about sizes that cannot be right", async ({ page }) => {
  await boot(page);
  await page.getByRole("combobox", { name: "Figure" }).selectOption("polygon");
  await expect(page.getByRole("status")).toContainText("Undo brings");
  await page.getByRole("checkbox", { name: "Exterior angle at corner 2" }).check();
  await page.getByRole("combobox", { name: "Angle to edit" }).selectOption("e2");
  const text = page.getByRole("region", { name: "Selected angle" }).getByRole("textbox", { name: "Label text" });
  await text.fill("50");
  await text.press("Enter");
  await page.getByRole("combobox", { name: "Angle to edit" }).selectOption("i2");
  await text.fill("120");
  await text.press("Enter");
  await expect(page.getByText("Teacher note: The interior and exterior angles at corner 2 add to 170°, not 180°.")).toBeVisible();
  expect(await texts(page)).toContain("50°");
});

test("prints Diagram NOT accurately drawn by default and draws stacked-card settings with the selected angle first", async ({ page }) => {
  await boot(page);
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  await page.getByRole("checkbox", { name: "Print “Diagram NOT accurately drawn”" }).uncheck();
  expect(await texts(page)).not.toContain("Diagram NOT accurately drawn");
});
