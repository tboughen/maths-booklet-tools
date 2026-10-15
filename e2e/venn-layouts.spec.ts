import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import {
  create,
  createExtended,
  changeArrangement,
  upgrade,
  canonical,
  activeMasks,
  geometry,
  type Envelope,
  type Arrangement,
} from "../packages/venn-core/src";
import { teachingExamples } from "../packages/venn-core/src/examples";
import {
  printRasterSize,
  verifyPrintBytes,
} from "../packages/graph-core/src/png-bytes";
const report = resolve(
  process.env.VENN_REPORT_DIR ??
    "test-results/venn-artifacts",
);
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:venn:v1";
async function boot(page: Page, e: Envelope = create()) {
  await page.addInitScript(
    ([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    },
    [key, canonical(e)],
  );
  await page.goto("/?tool=venn");
  await expect(
    page.getByRole("heading", { name: "Venn diagrams", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page): Promise<Envelope> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function confirm(page: Page) {
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
}
async function download(page: Page, label: string, name: string) {
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).click();
  const path = resolve(report, name);
  await (await promise).saveAs(path);
  return path;
}

test("layout conversion protects hidden data, cancellation, Undo and Redo", async ({
  page,
}) => {
  const e = create();
  e.document.regions[1] = {
    kind: "number",
    text: "-2/4",
    visibility: "line",
    shade: "hatch",
  };
  e.document.regions[2] = {
    kind: "frequency",
    text: "0",
    visibility: "hidden",
    shade: "grey",
  };
  e.document.regions[3] = {
    kind: "algebra",
    text: "3x + 2",
    visibility: "hidden",
    shade: "grey",
  };
  await boot(page, e);
  await page.getByRole("button", { name: "Separate", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("A and B");
  await expect(page.getByRole("dialog")).toContainText("hidden answers");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(e);
  await page.getByRole("button", { name: "Separate", exact: true }).click();
  await confirm(page);
  expect((await saved(page)).document.regions[2]).toEqual(
    e.document.regions[2],
  );
  await expect(page.locator("[data-region-hit]")).toHaveCount(3);
  await expect(page.locator('[data-region-hit="3"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(e);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Nested", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("B, outside A");
  await confirm(page);
  expect((await saved(page)).document.regions[2].text).toBe("");
  expect((await saved(page)).document.regions[1]).toEqual(
    e.document.regions[1],
  );
  await expect(page.locator('[data-region-hit="2"]')).toHaveCount(0);
  await page.reload();
  expect((await saved(page)).schemaVersion).toBe(2);
  await expect(
    page.getByRole("button", { name: "Nested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("one-set count change starts blank only after confirmation and Undo recovers all values", async ({
  page,
}) => {
  const e = teachingExamples.find((x) => x.id === "nested")!.make(false);
  await boot(page, e);
  await page.getByLabel("Number of sets", { exact: true }).selectOption("1");
  await expect(page.getByRole("dialog")).toContainText(
    "No values are combined",
  );
  await page.keyboard.press("Escape");
  expect(await saved(page)).toEqual(e);
  await page.getByLabel("Number of sets", { exact: true }).selectOption("1");
  await confirm(page);
  const one = await saved(page);
  expect(one.document.regions.every((r) => r.kind === "empty")).toBe(true);
  expect(one.document.definitions).toEqual(e.document.definitions);
  await expect(page.locator("[data-region-hit]")).toHaveCount(2);
  await expect(page.locator('[aria-label="Edit set B label"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(e);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.locator('[data-region-hit="1"]').click();
  await page.getByLabel("Region content", { exact: true }).fill("2,4");
  await page.getByLabel("Region content", { exact: true }).press("Enter");
  await page.getByLabel("Number of sets", { exact: true }).selectOption("2");
  await expect(page.getByRole("dialog")).toBeVisible();
  await confirm(page);
  expect(
    (await saved(page)).document.regions.every((r) => r.kind === "empty"),
  ).toBe(true);
});

test("one-set default complement and absent-set errors; impossible intersection feedback", async ({
  page,
}) => {
  await boot(page, createExtended(1));
  await page.getByRole("button", { name: "Shade", exact: true }).click();
  await page
    .getByRole("button", { name: "Shade a set expression", exact: true })
    .click();
  await expect(page.getByLabel("Set expression", { exact: true })).toHaveValue(
    "A'",
  );
  await page.getByLabel("Set expression", { exact: true }).fill("B");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".vn-floating [role=alert]")).toContainText("A");
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Number of sets", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Set expression", { exact: true }).fill("A'");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await saved(page)).document.regions[0].shade).toBe("grey");
  await page.getByLabel("Number of sets", { exact: true }).selectOption("2");
  await confirm(page);
  await page.getByRole("button", { name: "Separate", exact: true }).click();
  await page
    .getByRole("button", { name: "Shade a set expression", exact: true })
    .click();
  await page.getByLabel("Set expression", { exact: true }).fill("A ∩ B");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText(/This expression has no region/)).toBeVisible();
  expect(
    (await saved(page)).document.regions.every((r) => r.shade === "none"),
  ).toBe(true);
});

test("caption choices, nested label edits, view export and editable-file presentation preservation", async ({
  page,
}) => {
  const e = upgrade(
    teachingExamples.find((x) => x.id === "nested")!.make(false),
  );
  e.document.regions[1].visibility = "line";
  await boot(page, e);
  const original = canonical(await saved(page));
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .check();
  await expect(page.locator('.vn-art [data-region="1"]')).toHaveText("2,6,10");
  expect(canonical(await saved(page))).toBe(original);
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  const svg = readFileSync(
    await download(page, "Download SVG", "answer-view.svg"),
    "utf8",
  );
  expect(svg).toContain(">10</text>");
  const file = await download(
    page,
    "Save editable file",
    "pupil-settings.json",
  );
  expect(readFileSync(file, "utf8")).toBe(original);
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .uncheck();
  await expect(page.locator('.vn-art [data-region="1"]')).toHaveText("");
  await page
    .getByLabel("Relationship caption", { exact: true })
    .selectOption("relationship");
  await expect(page.locator(".vn-art svg")).toContainText("B ⊆ A");
  await page
    .getByLabel("Relationship caption", { exact: true })
    .selectOption("line");
  await expect(page.locator(".vn-art svg")).not.toContainText("⊆");
  const captioned = await saved(page);
  await page.reload();
  expect(await saved(page)).toEqual(captioned);
  await page
    .getByRole("button", { name: "Edit outer set label", exact: true })
    .click();
  await page.getByLabel("Label text", { exact: true }).fill("Whole");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await saved(page)).document.regions).toEqual(
    captioned.document.regions,
  );
  await expect(page.locator('[data-region-hit="1"]')).toHaveCount(1);
  await expect(page.locator('[data-region-hit="2"]')).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles(file);
  await confirm(page);
  await expect(
    page.getByRole("checkbox", { name: "Show saved answers", exact: true }),
  ).not.toBeChecked();
  expect(canonical(await saved(page))).toBe(original);
});

for (const ex of teachingExamples)
  test(`actual editable/SVG/600ppi/clipboard/Word outputs: ${ex.id}`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const e = upgrade(ex.make(true));
    if (e.document.arrangement !== "overlap")
      e.document.caption = "relationship";
    await boot(page, e);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Download options", exact: true })
      .click();
    const svgPath = await download(page, "Download SVG", `${ex.id}.svg`);
    const svg = readFileSync(svgPath, "utf8");
    expect(svg).toContain("data:font/otf;base64");
    expect(svg).not.toContain("vn-hit");
    expect(svg).not.toContain("Teacher");
    const rendered = new Resvg(svg, {
      font: {
        fontFiles: [
          "STIXTwoText-Regular.otf",
          "STIXTwoText-Italic.otf",
          "STIXTwoMath-Regular.otf",
        ].map((n) => resolve("assets/graph-fonts", n)),
        loadSystemFonts: false,
      },
    }).render();
    writeFileSync(
      resolve(report, `${ex.id}-independent.png`),
      rendered.asPng(),
    );
    const pngPath = await download(
      page,
      "Download PNG (600 ppi)",
      `${ex.id}-600ppi.png`,
    );
    const g = geometry(e),
      size = printRasterSize(g.width / 10, g.height / 10);
    verifyPrintBytes(readFileSync(pngPath), size.width, size.height);
    const file = await download(page, "Save editable file", `${ex.id}.json`);
    expect(readFileSync(file, "utf8")).toBe(canonical(e));
    await page
      .getByRole("button", { name: "Copy to clipboard", exact: true })
      .click();
    await expect(
      page.getByText("Resource ready.", { exact: true }),
    ).toBeVisible();
    const image = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      const i = items.find((x) => x.types.includes("image/png"))!;
      return Array.from(
        new Uint8Array(await (await i.getType("image/png")).arrayBuffer()),
      );
    });
    writeFileSync(
      resolve(report, `${ex.id}-clipboard.png`),
      Buffer.from(image),
    );
    await page
      .getByRole("button", { name: "Copy for Word", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Copy for Word", exact: true }),
    ).toBeEnabled();
    const html = await page.evaluate(async () => {
      for (const i of await navigator.clipboard.read())
        if (i.types.includes("text/html"))
          return (await i.getType("text/html")).text();
      return "";
    });
    expect(html).toContain(`width="${g.width / 10}cm"`);
    expect(html).toContain(`height="${g.height / 10}cm"`);
    // Chrome serializes CSS centimetres to six significant digits; check the
    // actual physical sizes separately from the unrounded HTML attributes.
    expect(Number(html.match(/width: ([\d.]+)cm/)?.[1])).toBeCloseTo(
      g.width / 10,
      4,
    );
    expect(Number(html.match(/height: ([\d.]+)cm/)?.[1])).toBeCloseTo(
      g.height / 10,
      4,
    );
    expect(html).toContain("data:image/png;base64");
    writeFileSync(resolve(report, `${ex.id}-word.html`), html);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(report, `${ex.id}-desktop.png`),
      fullPage: true,
    });
    await page.locator("input[type=file]").setInputFiles(file);
    await confirm(page);
    expect(await saved(page)).toEqual(e);
  });

for (const width of [320, 375, 768, 1440])
  test(`new structure controls and focused nested editors at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(
      page,
      teachingExamples.find((x) => x.id === "nested")!.make(false),
    );
    await page
      .getByRole("checkbox", { name: "Show saved answers", exact: true })
      .check();
    for (const mask of [0, 1, 3]) {
      await page.locator(`[data-region-hit="${mask}"]`).click();
      const box = (await page.locator(".vn-floating").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      await expect(
        page.getByRole("button", { name: "Apply", exact: true }),
      ).toBeInViewport();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(report, `nested-${width}.png`),
      fullPage: true,
    });
  });

for (const value of ["one", "separate", "b-inside-a", "a-inside-b"] as const)
  test(`independent shading pixels across all atomic regions: ${value}`, async ({
    page,
  }) => {
    let e: Envelope =
      value === "one"
        ? createExtended(1)
        : changeArrangement(create(), value as Arrangement);
    for (const shape of ["circles", "ovals"] as const)
      for (const mask of activeMasks(e)) {
        e = structuredClone(e);
        e.document.shape = shape;
        e.document.regions.forEach(
          (r, i) => (r.shade = i === mask ? "grey" : "none"),
        );
        await page.goto("/?tool=venn");
        await page.evaluate(
          ([k, v]) => localStorage.setItem(k, v),
          [key, canonical(e)],
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Download options", exact: true })
          .click();
        const path = await download(
          page,
          "Download SVG",
          `layout-mask-${value}-${shape}-${mask}.svg`,
        );
        const raster = new Resvg(readFileSync(path, "utf8")).render(),
          g = geometry(e),
          pixels = raster.pixels;
        // Independent point classification over the export, not the renderer's mask paths.
        let points = 0;
        for (let y = 12; y < 80; y += 4)
          for (let x = 8; x < 114; x += 4) {
            let actual = 0,
              boundary = false;
            g.circles.forEach((c, i) => {
              const q = ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2;
              if (Math.abs(q - 1) < 0.15) boundary = true;
              if (q < 1) actual |= 1 << i;
            });
            if (
              boundary ||
              g.labelPoints.some((p) => Math.hypot(x - p.x, y - p.y) < 9)
            )
              continue;
            const off =
              (Math.round((y / g.height) * raster.height) * raster.width +
                Math.round((x / g.width) * raster.width)) *
              4;
            expect(pixels[off]).toBe(actual === mask ? 216 : 255);
            points++;
          }
        expect(points).toBeGreaterThan(100);
        writeFileSync(
          resolve(report, `layout-mask-${value}-${shape}-${mask}.png`),
          raster.asPng(),
        );
      }
  });

test("teaching scaffold UI and Answer view retain undoable original document", async ({
  page,
}) => {
  await boot(page);
  await page.getByText("Examples", { exact: true }).click();
  const card = page
    .locator("article")
    .filter({ hasText: "One set · even numbers" });
  await card
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await confirm(page);
  const e = await saved(page);
  expect(e.document.sets).toBe(1);
  await expect(page.locator('.vn-art [data-region="1"]')).toHaveText("");
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .check();
  expect(
    (await page.locator('.vn-art [data-region="1"]').textContent())!.replace(
      /,/g,
      "",
    ),
  ).toContain("24681012");
  await page.getByRole("link", { name: "Ratio tables", exact: true }).click();
  await page.getByRole("link", { name: "Venn diagrams", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Show saved answers", exact: true }),
  ).toBeChecked();
  expect(await saved(page)).toEqual(e);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).schemaVersion).toBe(1);
});

test("answer-view label overflow is retained and correctable without exposing pupil answers", async ({
  page,
}) => {
  const e = upgrade(changeArrangement(create(), "b-inside-a"));
  e.document.labels[2] = {
    text: "ABCDEFGHIJKLMNOPQRSTUVWX",
    visibility: "hidden",
  };
  await boot(page, e);
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .check();
  await expect(page.getByRole("alert")).toContainText("inner set label");
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save editable file", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Edit inner set label", exact: true })
    .click();
  await page.getByLabel("Label text", { exact: true }).fill("Multiples of 4");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect((await saved(page)).document.labels[2].visibility).toBe("hidden");
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .uncheck();
  await expect(page.locator(".vn-art svg")).not.toContainText("Multiples of 4");
});

test("actual 40-member nested exports fit around both labels in circles and ovals", async ({
  page,
}) => {
  const e = upgrade(changeArrangement(create(), "b-inside-a"));
  e.document.widthCm = 16;
  e.document.fontPt = 9;
  e.document.definitions = [
    "ξ = {integers from 1 to 40}",
    "A = {integers from 17 to 40}",
    "B = {integers from 31 to 40}",
    "",
  ];
  e.document.showDefinitions = true;
  let n = 1;
  [0, 1, 3].forEach(
    (m, i) =>
      (e.document.regions[m] = {
        kind: "members",
        text: Array.from({ length: [16, 14, 10][i] }, () => String(n++)).join(
          ",",
        ),
        visibility: "show",
        shade: "none",
      }),
  );
  await boot(page, e);
  for (const shape of ["circles", "ovals"]) {
    await page.getByLabel("Outline", { exact: true }).selectOption(shape);
    await expect(page.getByRole("alert")).toHaveCount(0);
    if (shape === "circles")
      await page
        .getByRole("button", { name: "Download options", exact: true })
        .click();
    const path = await download(page, "Download SVG", `nested-40-${shape}.svg`);
    const raster = new Resvg(readFileSync(path, "utf8"), {
      font: {
        fontFiles: [
          "STIXTwoText-Regular.otf",
          "STIXTwoText-Italic.otf",
          "STIXTwoMath-Regular.otf",
        ].map((s) => resolve("assets/graph-fonts", s)),
        loadSystemFonts: false,
      },
    }).render();
    writeFileSync(resolve(report, `nested-40-${shape}.png`), raster.asPng());
  }
});

test("single Nested choice reopens reverse-nested files exactly and label edits preserve every region", async ({
  page,
}) => {
  const e = upgrade(
    teachingExamples.find((x) => x.id === "reverse-nested")!.make(false),
  );
  e.document.caption = "relationship";
  e.document.regions[2].shade = "hatch";
  const original = canonical(e);
  await boot(page, e);
  await expect(
    page
      .getByRole("group", { name: "Set arrangement", exact: true })
      .getByRole("button"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Nested", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Nested", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page
    .getByRole("button", { name: "Edit outer set label", exact: true })
    .click();
  await page.getByLabel("Label text", { exact: true }).fill("Whole");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit inner set label", exact: true })
    .click();
  await page.getByLabel("Label text", { exact: true }).fill("Part");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const edited = await saved(page);
  expect(edited.document.regions).toEqual(e.document.regions);
  expect(edited.document.labels[2].text).toBe("Whole");
  expect(edited.document.labels[1].text).toBe("Part");
  await page.getByRole("tab", { name: "Diagram", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .check();
  await expect(page.locator(".vn-art svg")).toContainText("Part ⊆ Whole");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page.reload();
  expect(canonical(await saved(page))).toBe(original);
  await expect(
    page.getByRole("checkbox", { name: "Show saved answers", exact: true }),
  ).not.toBeChecked();
});

test("combined Examples has teaching first, all six verified source links and no duplicate nesting card", async ({
  page,
}) => {
  await boot(page);
  await expect(
    page.getByText("Teaching examples", { exact: true }),
  ).toBeHidden();
  await page.getByText("Examples", { exact: true }).click();
  const examplesPanel = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: /^Examples$/ }) });
  expect(
    await examplesPanel.locator(".vn-example-group > h3").allTextContents(),
  ).toEqual(["Teaching examples", "Exam questions"]);
  await expect(examplesPanel.locator("article")).toHaveCount(11);
  await expect(
    examplesPanel.getByRole("link", {
      name: "View source question ↗",
      exact: true,
    }),
  ).toHaveCount(6);
  await expect(
    examplesPanel.getByText("A inside B · reverse the labels", { exact: true }),
  ).toHaveCount(0);
  const card = examplesPanel
    .locator("article")
    .filter({ hasText: "Nested sets · multiples of 4" });
  await card
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).schemaVersion).toBe(1);
  await card
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await confirm(page);
  expect((await saved(page)).document.regions[3].visibility).toBe("hidden");
});

for (const width of [320, 375, 768, 1440])
  test(`simplified controls, keyboard labels, mode and answer toggle at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const e = teachingExamples.find((x) => x.id === "nested")!.make(false);
    await boot(page, e);
    const before = canonical(await saved(page));
    const labels = page.getByText("Labels and definitions", { exact: true });
    await expect(
      page.getByRole("button", { name: /^Outer set:/ }),
    ).toBeHidden();
    await labels.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^Outer set:/ }).click();
    await expect(page.getByLabel("Label text", { exact: true })).toHaveValue(
      "A",
    );
    await page.keyboard.press("Escape");
    await labels.click();
    const answers = page.getByRole("checkbox", {
      name: "Show saved answers",
      exact: true,
    });
    await answers.focus();
    await page.keyboard.press("Space");
    await expect(answers).toBeChecked();
    await expect(page.locator('.vn-art [data-region="3"]')).toHaveText(
      "4,8,12",
    );
    expect(canonical(await saved(page))).toBe(before);
    await page.getByRole("button", { name: "Shade", exact: true }).click();
    await expect(
      page.getByLabel("Shading style", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Diagram", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Shade", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-region-hit="3"]').click();
    expect((await saved(page)).document.regions[3].shade).toBe("grey");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Shading style", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("tab", { name: "Diagram", exact: true }),
    ).toBeVisible();
    await page.locator('[data-region-hit="1"]').click();
    await expect(
      page.getByRole("button", { name: "Shade", exact: true }),
    ).toBeDisabled();
    await expect(answers).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(canonical(await saved(page))).toBe(before);
    await page.getByRole("tab", { name: "Diagram", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Outer set:/ }),
    ).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(report, `simplified-${width}.png`),
      fullPage: true,
    });
  });
