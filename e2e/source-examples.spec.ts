import { showExamples } from "./example-gallery";
import { test, expect } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import {
  verifyPrintBytes,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
import { getExportMetrics } from "../src/export/svg";
import { ratioMetrics } from "../packages/ratio-table-core/src/interchange";
import { graphExamples, ratioExamples } from "../src/examples/sourceExamples";

for (const [tool, examples, key, confirm] of [
  [
    "graph",
    graphExamples,
    "maths-booklet-tools:graph-envelope:v1",
    "Replace graph",
  ],
  ["ratio-table", ratioExamples, "mathsdock:ratio-table:v1", "Replace table"],
] as const) {
  test(`${tool} source examples protect edits, preserve scaffolds and offer explicit worked output`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page.goto(`/?tool=${tool}`);
    // Use the actual storage key from each editor after its initial save.
    await expect
      .poll(() => page.evaluate(() => localStorage.length))
      .toBeGreaterThan(0);
    const storageKey =
      tool === "graph"
        ? key
        : await page.evaluate(
            () =>
              Object.keys(localStorage).find(
                (k) => k.includes("ratio") && !k.includes("recovery"),
              )!,
          );
    const stored = () =>
      page.evaluate((k) => localStorage.getItem(k), storageKey);
    await showExamples(page);
    for (const example of examples) {
      await showExamples(page);
      const card = page.getByRole("article", {
        name: example.title,
        exact: true,
      });
      await expect(
        card.getByRole("link", { name: "View source question", exact: true }),
      ).toHaveAttribute("href", `/question-bank?question=${example.id}`);
      const before = await stored();
      await card
        .getByRole("button", {
          name: tool === "graph" ? "Open blank grid" : "Open scaffold",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await stored()).toBe(before);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      expect(await stored()).toBe(before);
      await showExamples(page);
      await card
        .getByRole("button", {
          name: tool === "graph" ? "Open blank grid" : "Open scaffold",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: confirm, exact: true })
        .click();
      await expect.poll(stored).not.toBe(before);
      const scaffold = JSON.parse((await stored())!).document;
      if (tool === "graph") expect(scaffold.objects).toEqual([]);
      else
        expect(
          scaffold.rows
            .flatMap((r: { cells: { kind: string }[] }) => r.cells)
            .some((c: { kind: string }) => c.kind === "answer-line"),
        ).toBe(true);
      const scaffoldText = await stored();
      await showExamples(page);
      await card
        .getByRole("button", { name: "Use worked version", exact: true })
        .click();
      await expect.poll(stored).not.toBe(scaffoldText);
      const result = JSON.parse((await stored())!).document;
      expect(
        tool === "graph"
          ? result.objects.length === 1
          : result.rows.every((r: { cells: { kind: string }[] }) =>
              r.cells.every((c) => c.kind === "number"),
            ),
      ).toBe(true);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(stored).toBe(scaffoldText);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(stored).toBe(before);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect
        .poll(async () => JSON.parse((await stored())!).document)
        .toEqual(scaffold);
      await page.getByRole("button", { name: "File", exact: true }).click();
      const downloading = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /Download SVG/ }).click();
      const download = await downloading,
        svg = await readFile((await download.path())!, "utf8");
      expect(svg).toContain("<svg");
      expect(svg).not.toMatch(
        /Use scaffold|Past-paper examples|axis-end-control/,
      );
      await page.getByRole("button", { name: "File", exact: true }).click();
      const preparingPng = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: /Download PNG/ }).click();
      const png = await preparingPng;
      const metrics =
        tool === "graph"
          ? getExportMetrics({
              ...scaffold,
              styleProfile: JSON.parse((await stored())!).styleProfile,
            })
          : ratioMetrics(scaffold);
      const size = printRasterSize(metrics.widthCm, metrics.heightCm);
      verifyPrintBytes(
        await readFile((await png.path())!),
        size.width,
        size.height,
      );
    }
    await showExamples(page);
    await page.screenshot({
      path: info.outputPath(`${tool}-past-paper-examples.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 1000 });
    await expect(
      page.getByRole("article").first().getByRole("button").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
}

test("source question links open the real published question without changing the editor", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/tools/ratio-table");
  await showExamples(page);
  const card = page.getByRole("article", { name: "Apple prices", exact: true });
  const opening = page.waitForEvent("popup");
  await card
    .getByRole("link", { name: "View source question", exact: true })
    .click();
  const question = await opening;
  await expect(question).toHaveURL(/question=1MA1_NOV_2017_3F_Q12/);
  await expect(question.locator(".qb-canvas-host canvas").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(
    question.getByText("November 2017 3F Q12", { exact: true }).first(),
  ).toBeVisible();
  await question.close();
  await expect(card).toBeVisible();
});

test("quadratic controls match the clear Graph design and keep exact bounds in axis settings", async ({
  page,
}, info) => {
  await page.goto("/tools/value-table-graph");
  await expect(
    page.getByRole("heading", { name: "Plotting quadratics", exact: true }),
  ).toBeVisible();
  const controls = page.locator(".vg-axis-end");
  await expect(controls).toHaveCount(4);
  for (const control of await controls.all()) {
    await expect(control.getByRole("button")).toHaveCount(2);
    expect(await control.getByRole("button").allTextContents()).toEqual([
      "+",
      "−",
    ]);
    const style = await control
      .getByRole("button")
      .first()
      .evaluate((b) => ({
        size: b.getBoundingClientRect().width,
        font: getComputedStyle(b).fontSize,
        radius: getComputedStyle(b).borderRadius,
      }));
    expect(style).toEqual({ size: 48, font: "24px", radius: "8px" });
  }
  await expect(page.locator(".vg-bound-value")).toHaveCount(0);
  for (const button of await page.locator(".vg-table-tools button").all()) {
    expect(await button.evaluate((b) => b.getBoundingClientRect().width)).toBe(
      48,
    );
  }
  await page
    .getByRole("button", { name: "Edit x axis scale", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Left x endpoint", exact: true })
    .fill("-4");
  await page
    .getByRole("textbox", { name: "Left x endpoint", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mathsdock:value-table-graph:v1")!)
            .document.graph.bounds.xMin,
      ),
    )
    .toBe("-4");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("0.75");
  await page.screenshot({
    path: info.outputPath("plotting-quadratics-controls.png"),
    fullPage: true,
  });
});
