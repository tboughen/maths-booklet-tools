import { test, expect } from "./release-fixtures";

// Opening one paper whole, in paper order. June 2018 1H is in the lite bank used by pull-request CI.
test.describe("question bank: open a paper", () => {
  test("the picker opens a paper in paper order, and a topic search leaves it", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?code=U151");
    const picker = page.getByRole("form", { name: "Open a paper" });
    await picker.getByLabel("Series").selectOption("June 2018");
    await picker.getByLabel("Paper").selectOption("1");
    await picker.getByLabel("Tier").selectOption("H");
    await picker.getByRole("button", { name: "Open" }).click();
    await expect(page).toHaveURL(/\?paper=1MA1_JUN_2018_1H$/);
    await expect(page.locator(".qb-topic h1")).toHaveText("June 2018 1H");
    await expect(page.locator(".qb-scope")).toContainText("80 marks");
    await expect(page.locator(".qb-source-heading strong")).toHaveText("June 2018 1H Q1");
    // Filters step aside while a paper is open.
    await expect(page.locator(".qb-filters")).toHaveCount(0);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator(".qb-source-heading strong")).toHaveText("June 2018 1H Q2");
    await page.getByLabel("Sparx code or topic").fill("U151");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page).toHaveURL(/\?code=U151/);
    await expect(page.locator(".qb-filters")).toHaveCount(1);
  });

  test("a question's source opens its paper at that question", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?code=U151&question=1MA1_JUN_2018_1H_Q4");
    await page.getByRole("button", { name: "June 2018 1H Q4" }).click();
    await expect(page).toHaveURL(/\?paper=1MA1_JUN_2018_1H&question=1MA1_JUN_2018_1H_Q4$/);
    await expect(page.locator(".qb-topic h1")).toHaveText("June 2018 1H");
    await expect(page.getByText("Question 4 of", { exact: false })).toBeVisible();
  });

  test("a link to a paper that is not in the bank says so", async ({ page }) => {
    await page.goto("/question-bank?paper=1MA1_NOV_2099_2H");
    await expect(page.getByRole("heading", { name: "That paper was not found" })).toBeVisible();
  });
});
