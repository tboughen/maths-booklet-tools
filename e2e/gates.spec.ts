// Browser gates (docs/AUTONOMOUS-LOOP-POLICY.md, gates 1 and 9), run by `npx playwright test
// --project=gates` and by quick checks on pull requests that change the site.
//  - Smoke: every page reachable from the home page within two clicks loads without a page error.
//  - Accessibility: axe (WCAG 2 A and AA) finds no serious or critical rule on a page beyond the
//    ones recorded in e2e/a11y-baseline.json. The baseline is a ratchet: fix a rule and remove it;
//    refresh with UPDATE_A11Y_BASELINE=1 only to record fixes (never to accept new violations).
// Pages are found by following links, so this keeps working when page addresses change.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";

const baselinePath = "e2e/a11y-baseline.json";
const update = process.env.UPDATE_A11Y_BASELINE === "1";
const baseline: Record<string, string[]> = JSON.parse(readFileSync(baselinePath, "utf8"));

async function internalLinks(page: Page) {
  const origin = new URL(page.url()).origin;
  const hrefs = await page.locator("a[href]").evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href));
  return [...new Set(hrefs.map(h => new URL(h)).filter(u => u.origin === origin && !/\.(pdf|png|svg|zip|json)$/i.test(u.pathname)).map(u => { u.hash = ""; return u.href; }))];
}
// A name that survives address changes: the page's main heading.
const pageName = async (page: Page) => ((await page.locator("h1").first().textContent({ timeout: 5000 }).catch(() => null)) || new URL(page.url()).search || "/").trim();

test("every linked page loads cleanly and adds no serious accessibility violations", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(`${page.url()}: ${e.message}`));

  await page.goto("/");
  const queue = [page.url()], seen = new Set(queue), pages: string[] = [];
  for (let depth = 0; depth < 2; depth++) {
    for (const url of queue.splice(0)) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      pages.push(url);
      for (const link of await internalLinks(page)) if (!seen.has(link) && seen.size < 30) { seen.add(link); queue.push(link); }
    }
  }
  pages.push(...queue);
  expect(pages.length).toBeGreaterThan(5);
  test.info().annotations.push({ type: "pages", description: `${pages.length} pages` });

  const observed: Record<string, string[]> = {}, fresh: string[] = [];
  for (const url of pages) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const name = await pageName(page);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const rules = [...new Set(violations.filter(v => v.impact === "serious" || v.impact === "critical").map(v => v.id))].sort();
    observed[name] = [...new Set([...(observed[name] ?? []), ...rules])].sort();
    for (const rule of rules) if (!(baseline[name] ?? []).includes(rule)) fresh.push(`${name} (${url}): ${rule}`);
  }

  if (update) {
    writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(observed).filter(([, r]) => r.length).sort()), null, 2) + "\n");
    return;
  }
  expect(errors, "page errors").toEqual([]);
  expect(fresh, "new serious or critical accessibility violations").toEqual([]);
});
