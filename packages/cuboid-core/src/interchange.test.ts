import { describe, expect, it } from "vitest";
import {
  appearance,
  canonical,
  faceNames,
  renderSvg,
} from "./index";
import { apply, createCuboid, reviseCuboid } from "./interchange";
describe("cuboid connector preserves mathematical and teaching state", () => {
  it("creates version 2 and rejects a version-1 file", () => {
    const e = createCuboid();
    expect(e.rendererVersion).toBe("cuboids-2");
    expect(() => createCuboid({ envelope: { ...e, schemaVersion: 1, rendererVersion: "cuboids-1" } })).toThrow();
  });
  it("converts dimensions and cube side in displayed units without revealing answers", () => {
    const e = createCuboid({
      spec: {
        shapes: [
          {
            dimensions: { width: "3/2", height: "2", depth: "1" },
            labels: { width: { mode: "blank" } },
            caption: "Volume = 99 cm³",
          },
        ],
      },
    });
    const n = apply(e, [
      { op: "set_unit", id: "cuboid-1", unit: "mm" },
      { op: "set_cube_side", id: "cuboid-1", value: "5" },
    ]);
    expect(n.document.shapes[0].dimensions).toEqual({
      width: "15",
      height: "20",
      depth: "10",
    });
    expect(n.document.shapes[0].cubeSideCm).toBe("1/2");
    expect(n.document.shapes[0].labels).toEqual(e.document.shapes[0].labels);
    expect(n.document.shapes[0].workedVolume).toBe(false);
    expect(n.document.shapes[0].caption).toBe(e.document.shapes[0].caption);
    expect(
      apply(n, [{ op: "set_unit", id: "cuboid-1", unit: "cm" }]).document
        .shapes[0].dimensions,
    ).toEqual(e.document.shapes[0].dimensions);
  });
  it("requires referenceAxis for cube lock", () => {
    const e = createCuboid();
    expect(() =>
      apply(e, [{ op: "set_cube", id: "cuboid-1", enabled: true }]),
    ).toThrow("referenceAxis");
    expect(
      apply(e, [
        {
          op: "set_cube",
          id: "cuboid-1",
          enabled: true,
          referenceAxis: "depth",
        },
      ]).document.shapes[0].dimensions,
    ).toEqual({ width: "3", depth: "3", height: "3" });
  });
  it.each(faceNames)(
    "retains highlight %s with blank area and exact data",
    (face) => {
      const e = createCuboid(),
        a = appearance(e.document.shapes[0]);
      a.mode = "one";
      a.face = face;
      a.area.mode = "blank";
      const n = apply(e, [
        { op: "set_appearance", id: "cuboid-1", appearance: a },
      ]);
      expect(n.document.shapes[0].dimensions).toEqual(
        e.document.shapes[0].dimensions,
      );
      expect(renderSvg(n)).toContain("…………");
    },
  );
  it("adds/removes/replaces by stable ID, refuses last removal and rolls back failures", async () => {
    const e = createCuboid(),
      before = canonical(e);
    const n = apply(e, [
      { op: "add_shape", shape: {} },
      { op: "add_shape", afterId: "cuboid-1", shape: { id: "third" } },
      { op: "remove_shape", id: "cuboid-2" },
      { op: "replace_shape", id: "third", shape: { title: "Replacement" } },
    ]);
    expect(n.document.shapes.map((s) => s.id)).toEqual(["cuboid-1", "third"]);
    expect(() => apply(e, [{ op: "remove_shape", id: "cuboid-1" }])).toThrow();
    expect(() =>
      apply(e, [
        { op: "set_dimension", id: "cuboid-1", axis: "width", value: "9" },
        { op: "set_dimension", id: "missing", axis: "height", value: "8" },
      ]),
    ).toThrow();
    expect(canonical(e)).toBe(before);
    await expect(
      reviseCuboid({ envelope: e, baseHash: "0".repeat(64), operations: [] }),
    ).rejects.toThrow("baseHash");
  });
  it("rejects invalid decomposition, excessive structures and unreadable cells", () => {
    const e = createCuboid();
    expect(() =>
      apply(e, [
        { op: "set_view", id: "cuboid-1", view: "cubes" },
        { op: "set_cube_side", id: "cuboid-1", value: "7" },
      ]),
    ).toThrow();
    expect(() =>
      createCuboid({ spec: { shapes: Array.from({ length: 4 }, () => ({})) } }),
    ).toThrow();
    expect(() =>
      createCuboid({
        spec: {
          widthCm: 4,
          shapes: [
            {
              dimensions: { width: "20", depth: "20", height: "20" },
              view: "cubes",
              labels: {
                width: { mode: "hidden" },
                height: { mode: "hidden" },
                depth: { mode: "hidden" },
              },
            },
          ],
        },
      }),
    ).toThrow("2 mm");
  });
});
