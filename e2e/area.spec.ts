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

test("selects a side on the diagram, saves a hidden answer for the answers copy and undoes", async ({ page }) => {
  await boot(page, example("l-shape"));
  await page.getByRole("button", { name: "Select the label on side 3 (e3)" }).click();
  const card = page.getByRole("region", { name: "Selected label" });
  await expect(card.getByRole("heading")).toHaveText("Label: side 3");
  const answer = card.getByRole("textbox", { name: "Saved answer (answers copy only)" });
  await answer.fill("7 cm");
  await answer.press("Enter");
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === "e3")).toEqual({ id: "e3", state: "hidden", text: "", answer: "7 cm" });
  // The pupil copy prints nothing there; the answers copy prints the saved answer.
  expect(await texts(page)).not.toContain("7 cm");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().check();
  expect(await texts(page)).toContain("7 cm");
  await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.labels.find((l: Saved) => l.id === "e3").answer).toBe("");
});

test("Delete removes the selected label in one undo step; Escape deselects", async ({ page }) => {
  await boot(page, example("l-shape"));
  await page.getByRole("button", { name: "Select the label on side 1 (e1)" }).click();
  await page.keyboard.press("Delete");
  expect((await saved(page)).document.labels.map((l: Saved) => l.id)).not.toContain("e1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Selected label" }).getByRole("heading")).toHaveText("Selected label");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.labels.map((l: Saved) => l.id)).toContain("e1");
});

test("changes to a sector, keeps the labels it has a place for and warns about radii that cannot be right", async ({ page }) => {
  await boot(page);
  await page.getByRole("combobox", { name: "Start from a shape" }).selectOption("sector");
  await expect(page.getByRole("status")).toContainText("Undo brings");
  const select = page.getByRole("combobox", { name: "Label to edit" });
  const text = page.getByRole("region", { name: "Selected label" }).getByRole("textbox", { name: "Label text" });
  await select.selectOption("r");
  await text.fill("9 cm");
  await text.press("Enter");
  await select.selectOption("r2");
  await text.fill("8 cm");
  await text.press("Enter");
  await expect(page.getByText("Teacher note: The two radii are 9 and 8, but they should be equal.")).toBeVisible();
  await page.getByRole("textbox", { name: "Sector angle" }).fill("400");
  await page.getByRole("textbox", { name: "Sector angle" }).press("Enter");
  await expect(page.getByRole("textbox", { name: "Sector angle" })).toHaveAttribute("aria-invalid", "true");
});

test("adds a shaded hole and a grid, and prints Diagram NOT accurately drawn by default", async ({ page }) => {
  await boot(page, example("l-shape"));
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  await page.getByRole("combobox", { name: "Hole" }).selectOption("circle");
  const d = (await saved(page)).document;
  expect(d.hole.type).toBe("circle");
  expect(d.shaded).toBe("shape");
  await page.getByRole("checkbox", { name: /Centimetre squares/ }).check();
  expect((await saved(page)).document.grid).toBe(true);
  await page.getByRole("checkbox", { name: "Print “Diagram NOT accurately drawn”" }).uncheck();
  expect(await texts(page)).not.toContain("Diagram NOT accurately drawn");
});

test("adding a corner splits the last side and drops its label; removing one drops the joined sides' labels", async ({ page }) => {
  await boot(page, example("l-shape"));
  await page.getByText("Corners, sides and heights").click();
  await page.getByRole("button", { name: "Remove the last corner" }).click();
  let ids = (await saved(page)).document.labels.map((l: Saved) => l.id);
  expect(ids).not.toContain("e5");
  expect(ids).not.toContain("e6");
  expect(ids).toContain("e4");
  await expect(page.getByRole("status")).toContainText("2 labels have no place on the new shape");
  await page.getByRole("button", { name: "Undo" }).click();
  // A selected side lets go when the sides renumber, so the card never edits a side the teacher did not pick.
  await page.getByRole("button", { name: "Select the label on side 6 (e6)" }).click();
  const card = page.getByRole("region", { name: "Selected label" });
  await expect(card.getByRole("heading")).toHaveText("Label: side 6");
  await page.getByRole("button", { name: "Add a corner" }).click();
  await expect(card.getByRole("heading")).toHaveText("Selected label");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card.getByRole("heading")).toHaveText("Selected label");
  await page.getByRole("button", { name: "Redo" }).click();
  ids = (await saved(page)).document.labels.map((l: Saved) => l.id);
  expect(ids).not.toContain("e6");
  expect(ids).toContain("e5");
  await expect(page.getByRole("status")).toContainText("One label has no place on the new shape");
});
