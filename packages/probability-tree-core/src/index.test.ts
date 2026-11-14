import { describe, expect, it } from "vitest";
import {
  addSibling,
  addStage,
  calculateQuestion,
  canonical,
  childrenOf,
  create,
  decodeLinkHash,
  editorLink,
  extendBranch,
  fillComplements,
  fillEnd,
  fillFromBag,
  forView,
  formatFraction,
  fromNested,
  labelBox,
  layout,
  leaves,
  lineCrossesBox,
  maxDepth,
  parseFile,
  pathName,
  pruneBranch,
  readProbability,
  removeLastSibling,
  removeStage,
  renderSvg,
  setOutcome,
  uniform,
  validate,
} from "./index";
import { examples } from "./examples";

const texts = (e: ReturnType<typeof create>) => e.document.branches.map((b) => b.probability.text);

describe("probability tree core", () => {
  it("round-trips every example and lays it out without issues", () => {
    for (const example of examples)
      for (const worked of [false, true]) {
        const e = example.make(worked);
        expect(parseFile(canonical(e))).toEqual(e);
        expect(layout(e).issues).toEqual([]);
        expect(layout(e).width).toBeLessThanOrEqual(180);
        expect(renderSvg(e)).toMatch(/^<svg [^>]*width="[\d.]+mm"/);
      }
  });

  it("reads fractions, decimals and percentages exactly and leaves algebra alone", () => {
    expect(readProbability("3/8")).toEqual({ n: 3n, d: 8n });
    expect(readProbability("0.45")).toEqual({ n: 9n, d: 20n });
    expect(readProbability("40%")).toEqual({ n: 2n, d: 5n });
    expect(readProbability(".5")).toEqual({ n: 1n, d: 2n });
    expect(readProbability("x")).toBeNull();
    expect(readProbability("1 − x")).toBeNull();
    expect(readProbability("1/0")).toBeNull();
    expect(formatFraction({ n: 341n, d: 1000n }, "decimal")).toBe("0.341");
    expect(formatFraction({ n: 1n, d: 3n }, "decimal")).toBe("1/3");
  });

  it("keeps hidden answers out of the pupil drawing and prints them in the answer view", () => {
    const e = examples.find((x) => x.id === "two-bags")!.make(false);
    const pupil = renderSvg(e),
      answer = renderSvg(forView(e, "answer"));
    expect(pupil).not.toContain(">7<");
    expect(pupil).toContain("stroke-dasharray");
    expect(answer).toContain(">7<");
    expect(e.document.questions[0].answer).toEqual({ text: "1/6", show: "hidden" });
    // The saved document keeps pupil visibility after rendering the answer view.
    expect(e.document.branches.some((b) => b.probability.show === "hidden")).toBe(true);
  });

  it("fills a bag with and without replacement only when asked", () => {
    const e = uniform([{ outcomes: ["R", "B"] }, { outcomes: ["R", "B"] }]);
    expect(texts(e).every((t) => t === "")).toBe(true);
    expect(texts(fillFromBag(e, [5, 3], false)!)).toEqual(["5/8", "4/7", "3/7", "3/8", "5/7", "2/7"]);
    expect(texts(fillFromBag(e, [5, 3], true)!)).toEqual(["5/8", "5/8", "3/8", "3/8", "5/8", "3/8"]);
    expect(fillFromBag(e, [1, 2, 3], false)).toBeNull();
  });

  it("fills a missing complement and leaves complete or algebraic groups", () => {
    const e = uniform([{ outcomes: ["A", "B"], probabilities: ["0.3", ""] }]);
    const r = fillComplements(e);
    expect(r.filled).toBe(1);
    expect(texts(r.envelope)).toEqual(["0.3", "0.7"]);
    const algebra = uniform([{ outcomes: ["A", "B"], probabilities: ["x", ""] }]);
    expect(fillComplements(algebra).filled).toBe(0);
  });

  it("supports unequal trees and keeps parents before children", () => {
    let e = uniform([{ outcomes: ["Pass", "Fail"], probabilities: ["0.6", "0.4"] }]);
    const fail = e.document.branches[1].id;
    e = extendBranch(e, fail);
    expect(maxDepth(e.document)).toBe(2);
    expect(leaves(e.document).map((b) => pathName(e.document, b.id))).toEqual(["Pass", "Fail, Pass", "Fail, Fail"]);
    e = addSibling(e, fail);
    expect(childrenOf(e.document, fail)).toHaveLength(3);
    e = removeLastSibling(e, fail);
    expect(childrenOf(e.document, fail)).toHaveLength(2);
    e = pruneBranch(e, fail);
    expect(maxDepth(e.document)).toBe(1);
    expect(() => validate({ ...e, document: { ...e.document, branches: [e.document.branches[0]] } })).toThrow();
  });

  it("adds and removes whole stages and links outcome names across a stage", () => {
    let e = create();
    e = addStage(e);
    expect(maxDepth(e.document)).toBe(3);
    expect(leaves(e.document)).toHaveLength(8);
    e = setOutcome(e, e.document.branches[0].id, "Green");
    expect(e.document.branches.filter((b) => b.outcome.text === "Green")).toHaveLength(1);
    const second = e.document.branches[1];
    e = setOutcome(e, second.id, "Yellow");
    expect(e.document.branches.filter((b) => b.outcome.text === "Yellow")).toHaveLength(2);
    e = removeStage(e);
    expect(maxDepth(e.document)).toBe(2);
  });

  it("calculates end columns and given-that answers only on request", () => {
    let e = fillFromBag(uniform([{ outcomes: ["R", "B"] }, { outcomes: ["R", "B"] }], { endColumn: "both" }), [4, 6], false)!;
    expect(leaves(e.document).every((b) => b.endProbability.text === "")).toBe(true);
    e = fillEnd(fillEnd(e, "outcome"), "probability");
    expect(leaves(e.document).map((b) => [b.endOutcome.text, b.endProbability.text])).toEqual([
      ["R, R", "2/15"],
      ["R, B", "4/15"],
      ["B, R", "4/15"],
      ["B, B", "1/3"],
    ]);
    const [rr, , br] = leaves(e.document).map((b) => b.id);
    e.document.questions = [{ id: "q1", text: "P(R first | R second)", answer: { text: "", show: "hidden" }, event: [rr], given: [rr, br] }];
    e = calculateQuestion(e, "q1")!;
    expect(e.document.questions[0].answer).toEqual({ text: "1/3", show: "hidden" });
  });

  it("warns about probabilities that do not total 1 without changing them", () => {
    const e = uniform([{ outcomes: ["A", "B"], probabilities: ["0.3", "0.6"] }]);
    expect(layout(e).notes.join(" ")).toContain("add up to 9/10");
    expect(layout(e).issues).toEqual([]);
    const bad = uniform([{ outcomes: ["A", "B"], probabilities: ["1.3", "0.6"] }]);
    expect(layout(bad).issues.join(" ")).toContain("above 1");
  });

  it("keeps three-way probabilities clear of the other branches at the default sizes", () => {
    for (const [branchMm, gapMm] of [[32, 14], [25, 12], [46, 15], [40, 18]]) {
      const e = uniform(
        [
          { outcomes: ["A", "B"], probabilities: ["1/3", "2/3"] },
          { outcomes: ["X", "Y", "Z"], probabilities: ["1/4", "1/2", "1/4"] },
        ],
        { branchMm, gapMm },
      );
      const g = layout(e);
      expect(g.issues, `${branchMm}/${gapMm}`).toEqual([]);
      // No probability touches any branch line.
      for (const p of g.placed.filter((x) => x.kind === "probability")) {
        const size = labelBox(p.label, "dots", "probability");
        const b = { x1: p.cx - size.width / 2, x2: p.cx + size.width / 2, y1: p.cy - size.height / 2, y2: p.cy + size.height / 2 };
        expect(g.lines.some((l) => lineCrossesBox(l, b)), `${branchMm}/${gapMm} ${p.label.text}`).toBe(false);
      }
    }
    // Three pupil spaces (hidden probabilities) need a little more room: at 32/14 the middle space
    // would cross a branch, which is a note (saved trees still export), and 32/16 is clear.
    const spaces = (gapMm: number) =>
      fromNested(["A", "B", "C"].map((outcome) => ({ outcome, probability: "1/3", hidden: ["probability" as const] })), { gapMm });
    expect(layout(spaces(14)).issues).toEqual([]);
    expect(layout(spaces(14)).notes.join(" ")).toContain("crosses a branch");
    expect([...layout(spaces(16)).issues, ...layout(spaces(16)).notes]).toEqual([]);
    const longer = fromNested(["A", "B", "C"].map((outcome) => ({ outcome, probability: "1/3", hidden: ["probability" as const] })), { branchMm: 38 });
    expect([...layout(longer).issues, ...layout(longer).notes]).toEqual([]);
  });

  it("leaves every probability that was already clear at the middle of its branch, as saved trees printed before", () => {
    // Only a label that touched a branch or another label moves; the example trees all keep the old place.
    for (const example of examples)
      for (const worked of [false, true])
        for (const view of ["pupil", "answer"] as const) {
          const g = layout(forView(example.make(worked), view));
          const probabilities = g.placed.filter((p) => p.kind === "probability").slice(0, g.lines.length);
          probabilities.forEach((p, i) => expect(p.cx, `${example.id} ${i}`).toBeCloseTo((g.lines[i].x1 + g.lines[i].x2) / 2, 6));
        }
  });

  it("reports a label that crosses a branch when no clear place exists", () => {
    const e = uniform([{ outcomes: ["A", "B", "C", "D"], probabilities: ["1/10", "1/10", "1/10", "7/10"] }], { branchMm: 20, gapMm: 10 });
    const g = layout(e);
    expect([...g.issues, ...g.notes].join(" ")).toMatch(/overlap|crosses a branch/);
    expect(lineCrossesBox({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x1: 4, x2: 6, y1: 4, y2: 6 })).toBe(true);
    expect(lineCrossesBox({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 4, x2: 6, y1: 1, y2: 3 })).toBe(false);
  });

  it("allows one branch at a later point, for draw-the-missing-branches questions", () => {
    const e = fromNested([
      { outcome: "Red", probability: "3/8", children: [{ outcome: "Red", probability: "3/8" }] },
      { outcome: "Blue", probability: "5/8" },
    ]);
    const red = e.document.branches[0].id;
    expect(childrenOf(e.document, red)).toHaveLength(1);
    expect(layout(e).issues).toEqual([]);
    // A lone branch is part of a tree, not a certain event: no total note, and no 1 written.
    expect(layout(e).notes.join(" ")).not.toContain("add up to 3/8");
    const blank = fromNested([{ outcome: "Red", probability: "3/8", children: [{ outcome: "Red" }] }, { outcome: "Blue", probability: "5/8" }]);
    expect(fillComplements(blank).filled).toBe(0);
    // Single branches can be made and removed down to one, but the first stage keeps two.
    let u = uniform([{ outcomes: ["Pass", "Fail"] }]);
    u = extendBranch(u, u.document.branches[1].id, 1);
    expect(childrenOf(u.document, u.document.branches[1].id)).toHaveLength(1);
    u = addSibling(u, u.document.branches[1].id);
    u = removeLastSibling(u, u.document.branches[1].id);
    expect(childrenOf(u.document, u.document.branches[1].id)).toHaveLength(1);
    expect(removeLastSibling(u, null)).toBe(u);
    expect(() => fromNested([{ outcome: "Only", children: [{ outcome: "Next" }] }])).toThrow(/first stage needs 2/);
    // Other actions on a part-drawn tree: no implicit 1, no bag fill on the wrong shape, exact end values.
    expect(fillFromBag(blank, [3, 5], false)).toBeNull();
    const ends = fillEnd(fillEnd(e, "outcome"), "probability");
    expect(leaves(ends.document).map((b) => [b.endOutcome.text, b.endProbability.text])).toEqual([
      ["Red, Red", "9/64"],
      ["Blue", "5/8"],
    ]);
    expect(fillEnd(blank, "probability").document.branches.every((b) => b.endProbability.text === "" || b.endProbability.text === "5/8")).toBe(true);
    expect(maxDepth(addStage(e).document)).toBe(3);
    expect(childrenOf(removeStage(e).document, red)).toHaveLength(0);
  });

  it("round-trips editor links", () => {
    const e = examples[0].make(false);
    const href = editorLink(e, "https://mathsdock.co.uk/")!;
    expect(href).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/probability-tree#tree=/);
    expect(decodeLinkHash(new URL(href).hash)).toEqual(e);
  });
});
