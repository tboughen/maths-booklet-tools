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
  layout,
  leaves,
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

  it("round-trips editor links", () => {
    const e = examples[0].make(false);
    const href = editorLink(e, "https://mathsdock.co.uk/")!;
    expect(href).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/probability-tree#tree=/);
    expect(decodeLinkHash(new URL(href).hash)).toEqual(e);
  });
});
