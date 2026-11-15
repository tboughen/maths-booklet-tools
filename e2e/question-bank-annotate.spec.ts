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
    await bar.getByRole("button", { name: "Highlighter" }).click();
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

  test("the white space around the page is drawable, and the pointer shows the tool", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page);
    await page.getByRole("button", { name: "Annotate" }).click();
    const stage = (await page.locator(".qb-stage").boundingBox())!;
    const pageBox = (await page.locator(".qb-stage canvas").first().boundingBox())!;
    expect(pageBox.x - stage.x).toBeGreaterThan(80);
    // Wholly in the margin, then from the margin onto the page.
    const y = pageBox.y + 60;
    await page.mouse.move(stage.x + 30, y); await page.mouse.down(); await page.mouse.move(stage.x + 70, y + 30, { steps: 6 }); await page.mouse.up();
    await page.mouse.move(stage.x + 30, y + 120); await page.mouse.down(); await page.mouse.move(pageBox.x + 120, y + 130, { steps: 10 }); await page.mouse.up();
    await expect.poll(() => strokes(page)).toBe(2);
    const cursor = () => page.locator(".qb-stage").evaluate(el => getComputedStyle(el).cursor);
    expect(await cursor()).toContain("data:image/svg+xml");
    expect(decodeURIComponent(await cursor())).toContain("#1b1b1b");
    await page.keyboard.press("h");
    expect(decodeURIComponent(await cursor())).toContain("#fffc00");
    await page.keyboard.press("v");
    expect(await cursor()).not.toContain("data:image");
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
    // The rail runs down the right of the board, and Annotate and zoom sit just left of it.
    const [dock, rail] = [(await page.locator(".qb-display-dock").boundingBox())!, (await page.locator(".qb-annotate-bar").boundingBox())!];
    expect(dock.x + dock.width).toBeLessThanOrEqual(rail.x);
    expect(rail.x - (dock.x + dock.width)).toBeLessThan(40);
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

  test("draw and hold snaps a rough shape or line, and leaves other strokes as drawn", async ({ page }) => {
    await open(page);
    await page.keyboard.press("p");
    const box = (await page.locator(".qb-stage canvas").first().boundingBox())!;
    const trace = async (points: [number, number][], holdMs: number) => {
      await page.mouse.move(box.x + points[0][0], box.y + points[0][1]);
      await page.mouse.down();
      for (const [x, y] of points.slice(1)) await page.mouse.move(box.x + x, box.y + y);
      await page.waitForTimeout(holdMs);
      await page.mouse.up();
    };
    const last = () => page.locator(".qb-stage .qb-annotations .qb-ink-pen path").last();
    const wobble = (i: number) => (i % 3) - 1;
    // A rough rectangle, nearly closed, held at the end: four straight sides, exactly level.
    const rect: [number, number][] = [];
    for (let x = 100; x <= 300; x += 10) rect.push([x, 150 + wobble(x)]);
    for (let y = 150; y <= 250; y += 10) rect.push([300 + wobble(y), y]);
    for (let x = 300; x >= 100; x -= 10) rect.push([x, 252 + wobble(x)]);
    for (let y = 250; y >= 160; y -= 10) rect.push([100 + wobble(y), y]);
    await trace(rect, 700);
    await expect.poll(() => strokes(page)).toBe(1);
    const d = await last().getAttribute("d") ?? "";
    expect(d).toMatch(/^M[^QA]*$/);
    expect(d.match(/L/g)).toHaveLength(4);
    expect(await last().getAttribute("fill")).toBe("none");
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number), corner = (i: number) => [n[2 * i], n[2 * i + 1]];
    const [a, b, c] = [corner(0), corner(1), corner(2)];
    // Level and upright sides meeting at right angles.
    expect([a[0] === b[0] || a[1] === b[1], b[0] === c[0] || b[1] === c[1]]).toEqual([true, true]);
    // A rough circle snaps to a circle.
    const circle: [number, number][] = [];
    for (let t = 0; t < 2 * Math.PI * 0.95; t += 0.15) circle.push([500 + 60 * Math.cos(t) + wobble(Math.round(t * 10)), 200 + 60 * Math.sin(t)]);
    await trace(circle, 700);
    await expect.poll(() => strokes(page)).toBe(2);
    expect((await last().getAttribute("d") ?? "").match(/L/g)!.length).toBeGreaterThan(60);
    // A nearly level line held still becomes exactly level.
    await trace([[100, 350], [160, 352], [220, 351], [300, 356]], 700);
    await expect.poll(() => strokes(page)).toBe(3);
    const line = (await last().getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(line).toHaveLength(4);
    expect(line[1]).toBe(line[3]);
    // A held scribble isn't a shape or a line, so it stays freehand ink.
    const scribble: [number, number][] = [];
    for (let i = 0; i < 40; i++) scribble.push([400 + i * 6, 380 + (i % 4 < 2 ? 0 : 30)]);
    await trace(scribble, 700);
    await expect.poll(() => strokes(page)).toBe(4);
    expect(await last().getAttribute("fill")).not.toBe("none");
    // The same rough rectangle lifted straight away stays freehand ink.
    await trace(rect.map(([x, y]) => [x + 400, y + 200]), 0);
    await expect.poll(() => strokes(page)).toBe(5);
    expect(await last().getAttribute("fill")).not.toBe("none");
  });

  test("each tool keeps its own size, eight pen colours, and changing tool turns straight lines off", async ({ page }) => {
    await open(page);
    await page.keyboard.press("p");
    const bar = page.locator(".qb-annotate-bar");
    await expect(bar.getByRole("group", { name: "Pen colour" }).getByRole("button")).toHaveCount(8);
    await page.keyboard.press("7");
    await expect(bar.getByRole("button", { name: "Purple" })).toHaveAttribute("aria-pressed", "true");
    await bar.getByRole("button", { name: "Thin" }).click();
    await page.keyboard.press("h");
    await bar.getByRole("button", { name: "Thick" }).click();
    await page.keyboard.press("p");
    await expect(bar.getByRole("button", { name: "Thin" })).toHaveAttribute("aria-pressed", "true");
    await bar.getByRole("button", { name: "Straight lines" }).click();
    await expect(bar.getByRole("button", { name: "Straight lines" })).toHaveAttribute("aria-pressed", "true");
    await bar.getByRole("button", { name: "Blue" }).click();
    await expect(bar.getByRole("button", { name: "Straight lines" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("h");
    await expect(bar.getByRole("button", { name: "Thick" })).toHaveAttribute("aria-pressed", "true");
    await expect(bar.getByRole("button", { name: "Straight lines" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the tools sit on a rail right of the page above Annotate; arrow keys move along it, and a tapped button doesn't keep focus", async ({ page }) => {
    await open(page);
    await page.keyboard.press("p");
    const bar = page.locator(".qb-annotate-bar"), stage = page.locator(".qb-stage");
    const [rail, view] = [(await bar.boundingBox())!, (await stage.boundingBox())!];
    expect(rail.x).toBeGreaterThanOrEqual(view.x + view.width - 1);
    // Annotate sits at the right of the footer, under the rail.
    const annotate = (await page.locator(".qb-footer .qb-annotate-toggle").boundingBox())!;
    expect(annotate.x + annotate.width).toBeGreaterThan(rail.x);
    expect(rail.height).toBeGreaterThan(rail.width);
    // Every control is in view without scrolling the rail.
    for (const name of ["Pen", "Orange", "Thick", "Clear this view", "Close annotation tools"]) await expect(bar.getByRole("button", { name, exact: true })).toBeInViewport();
    await bar.getByRole("button", { name: "Highlighter" }).click();
    await expect(bar.getByRole("button", { name: "Highlighter" })).not.toBeFocused();
    // Zoomed in, the overview map's button sits clear of the rail.
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    const toggle = page.locator(".qb-overview-toggle, .qb-overview").first();
    await expect(toggle).toBeVisible();
    const map = (await toggle.boundingBox())!;
    expect(map.x + map.width).toBeLessThanOrEqual(rail.x);
    await bar.getByRole("button", { name: "Pen", exact: true }).focus();
    const before = await page.locator(".qb-navigation strong").textContent();
    await page.keyboard.press("ArrowDown");
    await expect(bar.getByRole("button", { name: "Highlighter" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(bar.getByRole("button", { name: "Close annotation tools" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".qb-navigation strong")).toHaveText(before!);
  });
});

test.describe("question viewer annotations on touch boards", () => {
  test.use({ viewport: { width: 1920, height: 1080 }, hasTouch: true });

  test("fingers draw, a large contact never erases, and two fingers still pinch to zoom", async ({ page, context }) => {
    await open(page);
    await page.keyboard.press("p");
    const cdp = await context.newCDPSession(page);
    const box = (await page.locator(".qb-stage canvas").first().boundingBox())!;
    const touch = (type: string, points: { x: number; y: number; r?: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: box.x + p.x, y: box.y + p.y, id, radiusX: p.r ?? 1, radiusY: p.r ?? 1 })) });
    await touch("touchStart", [{ x: 100, y: 150 }]);
    for (let i = 1; i <= 6; i++) await touch("touchMove", [{ x: 100 + i * 40, y: 150 }]);
    await touch("touchEnd", []);
    await expect.poll(() => strokes(page)).toBe(1);
    // A large contact (a fist or palm) is not an eraser: rubbing out needs the Eraser tool or a stylus eraser.
    await touch("touchStart", [{ x: 180, y: 110, r: 40 }]);
    for (let i = 1; i <= 4; i++) await touch("touchMove", [{ x: 180, y: 110 + i * 20, r: 40 }]);
    await touch("touchEnd", []);
    await expect.poll(() => strokes(page)).toBe(2);
    await expect(page.getByText("Fist eraser")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute("aria-pressed", "true");
    // A second finger turns a stroke into a pinch, leaving no ink.
    const cx = 400, cy = 300;
    await touch("touchStart", [{ x: cx - 40, y: cy }]);
    await touch("touchMove", [{ x: cx - 45, y: cy }]);
    await touch("touchStart", [{ x: cx - 45, y: cy }, { x: cx + 40, y: cy }]);
    for (let i = 1; i <= 8; i++) await touch("touchMove", [{ x: cx - 45 - i * 12, y: cy }, { x: cx + 40 + i * 12, y: cy }]);
    await touch("touchEnd", []);
    await expect.poll(async () => parseInt(await page.locator(".qb-footer .qb-zoom output").textContent() ?? "0")).toBeGreaterThan(150);
    expect(await strokes(page)).toBe(2);
  });
  test("a stylus beats a palm that landed first, and a pen lifted off the page still ends its stroke", async ({ page, context }) => {
    await open(page);
    await page.keyboard.press("p");
    const cdp = await context.newCDPSession(page);
    const box = (await page.locator(".qb-stage canvas").first().boundingBox())!;
    const touch = (type: string, points: { x: number; y: number }[]) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ x: box.x + p.x, y: box.y + p.y, id })) });
    // Synthetic stylus events: the browser can't drive a real pen, so dispatch pen pointer events on the ink layer.
    const pen = (type: string, x: number, y: number, target: "layer" | "body" = "layer") => page.evaluate(({ type, x, y, target }) => {
      const layer = document.querySelector(".qb-stage .qb-annotations")!;
      (target === "layer" ? layer : document.body).dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: "pen", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, { type, x: box.x + x, y: box.y + y, target });
    await touch("touchStart", [{ x: 100, y: 100 }]);
    await touch("touchMove", [{ x: 160, y: 100 }]);
    await expect(ink(page)).toHaveCount(1);
    await pen("pointerdown", 100, 400);
    for (let i = 1; i <= 6; i++) await pen("pointermove", 100 + i * 30, 400);
    // Lifted over something that isn't the ink layer (a toolbar, say).
    await pen("pointerup", 280, 400, "body");
    await touch("touchMove", [{ x: 220, y: 100 }]);
    await touch("touchEnd", []);
    await expect.poll(() => strokes(page)).toBe(1);
    const drawn = (await ink(page).first().boundingBox())!;
    expect(drawn.y - box.y).toBeGreaterThan(300);
  });
});
