// Home, the start page (docs/tools/APP-HOUSE-STYLE.md): one search box, the work to carry on
// with, the six pages as a row called Tools, and favourite diagram tools as much smaller cards.
import { test, expect, type Page } from "./release-fixtures";

const home = (page: Page) => page.getByRole("main", { name: "Home", exact: true });
const search = (page: Page) => home(page).getByRole("searchbox", { name: "Search MathsDock", exact: true });
const results = (page: Page) => home(page).getByRole("list", { name: "Search results", exact: true }).getByRole("link");
const carryOn = (page: Page) => home(page).getByRole("region", { name: /^Carry on/ });

test("a first visit shows the search, six Tools cards in one row and how to add favourites", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(home(page).getByRole("heading", { level: 1, name: "What do you need today?", exact: true })).toBeVisible();
  await expect(search(page)).toBeVisible();
  // Nothing has been changed on this device yet, so there is nothing to carry on with.
  await expect(carryOn(page)).toHaveCount(0);
  const tools = home(page).getByRole("region", { name: "Tools", exact: true }).getByRole("link");
  await expect(tools).toHaveCount(6);
  const boxes = await tools.evaluateAll((cards) => cards.map((card) => { const b = card.getBoundingClientRect(); return { top: Math.round(b.top), height: Math.round(b.height) }; }));
  expect(new Set(boxes.map((b) => b.top)).size, "one row").toBe(1);
  expect(new Set(boxes.map((b) => b.height)).size, "equal heights").toBe(1);
  await expect(home(page).getByRole("region", { name: /^Favourites/ })).toContainText("No favourites yet");
  expect(await page.evaluate(() => document.documentElement.scrollHeight), "fits a 1920 x 1080 window").toBeLessThanOrEqual(1080);
});

for (const [width, height, columns] of [[1080, 1920, 3], [600, 900, 2], [390, 844, 1]] as const)
  test(`at ${width} px wide the Tools cards sit ${columns} to a row and nothing spills sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(home(page).locator(".home-tool")).toHaveCount(6);
    const tops = await home(page).locator(".home-tool").evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top)));
    expect(tops.filter((top) => top === tops[0])).toHaveLength(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

test("search finds tools by topic and pages by name, and works from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(search(page)).toBeVisible();
  await page.keyboard.press("/");
  await expect(search(page)).toBeFocused();
  await page.keyboard.type("pyth");
  await expect(results(page)).toHaveCount(1);
  await expect(results(page)).toContainText(["Triangles"]);
  await expect(results(page).first()).toContainText("Matches “Pythagoras”");
  await expect(home(page).getByRole("status")).toHaveText("1 result");
  // Down moves into the results, Up comes back, and Escape clears the search.
  await page.keyboard.press("ArrowDown");
  await expect(results(page).first()).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(0);
  await search(page).fill("booklet");
  await expect(results(page).first()).toContainText("Booklet builder");
  await search(page).fill("not-a-teaching-tool");
  await expect(home(page).getByText(/^Nothing found\./)).toBeVisible();
  // Enter opens the first result.
  await search(page).fill("venn");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/venn$/);
});

test("a Sparx code typed into the search opens its questions in the Question bank", async ({ page }) => {
  await page.goto("/");
  await search(page).fill("u538");
  await expect(results(page).first()).toContainText("Sparx code U538");
  await results(page).first().click();
  await expect(page).toHaveURL(/\/question-bank\?code=U538$/);
});

test("Carry on lists a diagram once it has been changed, newest first, and opens it again", async ({ page }) => {
  // Opening a tool is not a change.
  await page.goto("/tools/venn");
  await expect(page.getByRole("button", { name: "Copy image", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Maths Dock home", exact: true }).click();
  await expect(home(page)).toBeVisible();
  await expect(carryOn(page)).toHaveCount(0);
  for (const tool of ["ratio-table", "value-table-graph"]) {
    await page.goto(`/tools/${tool}`);
    await page.locator(".site-page:not([hidden]) .editor-card").getByRole("button", { name: "Add column", exact: true }).click();
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  }
  await page.getByRole("link", { name: "Maths Dock home", exact: true }).click();
  const cards = carryOn(page).getByRole("link");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Plotting quadratics");
  await expect(cards.nth(1)).toContainText("Ratio tables");
  await expect(cards.nth(1)).toContainText(/Changed today at \d\d:\d\d/);
  // It is kept on this device, so it is still there after a reload.
  await page.reload();
  await expect(cards).toHaveCount(2);
  await cards.nth(1).click();
  await expect(page).toHaveURL(/\/tools\/ratio-table$/);
});

test("Carry on lists the paper being built and drops it when the paper is cleared", async ({ page }) => {
  await page.goto("/question-bank?bankView=topics");
  await page.getByRole("searchbox", { name: "Search codes or topics" }).fill("U538");
  await page.getByRole("checkbox", { name: "Include questions for U538", exact: true }).check();
  await page.getByRole("link", { name: "Maths Dock home", exact: true }).click();
  const paper = carryOn(page).getByRole("link");
  await expect(paper).toHaveCount(1);
  await expect(paper).toContainText("Paper in progress");
  await expect(paper).toContainText("1 Sparx code · changed today");
  await paper.click();
  await expect(page).toHaveURL(/bankView=topics/);
  await page.getByRole("button", { name: "Clear paper", exact: true }).click();
  await page.getByRole("link", { name: "Maths Dock home", exact: true }).click();
  await expect(home(page)).toBeVisible();
  await expect(carryOn(page)).toHaveCount(0);
});

test("a starred diagram tool shows on Home as a card much smaller than a Tools card", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools");
  await page.getByRole("button", { name: "Add Venn diagrams to favourite tools", exact: true }).first().click();
  await page.getByRole("link", { name: "Maths Dock home", exact: true }).click();
  const favourite = home(page).getByRole("region", { name: /^Favourites/ }).getByRole("link", { name: "Venn diagrams", exact: true });
  await expect(favourite).toBeVisible();
  const small = (await favourite.boundingBox())!, large = (await home(page).locator(".home-tool").first().boundingBox())!;
  expect(large.width * large.height).toBeGreaterThan(3 * small.width * small.height);
  await favourite.click();
  await expect(page).toHaveURL(/\/tools\/venn$/);
});
