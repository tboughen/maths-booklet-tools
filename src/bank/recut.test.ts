import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyCatalogue } from "./model";

// The November 2026 recut (bank folder cuts-2026-11): whole questions, parts and shared stems.
const bank = verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8")));
const file = (path: string) => `public/${path}`;

describe("recut question bank", () => {
  it("serves every question from the recut and keeps its print sizes with its pages", () => {
    for (const q of bank.questions) {
      expect(q.questionPdf, q.id).toMatch(/^bank\/assets\/cuts-2026-11\/[A-Za-z0-9_]+\/question\.pdf$/);
      expect(q.printPdf, q.id).toBe(q.questionPdf.replace(/question\.pdf$/, "print.pdf"));
      expect(q.schemePdf, q.id).toBe(q.questionPdf.replace(/question\.pdf$/, "scheme.pdf"));
      expect(q.printPages.length, q.id).toBe(q.questionViews.length);
      q.questionViews.forEach((view, i) => {
        expect(view.width, q.id).toBe(q.printPages[i].width);
        expect(view.height, q.id).toBe(q.printPages[i].height);
      });
    }
  });

  it("holds the agreed parts, stems and needs-answer links", () => {
    const cuts = bank.questions.flatMap(q => q.cuts ?? []);
    expect(cuts.filter(c => c.kind === "part")).toHaveLength(2782);
    expect(cuts.filter(c => c.kind === "stem")).toHaveLength(855);
    expect(cuts.filter(c => c.requiresAnswerTo.length)).toHaveLength(133);
    // A part that needs an earlier answer is the later part, never the first.
    for (const q of bank.questions) for (const cut of q.cuts ?? []) for (const id of cut.requiresAnswerTo) {
      const ids = (q.cuts ?? []).map(c => c.id);
      expect(ids.indexOf(id), `${q.id} ${cut.id}`).toBeLessThan(ids.indexOf(cut.id));
    }
  });

  it("has every file the catalogue names for each question folder present in this checkout", () => {
    let checked = 0;
    for (const q of bank.questions) {
      // CI's lite bank holds only a few folders; check every folder that is there.
      if (!existsSync(file(dirname(q.questionPdf)))) continue;
      const paths = [q.questionPdf, q.printPdf, q.schemePdf, ...q.questionViews.map(v => v.preview), ...q.schemeViews.map(v => v.preview),
        ...(q.cuts ?? []).flatMap(c => [c.pdf, ...c.views.map(v => v.preview)])];
      for (const path of paths) expect(existsSync(file(path)), path).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
