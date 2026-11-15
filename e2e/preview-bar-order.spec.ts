import { expect, test } from "@playwright/test";

// U1: every tool's preview bar reads zoom, View at 100%, export size, then view-only controls.
const tools = ["graph", "ratio-table", "value-table-graph", "cuboids", "number-line", "venn", "expanding-factorising", "bar-model", "triangle", "charts", "probability-tree", "frequency-tree", "construction", "elevations", "two-way-table", "angles", "area"];
const shared = new Set(["preview-zoom", "preview-detail", "editor-inspector-link"]);
const viewOnly = new Set(["answer-preview-toggle", "answer-copy-toggle", "checkbox", "button:Finish drawing"]);

for (const tool of tools) {
  test(`${tool} preview bar keeps the shared order`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const zoom = page.getByRole("combobox", { name: "Preview zoom" });
    await expect(zoom).toBeVisible();
    const order = await zoom.evaluate((select) =>
      [...select.closest("label")!.parentElement!.children]
        .filter((child) => !child.classList.contains("sr-only"))
        .map((child) =>
          child.tagName === "LABEL" && child.querySelector('input[type="checkbox"]')
            ? "checkbox"
            : child.className.split(" ")[0] || `${child.tagName.toLowerCase()}:${child.textContent?.trim()}`,
        ),
    );
    expect(order[0], order.join(", ")).toBe("preview-zoom");
    const size = order.indexOf("resource-size");
    expect(size, order.join(", ")).toBeGreaterThan(0);
    expect(order.slice(0, size).every((name) => shared.has(name)), order.join(", ")).toBe(true);
    // After the size, only view controls: toggles that change what the screen shows (answers, guides) and
    // the number line's "Finish drawing". Anything that changes the resource belongs in the inspector.
    const slot = order.slice(size + 1);
    expect(slot.every((name) => viewOnly.has(name)), slot.join(", ")).toBe(true);
  });
}
