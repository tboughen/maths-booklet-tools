// Loop item U47 (issue #161): Windows high contrast. In forced colours the browser repaints every
// background and text colour with the theme's, so a pressed, selected or active control that differs
// from its neighbours only by tint becomes indistinguishable. For every booklet tool, each such
// control that has an unpressed neighbour of the same kind must still look different in forced
// colours, and the forced-colours rules must not apply in normal mode.
//
// The bare `e2e` project and the `release` project (release qualification) both run every spec.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

const PRESSED = '[aria-pressed="true"],[aria-selected="true"],[aria-checked="true"],button.active,button.selected,.tool-button--active';

type Pair = { label: string; on: string; off: string; adjust: string };

/** Each pressed control beside an unpressed one of the same tag, with how both look. */
function pressedPairs(page: Page): Promise<Pair[]> {
  return page.evaluate((selector) => {
    // Only what a high-contrast user can see: forced colours remove box shadows and repaint tints.
    const look = (el: Element) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.color, `${s.outlineStyle} ${s.outlineWidth}`, `${s.borderTopStyle} ${s.borderTopWidth}`].join(" | ");
    };
    const pairs: Pair[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (!el.checkVisibility()) continue;
      const off = [...(el.parentElement?.children ?? [])].find((s) => s !== el && s.tagName === el.tagName && !s.matches(selector) && (s as HTMLElement).checkVisibility());
      if (!off) continue;
      const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
      pairs.push({ label, on: look(el), off: look(off), adjust: getComputedStyle(el).forcedColorAdjust });
    }
    return pairs;
  }, PRESSED);
}

async function openTool(page: Page, tool: string) {
  await page.goto(`/tools/${tool}`);
  await expect(page.getByRole("main").getByRole("button", { name: "File", exact: true }).first()).toBeVisible();
}

test("forced colours: at least some tools have pressed controls to check", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  let total = 0;
  for (const tool of toolIds.slice(0, 4)) {
    await openTool(page, tool);
    total += (await pressedPairs(page)).length;
  }
  expect(total, "pressed controls found in the first four tools").toBeGreaterThan(0);
});

for (const tool of toolIds)
  test(`${tool}: pressed and selected controls stay distinct in forced colours, and normal mode is untouched`, async ({ page }) => {
    await openTool(page, tool);
    for (const pair of await pressedPairs(page))
      expect(pair.adjust, `${tool}: ${pair.label} has no forced-colours override in normal mode`).toBe("auto");

    await page.emulateMedia({ forcedColors: "active" });
    const same = (await pressedPairs(page)).filter((pair) => pair.on === pair.off).map((pair) => pair.label);
    expect(same, `${tool}: pressed or selected controls that look like their neighbours in forced colours`).toEqual([]);
  });
