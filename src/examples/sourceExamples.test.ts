import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  graphExamples,
  ratioExamples,
  sourceQuestionHref,
} from "./sourceExamples";
import { renderDiagramSvg } from "../export/svg";
import {
  renderRatioSvg,
  ratioWarnings,
} from "../../packages/ratio-table-core/src/interchange";

describe("verified past-paper teaching examples", () => {
  it("links only to reviewed, published source questions", () => {
    const catalogue = JSON.parse(
      readFileSync("public/bank/catalogue.json", "utf8"),
    );
    for (const example of [...graphExamples, ...ratioExamples]) {
      const source = catalogue.questions.find(
        (q: { id: string }) => q.id === example.id,
      );
      expect(source).toBeDefined();
      expect(source.review).toBe("reviewed");
      expect(["past", "Past papers"]).toContain(source.collection);
      expect(source.questionViews.length).toBeGreaterThan(0);
      expect(
        new URL(
          sourceQuestionHref(example.id),
          "https://mathsdock.co.uk/",
        ).searchParams.get("question"),
      ).toBe(source.id);
    }
  });
  it("keeps graph scaffolds blank and worked segments within the requested source domains", () => {
    const expected = [
      { start: { x: -2, y: -7 }, end: { x: 4, y: 5 } },
      { start: { x: -2, y: -2 }, end: { x: 3, y: 0.5 } },
      { start: { x: -2, y: -6 }, end: { x: 3, y: 4 } },
    ];
    graphExamples.forEach((example, i) => {
      const scaffold = example.create(false),
        worked = example.create(true);
      expect(scaffold.objects).toEqual([]);
      expect(worked.objects[0]).toMatchObject({
        ...expected[i],
        kind: "straight",
        display: "segment",
      });
      expect(renderDiagramSvg(scaffold)).toContain("<svg");
      expect(renderDiagramSvg(worked)).toContain("<svg");
      scaffold.axes.x.positiveSquares = 1;
      expect(example.create(false).axes.x.positiveSquares).not.toBe(1);
    });
  });
  it("preserves apple-price answer lines and gives the checked £5.04 only in worked output", () => {
    const scaffold = ratioExamples[0].create(false),
      worked = ratioExamples[0].create(true);
    expect(scaffold.document.rows.map((r) => r.cells[1])).toEqual([
      { kind: "number", value: "3.6" },
      { kind: "answer-line" },
      { kind: "answer-line" },
    ]);
    expect(worked.document.rows.map((r) => r.cells[1])).toEqual([
      { kind: "number", value: "3.6" },
      { kind: "number", value: "1.44" },
      { kind: "number", value: "5.04" },
    ]);
    expect(ratioWarnings(worked)).toEqual([]);
    expect(renderRatioSvg(worked.document)).toContain("5.04");
  });
  it("uses one proportional recipe step across three ingredients without mixing available stock into a ratio", () => {
    const scaffold = ratioExamples[1].create(false),
      worked = ratioExamples[1].create(true);
    expect(scaffold.document.rows[0].cells).toEqual(
      [125, 200, 50].map((value) => ({ kind: "number", value: String(value) })),
    );
    expect(
      scaffold.document.rows[1].cells.every((c) => c.kind === "answer-line"),
    ).toBe(true);
    expect(worked.document.rows[1].cells).toEqual(
      ["125/12", "50/3", "25/6"].map((value) => ({ kind: "number", value })),
    );
    expect(ratioWarnings(worked)).toEqual([]);
    expect(renderRatioSvg(worked.document)).toContain("<svg");
  });
});
