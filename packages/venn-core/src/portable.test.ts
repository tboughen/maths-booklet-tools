// @vitest-environment node
import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";
import { activeMasks, geometry, renderSvg } from "./index";
import { createVenn, apply } from "./interchange";
import { renderPortableSvg } from "./portable";
describe("portable Venn vectors", () => {
  it.each([
    [1, "overlap"],
    [2, "overlap"],
    [2, "separate"],
    [2, "b-inside-a"],
    [2, "a-inside-b"],
    [3, "overlap"],
  ] as const)(
    "retains every %i/%s shading truth region without luminance masks",
    (sets, arrangement) => {
      const e = createVenn({
          spec: {
            sets,
            arrangement,
            labels: ["universe", "A", "B", "C"].map((set) => ({
              set,
              label: { visibility: "hidden" },
            })),
          },
        }),
        g = geometry(e);
      for (const mask of activeMasks(e)) {
        const n = apply(e, [
          {
            op: "shade_regions",
            masks: [mask],
            style: "grey",
            mode: "replace",
          },
        ]);
        const browserSource = renderSvg(n),
          portable = renderPortableSvg(n);
        expect(portable).not.toMatch(/<mask\b|\smask=/);
        const normalize = (svg: string) =>
          svg
            .replace(/width="[^"]+"/, `width="${g.width * 4}px"`)
            .replace(/height="[^"]+"/, `height="${g.height * 4}px"`);
        const options = { font: { loadSystemFonts: false } };
        const a = new Resvg(normalize(browserSource), options).render(),
          b = new Resvg(normalize(portable), options).render();
        const aPixels = a.pixels,
          bPixels = b.pixels;
        let checked = 0;
        for (
          let y = Math.ceil(g.box.y + 3);
          y < g.box.y + g.box.height - 3;
          y += 3
        )
          for (
            let x = Math.ceil(g.box.x + 3);
            x < g.box.x + g.box.width - 3;
            x += 3
          ) {
            const values = g.circles.map(
              (c) => ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2,
            );
            if (values.some((q) => Math.abs(q - 1) < 0.15)) continue;
            const membership = values.reduce(
                (v, q, i) => v + (q < 1 ? 1 << i : 0),
                0,
              ),
              expected = membership === mask ? 216 : 255;
            const at = (y * 4 * a.width + x * 4) * 4;
            expect(aPixels[at]).toBe(expected);
            expect(bPixels[at]).toBe(expected);
            checked++;
          }
        expect(checked).toBeGreaterThan(20);
      }
    },
  );
});
