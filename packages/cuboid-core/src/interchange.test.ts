import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  appearance,
  canonical,
  create,
  faceNames,
  renderSvg,
  validate,
} from "./index";
import { apply, createCuboid, hash, reviseCuboid } from "./interchange";
describe("cuboid connector preserves mathematical and teaching state", () => {
  it("preserves every retained legacy fixture's canonical source and artwork", async () => {
    const fixtures = JSON.parse(
      readFileSync("packages/cuboid-core/src/fixtures/v1.json", "utf8"),
    ) as Array<{ id: string; envelope: unknown }>;
    expect(fixtures.length).toBe(20);
    for (const fixture of fixtures) {
      const old = validate(fixture.envelope),
        before = canonical(old),
        svg = renderSvg(old);
      const copy = createCuboid({ envelope: old });
      expect(canonical(copy), fixture.id).toBe(before);
      expect(renderSvg(copy), fixture.id).toBe(svg);
      const refreshed = await reviseCuboid({
        envelope: copy,
        baseHash: await hash(copy),
        operations: [],
      });
      expect(canonical(refreshed), fixture.id).toBe(before);
    }
  });
  it("uses current defaults while retaining version-1 files and empty revisions", async () => {
    expect(createCuboid().rendererVersion).toBe("cuboids-2");
    const old = validate(
      JSON.parse(
        readFileSync("packages/cuboid-core/src/fixtures/v1.json", "utf8"),
      )[0].envelope,
    );
    expect(canonical(createCuboid({ envelope: old }))).toBe(canonical(old));
    expect(
      await reviseCuboid({
        envelope: old,
        baseHash: await hash(old),
        operations: [],
      }),
    ).toEqual(old);
    expect(renderSvg(createCuboid({ envelope: old }))).toBe(renderSvg(old));
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
  it("requires referenceAxis for cube lock and explicit upgrade for new appearance", () => {
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
    const old = create();
    expect(() =>
      apply(old, [
        {
          op: "set_appearance",
          id: "cuboid-1",
          appearance: appearance(old.document.shapes[0]),
        },
      ]),
    ).toThrow("upgrade_document");
    expect(apply(old, [{ op: "upgrade_document" }]).schemaVersion).toBe(2);
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
