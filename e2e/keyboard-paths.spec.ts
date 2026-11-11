// Loop item L26 (issue #153): a keyboard-path smoke for every booklet tool. Tabbing through each
// editor must reach every visible control, every control that takes focus must have an accessible
// name, and focus must be visible on screen when it lands. tool-nav-keyboard.spec.ts and
// editor-layout.spec.ts cover the tool row and the settings jump; this covers the whole page.
//
// The bare `e2e` project and the `release` project (release qualification) both run every spec.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

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

/** Marks every tabbable control and returns the ids of those a keyboard user can see and must reach. */
async function markControls(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const reachable: string[] = [];
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.tabIndex < 0 || el.matches(":disabled") || el.closest("[inert],[aria-hidden=true]")) continue;
      const id = `kp-${n++}`;
      el.dataset.kp = id;
      const box = el.getBoundingClientRect();
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      // Skip links and jump buttons sit off screen or shrink to nothing until they take focus.
      if (box.width <= 1 || box.height <= 1) continue;
      reachable.push(id);
    }
    return reachable;
  }, FOCUSABLE);
}

/**
 * Records how every control without focus looks at rest, just before the next Tab press. Only focus
 * indicator properties count (outline, box-shadow, SVG stroke), so a permanent shadow, an ordinary
 * SVG stroke, a reflow or a font load never passes as a focus ring.
 */
async function recordRest(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-kp]")) {
      if (el === document.activeElement) continue;
      const s = getComputedStyle(el);
      el.dataset.kpRest = JSON.stringify([
        s.outlineStyle === "none" ? "none" : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
        s.boxShadow, s.stroke, s.strokeWidth,
      ]);
    }
  });
}

type Stop = { id: string | null; label: string; visible: boolean; onScreen: boolean };

/** Facts about the element that has focus now. */
async function focusFacts(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    let el = document.activeElement as HTMLElement | null;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const s = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const now = [
      s.outlineStyle === "none" ? "none" : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
      s.boxShadow, s.stroke, s.strokeWidth,
    ];
    const rest = el.dataset.kpRest ? (JSON.parse(el.dataset.kpRest) as unknown[]) : null;
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    // A control created after the page loaded has no resting record; it needs a real outline.
    const visible = rest ? now.some((value, i) => value !== rest[i]) : outline;
    const onScreen =
      box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 &&
      box.top < innerHeight && box.left < innerWidth;
    const label =
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
      `${el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")}"]` : ""}` +
      ` "${(el.textContent ?? "").trim().slice(0, 40)}"`;
    if (!el.dataset.kpSeen) el.dataset.kpSeen = String(document.querySelectorAll("[data-kp-seen]").length);
    return { id: el.dataset.kp ?? null, label, visible, onScreen };
  });
}

for (const tool of toolIds)
  test(`${tool}: Tab reaches every visible control, each named, with focus visible on screen`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(`/tools/${tool}`);
    // The editor is ready once its File menu button is on screen.
    await expect(page.getByRole("main").getByRole("button", { name: "File", exact: true }).first()).toBeVisible();
    // Start from the top of the page, as a keyboard user arriving on it does.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const reachable = await markControls(page);
    expect(reachable.length, `${tool} has controls to reach`).toBeGreaterThan(3);

    const reached = new Set<string>();
    const unnamed: string[] = [];
    const invisible: string[] = [];
    const offScreen: string[] = [];
    let first: string | null = null;
    for (let i = 0; i < MAX_TABS; i++) {
      await recordRest(page);
      await page.keyboard.press("Tab");
      // Let scroll-into-view settle before deciding where focus landed.
      let stop = await focusFacts(page);
      if (!stop) continue;
      if (!stop.onScreen)
        await expect
          .poll(async () => (stop = await focusFacts(page))?.onScreen, { timeout: 1000 })
          .toBe(true)
          .catch(() => undefined);
      if (!stop) continue;
      const seen = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.kpSeen);
      if (first === null) first = seen ?? null;
      else if (seen === first) break; // wrapped round to the first stop
      if (stop.id) reached.add(stop.id);
      const name = await page.locator(":focus").evaluate((el) => {
        // Chromium's accessibility tree is the oracle; computedName is not on every element type.
        const labelled = el.getAttribute("aria-labelledby");
        return (
          el.getAttribute("aria-label") ||
          (labelled && labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")) ||
          ""
        ).trim();
      });
      const named = name
        ? true
        : await expect(page.locator(":focus")).toHaveAccessibleName(/\S/, { timeout: 500 }).then(() => true, () => false);
      if (!named) unnamed.push(stop.label);
      if (!stop.visible) invisible.push(stop.label);
      if (!stop.onScreen) offScreen.push(stop.label);
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
    expect(invisible, `${tool}: focused controls whose outline, shadow or stroke does not change when focused`).toEqual([]);
    expect(offScreen, `${tool}: focused controls left off screen`).toEqual([]);
  });
