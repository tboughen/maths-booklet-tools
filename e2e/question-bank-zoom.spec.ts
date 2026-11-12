import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";

// A real question from the lite bank used by pull-request CI.
const address = "/question-bank?code=U151&question=1MA1_JUN_2018_1H_Q4";
const level = (page: Page) => page.locator(".qb-footer .qb-zoom output");
const stage = (page: Page) => page.locator(".qb-stage");
const scroll = (page: Page) => stage(page).evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, wide: el.scrollWidth > el.clientWidth + 1 }));

async function open(page: Page) {
  await page.goto(address);
  await expect.poll(() => page.locator(".qb-stage canvas").evaluateAll(nodes => nodes.length > 0 && nodes.every(n => (n as HTMLCanvasElement).width > 0))).toBe(true);
  await expect(level(page)).toHaveText("100%");
}

test.describe("question viewer zoom and pan", () => {
  test("buttons and keys zoom without blanking the picture, and Fit returns", async ({ page }) => {
    await open(page);
    // Watch for any loading state or empty stage while zooming.
    await page.evaluate(() => {
      const w = window as unknown as { blanked: boolean };
      w.blanked = false;
      new MutationObserver(() => { if (document.querySelector('.qb-pdf[aria-busy="true"]') || !document.querySelector(".qb-stage canvas")) w.blanked = true; })
        .observe(document.querySelector(".qb-stage")!, { subtree: true, childList: true, attributes: true });
    });
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(level(page)).toHaveText("125%");
    await page.keyboard.press("=");
    await expect(level(page)).toHaveText("150%");
    await page.keyboard.press("-");
    await expect(level(page)).toHaveText("125%");
    for (let i = 0; i < 8; i++) await page.keyboard.press("=");
    await expect(level(page)).toHaveText("400%");
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    // The sharp redraw arrives at the new size (a stretched old picture would be a quarter as dense).
    await expect.poll(() => page.locator(".qb-stage canvas").first().evaluate(c => (c as HTMLCanvasElement).width / parseFloat((c as HTMLCanvasElement).style.width))).toBeGreaterThan(0.9);
    expect(await page.evaluate(() => (window as unknown as { blanked: boolean }).blanked)).toBe(false);
    await page.keyboard.press("0");
    await expect(level(page)).toHaveText("100%");
  });

  test("Ctrl + wheel zooms around the pointer, drag and Shift + arrows pan, plain wheel scrolls", async ({ page }) => {
    await open(page);
    const box = (await stage(page).boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.keyboard.down("Control");
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await expect.poll(async () => parseInt(await level(page).textContent() ?? "0")).toBeGreaterThan(180);
    expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
    await expect(stage(page)).toHaveClass(/qb-pannable/);
    const before = await scroll(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 90, { steps: 6 });
    await page.mouse.up();
    const dragged = await scroll(page);
    expect(dragged.top).toBeGreaterThan(before.top + 60);
    await page.keyboard.press("Shift+ArrowDown");
    await expect.poll(async () => (await scroll(page)).top).toBeGreaterThan(dragged.top);
    const question = await page.locator(".qb-navigation strong").textContent();
    await page.mouse.wheel(0, 200);
    await expect(level(page)).not.toHaveText("100%");
    await expect(page.locator(".qb-navigation strong")).toHaveText(question!);
  });

  test("double-click zooms to detail and back; the overview map moves the view", async ({ page }) => {
    await open(page);
    const box = (await stage(page).boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y + 150);
    await expect(level(page)).toHaveText("200%");
    const map = page.locator(".qb-overview-map");
    await expect(map).toBeVisible();
    const before = await scroll(page);
    const m = (await map.boundingBox())!;
    await page.mouse.click(m.x + m.width / 2, m.y + m.height - 4);
    await expect.poll(async () => (await scroll(page)).top).toBeGreaterThan(before.top);
    await page.getByRole("button", { name: "Hide overview map" }).click();
    await expect(map).toHaveCount(0);
    await page.getByRole("button", { name: "Show overview map" }).click();
    await expect(map).toBeVisible();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + 150);
    await expect(level(page)).toHaveText("100%");
    await expect(page.locator(".qb-overview")).toHaveCount(0);
  });

  test("the mark scheme opens at fit and hiding it restores the question's zoom and place", async ({ page }) => {
    await open(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press("=");
    await expect(level(page)).toHaveText("200%");
    await stage(page).evaluate(el => { el.scrollTop = 300; });
    await page.getByRole("button", { name: "Show mark scheme" }).click();
    await expect(level(page)).toHaveText("100%");
    await page.getByRole("button", { name: "Hide mark scheme" }).click();
    await expect(level(page)).toHaveText("200%");
    await expect.poll(async () => (await scroll(page)).top).toBe(300);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(level(page)).toHaveText("100%");
  });

  test("Display mode has its own zoom bar", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Display" }).click();
    const bar = page.locator(".qb-display-zoom");
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: "Zoom in" }).click();
    await expect(bar.locator("output")).toHaveText("125%");
    await bar.getByRole("button", { name: /^Fit$/ }).click();
    await expect(bar.locator("output")).toHaveText("100%");
    await page.keyboard.press("Escape");
    await expect(bar).toHaveCount(0);
  });

  test("PNG export is identical at fit and at 400%", async ({ page }) => {
    await open(page);
    const png = async () => {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG" }).click()]);
      return readFile((await download.path())!);
    };
    const atFit = await png();
    for (let i = 0; i < 8; i++) await page.keyboard.press("=");
    await expect(level(page)).toHaveText("400%");
    expect((await png()).equals(atFit)).toBe(true);
  });
});

test.describe("question viewer touch", () => {
  test.use({ viewport: { width: 1920, height: 1080 }, hasTouch: true });

  test("two-finger pinch zooms the question, not the page; one finger pans; swipe at fit changes question", async ({ page, context }) => {
    await open(page);
    const cdp = await context.newCDPSession(page);
    const touch = (type: string, points: [number, number][]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
    const box = (await stage(page).boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await touch("touchStart", [[cx - 50, cy], [cx + 50, cy]]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [[cx - 50 - i * 10, cy], [cx + 50 + i * 10, cy]]);
    await touch("touchEnd", []);
    await expect.poll(async () => parseInt(await level(page).textContent() ?? "0")).toBeGreaterThan(200);
    expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
    const before = await scroll(page);
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 5; i++) await touch("touchMove", [[cx - i * 20, cy - i * 20]]);
    await touch("touchEnd", []);
    const after = await scroll(page);
    expect(after.top).toBeGreaterThan(before.top + 50);
    // A sideways swipe while zoomed pans instead of changing question.
    const question = await page.locator(".qb-navigation strong").textContent();
    await page.keyboard.press("0");
    await expect(level(page)).toHaveText("100%");
    await touch("touchStart", [[cx + 200, cy]]);
    for (let i = 1; i <= 6; i++) await touch("touchMove", [[cx + 200 - i * 40, cy + 2]]);
    await touch("touchEnd", []);
    await expect(page.locator(".qb-navigation strong")).not.toHaveText(question!);
  });
});

test("the question sits at the top of the viewer, the search shows one focus ring and Filters closes on an outside click", async ({ page }) => {
  await open(page);
  const top = await page.evaluate(() => {
    const stageBox = document.querySelector(".qb-stage")!.getBoundingClientRect(), group = document.querySelector(".qb-view-group")!.getBoundingClientRect();
    return { gap: group.top - stageBox.top, padding: parseFloat(getComputedStyle(document.querySelector(".qb-stage")!).paddingTop) };
  });
  expect(Math.abs(top.gap - top.padding)).toBeLessThan(2);

  const search = page.getByRole("combobox", { name: "Sparx code or topic" });
  await search.focus();
  expect(await search.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
  expect(await page.locator(".qb-search").evaluate(el => getComputedStyle(el).boxShadow)).not.toBe("none");

  const filters = page.locator("details.qb-filters");
  const isOpen = () => filters.evaluate(el => (el as HTMLDetailsElement).open);
  await filters.locator("summary").click();
  await filters.getByRole("combobox", { name: "Calculator" }).selectOption("no");
  expect(await isOpen()).toBe(true);
  await page.locator(".qb-toolbar h1").click();
  expect(await isOpen()).toBe(false);
  await filters.locator("summary").click();
  await page.keyboard.press("Escape");
  expect(await isOpen()).toBe(false);
  await expect(filters.locator("summary")).toBeFocused();
});
