import { test, expect, type Page } from "@playwright/test";
import { canonical, type Envelope } from "../packages/solid-core/src";
import { examples } from "../packages/solid-core/src/examples";

const key = "maths-booklet-tools:solids:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/solids");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("solids-resource").locator("svg").first();
// Maths runs print as separate text elements, so a label's pieces are joined.
const texts = (page: Page) => art(page).locator("text").evaluateAll((els) => els.map((x) => x.textContent ?? "").join(""));
const example = (id: string) => examples.find((x) => x.id === id)!.make();
const card = (page: Page) => page.getByRole("region", { name: "Selected object" });
const answers = (page: Page) => page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first();

test("starts as a cuboid with its hidden edges dashed and three lengths given", async ({ page }) => {
  await boot(page);
  expect(await texts(page)).toContain("8 cm");
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  expect(await art(page).locator("[stroke-dasharray]").count()).toBeGreaterThan(0);
  await page.getByRole("checkbox", { name: /Dash the hidden edges/ }).uncheck();
  expect(await art(page).locator("[stroke-dasharray]").count()).toBe(0);
  expect((await saved(page)).document.hidden).toBe("none");
});

test("selects a length on the drawing, saves a hidden answer for the answers copy and undoes", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Select length p1p2 (w)" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Length p1p2");
  await card(page).getByRole("textbox", { name: "Label text" }).fill("");
  await card(page).getByRole("textbox", { name: "Label text" }).press("Enter");
  const answer = card(page).getByRole("textbox", { name: "Saved answer (answers copy only)" });
  await answer.fill("12 cm");
  await answer.press("Enter");
  expect((await saved(page)).document.dims.find((m: { id: string }) => m.id === "w").label).toEqual({ state: "hidden", text: "", answer: "12 cm" });
  expect(await texts(page)).not.toContain("12 cm");
  await answers(page).check();
  expect(await texts(page)).toContain("12 cm");
  await answers(page).uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.dims.find((m: { id: string }) => m.id === "w").label.answer).toBe("");
});

test("names a corner, and an angle size takes a degree sign", async ({ page }) => {
  await boot(page, example("triangular-prism"));
  expect(await texts(page)).toContain("35°");
  await page.getByRole("combobox", { name: "Object to edit" }).selectOption("point:pb3");
  await expect(card(page).getByRole("heading")).toHaveText("Point E");
  const name = card(page).getByRole("textbox", { name: "Point name" });
  await name.fill("G");
  await name.press("Enter");
  expect((await saved(page)).document.names).toContainEqual({ id: "pb3", text: "G" });
  expect(await texts(page)).toContain("G");
});

test("turns a cylinder's view, and changing a solid's type is one undo step", async ({ page }) => {
  await boot(page, example("cylinder-tank"));
  const tilt = page.getByRole("textbox", { name: "Tilt" });
  await tilt.fill("25");
  await tilt.press("Enter");
  expect((await saved(page)).document.view).toEqual({ type: "turned", turn: 0, tilt: 25 });
  await page.getByRole("combobox", { name: "Object to edit" }).selectOption("solid:c");
  // A cone has no top rim, so the point on it and the height arrow to it go too, and say so.
  await card(page).getByRole("combobox", { name: "Solid type" }).selectOption("cone");
  expect((await saved(page)).document.solids[0]).toMatchObject({ type: "cone", r: 16, h: 42, top: 0 });
  expect((await saved(page)).document.points.map((p: { id: string }) => p.id)).toEqual(["b"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.solids[0].type).toBe("cylinder");
});

test("removing a point takes the lines and lengths on it, says so, and Undo brings them back", async ({ page }) => {
  await boot(page, example("square-pyramid"));
  await page.getByRole("combobox", { name: "Object to edit" }).selectOption("point:m");
  await card(page).getByRole("button", { name: "Remove point" }).click();
  await expect(page.getByRole("status")).toContainText("built on it were removed too");
  const d = (await saved(page)).document;
  expect(d.points.map((p: { id: string }) => p.id)).toEqual(["o"]);
  expect(d.lines.map((l: { id: string }) => l.id)).toEqual(["vo"]);
  expect(d.dims.map((m: { id: string }) => m.id)).toEqual(["h", "ab"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.points).toHaveLength(2);
});

test("adds a length, an angle, a midpoint and a second solid from the Add panel", async ({ page }) => {
  await boot(page);
  const add = page.getByRole("region", { name: "Add to the drawing" });
  await add.getByRole("combobox", { name: "First point" }).selectOption("p1");
  await add.getByRole("combobox", { name: "Second point" }).selectOption("p3");
  await add.getByRole("button", { name: "Length from first to second" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Length p1p3");
  await add.getByRole("combobox", { name: "Third point" }).selectOption("p2");
  await add.getByRole("button", { name: "Angle at the second point" }).click();
  await expect(card(page).getByRole("heading")).toHaveText("Angle p1p3p2");
  await add.getByRole("button", { name: "Midpoint of first and second" }).click();
  await add.getByRole("combobox", { name: "New solid" }).selectOption("cylinder");
  await add.getByRole("button", { name: "Add the solid" }).click();
  const d = (await saved(page)).document;
  expect(d.dims.at(-1)).toMatchObject({ a: "p1", b: "p3", kind: "beside" });
  expect(d.angles.at(-1)).toMatchObject({ at: "p3", from: "p1", to: "p2", mark: "arc" });
  expect(d.points.at(-1).place).toEqual({ type: "along", a: "p1", b: "p3", t: 0.5 });
  expect(d.solids.at(-1)).toMatchObject({ type: "cylinder", r: 12, h: 30 });
});
