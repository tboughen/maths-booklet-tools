import { test, expect } from "@playwright/test";
import { canonical, create } from "../packages/number-line-core/src";

const key = "maths-booklet-tools:number-line:v1";
const saved = (page: import("@playwright/test").Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

test("adds a percentage bar, leaves an answer line for pupils, keeps label states when the range changes and undoes (U109)", async ({ page }) => {
  const blank = canonical(create({ axis: { minimum: "0", maximum: "40", step: "4", variable: "" } }));
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, blank]);
  await page.goto("/tools/number-line");
  const art = page.getByTestId("number-line-resource").locator("svg");
  await page.getByRole("button", { name: "Add a second scale" }).click();
  await expect(art.locator("rect[data-bar]")).toHaveCount(1);
  await expect(art.locator("text", { hasText: /^30%$/ })).toHaveCount(1);
  await page.getByLabel("Second-scale label 30%").selectOption("answer-line");
  await expect(art.locator("text", { hasText: /^30%$/ })).toHaveCount(0);
  expect((await saved(page)).document.secondary.labels).toEqual({ "30": "answer-line" });

  // £40 instead of 100%: the fourth tick keeps its answer line.
  const unit = page.getByRole("textbox", { name: "Unit", exact: true });
  await unit.fill("£");
  await unit.press("Enter");
  await page.getByLabel("Unit position").selectOption("before");
  const last = page.getByRole("textbox", { name: "Last value", exact: true });
  await last.fill("40");
  await last.press("Enter");
  expect((await saved(page)).document.secondary).toMatchObject({ unit: "£", unitPlace: "before", maximum: "40", labels: { "12": "answer-line" } });
  await page.getByLabel("Second scale style").selectOption("line");
  await expect(art.locator("rect[data-bar]")).toHaveCount(0);
  await expect(art.locator("text", { hasText: /^£16$/ })).toHaveCount(1);

  await page.getByRole("button", { name: "Remove second scale" }).click();
  expect((await saved(page)).document.secondary).toBeUndefined();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.secondary.style).toBe("line");
});
