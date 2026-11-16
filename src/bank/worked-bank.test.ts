// @vitest-environment node
// The full checks for every worked solution in the bank: schema, marks that add up to each part,
// every answer line filled, house rules and a layout with nothing overlapping or off the cut.
// Registration (scripts/bank/register-worked-solutions.ts) checks only the file's bytes and owner.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { checkWorked, parseWorked } from "../../packages/worked-core/src/index";
import type { BankCatalogue, BankQuestion } from "./model";

const catalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")) as BankCatalogue;
const attached = catalogue.questions.filter(q => q.workedSolution);

/** Every surface a question's working may be drawn on: its cuts' views and its own views. */
const surfacesOf = (q: BankQuestion) => [...(q.cuts ?? []).flatMap(c => c.views), ...q.questionViews].map(v => ({ id: v.id, width: v.width, height: v.height }));

describe("worked solutions in the bank", () => {
  it("has unique surface names in every question", () => {
    for (const q of catalogue.questions) {
      const ids = surfacesOf(q).map(s => s.id);
      expect(new Set(ids).size, q.id).toBe(ids.length);
    }
  });
  it.skipIf(!attached.length)("passes every check", () => {
    const problems: string[] = [];
    for (const q of attached) {
      const path = `public/${q.workedSolution!.data}`;
      if (!existsSync(path)) { problems.push(`${q.id}: ${path} is missing (fetch the bank submodule).`); continue; }
      try {
        const data = parseWorked(JSON.parse(readFileSync(path, "utf8")));
        for (const p of checkWorked(data, { id: q.id, revision: q.revision, parts: q.parts }, surfacesOf(q))) problems.push(`${q.id}: ${p}`);
      } catch (error) { problems.push(`${q.id}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    expect(problems).toEqual([]);
  });
});
