import { test, expect, type Page } from "@playwright/test";
import { canonical, type Envelope } from "../packages/area-core/src";
import { examples } from "../packages/area-core/src/examples";

const key = "maths-booklet-tools:area:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/area");
  await expect(art(page)).toBeVisible();
}
type Saved = { id: string; state: string; text: string; answer: string };
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("area-resource").locator("svg").first();
const texts = (page: Page) => art(page).locator("text").allTextContents();
const example = (id: string, worked = false) => examples.find((x) => x.id === id)!.make(worked);
const box = (page: Page) => page.locator(".md-options-box");
const hit = (page: Page, id: string) => page.getByRole("button", { name: new RegExp(`^Select the label on .*\\(${id}\\)`) });
const pressed = (page: Page) => page.locator(".area-hit[aria-pressed=true]");

test("types the answer for a pupil space in its options box, for the answers copy only, and undoes", async ({ page }) => {
  await boot(page, example("l-shape"));
  await page.getByRole("button", { name: "Select the label on side 3 (e3)" }).click();
  await expect(box(page)).toContainText("The label on side 3");
  const text = box(page).getByRole("textbox", { name: "Text of the label on side 3" });
  await text.fill("7 cm");
  await text.press("Enter");
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === "e3")).toEqual({ id: "e3", state: "hidden", text: "", answer: "7 cm" });
  // The pupil copy prints nothing there; the answers copy prints the saved answer.
  expect(await texts(page)).not.toContain("7 cm");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().check();
  expect(await texts(page)).toContain("7 cm");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === "e3").answer).toBe("");
});

test("What pupils see: double-click for a pupil space, leave every label out, and clear the spaces", async ({ page }) => {
  await boot(page, example("l-shape"));
  const given = (await saved(page)).document.labels.find((l: Saved) => l.state === "value") as Saved;
  await hit(page, given.id).dblclick();
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === given.id)).toEqual({ ...given, state: "hidden", text: "", answer: given.text });
  expect(await texts(page)).not.toContain(given.text);
  await page.keyboard.press("Escape");
  await page.getByRole("group", { name: "Labels", exact: true }).getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.labels.every((l: Saved) => l.state === "blank" && !l.answer)).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === given.id)).toEqual(given);
});

test("removes a label in one undo step; Escape closes its options", async ({ page }) => {
  await boot(page, example("l-shape"));
  await page.getByRole("button", { name: "Select the label on side 1 (e1)" }).click();
  await box(page).getByRole("button", { name: "Remove label" }).click();
  expect((await saved(page)).document.labels.map((l: Saved) => l.id)).not.toContain("e1");
  await page.getByRole("button", { name: "Select the label on side 2 (e2)" }).click();
  await page.keyboard.press("Escape");
  await expect(box(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.labels.map((l: Saved) => l.id)).toContain("e1");
});

test("changes to a sector, keeps the labels it has a place for and warns about radii that cannot be right", async ({ page }) => {
  await boot(page);
  await page.getByRole("combobox", { name: "Start from a shape" }).selectOption("sector");
  await expect(page.getByRole("status")).toContainText("Undo brings");
  for (const [id, size] of [["r", "9 cm"], ["r2", "8 cm"]]) {
    await hit(page, id).click();
    const text = box(page).getByRole("textbox", { name: /^Text of / });
    await text.fill(size);
    await text.press("Enter");
    await page.keyboard.press("Escape");
  }
  await expect(page.getByText("Teacher note: The two radii are 9 and 8, but they should be equal.")).toBeVisible();
  await page.getByRole("textbox", { name: "Sector angle" }).fill("400");
  await page.getByRole("textbox", { name: "Sector angle" }).press("Enter");
  await expect(page.getByRole("textbox", { name: "Sector angle" })).toHaveAttribute("aria-invalid", "true");
});

test("adds a shaded hole and a grid, and prints Diagram NOT accurately drawn by default", async ({ page }) => {
  await boot(page, example("l-shape"));
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  await page.getByRole("button", { name: "Hole and shading", exact: true }).click();
  await page.getByRole("combobox", { name: "Hole" }).selectOption("circle");
  const d = (await saved(page)).document;
  expect(d.hole.type).toBe("circle");
  expect(d.shaded).toBe("shape");
  await page.getByRole("button", { name: "Printing", exact: true }).click();
  await page.getByRole("checkbox", { name: /Centimetre squares/ }).check();
  expect((await saved(page)).document.grid).toBe(true);
  await page.getByRole("checkbox", { name: "Print “Diagram NOT accurately drawn”" }).uncheck();
  expect(await texts(page)).not.toContain("Diagram NOT accurately drawn");
});

test("adding a corner splits the last side and drops its label; removing one drops the joined sides' labels", async ({ page }) => {
  await boot(page, example("l-shape"));
  const ids = async () => (await saved(page)).document.labels.map((l: Saved) => l.id);
  await page.getByText("Corners, sides and heights").click();
  await page.getByRole("button", { name: "Remove the last corner" }).click();
  await expect(page.getByRole("status")).toContainText("2 labels have no place on the new shape");
  await expect.poll(ids).not.toContain("e5");
  expect(await ids()).not.toContain("e6");
  expect(await ids()).toContain("e4");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(ids).toContain("e6");
  // A selected side lets go when the sides renumber, and Undo does not bring the selection back.
  await page.getByRole("button", { name: "Select the label on side 6 (e6)" }).click();
  await expect(box(page)).toContainText("The label on side 6");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add a corner" }).click();
  await expect(pressed(page)).toHaveCount(0);
  await expect.poll(ids).not.toContain("e6");
  expect(await ids()).toContain("e5");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(ids).toContain("e6");
  await expect(pressed(page)).toHaveCount(0);
  // Editing a label, and undoing and redoing that edit, keeps the selection.
  await page.getByRole("button", { name: "Select the label on side 2 (e2)" }).click();
  await box(page).getByRole("textbox", { name: "Text of the label on side 2" }).fill("6 cm");
  await box(page).getByRole("textbox", { name: "Text of the label on side 2" }).press("Enter");
  await expect.poll(async () => (await saved(page)).document.labels.find((l: Saved) => l.id === "e2").text).toBe("6 cm");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(hit(page, "e2")).toHaveAttribute("aria-pressed", "true");
  // A stretch keeps the selection; a new shape lets it go.
  const width = page.getByRole("textbox", { name: "Shape width" });
  await width.fill("80");
  await width.press("Enter");
  await expect.poll(async () => Math.max(...(await saved(page)).document.shape.corners.map((c: { x: number }) => c.x))).toBeGreaterThan(70);
  await expect(hit(page, "e2")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "Start from a shape" }).selectOption("rectangle");
  await expect(pressed(page)).toHaveCount(0);
});
