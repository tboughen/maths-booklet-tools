import { describe, it, expect } from "vitest";
import * as v from "./v2";
import * as c from "./versioned";
import * as i from "./versioned-interchange";
import * as old from "./index";
import * as oi from "./interchange";
import { lessonExample, lessonExampleNames } from "./lesson-examples";
import controls from "./fixtures/v1-controls.json";
import { createHash } from "node:crypto";
import { denseFixture } from "./stress-fixture";
import fontMetrics from "./v2-font-metrics.json";
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
describe("bar lesson v2 compatibility and teaching intent", () => {
  it("keeps actual ink within the outer margins for aligned answer lines and names", () => {
    for (const name of ["j", "1/5"]) {
      const e = v.fresh();
      e.document.bars[0].name = v.label(name);
      e.document.captions = [
        { id: "left", label: v.label("18", "line"), alignment: "left" },
        { id: "right", label: v.label("18", "line"), alignment: "right" },
        { id: "text", label: v.label("j"), alignment: "left" },
      ];
      const g = v.layout(e),
        svg = v
          .renderSvg(e)
          .replace(/<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/, "")
          .replace(/\bwidth="[^"]+"/, `width="${g.width}px"`)
          .replace(/\bheight="[^"]+"/, `height="${g.height}px"`),
        box = new Resvg(svg, {
          font: {
            loadSystemFonts: false,
            fontFiles: [
              "assets/graph-fonts/STIXTwoText-Regular.otf",
              "assets/graph-fonts/STIXTwoMath-Regular.otf",
            ],
            defaultFontFamily: "STIX Two Text",
          },
        }).getBBox()!;
      expect(box.x).toBeGreaterThanOrEqual(3.99);
      expect(box.x + box.width).toBeLessThanOrEqual(g.width - 3.99);
      expect(g.issues).toEqual([]);
    }
  });
  it("aligns mixed decorations and fraction labels to a common lane baseline", () => {
    const e = lessonExample("R5", true);
    e.document.annotations = e.document.annotations.slice(0, 2);
    e.document.annotations[0].label = v.label("1/2");
    e.document.annotations[1].decoration = "dimension";
    const g = v.layout(e);
    expect(g.annotations[0].lane).toBe(g.annotations[1].lane);
    expect(g.annotations[0].textY).toBe(g.annotations[1].textY);
    expect(g.issues).toEqual([]);
  });
  it("binds measured glyphs to the actual bundled fonts and preserves unsupported saved text", () => {
    for (const font of fontMetrics.fonts)
      expect(
        createHash("sha256")
          .update(readFileSync(`assets/graph-fonts/${font.filename}`))
          .digest("hex"),
      ).toBe(font.sha256);
    const e = v.fresh();
    e.document.captions = [
      {
        id: "caption",
        label: v.label("π × 2 − ½ ÷ 3 = x"),
        alignment: "centre",
      },
    ];
    expect(v.exportIssue(e)).toBe("");
    e.document.captions[0].label = v.label("🙂");
    expect(v.exportIssue(e)).toMatch(/U\+1F642/);
    e.document.captions[0].label.state = "hidden";
    expect(v.exportIssue(e)).toBe("");
    expect(v.canonical(e)).toContain("🙂");
  });
  it("allows invisible inside annotations but rejects overlapping visible inside glyphs", () => {
    const e = v.fresh();
    e.document.annotations[0] = {
      ...e.document.annotations[0],
      decoration: "none",
      placement: "inside",
      label: v.label("saved", "hidden"),
    };
    expect(v.exportIssue(e)).toBe("");
    const r = lessonExample("R2-C", true);
    r.document.annotations.push({
      ...r.document.annotations[1],
      id: "duplicate-inside",
    });
    expect(v.exportIssue(r)).toMatch(/another label/);
  });
  it("matches independent frozen legacy source and raw SVG controls", () => {
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    for (const control of controls) {
      const name = control.name
        .replace(/^legacy-/, "")
        .replace(/-(worked|pupil)$/, "");
      const e = old.example(name, control.name.endsWith("-worked"));
      expect(sha(c.canonical(e))).toBe(control.sourceSha256);
      expect(sha(c.renderSvg(e))).toBe(control.rawSvgSha256);
    }
  });
  it("bounds a dense 96-section, 18-annotation, three-slot resource and rejects byte overflow", () => {
    const e = denseFixture();
    expect(e.document.bars.flatMap((b) => b.parts)).toHaveLength(96);
    expect(e.document.annotations).toHaveLength(18);
    expect(v.exportIssue(e)).toBe("");
    const n = structuredClone(e);
    n.document.bars.forEach((b) =>
      b.parts.forEach((p) =>
        v.slots.forEach(
          (s) => (p.labels[s] = v.label("x".repeat(80), "hidden")),
        ),
      ),
    );
    expect(() => v.validate(n)).toThrow(/32 KiB/);
  });
  it("keeps bare, empty and named legacy creation exact", () => {
    for (const request of [{}, { spec: {} }, { spec: { example: "BM01" } }])
      expect(c.canonical(i.create(request))).toBe(
        old.canonical(oi.create(request)),
      );
    expect(
      i.create({ spec: { schemaVersion: 2, starter: "part-whole" } })
        .schemaVersion,
    ).toBe(2);
    expect(() =>
      i.create({ spec: { schemaVersion: 2, example: "BM01" } }),
    ).toThrow();
    expect(() => i.create({ spec: {}, envelope: old.fresh() })).toThrow();
  });
  it("dispatches every frozen legacy example without layout/source changes", async () => {
    for (const name of old.exampleNames) {
      for (const worked of [false, true]) {
        const e = old.example(name, worked);
        expect(c.canonical(e)).toBe(old.canonical(e));
        expect(c.renderSvg(e)).toBe(old.renderSvg(e));
        expect(await c.hash(e)).toBe(await old.hash(e));
        expect(
          c.canonical(
            await i.revise({
              envelope: e,
              baseHash: await old.hash(e),
              operations: [],
            }),
          ),
        ).toBe(old.canonical(e));
      }
    }
  });
  it("upgrades only explicitly, retains fixed endpoints and atomically rejects a later error", async () => {
    const e = old.fresh(),
      before = old.canonical(e);
    expect(() =>
      i.apply(e, [{ op: "set_title", label: old.label("x") }]),
    ).toThrow(/upgrade/);
    expect(() =>
      i.apply(e, [
        { op: "upgrade_document" },
        { op: "remove_bar", barId: "missing" },
      ]),
    ).toThrow();
    expect(old.canonical(e)).toBe(before);
    const n = i.apply(e, [{ op: "upgrade_document" }]);
    expect(n.schemaVersion).toBe(2);
    if (n.schemaVersion !== 2) throw Error();
    expect(n.document.annotations.every((a) => a.scope.kind === "range")).toBe(
      true,
    );
    expect(() =>
      i.apply(e, [
        { op: "set_label", target: { barId: "b1" }, label: old.label() },
        { op: "upgrade_document" },
      ]),
    ).toThrow(/first/);
    expect(() => i.apply(n, [{ op: "upgrade_document" }])).toThrow();
    await expect(
      i.revise({
        envelope: e,
        baseHash: "0".repeat(64),
        operations: [{ op: "upgrade_document" }],
      }),
    ).rejects.toThrow(/stale_hash/);
  });
  it("keeps independent slots and requires explicit overwrite of retained answers", () => {
    const e = v.fresh(),
      b = e.document.bars[0],
      p = b.parts[0];
    p.labels.inside = v.label("9");
    p.labels.above = v.label("secret", "hidden");
    expect(() =>
      i.apply(e, [
        {
          op: "move_or_copy_label",
          from: { barId: b.id, partId: p.id, slot: "inside" },
          to: { barId: b.id, partId: p.id, slot: "above" },
          mode: "move",
        },
      ]),
    ).toThrow(/retained/);
    const n = i.apply(e, [
      {
        op: "move_or_copy_label",
        from: { barId: b.id, partId: p.id, slot: "inside" },
        to: { barId: b.id, partId: p.id, slot: "above" },
        mode: "copy",
        overwrite: true,
      },
    ]);
    if (n.schemaVersion !== 2) throw Error();
    expect(n.document.bars[0].parts[0].labels.inside.text).toBe("9");
    expect(n.document.bars[0].parts[0].labels.above?.text).toBe("9");
    expect(p.labels.above.text).toBe("secret");
  });
  it("preserves exact total and whole anchors but never reuses replaced IDs", () => {
    const e = v.fresh();
    e.document.bars[0].parts.forEach((p) => (p.weight = "3/2"));
    const ids = e.document.bars[0].parts.map((p) => p.id);
    const n = i.apply(e, [{ op: "equal_sections", barId: "b1", count: 3 }]);
    if (n.schemaVersion !== 2) throw Error();
    expect(n.document.bars[0].parts.map((p) => p.weight)).toEqual([
      "1",
      "1",
      "1",
    ]);
    expect(n.document.bars[0].parts.every((p) => !ids.includes(p.id))).toBe(
      true,
    );
    expect(n.document.annotations[0].scope.kind).toBe("whole");
    expect(v.endpoints(n, n.document.annotations[0]).to.partId).toBe(
      n.document.bars[0].parts.at(-1)?.id,
    );
  });
  it("requires structural discard, retains same-count labels and rejects subminimum exact sections", () => {
    const e = v.fresh();
    e.document.bars[0].parts[0].labels.inside = v.label("18", "hidden");
    expect(() =>
      i.apply(e, [{ op: "equal_sections", barId: "b1", count: 3 }]),
    ).toThrow(/discard/);
    const n = i.apply(e, [{ op: "equal_sections", barId: "b1", count: 2 }]);
    expect(c.canonical(n)).toBe(c.canonical(e));
    expect(() =>
      i.apply(e, [
        { op: "equal_sections", barId: "b1", count: 24, discardContent: true },
      ]),
    ).toThrow(/4 mm/);
  });
  it("has no hidden text length geometry leak across slots, names, captions and annotations", () => {
    const e = v.fresh();
    e.document.bars[0].name = v.label("short", "hidden");
    e.document.captions = [
      { id: "caption", label: v.label("short", "blank"), alignment: "centre" },
    ];
    const n = structuredClone(e);
    n.document.bars[0].name.text = "hidden long answer".repeat(4);
    n.document.captions[0].label.text = "saved".repeat(15);
    expect(v.renderSvg(e)).toBe(v.renderSvg(n));
    expect(v.warnings(e)).toHaveLength(1);
  });
  it("rejects inside totals that mask a divider and revalidates between adjacency", () => {
    const e = v.fresh();
    e.document.annotations[0].placement = "inside";
    e.document.annotations[0].decoration = "none";
    e.document.annotations[0].label = v.label("99");
    expect(v.exportIssue(e)).toMatch(/divider/);
    const r = lessonExample("R2-P", true);
    r.document.bars.splice(1, 0, {
      id: "middle",
      name: v.label(),
      offset: "0",
      parts: [
        { id: "mp", weight: "1", labels: { inside: v.label() }, fill: "none" },
      ],
    });
    expect(() => v.validate(r)).toThrow(/adjacent/);
  });
  it("packs touching groups together, separates overlaps and accounts for long labels", () => {
    const e = lessonExample("R5", true),
      g = v.layout(e);
    const get = (id: string) =>
      g.annotations.find((a) => a.annotation.id === id)!;
    expect(get("eve").lane).toBe(get("fred").lane);
    expect(get("share1").lane).toBe(get("share2").lane);
    expect(get("difference").lane).not.toBe(get("share2").lane);
    e.document.annotations.find((a) => a.id === "eve")!.label = v.label(
      "Long group label that crosses the shared boundary",
    );
    e.document.annotations.find((a) => a.id === "fred")!.label = v.label(
      "Another long group label crossing the shared boundary",
    );
    const h = v.layout(e);
    expect(h.annotations.find((a) => a.annotation.id === "eve")!.lane).not.toBe(
      h.annotations.find((a) => a.annotation.id === "fred")!.lane,
    );
  });
  it("renders every authored reference, pupil variant and exact caption within target bounds", () => {
    for (const name of lessonExampleNames) {
      for (const worked of [false, true]) {
        const e = lessonExample(name, worked),
          g = v.layout(e);
        expect(g.issues, `${name} ${worked}`).toEqual([]);
        expect(g.height, `${name} ${worked}`).toBeLessThanOrEqual(
          name === "R1" ? 50 : name === "R2-C" ? 55 : 65,
        );
        expect(v.renderSvg(e)).not.toContain("undefined");
        expect(
          c.canonical(i.parseLink(i.editorLink(e, "https://mathsdock.co.uk/"))),
        ).toBe(c.canonical(e));
      }
    }
  });
});
