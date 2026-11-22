import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/factor-tree-core/src";
import { examples } from "../packages/factor-tree-core/src/examples";

const key = "maths-booklet-tools:factor-tree:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/factor-tree");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("factor-tree-resource").locator("svg");
const tree = (d: { trees: { nodes: { value: { text: string } }[] }[] }, i = 0) => d.trees[i].nodes.map((n) => n.value.text);

test("splits a number from the tree, hides and circles a factor, and undoes", async ({ page }) => {
  await boot(page, create("60"));
  await page.getByRole("button", { name: "Edit the number at top 60" }).click();
  // The options box opens with the number selected, ready to type (typing first, 22 Nov 2026).
  await expect(page.getByRole("textbox", { name: "Text of the number at top 60" })).toBeFocused();
  await page.getByRole("textbox", { name: "First factor" }).fill("6");
  await page.getByRole("textbox", { name: "Second factor" }).fill("10");
  await page.getByRole("button", { name: "Split into two" }).click();
  expect(tree((await saved(page)).document)).toEqual(["60", "6", "10"]);
  const ten = page.getByRole("button", { name: "Edit the number at level 1 10" });
  await ten.click();
  await page.keyboard.type("12");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Teacher note: 6 × 12 is 72, not 60.")).toBeVisible();
  // A double-click makes it a pupil space; the box stays open for the circle.
  await page.getByRole("button", { name: /^Edit the number at level 1 12/ }).dblclick();
  await page.getByLabel("Circle this number").check();
  expect((await saved(page)).document.trees[0].nodes[2]).toEqual({ id: "n3", parent: "n1", value: { text: "12", show: "hidden" }, circled: true });
  // Hidden: neither the number nor its circle is on the pupil copy.
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(0);
  await expect(art(page).locator("circle")).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^12$/ })).toHaveCount(1);
  await expect(art(page).locator("circle")).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(tree((await saved(page)).document)).toEqual(["60"]);
});

test("completes the trees only when asked and keeps the answers hidden", async ({ page }) => {
  await boot(page, create("90"));
  expect((await saved(page)).document.trees[0].product).toEqual({ text: "", show: "show" });
  await page.getByRole("button", { name: "Complete the trees", exact: true }).click();
  await page.getByRole("button", { name: "Complete trees" }).click();
  const t = (await saved(page)).document.trees[0];
  expect(t.product).toEqual({ text: "2 × 3^2 × 5", show: "hidden" });
  expect(t.nodes.filter((n: { circled?: boolean }) => n.circled).length).toBe(4);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("tspan")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(tree((await saved(page)).document)).toEqual(["90"]);
});

test("types an answer in any common form and adds a second tree", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "complete-360")!.make(false));
  const answer = page.getByRole("textbox", { name: "Answer for the tree" });
  await answer.fill("2³ x 3² * 5");
  await answer.press("Enter");
  expect((await saved(page)).document.trees[0].product.text).toBe("2^3 × 3^2 × 5");
  // Each answer line has its own What pupils see.
  await page.getByRole("group", { name: "What pupils see of the answer for the tree" }).getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.trees[0].product.show).toBe("omit");
  await page.getByRole("button", { name: "+ Tree for the same number" }).click();
  const d = (await saved(page)).document;
  expect(d.trees).toHaveLength(2);
  expect(tree(d, 1)).toEqual(["360"]);
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("combobox", { name: "Blanks" }).selectOption("box");
  expect((await saved(page)).document.blankStyle).toBe("box");
});

test("what pupils see: number and answer-line switches, leave out prints nothing, a blank stays a space", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "complete-360")!.make(false));
  const numbers = page.getByRole("group", { name: "Numbers" });
  await numbers.getByRole("button", { name: "Pupil space" }).click();
  const d = (await saved(page)).document;
  // Blank numbers have no answer, so they stay plain spaces.
  expect(d.trees[0].nodes.every((n: { value: { text: string; show: string } }) => (n.value.text ? n.value.show === "hidden" : n.value.show === "show"))).toBe(true);
  await numbers.getByRole("button", { name: "Leave out" }).click();
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^360$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.trees[0].nodes.every((n: { value: { show: string } }) => n.value.show === "show")).toBe(true);
});
