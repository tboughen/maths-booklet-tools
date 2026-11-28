import { describe, expect, it } from "vitest";
import * as c from "./index";
import * as io from "./interchange";

describe("construction connector adapter", () => {
  it("builds a drawing from a spec with constructions hidden as answers by default", () => {
    const e = io.create({
      spec: {
        widthCm: 12,
        heightCm: 8,
        caption: "Scale: 1 cm represents 50 m",
        points: [{ id: "A", x: 2, y: 3 }, { id: "B", x: 9, y: 3 }, { id: "T", x: 5, y: 6, label: "Tree", mark: "dot" }],
        objects: [{ type: "segment", from: "A", to: "B", label: "350 m" }, { type: "region", rules: [{ kind: "distance", from: "T", distance: 1.5, side: "within" }], answer: true }],
        constructions: [{ type: "perpendicular-bisector", a: "A", b: "B" }, { type: "locus-point", point: "T", distance: 1.5 }],
      },
    });
    expect(e.document.caption.text).toBe("Scale: 1 cm represents 50 m");
    expect(c.pointById(e.document, "T")!.label.text).toBe("Tree");
    expect(e.document.objects.filter((o) => o.group).every((o) => o.role === "answer")).toBe(true);
    expect(e.document.objects.find((o) => o.type === "region")!.role).toBe("answer");
  });

  it("draws the locus round a whole shape, either-or shading, a north-line angle and the not-to-scale note", async () => {
    const e = io.create({
      spec: {
        widthCm: 14,
        heightCm: 10,
        notAccurate: true,
        points: [{ id: "P", x: 4, y: 3 }, { id: "Q", x: 9, y: 3 }, { id: "R", x: 9, y: 6 }, { id: "S", x: 4, y: 6 }],
        objects: [
          { type: "polygon", id: "pond", points: ["P", "Q", "R", "S"] },
          { type: "north", id: "nQ", at: "Q" },
          { type: "angle", at: "Q", from: "nQ", to: "P", label: "x" },
          { type: "region", rules: [{ kind: "either", rules: [{ kind: "distance", from: "pond", distance: 1, side: "within" }, { kind: "distance", from: "R", distance: 2, side: "within" }] }], answer: true },
        ],
        constructions: [{ type: "locus-polygon", shape: "pond", distance: 1 }],
      },
    });
    expect(e.document.notAccurate).toBe(true);
    expect(e.document.objects.filter((o) => o.group === "lg1")).toHaveLength(8);
    expect(c.renderSvg(e)).toContain(c.NOT_ACCURATE);
    const off = await io.revise({ envelope: e, baseHash: await c.hash(e), operations: [{ op: "set_drawing", notAccurate: false }] });
    expect(off.document.notAccurate).toBeUndefined();
    expect(c.renderSvg(off)).not.toContain(c.NOT_ACCURATE);
  });

  it("places bearing points before the objects that join them", () => {
    const e = io.create({
      spec: {
        points: [{ id: "P", x: 3, y: 3 }],
        constructions: [{ type: "point-by-bearing", id: "Q", from: "P", bearing: 70, distance: 4.5, answer: true }],
        objects: [{ type: "bearing", from: "P", to: "Q", measure: true, answer: true }, { type: "segment", from: "P", to: "Q", measure: { scaleCm: 1, represents: 4, unit: "km" } }],
      },
    });
    expect(e.document.objects.find((o) => o.type === "bearing")).toMatchObject({ label: { text: "070°" }, role: "answer" });
    expect(e.document.objects.find((o) => o.type === "segment")).toMatchObject({ label: { text: "18 km" } });
  });

  it("makes examples, worked copies and refuses mixed requests", () => {
    for (const example of io.exampleIds) expect(c.exportIssue(io.create({ spec: { example } }))).toBeNull();
    const worked = io.create({ spec: { example: "angle-bisector", worked: true } });
    expect(c.hasHidden(worked)).toBe(false);
    expect(() => io.create({ spec: { example: "angle-bisector", points: [{ id: "A", x: 1, y: 1 }] } })).toThrow(/Examples/);
    expect(() => io.create({ spec: {}, envelope: c.create() })).toThrow(/not both/);
  });

  it("revises atomically with a base hash", async () => {
    const e = c.create();
    const baseHash = await c.hash(e);
    const out = await io.revise({
      envelope: e,
      baseHash,
      operations: [
        { op: "set_drawing", grid: "cm", caption: "Not to scale" },
        { op: "add_point", point: { id: "C", x: 6, y: 7 } },
        { op: "set_object", id: "AB", fields: { label: "7 cm" } },
        { op: "set_answer", ids: ["pb1"], answer: false },
        { op: "add_construction", construction: { type: "locus-point", point: "C", distance: 1 } },
        { op: "remove_group", group: "lp1" },
      ],
    });
    expect(out.document.grid).toBe("cm");
    expect(out.document.objects.find((o) => o.id === "AB")).toMatchObject({ label: { text: "7 cm" } });
    expect(out.document.objects.filter((o) => o.group === "pb1").every((o) => o.role === "given")).toBe(true);
    expect(out.document.objects.some((o) => o.group === "lp1")).toBe(false);
    await expect(io.revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    await expect(io.revise({ envelope: e, baseHash, operations: [{ op: "set_object", id: "AB", fields: { radius: 2 } }] })).rejects.toThrow(/does not apply/);
  });
});

describe("moving points", () => {
  it("refuses to move a point a saved construction was built from", async () => {
    const e = c.create();
    await expect(io.revise({ envelope: e, baseHash: await c.hash(e), operations: [{ op: "set_point", id: "B", point: { x: 8 } }] })).rejects.toThrow(/remove_group/);
  });
});
