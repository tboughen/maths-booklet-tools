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
      await bar.getByRole("button", { name: "File", exact: true }).click();
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

test("each Graph axis +/- button names the axis end it changes on hover", async ({
  page,
}) => {
  await page.goto("/tools/graph");
  const buttons = page.locator(".graph-axis-controls button");
  await expect(buttons).toHaveCount(8);
  for (const button of await buttons.all()) {
    const label = await button.getAttribute("aria-label");
    expect(label).toMatch(
      /^(Add|Remove) one square at the (positive|negative) end of the [xy]-axis$/,
    );
    await expect(button).toHaveAttribute("title", label!);
  }
  await expect(
    page.getByTitle("Add one square at the positive end of the y-axis", {
      exact: true,
    }),
  ).toHaveText("+");
});

test("quadratic specialist settings preserve direct editing and pupil blanks", async ({
  page,
}) => {
  await page.goto("/tools/value-table-graph");
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

test("Undo and Redo have 44 px square touch targets on phones", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 844 },
  });
  const page = await context.newPage();
  for (const tool of ["number-line", "ratio-table", "bar-model", "triangle"]) {
    await page.goto(`/tools/${tool}`);
    for (const name of ["Undo", "Redo"]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .first()
        .boundingBox();
      expect(box?.width, `${tool} ${name} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `${tool} ${name} height`).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${tool} fits the phone width`,
    ).toBe(true);
  }
  await context.close();
});
