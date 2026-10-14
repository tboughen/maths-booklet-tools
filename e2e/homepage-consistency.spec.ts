import { test, expect } from "@playwright/test";

const names = ["Question bank", "Paper builder", "Assessment follow-up", "Booklet tools"];
const tagline = "Turn question-level assessment results into personalised practice for each pupil.";
const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Main sections" });

test("home and navigation share four destinations and plain, equally sized cards", async ({ page }) => {
  await page.goto("/?tool=home");
  await expect(nav(page).getByRole("link")).toHaveText(names);
  await expect(page.locator(".overview-card h2")).toHaveText(names);
  await expect(page.locator(".overview-card img")).toHaveCount(0);
  await expect(page.getByText(tagline, { exact: true })).toBeVisible();
  const heights = await page.locator(".overview-card").evaluateAll(cards => cards.map(card => card.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  await page.getByRole("main").getByRole("link").filter({ has: page.getByRole("heading", { name: "Paper builder", exact: true }) }).click();
  await expect(page.getByRole("heading", { name: "Paper builder", exact: true })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Paper builder", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("link", { name: "Question bank", exact: true })).not.toHaveAttribute("aria-current");
});

test("bank and paper builder retain their routes, shared selection, and history independently", async ({ page }) => {
  await page.goto("/?tool=question-bank&code=U332&tier=H");
  await expect(page.getByRole("button", { name: "Select question", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Select question", exact: true }).click();
  const bankUrl = page.url();
  await nav(page).getByRole("link", { name: "Paper builder", exact: true }).click();
  await expect(page.getByLabel("Search codes or topics", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your paper", exact: true }).getByRole("status").first()).toContainText("1 distinct question");
  await page.getByRole("combobox", { name: "Tier", exact: true }).selectOption("F");
  const builderUrl = page.url();
  await expect(page).toHaveTitle("Paper builder Â· Maths Dock");
  await nav(page).getByRole("link", { name: "Question bank", exact: true }).click();
  await expect(page).toHaveURL(bankUrl);
  await expect(page.getByRole("button", { name: "Review paper (1)", exact: true })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Question bank", exact: true })).toHaveAttribute("aria-current", "page");
  await nav(page).getByRole("link", { name: "Paper builder", exact: true }).click();
  await expect(page).toHaveURL(builderUrl);
  await expect(page.getByRole("combobox", { name: "Tier", exact: true })).toHaveValue("F");
  await page.goBack();
  await expect(page).toHaveURL(bankUrl);
  await page.goForward();
  await expect(page).toHaveURL(builderUrl);
  await page.getByRole("button", { name: "Browse questions", exact: true }).click();
  await expect(nav(page).getByRole("link", { name: "Question bank", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveTitle("Question bank Â· Maths Dock");
  await page.getByRole("button", { name: "Build by topic", exact: true }).click();
  await expect(nav(page).getByRole("link", { name: "Paper builder", exact: true })).toHaveAttribute("aria-current", "page");
});

test("four destinations fit desktop and mobile; menus support keyboard navigation", async ({ page }, info) => {
  test.setTimeout(90000);
  for (const width of [1440, 1280, 1201, 1100, 1024, 768, 621, 620, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tool=home");
    if (width <= 620) await page.getByRole("button", { name: "Sections", exact: true }).click();
    await expect(nav(page)).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText(names);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const clipped = await nav(page).getByRole("link").evaluateAll(links => links.filter(link => {
      const rect = link.getBoundingClientRect();
      return rect.left < 0 || rect.right > innerWidth;
    }).map(link => link.textContent));
    expect(clipped).toEqual([]);
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
  }
  await page.keyboard.press("Escape");
  const menu = page.getByRole("button", { name: "Sections", exact: true });
  await expect(menu).toBeFocused();
  await page.keyboard.press("Enter");
  const assessment = nav(page).getByRole("link", { name: "Assessment follow-up", exact: true });
  await assessment.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Assessment follow-up", exact: true })).toBeVisible();
  await expect(page.getByText(tagline, { exact: true })).toBeVisible();
  await expect(nav(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("assessment-320.png"), fullPage: true });
  await page.getByRole("button", { name: "Assessment follow-up", exact: true }).click();
  await nav(page).getByRole("link", { name: "Paper builder", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paper builder", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Paper builder", exact: true }).click();
  await expect(nav(page).getByRole("link", { name: "Paper builder", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
