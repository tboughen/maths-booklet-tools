// Build the reviewed source in memory; save only the requested review artifacts.
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const bundled = await build({
  entryPoints: ["packages/ratio-table-core/src/interchange.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const module = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module,
  exports: module.exports,
  TextEncoder,
  TextDecoder,
  structuredClone,
  btoa,
  atob,
  crypto: globalThis.crypto,
});
const core = module.exports;
const pngCore = await build({
  entryPoints: ["packages/graph-core/src/png-bytes.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const pngModule = { exports: {} };
runInNewContext(pngCore.outputFiles[0].text, {
  module: pngModule,
  exports: pngModule.exports,
  TextEncoder,
  TextDecoder,
});
const pngBytes = pngModule.exports;
const output = resolve(process.argv[2] ?? "docs/ratio-table-examples");
await mkdir(output, { recursive: true });
const font = {
  loadSystemFonts: false,
  fontFiles: [
    "STIXTwoText-Regular.otf",
    "STIXTwoText-Italic.otf",
    "STIXTwoMath-Regular.otf",
  ].map((f) => resolve("assets/graph-fonts", f)),
  defaultFontFamily: "STIX Two Text",
};
const rows = (pairs) =>
  pairs.map((pair, index) => ({
    id: `row-${index + 1}`,
    cells: pair.map((value) =>
      value === null
        ? { kind: "answer-line" }
        : value === ""
          ? { kind: "empty" }
          : { kind: "number", value },
    ),
  }));
const division = (factor) => [
  { from: "row-1", to: "row-2", operation: "divide", factor },
];
const fixtures = {
  simple: {
    rows: rows([
      ["4", "8"],
      ["1", null],
    ]),
  },
  worked: {
    rows: rows([
      ["2", "4"],
      ["1", "2"],
    ]),
    mode: "annotated",
    transitions: division("2"),
  },
  "fraction-scaffold": {
    rows: rows([
      ["3", "2"],
      ["1", null],
    ]),
    mode: "annotated",
    transitions: division("3"),
  },
  "fraction-complete": {
    rows: rows([
      ["3", "2"],
      ["1", "2/3"],
    ]),
    mode: "annotated",
    transitions: division("3"),
  },
  negative: {
    rows: rows([
      ["2", "-6"],
      ["1", "-3"],
    ]),
    mode: "annotated",
    transitions: division("2"),
  },
  empty: {
    rows: rows([
      ["", ""],
      ["", ""],
    ]),
  },
  "six-rows": {
    rows: rows([
      ["64", "128"],
      ["32", "64"],
      ["16", "32"],
      ["8", "16"],
      ["4", "8"],
      ["2", "4"],
    ]),
    mode: "annotated",
    transitions: Array.from({ length: 5 }, (_, i) => ({
      from: `row-${i + 1}`,
      to: `row-${i + 2}`,
      operation: "divide",
      factor: "2",
    })),
  },
};
const receipt = [];
for (const [name, spec] of Object.entries(fixtures)) {
  const envelope = core.createRatioTable({ schemaVersion: 1, ...spec }),
    svg = core.renderRatioSvg(envelope.document),
    metrics = core.ratioMetrics(envelope.document);
  const size = pngBytes.printRasterSize(metrics.widthCm, metrics.heightCm);
  const input = svg
    .replace(/(<svg\b[^>]*\bwidth=")[^"]+"/, `$1${size.width}px"`)
    .replace(/(<svg\b[^>]*\bheight=")[^"]+"/, `$1${size.height}px"`);
  const png = pngBytes.setDensityBytes(
    new Resvg(input, { font, background: "white" }).render().asPng(),
  );
  pngBytes.verifyPrintBytes(png, size.width, size.height);
  let outlined = new Resvg(svg, { font }).toString();
  outlined = outlined
    .replace(/\bwidth="[^"]+"/, `width="${metrics.widthCm}cm"`)
    .replace(/\bheight="[^"]+"/, `height="${metrics.heightCm}cm"`)
    .replace(
      /(<svg\b[^>]*>)/,
      "$1<title>Ratio table</title><desc>Use the accompanying JSON for editing.</desc>",
    );
  await writeFile(resolve(output, name + ".svg"), outlined);
  await writeFile(resolve(output, name + ".png"), png);
  await writeFile(
    resolve(output, name + ".json"),
    JSON.stringify(envelope, null, 2) + "\n",
  );
  receipt.push({
    name,
    hash: await core.ratioHash(envelope),
    physicalSizeCm: { width: metrics.widthCm, height: metrics.heightCm },
    printRaster: size,
    printVerified: true,
    warnings: core.ratioWarnings(envelope),
  });
}
await writeFile(
  resolve(output, "verification.json"),
  JSON.stringify(
    { rendererVersion: core.RATIO_RENDERER_VERSION, fixtures: receipt },
    null,
    2,
  ) + "\n",
);
let contact =
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="395" viewBox="0 0 900 395"><rect width="900" height="395" fill="white"/><g font-family="STIX Two Text" font-size="22" fill="#262720"><text x="20" y="38">Simple table</text><text x="370" y="38">With scaling arrows</text></g>';
for (const [name, x] of [
  ["simple", 20],
  ["worked", 370],
]) {
  const metrics = receipt.find((item) => item.name === name).physicalSizeCm;
  const svg = await readFile(resolve(output, name + ".svg"), "utf8");
  contact += svg.replace(
    /<svg\b([^>]+)>/,
    (_, attributes) =>
      "<svg " +
      attributes
        .replace(/\bwidth="[^"]+"/, `width="${metrics.width * 90}"`)
        .replace(/\bheight="[^"]+"/, `height="${metrics.height * 90}"`) +
      ` x="${x}" y="70">`,
  );
}
contact += "</svg>";
await writeFile(
  resolve(output, "review-preview.png"),
  new Resvg(contact, { font, background: "white" }).render().asPng(),
);
// Sanity-check the saved editable source, not just the in-memory values.
for (const item of receipt)
  core.parseRatioFile(
    await readFile(resolve(output, item.name + ".json"), "utf8"),
  );
process.stdout.write(
  JSON.stringify({ output, examples: receipt.length, printVerified: true }) +
    "\n",
);
