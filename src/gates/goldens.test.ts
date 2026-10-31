// Output goldens (docs/AUTONOMOUS-LOOP-POLICY.md, gate 3). Every gallery example, pupil and worked,
// is rendered in Node by the shared core renderers and resvg with only the bundled STIX fonts (no
// system fonts), and compared with src/gates/golden/outputs.json on:
//  - json:   hash of the canonical saved envelope;
//  - svg:    hash of the exported SVG markup;
//  - mm:     the printed width and height the SVG declares;
//  - png600: the pixel size of the 600 ppi PNG export;
//  - pixels: hash of the rendered pixels (at 150 ppi to keep the gate fast). Pixels are compared
//            only on the platform that recorded them, because rasterisers round differently.
// One example per tool also goes through the full 600 ppi PNG path (render, density chunk, verify).
//
// Goldens change only through the accept command, which records the reason in
// src/gates/golden/ACCEPTED.md:
//   ACCEPT_GOLDENS="why the output changed" npx vitest run src/gates/goldens.test.ts
// A pull request that accepts goldens is T4 or higher and waits for Tim.
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";
import { PRINT_DPI, printRasterSize, setDensityBytes, verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { galleries, physical, renders } from "./outputs";

type Golden = { json: string; svg: string; mm: string; png600: string; pixels: string };
type File = { platform: string; pixelPpi: number; outputs: Record<string, Golden> };

const goldenPath = "src/gates/golden/outputs.json", logPath = "src/gates/golden/ACCEPTED.md"; // repository root
const PIXEL_PPI = 150;
const platform = `${process.platform}-${process.arch}`;
const fontFiles = ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"].map(f => `assets/graph-fonts/${f}`);
const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex").slice(0, 16);
const raster = (svg: string, width: number) =>
  new Resvg(svg, { font: { loadSystemFonts: false, fontFiles, defaultFontFamily: "STIX Two Text" }, fitTo: { mode: "width", value: width } }).render();
const round = (n: number) => Math.round(n * 100) / 100;

const recorded: File = JSON.parse(readFileSync(goldenPath, "utf8"));
const accept = process.env.ACCEPT_GOLDENS?.trim();
const current: Record<string, Golden> = {};

describe("output goldens", () => {
  for (const [tool, entries] of Object.entries(galleries)) {
    it(tool, () => {
      const outputs = renders(entries);
      expect(outputs.length).toBeGreaterThan(0);
      for (const [i, o] of outputs.entries()) {
        const p = physical(o.svg);
        const png = printRasterSize(p.widthMm / 10, p.heightMm / 10);
        current[`${tool}: ${o.id}`] = {
          json: hash(JSON.stringify(o.envelope)),
          svg: hash(o.svg),
          mm: `${round(p.widthMm)}x${round(p.heightMm)}`,
          png600: `${png.width}x${png.height}`,
          pixels: hash(raster(o.svg, Math.round(p.widthMm / 25.4 * PIXEL_PPI)).pixels),
        };
        if (i === 0) {
          // The full print path once per tool: the 600 ppi raster has the recorded pixel size and density.
          const r = raster(o.svg, png.width);
          expect(r.width).toBe(png.width);
          expect(Math.abs(r.height - png.height)).toBeLessThanOrEqual(1);
          expect(() => verifyPrintBytes(setDensityBytes(r.asPng(), PRINT_DPI), r.width, r.height)).not.toThrow();
        }
      }
    }, 120000);
  }

  it("match the accepted goldens", () => {
    const comparePixels = recorded.platform === platform && recorded.pixelPpi === PIXEL_PPI;
    const changes: string[] = [];
    for (const id of new Set([...Object.keys(recorded.outputs), ...Object.keys(current)])) {
      const was = recorded.outputs[id], now = current[id];
      if (!was) { changes.push(`${id}: added`); continue; }
      if (!now) { changes.push(`${id}: removed`); continue; }
      for (const field of Object.keys(now) as (keyof Golden)[])
        if (was[field] !== now[field] && (field !== "pixels" || comparePixels)) changes.push(`${id}: ${field} ${was[field]} -> ${now[field]}`);
    }
    if (accept !== undefined) {
      if (accept.length < 10) throw new Error("ACCEPT_GOLDENS must say why the output changed (at least 10 characters).");
      const outputs = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
      writeFileSync(goldenPath, JSON.stringify({ platform, pixelPpi: PIXEL_PPI, outputs }, null, 1) + "\n");
      if (changes.length || recorded.platform !== platform) appendFileSync(logPath, [
        `\n## ${new Date().toISOString().slice(0, 10)}: ${accept.replace(/\s+/g, " ")}\n`,
        recorded.platform !== platform ? `- pixels re-recorded on ${platform} (was ${recorded.platform})` : "",
        ...changes.slice(0, 200).map(c => `- ${c}`),
        changes.length > 200 ? `- and ${changes.length - 200} more` : "", ""].filter(Boolean).join("\n") + "\n");
      return;
    }
    if (!comparePixels) console.warn(`Pixel goldens were recorded on ${recorded.platform}; this is ${platform}, so pixels are not compared here.`);
    expect(changes, "Output changed. If this is intended, accept it with ACCEPT_GOLDENS=\"reason\" (src/gates/goldens.test.ts); Tim reviews accepted goldens.").toEqual([]);
  });
});
