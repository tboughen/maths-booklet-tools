// The tool switcher (docs/tools/APP-HOUSE-STYLE.md): a diagram tool's name opens search,
// favourite tools and every tool by strand. It must work with the keyboard alone.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const shown = (page: Page) => page.locator(".site-page:not([hidden])");
const button = (page: Page) => shown(page).locator(".tool-switcher-button");
const panel = (page: Page) => page.getByRole("dialog", { name: "Switch diagram tool" });

test("the keyboard opens the switcher, searches by topic and opens the first tool found", async ({ page }) => {
  await page.goto("/tools/graph");
  await button(page).focus();
  await page.keyboard.press("Enter");
  await expect(panel(page).getByRole("searchbox", { name: "Find a tool or topic" })).toBeFocused();
  await page.keyboard.type("pythag");
  await expect(panel(page).locator(".tool-switcher-groups").getByRole("link")).toHaveCount(1);
  await expect(panel(page).getByRole("status")).toHaveText("1 tool found");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/triangle$/);
  await expect(page.getByRole("heading", { level: 1, name: "Triangles" })).toBeFocused();
  // Going back finds the switcher closed and the search cleared.
  await page.goBack();
  await expect(panel(page)).toHaveCount(0);
});

test("arrow keys move through the tools, and Escape closes the switcher and returns focus", async ({ page }) => {
  await page.goto("/tools/graph");
  await button(page).click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Bar modelling");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Ratio tables");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(panel(page).getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(button(page)).toBeFocused();
  await expect(button(page)).toHaveAttribute("aria-expanded", "false");
  // A click elsewhere closes it too.
  await button(page).click();
  await expect(panel(page)).toBeVisible();
  await page.locator(".site-brand").hover();
  await page.mouse.click(5, 400);
  await expect(panel(page)).toHaveCount(0);
});

test("a starred tool waits in the switcher and on the Diagram builder page", async ({ page }) => {
  await page.goto("/tools/venn");
  await shown(page).getByRole("button", { name: "Add Venn diagrams to favourite tools" }).click();
  await expect(shown(page).getByRole("button", { name: "Remove Venn diagrams from favourite tools" })).toHaveAttribute("aria-pressed", "true");
  await button(page).click();
  await panel(page).getByRole("link", { name: "Graph tool", exact: true }).click();
  await button(page).click();
  await panel(page).getByRole("list", { name: "Favourite tools" }).getByRole("link", { name: "Venn diagrams" }).click();
  await expect(page).toHaveURL(/\/tools\/venn$/);
  await shown(page).locator(".tool-switcher-crumb").click();
  await expect(page.getByRole("heading", { level: 1, name: "Diagram builder" })).toBeVisible();
  await expect(shown(page).locator(".tool-favourites").getByRole("link", { name: "Open Venn diagrams" })).toBeVisible();
});

// 1000 px is the narrowest window that still shows four columns.
for (const width of [1920, 1000, 820, 390])
  test(`the open switcher stays inside the window at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 900 });
    await page.goto("/tools/sample-space");
    await button(page).click();
    const box = (await panel(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(width === 1920 ? 1080 : 900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

test("keys pressed in the open switcher never reach the diagram behind it", async ({ page }) => {
  const key = "maths-booklet-tools:graph-envelope:v1";
  const shape = async () => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), key)) ?? "null")?.document?.objects[0];
  await page.goto("/tools/graph");
  await page.evaluate((k) => localStorage.removeItem(k), key);
  await page.reload();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await expect(page.locator(".graph-canvas .graph-polygon")).toHaveCount(1);
  await expect.poll(async () => (await shape())?.vertices?.length).toBeGreaterThan(2);
  const before = await shape();

  // With the shape still selected, arrows move through the tools and Delete does nothing.
  await button(page).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Ratio tables");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  // A click on a strand heading keeps the keys inside the switcher.
  await panel(page).getByRole("heading", { name: "Geometry" }).click();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Bar modelling");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator(".graph-canvas .graph-polygon")).toHaveCount(1);
  expect(await shape()).toEqual(before);

  // The shape is still selected: once the switcher is closed the arrow moves it again.
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await shape())?.vertices[0].x).toBe(before.vertices[0].x + 0.5);
});

test("a search of spaces alone changes nothing, and the open switcher passes under the app bar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/tools/graph");
  await button(page).click();
  await page.keyboard.type("  ");
  await expect(panel(page).getByRole("status")).toHaveText("");
  await expect(panel(page).locator(".tool-switcher-favourites")).toBeVisible();
  await expect(panel(page).locator("a.is-first")).toHaveCount(0);
  const [bar, pop] = await page.evaluate(() => [".site-navigation", ".tool-switcher-panel"].map((s) => Number(getComputedStyle(document.querySelector(s)!).zIndex)));
  expect(pop).toBeLessThan(bar);
});

test("the switcher has no serious accessibility violations closed, open, searching or on a phone", async ({ page }) => {
  const found: string[] = [];
  const scan = async (state: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    found.push(...violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${state}: ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`));
  };
  await page.goto("/tools/venn");
  await shown(page).getByRole("button", { name: "Add Venn diagrams to favourite tools" }).click();
  await scan("closed");
  await button(page).click();
  await scan("open");
  await page.keyboard.type("pythag");
  await expect(panel(page).locator("a.is-first")).toHaveCount(1);
  await scan("searching");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 720 });
  await button(page).click();
  await scan("open at 320 px");
  expect(found).toEqual([]);
});

test("the search box fills the switcher in Bar modelling, whose own labels stack", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/bar-model");
  await button(page).click();
  const box = panel(page).getByRole("searchbox", { name: "Find a tool or topic" });
  await expect(box).toBeFocused();
  expect((await box.boundingBox())!.width).toBeGreaterThan(800);
});

// The same finder drops down under the Diagram builder's own search box (Tim's choice, 17 November 2026).
const listSearch = (page: Page) => page.getByRole("searchbox", { name: "Search tools" });
const listFinder = (page: Page) => page.getByRole("region", { name: "Every diagram tool" });

test("a click in the Diagram builder's search box drops the same finder down, and its search opens the first tool found", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools");
  await expect(listFinder(page)).toHaveCount(0);
  await listSearch(page).click();
  await expect(listFinder(page)).toBeVisible();
  // Every tool, in a column for each strand, in the scheme's order, with the favourites line above.
  await expect(listFinder(page).locator(".tool-switcher-groups").getByRole("link")).toHaveCount(27);
  await expect(listFinder(page).getByRole("heading", { level: 2 })).toHaveText(["Number and proportion", "Algebra", "Geometry and measure", "Statistics and probability"]);
  await expect(listFinder(page).locator(".tool-switcher-favourites")).toBeVisible();
  // It hangs from the search box, inside the window, and has no search box of its own.
  const box = (await listSearch(page).boundingBox())!, pop = (await listFinder(page).boundingBox())!;
  expect(pop.y).toBeGreaterThanOrEqual(box.y + box.height);
  expect(pop.y - (box.y + box.height)).toBeLessThan(12);
  expect(Math.abs(pop.x - box.x)).toBeLessThan(4);
  expect(pop.x + pop.width).toBeLessThanOrEqual(1920);
  await expect(listFinder(page).getByRole("searchbox")).toHaveCount(0);
  // One search works the finder and the pictures behind it, and the page says the count once.
  await page.keyboard.type("pythag");
  await expect(listFinder(page).locator(".tool-switcher-groups").getByRole("link")).toHaveCount(1);
  await expect(listFinder(page).locator("a.is-first")).toContainText("Triangles");
  await expect(page.locator(".overview-tool-card")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("1 tool found");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tools\/triangle$/);
  // Going back finds the finder closed.
  await page.goBack();
  await expect(shown(page).getByRole("heading", { level: 1, name: "Diagram builder" })).toBeVisible();
  await expect(listFinder(page)).toHaveCount(0);
});

test("the finder on the Diagram builder works with the keyboard alone and closes without losing the search", async ({ page }) => {
  await page.goto("/tools");
  // The / key goes to the search box, and that opens the finder.
  await page.keyboard.press("/");
  await expect(listSearch(page)).toBeFocused();
  await expect(listFinder(page)).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Bar modelling");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Ratio tables");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(listSearch(page)).toBeFocused();
  // Escape closes the finder and keeps the search, so the pictures behind are the ones it found.
  await page.keyboard.type("angles");
  await expect(listFinder(page).locator(".tool-switcher-groups").getByRole("link")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(listFinder(page)).toHaveCount(0);
  await expect(listSearch(page)).toBeFocused();
  await expect(listSearch(page)).toHaveValue("angles");
  await expect(page.locator(".overview-tool-card")).toHaveCount(5);
  // More typing filters the pictures and leaves the finder closed. The down arrow brings it back.
  await page.keyboard.type(" on");
  await expect(listFinder(page)).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(listFinder(page)).toBeVisible();
  // Tabbing out of it, or a click elsewhere, closes it. The pictures can then be clicked.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(listFinder(page)).toHaveCount(0);
  await listSearch(page).click();
  await expect(listFinder(page)).toBeVisible();
  await page.mouse.click(1200, 700);
  await expect(listFinder(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".overview-tool-card")).toHaveCount(27);
  // A tool chosen with the mouse opens, and the finder is closed on the way back.
  await listSearch(page).click();
  await listFinder(page).getByRole("link", { name: "Venn diagrams" }).click();
  await expect(page).toHaveURL(/\/tools\/venn$/);
  await page.goBack();
  await expect(listFinder(page)).toHaveCount(0);
});

test("the finder on the Diagram builder has no serious accessibility violations and fits a phone", async ({ page }) => {
  const found: string[] = [];
  const scan = async (state: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    found.push(...violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${state}: ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`));
  };
  await page.goto("/tools");
  await listSearch(page).click();
  await expect(listFinder(page)).toBeVisible();
  await scan("open");
  await page.keyboard.type("pythag");
  await expect(listFinder(page).locator("a.is-first")).toHaveCount(1);
  await scan("searching");
  await page.keyboard.press("Escape");
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 720 });
    await listSearch(page).click();
    const pop = (await listFinder(page).boundingBox())!;
    expect(pop.x, `${width}`).toBeGreaterThanOrEqual(0);
    expect(pop.x + pop.width, `${width}`).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}`).toBe(true);
    await scan(`open at ${width} px`);
    await page.keyboard.press("Escape");
  }
  expect(found).toEqual([]);
});
