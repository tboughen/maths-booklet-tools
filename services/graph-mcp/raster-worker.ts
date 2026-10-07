import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
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
    artifactKind?: "graph" | "ratio-table";
  }) => {
    try {
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
        const metadata = job.artifactKind === "ratio-table"
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
    } catch {
      process.send?.({ error: "The graph could not be rendered." }, () =>
        process.exit(1),
      );
    }
  },
);
