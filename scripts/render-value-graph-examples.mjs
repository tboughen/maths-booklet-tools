import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
async function load(path) {
  const b = await build({
    entryPoints: [path],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const module = { exports: {} };
  runInNewContext(b.outputFiles[0].text, {
    module,
    exports: module.exports,
    TextEncoder,
    TextDecoder,
    structuredClone,
    btoa,
    atob,
    crypto: globalThis.crypto,
  });
  return module.exports;
}
const core = await load("packages/value-graph-core/src/interchange.ts"),
  pngCore = await load("packages/graph-core/src/png-bytes.ts");
const out = resolve(process.argv[2] ?? "docs/value-graph-examples");
await mkdir(out, { recursive: true });
const font = {
  loadSystemFonts: false,
  fontFiles: [
    "STIXTwoText-Regular.otf",
    "STIXTwoText-Italic.otf",
    "STIXTwoMath-Regular.otf",
  ].map((f) => resolve("assets/graph-fonts", f)),
  defaultFontFamily: "STIX Two Text",
};
const base = core.defaultEnvelope(),
  ids = base.document.columns.map((c) => c.id);
const worked = core.apply(base, [
  { op: "calculate_cells", columnIds: ids, overwrite: true },
  {
    op: "plot_series",
    id: "points",
    source: "table",
    columnIds: ids,
    connection: "none",
  },
  {
    op: "set_curve",
    curve: {
      id: "quadratic",
      equation: base.document.equation,
      min: "-3",
      max: "3",
    },
  },
]);
const error = core.apply(worked, [
  { op: "set_curve", curve: null },
  { op: "set_connection", id: "points", connection: "straight-joins" },
]);
const maximum = core.defaultEnvelope();
maximum.document.columns = core.rangeColumns("-3", "3", "1/2");
maximum.document.print.tableWidthMm = 180;
maximum.document.columns[0].y = { kind: "answer-line" };
maximum.document.columns[1].y = { kind: "value", value: "-1/2" };
const cases = {
  scaffold: base,
  worked,
  "straight-join-error": error,
  maximum,
  ...Object.fromEntries(
    core.PRESETS.map((name) => [
      name.toLowerCase().replaceAll(" ", "-"),
      core.preset(name),
    ]),
  ),
};
const evidence = [];
for (const [name, envelope] of Object.entries(cases)) {
  const svg = core.renderSvg(envelope),
    m = core.metrics(envelope),
    size = pngCore.printRasterSize(m.widthCm, m.heightCm);
  const printSvg = svg
    .replace(/width="[^"]+"/, `width="${size.width}px"`)
    .replace(/height="[^"]+"/, `height="${size.height}px"`);
  const print = new Resvg(printSvg, { font }).render();
  const png = pngCore.setDensityBytes(print.asPng());
  pngCore.verifyPrintBytes(png, size.width, size.height);
  const previewSvg = svg
    .replace(/width="[^"]+"/, `width="${Math.round(m.width * 4)}px"`)
    .replace(/height="[^"]+"/, `height="${Math.round(m.height * 4)}px"`);
  const preview = new Resvg(previewSvg, { font }).render();
  const outlined = new Resvg(svg, { font })
    .toString()
    .replace(/\bwidth="[^"]+"/, `width="${m.width}mm"`)
    .replace(/\bheight="[^"]+"/, `height="${m.height}mm"`);
  await Promise.all([
    writeFile(resolve(out, `${name}.svg`), outlined),
    writeFile(resolve(out, `${name}.png`), png),
    writeFile(resolve(out, `${name}-preview.png`), preview.asPng()),
    writeFile(resolve(out, `${name}.json`), JSON.stringify(envelope, null, 2)),
  ]);
  evidence.push({
    name,
    plotMm: { width: m.graphWidth, height: m.graphHeight },
    exportMm: { width: m.width, height: m.height },
    printRaster: size,
    printDpi: 600,
    axisFontPt: 12,
    gridStrokePt: [0.51, 1.02, 1.417],
    hash: await core.contentHash(envelope),
  });
}
await writeFile(
  resolve(out, "evidence.json"),
  JSON.stringify(evidence, null, 2),
);
console.log(
  `Rendered and verified ${evidence.length} actual source examples in ${out}`,
);
