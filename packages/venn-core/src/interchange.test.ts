import { describe, expect, it } from "vitest";
import { activeMasks, canonical, create, forView, renderSvg } from "./index";
import { apply, createVenn, editorLink, hash, reviseVenn } from "./interchange";
describe("Venn connector preservation", () => {
  it("defaults to version2 and preserves imported legacy source/hash/artwork", async () => {
    expect(createVenn().schemaVersion).toBe(2);
    const old = create(3);
    expect(createVenn({ envelope: old })).toEqual(old);
    expect(
      await reviseVenn({
        envelope: old,
        baseHash: await hash(old),
        operations: [],
      }),
    ).toEqual(old);
    expect(renderSvg(createVenn({ envelope: old }))).toBe(renderSvg(old));
    expect(() => apply(old, [{ op: "set_layout", sets: 1 }])).toThrow(
      "upgrade_document",
    );
  });
  it.each([
    [1, "overlap", [0, 1]],
    [2, "overlap", [0, 1, 2, 3]],
    [2, "separate", [0, 1, 2]],
    [2, "b-inside-a", [0, 1, 3]],
    [2, "a-inside-b", [0, 2, 3]],
    [3, "overlap", [0, 1, 2, 3, 4, 5, 6, 7]],
  ] as const)("retains %i %s membership", (sets, arrangement, masks) => {
    const e = createVenn({ spec: { sets, arrangement } });
    expect(activeMasks(e)).toEqual(masks);
    expect(canonical(apply(e, []))).toBe(canonical(e));
    expect(renderSvg(e)).toContain("<svg");
  });
  it("preserves hidden answers and zero across shading and answer views", async () => {
    const e = createVenn({
      spec: {
        regions: [
          {
            mask: 1,
            region: { kind: "number", text: "0", visibility: "hidden" },
          },
          {
            mask: 2,
            region: { kind: "number", text: "1/2", visibility: "line" },
          },
        ],
      },
    });
    const before = canonical(e),
      h = await hash(e);
    const n = apply(e, [
      {
        op: "shade_expression",
        expression: "A ∪ B",
        style: "hatch",
        mode: "replace",
      },
    ]);
    expect(n.document.regions[1].text).toBe("0");
    expect(n.document.regions[2].visibility).toBe("line");
    expect(forView(e, "answer").document.regions[1].visibility).toBe("show");
    expect(canonical(e)).toBe(before);
    expect(await hash(e)).toBe(h);
    const decoded = JSON.parse(
      Buffer.from(
        new URL(editorLink(e, "https://mathsdock.co.uk/")!).hash.slice(6),
        "base64url",
      ).toString(),
    );
    expect(decoded).toEqual(e);
  });
  it("rejects data loss including hidden/shaded contents, then allows requested discard", () => {
    const e = createVenn({
      spec: {
        regions: [
          {
            mask: 3,
            region: {
              kind: "number",
              text: "7",
              visibility: "hidden",
              shade: "grey",
            },
          },
        ],
      },
    });
    expect(() =>
      apply(e, [{ op: "set_layout", arrangement: "separate" }]),
    ).toThrow("discardIncompatible");
    const n = apply(e, [
      { op: "set_layout", arrangement: "separate", discardIncompatible: true },
    ]);
    expect(n.document.regions[3].text).toBe("");
    expect(e.document.regions[3].text).toBe("7");
    expect(() => apply(e, [{ op: "set_layout", sets: 1 }])).toThrow(
      "discardIncompatible",
    );
  });
  it("guards customised third-set labels/definitions and keeps reverse orientation", () => {
    const e = createVenn({
      spec: { sets: 3, definitions: [{ set: "C", text: "Third set" }] },
    });
    expect(() => apply(e, [{ op: "set_layout", sets: 2 }])).toThrow(
      "discardIncompatible",
    );
    const reverse = createVenn({
      spec: {
        arrangement: "a-inside-b",
        regions: [
          { mask: 2, region: { kind: "text", text: "outer" } },
          { mask: 3, region: { kind: "text", text: "inner" } },
        ],
      },
    });
    expect(
      apply(reverse, [{ op: "set_label", set: "A", label: { text: "Inner" } }])
        .document.regions,
    ).toEqual(reverse.document.regions);
    expect((apply(reverse, []) as typeof reverse).document).toEqual(
      reverse.document,
    );
  });
  it("rejects impossible regions, duplicates, inconsistent sources and stale hashes", async () => {
    expect(() =>
      createVenn({
        spec: {
          arrangement: "separate",
          regions: [{ mask: 3, region: { text: "x" } }],
        },
      }),
    ).toThrow("region");
    expect(() =>
      createVenn({
        spec: {
          regions: [
            { mask: 1, region: {} },
            { mask: 1, region: {} },
          ],
        },
      }),
    ).toThrow("once");
    expect(() => createVenn({ spec: {}, envelope: create() })).toThrow(
      "not both",
    );
    const e = createVenn();
    await expect(
      reviseVenn({ envelope: e, baseHash: "0".repeat(64), operations: [] }),
    ).rejects.toThrow("baseHash");
    expect(() =>
      apply(e, [
        { op: "set_region", mask: 1, region: { text: "kept" } },
        { op: "set_region", mask: 7, region: {} },
      ]),
    ).toThrow();
    expect(e.document.regions[1].text).toBe("");
  });
  it("keeps stable identifiers for expressions after labels change", () => {
    let e = createVenn({
      spec: { labels: [{ set: "A", label: { text: "Cats" } }] },
    });
    e = apply(e, [
      {
        op: "shade_expression",
        expression: "A' ∩ B",
        style: "grey",
        mode: "replace",
      },
    ]);
    expect(e.document.regions.map((r) => r.shade)).toEqual([
      "none",
      "none",
      "grey",
      "none",
      "none",
      "none",
      "none",
      "none",
    ]);
    expect(() =>
      apply(e, [
        {
          op: "shade_expression",
          expression: "Cats",
          style: "grey",
          mode: "add",
        },
      ]),
    ).toThrow();
  });
});
