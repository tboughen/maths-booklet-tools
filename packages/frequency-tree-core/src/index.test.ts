import { describe, expect, it } from "vitest";
import {
  addLevel,
  addQuestion,
  addSibling,
  calculateQuestion,
  canonical,
  childrenOf,
  create,
  decodeLinkHash,
  editorLink,
  fillCounts,
  forView,
  fromNested,
  groupName,
  hasHidden,
  hideCounts,
  layout,
  leaves,
  maxDepth,
  mergeNode,
  parseFile,
  readCount,
  removeLastSibling,
  removeLevel,
  renderSvg,
  setCategory,
  showAll,
  splitNode,
  validate,
  wrapLabel,
} from "./index";
import { examples } from "./examples";

const counts = (e: ReturnType<typeof create>) => e.document.nodes.map((b) => b.count.text);

describe("frequency tree core", () => {
  it("round-trips every example and lays it out without issues", () => {
    for (const example of examples)
      for (const worked of [false, true]) {
        const e = example.make(worked);
        expect(parseFile(canonical(e))).toEqual(e);
        const g = layout(e);
        expect(g.issues, example.id).toEqual([]);
        expect(g.notes, example.id).toEqual([]);
        expect(g.width).toBeLessThanOrEqual(180);
        expect(renderSvg(e)).toMatch(/^<svg [^>]*width="[\d.]+mm" height="[\d.]+mm"/);
      }
  });

  it("keeps blank, hidden and shown counts distinct; only the answer view prints hidden counts", () => {
    const e = create();
    expect(e.document.nodes.every((b) => b.count.show === "hidden" && b.count.text)).toBe(true);
    const pupil = renderSvg(e),
      answer = renderSvg(forView(e, "answer"));
    expect(pupil).toContain(">80<");
    expect(pupil).not.toContain(">37<");
    expect(answer).toContain(">37<");
    // The answer view never changes the saved pupil document.
    expect(e.document.nodes[0].count.show).toBe("hidden");
    expect(hasHidden(e)).toBe(true);
    expect(hasHidden(showAll(e))).toBe(false);
    const blank = structuredClone(e);
    blank.document.nodes[0].count = { text: "", show: "show" };
    expect(renderSvg(forView(blank, "answer"))).not.toContain(">32<");
  });

  it("fills only counts that follow from the others, keeping their visibility", () => {
    const e = fromNested("80", [
      { category: "men", count: "", hidden: ["count"], children: [{ category: "like", count: "24" }, { category: "not", count: "8" }] },
      { category: "women", count: "", children: [{ category: "like", count: "" }, { category: "not", count: "11" }] },
    ]);
    const r = fillCounts(e);
    expect(r.filled).toBe(3);
    expect(counts(r.envelope)).toEqual(["32", "24", "8", "48", "37", "11"]);
    expect(r.envelope.document.nodes[0].count.show).toBe("hidden");
    // Nothing follows twice, and algebra is never treated as a number.
    expect(fillCounts(r.envelope).filled).toBe(0);
    const algebra = fromNested("x", [{ category: "a", count: "" }, { category: "b", count: "3" }]);
    expect(fillCounts(algebra).filled).toBe(0);
    expect(readCount("1,200")).toBe(1200);
    expect(readCount("2x")).toBeNull();
  });

  it("calculates a question only on request, as an unsimplified fraction", () => {
    const e = examples[0].make(false);
    const q = e.document.questions[0];
    expect(q.answer).toEqual({ text: "37/61", show: "hidden" });
    const cleared = structuredClone(e);
    cleared.document.questions[0].answer.text = "";
    expect(calculateQuestion(cleared, q.id)!.document.questions[0].answer.text).toBe("37/61");
    // An empty bottom means the total.
    const total = addQuestion(e, "P(woman) =");
    total.document.questions[1].numerator = [e.document.nodes.find((b) => b.category.text === "women")!.id];
    expect(calculateQuestion(total, "q2")!.document.questions[1].answer.text).toBe("48/80");
  });

  it("notes counts that do not add up and blocks negative counts", () => {
    const e = create();
    e.document.nodes[1].count.text = "25";
    expect(layout(e).notes.join(" ")).toMatch(/after men add up to 33, not 32/);
    e.document.nodes[1].count.text = "-3";
    expect(layout(e).issues).toContain("A count is negative.");
  });

  it("changes the tree's shape with explicit structure actions", () => {
    let e = create();
    expect(maxDepth(e.document)).toBe(2);
    const flat = removeLevel(e);
    expect(maxDepth(flat.document)).toBe(1);
    expect(leaves(addLevel(flat).document)).toHaveLength(4);
    e = addSibling(e, null);
    expect(childrenOf(e.document, null)).toHaveLength(3);
    expect(addSibling(e, null)).toBe(e);
    const third = childrenOf(e.document, null)[2];
    e = splitNode(e, third.id);
    expect(childrenOf(e.document, third.id).map((b) => b.category.text)).toEqual(["like coffee", "do not like coffee"]);
    e = mergeNode(e, third.id);
    e = removeLastSibling(e, null);
    expect(childrenOf(e.document, null)).toHaveLength(2);
    expect(() => validate({ ...e, document: { ...e.document, nodes: e.document.nodes.slice(0, 1) } })).toThrow(/2 to/);
  });

  it("links group names across a level only when asked", () => {
    const e = create(),
      like = e.document.nodes[1].id;
    const linked = setCategory(e, like, "drink coffee");
    expect(linked.document.nodes.filter((b) => b.category.text === "drink coffee")).toHaveLength(2);
    const free = setCategory({ ...e, document: { ...e.document, linkLabels: false } }, like, "drink coffee");
    expect(free.document.nodes.filter((b) => b.category.text === "drink coffee")).toHaveLength(1);
    expect(groupName(e.document, like)).toBe("men, like coffee");
  });

  it("hides counts for pupils with the total kept or hidden", () => {
    const e = showAll(create());
    expect(hideCounts(e).document.total.show).toBe("show");
    expect(hideCounts(e, false).document.total.show).toBe("hidden");
  });

  it("wraps long group names onto two lines and reports overlaps", () => {
    expect(wrapLabel("do not like coffee", 20)).toEqual(["do not", "like coffee"]);
    expect(wrapLabel("men", 20)).toEqual(["men"]);
    const start = validate({ ...create(), document: { ...create().document, gapMm: 14, branchMm: 24 } });
    const tidy = setCategory(setCategory(start, "n2", "really like drinking coffee"), "n3", "never drink any coffee at all");
    expect(layout(tidy).issues).toEqual([]);
    const crowded = setCategory(start, "n2", "Coffee-drinkers-who-like-cake");
    expect(layout(crowded).issues.join(" ")).toMatch(/overlap/);
  });

  it("keeps editor links exact and rejects malformed ones", () => {
    const e = examples[0].make(false);
    const href = editorLink(e, "https://mathsdock.co.uk/tools/graph?x=1")!;
    expect(href).toMatch(/^https:\/\/mathsdock\.co\.uk\/tools\/frequency-tree#ftree=/);
    expect(decodeLinkHash(new URL(href).hash)).toEqual(e);
    expect(() => decodeLinkHash("#ftree=***")).toThrow(/not a supported/);
    expect(() => decodeLinkHash("#ftree=AAAA")).toThrow(/could not be read/);
  });

  it("rejects markup, unknown fields and broken structure", () => {
    const e = create();
    expect(() => validate({ ...e, document: { ...e.document, extra: 1 } })).toThrow();
    const markup = structuredClone(e);
    markup.document.nodes[0].category.text = "<b>men</b>";
    expect(() => validate(markup)).toThrow(/group names/);
    const orphan = structuredClone(e);
    orphan.document.nodes[1].parent = "n9";
    expect(() => validate(orphan)).toThrow(/after the group/);
    const deep = structuredClone(e);
    deep.document.nodes.push({ ...deep.document.nodes[1], id: "n20", parent: "n2" }, { ...deep.document.nodes[1], id: "n21", parent: "n2" });
    expect(() => validate(deep)).toThrow(/levels/);
  });
});
