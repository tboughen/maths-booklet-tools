import { describe, expect, it } from "vitest";
import * as f from "./index";
import { examples } from "./examples";
import { create, revise } from "./interchange";

const values = (e: f.Envelope, tree = 0) => e.document.trees[tree].nodes.map((n) => n.value.text);

describe("factor trees (N-5)", () => {
  it("splits and unsplits by hand, keeping blanks, hidden answers and circles distinct", () => {
    let e = f.create("60");
    e = f.split(e, "t1", "n1", ["6", "10"]);
    e = f.split(e, "t1", "n2");
    e = f.setNode(e, "t1", "n4", { text: "2", show: "hidden", circled: true });
    const t = e.document.trees[0];
    expect(t.nodes.map((n) => [n.id, n.parent, n.value.text])).toEqual([["n1", null, "60"], ["n2", "n1", "6"], ["n3", "n1", "10"], ["n4", "n2", "2"], ["n5", "n2", ""]]);
    expect(t.nodes[3]).toEqual({ id: "n4", parent: "n2", value: { text: "2", show: "hidden" }, circled: true });
    expect(() => f.split(e, "t1", "n1")).toThrow(/already splits/);
    expect(() => f.setNode(e, "t1", "n5", { show: "hidden" })).toThrow(/blank number/);
    expect(() => f.setNode(e, "t1", "n5", { text: "1.5" })).toThrow(/whole number/);
    expect(values(f.unsplit(e, "t1", "n1"))).toEqual(["60"]);
  });
  it("completes only when asked, from the numbers given, and keeps entered numbers", () => {
    let e = f.split(f.create("360"), "t1", "n1", ["36", ""]);
    const { envelope, filled } = f.completeTree(e, "t1", true);
    const t = envelope.document.trees[0];
    expect(t.nodes[2].value).toEqual({ text: "10", show: "hidden" });
    expect(t.nodes[1].value).toEqual({ text: "36", show: "show" });
    const primes = t.nodes.filter((n) => f.isLeaf(t, n.id)).map((n) => [n.value.text, n.circled]);
    expect(primes.every(([, c]) => c === true)).toBe(true);
    expect(primes.map(([v]) => v).sort()).toEqual(["2", "2", "2", "3", "3", "5"]);
    expect(t.product).toEqual({ text: "2^3 × 3^2 × 5", show: "hidden" });
    expect(filled).toBeGreaterThan(10);
    expect(f.warnings(envelope)).toEqual([]);
    // A blank parent is the product of its two branches.
    e = f.split(f.create(), "t1", "n1", ["7", "11"]);
    expect(values(f.completeTree(e).envelope)[0]).toBe("77");
  });
  it("writes products in index form whatever way they are typed", () => {
    expect(f.canonicalProduct("2³ x 3² * 5")).toBe("2^3 × 3^2 × 5");
    expect(f.canonicalProduct(" 2 ^ 2×7 ")).toBe("2^2 × 7");
    expect(() => f.canonicalProduct("2 + 3")).toThrow(/product of powers/);
    expect(f.indexForm(7200)).toBe("2^5 × 3^2 × 5^2");
    expect(f.indexForm(97)).toBe("97");
  });
  it("warns about wrong splits, circles and answers unless it is a deliberate error", () => {
    const mistake = examples.find((x) => x.id === "spot-the-mistake")!.make(false);
    expect(f.warnings(mistake)).toEqual([]);
    expect(f.warnings({ ...mistake, document: { ...mistake.document, intentionalError: false } })).toEqual([
      "4 is circled but is not prime.",
      "4 in the answer is not prime.",
    ]);
    let e = f.split(f.create("60"), "t1", "n1", ["6", "9"]);
    e = f.setProduct(e, "t1", { text: "2^2 × 3" });
    expect(f.warnings(e)).toEqual(["6 × 9 is 54, not 60.", "The answer 2^2 × 3 makes 12, not 60."]);
    expect(f.warnings(f.addTree(e))).toContain("In tree 1, 6 × 9 is 54, not 60.");
  });
  it("prints hidden numbers, circles and answers only on the answers copy, in the answer colour", () => {
    const e = examples[0].make(false);
    const pupil = f.renderSvg(e),
      answers = f.renderSvg(f.forView(e, "answer", true));
    expect(pupil).not.toContain(">6<");
    expect(pupil.match(/<circle/g)).toHaveLength(2); // only the given primes 2 and 5
    expect(answers).toContain(`fill="${f.ANSWER_COLOUR}">6<`);
    expect(answers.match(/<circle/g)).toHaveLength(6);
    expect(answers).toContain('baseline-shift="super"');
    expect(pupil).not.toContain('baseline-shift="super"');
    expect(f.renderSvg(examples[0].make(true))).not.toContain(f.ANSWER_COLOUR);
  });
  it("draws blanks as dots or boxes and keeps two trees side by side within the page", () => {
    const e = examples[1].make(false);
    const g = f.layout(e);
    expect(g.width).toBeLessThan(180);
    const [t1, t2] = ["t1", "t2"].map((id) => g.nodes.filter((n) => n.treeId === id));
    expect(Math.max(...t1.map((n) => n.x))).toBeLessThan(Math.min(...t2.map((n) => n.x)));
    expect(f.renderSvg(e)).toContain("stroke-dasharray");
    const boxes = f.renderSvg({ ...e, document: { ...e.document, blankStyle: "box" } });
    expect(boxes).toContain("<rect x=");
    expect(f.exportIssue(f.addTree(f.addTree(f.create("360"))))).toBeNull();
    expect(f.exportIssue(f.addTree(f.addTree(f.create("9999999"))))).toMatch(/over the 180 mm/);
  });
  it("reads back every example and link exactly", () => {
    for (const x of examples)
      for (const worked of [false, true]) {
        const e = x.make(worked);
        expect(f.canonical(f.parseFile(f.canonical(e)))).toBe(f.canonical(e));
        expect(f.canonical(f.decodeLinkHash(f.linkHash(e)))).toBe(f.canonical(e));
      }
    expect(() => f.parseFile('{"kind":"factor-tree","schemaVersion":2}')).toThrow(/version 1/);
  });
  it("refuses a number with one branch", () => {
    const e = f.split(f.create("6"), "t1", "n1", ["2", "3"]);
    const broken = structuredClone(e);
    broken.document.trees[0].nodes.pop();
    expect(() => f.validate(broken)).toThrow(/exactly two branches/);
  });
  it("connector: creates nested trees, completes as hidden answers by default and revises with the hash", async () => {
    const e = create({ spec: { trees: [{ root: { value: "90", children: [{ value: "9" }, { value: "10", hidden: true }] }, product: true }], complete: true } });
    const t = e.document.trees[0];
    expect(t.nodes[2].value).toEqual({ text: "10", show: "hidden" });
    expect(t.product).toEqual({ text: "2 × 3^2 × 5", show: "hidden" });
    expect(create({ spec: { root: "12" } }).document.trees[0].product).toEqual({ text: "", show: "show" });
    const next = await revise({
      envelope: e,
      baseHash: await f.hash(e),
      operations: [
        { op: "add_tree" },
        { op: "split_node", treeId: "t2", nodeId: "n1", factors: ["2", "45"] },
        { op: "set_settings", settings: { blankStyle: "box", lines: "bold" } },
      ],
    });
    expect(values(next, 1)).toEqual(["90", "2", "45"]);
    expect(next.document.lines).toBe("bold");
    await expect(revise({ envelope: e, baseHash: "0".repeat(64), operations: [] })).rejects.toThrow(/stale_hash/);
    expect(() => create({ spec: { example: "complete-360", root: "1" } })).toThrow(/Examples/);
  });
});
