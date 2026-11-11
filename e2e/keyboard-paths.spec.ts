// Loop item L26 (issue #153): a keyboard-path smoke for every booklet tool. Tabbing through each
// editor must reach every visible control, every control that takes focus must have an accessible
// name, and focus must be visible on screen when it lands. tool-nav-keyboard.spec.ts and
// editor-layout.spec.ts cover the tool row and the settings jump; this covers the whole page.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

const tools = toolIds;
// Enough for the busiest editor; the walk stops early when focus wraps round to the start.
const MAX_TABS = 600;

const FOCUSABLE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[contenteditable=''],[contenteditable=true]",
  "[tabindex]",
].join(",");

/** Marks every control a keyboard user can see and should be able to reach, and returns their ids. */
async function markReachable(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const ids: string[] = [];
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.tabIndex < 0 || el.matches(":disabled") || el.closest("[inert],[aria-hidden=true]")) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const box = el.getBoundingClientRect();
      // Skip links and jump buttons sit off screen or shrink to nothing until they take focus.
      if (box.width <= 1 || box.height <= 1) continue;
      const id = `kp-${n++}`;
      el.dataset.kp = id;
      ids.push(id);
    }
    return ids;
  }, FOCUSABLE);
}

type Stop = { id: string | null; label: string; visible: boolean; onScreen: boolean };

/** Facts about the element that has focus now. */
async function focusFacts(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    let el = document.activeElement as HTMLElement | null;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    if (!el.dataset.kpSeen) el.dataset.kpSeen = String(document.querySelectorAll("[data-kp-seen]").length);
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== "none";
    // Diagram objects are SVG shapes that show focus by drawing their own stroke.
    const stroke =
      el instanceof SVGElement && style.stroke !== "none" && !/rgba\(.*,\s*0\)$|transparent/.test(style.stroke) &&
      parseFloat(style.strokeWidth) > 0;
    const box = el.getBoundingClientRect();
    const onScreen =
      box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 &&
      box.top < innerHeight && box.left < innerWidth;
    const label =
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
      `${el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")}"]` : ""}` +
      ` "${(el.textContent ?? "").trim().slice(0, 40)}"`;
    return { id: el.dataset.kp ?? null, label, visible: outline || ring || stroke, onScreen };
  });
}

for (const tool of tools)
  test(`${tool}: Tab reaches every visible control, each named, with focus visible on screen`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(`/tools/${tool}`);
    await expect(page.getByRole("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const reachable = await markReachable(page);
    expect(reachable.length, `${tool} has controls to reach`).toBeGreaterThan(3);

    // Start from the top of the page, as a keyboard user arriving on it does.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const reached = new Set<string>();
    const unnamed: string[] = [];
    const invisible: string[] = [];
    const offScreen: string[] = [];
    let first: string | null = null;
    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press("Tab");
      const stop = await focusFacts(page);
      if (!stop) continue;
      const seen = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.kpSeen);
      if (first === null) first = seen ?? null;
      else if (seen === first) break; // wrapped round to the first stop
      if (stop.id) reached.add(stop.id);
      const focused = page.locator(":focus");
      const named = await expect(focused).toHaveAccessibleName(/\S/, { timeout: 100 }).then(() => true, () => false);
      if (!named) unnamed.push(stop.label);
      if (!stop.visible) invisible.push(stop.label);
      // Let scroll-into-view settle before deciding focus landed off screen.
      if (!stop.onScreen) {
        await page.waitForTimeout(200);
        if (!(await focusFacts(page))?.onScreen) offScreen.push(stop.label);
      }
    }

    const missed = await page.evaluate(
      (ids) => ids.map((id) => {
        const el = document.querySelector<HTMLElement>(`[data-kp="${id}"]`);
        return el ? `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"` : id;
      }),
      reachable.filter((id) => !reached.has(id)),
    );
    expect(reached.size, `${tool}: controls Tab reached`).toBeGreaterThan(3);
    expect(missed, `${tool}: visible controls Tab never reached`).toEqual([]);
    expect(unnamed, `${tool}: focused controls with no accessible name`).toEqual([]);
    expect(invisible, `${tool}: focused controls with no visible focus indicator`).toEqual([]);
    expect(offScreen, `${tool}: focused controls left off screen`).toEqual([]);
  });
