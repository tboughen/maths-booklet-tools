import { expect, test } from "@playwright/test";

// U1: every tool's preview bar reads zoom, View at 100%, export size, then at most one view-only slot.
const tools = ["graph", "ratio-table", "value-table-graph", "cuboids", "number-line", "venn", "expanding-factorising", "bar-model", "triangle", "charts", "probability-tree", "frequency-tree", "construction", "elevations", "two-way-table"];
const shared = new Set(["preview-zoom", "preview-detail", "editor-inspector-link"]);

for (const tool of tools) {
  test(`${tool} preview bar keeps the shared order`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const zoom = page.getByRole("combobox", { name: "Preview zoom" });
    await expect(zoom).toBeVisible();
    const order = await zoom.evaluate((select) =>
      [...select.closest("label")!.parentElement!.children]
        .filter((child) => !child.classList.contains("sr-only"))
        .map((child) => child.className.split(" ")[0] || child.tagName.toLowerCase()),
    );
    expect(order[0], order.join(", ")).toBe("preview-zoom");
    const size = order.indexOf("resource-size");
    expect(size, order.join(", ")).toBeGreaterThan(0);
    expect(order.slice(0, size).every((name) => shared.has(name)), order.join(", ")).toBe(true);
    // One view-only slot at most after the size: answer preview, answer copy or editing guides. Document
    // settings and actions (a cuboid's View, "Use worked version") belong in the inspector.
    const slot = order.slice(size + 1);
    expect(slot.length, slot.join(", ")).toBeLessThanOrEqual(1);
    const bar = zoom.locator("xpath=ancestor::label/..");
    await expect(bar.getByRole("button", { name: /worked version|cubes/i })).toHaveCount(0);
    await expect(bar.getByRole("combobox", { name: "View", exact: true })).toHaveCount(0);
  });
}
