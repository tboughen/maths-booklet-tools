// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES, drawDiagram, svgSizeMm } from "./registry";
import { WORKED_MARGIN_MM, WORKED_TEXT_MAX } from "../../envelope-core/src/worked";
import { ANSWER_COLOUR } from "../../envelope-core/src/answer-state";

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
const saved = (kind: string) =>
  readdirSync(join(corpus, kind))
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(corpus, kind, n), "utf8")) as Record<string, unknown>)
    .reduce((best, e) => (Number(e.schemaVersion) > Number(best.schemaVersion) ? e : best));
const worked = [{ text: "Multiply both by 3", x: 1, y: 1, widthMm: 40 }];

describe("worked-solution notes on every answers copy (U116)", () => {
  for (const kind of DIAGRAM_KINDS) {
    const f = FAMILIES[kind];
    if (!f.answerView) {
      it(`${kind}: has no answers copy, so a worked list is refused with a reason`, () => {
        expect(() => f.validate({ ...saved(kind), worked }, "pupil")).toThrow(/no answers copy/);
      });
      continue;
    }
    it(`${kind}: prints notes in dark pink on the answers copy only, at the same size, and keeps them through revise`, async () => {
      const plain = f.validate(saved(kind), "pupil") as Record<string, unknown>;
      const noted = f.validate({ ...plain, worked }, "pupil");
      expect(noted).toMatchObject({ worked });
      expect(f.svg(noted, "pupil")).toBe(f.svg(plain, "pupil"));
      const answer = f.svg(noted, "answer");
      expect(answer).toContain(`<g data-layer="worked"`);
      expect(answer).toContain(`fill="${ANSWER_COLOUR}"`);
      expect(answer).toContain(">Multiply both by 3</text>");
      expect(svgSizeMm(answer)).toEqual(svgSizeMm(f.svg(plain, "answer")));
      expect(drawDiagram(kind, noted, "pupil").svg).not.toContain("data-layer=\"worked\"");
      const revised = await f.revise({ envelope: noted, baseHash: await f.hash(noted), operations: [] });
      expect(revised).toMatchObject({ worked });
      expect(await f.hash(noted)).not.toBe(await f.hash(plain));
    });
    it(`${kind}: a note in the margin grows only the answers copy's page; past the margin it is named`, () => {
      const plain = f.validate(saved(kind), "pupil") as Record<string, unknown>;
      const size = svgSizeMm(f.svg(plain, "answer"));
      const beside = f.validate({ ...plain, worked: [{ text: "Add 3", x: size.width + 2, y: 1, widthMm: 20 }] }, "pupil");
      const grown = svgSizeMm(f.svg(beside, "answer"));
      expect(grown.width).toBeGreaterThan(size.width + 2);
      expect(grown.height).toBeCloseTo(size.height, 1);
      expect(f.svg(beside, "pupil")).toBe(f.svg(plain, "pupil"));
      const far = [{ text: "Too far", x: size.width + WORKED_MARGIN_MM, y: 1 }];
      expect(() => f.validate({ ...plain, worked: far }, "pupil")).toThrow(/Worked note 1 runs .* past the 70 mm margin right of the diagram/);
    });
    it(`${kind}: in a worksheet both copies take the margin's space, with their artwork lined up`, () => {
      const plain = f.validate(saved(kind), "pupil") as Record<string, unknown>;
      const size = svgSizeMm(f.svg(plain, "answer"));
      const beside = f.validate({ ...plain, worked: [{ text: "Add 3", x: -25, y: 1, widthMm: 20 }] }, "pupil");
      const pupil = drawDiagram(kind, beside, "pupil"),
        answer = drawDiagram(kind, beside, "answer");
      const box = (svg: string) => svg.match(/<svg\b[^>]*\sviewBox="([^"]+)"/)![1];
      expect(box(pupil.svg)).toBe(box(answer.svg));
      expect(svgSizeMm(pupil.svg)).toEqual(svgSizeMm(answer.svg));
      expect(pupil.widthMm).toBeGreaterThan(size.width + 25);
      expect(pupil.artworkWidthMm).toBeCloseTo(size.width, 1);
      expect(pupil.svg).not.toContain('data-layer="worked"');
      // A note inside the answers artwork never changes the pupil copy, even where the pupil artwork is smaller.
      const inside = f.validate({ ...plain, worked: [{ text: "Add", x: 1, y: Math.max(0, size.height - 6), widthMm: 10 }] }, "pupil");
      expect(drawDiagram(kind, inside, "pupil").svg).toBe(drawDiagram(kind, plain, "pupil").svg);
    });
  }

  it("a Venn diagram keeps its notes, title and note when a revision changes the number of sets", async () => {
    const f = FAMILIES.venn;
    for (const name of readdirSync(join(corpus, "venn")).filter((n) => n.endsWith(".json"))) {
      const raw = JSON.parse(readFileSync(join(corpus, "venn", name), "utf8")) as { schemaVersion: number; document: { sets: number } };
      if (raw.document.sets === 1) continue;
      const noted = f.validate({ ...raw, worked, title: "Sets" }, "pupil");
      const sets = raw.document.sets === 3 ? 2 : 3;
      const revised = await f.revise({ envelope: noted, baseHash: await f.hash(noted), operations: [{ op: "set_layout", sets }] });
      expect(revised, name).toMatchObject({ worked, title: "Sets" });
      return;
    }
    throw Error("No two- or three-set Venn fixture.");
  });

  it("rejects text that is too long, padded or multi-line", () => {
    const f = FAMILIES.venn, plain = f.validate(saved("venn"), "pupil") as Record<string, unknown>;
    for (const text of ["x".repeat(WORKED_TEXT_MAX + 1), " padded", "two\nlines", ""])
      expect(() => f.validate({ ...plain, worked: [{ text, x: 1, y: 1 }] }, "pupil"), JSON.stringify(text)).toThrow();
  });
});
