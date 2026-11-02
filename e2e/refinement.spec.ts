import { test, expect, type Page } from "./release-fixtures";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";

const report = resolve(
  process.env.MATHSDOCK_REFINEMENT_REPORT ||
    "test-results/usability-refinement",
);
const tools = [
  [
    "graph",
    "maths-booklet-tools:graph-envelope:v1",
    ".graph-canvas",
    ".graph-stage",
  ],
  [
    "ratio-table",
    "maths-booklet-tools:ratio-table-envelope:v1",
    ".ratio-paper",
    ".ratio-stage",
  ],
  [
    "value-table-graph",
    "mathsdock:value-table-graph:v1",
    ".vg-paper",
    ".vg-scroll",
  ],
  [
    "cuboids",
    "maths-booklet-tools:cuboids:v1",
    "[data-testid=cuboid-resource]",
    ".cb-scroll",
  ],
  [
    "number-line",
    "maths-booklet-tools:number-line:v1",
    "[data-testid=number-line-resource]",
    ".nl-scroll",
  ],
  [
    "venn",
    "maths-booklet-tools:venn:v1",
    "[data-testid=venn-resource]",
    ".vn-scroll",
  ],
  ["triangle", "maths-booklet-tools:triangle:v1", ".tr-resource", ".tr-scroll"],
  [
    "expanding-factorising",
    "maths-booklet-tools:algebra-grid:v1",
    ".ag-resource",
    ".ag-scroll",
  ],
] as const;
async function download(page: Page, name: string) {
  await page
    .getByRole("button", { name: /^(File|Download options)$/, exact: true })
    .click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("menuitem", { name, exact: true }).click();
  const file = await waiting;
  expect(await file.failure()).toBeNull();
  return readFile((await file.path())!);
}
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

for (const [tool, key, paper, stage] of tools) {
  test(`${tool}: unchanged actual SVG, print PNG and editable output versus retained build`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    // Controls were captured from the independently retained, qualified baseline.
    // Hash actual SVG downloads to retain byte-exact artwork acceptance without a
    // second localhost server or a machine-specific report directory in CI.
    const fixture = resolve("e2e/fixtures/usability-refinement");
    const source = await readFile(resolve(fixture, `${tool}.json`));
    const recorded = JSON.parse(
      await readFile(resolve(fixture, "manifest.json"), "utf8"),
    )[tool];
    // Cuboids already measures text bounds through browser getBBox. Its exact
    // Linux crop differs from Windows; the retained platform control changes
    // only the root/background crop, with every drawable/font byte identical.
    const controls = { ...recorded, ...recorded.platforms?.[process.platform] };
    expect(hash(source)).toBe(controls.source);
    const originalBox = controls.before;
    await page.goto(`/?tool=${tool}`);
    await page.evaluate(({ key, text }) => localStorage.setItem(key, text), {
      key,
      text: source.toString(),
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    expect(
      JSON.parse((await download(page, "Save editable file")).toString()),
    ).toEqual(JSON.parse(source.toString()));
    const finalSvg = await download(page, "Download SVG"),
      finalPng = await download(page, "Download PNG (600 ppi)");
    expect(hash(finalSvg)).toBe(controls.svg);
    verifyPrintBytes(finalPng, controls.pngWidth, controls.pngHeight);
    // PNG encoding varies across browser/OS builds. Compare every RGBA byte
    // against the independently hash-verified baseline SVG in this browser,
    // retaining the original physical raster dimensions and 600ppi metadata.
    const differentChannels = await page.evaluate(
      async ({ svg, png, width, height }) => {
        async function pixels(blob: Blob) {
          const image = new Image(),
            url = URL.createObjectURL(blob);
          try {
            image.src = url;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);
            return ctx.getImageData(0, 0, width, height).data;
          } finally {
            URL.revokeObjectURL(url);
          }
        }
        const reference = await pixels(
          new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        );
        const actual = await pixels(
          await (await fetch(`data:image/png;base64,${png}`)).blob(),
        );
        let differences = 0;
        for (let i = 0; i < reference.length; i++)
          if (reference[i] !== actual[i]) differences++;
        return differences;
      },
      {
        svg: finalSvg.toString(),
        png: finalPng.toString("base64"),
        width: controls.pngWidth,
        height: controls.pngHeight,
      },
    );
    expect(differentChannels).toBe(0);
    const box = await page.locator(paper).first().boundingBox();
    if (["graph", "value-table-graph"].includes(tool))
      expect(box!.height).toBeGreaterThan(originalBox!.height * 1.1);
    await mkdir(resolve(report, "exports"), { recursive: true });
    await writeFile(resolve(report, `exports/${tool}.json`), source);
    await writeFile(resolve(report, `exports/${tool}.svg`), finalSvg);
    await writeFile(resolve(report, `exports/${tool}.png`), finalPng);
    await writeFile(
      resolve(report, `exports/${tool}-proof.json`),
      JSON.stringify(
        {
          source: hash(source),
          svg: hash(finalSvg),
          png: hash(finalPng),
          svgEqual: true,
          pngPixelsMatchBaselineSvg: true,
          pngBytesMatchRecordedPlatform: hash(finalPng) === controls.png,
          before: originalBox,
          after: box,
        },
        null,
        2,
      ),
    );
  });
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [375, 812],
    [320, 740],
  ])
    test(`${tool}: usable fit, white surround and file controls at ${width}x${height}`, async ({
      page,
    }) => {
      await mkdir(resolve(report, "visual"), { recursive: true });
      await page.setViewportSize({ width, height });
      await page.goto(`/?tool=${tool}`);
      await page.evaluate(() => document.fonts.ready);
      const resource = page.locator(paper).first(),
        viewport = page.locator(stage);
      // Lazy-loaded pages fit the resource after first paint: measure once the layout has settled.
      await expect
        .poll(async () => {
          const before = JSON.stringify([
            await resource.boundingBox(),
            await viewport.boundingBox(),
          ]);
          await page.evaluate(
            () =>
              new Promise((done) =>
                requestAnimationFrame(() => requestAnimationFrame(done)),
              ),
          );
          return (
            before ===
            JSON.stringify([
              await resource.boundingBox(),
              await viewport.boundingBox(),
            ])
          );
        })
        .toBe(true);
      const box = await resource.boundingBox(),
        view = await viewport.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(view!.x + 7);
      expect(box!.y).toBeGreaterThanOrEqual(view!.y + 7);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        view!.x + view!.width - 7,
      );
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        view!.y + view!.height - 7,
      );
      if (width > 900)
        expect(view!.y + view!.height).toBeLessThanOrEqual(height + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (tool === "number-line") {
        for (const control of await page.locator(".nl-range button").all()) {
          const bounds = await control.boundingBox();
          expect(bounds!.width).toBe(48);
          expect(bounds!.height).toBe(48);
          expect(bounds!.y).toBeGreaterThanOrEqual(view!.y);
          expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
            view!.y + view!.height,
          );
        }
      }
      const buttons = page
        .getByRole("group", { name: "Resource utilities", exact: true })
        .getByRole("button");
      expect(await buttons.allTextContents()).toEqual([
        "",
        "",
        "Reset",
        "Copy image",
        "Copy for Word",
        "File ",
      ]);
      await page.screenshot({
        path: resolve(report, `visual/${tool}-${width}x${height}.png`),
      });
      const file = page.getByRole("button", { name: "File", exact: true });
      await file.press("ArrowDown");
      await expect(page.getByRole("menu")).toBeVisible();
      await page.getByRole("menuitem").first().press("Escape");
      await expect(file).toBeFocused();
    });
}

test("typed input is one click away with the cursor in it, and cancel restores a fresh usable form", async ({
  page,
}) => {
  await page.goto("/tools/graph");
  const line = page.getByRole("textbox", {
    name: "Line equation",
    exact: true,
  });
  // The form opens on request (not on load), with the cursor already in the equation.
  await expect(line).toHaveCount(0);
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await expect(line).toBeVisible();
  await expect(line).toBeFocused();
  const box = await line.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(720);
  await line.fill("y = x²");
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await expect(line).toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("button", { name: "Cancel equation edit", exact: true })
    .click();
  // Cancel closes the form and returns focus to its button; reopening gives a fresh form.
  await expect(line).toHaveCount(0);
  const open = page.getByRole("button", {
    name: "Line by equation",
    exact: true,
  });
  await expect(open).toBeFocused();
  await open.click();
  await expect(line).toHaveValue("y = x");
  await expect(line).toHaveAttribute("aria-invalid", "false");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Number lines", exact: true }).click();
  const input = page.getByRole("textbox", {
    name: "Inequality or value",
    exact: true,
  });
  await expect(input).toBeVisible();
  await input.fill("x != 1");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
});

for (const width of [1280, 375, 320])
  test(`Triangle grouped edit is docked, cancellable and keyboard accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/tools/triangle");
    const key = "maths-booklet-tools:triangle:v1";
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
      .not.toBeNull();
    const before = await page.evaluate((k) => localStorage.getItem(k), key);
    await page
      .getByRole("button", { name: "Edit side ab", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Edit Side AB",
      exact: true,
    });
    await expect(editor).toBeVisible();
    expect(
      await editor.evaluate((el) => !!el.closest(".inspector-stack")),
    ).toBe(true);
    const panel = await editor.boundingBox(),
      paper = await page.locator(".tr-resource").boundingBox();
    if (width > 900) expect(panel!.x).toBeGreaterThan(paper!.x + paper!.width);
    await editor
      .getByRole("radio", { name: "Unknown (x)", exact: true })
      .check();
    await editor.getByRole("textbox").fill("h");
    const cancel = editor.getByRole("button", {
      name: "Cancel label",
      exact: true,
    });
    await expect(cancel).toBeInViewport();
    await page.screenshot({
      path: resolve(report, `visual/triangle-edit-${width}.png`),
    });
    await cancel.click();
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
      before,
    );
    await page
      .getByRole("button", { name: "Edit side ab", exact: true })
      .click();
    await editor
      .getByRole("radio", { name: "Unknown (x)", exact: true })
      .check();
    await editor.getByRole("textbox").fill("h");
    await editor
      .getByRole("button", { name: "Apply label", exact: true })
      .click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
      .toBe(before);
  });
