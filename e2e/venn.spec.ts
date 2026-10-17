import { showExamples } from "./example-gallery";
import { clickResourceAction, openResourceMenu } from "./resource-actions";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  create,
  canonical,
  geometry,
  type Envelope,
} from "../packages/venn-core/src";
import { Resvg } from "@resvg/resvg-js";
import { examples } from "../packages/venn-core/src/examples";
import {
  pngChunks,
  verifyPrintBytes,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
const report = resolve(
  process.env.VENN_REPORT_DIR ?? "test-results/venn-artifacts",
);
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:venn:v1";
async function boot(page: Page, e?: Envelope) {
  if (e)
    await page.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [key, canonical(e)],
    );
  await page.goto("/?tool=venn");
  await expect(
    page.getByRole("heading", { name: "Venn diagrams", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate((base) => {
    const copy = new URL(location.href).searchParams.get("resourceCopy");
    return JSON.parse(
      localStorage.getItem(copy ? `${base}:worked:${copy}` : base)!,
    );
  }, key);
}
async function edit(
  page: Page,
  mask: number,
  text: string,
  kind = "members",
  display = "show",
) {
  await page.locator(`[data-region-hit="${mask}"]`).click();
  await page.getByLabel("Content type", { exact: true }).selectOption(kind);
  await page.getByLabel("Region content", { exact: true }).fill(text);
  await page.getByLabel("Pupil display", { exact: true }).selectOption(display);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".vn-floating")).toHaveCount(0);
  await expect(page.locator(".vn-selected")).toHaveCount(0);
}

test("direct edits, pupil states, history and reload", async ({ page }) => {
  await boot(page);
  await edit(page, 1, "0", "frequency");
  await edit(page, 3, "1/2", "number", "hidden");
  await edit(page, 2, "9", "number", "line");
  const doc = await saved(page);
  expect(doc.document.regions[1].text).toBe("0");
  expect(doc.document.regions[3].visibility).toBe("hidden");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).document.regions[2].text).toBe("");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  expect((await saved(page)).document.regions).toEqual(doc.document.regions);
  expect(await page.locator('.vn-art [data-region="1"]').textContent()).toBe(
    "0",
  );
  expect(await page.locator('.vn-art [data-region="3"]').textContent()).toBe(
    "",
  );
});
test("invalid and unfinished input blocks export, Cancel never commits", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-region-hit="3"]').click();
  await page.getByLabel("Content type").selectOption("number");
  await page.getByLabel("Region content").fill("1/0");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".vn-floating [role=alert]")).toContainText(
    "denominator",
  );
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).document.regions[3].text).toBe("");
});
test("navigation hides editor but retains draft and work", async ({ page }) => {
  await boot(page);
  await edit(page, 1, "3,9");
  await page
    .getByRole("button", { name: "Edit set A label", exact: true })
    .click();
  await page.getByLabel("Label text").fill("French");
  await page.getByRole("link", { name: "Ratio tables", exact: true }).click();
  await expect(page.locator(".vn-floating")).toBeHidden();
  await page.getByRole("link", { name: "Venn diagrams", exact: true }).click();
  await expect(page.getByLabel("Label text")).toHaveValue("French");
  await page.getByLabel("Label text").press("Enter");
  expect((await saved(page)).document.labels[1].text).toBe("French");
  expect((await saved(page)).document.regions[1].text).toBe("3,9");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Ratio tables", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Venn diagrams", exact: true }),
  ).toBeVisible();
});
test("third-set removal confirms protected hidden data and undo restores", async ({
  page,
}) => {
  await boot(page);
  await edit(page, 1, "11", "frequency");
  await page.getByLabel("Number of sets", { exact: true }).selectOption("3");
  await edit(page, 7, "0", "frequency", "hidden");
  await page.getByLabel("Number of sets", { exact: true }).selectOption("2");
  await expect(
    page.getByRole("dialog", { name: "Remove the third set?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).document.sets).toBe(3);
  await page.getByLabel("Number of sets", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  expect((await saved(page)).document.regions[1].text).toBe("11");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).document.regions[7].visibility).toBe("hidden");
});
test("expression and manual shading preserve values and stable IDs", async ({
  page,
}) => {
  await boot(page, examples.find((x) => x.id === "languages")!.make(true));
  await page.getByRole("button", { name: "Shade", exact: true }).click();
  await page
    .getByRole("button", { name: "Shade a set expression", exact: true })
    .click();
  await page.getByLabel("Set expression", { exact: true }).fill("A ∩ B");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  let d = (await saved(page)).document;
  expect(
    d.regions
      .map((r: { shade: string }, i: number) => (r.shade !== "none" ? i : -1))
      .filter((i: number) => i >= 0),
  ).toEqual([3, 7]);
  expect(d.labels[1].text).toBe("F");
  expect(d.regions[2].text).toBe("0");
  await page.getByRole("button", { name: "Shade", exact: true }).click();
  await page.locator('[data-region-hit="0"]').click();
  d = (await saved(page)).document;
  expect(d.regions[0].shade).toBe("grey");
  await page
    .getByRole("button", { name: "Clear all shading", exact: true })
    .click();
  expect((await saved(page)).document.regions[2].text).toBe("0");
});
test("overflow is correctable and editable download remains available", async ({
  page,
}) => {
  await boot(page, create(3));
  await edit(page, 7, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "text");
  await expect(page.getByRole("alert")).toContainText("does not fit");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await openResourceMenu(page);
  await expect(
    page.getByRole("menuitem", { name: "Save editable file", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await edit(page, 7, "1/2", "number");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
});
for (const width of [320, 375, 768, 1440])
  test(`layout, focused edge editors and card at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await boot(page, examples.find((x) => x.id === "2018")!.make(true));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const label of ["Edit universe label", "Edit set C label"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const box = await page.locator(".vn-floating").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
      await page.getByLabel("Label text").press("Escape");
    }
    await page
      .getByRole("button", { name: "Edit set A label", exact: true })
      .click();
    await page.getByLabel("Label text").fill("Unfinished");
    await page.screenshot({
      path: resolve(report, `focused-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.screenshot({
      path: resolve(report, `editor-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    const card = page.getByRole("link").filter({
      has: page.getByRole("img", {
        name: "Two overlapping sets with member lists, an intersection and a pupil answer line.",
      }),
    });
    await expect(card).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: resolve(report, `cards-${width}.png`),
      fullPage: true,
    });
    await card.click();
    await expect(
      page.getByRole("heading", { name: "Venn diagrams", exact: true }),
    ).toBeVisible();
  });
for (const ex of examples)
  test(`actual source example exports: ${ex.id}`, async ({ page }) => {
    await boot(page, ex.make(true));
    await expect(
      page.getByRole("button", { name: "Copy for Word", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "File", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await clickResourceAction(page, "Download SVG");
    const result = await download;
    const path = resolve(report, `example-${ex.id}.svg`);
    await result.saveAs(path);
    const svg = readFileSync(path, "utf8");
    expect(svg).toContain("data:font/otf;base64");
    expect(svg).not.toContain("vn-hit");
    expect(svg).not.toContain("Teacher note");
    await page.screenshot({
      path: resolve(report, `example-${ex.id}.png`),
      fullPage: true,
    });
  });
test("actual PNG, editable-file roundtrip and cancelled import", async ({
  page,
}) => {
  await boot(page, examples.find((x) => x.id === "2018")!.make(true));
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  const pngPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const png = await pngPromise,
    path = resolve(report, "three-set-600ppi.png");
  await png.saveAs(path);
  const pngBytes = readFileSync(path),
    chunks = pngChunks(pngBytes),
    physical = chunks.find((c) => c.type === "pHYs")!.data,
    view = new DataView(
      physical.buffer,
      physical.byteOffset,
      physical.byteLength,
    ),
    meta = {
      horizontalPixelsPerMetre: view.getUint32(0),
      verticalPixelsPerMetre: view.getUint32(4),
    };
  const g = JSON.parse(
    canonical(examples.find((x) => x.id === "2018")!.make(true)),
  );
  const size = printRasterSize(12, (105 + 4 * ((11 * 25.4) / 72 + 2) + 4) / 10);
  verifyPrintBytes(pngBytes, size.width, size.height);
  expect(g.tool).toBe("venn");
  expect(meta.horizontalPixelsPerMetre).toBe(23622);
  expect(meta.verticalPixelsPerMetre).toBe(23622);
  const editablePromise = page.waitForEvent("download");
  await clickResourceAction(page, "Save editable file");
  const editable = await editablePromise,
    filePath = resolve(report, "three-set-editable.json");
  await editable.saveAs(filePath);
  const before = await saved(page);
  await page.locator("input[type=file]").setInputFiles(filePath);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page.locator("input[type=file]").setInputFiles(filePath);
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  expect(await saved(page)).toEqual(JSON.parse(readFileSync(filePath, "utf8")));
  writeFileSync(
    resolve(report, "png-metadata.json"),
    JSON.stringify(meta, null, 2),
  );
});
test("actual image clipboard and Word physical HTML", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await boot(page, examples.find((x) => x.id === "2019")!.make(true));
  await page
    .getByRole("button", { name: "Copy image", exact: true })
    .click();
  await expect(
    page.getByText(/Image copied\. Paste with Ctrl\+V\./, { exact: true }),
  ).toBeVisible();
  const types = await page.evaluate(async () =>
    (await navigator.clipboard.read()).flatMap((x) => x.types),
  );
  expect(types).toContain("image/png");
  const bytes = await page.evaluate(async () => {
    const i = (await navigator.clipboard.read()).find((x) =>
      x.types.includes("image/png"),
    )!;
    return Array.from(
      new Uint8Array(await (await i.getType("image/png")).arrayBuffer()),
    );
  });
  writeFileSync(resolve(report, "clipboard.png"), Buffer.from(bytes));
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
  expect(html).toContain("width: 12cm");
  expect(html).toContain("data:image/png;base64");
  writeFileSync(resolve(report, "word-clipboard.html"), html);
});
test("clipboard refusal gives useful fallback", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { write: () => Promise.reject(Error("denied")) },
    }),
  );
  await boot(page);
  await page
    .getByRole("button", { name: "Copy image", exact: true })
    .click();
  await expect(page.getByText(/browser blocked image copying/)).toBeVisible();
});
test("corrupt recovery is preserved until protected download", async ({
  page,
}) => {
  await page.addInitScript((k) => localStorage.setItem(k, "{broken"), key);
  await boot(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "{broken",
  );
  await expect(
    page.getByRole("button", {
      name: "Keep this diagram and start saving",
      exact: true,
    }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download protected data", exact: true })
    .click();
  await (await download).saveAs(resolve(report, "recovery.json"));
  await page
    .getByRole("button", {
      name: "Keep this diagram and start saving",
      exact: true,
    })
    .click();
  expect((await saved(page)).tool).toBe("venn");
});
test("another tab's newer save is protected", async ({ page, context }) => {
  await boot(page);
  const other = await context.newPage();
  await boot(other);
  await edit(other, 1, "44", "frequency");
  await expect(
    page.getByRole("heading", { name: "Protect saved data", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  expect((await saved(page)).document.regions[1].text).toBe("44");
  await other.close();
});
test("storage failure leaves an editable-file fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await boot(page);
  await expect(
    page.getByText("Save unavailable — download editable file", {
      exact: true,
    }),
  ).toBeVisible();
  await edit(page, 1, "10");
  await openResourceMenu(page);
  await expect(
    page.getByRole("menuitem", { name: "Save editable file", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
});
test("source preset cancellation, focus trap and undo", async ({ page }) => {
  await boot(page);
  await edit(page, 1, "4");
  await showExamples(page);
  const article = page.locator("article").filter({ hasText: "November 2018" });
  await article
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Open November 2018/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await saved(page)).document.regions[1].text).toBe("4");
  await showExamples(page);
  await article
    .getByRole("button", { name: "Use worked version", exact: true })
    .click();
  const worked = page;
  expect((await saved(worked)).document.regions[7].text).toBe("8");
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  expect((await saved(page)).document.regions[1].text).toBe("4");
  await showExamples(page);
  await article
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).document.regions[1].text).toBe("4");
});

test("newline members, keyboard tabs and direct definition edits", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-region-hit="1"]').click();
  await page.getByLabel("Region content", { exact: true }).fill("0\n1/2\n-3");
  await page.getByLabel("Region content", { exact: true }).press("Enter");
  expect((await saved(page)).document.regions[1].text).toBe("0\n1/2\n-3");
  await page.getByRole("tab", { name: "Contents", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Diagram", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Contents", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", { name: "Diagram", exact: true }),
  ).toBeFocused();
  await page.getByText("Labels and definitions", { exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "Show definitions above diagram",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Universe definition: Add text", exact: true })
    .click();
  await page
    .getByLabel("Definition text", { exact: true })
    .fill("U = {1, 2, 3}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Edit printed universe definition",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Definition text", { exact: true })
    .fill("U = {1, 2, 3, 4}");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await saved(page)).document.definitions[0]).toBe("U = {1, 2, 3, 4}");
});

for (const sets of [2, 3] as const)
  for (let mask = 0; mask < 1 << sets; mask++)
    test(`independent exported shading pixels: ${sets} sets / region ${mask}`, async ({
      page,
    }) => {
      const e = create(sets);
      e.document.regions[mask].shade = "grey";
      await boot(page, e);
      await page
        .getByRole("button", { name: "File", exact: true })
        .click();
      const promise = page.waitForEvent("download");
      await clickResourceAction(page, "Download SVG");
      const path = resolve(report, `mask-${sets}-${mask}.svg`);
      await (await promise).saveAs(path);
      const svg = readFileSync(path, "utf8"),
        raster = new Resvg(svg, {
          font: {
            fontFiles: [
              "STIXTwoText-Regular.otf",
              "STIXTwoText-Italic.otf",
              "STIXTwoMath-Regular.otf",
            ].map((n) => resolve("assets/graph-fonts", n)),
            loadSystemFonts: false,
          },
        }).render();
      const g = geometry(e),
        pixels = raster.pixels;
      g.anchors.forEach((a, i) => {
        const x = Math.round((a.x / g.width) * raster.width),
          y = Math.round((a.y / g.height) * raster.height),
          offset = (y * raster.width + x) * 4;
        expect(pixels[offset]).toBe(i === mask ? 216 : 255);
        expect(pixels[offset + 1]).toBe(pixels[offset]);
        expect(pixels[offset + 2]).toBe(pixels[offset]);
        expect(pixels[offset + 3]).toBe(255);
      });
      writeFileSync(
        resolve(report, `mask-${sets}-${mask}.png`),
        raster.asPng(),
      );
    });

test("largest structure stays editable on a narrow screen", async ({
  page,
}) => {
  const e = create(3);
  e.document.widthCm = 16;
  e.document.fontPt = 9;
  for (let mask = 0; mask < 8; mask++)
    e.document.regions[mask] = {
      kind: "members",
      text: mask === 7 ? "0,-1,1/2,2,3" : "1,2,3,4,5",
      visibility: "show",
      shade: "none",
    };
  await page.setViewportSize({ width: 320, height: 812 });
  await boot(page, e);
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  await page.locator('[data-region-hit="7"]').click();
  await page.setViewportSize({ width: 320, height: 450 });
  // Wait for the browser's resize event and the editor's measured positioning;
  // setViewportSize alone can resolve before that frame. Bounds stay exact.
  await expect
    .poll(async () => {
      const box = (await page.locator(".vn-floating").boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(450);
  const b = await page.locator(".vn-floating").boundingBox();
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(320);
  expect(b!.y + b!.height).toBeLessThanOrEqual(450);
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
