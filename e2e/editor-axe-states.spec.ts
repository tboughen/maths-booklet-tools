// Axe checks for every editor in the states a person actually meets (improvement item 45).
// The page-level gate (gates.spec.ts) only sees each editor freshly loaded at desktop width, so
// menus, dialogs and phone layouts were never scanned. Here axe (WCAG 2 A and AA) must find no
// serious or critical rule in any of these states. A failure names the editor, state and rule.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openResourceMenu } from "./resource-actions";
import { showExamples } from "./example-gallery";

const editors = ["bar-model", "expanding-factorising", "triangle", "venn", "graph", "ratio-table", "value-table-graph", "cuboids", "number-line"];

async function serious(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter(v => v.impact === "serious" || v.impact === "critical")
    .map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map(n => n.target.join(" ")).join(" | ")}`);
}

for (const tool of editors)
  test(`${tool}: no serious accessibility violations when loaded, with the File menu and examples open, and at 320 px`, async ({ page }) => {
    test.setTimeout(90000);
    const found: string[] = [];
    const record = (state: string, rules: string[]) => found.push(...rules.map(r => `${state}: ${r}`));

    await page.goto(`/tools/${tool}`);
    await expect(page.locator(".booklet-editor").first()).toBeVisible();
    record("loaded", await serious(page));

    await openResourceMenu(page);
    await expect(page.getByRole("menu").first()).toBeVisible();
    record("File menu open", await serious(page));
    await page.keyboard.press("Escape");

    const gallery = await showExamples(page);
    record("example gallery open", await serious(page, "dialog.example-gallery[open]"));
    await gallery.press("Escape");

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(".booklet-editor").first()).toBeVisible();
    record("320 px wide", await serious(page));

    expect(found, `${tool} serious or critical axe rules`).toEqual([]);
  });
