import { describe, expect, it } from "vitest";
import * as pt from "./interchange";
import * as ptCore from "./index";
import * as ft from "../../frequency-tree-core/src/interchange";
import * as ftCore from "../../frequency-tree-core/src/index";

const families = [
  { name: "probability tree", create: pt.create, revise: pt.revise, core: ptCore },
  { name: "frequency tree", create: ft.create, revise: ft.revise, core: ftCore },
] as unknown as { name: string; create: typeof pt.create; revise: typeof pt.revise; core: typeof ptCore }[];

describe("tree house style (U111)", () => {
  it.each(families)("$name: bold lines multiply strokes and normal lines are never saved", async ({ create, revise, core }) => {
    const plain = create({});
    const bold = create({ spec: { settings: { lines: "bold" } } });
    expect(bold.document.lines).toBe("bold");
    const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]);
    const a = widths(core.renderSvg(plain)), b = widths(core.renderSvg(bold));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(a.length);
    b.forEach((w, i) => expect(w).toBeCloseTo(a[i] * 1.5, 3));
    const back = await revise({ envelope: bold, baseHash: await core.hash(bold), operations: [{ op: "set_settings", settings: { lines: "normal" } }] });
    expect(core.canonical(back)).not.toContain('"lines"');
  });
});
