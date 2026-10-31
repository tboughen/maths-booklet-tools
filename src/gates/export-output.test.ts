// Export output gates (docs/AUTONOMOUS-LOOP-POLICY.md, gates 4 and 6) over every gallery example,
// pupil and worked, rendered by the same shared core renderers the exports use:
//  - export chrome: no editor-only markup (handles, controls, focus, scripts, foreign HTML);
//  - physical size: the root carries absolute width and height, keeps the viewBox aspect, and
//    declared type never gets smaller than the committed baseline (print-baseline.json).
// After a deliberate size increase, refresh the baseline with UPDATE_PRINT_BASELINE=1 npx vitest
// run src/gates. Lowering a baseline value needs Tim (never shrink type to make things fit).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { galleries, physical, renders } from "./outputs";

// Markup that belongs to the editor, never to a printed resource.
const chrome: [string, RegExp][] = [
  ["script", /<script\b/i],
  ["foreignObject", /<foreignObject\b/i],
  ["tabindex", /\stabindex=/i],
  ["event handler", /\son[a-z]+=/i],
  ["editor-only data attribute", /\sdata-(?:editor|handle|control|selected|focus)[\w-]*=/i],
  ["editor class", /\sclass="[^"]*\b(?:handle|control|selected|focus(?:ed)?|hover|warning|drag\w*)\b[^"]*"/i],
  ["cursor style", /cursor\s*:/i],
  ["focus ring", /outline\s*:|:focus/i],
  ["external reference", /\s(?:xlink:)?href="(?:https?:)?\/\//i],
];

// Smallest declared font size, in points at print size.
function minFontPt(svg: string, mmPerUnit: number) {
  const sizes = [...svg.matchAll(/font-size(?:="|\s*:\s*)([\d.]+)(px|pt|mm)?/g)].map(m => {
    const n = Number(m[1]), unit = m[2];
    return unit === "pt" ? n : unit === "mm" ? n * 72 / 25.4 : n * mmPerUnit * 72 / 25.4;
  });
  return sizes.length ? Math.min(...sizes) : null;
}

const baselinePath = "src/gates/print-baseline.json"; // vitest runs from the repository root
const baseline: Record<string, number> = JSON.parse(readFileSync(baselinePath, "utf8"));
const observed: Record<string, number> = {};

describe("export output", () => {
  for (const [tool, entries] of Object.entries(galleries)) {
    describe(tool, () => {
      const outputs = renders(entries);

      it("has examples to check", () => expect(outputs.length).toBeGreaterThan(0));

      it("carries no editor chrome", () => {
        const found = outputs.flatMap(o => chrome.filter(([, re]) => re.test(o.svg)).map(([name]) => `${o.id}: ${name}`));
        expect(found).toEqual([]);
      });

      it("has an absolute print size that keeps the viewBox aspect", () => {
        const bad = outputs.flatMap(o => {
          const p = physical(o.svg);
          if (!(p.widthMm > 0 && p.heightMm > 0)) return [`${o.id}: width/height not in mm, cm, in or pt`];
          if (!(p.vw > 0 && p.vh > 0)) return [`${o.id}: missing viewBox`];
          return Math.abs(p.widthMm / p.vw - p.heightMm / p.vh) > 0.005 * (p.widthMm / p.vw) ? [`${o.id}: width and height scale differently`] : [];
        });
        expect(bad).toEqual([]);
      });

      it("never declares type smaller than the baseline", () => {
        const mins = outputs.map(o => { const p = physical(o.svg); return minFontPt(o.svg, p.widthMm / p.vw); }).filter((v): v is number => v !== null);
        if (!mins.length) return;
        const min = Math.round(Math.min(...mins) * 100) / 100;
        observed[tool] = min;
        if (process.env.UPDATE_PRINT_BASELINE === "1") return;
        expect(baseline[tool], `no baseline for ${tool}; run with UPDATE_PRINT_BASELINE=1`).toBeTypeOf("number");
        expect(min).toBeGreaterThanOrEqual(baseline[tool] - 0.01);
      });
    });
  }

  it("writes the baseline only when asked", () => {
    if (process.env.UPDATE_PRINT_BASELINE !== "1") return;
    writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(Object.entries(observed).sort()), null, 2) + "\n");
  });
});
