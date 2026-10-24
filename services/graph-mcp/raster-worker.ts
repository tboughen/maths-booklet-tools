import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { packArchive } from "./archive";
import { GraphError } from "../../packages/graph-core/src/interchange";
import {
  setDensityBytes,
  verifyPrintBytes,
} from "../../packages/graph-core/src/png-bytes";
process.once(
  "message",
  (job: {
    svg: string;
    width: number;
    height: number;
    print: boolean;
    outlined: boolean;
    fontRoot: string;
    artifactKind?: "graph" | "ratio-table" | "value-graph" | "cuboids" | "number-line" | "venn" | "algebra-grid" | "triangle";
    measureCrop?: boolean;
    archive?: Record<string, Uint8Array>;
  }) => {
    try {
      if (job.archive) {
        const zip = packArchive(job.archive);
        process.send?.({ zip }, () => process.exit(0));
        return;
      }
      if (job.measureCrop) {
        const view = job.svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
        if (!view || view.length !== 4 || !view.every(Number.isFinite)) throw Error("Invalid artwork bounds.");
        // Work in original millimetre coordinates. Remove only the generated outer background.
        const art = job.svg.replace(/(<svg\b[^>]*\bwidth=")[^"]+"/, `$1${view[2]}px"`).replace(/(<svg\b[^>]*\bheight=")[^"]+"/, `$1${view[3]}px"`).replace(/<rect\s+width="[^"]+"\s+height="[^"]+"\s+fill="white"\/>/, "");
        const r = new Resvg(art, { font: { loadSystemFonts: false, fontFiles: ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map(f => join(job.fontRoot, f)), defaultFontFamily: "STIX Two Text" }, logLevel: "off" });
        const b = r.getBBox();
        if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0) throw Error("The image boundaries could not be measured.");
        // Native vector bounds include ink, strokes and arrow markers; retain 2 mm whitespace.
        const x = Math.floor((b.x - 2) * 100) / 100, y = Math.floor((b.y - 2) * 100) / 100;
        const right = Math.ceil((b.x + b.width + 2) * 100) / 100, bottom = Math.ceil((b.y + b.height + 2) * 100) / 100;
        const widthCm = (right - x) / 10, heightCm = (bottom - y) / 10;
        let svg = job.svg.replace(/viewBox="[^"]+"/, `viewBox="${x} ${y} ${right - x} ${bottom - y}"`).replace(/(<svg\b[^>]*\bwidth=")[^"]+"/, `$1${widthCm}cm"`).replace(/(<svg\b[^>]*\bheight=")[^"]+"/, `$1${heightCm}cm"`);
        svg = svg.replace(/<rect\s+width="[^"]+"\s+height="[^"]+"\s+fill="white"\/>/, `<rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" fill="white"/>`);
        process.send?.({ crop: { svg, widthCm, heightCm } }, () => process.exit(0)); return;
      }
      // Round each dimension independently at 600 ppi; keep the original viewBox.
      const input = job.outlined
        ? job.svg
        : job.svg
            .replace(/(<svg\b[^>]*\bwidth=")[^"]+"/, `$1${job.width}px"`)
            .replace(/(<svg\b[^>]*\bheight=")[^"]+"/, `$1${job.height}px"`);
      const renderer = new Resvg(input, {
        background: "white",
        font: {
          loadSystemFonts: false,
          fontFiles: [
            "STIXTwoText-Regular.otf",
            "STIXTwoText-Italic.otf",
            "STIXTwoMath-Regular.otf",
          ].map((f) => join(job.fontRoot, f)),
          defaultFontFamily: "STIX Two Text",
        },
        logLevel: "off",
      });
      if (job.outlined) {
        let svg = renderer.toString();
        // resvg outlines glyphs; restore the physical size rather than its pixel dimensions.
        const original = job.svg.match(/<svg\b([^>]+)>/)?.[1];
        const width = original?.match(/\bwidth="([^"]+)"/)?.[1],
          height = original?.match(/\bheight="([^"]+)"/)?.[1];
        if (width && height)
          svg = svg
            .replace(/\bwidth="[^"]+"/, `width="${width}"`)
            .replace(/\bheight="[^"]+"/, `height="${height}"`);
        const metadata = job.artifactKind === "triangle" ? "<title>Triangle diagram</title><desc>Use the accompanying editable JSON; pupil blanks and saved answer visibility are retained.</desc>" : job.artifactKind === "algebra-grid" ? "<title>Expanding and factorising grid</title><desc>Use the accompanying JSON for editing; pupil blanks are retained.</desc>" : job.artifactKind === "cuboids" ? "<title>Cuboid diagrams</title><desc>Use the accompanying JSON for editing.</desc>"
          : job.artifactKind === "number-line" ? "<title>Number line</title><desc>Use the accompanying JSON for editing.</desc>"
          : job.artifactKind === "venn" ? "<title>Venn diagram</title><desc>Use the accompanying JSON for editing.</desc>"
          : job.artifactKind === "value-graph"
          ? "<title>Table of values and quadratic graph</title><desc>Use the accompanying JSON for editing.</desc>"
          : job.artifactKind === "ratio-table"
          ? "<title>Ratio table</title><desc>Outlined lesson ratio table; use the accompanying JSON for editing.</desc>"
          : "<title>Coordinate graph</title><desc>Outlined portable graph; use the accompanying JSON for editing.</desc>";
        svg = svg.replace(
          /(<svg\b[^>]*>)/,
          "$1" + metadata,
        );
        process.send?.({ svg }, () => process.exit(0));
        return;
      }
      const raster = renderer.render();
      if (raster.width !== job.width || raster.height !== job.height)
        throw Error("Raster dimensions changed.");
      let png: Uint8Array = raster.asPng();
      if (job.print) {
        png = setDensityBytes(png);
        verifyPrintBytes(png, job.width, job.height);
      }
      process.send?.({ png }, () => process.exit(0));
    } catch (error) {
      process.send?.({ code: error instanceof GraphError ? error.code : "render_failed", error: error instanceof GraphError ? error.message : "The artifact could not be rendered." }, () =>
        process.exit(1),
      );
    }
  },
);
