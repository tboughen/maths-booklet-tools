import { test, expect, type Locator, type Page } from "./release-fixtures";
import { pane, paneSwitch } from "./question-bank-panes";

// A real question from the lite bank used by pull-request CI.
const address = "/question-bank?code=U151&question=1MA1_JUN_2018_1H_Q4";
const level = (page: Page) => page.locator(".qb-footer .qb-zoom output");
// The first page a cold server draws can take longer than the usual five seconds.
const drawn = (page: Page) => expect.poll(() => page.locator(".qb-stage canvas").evaluateAll(nodes => nodes.length > 0 && nodes.every(n => (n as HTMLCanvasElement).width > 0)), { timeout: 15000 }).toBe(true);
const box = async (locator: Locator) => (await locator.boundingBox())!;
const pressed = (page: Page) => page.locator(".qb-source-actions .qb-switch").evaluateAll(nodes => nodes.filter(n => n.getAttribute("aria-pressed") === "true").map(n => n.textContent));

async function open(page: Page, size = { width: 1920, height: 1080 }) {
  await page.setViewportSize(size);
  await page.goto(address);
  await drawn(page);
}

test.describe("question bank panes", () => {
  test("a question opens by itself, and the mark scheme sits beside it when switched on", async ({ page }) => {
    await open(page);
    expect(await pressed(page)).toEqual(["Question"]);
    await expect(page.locator(".qb-pane")).toHaveCount(1);
    await expect(page.locator(".qb-pane-header")).toHaveCount(0);
    // One pane always stays on.
    await paneSwitch(page, "Question").click();
    expect(await pressed(page)).toEqual(["Question"]);
    const alone = await box(pane(page, "Question"));

    await paneSwitch(page, "Mark scheme").click();
    expect(await pressed(page)).toEqual(["Question", "Mark scheme"]);
    await expect(page.locator(".qb-pane-header")).toHaveText(["Question", "Mark scheme"]);
    await drawn(page);
    const [question, scheme] = [await box(pane(page, "Question")), await box(pane(page, "Mark scheme"))];
    // Side by side, the same size, filling the room the question had.
    expect(scheme.y).toBe(question.y);
    expect(Math.abs(scheme.width - question.width)).toBeLessThan(2);
    expect(Math.abs(question.x + question.width - scheme.x)).toBeLessThan(2);
    expect(Math.abs(question.width + scheme.width - alone.width)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Switched off, the question has the room back.
    await paneSwitch(page, "Mark scheme").click();
    await expect(page.locator(".qb-pane")).toHaveCount(1);
    expect((await box(pane(page, "Question"))).width).toBe(alone.width);
  });

  test("each pane has its own zoom, and the footer, keys and image buttons follow the pane last used", async ({ page }) => {
    await open(page);
    await paneSwitch(page, "Mark scheme").click();
    await drawn(page);
    await expect(pane(page, "Mark scheme")).toHaveClass(/qb-pane-active/);
    await expect(page.locator(".qb-navigation")).toContainText("Mark scheme · View 1 of");
    const width = (name: "Question" | "Mark scheme") => pane(page, name).locator("canvas").first().evaluate(c => c.getBoundingClientRect().width);
    const [question, scheme] = [await width("Question"), await width("Mark scheme")];
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(level(page)).toHaveText("125%");
    await expect.poll(() => width("Mark scheme")).toBeCloseTo(scheme * 1.25, 0);
    expect(await width("Question")).toBe(question);

    // Touching the question makes it the pane in use.
    await pane(page, "Question").locator(".qb-pane-header").click();
    await expect(pane(page, "Question")).toHaveClass(/qb-pane-active/);
    await expect(level(page)).toHaveText("100%");
    await page.keyboard.press("=");
    await page.keyboard.press("=");
    await expect(level(page)).toHaveText("150%");
    await expect.poll(() => width("Question")).toBeCloseTo(question * 1.5, 0);
    // The panes share the row, so the mark scheme may redraw while the question grows: wait for it.
    await expect.poll(() => width("Mark scheme")).toBeCloseTo(scheme * 1.25, 0);
    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    expect((await download).suggestedFilename()).toContain("-question-");
    await pane(page, "Mark scheme").locator(".qb-pane-header").click();
    await expect(level(page)).toHaveText("125%");
    download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    expect((await download).suggestedFilename()).toContain("-scheme-");
  });

  test("the keyboard and a pinch choose the pane in use, and a new fit mode resets every pane", async ({ page }) => {
    await open(page);
    await paneSwitch(page, "Mark scheme").click();
    await drawn(page);
    await expect(pane(page, "Mark scheme")).toHaveClass(/qb-pane-active/);
    // Tabbing to a pane makes it the one the keys act on.
    await pane(page, "Question").focus();
    await expect(pane(page, "Question")).toHaveClass(/qb-pane-active/);
    await page.keyboard.press("=");
    await expect(level(page)).toHaveText("125%");
    // Ctrl + wheel over the other pane zooms that pane, and the footer follows it.
    const scheme = await box(pane(page, "Mark scheme").locator(".qb-stage"));
    await page.mouse.move(scheme.x + scheme.width / 2, scheme.y + 60);
    await page.keyboard.down("Control"); await page.mouse.wheel(0, -200); await page.keyboard.up("Control");
    await expect(pane(page, "Mark scheme")).toHaveClass(/qb-pane-active/);
    await expect.poll(async () => parseInt(await level(page).textContent() ?? "0")).toBeGreaterThan(100);
    // The fit mode is shared, so choosing one puts every pane back at fit.
    await page.getByLabel("Fit mode").selectOption("width");
    await expect(level(page)).toHaveText("100%");
    await pane(page, "Question").focus();
    await expect(level(page)).toHaveText("100%");
  });

  test("an answer switched on again opens afresh at fit", async ({ page }) => {
    await open(page);
    await paneSwitch(page, "Mark scheme").click();
    await drawn(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press("=");
    await expect(level(page)).toHaveText("200%");
    const stage = pane(page, "Mark scheme").locator(".qb-stage");
    await stage.evaluate(el => { el.scrollLeft = 120; el.scrollTop = 60; });
    await expect.poll(() => stage.evaluate(el => el.scrollLeft)).toBe(120);
    await paneSwitch(page, "Mark scheme").click();
    await paneSwitch(page, "Mark scheme").click();
    await expect(level(page)).toHaveText("100%");
    await drawn(page);
    expect(await stage.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0]);
    // Zoomed again, it starts from the middle as a first zoom does, not from where it was left.
    await page.keyboard.press("=");
    await expect(level(page)).toHaveText("125%");
    const fresh = await stage.evaluate(el => ({ left: el.scrollLeft, width: el.scrollWidth - el.clientWidth }));
    expect(Math.abs(fresh.left - fresh.width / 2)).toBeLessThan(2);
  });

  test("M switches the mark scheme, and the question comes back when the last pane is switched off", async ({ page }) => {
    await open(page);
    await page.keyboard.press("m");
    expect(await pressed(page)).toEqual(["Question", "Mark scheme"]);
    await paneSwitch(page, "Question").click();
    expect(await pressed(page)).toEqual(["Mark scheme"]);
    await expect(page.locator(".qb-pane")).toHaveCount(1);
    await expect(page.locator(".qb-pane-header")).toHaveCount(0);
    await page.keyboard.press("m");
    expect(await pressed(page)).toEqual(["Question"]);
    await expect(pane(page, "Question").locator("canvas").first()).toBeVisible();
  });

  test("another question opens by itself, so its answers are never shown by accident", async ({ page }) => {
    await open(page);
    await paneSwitch(page, "Mark scheme").click();
    const source = await page.locator(".qb-source-heading strong").innerText();
    // Next first steps through the mark scheme's own views, then moves on.
    await expect(async () => {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      expect(await page.locator(".qb-source-heading strong").innerText()).not.toBe(source);
    }).toPass();
    expect(await pressed(page)).toEqual(["Question"]);
    await expect(page.locator(".qb-scheme-stage")).toHaveCount(0);
  });

  test("an upright window stacks the panes, each at the full width", async ({ page }) => {
    await open(page, { width: 1080, height: 1920 });
    await paneSwitch(page, "Mark scheme").click();
    await drawn(page);
    const [question, scheme] = [await box(pane(page, "Question")), await box(pane(page, "Mark scheme"))];
    expect(scheme.x).toBe(question.x);
    expect(scheme.width).toBe(question.width);
    expect(Math.abs(question.y + question.height - scheme.y)).toBeLessThan(2);
    expect(Math.abs(scheme.height - question.height)).toBeLessThan(2);
  });

  test("Display keeps the switches and shows the panes side by side", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Display", exact: true }).click();
    await paneSwitch(page, "Mark scheme").click();
    await drawn(page);
    const [question, scheme] = [await box(pane(page, "Question")), await box(pane(page, "Mark scheme"))];
    expect(question.x).toBe(0);
    expect(Math.abs(scheme.x + scheme.width - 1920)).toBeLessThan(1);
    expect(Math.abs(scheme.width - question.width)).toBeLessThan(2);
    await page.keyboard.press("Escape");
    expect(await pressed(page)).toEqual(["Question", "Mark scheme"]);
  });
});
