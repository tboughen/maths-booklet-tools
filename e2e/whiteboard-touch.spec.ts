// Interactive-whiteboard touch (improvement item 68). Teachers demonstrate on 1920x1080 boards with
// coarse touch, so these drags run with real touch events, not the mouse, at board size. Every
// gesture must change the drawing, and a tap on Undo must return it exactly.
// Touch events are sent through the Chrome DevTools Protocol, so this spec runs on Chromium only.
import { test as base, expect, type CDPSession, type Locator, type Page } from "@playwright/test";

type Point = { x: number; y: number };
// A board-sized touch context, closed even when an assertion fails.
const test = base.extend<{ board: { page: Page; cdp: CDPSession; errors: string[] } }>({
  board: async ({ browser }, provide) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      await provide({ page, errors, cdp: await context.newCDPSession(page) });
    } finally {
      await context.close();
    }
  },
});

const centre = async (target: Locator): Promise<Point> => {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const touch = (cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: Point[]) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
// A deliberate drag: the finger moves to the target and rests there before lifting. Without the
// rest the release is a flick, Chrome starts a fling, and it swallows the next tap as "stop the
// fling" (standard browser behaviour on any touch screen), so a following tap on Undo would vanish.
async function touchDrag(cdp: CDPSession, from: Point, to: Point) {
  await touch(cdp, "touchStart", [from]);
  for (let i = 1; i <= 6; i++)
    await touch(cdp, "touchMove", [{ x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6 }]);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 30));
    await touch(cdp, "touchMove", [to]);
  }
  await touch(cdp, "touchEnd", []);
}
async function fresh(page: Page, tool: string) {
  const key = `maths-booklet-tools:${tool}:v1`;
  await page.goto(`/tools/${tool}`);
  await page.evaluate(k => localStorage.removeItem(k), key);
  await page.reload();
  await expect.poll(() => page.evaluate(k => localStorage.getItem(k), key)).not.toBeNull();
  return () => page.evaluate(k => localStorage.getItem(k), key);
}

test("number line: a finger drags an interval endpoint along the line on a board", async ({ board: { page, cdp, errors } }) => {
  const saved = await fresh(page, "number-line");
  const resource = page.getByTestId("number-line-resource");
  const circle = (v: string) => resource.locator(`circle[data-value="${v}"]`);
  await page.getByRole("button", { name: "Interval", exact: true }).tap();
  await page.getByRole("button", { name: "Tick -2", exact: true }).tap();
  await page.getByRole("button", { name: "Tick 3", exact: true }).tap();
  await expect(circle("-2")).toHaveCount(1);
  const before = await saved();

  const from = await centre(page.getByRole("button", { name: /^Endpoint -2,/ }));
  const to = await centre(page.getByRole("button", { name: "Tick -1", exact: true }));
  await touchDrag(cdp, from, { x: to.x, y: from.y });
  await expect(circle("-1")).toHaveCount(1);
  await expect(circle("-2")).toHaveCount(0);
  await expect(resource.locator(".nl-drag")).toHaveCount(0);

  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect.poll(saved).toBe(before);
  expect(errors).toEqual([]);
});

test("triangle: a finger drags a vertex on a board, and Undo restores it", async ({ board: { page, cdp, errors } }) => {
  const saved = await fresh(page, "triangle");
  const before = await saved();

  const from = await centre(page.getByRole("button", { name: "Move vertex C", exact: true }));
  await touchDrag(cdp, from, { x: from.x - 40, y: from.y - 20 });
  await expect.poll(saved).not.toBe(before);

  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect.poll(saved).toBe(before);
  expect(errors).toEqual([]);
});
