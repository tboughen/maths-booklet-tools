import { describe, expect, it } from "vitest";
import * as v1 from "./index";
import * as v2 from "./v2";
import * as v3 from "./v3";

describe("bar model lines (U111)", () => {
  it("prints bold lines in every schema version when the model saves bold lines", () => {
    for (const m of [v1, v2, v3] as const) {
      const e = m.fresh() as never as { document: { presentation: { lines?: "normal" | "bold" } } };
      const normal = (m.renderSvg as (x: unknown) => string)(e);
      e.document.presentation.lines = "bold";
      const bold = (m.renderSvg as (x: unknown) => string)((m.validate as (x: unknown) => unknown)(e));
      const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((w) => Number(w[1]));
      expect(widths(bold).length).toBe(widths(normal).length);
      widths(bold).forEach((w, i) => expect(w).toBeCloseTo(widths(normal)[i] * 1.5, 4));
    }
  });
});
