import { describe, expect, it } from "vitest";
import * as po from "./index";
import * as io from "./interchange";
import { examples } from "./examples";

const spinner = (labels: unknown[], extra: Record<string, unknown> = {}) => io.create({ spec: { objects: [{ type: "spinner", labels, ...extra }] } });

describe("spinners, dice and bags", () => {
  it("starts with a fair four-sector spinner and keeps blanks distinct from hidden answers", () => {
    const e = po.create();
    const s = e.document.objects[0] as po.Spinner;
    expect(s.sectors.map((x) => x.label.text)).toEqual(["1", "2", "3", "4"]);
    expect(po.sectorAngles(s)).toEqual([90, 90, 90, 90]);
    const blank = po.setLabel(e, "o1", "sector:1", { text: "" });
    expect(() => po.setLabel(blank, "o1", "sector:1", { show: "hidden" })).toThrow(/blank cannot hold a hidden answer/);
    expect(po.renderSvg(blank)).toContain("stroke-dasharray");
    const hidden = po.setLabel(e, "o1", "sector:1", { text: "Red", show: "hidden" });
    expect(po.renderSvg(hidden)).not.toContain(">Red<");
    expect(po.renderSvg(po.forView(hidden, "answer", true))).toContain(po.ANSWER_COLOUR);
    // Both copies keep one size.
    expect(po.layout(po.forView(hidden, "answer")).width).toBeCloseTo(po.layout(hidden).width);
  });

  it("shares what is left between sectors without an angle and refuses angles that do not make 360°", () => {
    const e = spinner(["1", "2", "3"], { angles: [90, null, null] });
    expect(po.sectorAngles(e.document.objects[0] as po.Spinner)).toEqual([90, 135, 135]);
    expect(() => spinner(["1", "2"], { angles: [90, 90] })).toThrow(/add up to 180°/);
    expect(() => spinner(["1", "2", "3"], { angles: [200, 200, null] })).toThrow(/more than 360°/);
    expect(() => spinner(["1", "2", "3"], { angles: [90, null, null], shape: "polygon" })).toThrow(/polygon spinner has equal sectors/);
  });

  it("prints nothing for empty labels when asked, and dotted lines by default", () => {
    const dotted = spinner(["", "", ""]);
    const none = spinner(["", "", ""], { emptyLabels: "none" });
    expect(po.renderSvg(dotted).match(/stroke-dasharray/g)?.length).toBe(3);
    expect(po.renderSvg(none)).not.toContain("stroke-dasharray");
  });

  it("marks right angles only on 90° sectors", () => {
    const e = spinner(["1", "2", "3"], { angles: [90, null, null], rightAngles: true });
    expect(po.renderSvg(e).match(/fill="none" stroke="black" stroke-width="0.25"/g)?.length).toBe(1);
  });

  it("draws dice with pips for 1 to 6, numbers otherwise, and flags impossible dice", () => {
    const e = io.create({ spec: { objects: [{ type: "dice", faces: ["6", "1", "2"] }] } });
    expect(po.warnings(e)[0]).toMatch(/6 and 1 are on opposite faces/);
    expect(po.renderSvg(e).match(/<circle/g)?.length).toBe(6 + 1 + 2 + 1); // + the dotted pattern dot
    expect(() => io.create({ spec: { objects: [{ type: "dice", view: "cube", faces: ["1", "2"] }] } })).toThrow(/three faces/);
    const faces = io.create({ spec: { objects: [{ type: "dice", view: "faces", marks: "numbers", faces: ["A", "B", { text: "C", hidden: true }] }] } });
    expect(po.renderSvg(faces)).toContain(">A<");
    expect(po.renderSvg(faces)).not.toContain(">C<");
  });

  it("holds at most 40 counters in a bag and hides a group's label on every counter", () => {
    expect(() => io.create({ spec: { objects: [{ type: "bag", groups: [{ count: 30 }, { count: 11 }] }] } })).toThrow(/at most 40 counters/);
    const e = io.create({ spec: { objects: [{ type: "bag", groups: [{ label: "R", count: 3 }, { label: { text: "B", hidden: true }, fill: "grey", count: 2 }] }] } });
    expect(po.renderSvg(e).match(/>R</g)?.length).toBe(3);
    expect(po.renderSvg(e)).not.toContain(">B<");
    expect(po.renderSvg(po.forView(e, "answer", true)).match(/>B</g)?.length).toBe(2);
  });

  it("revises with the exact hash and keeps object IDs", async () => {
    const e = io.create({ spec: { example: "dice-and-spinner" } });
    const hash = await po.hash(e);
    const next = await io.revise({
      envelope: e,
      baseHash: hash,
      operations: [
        { op: "set_label", objectId: "o2", slot: "sector:0", text: "1", show: "hidden" },
        { op: "add_object", object: { type: "bag", groups: [{ label: "R", count: 2 }] } },
        { op: "move_object", objectId: "o3", by: -1 },
      ],
    });
    expect(next.document.objects.map((o) => o.id)).toEqual(["o1", "o3", "o2"]);
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
  });

  it("keeps every example valid, round-trips files and links, and never shows hidden answers to pupils", () => {
    for (const x of examples) {
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(po.parseFile(po.canonical(e))).toEqual(e);
        expect(po.decodeLinkHash(po.linkHash(e))).toEqual(e);
        expect(po.exportIssue(e)).toBeNull();
        expect(po.warnings(e)).toEqual([]);
      }
      const pupil = po.renderSvg(x.make(false));
      expect(pupil).not.toContain(po.ANSWER_COLOUR);
    }
  });

  it("warns when a label is too wide for a narrow sector", () => {
    const e = spinner(Array.from({ length: 12 }, () => "Yellow"), { sizeMm: 25 });
    expect(po.warnings(e).some((w) => /too narrow/.test(w))).toBe(true);
  });

  it("adds a sector to a spinner whose angles make 360° by going back to equal sectors", () => {
    const e = spinner(["1", "2", "3", "4"], { angles: [90, 90, 90, 90] });
    const n = po.addSector(e, "o1");
    expect(po.sectorAngles(n.document.objects[0] as po.Spinner)).toEqual([72, 72, 72, 72, 72]);
  });

  it("names the field that is wrong in an opened file", () => {
    const bad = structuredClone(po.create()) as unknown as { document: { objects: { sectors: { angle: number }[] }[] } };
    bad.document.objects[0].sectors[0].angle = -5;
    expect(() => po.validate(bad)).toThrow(/sector angle is more than 0°/);
    const many = structuredClone(po.create()) as unknown as { document: { objects: { sectors: unknown[] }[] } };
    many.document.objects[0].sectors = many.document.objects[0].sectors.slice(0, 1);
    expect(() => po.validate(many)).toThrow(/2 to 12 sectors/);
  });

  it("reads six faces given to the connector as a row of faces", () => {
    const e = io.create({ spec: { objects: [{ type: "dice", faces: ["1", "2", "3", "4", "5", "6"] }] } });
    expect((e.document.objects[0] as po.Dice).view).toBe("faces");
  });
});
