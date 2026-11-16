import { expect, test } from "@playwright/test";

// U1: every tool's foot strip reads zoom, Actual size, the print size, then view-only controls, then one note.
// The answers switch is not one of them: it sits in the action bar (e2e/answer-switch.spec.ts).
const tools = ["graph", "ratio-table", "value-table-graph", "cuboids", "number-line", "venn", "expanding-factorising", "bar-model", "triangle", "charts", "probability-tree", "frequency-tree", "construction", "elevations", "two-way-table", "sample-space", "factor-tree", "angles", "area"];
const viewOnly = new Set(["checkbox", "button:Finish drawing"]);

for (const tool of tools) {
  test(`${tool} foot strip keeps the shared order`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    const zoom = page.getByRole("combobox", { name: "Preview zoom" });
    await expect(zoom).toBeVisible();
    const order = await zoom.evaluate((select) =>
      [...select.closest(".editor-foot")!.children]
        .filter((child) => !child.classList.contains("sr-only"))
        .map((child) =>
          child.tagName === "LABEL" && child.querySelector('input[type="checkbox"]')
            ? "checkbox"
            : child.className.split(" ")[0] || `${child.tagName.toLowerCase()}:${child.textContent?.trim()}`,
        ),
    );
    expect(order.slice(0, 3), order.join(", ")).toEqual(["preview-zoom", "preview-detail", "resource-size"]);
    expect(order.at(-1), order.join(", ")).toBe("editor-foot-note");
    // Between the size and the note, only view controls: toggles that change what the screen shows (editing
    // guides) and the number line's "Finish drawing". Anything that changes the resource belongs in the inspector.
    const slot = order.slice(3, -1);
    expect(slot.every((name) => viewOnly.has(name)), slot.join(", ")).toBe(true);
  });

  test(`${tool} zoom steps from the fitted size and back to Fit`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tools/${tool}`);
    const zoom = page.getByRole("combobox", { name: "Preview zoom" });
    await expect(zoom).toHaveValue("0");
    // Fit says the size the diagram is drawn at.
    await expect(zoom.locator("option:checked")).toHaveText(/^Fit · \d+%$/);
    const fitted = Number((await zoom.locator("option:checked").textContent())!.match(/\d+/)![0]);
    const out = page.getByRole("button", { name: "Zoom out", exact: true });
    if (await out.isEnabled()) {
      await out.click();
      expect(Number(await zoom.inputValue()) * 100).toBeLessThan(fitted);
      await zoom.selectOption("0");
    }
    const actual = page.getByRole("button", { name: "Actual size", exact: true });
    await actual.click();
    await expect(zoom).toHaveValue("1");
    await expect(actual).toHaveAttribute("aria-pressed", "true");
    await actual.click();
    await expect(zoom).toHaveValue("0");
  });

  // The cuboid's print size is trimmed to its artwork, so its on-screen box is not the export's.
  if (tool !== "cuboids")
    test(`${tool}: Actual size draws the diagram at its print size`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/tools/${tool}`);
      await page.getByRole("button", { name: "Actual size", exact: true }).click();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const shown = document.querySelector(".site-page:not([hidden])")!;
            const [width, height] = shown.querySelector(".resource-size b")!.textContent!.match(/[\d.]+/g)!.map(Number);
            // A centimetre is 96 / 2.54 CSS pixels.
            const px = (cm: number) => (cm * 96) / 2.54;
            return [...shown.querySelectorAll(".editor-stage *")].some((element) => {
              const box = element.getBoundingClientRect();
              return Math.abs(box.width - px(width)) < 2 && Math.abs(box.height - px(height)) < 2;
            });
          }),
        )
        .toBe(true);
    });
}
