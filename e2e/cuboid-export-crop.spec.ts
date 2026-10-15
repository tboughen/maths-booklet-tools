import { test, expect } from "./release-fixtures";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appearance,
  canonical,
  create,
  encode,
  layout,
  newShape,
  upgrade,
  type Envelope,
} from "../packages/cuboid-core/src";
import { examples } from "../packages/cuboid-core/src/examples";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const report = join(
  process.cwd(),
  process.env.CUBOID_CROP_REPORT_DIR ?? "test-results/cuboid-crop",
);
mkdirSync(join(report, "exports"), { recursive: true });
mkdirSync(join(report, "originals"), { recursive: true });
test.beforeEach(async ({ page }) => {
  await page.goto("/?tool=cuboids");
  await expect(page.getByTestId("cuboid-resource")).toBeVisible();
});

function cases() {
  const result: [string, Envelope][] = [
    ["default", upgrade(create())],
    ["legacy", create()],
  ];
  for (const direction of ["right", "left"] as const) {
    const e = upgrade(create()),
      s = e.document.shapes[0];
    e.document.widthCm = 18;
    s.direction = direction;
    s.arrows = true;
    s.title = "Cuboid with dimension arrows";
    s.caption = "Keep all labels, arrowheads and the caption.";
    s.labels.height = {
      mode: "text",
      text: "height = 2½ cm",
      x: direction === "right" ? 8 : -8,
      y: -8,
    };
    s.labels.depth = { mode: "text", text: "depth = 3¼ cm", x: 8, y: 8 };
    s.labels.width = { mode: "blank", text: "", x: -8, y: 8 };
    s.labels.front = { mode: "text", text: "12 cm²", x: 8, y: -8 };
    result.push([`arrows-${direction}`, e]);
  }
  const hidden = upgrade(create());
  for (const label of Object.values(hidden.document.shapes[0].labels))
    label.mode = "hidden";
  result.push(["no-labels", hidden]);
  for (const face of [
    "top",
    "bottom",
    "front",
    "back",
    "left",
    "right",
  ] as const) {
    const e = upgrade(create()),
      s = e.document.shapes[0];
    s.appearance = {
      ...appearance(s),
      mode: "one",
      face,
      area: {
        mode: "value",
        heading: "Cross-sectional area",
        text: "",
        expression: true,
      },
    };
    result.push([`face-${face}`, e]);
  }
  const labels = upgrade(create());
  labels.document.widthCm = 18;
  const s = labels.document.shapes[0];
  s.title = "Long title across the printed resource";
  s.caption =
    "A long caption with wrapped lines, preserving the writing space and all of the final words.";
  s.workedVolume = s.workedArea = true;
  s.labels.front = {
    mode: "text",
    text: "Pupil's answer: ……………………",
    x: 8,
    y: 8,
  };
  result.push(["long-labels", labels]);
  for (const width of [18, 10]) {
    const e = upgrade(create());
    e.document.widthCm = width;
    e.document.shapes = (width === 18 ? [0, 1] : [0, 1, 2]).map((i) => ({
      ...newShape(`compare-${i}`),
      title: `Cuboid ${i + 1}`,
      dimensions: { width: String(i + 2), depth: "2", height: "2" },
      caption: `Caption ${i + 1}`,
    }));
    result.push([`comparison-${width}`, e]);
  }
  const max = upgrade(create());
  max.document.widthCm = 16;
  Object.assign(max.document.shapes[0], {
    view: "layers",
    dimensions: { width: "20", depth: "20", height: "20" },
    layerNumbers: true,
    counts: true,
  });
  max.document.shapes[0].appearance = {
    ...appearance(max.document.shapes[0]),
    mode: "faces",
  };
  result.push(["maximum-layers", max]);
  for (const ex of examples)
    for (const worked of [false, true])
      result.push([
        `${ex.id}-${worked ? "worked" : "scaffold"}`,
        ex.create(worked),
      ]);
  return result;
}

test("tight vector crops preserve every label and shape across the supported layouts", async ({
  page,
}) => {
  test.setTimeout(180000);
  const proofs = [];
  for (const [name, e] of cases()) {
    const before = canonical(e),
      original = layout(e);
    await page.goto(`/?tool=cuboids#cuboids=${encode(e)}`);
    await page
      .getByRole("button", { name: "Use these cuboids", exact: true })
      .click();
    if (
      !(await page
        .getByRole("button", { name: "Download SVG", exact: true })
        .isVisible())
    )
      await page
        .getByRole("button", { name: "Download options", exact: true })
        .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download SVG", exact: true })
      .click();
    const exported = await download;
    expect(await exported.failure()).toBeNull();
    const image = readFileSync((await exported.path())!, "utf8");
    const proof = await page.evaluate(
      ({ image }) => {
        const svg = new DOMParser().parseFromString(
          image,
          "image/svg+xml",
        ).documentElement;
        return {
          svg: image,
          width: parseFloat(svg.getAttribute("width")!),
          height: parseFloat(svg.getAttribute("height")!),
          viewBox: svg.getAttribute("viewBox")!.split(" ").map(Number),
          labels: Array.from(
            svg.querySelectorAll("text"),
            (t) => t.textContent,
          ),
          geometry: Array.from(
            svg.querySelectorAll("path,polygon"),
            (t) => t.outerHTML,
          ),
        };
      },
      { image },
    );
    const beforeSvg = original.svg;
    writeFileSync(join(report, "originals", `${name}.svg`), beforeSvg);
    expect(proof.labels, name).toEqual(
      [...beforeSvg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((x) =>
        x[1]
          .replaceAll("&amp;", "&")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&quot;", '"'),
      ),
    );
    expect(proof.geometry.length, name).toBe(
      [...beforeSvg.matchAll(/<(?:path|polygon)\b/g)].length,
    );
    expect(proof.svg, name).not.toMatch(/button|cb-target|aria-selected/);
    expect(canonical(e), name).toBe(before);
    expect(proof.width * 10, name).toBeCloseTo(proof.viewBox[2], 6);
    expect(proof.height * 10, name).toBeCloseTo(proof.viewBox[3], 6);
    if (name === "default") {
      expect(proof.width).toBeLessThan(original.width / 10 - 0.4);
      expect(proof.height).toBeLessThan(original.height / 10 - 0.8);
    }
    writeFileSync(join(report, "exports", `${name}.svg`), proof.svg);
    proofs.push({
      name,
      original: [original.width / 10, original.height / 10],
      cropped: [proof.width, proof.height],
      viewBox: proof.viewBox,
      labelCount: proof.labels.length,
      geometryCount: proof.geometry.length,
    });
  }
  writeFileSync(
    join(report, "crop-cases.json"),
    JSON.stringify(proofs, null, 2),
  );
  expect(await page.locator('[aria-hidden="true"] svg').count()).toBe(0);
});

test("real downloads and both clipboard routes use the same cropped dimensions", async ({
  page,
}) => {
  const full = await page
    .getByTestId("cuboid-resource")
    .locator(".cb-art svg")
    .getAttribute("viewBox");
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  for (const [name, file] of [
    ["Download PNG (600 ppi)", "download.png"],
    ["Download SVG", "download.svg"],
    ["Save editable file", "editable.json"],
  ]) {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    await (await dl).saveAs(join(report, "exports", file));
  }
  await page
    .getByRole("button", { name: "Copy to clipboard", exact: true })
    .click();
  await expect(page.locator(".cb-message")).toContainText("Resource ready");
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await navigator.clipboard.read()).some((item) =>
          item.types.includes("image/png"),
        ),
      ),
    )
    .toBe(true);
  const clip = await page.evaluate(async () =>
    Array.from(
      new Uint8Array(
        await (
          await (await navigator.clipboard.read())[0].getType("image/png")
        ).arrayBuffer(),
      ),
    ),
  );
  writeFileSync(join(report, "exports/clipboard.png"), Buffer.from(clip));
  await page.evaluate(() => {
    const original = document.execCommand.bind(document);
    document.execCommand = function (...args: Parameters<typeof original>) {
      const image = document.querySelector(
        '[contenteditable="true"] img',
      ) as HTMLImageElement | null;
      if (image)
        (window as unknown as { wordCopy: string }).wordCopy = image.outerHTML;
      return original(...args);
    };
  });
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(page.locator(".cb-message")).toContainText("Resource ready");
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as { wordCopy?: string }).wordCopy,
      ),
    )
    .toBe("string");
  const html = await page.evaluate(
    () => (window as unknown as { wordCopy: string }).wordCopy,
  );
  expect(html).toContain("data:image/png;base64,");
  const dims = [...html.matchAll(/(?:width|height)="([\d.]+)cm"/g)].map((x) =>
    Number(x[1]),
  );
  expect(dims[0]).toBeLessThan(10);
  writeFileSync(
    join(report, "word-size.json"),
    JSON.stringify({ widthCm: dims[0], heightCm: dims[1] }, null, 2),
  );
  expect(
    await page
      .getByTestId("cuboid-resource")
      .locator(".cb-art svg")
      .getAttribute("viewBox"),
  ).toBe(full);
  await page.getByLabel("Preview zoom", { exact: true }).selectOption("1.5");
  await page.setViewportSize({ width: 375, height: 800 });
  if (
    !(await page
      .getByRole("button", { name: "Download SVG", exact: true })
      .isVisible())
  )
    await page
      .getByRole("button", { name: "Download options", exact: true })
      .click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG", exact: true }).click();
  await (await dl).saveAs(join(report, "exports/zoom-mobile.svg"));
});

test("largest separated resource still exports every layer at 600 ppi", async ({
  page,
}) => {
  const e = cases().find(([name]) => name === "maximum-layers")![1];
  await page.goto(`/?tool=cuboids#cuboids=${encode(e)}`);
  await page
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
  await expect(
    page.getByTestId("cuboid-resource").locator("g[data-layer]"),
  ).toHaveCount(20);
  await page
    .getByRole("button", { name: "Download options", exact: true })
    .click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download PNG (600 ppi)", exact: true })
    .click();
  await (await dl).saveAs(join(report, "exports/maximum-layers.png"));
});
