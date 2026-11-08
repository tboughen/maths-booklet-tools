import { test, expect } from "./release-fixtures";

// Screenshot baselines for the site's pages (improvement list L29). Each page opens fresh, with
// nothing saved, at a desktop and a phone size, and is compared with a baseline image made in the
// pinned Playwright image (docs/release/RELEASE-PIPELINE.md). They catch layout, spacing, colour
// and control changes that the export goldens cannot see, because those only check the resource.
// After an intended change, regenerate in the image with --update-snapshots and review the images.

const pinned = process.env.MATHSDOCK_PINNED_BROWSER === "1";
const pages = [
  ["home", "/"],
  ["booklet-tools", "/tools"],
  ["assessment-follow-up", "/assessment-follow-up"],
  ...[
    "bar-model",
    "expanding-factorising",
    "triangle",
    "venn",
    "graph",
    "ratio-table",
    "value-table-graph",
    "cuboids",
    "number-line",
    "charts",
    "probability-tree",
  ].map((tool) => [tool, `/tools/${tool}`]),
] as const;
const sizes = [
  ["desktop", 1280, 800],
  ["phone", 375, 812],
] as const;

for (const [name, path] of pages)
  for (const [size, width, height] of sizes)
    test(`${name} at ${size} size matches its screenshot`, async ({ page }) => {
      if (!pinned && process.env.CI)
        throw Error(
          "Screenshots must run in the pinned Playwright image (MATHSDOCK_PINNED_BROWSER=1).",
        );
      test.skip(
        !pinned,
        "Screenshots run in the pinned Playwright image: docs/release/RELEASE-PIPELINE.md",
      );
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      // Lazy pages fit their resource after first paint; wait for two quiet frames.
      await page.waitForLoadState("networkidle");
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      await expect(page).toHaveScreenshot(`${name}-${size}.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        // The pinned image renders identically run to run; this absorbs CPU-level anti-aliasing.
        maxDiffPixelRatio: 0.001,
      });
    });
