import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonical,
  preset,
} from "../../packages/value-graph-core/src/interchange";
import { quadraticSources, workedQuadraticExample } from "./examples";

describe("verified quadratic examples", () => {
  it("points every dated example at an available reviewed question and scheme", () => {
    const catalogue = JSON.parse(
      readFileSync("public/bank/catalogue.json", "utf8"),
    );
    expect(quadraticSources).toHaveLength(5);
    for (const example of quadraticSources) {
      const question = catalogue.questions.find(
        (q: { id: string }) => q.id === example.id,
      );
      expect(question.review).toBe("reviewed");
      expect(existsSync("public/" + question.questionPdf)).toBe(true);
      expect(existsSync("public/" + question.schemePdf)).toBe(true);
    }
    expect(
      quadraticSources.some((e) => (e.name as string) === "Fractions"),
    ).toBe(false);
  });
  it("makes explicit correct worked copies without filling or replacing scaffolds", () => {
    const rows = [
      ["6", "0", "-4", "-6", "-6", "-4", "0"],
      ["2", "-2", "-4", "-4", "-2", "2", "8"],
      ["10", "5", "2", "1", "2", "5", "10"],
      ["10", "5", "2", "1", "2", "5", "10"],
      ["7", "1", "-1", "1", "7", "17"],
    ];
    quadraticSources.forEach((example, index) => {
      const scaffold = preset(example.name),
        before = canonical(scaffold),
        worked = workedQuadraticExample(example.name);
      expect(
        worked.document.columns.map((c) =>
          c.y.kind === "value" ? c.y.value : "",
        ),
      ).toEqual(rows[index]);
      expect(worked.document.graph.series[0].connection).toBe("none");
      expect(worked.document.graph.curves).toHaveLength(1);
      expect(canonical(scaffold)).toBe(before);
      if (example.name !== "November 2017 error")
        expect(
          scaffold.document.columns.some((c) => c.y.kind === "blank"),
        ).toBe(true);
    });
    expect(
      preset("November 2017 error").document.graph.series[0].connection,
    ).toBe("straight-joins");
  });
});
