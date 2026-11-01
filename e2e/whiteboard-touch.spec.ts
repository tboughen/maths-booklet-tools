// Interactive-whiteboard touch (improvement item 68). Teachers demonstrate on 1920x1080 boards with
// coarse touch, so these drags run with real touch events (CDP), not the mouse, at board size.
// Every gesture must change the drawing, and Undo must return it exactly.
import { test, expect, type Browser, type CDPSession, type Locator, type Page } from "@playwright/test";

async function board(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  return { context, page, errors, cdp: await context.newCDPSession(page) };
}
const centre = async (target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
async function touchDrag(cdp: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// Leave the second a teacher takes to lift their finger and reach for Undo. In emulated touch a tap
// within about half a second of a number-line endpoint drag produced no click (the triangle did not
// show this); the PR that added this spec records it for a check on a real board.
const lift = (page: Page) => page.waitForTimeout(1000);
async function fresh(page: Page, tool: string) {
  const key = `maths-booklet-tools:${tool}:v1`;
  await page.goto(`/tools/${tool}`);
  await page.evaluate(k => localStorage.removeItem(k), key);
  await page.reload();
  await expect.poll(() => page.evaluate(k => localStorage.getItem(k), key)).not.toBeNull();
  return () => page.evaluate(k => localStorage.getItem(k), key);
}

test("number line: a finger drags an interval endpoint along the line on a board", async ({ browser }) => {
  const { context, page, errors, cdp } = await board(browser);
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

  await lift(page);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect.poll(saved).toBe(before);
  expect(errors).toEqual([]);
  await context.close();
});

test("triangle: a finger drags a vertex on a board, and Undo restores it", async ({ browser }) => {
  const { context, page, errors, cdp } = await board(browser);
  const saved = await fresh(page, "triangle");
  const before = await saved();

  const from = await centre(page.getByRole("button", { name: "Move vertex C", exact: true }));
  await touchDrag(cdp, from, { x: from.x - 40, y: from.y - 20 });
  await expect.poll(saved).not.toBe(before);

  await lift(page);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect.poll(saved).toBe(before);
  expect(errors).toEqual([]);
  await context.close();
});
