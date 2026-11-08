import { test, expect, type Page } from "./release-fixtures";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { samePrintSizeProblems, svgPrintSizeProblems } from "../src/testing/print-size";

// Browser-export goldens (improvement list L13). Each tool opens a saved document, then the real
// File menu downloads its editable file, SVG and 600 ppi PNG. Those are compared with goldens kept in
// the repository:
//   - editable file: identical JSON to the source document (no implicit upgrade or calculation);
//   - SVG: a canonical outline, one line per element, so a change shows as a readable diff of the
//     element and attribute that moved (numbers to 0.01, embedded font data elided);
//   - PNG: exact pixel size and 600 ppi, then a perceptual comparison of a reduced copy, which
//     tolerates anti-aliasing but not a moved, missing or recoloured mark.
// Goldens are made in the pinned Playwright image (docs/release/RELEASE-PIPELINE.md), so they match
// CI. Regenerate after an intended output change with MATHSDOCK_UPDATE_GOLDENS=1 and review the diff.

const goldens = resolve("e2e/fixtures/export-goldens");
const updating = process.env.MATHSDOCK_UPDATE_GOLDENS === "1";
// [tool id, storage key]. A tool without a source.json takes its opening document when updating.
const tools = [
  ["graph", "maths-booklet-tools:graph-envelope:v1"],
  ["ratio-table", "maths-booklet-tools:ratio-table-envelope:v1"],
  ["value-table-graph", "mathsdock:value-table-graph:v1"],
  ["cuboids", "maths-booklet-tools:cuboids:v1"],
  ["number-line", "maths-booklet-tools:number-line:v1"],
  ["venn", "maths-booklet-tools:venn:v1"],
  ["triangle", "maths-booklet-tools:triangle:v1"],
  ["expanding-factorising", "maths-booklet-tools:algebra-grid:v1"],
  ["bar-model", "maths-booklet-tools:bar-model:v1"],
  ["charts", "maths-booklet-tools:charts:v1"],
  ["probability-tree", "maths-booklet-tools:probability-tree:v1"],
] as const;
// Perceptual tolerance on the reduced PNG: a pixel differs when a channel moves by more than
// CHANNEL; the export fails when more than SHARE of pixels differ.
// The pinned image reproduces every reduced pixel exactly; the small allowance absorbs CPU-level
// rasterising differences between machines running the same image.
const THUMBNAIL_WIDTH = 600,
  CHANNEL = 48,
  SHARE = 0.0005;
// Goldens are only meaningful in the pinned image, which graph-checks.yml marks with this variable.
// Elsewhere the tests are skipped with the reason; in CI a missing mark fails instead of skipping.
const pinned = process.env.MATHSDOCK_PINNED_BROWSER === "1";

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

/** A stable, line-per-element outline of an SVG document. */
function outline(page: Page, svg: string) {
  return page.evaluate((text) => {
    const round = (value: string) =>
      value.replace(/-?\d*\.\d+(?:e-?\d+)?/gi, (n) =>
        String(+Number(n).toFixed(2)),
      );
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const lines: string[] = [];
    const walk = (element: Element, depth: number) => {
      const pad = "  ".repeat(depth);
      const attributes = [...element.attributes]
        .map((a) => `${a.name}=${JSON.stringify(round(a.value))}`)
        .sort();
      lines.push(
        `${pad}<${element.tagName}${attributes.length ? " " + attributes.join(" ") : ""}>`,
      );
      for (const child of element.childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE)
          walk(child as Element, depth + 1);
        else if (
          child.nodeType === Node.TEXT_NODE ||
          child.nodeType === Node.CDATA_SECTION_NODE
        ) {
          let content = (child.textContent ?? "").replace(/\s+/g, " ").trim();
          if (element.tagName === "style")
            content = content.replace(
              /url\(\s*["']?data:[^)]*\)/g,
              "url(data:…)",
            );
          if (content) lines.push(`${pad}  ${JSON.stringify(round(content))}`);
        }
      }
    };
    walk(doc.documentElement, 0);
    return lines.join("\n") + "\n";
  }, svg);
}

/** The PNG reduced to THUMBNAIL_WIDTH on white, as PNG bytes; optionally compared with a golden. */
function reduce(page: Page, png: Buffer, golden?: Buffer) {
  return page.evaluate(
    async ({ png, golden, width, channel }) => {
      const load = async (base64: string) => {
        const blob = await (
          await fetch(`data:image/png;base64,${base64}`)
        ).blob();
        return createImageBitmap(blob);
      };
      const image = await load(png);
      const w = Math.min(width, image.width),
        h = Math.round((image.height * w) / image.width);
      const draw = (source: ImageBitmap) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source, 0, 0, w, h);
        return canvas;
      };
      const actual = draw(image);
      const bytes = await (
        await new Promise<Blob>((done) =>
          actual.toBlob((b) => done(b!), "image/png"),
        )
      ).arrayBuffer();
      const view = new Uint8Array(bytes);
      let binary = "";
      for (let i = 0; i < view.length; i += 0x8000)
        binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
      const encoded = btoa(binary);
      if (!golden)
        return { png: encoded, differing: 0, total: w * h, size: [w, h] };
      const reference = await load(golden);
      if (reference.width !== w || reference.height !== h)
        return {
          png: encoded,
          differing: w * h,
          total: w * h,
          size: [reference.width, reference.height],
        };
      const a = actual.getContext("2d")!.getImageData(0, 0, w, h).data,
        b = draw(reference).getContext("2d")!.getImageData(0, 0, w, h).data;
      let differing = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) > channel ||
          Math.abs(a[i + 1] - b[i + 1]) > channel ||
          Math.abs(a[i + 2] - b[i + 2]) > channel
        )
          differing++;
      return { png: encoded, differing, total: w * h, size: [w, h] };
    },
    {
      png: png.toString("base64"),
      golden: golden?.toString("base64"),
      width: THUMBNAIL_WIDTH,
      channel: CHANNEL,
    },
  );
}

for (const [tool, key] of tools) {
  test(`${tool}: editable file, SVG and 600 ppi PNG match the export goldens`, async ({
    page,
  }) => {
    if (!pinned && process.env.CI)
      throw Error(
        "Export goldens must run in the pinned Playwright image (MATHSDOCK_PINNED_BROWSER=1).",
      );
    test.skip(
      !pinned,
      "Export goldens run in the pinned Playwright image: docs/release/RELEASE-PIPELINE.md",
    );
    const folder = resolve(goldens, tool),
      sourcePath = resolve(folder, "source.json");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/tools/${tool}`);
    let source: string;
    if (existsSync(sourcePath)) {
      source = await readFile(sourcePath, "utf8");
      await page.evaluate(({ key, text }) => localStorage.setItem(key, text), {
        key,
        text: source,
      });
      await page.reload();
    } else {
      expect(
        updating,
        `${tool} has no golden source; run with MATHSDOCK_UPDATE_GOLDENS=1`,
      ).toBe(true);
      source = "";
    }
    await page.evaluate(() => document.fonts.ready);
    const editable = (await download(page, "Save editable file")).toString();
    if (source) expect(JSON.parse(editable)).toEqual(JSON.parse(source));
    else source = editable;
    const rawSvg = (await download(page, "Download SVG")).toString();
    const svg = await outline(page, rawSvg);
    const png = await download(page, "Download PNG (600 ppi)");
    const size = png.readUInt32BE(16),
      height = png.readUInt32BE(20);
    verifyPrintBytes(png, size, height);
    // The downloaded SVG and PNG print at the same size in millimetres (src/testing/print-size.ts).
    expect(svgPrintSizeProblems(rawSvg)).toEqual([]);
    expect(samePrintSizeProblems(rawSvg, png)).toEqual([]);

    if (updating) {
      await mkdir(folder, { recursive: true });
      await writeFile(sourcePath, source);
      await writeFile(resolve(folder, "export.svg.txt"), svg);
      await writeFile(
        resolve(folder, "export.png"),
        Buffer.from((await reduce(page, png)).png, "base64"),
      );
      await writeFile(
        resolve(folder, "png.json"),
        JSON.stringify({ width: size, height, ppi: 600 }, null, 2) + "\n",
      );
      return;
    }
    expect(svg).toBe(await readFile(resolve(folder, "export.svg.txt"), "utf8"));
    const recorded = JSON.parse(
      await readFile(resolve(folder, "png.json"), "utf8"),
    );
    expect({ width: size, height }).toEqual({
      width: recorded.width,
      height: recorded.height,
    });
    const compared = await reduce(
      page,
      png,
      await readFile(resolve(folder, "export.png")),
    );
    if (compared.differing > compared.total * SHARE)
      await writeFile(
        test.info().outputPath(`${tool}-reduced.png`),
        Buffer.from(compared.png, "base64"),
      );
    test
      .info()
      .annotations.push({
        type: "reduced PNG",
        description: `${compared.differing} of ${compared.total} pixels differ`,
      });
    expect(
      compared.differing,
      `${compared.differing} of ${compared.total} reduced PNG pixels differ from the golden`,
    ).toBeLessThanOrEqual(compared.total * SHARE);
  });
}
