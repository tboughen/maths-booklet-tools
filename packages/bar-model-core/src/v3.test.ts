import { it, expect } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { createHash } from "node:crypto";
import * as v from "./v3";
import * as v2 from "./v2";
import * as old from "./index";
import * as c from "./versioned";
import * as api from "./versioned-interchange";
import { mathematicalLine, parseMath, WRITING } from "./math-text";
import { lessonExample, lessonExampleNames } from "./lesson-examples-v3";
import { lessonExample as frozenExample } from "./lesson-examples";
import v2Controls from "./fixtures/v2-controls.json";
import { denseFixture } from "./stress-fixture-v3";

it("preserves every frozen v2 example source, hash and raw artwork", async () => {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  for (const r of v2Controls) {
    const e = frozenExample(
      r.name as Parameters<typeof frozenExample>[0],
      r.worked,
    );
    e.document.presentation.output = r.output as "grey" | "colour";
    expect(sha(c.canonical(e))).toBe(r.sourceSha256);
    expect(sha(c.renderSvg(e))).toBe(r.rawSvgSha256);
    expect(await c.hash(e)).toBe(r.sourceSha256);
  }
});
it.each([
  "4/5 × 45 = 36",
  "n/5 of 45 = 36",
  "-3/8 × 48 = -18",
  "1/2 + 3/4",
  "1/2+3/4-1/8",
  "(a+b)/c = 4/8",
  "2x/-y = 0",
])("typesets %s without evaluating or changing its source", (s) => {
  const e = v.fresh();
  e.document.captions = [
    {
      id: "calculation",
      label: v.label(s),
      alignment: "centre",
      format: "maths",
    },
  ];
  expect(v.exportIssue(e)).toBe("");
  expect(v.renderSvg(e)).toContain('data-fraction="horizontal"');
  expect(v.validate(e).document.captions[0].label.text).toBe(s);
  expect(
    mathematicalLine(s, 4).svg.match(/data-fraction="horizontal"/g)?.length,
  ).toBe(parseMath(s).filter((r) => r.kind === "fraction").length);
});
it.each(["9/10/2026", "(1/2)/3", "abc/def", "a/(b/(c))", "a/", "/b"])(
  "rejects ambiguous or nested Maths %s and accepts explicit literal text",
  (s) => {
    expect(() => parseMath(s)).toThrow(/fraction/i);
    const e = v.fresh();
    e.document.captions = [
      {
        id: "calculation",
        label: v.label(s),
        alignment: "centre",
        format: "maths",
      },
    ];
    expect(v.exportIssue(e)).toMatch(/fraction/i);
    expect(e.document.captions[0].format).toBe("maths");
    e.document.captions[0].format = "plain";
    expect(v.exportIssue(e)).toBe("");
    expect(v.renderSvg(e)).toContain(s.replaceAll("&", "&amp;"));
  },
);
it("gives every explicit line 12mm above its top stroke and 3mm below its bottom stroke", () => {
  for (const fontPt of [10, 12, 14]) {
    const e = v.fresh("comparison");
    e.document.presentation.fontPt = fontPt;
    e.document.bars[0].parts[0].labels = {
      inside: v.label("1/2", "line"),
      above: v.label("9", "line"),
      below: v.label("3", "line"),
    };
    e.document.bars[0].name = v.label("a long saved answer", "line");
    e.document.annotations[0].label = v.label("2", "line");
    e.document.title = v.label("saved", "line");
    e.document.captions = [
      {
        id: "working",
        label: v.label("4/5", "line"),
        alignment: "centre",
        format: "maths",
      },
    ];
    const g = v.layout(e);
    expect(g.issues).toEqual([]);
    expect(g.writingBoxes).toHaveLength(7);
    for (const b of g.writingBoxes) {
      expect(b.baseline - 0.125 - b.y).toBeCloseTo(12, 10);
      expect(b.y + b.height - b.baseline - 0.125).toBeCloseTo(3, 10);
      expect(b.width).toBe(8);
    }
    expect(g.barHeightMm).toBe(20);
    expect(g.rows.every((r) => r.height >= 20)).toBe(true);
    expect(v.printFacts(e).referenceFeatures.tableRowHeightsMm).toEqual([20]);
    expect(e.document.presentation.barHeightMm).toBe(12);
    expect(WRITING).toMatchObject({ aboveMm: 12, belowMm: 3, heightMm: 15.25 });
    expect(v.renderSvg(e)).not.toContain("saved");
  }
});
it("keeps the reserved handwriting areas clear of actual rendered glyphs and strokes", () => {
  const e = v.fresh("comparison");
  e.document.bars[0].parts[1].labels = {
    inside: v.label("1/2", "line"),
    above: v.label("above", "line"),
    below: v.label("below", "line"),
  };
  e.document.annotations[0].label = v.label("difference", "line");
  e.document.title = v.label("title", "line");
  e.document.captions = [
    {
      id: "c",
      label: v.label("answer", "line"),
      alignment: "right",
      format: "maths",
    },
  ];
  const g = v.layout(e);
  const svg = v
    .renderSvg(e)
    .replace(/<path data-answer-line="true"[^>]*\/>/g, "")
    .replace(/fill="(#[a-fA-F0-9]{3,6})"/g, (match, colour) =>
      colour === "#000" || colour === "#000000" ? match : 'fill="none"',
    );
  for (const b of g.writingBoxes) {
    const crop = svg
      .replace(
        /viewBox="[^"]+"/,
        `viewBox="${b.x} ${b.y} ${b.width} ${b.height}"`,
      )
      .replace(/width="[^"]+"/, 'width="64px"')
      .replace(/height="[^"]+"/, 'height="122px"');
    const pixels = new Resvg(crop, {
      font: {
        loadSystemFonts: false,
        fontFiles: [
          "assets/graph-fonts/STIXTwoText-Regular.otf",
          "assets/graph-fonts/STIXTwoMath-Regular.otf",
        ],
      },
    }).render().pixels;
    expect(
      Array.from(pixels)
        .filter((_, i) => i % 4 === 3)
        .some((a) => a > 0),
      b.id,
    ).toBe(false);
  }
});
it("reserves an inside whole line without crossing a divider and preserves horizontal geometry", () => {
  const e = v.fresh("equal-sections", 1),
    before = structuredClone(e.document.bars);
  e.document.annotations[0].placement = "inside";
  e.document.annotations[0].decoration = "none";
  e.document.annotations[0].label.state = "line";
  const g = v.layout(e);
  expect(g.issues).toEqual([]);
  expect(g.barHeightMm).toBe(20);
  expect(e.document.bars).toEqual(before);
  e.document.presentation.barHeightMm = 24;
  expect(v.layout(e).barHeightMm).toBe(24);
  e.document.bars[0].parts[0].weight = "1/2";
  expect(v.exportIssue(e)).toMatch(/Inside whole/);
});
it("includes complete fraction ink and negative bearings for every caption alignment and font size", () => {
  for (const fontPt of [10, 12, 14])
    for (const alignment of ["left", "centre", "right"] as const) {
      const e = v.fresh();
      e.document.presentation.fontPt = fontPt;
      e.document.captions = [
        {
          id: "one",
          label: v.label("j + (a+b)/c = -3/8"),
          alignment,
          format: "maths",
        },
        { id: "two", label: v.label("1/2 + 3/4"), alignment, format: "maths" },
      ];
      const g = v.layout(e);
      expect(g.issues).toEqual([]);
      const svg = v
        .renderSvg(e)
        .replace(/<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/, "")
        .replace(/width="[^"]+"/, `width="${g.width}px"`)
        .replace(/height="[^"]+"/, `height="${g.height}px"`);
      const ink = new Resvg(svg, {
        font: {
          loadSystemFonts: false,
          fontFiles: [
            "assets/graph-fonts/STIXTwoText-Regular.otf",
            "assets/graph-fonts/STIXTwoMath-Regular.otf",
          ],
        },
      }).getBBox()!;
      expect(ink.x).toBeGreaterThanOrEqual(3.99);
      expect(ink.x + ink.width).toBeLessThanOrEqual(g.width - 3.99);
      expect(ink.y + ink.height).toBeLessThanOrEqual(g.height - 3.99);
      expect(g.captionRows[1].y - g.captionRows[1].height / 2).toBeGreaterThan(
        g.captionRows[0].y + g.captionRows[0].height / 2,
      );
    }
});
it("keeps disjoint line labels aligned but packs overlapping writing rectangles into separate lanes", () => {
  const e = lessonExample("R5");
  const g = v.layout(e),
    shares = g.annotations.filter((a) => a.annotation.label.state === "line");
  expect(g.issues).toEqual([]);
  expect(shares.length).toBeGreaterThan(1);
  expect(shares[0].lane).toBe(shares[1].lane);
  expect(shares[0].textY).toBe(shares[1].textY);
  e.document.annotations.push({
    ...e.document.annotations[0],
    id: "overlap",
    label: v.label("hidden answer", "line"),
  });
  const p = v.layout(e).annotations;
  expect(p[0].lane).not.toBe(p.at(-1)!.lane);
});
it("leaves question, blank, hidden and zero distinct and independent of saved hidden text length", () => {
  const e = v.fresh();
  e.document.bars[0].parts[0].labels.inside = v.label("0");
  e.document.bars[0].parts[1].labels.inside = v.label("1/2", "hidden");
  const first = v.renderSvg(e);
  expect(first).toContain(">0</text>");
  e.document.bars[0].parts[1].labels.inside.text = "9/10/2026".repeat(8);
  expect(v.renderSvg(e)).toBe(first);
  e.document.bars[0].parts[1].labels.inside.state = "question";
  expect(v.renderSvg(e)).toContain(">?</text>");
  expect(v.layout(e).writingBoxes).toHaveLength(0);
});
it("preserves defaults, explicit versions, original hashes and atomic upgrade rollback", async () => {
  expect(api.create({}).schemaVersion).toBe(1);
  expect(api.create({ spec: { schemaVersion: 2 } }).schemaVersion).toBe(2);
  expect(api.create({ spec: { schemaVersion: 3 } }).schemaVersion).toBe(3);
  for (const source of [old.fresh(), frozenExample("R4")]) {
    const before = c.canonical(source),
      hash = await c.hash(source);
    const n = await api.revise({
      envelope: source,
      baseHash: hash,
      operations: [{ op: "upgrade_document", targetSchemaVersion: 3 }],
    });
    expect(n.schemaVersion).toBe(3);
    expect(c.canonical(source)).toBe(before);
    if (source.schemaVersion === 2 && n.schemaVersion === 3) {
      expect(n.document.bars).toEqual(source.document.bars);
      expect(n.document.annotations).toEqual(source.document.annotations);
      expect(n.document.captions.map((c) => c.label)).toEqual(
        source.document.captions.map((c) => c.label),
      );
    }
    await expect(
      api.revise({
        envelope: source,
        baseHash: hash,
        operations: [
          { op: "upgrade_document", targetSchemaVersion: 3 },
          {
            op: "set_relative_length",
            barId: "missing",
            partId: "p",
            weight: "2",
          },
        ],
      }),
    ).rejects.toThrow();
    await expect(
      api.revise({
        envelope: source,
        baseHash: "0".repeat(64),
        operations: [{ op: "upgrade_document", targetSchemaVersion: 3 }],
      }),
    ).rejects.toThrow(/stale_hash/);
    expect(c.canonical(source)).toBe(before);
  }
  const v1 = old.fresh();
  expect(api.apply(v1, [{ op: "upgrade_document" }]).schemaVersion).toBe(2);
  const fixed = v3Fixed(v1);
  expect(
    fixed.document.annotations.every((a) => a.scope.kind === "range"),
  ).toBe(true);
  expect(() => api.apply(v2.fresh(), [{ op: "upgrade_document" }])).toThrow();
});
function v3Fixed(e: old.Envelope) {
  return v.upgrade(e);
}
it("retains maximum structure within unchanged resource bounds and rejects excess rather than shrinking handwriting", () => {
  const e = denseFixture(),
    g = v.layout(e);
  expect(e.document.bars.flatMap((b) => b.parts)).toHaveLength(96);
  expect(e.document.annotations).toHaveLength(18);
  expect(e.document.captions).toHaveLength(3);
  expect(g.issues).toEqual([]);
  expect(g.writingBoxes).toHaveLength(96);
  expect(g.barHeightMm).toBe(20);
  expect(new TextEncoder().encode(v.canonical(e)).length).toBeLessThan(32768);
  for (const p of e.document.bars.at(-1)!.parts) p.labels.above!.state = "line";
  expect(v.exportIssue(e)).toMatch(/260|32 million/);
  expect(v.layout(e).writingBoxes.every((b) => b.height === 15.25)).toBe(true);
});
it("roundtrips all caption formats, alignments and pupil states through files, links and revisions", async () => {
  for (const state of ["value", "blank", "question", "line", "hidden"] as const)
    for (const alignment of ["left", "centre", "right"] as const)
      for (const format of ["maths", "plain"] as const) {
        const e = v.fresh();
        e.document.captions = [
          {
            id: "c",
            label: v.label("n/5 of 45 = 36", state),
            alignment,
            format,
          },
        ];
        expect(c.parseFile(c.canonical(e))).toEqual(e);
        expect(
          api.parseLink(api.editorLink(e, "https://mathsdock.co.uk/")),
        ).toEqual(e);
        expect(
          await api.revise({
            envelope: e,
            baseHash: await c.hash(e),
            operations: [],
          }),
        ).toEqual(e);
      }
});
it("fits all reference pupil/worked examples at 10/12/14pt in colour and grey with safe ink margins", () => {
  for (const name of lessonExampleNames)
    for (const worked of [false, true])
      for (const fontPt of [10, 12, 14])
        for (const output of ["grey", "colour"] as const) {
          const e = lessonExample(name, worked);
          e.document.presentation.fontPt = fontPt;
          e.document.presentation.output = output;
          const g = v.layout(e);
          expect(g.issues, `${name}/${worked}/${fontPt}/${output}`).toEqual([]);
          expect(g.width).toBeLessThanOrEqual(280);
          expect(g.height).toBeLessThanOrEqual(260);
          const svg = v
            .renderSvg(e)
            .replace(/<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/, "")
            .replace(/width="[^"]+"/, `width="${g.width}px"`)
            .replace(/height="[^"]+"/, `height="${g.height}px"`);
          const ink = new Resvg(svg, {
            font: {
              loadSystemFonts: false,
              fontFiles: [
                "assets/graph-fonts/STIXTwoText-Regular.otf",
                "assets/graph-fonts/STIXTwoMath-Regular.otf",
              ],
            },
          }).getBBox()!;
          expect(ink.x).toBeGreaterThanOrEqual(3.99);
          expect(ink.y).toBeGreaterThanOrEqual(3.99);
          expect(ink.x + ink.width).toBeLessThanOrEqual(g.width - 3.99);
          expect(ink.y + ink.height).toBeLessThanOrEqual(g.height - 3.99);
        }
});
