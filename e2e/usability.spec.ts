import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { clickResourceAction } from "./resource-actions";

const tools = [
  [
    "graph",
    "maths-booklet-tools:graph-envelope:v1",
    ".graph-canvas",
    ".graph-stage",
    "Replace graph",
  ],
  [
    "ratio-table",
    "maths-booklet-tools:ratio-table-envelope:v1",
    ".ratio-paper",
    ".ratio-stage",
    "Replace table",
  ],
  [
    "value-table-graph",
    "mathsdock:value-table-graph:v1",
    ".vg-paper",
    ".vg-scroll",
    "Continue",
  ],
  [
    "cuboids",
    "maths-booklet-tools:cuboids:v1",
    "[data-testid=cuboid-resource]",
    ".cb-scroll",
    "Use these cuboids",
  ],
  [
    "number-line",
    "maths-booklet-tools:number-line:v1",
    "[data-testid=number-line-resource]",
    ".nl-scroll",
    "Open resource",
  ],
  [
    "venn",
    "maths-booklet-tools:venn:v1",
    "[data-testid=venn-resource]",
    ".vn-scroll",
    "Use this diagram",
  ],
  [
    "triangle",
    "maths-booklet-tools:triangle:v1",
    ".tr-resource",
    ".tr-scroll",
    "Use this diagram",
  ],
  [
    "expanding-factorising",
    "maths-booklet-tools:algebra-grid:v1",
    ".ag-resource",
    ".ag-scroll",
    "Apply replacement",
  ],
] as const;
const saved = (page: Page, key: string) =>
  page.evaluate((key) => localStorage.getItem(key), key);

test("overview search matches teaching vocabulary, handles no results and retains all destinations", async ({
  page,
}) => {
  await page.goto("/?tool=booklet-tools");
  await expect(page.locator(".overview-tool-card")).toHaveCount(9);
  expect(await page.locator(".overview-tool-card").evaluateAll(cards => cards.map(card => card.getAttribute("href")).sort())).toEqual([...tools.map(([tool]) => `?tool=${tool}`), "?tool=bar-model"].sort());
  await page.getByRole("searchbox", { name: "Search tools" }).fill("sharing");
  await expect(page.locator(".overview-tool-card")).toHaveAttribute("href", "?tool=bar-model");
  await page
    .getByRole("searchbox", { name: "Search tools" })
    .fill("Pythagoras");
  await expect(page.locator(".overview-tool-card")).toHaveCount(1);
  await expect(page.locator(".overview-tool-card")).toHaveAttribute(
    "href",
    "?tool=triangle",
  );
  await page.getByRole("searchbox").fill("inequalities");
  await expect(page.locator(".overview-tool-card")).toHaveAttribute(
    "href",
    "?tool=number-line",
  );
  await page.getByRole("searchbox").fill("not-a-teaching-tool");
  await expect(page.getByRole("status")).toContainText("No tools found");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".overview-tool-card")).toHaveCount(9);
  await page.getByRole("link", { name: "Maths Dock home" }).click();
  await expect(page.locator(".overview-card")).toHaveCount(4);
});

for (const [tool, key, resource, stage, confirm] of tools) {
  for (const width of [1280, 768, 320])
    test(`${tool}: whole resource fit, fixed controls and preview-only zoom at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/?tool=${tool}`);
      const zoom = page.getByRole("combobox", {
        name: "Preview zoom",
        exact: true,
      });
      await expect(zoom).toHaveValue("0");
      await expect.poll(() => saved(page, key)).not.toBeNull();
      const before = await saved(page, key);
      const paper = page.locator(resource).first(),
        viewport = page.locator(stage).first();
      await expect(paper).toBeVisible();
      const box = await paper.boundingBox(),
        view = await viewport.boundingBox();
      expect(box!.width).toBeGreaterThan(20);
      expect(box!.height).toBeGreaterThan(8);
      expect(box!.x).toBeGreaterThanOrEqual(view!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        view!.x + view!.width + 1,
      );
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        view!.y + view!.height + 1,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await zoom.selectOption("1.5");
      await expect.poll(() => saved(page, key)).toBe(before);
      await zoom.selectOption("0");
      await expect.poll(() => saved(page, key)).toBe(before);
      if (tool === "expanding-factorising" && width === 320) {
        expect(
          (await page.locator(".ag-preview-bar").boundingBox())!.height,
        ).toBeLessThan(240);
      }
      if (width === 320) {
        await page.getByRole("button", { name: "Edit settings ↓" }).click();
        await expect(page.locator(".inspector-stack")).toBeFocused();
        await page.getByRole("button", { name: "↑ Return to diagram" }).click();
        await expect(page.locator(".editor-card")).toBeFocused();
      }
    });

  test(`${tool}: real gallery, safe replacement, Undo and immediate worked replacement`, async ({
    page,
  }) => {
    await page.goto(`/?tool=${tool}`);
    await expect.poll(() => saved(page, key)).not.toBeNull();
    const before = await saved(page, key);
    const launch = page.getByRole("button", {
      name: "Start from an example",
      exact: true,
    });
    await launch.click();
    const gallery = page.getByRole("dialog", {
      name: "Start from an example",
      exact: true,
    });
    await expect(gallery).toBeVisible();
    const card =
      tool === "value-table-graph"
        ? gallery.locator('[data-example-id="quadratic-1MA1_NOV_2018_3H_Q3"]')
        : gallery.locator("article").first();
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    await card
      .getByRole("button", {
        name: /Open scaffold|Open blank grid|Open diagram/,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(await saved(page, key)).toBe(before);
    await launch.click();
    await card
      .getByRole("button", {
        name: /Open scaffold|Open blank grid|Open diagram/,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: confirm, exact: true })
      .click();
    await expect.poll(() => saved(page, key)).not.toBe(before);
    const scaffold = await saved(page, key);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(before);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(scaffold);
    await launch.click();
    // The first Ratio teaching example deliberately offers no automatic calculation.
    const workedCard = gallery
      .locator("article")
      .filter({
        has: page.getByRole("button", {
          name: "Use worked version",
          exact: true,
        }),
      })
      .first();
    const pagesBefore = page.context().pages().length;
    await workedCard
      .getByRole("button", { name: "Use worked version", exact: true })
      .click();
    await expect(gallery).not.toBeVisible();
    await expect.poll(() => saved(page, key)).not.toBe(scaffold);
    const worked = await saved(page, key);
    expect(page.context().pages()).toHaveLength(pagesBefore);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(scaffold);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(worked);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(scaffold);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(before);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(() => saved(page, key)).toBe(scaffold);
    const downloadPromise = page.waitForEvent("download");
    await clickResourceAction(page, "Save editable file");
    const raw = await readFile((await (await downloadPromise).path())!, "utf8");
    // Graph's saved canonical envelope excludes transient selection; other tools agree directly.
    expect(JSON.parse(raw)).toEqual(JSON.parse(scaffold!));
  });
}

test("number-line quick input preserves teaching state, supports exact range drafts, cancels replacement and undoes atomically", async ({
  page,
}) => {
  await page.goto("/?tool=number-line");
  const key = "maths-booklet-tools:number-line:v1";
  await expect.poll(() => saved(page, key)).not.toBeNull();
  const original = await saved(page, key);
  await page
    .getByRole("textbox", { name: "Inequality or value", exact: true })
    .fill("-3 < x <= 1");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Apply drawing", exact: true })
    .click();
  await expect(
    page.getByText("Drawing: -3 < x ≤ 1", { exact: false }),
  ).toBeVisible();
  const first = await saved(page, key);
  await page
    .getByRole("textbox", { name: "Inequality or value", exact: true })
    .fill("x >= 8");
  await page
    .getByRole("button", { name: "Apply drawing", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("visible range");
  await page
    .getByRole("button", { name: "Edit axis range", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Notation maximum", exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Apply drawing", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await saved(page, key)).toBe(first);
  await expect(
    page.getByRole("textbox", { name: "Inequality or value", exact: true }),
  ).toHaveValue("x >= 8");
  await page
    .getByRole("button", { name: "Apply drawing", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace current drawing", exact: true })
    .click();
  await expect
    .poll(
      async () => JSON.parse((await saved(page, key))!).document.axis.maximum,
    )
    .toBe("10");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => saved(page, key)).toBe(first);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => saved(page, key)).toBe(original);
});

test("invalid notation survives tool navigation; Escape restores exports and modal keys cannot undo background work", async ({
  page,
}) => {
  await page.goto("/?tool=number-line");
  const field = page.getByRole("textbox", {
    name: "Inequality or value",
    exact: true,
  });
  await field.fill("x != 2");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("not supported");
  await page.getByRole("link", { name: "Triangles", exact: true }).click();
  await page.getByRole("link", { name: "Number lines", exact: true }).click();
  await expect(field).toHaveValue("x != 2");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await field.press("Escape");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Point", exact: true }).click();
  await page.getByRole("button", { name: "Tick 1", exact: true }).click();
  const key = "maths-booklet-tools:number-line:v1";
  const before = await saved(page, key);
  await page
    .getByRole("button", { name: "Start from an example", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .press("Control+z");
  expect(await saved(page, key)).toBe(before);
});

test("typed straight-line input edits existing models, rejects nonlinear drafts and leaves other objects unchanged", async ({
  page,
}) => {
  await page.goto("/?tool=graph");
  const key = "maths-booklet-tools:graph-envelope:v1";
  await expect.poll(() => saved(page, key)).not.toBeNull();
  const before = await saved(page, key);
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Type equation", exact: true })
    .click();
  const field = page.getByRole("textbox", {
    name: "Line equation",
    exact: true,
  });
  await field.fill("y=x^2");
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("not supported");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await field.fill("y = 1/2x - 2");
  await field.press("Enter");
  await expect
    .poll(
      async () => JSON.parse((await saved(page, key))!).document.objects.length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => saved(page, key)).toBe(before);
});
