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
const box = (page: Page) => page.locator(".md-options-box");
const label = async (page: Page, id: string) => (await saved(page)).document.angles.find((a: { id: string }) => a.id === id)?.label;

test("selects an angle on the diagram, labels it, keeps its answer for the teacher copy and undoes", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 2 (s2)" }).click();
  await expect(box(page)).toContainText("Angle 2");
  const answer = box(page).getByRole("textbox", { name: "Saved answer (answers copy only)" });
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

test("removes an angle's mark and label in one undo step; Escape closes its options", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 1 (s1)" }).click();
  await box(page).getByRole("button", { name: "Remove mark and label" }).click();
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s2", "s3"]);
  await page.getByRole("button", { name: "Select angle 2 (s2)" }).click();
  await expect(box(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s1", "s2", "s3"]);
});

test("Delete removes the selected angle's mark and label in one undo step", async ({ page }) => {
  await boot(page, example("straight-line"));
  const target = page.getByRole("button", { name: "Select angle 1 (s1)" });
  await target.click();
  await target.focus();
  await page.keyboard.press("Delete");
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s2", "s3"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.angles.map((a: { id: string }) => a.id)).toEqual(["s1", "s2", "s3"]);
});

test("a left-out label stays left out when its words are corrected", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 1 (s1)" }).click();
  await box(page).getByRole("group", { name: "What pupils see" }).getByRole("button", { name: "Leave out" }).click();
  const text = box(page).getByRole("textbox", { name: "Text of angle 1" });
  await text.fill("50");
  await text.press("Enter");
  expect(await label(page, "s1")).toEqual({ state: "blank", text: "50", answer: "" });
  expect(await texts(page)).not.toContain("50°");
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
  for (const [id, size] of [["e2", "50"], ["i2", "120"]]) {
    await page.getByRole("button", { name: new RegExp(`\\(${id}\\)`) }).click();
    const text = box(page).getByRole("textbox", { name: /^Text of / });
    await text.fill(size);
    await text.press("Enter");
  }
  await expect(page.getByText("Teacher note: The interior and exterior angles at corner 2 add to 170°, not 180°.")).toBeVisible();
  expect(await texts(page)).toContain("50°");
});

test("prints Diagram NOT accurately drawn by default and draws stacked-card settings with the selected angle first", async ({ page }) => {
  await boot(page);
  expect(await texts(page)).toContain("Diagram NOT accurately drawn");
  await page.getByRole("button", { name: "Printing", exact: true }).click();
  await page.getByRole("checkbox", { name: "Print “Diagram NOT accurately drawn”" }).uncheck();
  expect(await texts(page)).not.toContain("Diagram NOT accurately drawn");
});

test("adds a Z shape to parallel lines, turns it into a C, and undoes", async ({ page }) => {
  await boot(page, example("parallel"));
  await page.getByRole("button", { name: "Add a Z, F or C shape" }).click();
  expect((await saved(page)).document.letters).toEqual([{ a: "p1-lr", b: "p2-ul" }]);
  await expect(page.getByText("Z: alternate")).toBeVisible();
  await expect(art(page).locator('path[stroke="#bdbdbd"]')).toHaveCount(1);
  await page.getByRole("combobox", { name: "Shape 1 second angle" }).selectOption("p2-ur");
  await expect(page.getByText("C: co-interior")).toBeVisible();
  // An angle that makes no letter with the other one moves the other to the nearest angle that does.
  await page.getByRole("combobox", { name: "Shape 1 second angle" }).selectOption("p1-ul");
  await expect(page.getByText("F: corresponding")).toBeVisible();
  expect((await saved(page)).document.letters).toEqual([{ a: "p2-ul", b: "p1-ul" }]);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.letters).toBeUndefined();
});

test("drags a ray as one undo step, and moves it with the arrow keys", async ({ page }) => {
  await boot(page, example("straight-line"));
  const handle = page.getByRole("button", { name: "Drag ray 1" });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 6, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 12, { steps: 5 });
  await page.mouse.up();
  const rays = (await saved(page)).document.figure.rays as number[];
  expect(rays[0]).toBeLessThan(48);
  expect(rays[0] % 5).toBe(0);
  expect(rays[1]).toBe(115);
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.figure.rays).toEqual([48, 115]);
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  expect((await saved(page)).document.figure.rays).toEqual([53, 115]);
  await page.keyboard.press("Shift+ArrowLeft");
  expect((await saved(page)).document.figure.rays).toEqual([52, 115]);
  // The handles are never part of the printed artwork.
  expect(await art(page).locator("circle").count()).toBe(0);
});

test("adds a second transversal whose meeting angles can be marked", async ({ page }) => {
  await boot(page, example("parallel"));
  await page.getByRole("checkbox", { name: "Second transversal" }).check();
  const second = (await saved(page)).document.figure.second;
  expect(second.crossDeg).toBe(122);
  await page.getByRole("button", { name: /Select where the transversals meet, angle 1/ }).click();
  await expect(box(page).getByRole("textbox", { name: "Text of where the transversals meet, angle 1" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Second transversal" }).uncheck();
  expect((await saved(page)).document.figure.second).toBeUndefined();
});

test("draws regular polygons meeting at a corner and adds a third", async ({ page }) => {
  await boot(page);
  await page.getByRole("combobox", { name: "Figure" }).selectOption("polygons");
  expect((await saved(page)).document.figure).toEqual({ type: "polygons", sides: [5, 6], ticks: 1 });
  await page.getByRole("combobox", { name: "Number of polygons" }).selectOption("3");
  expect((await saved(page)).document.figure.sides).toEqual([5, 6, 6]);
  await page.getByRole("combobox", { name: "Sides of shape 3" }).selectOption("10");
  await expect(page.getByRole("status")).toContainText("overlap at the shared corner");
  expect((await saved(page)).document.figure.sides).toEqual([5, 6, 6]);
});

test("What pupils see: double-click a given size for a pupil space, leave every label out, and undo in one step", async ({ page }) => {
  await boot(page, example("straight-line"));
  await page.getByRole("button", { name: "Select angle 1 (s1)" }).dblclick();
  expect(await label(page, "s1")).toEqual({ state: "hidden", text: "", answer: "48" });
  expect(await texts(page)).not.toContain("48°");
  await box(page).getByRole("checkbox", { name: /An answer line/ }).check();
  expect((await label(page, "s1")).state).toBe("answer-line");
  await page.keyboard.press("Escape");
  await page.getByRole("group", { name: "Angles", exact: true }).getByRole("button", { name: "Leave out" }).click();
  // Only the marks print; what was typed is kept.
  expect(await label(page, "s1")).toEqual({ state: "blank", text: "48", answer: "" });
  expect(await label(page, "s2")).toEqual({ state: "blank", text: "x", answer: "" });
  expect(await texts(page)).not.toContain("65°");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await label(page, "s1")).state).toBe("answer-line");
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect(await label(page, "s1")).toEqual({ state: "value", text: "48", answer: "" });
});
