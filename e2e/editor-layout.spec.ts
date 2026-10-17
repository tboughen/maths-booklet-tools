import { test, expect } from "./release-fixtures";

for (const width of [1440, 1024, 900, 375, 320]) {
  test(`shared utilities and specialist controls remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    let commonStyle: unknown;
    for (const [tool, specialist, local] of [
      [
        "graph",
        "Line by equation",
        "Add one square at the positive end of the x-axis",
      ],
      ["ratio-table", "Edit headings", "Add column"],
      ["value-table-graph", "Graph options", "Add column"],
    ]) {
      await page.goto(`/?tool=${tool}`);
      const current = page.locator(".site-page:not([hidden])");
      const bar = current.getByRole("group", {
        name: "Resource utilities",
        exact: true,
      });
      await expect(bar).toBeVisible();
      const names = await bar
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map(
            (b) => b.getAttribute("aria-label") ?? b.textContent?.trim(),
          ),
        );
      expect(names).toEqual([
        "Undo",
        "Redo",
        tool === "graph" ? "Reset diagram" : "Reset",
        "Copy image",
        "Copy for Word",
        "File",
      ]);
      await expect(
        current
          .getByRole("complementary")
          .getByRole("button", { name: specialist, exact: true }),
      ).toBeVisible();
      await expect(
        current
          .locator(".editor-card")
          .getByRole("button", { name: local, exact: true }),
      ).toHaveCount(1);
      const style = await bar
        .getByRole("button", { name: "Copy for Word", exact: true })
        .evaluate((b) => ({
          background: getComputedStyle(b).backgroundColor,
          height: b.getBoundingClientRect().height,
          font: getComputedStyle(b).fontSize,
        }));
      if (commonStyle) expect(style).toEqual(commonStyle);
      else commonStyle = style;
      await bar
        .getByRole("button", { name: "File", exact: true })
        .click();
      const popover = page.getByRole("menu");
      await expect(popover).toBeVisible();
      const menuBox = await popover.boundingBox();
      expect(menuBox!.x).toBeGreaterThanOrEqual(0);
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
      await expect(
        page.getByRole("menuitem", { name: /Download SVG/ }),
      ).toBeVisible();
      const lastAction = popover.getByRole("menuitem").last();
      await lastAction.scrollIntoViewIfNeeded();
      const lastBox = await lastAction.boundingBox();
      expect(lastBox!.y + lastBox!.height / 2).toBeGreaterThan(menuBox!.y);
      expect(lastBox!.y + lastBox!.height / 2).toBeLessThan(
        menuBox!.y + menuBox!.height,
      );
      await lastAction.press("Escape");
      await expect(
        bar.getByRole("button", { name: "File", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 1440 || width === 375)
        await page.screenshot({
          path: info.outputPath(`${tool}-${width}.png`),
          fullPage: true,
        });
    }
  });
}

test("quadratic specialist settings preserve direct editing and pupil blanks", async ({
  page,
}) => {
  await page.goto("/?tool=value-table-graph");
  await page
    .getByRole("button", { name: "Table settings", exact: true })
    .click();
  await expect(
    page
      .getByRole("complementary")
      .getByRole("textbox", { name: "Range start", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  const equation = page.getByRole("textbox", { name: "Equation", exact: true });
  await equation.fill("y = x² + 1");
  await equation.press("Enter");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mathsdock:value-table-graph:v1")!),
  );
  expect(
    saved.document.columns.filter(
      (c: { y: { kind: string } }) => c.y.kind === "blank",
    ),
  ).toHaveLength(5);
  expect(saved.document.graph.curves).toHaveLength(0);
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.keyboard.press("Control+z");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mathsdock:value-table-graph:v1")!)
            .document.equation.c,
      ),
    )
    .toBe("-6");
  await page.keyboard.press("Control+y");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mathsdock:value-table-graph:v1")!)
            .document.equation.c,
      ),
    )
    .toBe("1");
});
