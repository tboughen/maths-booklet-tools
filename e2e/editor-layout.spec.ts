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

const editors = [
  "bar-model",
  "expanding-factorising",
  "triangle",
  "venn",
  "graph",
  "ratio-table",
  "value-table-graph",
  "cuboids",
  "number-line",
];
for (const width of [320, 375])
  test(`Undo and Redo have 44 px square touch targets on ${width} px phones`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width, height: 844 },
    });
    const page = await context.newPage();
    for (const tool of editors) {
      await page.goto(`/tools/${tool}`);
      const toolbar = page.locator(".editor-toolbar").first();
      await expect(toolbar).toBeVisible();
      // Every icon-button in the toolbar is icon-only, so a fixed width cannot clip text.
      for (const button of await toolbar.locator(".icon-button").all())
        expect(
          (await button.innerText()).trim(),
          `${tool} icon-button text`,
        ).toBe("");
      for (const name of ["Undo", "Redo"]) {
        const box = await toolbar
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(box?.width, `${tool} ${name} width`).toBeGreaterThanOrEqual(44);
        expect(box?.height, `${tool} ${name} height`).toBeGreaterThanOrEqual(
          44,
        );
      }
      expect(
        await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${tool} toolbar fits without overflow`,
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${tool} fits the phone width`,
      ).toBe(true);
    }
    await context.close();
  });
test("editor text boxes and dropdowns have edges with at least 3:1 contrast", async ({
  page,
}) => {
  for (const tool of editors) {
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(".booklet-editor").first()).toBeVisible();
    await expect(page.locator(".booklet-editor select").first()).toBeVisible();
    const faint = await page.evaluate(() => {
      const rgb = (c: string) => c.match(/[\d.]+/g)!.map(Number);
      const lum = (c: string) => {
        const [r, g, b] = rgb(c)
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const behind = (e: Element) => {
        for (let n = e.parentElement; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (rgb(c)[3] !== 0) return c;
        }
        return "rgb(255, 255, 255)";
      };
      const skip = ["checkbox", "radio", "range", "file", "color", "hidden"];
      return [
        ...document.querySelectorAll(
          ".booklet-editor :is(input, select, textarea)",
        ),
      ]
        .filter(
          (e) =>
            (e as HTMLElement).offsetParent &&
            !skip.includes((e as HTMLInputElement).type) &&
            !e.closest(".ratio-edit-layer") &&
            parseFloat(getComputedStyle(e).borderTopWidth) > 0,
        )
        .map((e) => {
          const [a, b] = [
            lum(getComputedStyle(e).borderTopColor),
            lum(behind(e)),
          ];
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          return { field: e.outerHTML.slice(0, 80), ratio };
        })
        .filter((f) => f.ratio < 3);
    });
    expect(faint, tool).toEqual([]);
  }
});

test("on desktop, keyboard users can jump from the preview bar to the settings and back without tabbing through the diagram", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const tool of editors) {
    await page.goto(`/tools/${tool}`);
    const jump = page.getByRole("button", { name: "Edit settings ↓", exact: true });
    // Out of sight until a keyboard reaches it: the settings are already beside the resource.
    expect((await jump.boundingBox())?.width ?? 0, `${tool} hidden jump`).toBeLessThanOrEqual(1);
    await page.getByRole("combobox", { name: "Preview zoom", exact: true }).focus();
    for (let i = 0; i < 3 && !(await jump.evaluate(el => el === document.activeElement)); i++)
      await page.keyboard.press("Tab");
    await expect(jump, `${tool}: the jump follows the zoom control`).toBeFocused();
    const shown = (await jump.boundingBox())!;
    expect(shown.height, `${tool} visible jump height`).toBeGreaterThanOrEqual(40);
    expect(shown.width, `${tool} visible jump width`).toBeGreaterThan(60);
    await page.keyboard.press("Enter");
    await expect(page.locator(".inspector-stack").first(), `${tool} settings focused`).toBeFocused();

    const back = page.getByRole("button", { name: "↑ Return to diagram", exact: true });
    await back.focus();
    expect((await back.boundingBox())!.height, `${tool} visible return height`).toBeGreaterThanOrEqual(40);
    await page.keyboard.press("Enter");
    await expect(page.locator(".editor-card").first(), `${tool} diagram focused`).toBeFocused();
  }
});
