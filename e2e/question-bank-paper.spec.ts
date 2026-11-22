import { test, expect } from "./release-fixtures";

// Opening one paper whole, in paper order. June 2018 1H is in the lite bank used by pull-request CI.
test.describe("question bank: open a paper", () => {
  test("typing a paper into the search box opens it in paper order, and a topic search leaves it", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?code=U151");
    const search = page.getByRole("combobox", { name: "Sparx code, topic or paper" });
    // Typed straight away, while the catalogue may still be loading: the text must survive the load.
    await search.fill("jun 18 1");
    const list = page.getByRole("listbox", { name: "Suggestions" });
    await expect(list.getByRole("option")).toHaveCount(2);
    await expect(page.locator(".qb-topic h1")).toHaveText("Calculating with speed");
    await expect(search).toHaveValue("jun 18 1");
    await list.getByRole("option", { name: /June 2018 1H/ }).click();
    await expect(page).toHaveURL(/\?paper=1MA1_JUN_2018_1H$/);
    await expect(page.locator(".qb-topic h1")).toHaveText("June 2018 1H");
    await expect(page.locator(".qb-topic h1")).toBeFocused();
    await expect(page.locator(".qb-scope")).toContainText("80 marks");
    await expect(page.locator(".qb-source-heading strong")).toHaveText("June 2018 1H Q1");
    // Filters step aside while a paper is open.
    await expect(page.locator(".qb-filters")).toHaveCount(0);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator(".qb-source-heading strong")).toHaveText("June 2018 1H Q2");
    // Enter on a typed paper opens it; the keyboard can choose a topic.
    await search.fill("N23 2H");
    await search.press("Enter");
    await expect(page.locator(".qb-topic h1")).toHaveText("November 2023 2H");
    await search.fill("U151");
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(/\?code=U151/);
    await expect(page.locator(".qb-filters")).toHaveCount(1);
  });

  test("Browse all papers lists every paper", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank");
    await page.getByRole("combobox", { name: "Sparx code, topic or paper" }).focus();
    await page.getByRole("button", { name: /Browse all \d+ papers/ }).click();
    const all = page.getByRole("group", { name: "All papers" });
    await expect(all.getByRole("button")).toHaveCount(150);
    // The keyboard lands in the grid, and Escape returns to the search box.
    await expect(all.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(all).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Sparx code, topic or paper" })).toBeFocused();
    await page.getByRole("button", { name: /Browse all \d+ papers/ }).click();
    await all.getByRole("button", { name: "Mock Set 6 3F" }).click();
    await expect(page.locator(".qb-topic h1")).toHaveText("Mock Set 6 3F");
  });

  test("a question's source opens its paper at that question", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?code=U151&question=1MA1_JUN_2018_1H_Q4");
    await page.getByRole("button", { name: "June 2018 1H Q4" }).click();
    await expect(page).toHaveURL(/\?paper=1MA1_JUN_2018_1H&question=1MA1_JUN_2018_1H_Q4$/);
    await expect(page.locator(".qb-topic h1")).toHaveText("June 2018 1H");
    await expect(page.locator(".qb-topic h1")).toBeFocused();
    await expect(page.getByText("Question 4 of", { exact: false })).toBeVisible();
  });

  test("Add whole paper puts every question of a Year 11 revision paper into your paper", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?paper=1MA1_NOV_2023_2H");
    await page.locator(".qb-toolbar-actions button[aria-expanded]").click();
    await page.getByRole("button", { name: "Add whole paper" }).click();
    await expect(page.getByRole("region", { name: "Your paper" }).getByRole("status").first()).toContainText("21 distinct questions · 80 marks");
  });

  test("Paper Builder can start from a whole paper", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/question-bank?bankView=topics&tier=F&calc=no");
    const picker = page.getByRole("form", { name: "Start from a paper" });
    await picker.getByLabel("Series").selectOption("November 2023");
    await picker.getByLabel("Paper").selectOption("2");
    await picker.getByLabel("Tier").selectOption("H");
    await picker.getByRole("button", { name: "Add paper" }).click();
    await expect(page.getByText("November 2023 2H added to your paper. Filters were cleared so the whole paper shows.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Your paper" }).getByRole("status").first()).toContainText("21 distinct questions · 80 marks");
    // The paper keeps its own question order.
    await expect(page.locator(".qb-paper-list li strong").first()).toHaveText("November 2023 2H Q1");
    await expect(page.locator(".qb-paper-list li strong").nth(1)).toHaveText("November 2023 2H Q2");
  });

  test("a link to a paper that is not in the bank says so", async ({ page }) => {
    await page.goto("/question-bank?paper=1MA1_NOV_2099_2H");
    await expect(page.getByRole("heading", { name: "That paper was not found" })).toBeVisible();
  });
  test("an old topic code in a link shows its new code in the search box", async ({ page }) => {
    await page.goto("/question-bank?code=U449");
    await expect(page.locator(".qb-topic .qb-code, .qb-topic").first()).toContainText("U499");
    await expect(page.getByRole("combobox", { name: "Sparx code, topic or paper" })).toHaveValue("U499");
  });
});
