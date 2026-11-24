// Resource library (docs/content/RESOURCE-LIBRARY.md): years, units in teaching order, the chosen
// unit's resources on the right, a search above and a Map view. The list is served behind staff
// sign-in, so these checks stand in a copy of it (e2e/fixtures/library.json).
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "./release-fixtures";

const fixture = readFileSync(new URL("./fixtures/library.json", import.meta.url), "utf8");
async function open(page: Page, address = "/library") {
  await page.route("**/library-data/library.json", (route) => route.fulfill({ contentType: "application/json", body: fixture }));
  await page.route("**/library-data/files/**", (route) => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.7" }));
  await page.goto(address);
  return page.getByRole("main");
}

test("a year shows its units in teaching order and a unit shows its resources, answers in pink and drafts flagged", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const main = await open(page);
  await expect(main.getByRole("heading", { level: 1, name: "Resource library" })).toBeVisible();
  await main.getByRole("navigation", { name: "Years" }).getByRole("button", { name: /^Year 9/ }).click();
  const units = main.getByRole("region", { name: "Year 9 units" });
  await expect(units.getByRole("heading", { name: "Spring term" })).toBeVisible();
  await expect(units.locator(".library-unit-code").first()).toHaveText("NP13");
  await expect(units.getByRole("button", { name: /^A8/ })).toHaveClass(/is-empty/);
  await units.getByRole("button", { name: /^A7/ }).click();
  await expect(page).toHaveURL(/\/library\?year=9&unit=A7$/);
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  await expect(detail.getByRole("heading", { level: 2 })).toHaveText("A7 Algebraic proficiency: visualising");
  const rows = detail.locator(".library-rows > li");
  await expect(rows.first()).toContainText("Whole unit");
  await expect(rows.nth(1)).toContainText("A7.00");
  const ready = detail.locator(".library-resource").filter({ hasText: "A3 worksheet" }).filter({ has: page.locator(".is-ready") }).first();
  await expect(ready).toBeVisible();
  const waiting = detail.locator(".library-resource.is-waiting").first();
  await expect(waiting.getByText("Waiting for check")).toBeVisible();
  expect(await waiting.evaluate((el) => getComputedStyle(el).borderLeftColor)).not.toBe("rgba(0, 0, 0, 0)");
  const answers = detail.getByRole("link", { name: "Answers PDF" }).first();
  expect(await answers.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(176, 18, 91)");
  await expect(answers).toHaveAttribute("href", /^\/library-data\/files\/[a-f0-9]{64}\//);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.screenshot({ path: test.info().outputPath("library-shelves.png") });

  // The link opens the same unit for a colleague; Back returns to the year.
  await page.goBack();
  await expect(page).toHaveURL(/\/library\?year=9$/);
  await expect(detail).toContainText("Choose a unit");
});

test("search finds resources across years and opens their unit", async ({ page }) => {
  const main = await open(page);
  await expect(main.getByRole("heading", { level: 2, name: "Year 7" })).toBeVisible();
  await page.keyboard.press("/");
  const box = main.getByRole("searchbox", { name: "Search the library" });
  await expect(box).toBeFocused();
  await page.keyboard.type("pie charts");
  const results = main.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("SP8.07");
  await expect(results.getByRole("status")).toHaveText(/^\d+ resources? found$/);
  await results.getByRole("button", { name: /Year 10 · SP8/ }).first().click();
  await expect(page).toHaveURL(/year=10&unit=SP8/);
  await expect(main.getByRole("complementary", { name: "Unit resources" }).getByRole("heading", { level: 2 })).toContainText("SP8");
  await box.fill("zzzz");
  await expect(main.getByRole("status")).toContainText("Nothing matches");
});

test("the Map view shows every year's units with what exists, and opens a unit", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const main = await open(page, "/library?view=map");
  const map = main.getByRole("region", { name: "Scheme map" });
  await expect(map.getByRole("heading", { level: 2 })).toHaveText(["Year 7", "Year 8", "Year 9", "Year 10", "Year 11"]);
  await expect(map.getByRole("button", { name: /^SP7 Understanding risk: Booklets, A3 worksheets$/ })).toBeVisible();
  await expect(map.getByRole("button", { name: /^A8 .*: nothing yet$/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("library-map.png") });
  await map.getByRole("button", { name: /^A7 / }).click();
  await expect(page).toHaveURL(/year=9&unit=A7/);
  await expect(main.getByRole("button", { name: "Shelves" })).toHaveAttribute("aria-pressed", "true");
});

test("a list that cannot be loaded says so, and narrow screens do not spill sideways", async ({ page }) => {
  await page.route("**/library-data/library.json", (route) => route.fulfill({ status: 403, body: "" }));
  await page.goto("/library");
  await expect(page.getByRole("alert")).toHaveText("Sign in again to see the library.");
  await page.unroute("**/library-data/library.json");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/library?year=9&unit=A7");
  await expect(page.getByRole("complementary", { name: "Unit resources" })).toContainText("A7.03");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
