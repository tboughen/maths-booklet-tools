import { test, expect } from "./release-fixtures";
import {
  defaultEnvelope,
  rangeColumns,
} from "../packages/value-graph-core/src/interchange";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { readFile } from "node:fs/promises";

test("visible table and axis utilities stay outside the snip area at every composition and zoom", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const composition of ["combined", "table", "graph"] as const) {
      for (const showEquation of [true, false]) {
        const envelope = defaultEnvelope();
        envelope.document.presentation.composition = composition;
        envelope.document.presentation.showEquation = showEquation;
        envelope.document.columns = rangeColumns("-3", "3", "1/2");
        envelope.document.print.tableWidthMm = 180;
        await page.addInitScript(
          (e) =>
            localStorage.setItem(
              "mathsdock:value-table-graph:v1",
              JSON.stringify(e),
            ),
          envelope,
        );
        await page.goto("/?tool=value-table-graph");
        await expect(
          page.getByRole("heading", {
            name: "Plotting quadratics",
            exact: true,
          }),
        ).toBeVisible();
        for (const zoom of ["0.75", "1", "1.25", "1.5"]) {
          await page
            .getByRole("combobox", { name: "Preview zoom", exact: true })
            .selectOption(zoom);
          const geometry = await page
            .locator(".vg-editor-frame")
            .evaluate((frame) => {
              const paper = frame
                .querySelector(".vg-paper")!
                .getBoundingClientRect();
              const controls = Array.from(
                frame.querySelectorAll(
                  ".vg-table-tools,.vg-axis-end,.vg-placeholder",
                ),
              );
              return controls.map((control) => {
                const box = control.getBoundingClientRect();
                return {
                  name: control.getAttribute("aria-label") ?? "Table",
                  outside:
                    box.right <= paper.left ||
                    box.left >= paper.right ||
                    box.bottom <= paper.top ||
                    box.top >= paper.bottom,
                  insidePaper: !!control.closest(".vg-paper"),
                  aligned: control.getAttribute("aria-label")?.startsWith("x")
                    ? box.top + box.height / 2
                    : box.left + box.width / 2,
                };
              });
            });
          expect(geometry).toHaveLength(
            (composition === "combined" ? 5 : composition === "graph" ? 4 : 1) +
              (showEquation ? 0 : 1),
          );
          expect(geometry.every((c) => c.outside)).toBe(true);
          expect(
            geometry
              .filter((c) => c.name !== "Edit equation")
              .every((c) => !c.insidePaper),
          ).toBe(true);
          const overlap = await page
            .locator(".vg-editor-frame")
            .evaluate((frame) => {
              const boxes = Array.from(
                frame.querySelectorAll(
                  ".vg-table-tools,.vg-axis-end,.vg-placeholder",
                ),
              ).map((c) => c.getBoundingClientRect());
              return boxes.some((a, i) =>
                boxes
                  .slice(i + 1)
                  .some(
                    (b) =>
                      a.left < b.right &&
                      a.right > b.left &&
                      a.top < b.bottom &&
                      a.bottom > b.top,
                  ),
              );
            });
          expect(overlap).toBe(false);
          if (composition !== "table") {
            expect(
              geometry.find((c) => c.name === "x left endpoint")!.aligned,
            ).toBeCloseTo(
              geometry.find((c) => c.name === "x right endpoint")!.aligned,
              3,
            );
            expect(
              geometry.find((c) => c.name === "y top endpoint")!.aligned,
            ).toBeCloseTo(
              geometry.find((c) => c.name === "y bottom endpoint")!.aligned,
              3,
            );
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }
        if (width === 1440 && composition === "combined" && showEquation) {
          await page
            .getByRole("combobox", { name: "Preview zoom", exact: true })
            .selectOption("1");
          await page.screenshot({
            path: info.outputPath("clean-workspace.png"),
            fullPage: true,
          });
          await page
            .locator(".vg-paper")
            .screenshot({ path: info.outputPath("clean-resource.png") });
        }
      }
    }
  }
});

for (const tool of ["graph", "ratio-table", "value-table-graph"]) {
  test(`${tool} copies an actual image to the system clipboard`, async ({
    page,
    context,
  }, info) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/?tool=${tool}`);
    const current = page.locator(".site-page:not([hidden])");
    await expect
      .poll(() => page.evaluate(() => localStorage.length))
      .toBeGreaterThan(0);
    const before = await page.evaluate(() =>
      Object.fromEntries(Object.entries(localStorage)),
    );
    await current
      .getByRole("button", { name: "Copy to clipboard", exact: true })
      .click();
    await expect(
      current.getByRole("status").filter({ hasText: /Image copied/ }),
    ).toBeVisible();
    const image = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const item = items.find((i) => i.types.includes("image/png"));
      if (!item) throw Error("No clipboard PNG");
      const blob = await item.getType("image/png");
      const bitmap = await createImageBitmap(blob);
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      return { width: bitmap.width, height: bitmap.height, bytes };
    });
    expect(image.width).toBeGreaterThan(600);
    expect(image.height).toBeGreaterThan(100);
    expect(image.bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    await info.attach("clipboard.png", {
      body: Buffer.from(image.bytes),
      contentType: "image/png",
    });
    expect(
      await page.evaluate(() =>
        Object.fromEntries(Object.entries(localStorage)),
      ),
    ).toEqual(before);
    await expect(
      current.getByRole("button", { name: "Copy for Word", exact: true }),
    ).toBeEnabled();
    await current
      .getByRole("button", { name: "Download options", exact: true })
      .click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /Download PNG/ }).click();
    const downloaded = await downloading;
    const bytes = await readFile((await downloaded.path())!);
    verifyPrintBytes(bytes, image.width, image.height);
  });
}

test("denied image copy offers a fallback and invalid drafts cannot copy", async ({
  page,
}) => {
  await page.goto("/?tool=value-table-graph");
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "write", {
      value: () =>
        Promise.reject(new DOMException("Denied", "NotAllowedError")),
      configurable: true,
    }),
  );
  await page
    .getByRole("button", { name: "Copy to clipboard", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Use Copy for Word or Download PNG",
  );
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Edit y for column 1", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Edit y for column 1", exact: true })
    .fill("invalid");
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
});
