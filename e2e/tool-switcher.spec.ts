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

for (const width of [1920, 820, 390])
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
