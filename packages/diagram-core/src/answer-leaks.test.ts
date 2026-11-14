// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { answerLeaks } from "./answer-leaks";
import { answerSlots } from "./answer-slots";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import { holdsAnswer } from "../../envelope-core/src/answer-state";

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const load = (kind: DiagramKind, name: string): Any => JSON.parse(readFileSync(join(corpus, kind, `${name}.json`), "utf8"));

/** Saved files with hidden answers in every family that stores them. */
function withAnswers(): [DiagramKind, Any][] {
  const ratio = load("ratio-table", "default");
  ratio.document.rows[0].cells[1] = { kind: "hidden", value: "12" };
  const ftree = load("frequency-tree", "default");
  ftree.document.nodes[1].count = { text: "14", show: "hidden" };
  const ptree = load("probability-tree", "default");
  ptree.document.branches[0].probability = { text: "0.3", show: "hidden" };
  const chart = load("charts", "default");
  chart.document.series[0].values[0] = { value: "7", show: "hidden" };
  const venn = load("venn", "default");
  venn.document.regions[0] = { ...venn.document.regions[0], kind: "number", text: "5", visibility: "line" };
  venn.document.regions[2] = { ...venn.document.regions[2], kind: "number", text: "8", visibility: "hidden" };
  const line = load("number-line", "example-15-c-1ma1-mock-set-05-3f-q15-worked");
  line.document.teaching.answerVisible = false;
  const grid = load("algebra-grid", "file-algebra-grid-examples-common-worked");
  grid.document.rows[1].cells[1].hidden = true;
  const graph = load("graph", "file-tool-card-preview-examples-graph-tool");
  graph.document.objects[0].answerOnly = true;
  return [
    ["ratio-table", ratio], ["frequency-tree", ftree], ["probability-tree", ptree], ["charts", chart], ["venn", venn],
    ["number-line", line], ["algebra-grid", grid], ["graph", graph],
    ["triangle", load("triangle", "file-fixtures-triangle-area-v2")], ["bar-model", load("bar-model", "default")],
  ];
}

describe("answer-leak check (W90)", () => {
  it("finds no leak in any saved file of the corpus", () => {
    for (const kind of DIAGRAM_KINDS)
      for (const file of readdirSync(join(corpus, kind)))
        expect(answerLeaks(kind, JSON.parse(readFileSync(join(corpus, kind, file), "utf8"))), `${kind}/${file}`).toEqual([]);
  });

  it("finds no leak in pupil copies of files that hold hidden answers", () => {
    for (const [kind, e] of withAnswers()) {
      FAMILIES[kind].validate(e, "pupil");
      expect(answerSlots(kind, e).some(holdsAnswer), kind).toBe(true);
      expect(answerLeaks(kind, e), kind).toEqual([]);
    }
  });

  it("reports an answers copy passed off as a pupil copy", () => {
    for (const [kind, e] of withAnswers()) {
      if (!FAMILIES[kind].answerView) continue;
      const leaks = answerLeaks(kind, e, FAMILIES[kind].svg(e, "answer"));
      expect(leaks.length, kind).toBeGreaterThan(0);
    }
  });

  it("names the slot whose saved answer prints", () => {
    const [, e] = withAnswers().find(([k]) => k === "frequency-tree")!;
    const leaks = answerLeaks("frequency-tree", e, FAMILIES["frequency-tree"].svg(e, "answer"));
    expect(leaks.map((l) => l.path)).toContain("document.nodes.1.count");
  });
});
