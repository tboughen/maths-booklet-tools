import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";

const address = "/question-bank?code=U151&question=1MA1_JUN_2018_1H_Q4";
const ink = (page: Page) => page.locator(".qb-stage .qb-annotations path:not([d=''])");
const strokes = async (page: Page) => Number(await page.locator(".qb-stage .qb-annotations").first().getAttribute("data-strokes") ?? 0);

async function open(page: Page) {
  await page.goto(address);
  await expect.poll(() => page.locator(".qb-stage canvas").evaluateAll(nodes => nodes.length > 0 && nodes.every(n => (n as HTMLCanvasElement).width > 0))).toBe(true);
}
async function draw(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator(".qb-stage canvas").first().boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
  await page.mouse.up();
}

test.describe("question viewer annotations", () => {
  test("pen, highlighter, eraser, undo, redo and clear", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Annotate" }).click();
    const bar = page.getByRole("toolbar", { name: /Annotation tools/ });
    await expect(bar).toBeVisible();
    await draw(page, [100, 100], [300, 140]);
    await draw(page, [100, 200], [300, 240]);
    expect(await strokes(page)).toBe(2);
    await bar.getByRole("radio", { name: "Highlighter" }).click();
    await draw(page, [120, 300], [380, 300]);
    expect(await strokes(page)).toBe(3);
    await expect(page.locator(".qb-ink-highlighter path")).toHaveCount(1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => strokes(page)).toBe(2);
    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => strokes(page)).toBe(3);
    await page.keyboard.press("e");
    await draw(page, [200, 80], [200, 160]);
    await expect.poll(() => strokes(page)).toBe(2);
    await bar.getByRole("button", { name: "Clear this view" }).click();
    await expect.poll(() => strokes(page)).toBe(0);
    await bar.getByRole("button", { name: "Undo annotation" }).click();
    await expect.poll(() => strokes(page)).toBe(2);
    await expect(ink(page)).toHaveCount(2);
  });

  test("ink stays with its view: hidden on the mark scheme, back on the question, kept after Next and Previous", async ({ page }) => {
    await open(page);
    await page.keyboard.press("p");
    await draw(page, [100, 100], [300, 140]);
    expect(await strokes(page)).toBe(1);
    await page.getByRole("button", { name: "Show mark scheme" }).click();
    await expect(page.locator(".qb-stage canvas").first()).toBeVisible();
    await expect(page.locator(".qb-stage .qb-annotations[data-strokes='1']")).toHaveCount(0);
    await page.getByRole("button", { name: "Hide mark scheme" }).click();
    await expect.poll(() => strokes(page)).toBe(1);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator(".qb-stage .qb-annotations[data-strokes='1']")).toHaveCount(0);
    await page.getByRole("button", { name: "Previous" }).click();
    await expect.poll(() => strokes(page)).toBe(1);
    // The ink follows the page when zooming.
    const before = (await ink(page).first().boundingBox())!;
    await page.keyboard.press("Escape");
    for (let i = 0; i < 3; i++) await page.keyboard.press("=");
    await expect(page.locator(".qb-footer .qb-zoom output")).toHaveText("200%");
    await expect.poll(async () => (await ink(page).first().boundingBox())!.width).toBeGreaterThan(before.width * 1.8);
  });

  test("Escape puts the pen down before leaving Display", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Display" }).click();
    await page.locator(".qb-display-dock").getByRole("button", { name: "Annotate" }).click();
    await expect(page.locator(".qb-annotate-bar")).toBeVisible();
    await draw(page, [100, 100], [300, 140]);
    await page.keyboard.press("Escape");
    await expect(page.locator(".qb-annotate-bar")).toHaveCount(0);
    await expect(page.locator(".qb-display")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".qb-display")).toHaveCount(0);
  });

  test("exports never include annotations", async ({ page }) => {
    await open(page);
    const png = async () => {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PNG" }).click()]);
      return readFile((await download.path())!);
    };
    const clean = await png();
    await page.keyboard.press("p");
    await draw(page, [100, 100], [300, 140]);
    await page.keyboard.press("h");
    await draw(page, [100, 200], [300, 200]);
    expect(await strokes(page)).toBe(2);
    expect((await png()).equals(clean)).toBe(true);
  });
});

test.describe("question viewer annotations on touch boards", () => {
  test.use({ viewport: { width: 1920, height: 1080 }, hasTouch: true });

  test("fingers draw, a fist-sized touch erases, and two fingers still pinch to zoom", async ({ page, context }) => {
    await open(page);
    await page.keyboard.press("p");
    const cdp = await context.newCDPSession(page);
    const box = (await page.locator(".qb-stage canvas").first().boundingBox())!;
    const touch = (type: string, points: { x: number; y: number; r?: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: box.x + p.x, y: box.y + p.y, id, radiusX: p.r ?? 1, radiusY: p.r ?? 1 })) });
    await touch("touchStart", [{ x: 100, y: 150 }]);
    for (let i = 1; i <= 6; i++) await touch("touchMove", [{ x: 100 + i * 40, y: 150 }]);
    await touch("touchEnd", []);
    await expect.poll(() => strokes(page)).toBe(1);
    // The side of a fist: a large contact rubs out, whatever tool is chosen.
    await touch("touchStart", [{ x: 180, y: 110, r: 40 }]);
    for (let i = 1; i <= 4; i++) await touch("touchMove", [{ x: 180, y: 110 + i * 20, r: 40 }]);
    await touch("touchEnd", []);
    await expect.poll(() => strokes(page)).toBe(0);
    await expect(page.getByRole("radio", { name: "Pen" })).toHaveAttribute("aria-checked", "true");
    // A second finger turns a stroke into a pinch, leaving no ink.
    const cx = 400, cy = 300;
    await touch("touchStart", [{ x: cx - 40, y: cy }]);
    await touch("touchMove", [{ x: cx - 45, y: cy }]);
    await touch("touchStart", [{ x: cx - 45, y: cy }, { x: cx + 40, y: cy }]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [{ x: cx - 45 - i * 12, y: cy }, { x: cx + 40 + i * 12, y: cy }]);
    await touch("touchEnd", []);
    await expect.poll(async () => parseInt(await page.locator(".qb-footer .qb-zoom output").textContent() ?? "0")).toBeGreaterThan(150);
    expect(await strokes(page)).toBe(0);
  });
});
