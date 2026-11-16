import { test, expect, type Page } from "@playwright/test";
import { canonical, type Envelope } from "../packages/figure-core/src";
import { examples } from "../packages/figure-core/src/examples";

const key = "maths-booklet-tools:figures:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/figures");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("figures-resource").locator("svg").first();
// Maths runs print as separate text elements, so a label's pieces are joined.
const texts = (page: Page) => art(page).locator("text").evaluateAll((els) => els.map((x) => x.textContent ?? "").join(""));
const example = (id: string, worked = false) => examples.find((x) => x.id === id)!.make(worked);
const card = (page: Page) => page.getByRole("region", { name: "Selected object" });
const answers = (page: Page) => page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first();

test("selects a line on the figure, saves a hidden answer for the answers copy and undoes", async ({ page }) => {
  await boot(page, example("two-tangents"));
  await page.getByRole("button", { name: "Select side AD (ad)" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Line AD");
  const answer = card(page).getByRole("textbox", { name: "Saved answer (answers copy only)" });
  await answer.fill("12 cm");
  await answer.press("Enter");
  expect((await saved(page)).document.segments.find((s: { id: string }) => s.id === "ad").label).toEqual({ state: "hidden", text: "", answer: "12 cm" });
  // The pupil copy prints nothing there; the answers copy prints the saved answer.
  expect(await texts(page)).not.toContain("12 cm");
  await answers(page).check();
  expect(await texts(page)).toContain("12 cm");
  await answers(page).uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.segments.find((s: { id: string }) => s.id === "ad").label.answer).toBe("");
});

test("an angle size takes a degree sign, and a letter does too", async ({ page }) => {
  await boot(page, example("tangent-cyclic"));
  expect(await texts(page)).toContain("20°");
  await page.getByRole("button", { name: "Select angle ABD (abd)" }).click();
  const text = card(page).getByRole("textbox", { name: "Label text" });
  await text.fill("y");
  await text.press("Enter");
  await card(page).getByRole("combobox", { name: "Label shows" }).selectOption("symbol");
  expect(await texts(page)).toContain("y°");
  expect((await saved(page)).document.angles.find((a: { id: string }) => a.id === "abd").label).toEqual({ state: "symbol", text: "y", answer: "" });
});

test("dragging a point on a circle keeps it on the circle in one undo step", async ({ page }) => {
  await boot(page, example("tangent-cyclic"));
  const before = (await saved(page)).document.points.find((p: { id: string }) => p.id === "a").place;
  expect(before).toEqual({ type: "on", circle: "c", deg: 145 });
  const handle = page.getByRole("button", { name: "Drag point A" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 30, box.y + 40, { steps: 6 });
  await page.mouse.up();
  const after = (await saved(page)).document.points.find((p: { id: string }) => p.id === "a").place;
  expect(after.type).toBe("on");
  expect(after.deg).toBeGreaterThan(150);
  expect(after.deg % 5).toBe(0);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.points.find((p: { id: string }) => p.id === "a").place).toEqual(before);
});

test("arrow keys move a selected handle, and Escape lets go of the selection", async ({ page }) => {
  await boot(page, example("similar-right"));
  const handle = page.getByRole("button", { name: "Drag point B" });
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  expect((await saved(page)).document.points.find((p: { id: string }) => p.id === "b").place).toEqual({ type: "free", x: 28, y: 17 });
  await page.keyboard.press("Escape");
  await expect(card(page).getByRole("heading")).toHaveText("Selected object");
});

test("removing a point takes what is built on it, says so, and Undo brings it all back", async ({ page }) => {
  await boot(page, example("two-tangents"));
  await page.getByRole("combobox", { name: "Object to edit" }).selectOption("point:a");
  await card(page).getByRole("button", { name: "Remove point" }).click();
  // D is where the tangents at A and C meet, so it goes too, with the lines through A and D.
  await expect(page.getByRole("status")).toContainText("built on it were removed too");
  const d = (await saved(page)).document;
  expect(d.points.map((p: { id: string }) => p.id).sort()).toEqual(["b", "c1", "o"]);
  expect(d.segments.map((s: { id: string }) => s.id)).toEqual(["oc"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.points).toHaveLength(5);
});

test("adds a line, an angle and a point on a circle from the Add panel", async ({ page }) => {
  await boot(page, example("centre-angle"));
  const add = page.getByRole("region", { name: "Add to the figure" });
  await add.getByRole("combobox", { name: "First point" }).selectOption("b");
  await add.getByRole("combobox", { name: "Second point" }).selectOption("d");
  await add.getByRole("button", { name: "Line from first to second" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Line BD");
  await add.getByRole("combobox", { name: "First point" }).selectOption("a");
  await add.getByRole("combobox", { name: "Second point" }).selectOption("b");
  await add.getByRole("combobox", { name: "Third point" }).selectOption("d");
  await add.getByRole("button", { name: "Angle at the second point" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Angle ABD");
  await add.getByRole("combobox", { name: "Place the new point" }).selectOption("on");
  await add.getByRole("button", { name: "Add the point" }).click();
  const d = (await saved(page)).document;
  expect(d.segments.at(-1)).toMatchObject({ a: "b", b: "d" });
  expect(d.angles.at(-1)).toMatchObject({ at: "b", from: "a", to: "d", mark: "arc" });
  expect(d.points.at(-1).place).toEqual({ type: "on", circle: "c", deg: 45 });
});

test("prints Diagram NOT accurately drawn by default and keeps answers off the pupil copy of a worked example", async ({ page }) => {
  await boot(page, example("similar-right", true));
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  expect(await texts(page)).not.toContain("22.5");
  await answers(page).check();
  expect(await texts(page)).toContain("22.5 cm");
  await answers(page).uncheck();
  await page.getByRole("checkbox", { name: "Print “Diagram NOT accurately drawn”" }).uncheck();
  expect(await texts(page)).not.toContain("Diagram NOT accurately drawn");
});
