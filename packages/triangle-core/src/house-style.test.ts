import { describe, expect, it } from "vitest";
import { create, revise, hash, printFacts } from "./interchange";
import { canonical, validate } from "./model";
import { renderSvg } from "./render";

describe("triangle house style (U111)", () => {
  it("bold lines multiply strokes and normal lines are never saved", async () => {
    const plain = create({});
    const bold = create({ spec: { lines: "bold" } });
    expect(bold.document.lines).toBe("bold");
    expect(renderSvg(plain)).toContain('stroke-width=".3"');
    expect(renderSvg(bold)).toContain('stroke-width="0.45"');
    const back = await revise({ envelope: bold, baseHash: await hash(bold), operations: [{ op: "set_print", lines: "normal" }] });
    expect(back.document.lines).toBeUndefined();
    expect(canonical(back)).not.toContain('"lines"');
    expect(canonical(validate({ ...plain, document: { ...plain.document, lines: "normal" } }))).not.toContain('"lines"');
  });
  it("text size is saved, prints at that size, 11 pt is never saved and it is never below 11 pt", async () => {
    const e = create({});
    const big = await revise({ envelope: e, baseHash: await hash(e), operations: [{ op: "set_print", fontPt: 13 }] });
    expect(big.document.fontPt).toBe(13);
    expect(Math.max(...printFacts(big).referenceFeatures.textSizesPt)).toBeCloseTo(13, 2);
    expect(Math.max(...printFacts(e).referenceFeatures.textSizesPt)).toBeCloseTo(11, 2);
    await expect(revise({ envelope: e, baseHash: await hash(e), operations: [{ op: "set_print", fontPt: 10 }] })).rejects.toThrow();
    const back = await revise({ envelope: big, baseHash: await hash(big), operations: [{ op: "set_print", fontPt: 11 }] });
    expect(canonical(back)).not.toContain("fontPt");
    expect(canonical(create({ spec: { fontPt: 11 } }))).not.toContain("fontPt");
    const captioned = create({ spec: { fontPt: 14, operations: [{ op: "add_caption", label: { text: "Find x" } }] } });
    expect(renderSvg(captioned)).not.toMatch(/font-size="3\.88/);
    expect(renderSvg(create({ spec: { operations: [{ op: "add_caption", label: { text: "Find x" } }] } }))).toMatch(/font-size="3\.88/);
    await expect(revise({ envelope: e, baseHash: await hash(e), operations: [{ op: "set_print" }] })).rejects.toThrow(/widthCm, fontPt or lines/);
  });
});
