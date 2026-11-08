import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { loadSubsetter, subsetFont, svgCodepoints } from "./font-subset";

const font = (name: string) => new Uint8Array(readFileSync(`assets/graph-fonts/${name}`));
const fonts = ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"];
const hb = await loadSubsetter(readFileSync("node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm"));

describe("SVG font subsetting", () => {
  it("collects the characters an SVG shows, not its markup, comments or styles", () => {
    const cps = svgCodepoints('<svg aria-label="zzz"><!-- qqq --><style>@font-face{src:url(data:kkk)}</style><text>3 &amp; x&#x2212;1 &#215;</text></svg>');
    expect([...cps].map((c) => String.fromCodePoint(c)).sort()).toEqual([" ", "&", "1", "3", "x", "×", "−"].sort());
  });

  it("cuts each STIX font down to a small fraction of its size", () => {
    const cps = svgCodepoints("<svg><text>y = 2x + 1</text><text>−3 × 4 = 𝑥</text></svg>");
    for (const name of fonts) {
      const full = font(name), subset = subsetFont(hb, full, cps);
      expect(subset, name).not.toBeNull();
      expect(subset!.byteLength, name).toBeLessThan(full.byteLength / 5);
      expect(new TextDecoder().decode(subset!.slice(0, 4)), name).toBe("OTTO");
    }
  });

  it("renders the subset text exactly as the full fonts do", () => {
    const text = "Ratio 3 : 5 → 12 − 7 × ½ x² 𝑥 fi";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160"><rect width="600" height="160" fill="#fff"/><text x="10" y="60" font-family="STIX Two Text, STIX Two Math" font-size="36">${text}</text><text x="10" y="130" font-family="STIX Two Text, STIX Two Math" font-style="italic" font-size="36">${text}</text></svg>`;
    const cps = svgCodepoints(svg);
    const render = (buffers: Uint8Array[]) =>
      // resvg-js 2.6 accepts fontBuffers at run time; its type definitions predate the option.
      new Resvg(svg, { font: { loadSystemFonts: false, fontBuffers: buffers.map((b) => Buffer.from(b)), defaultFontFamily: "STIX Two Text" } as never }).render().pixels;
    const full = render(fonts.map(font));
    const subset = render(fonts.map((name) => subsetFont(hb, font(name), cps)!));
    expect(Buffer.compare(Buffer.from(full), Buffer.from(subset))).toBe(0);
  });
});
