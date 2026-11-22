import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/algebra-tile-core/src";
import { examples } from "../packages/algebra-tile-core/src/examples";

const key = "maths-booklet-tools:algebra-tiles:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/algebra-tiles");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("algebra-tiles-resource").locator("svg");
const counts = (d: { terms: { count: number }[] }) => d.terms.map((t) => t.count);

test("types the tiles, collects only when asked, hides the answer and undoes", async ({ page }) => {
  await boot(page, create("x + 1"));
  const tiles = page.getByRole("textbox", { name: "Tiles for" });
  await tiles.fill("3a + 2b - a + ab^2");
  await tiles.press("Enter");
  const d = (await saved(page)).document;
  expect(d.letters).toEqual({ long: "a", short: "b" });
  expect(counts(d)).toEqual([3, 2, -1, 1]);
  expect(d.answer).toBeNull();
  // Four kinds of tile, as written: three a strips, two b strips, a negative a strip and an ab² block.
  await expect(art(page).locator("text", { hasText: /^a$/ })).toHaveCount(4);
  await page.getByRole("button", { name: "Expression and answer", exact: true }).click();
  await page.getByLabel("Simplified answer (after =)").check();
  await page.getByRole("button", { name: "Collect like terms" }).click();
  expect((await saved(page)).document.answer).toEqual({ text: "2a + 2b + ab²", show: "hidden" });
  await expect(art(page).locator("text", { hasText: "+ 2" })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: "+ 2" })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(counts((await saved(page)).document)).toEqual([1, 1]);
});

test("edits one term in its options box and notes a wrong answer", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "a2b-ab2")!.make(false));
  await page.getByRole("button", { name: /^Edit the term 2/ }).click();
  const box = page.locator(".md-options-box");
  const tile = box.getByRole("textbox", { name: /^Tile of the term 2/ });
  await expect(tile).toBeFocused();
  await tile.fill("a^2b");
  await tile.press("Enter");
  expect((await saved(page)).document.terms[1]).toMatchObject({ long: 2, short: 1 });
  await box.getByRole("textbox", { name: "How many" }).fill("-2");
  await box.getByRole("textbox", { name: "How many" }).press("Enter");
  expect((await saved(page)).document.terms[1].count).toBe(-2);
  await expect(page.getByText(/Teacher note: The answer a²b \+ 3ab² does not match the tiles/)).toBeVisible();
  await box.getByRole("group", { name: "What pupils see" }).getByRole("button", { name: "Pupil space" }).click();
  expect((await saved(page)).document.terms[1].show).toBe("hidden");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("combobox", { name: "Arrangement" }).selectOption("grouped");
  expect((await saved(page)).document.arrangement).toBe("grouped");
});

test("What pupils see: double-click for a pupil space, leave a line out, and undo in one step", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "a2b-ab2")!.make(false));
  await page.getByRole("button", { name: /^Edit the term 1/ }).dblclick();
  expect((await saved(page)).document.terms[0].show).toBe("hidden");
  await page.getByRole("group", { name: "Expression and answer" }).getByRole("button", { name: "Leave out" }).click();
  const d = (await saved(page)).document;
  for (const item of ["expression", "answer"] as const) if (d[item]) expect(d[item].show).toBe("omit");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.terms[0].show).toBe("hidden");
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.terms.every((t: { show: string }) => t.show === "show")).toBe(true);
});
