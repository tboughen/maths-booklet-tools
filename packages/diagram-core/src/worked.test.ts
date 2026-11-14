// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES, drawDiagram, svgSizeMm } from "./registry";
import { WORKED_TEXT_MAX } from "../../envelope-core/src/worked";
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
    it(`${kind}: names a note that runs off the artwork`, () => {
      const plain = f.validate(saved(kind), "pupil") as Record<string, unknown>;
      const { width } = svgSizeMm(f.svg(plain, "answer"));
      expect(() => f.validate({ ...plain, worked: [{ text: "Too far", x: width, y: 1 }] }, "pupil")).toThrow(/Worked note 1 runs .* past the right edge/);
    });
  }

  it("a Venn diagram keeps its notes, title and note when a revision changes the number of sets", async () => {
    const f = FAMILIES.venn;
    for (const name of readdirSync(join(corpus, "venn")).filter((n) => n.endsWith(".json"))) {
      const raw = JSON.parse(readFileSync(join(corpus, "venn", name), "utf8")) as { schemaVersion: number; document: { sets: number } };
      if (raw.schemaVersion !== 1) continue;
      const noted = f.validate({ ...raw, worked, title: "Sets" }, "pupil");
      const sets = raw.document.sets === 3 ? 2 : 3;
      const revised = await f.revise({ envelope: noted, baseHash: await f.hash(noted), operations: [{ op: "set_layout", sets }] });
      expect(revised, name).toMatchObject({ worked, title: "Sets" });
      return;
    }
    throw Error("No schema version 1 Venn fixture.");
  });

  it("rejects text that is too long, padded or multi-line", () => {
    const f = FAMILIES.venn, plain = f.validate(saved("venn"), "pupil") as Record<string, unknown>;
    for (const text of ["x".repeat(WORKED_TEXT_MAX + 1), " padded", "two\nlines", ""])
      expect(() => f.validate({ ...plain, worked: [{ text, x: 1, y: 1 }] }, "pupil"), JSON.stringify(text)).toThrow();
  });
});
