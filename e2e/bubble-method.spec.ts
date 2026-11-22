import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/bubble-method-core/src";
import { examples } from "../packages/bubble-method-core/src/examples";

const key = "maths-booklet-tools:bubble-method:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/bubble-method");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("bubble-method-resource").locator("svg");

test("types bubbles and a line, makes the line a pupil space and undoes", async ({ page }) => {
  await boot(page, create());
  // A click opens the options box with the text selected, ready to type (typing first, 22 Nov 2026).
  const open = (name: string) => page.getByRole("button", { name: new RegExp(`^Edit the ${name}\\b`) });
  await open("left bubble of step 1").click();
  await expect(page.getByRole("textbox", { name: "Text of the left bubble of step 1" })).toBeFocused();
  await page.keyboard.type("-3");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Write it in both bubbles" }).click();
  expect((await saved(page)).document.steps[0].right.op.text).toBe("-3");
  await expect(art(page).locator("text", { hasText: "−3" })).toHaveCount(2);
  await open("left side of line 2").click();
  await page.keyboard.type("2x");
  await page.keyboard.press("Enter");
  // A double-click makes it a pupil space.
  await open("left side of line 2").dblclick();
  expect((await saved(page)).document.steps[0].line.lhs).toEqual({ text: "2x", show: "hidden" });
  await expect(art(page).locator("text", { hasText: /^x$/ })).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^x$/ })).toHaveCount(2);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await open("right bubble of step 1").click();
  await page.keyboard.type("+3");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Teacher note: The bubbles differ (−3 and +3). Balancing does the same to both sides.")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.steps[0].left.op.text).toBe("");
});

test("adds and removes steps, moves a bubble to a term and turns an inequality sign round", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "subject-formula")!.make(false));
  await page.getByRole("button", { name: "Add a step", exact: true }).click();
  expect((await saved(page)).document.steps).toHaveLength(3);
  await page.getByRole("button", { name: "Remove step 3" }).click();
  expect((await saved(page)).document.steps).toHaveLength(2);
  await page.getByRole("button", { name: /^Edit the right bubble of step 1\b/ }).click();
  await page.getByRole("combobox", { name: "Bubble sits under" }).selectOption("whole");
  expect((await saved(page)).document.steps[0].right.under).toBe("whole");
  await page.getByRole("button", { name: /^Edit the left side of the first line\b/ }).click();
  await page.getByRole("combobox", { name: "Sign" }).selectOption("≤");
  expect((await saved(page)).document.first.rel).toBe("≤");
});

test("what pupils see: a switch per kind, leave out prints no dotted line, clearing pupil spaces is one undo step", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "subject-formula")!.make(false));
  const sides = page.getByRole("group", { name: "Sides of the lines" });
  await sides.getByRole("button", { name: "Leave out" }).click();
  const shows = (d: { first: { lhs: { show: string }; rhs: { show: string } }; steps: { line: { lhs: { show: string }; rhs: { show: string } } }[] }) =>
    new Set([d.first.lhs, d.first.rhs, ...d.steps.flatMap((s) => [s.line.lhs, s.line.rhs])].map((v) => v.show));
  expect(shows((await saved(page)).document)).toEqual(new Set(["omit"]));
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("line[stroke-dasharray]")).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await sides.getByRole("button", { name: "Show" }).click();
  await sides.getByRole("button", { name: "Pupil space" }).click();
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect(shows((await saved(page)).document)).toEqual(new Set(["show"]));
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.first.lhs.show).toBe("hidden");
});
