import { test, expect } from "./release-fixtures";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const directory = resolve(
  process.env.USABILITY_REVIEW ||
    "../reports/mathsdock-usability-implementation-2026-10-17/visual-review",
);
const tools = [
  "graph",
  "ratio-table",
  "value-table-graph",
  "cuboids",
  "number-line",
  "venn",
  "triangle",
  "expanding-factorising",
];
for (const width of [1280, 375])
  test(`built visual review and keyboard gallery at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await mkdir(directory, { recursive: true });
    await page.setViewportSize({ width, height: 1000 });
    for (const tool of tools) {
      await page.goto(`/?tool=${tool}`);
      await expect(
        page.getByRole("combobox", { name: "Preview zoom", exact: true }),
      ).toHaveValue("0");
      await page.screenshot({
        path: resolve(directory, `${tool}-${width}.png`),
      });
      const trigger = page.getByRole("button", {
        name: "Start from an example",
        exact: true,
      });
      await trigger.press("Enter");
      const gallery = page.locator("dialog.example-gallery[open]");
      await expect(gallery).toBeVisible();
      for (const image of await gallery.locator("img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      await gallery.evaluate((element) => (element.scrollTop = 0));
      await page.screenshot({
        path: resolve(directory, `${tool}-gallery-${width}.png`),
      });
      const bounds = await gallery.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await gallery
        .getByRole("button", { name: "Close", exact: true })
        .press("Escape");
      await expect(trigger).toBeFocused();
    }
  });
