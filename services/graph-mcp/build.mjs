import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
await build({
  entryPoints: [
    "services/graph-mcp/cli.ts",
    "services/graph-mcp/raster-worker.ts",
    "services/graph-mcp/smoke.ts",
  ],
  outdir: "service-dist",
  outExtension: { ".js": ".js" },
  entryNames: "[name]",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  sourcemap: true,
});
const files = {};
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = directory + "/" + entry.name;
    if (entry.isDirectory() && entry.name !== "node_modules")
      await collect(path);
    else if (entry.isFile())
      files[path] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
  }
}
for (const directory of [
  "packages/graph-core",
  "packages/ratio-table-core",
  "services/graph-mcp",
  "assets/graph-fonts",
])
  await collect(directory);
const sorted = Object.fromEntries(
  Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
);
const buildId = createHash("sha256")
  .update(JSON.stringify(sorted))
  .digest("hex");
await writeFile(
  "service-dist/manifest.json",
  JSON.stringify(
    { rendererVersion: "graph-1", ratioRendererVersion: "ratio-1", buildId, files: sorted },
    null,
    2,
  ) + "\n",
);
