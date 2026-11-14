// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANSWER_STATES, holdsAnswer, pupilSees, suppliedState } from "../../envelope-core/src/answer-state";
import { answerSlots } from "./answer-slots";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import { resourceAnswerSlots } from "../../resource-core/src/answer-slots";
import { comparativeBarCharts, treeDiagrams } from "../../resource-core/src/fixtures";

const corpus = join(__dirname, "../../envelope-core/fixtures/corpus");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const load = (kind: DiagramKind, name: string): Any => JSON.parse(readFileSync(join(corpus, kind, `${name}.json`), "utf8"));
/** The slots of an edited envelope, after checking the edit is a valid saved file. */
const slotsOf = (kind: DiagramKind, e: unknown) => {
  FAMILIES[kind].validate(e, "pupil");
  return answerSlots(kind, e);
};
const at = (kind: DiagramKind, e: unknown, path: string) => slotsOf(kind, e).find((s) => s.path === path);

describe("shared answer states (W3)", () => {
  it("keeps zero distinct from blank", () => {
    for (const z of ["0", "0.0", "−0", " 0 ", "0,00"]) expect(suppliedState(z)).toBe("zero");
    for (const s of ["10", "0.5", "x", "1/2", "-3"]) expect(suppliedState(s)).toBe("supplied");
    expect(suppliedState("")).toBe("blank");
    expect(suppliedState("  ")).toBe("blank");
    expect(pupilSees("zero")).toBe(true);
    expect(pupilSees("blank")).toBe(false);
  });

  it("reads every saved file in the corpus with known states and real paths", () => {
    for (const kind of DIAGRAM_KINDS)
      for (const file of readdirSync(join(corpus, kind))) {
        const e = JSON.parse(readFileSync(join(corpus, kind, file), "utf8"));
        for (const s of answerSlots(kind, e)) {
          expect(ANSWER_STATES, `${kind}/${file} ${s.path}`).toContain(s.state);
          // Every path names a real place in the saved file.
          const v = s.path.split(".").reduce((n: Any, k) => (n == null ? n : n[k]), e);
          expect(v, `${kind}/${file} ${s.path}`).not.toBeUndefined();
        }
      }
  });

  it("ratio tables: number, zero, empty, answer line and hidden cells", () => {
    const e = load("ratio-table", "default");
    const cells = e.document.rows[0].cells;
    cells[0] = { kind: "number", value: "0" };
    cells[1] = { kind: "hidden", value: "12" };
    expect(at("ratio-table", e, "document.rows.0.cells.0")?.state).toBe("zero");
    expect(at("ratio-table", e, "document.rows.0.cells.1")).toMatchObject({ state: "hidden", text: "12" });
    cells[1] = { kind: "hidden", value: "12", line: true };
    expect(at("ratio-table", e, "document.rows.0.cells.1")).toMatchObject({ state: "answerLine", text: "12" });
    cells[1] = { kind: "empty" };
    expect(at("ratio-table", e, "document.rows.0.cells.1")?.state).toBe("blank");
  });

  it("trees and charts: show and hidden labels, empty shown labels are blank", () => {
    const f = load("frequency-tree", "default");
    f.document.nodes[0].count = { text: "0", show: "show" };
    f.document.nodes[1].count = { text: "14", show: "hidden" };
    f.document.nodes[1].category = { text: "", show: "show" };
    expect(at("frequency-tree", f, "document.nodes.0.count")?.state).toBe("zero");
    expect(at("frequency-tree", f, "document.nodes.1.count")).toMatchObject({ state: "hidden", text: "14" });
    expect(at("frequency-tree", f, "document.nodes.1.category")?.state).toBe("blank");
    const p = load("probability-tree", "default");
    p.document.branches[0].probability = { text: "0.3", show: "hidden" };
    expect(holdsAnswer(at("probability-tree", p, "document.branches.0.probability")!)).toBe(true);
    const c = load("charts", "default");
    c.document.series[0].values[0] = { value: "7", show: "hidden" };
    expect(at("charts", c, "document.series.0.values.0")).toMatchObject({ state: "hidden", text: "7" });
  });

  it("Venn: show, hidden and answer-line regions", () => {
    const v = load("venn", "default");
    v.document.regions[0] = { ...v.document.regions[0], kind: "number", text: "5", visibility: "line" };
    v.document.regions[1] = { ...v.document.regions[1], kind: "number", text: "0", visibility: "show" };
    v.document.regions[2] = { ...v.document.regions[2], kind: "number", text: "8", visibility: "hidden" };
    expect(at("venn", v, "document.regions.0")).toMatchObject({ state: "answerLine", text: "5" });
    expect(at("venn", v, "document.regions.1")?.state).toBe("zero");
    expect(at("venn", v, "document.regions.2")).toMatchObject({ state: "hidden", text: "8" });
  });

  it("triangles: a blank label with a saved answer is hidden; answerVisible prints it", () => {
    const t = load("triangle", "file-fixtures-triangle-area-v2");
    const caption = slotsOf("triangle", t).find((s) => s.path.startsWith("document.captions"));
    expect(caption).toMatchObject({ state: "hidden", text: "36" });
    t.document.captions[0].label.answerVisible = true;
    expect(at("triangle", t, caption!.path)?.state).toBe("supplied");
    t.document.captions[0].label = { ...t.document.captions[0].label, state: "answer-line", answerVisible: false };
    expect(at("triangle", t, caption!.path)).toMatchObject({ state: "answerLine", text: "36" });
  });

  it("bar models, number lines and algebra grids", () => {
    const b = slotsOf("bar-model", load("bar-model", "v2-lesson-r2-c-worked"));
    expect(b.some((s) => s.state === "blank")).toBe(true);
    const n = load("number-line", "example-15-c-1ma1-mock-set-05-3f-q15-worked");
    expect(at("number-line", n, "document.teaching.answer")).toMatchObject({ state: "supplied", text: "−1 ≤ x < 4" });
    n.document.teaching.answerVisible = false;
    expect(at("number-line", n, "document.teaching.answer")?.state).toBe("hidden");
    n.document.teaching.labels = { "2": "hidden", "3": "answer-line" };
    expect(at("number-line", n, "document.teaching.labels.2")).toMatchObject({ state: "hidden", text: "2" });
    expect(at("number-line", n, "document.teaching.labels.3")?.state).toBe("answerLine");
    const a = load("algebra-grid", "file-algebra-grid-examples-common-worked");
    expect(at("algebra-grid", a, "document.answer")).toMatchObject({ state: "supplied", text: "x(x+4)" });
    a.document.answerVisible = false;
    expect(at("algebra-grid", a, "document.answer")).toBeUndefined();
  });

  it("graphs: answer-only objects are hidden answers; other objects are not slots", () => {
    const g = load("graph", "file-tool-card-preview-examples-graph-tool");
    expect(slotsOf("graph", g)).toEqual([]);
    g.document.objects[0].answerOnly = true;
    expect(slotsOf("graph", g)[0]).toMatchObject({ path: "document.objects.0", state: "hidden" });
  });

  it("cuboids store no answers: hidden means no label, never a hidden answer", () => {
    for (const file of readdirSync(join(corpus, "cuboids")))
      expect(answerSlots("cuboids", JSON.parse(readFileSync(join(corpus, "cuboids", file), "utf8"))).filter(holdsAnswer)).toEqual([]);
  });

  it("worksheets: answer lines, table cells, choices and embedded diagrams", () => {
    for (const r of [comparativeBarCharts, treeDiagrams]) {
      const slots = resourceAnswerSlots(r);
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) {
        const v = s.path.split(".").reduce((n: Any, k) => (n == null ? n : n[k]), r);
        expect(v, s.path).not.toBeUndefined();
      }
      expect(slots.some((s) => s.path.includes(".diagram.envelope.document"))).toBe(true);
    }
  });
});
