import { describe, expect, it } from "vitest";
import { create, forView, hasHidden, layout, renderSvg, setAllShown, type Envelope } from "./index";
import { stemleafLayout } from "./stemleaf";
import { STEMLEAF_DEFAULTS, stemLeaves, type StemleafSettings } from "./shared";
import { examples } from "./examples";
import * as io from "./interchange";

const PINK = "#b0125b";
function stems(change: (s: StemleafSettings) => void = () => {}): Envelope {
  const e = create();
  e.document.kind = "stemleaf";
  const s = structuredClone(STEMLEAF_DEFAULTS);
  s.rows = [
    ["2", "3 7"],
    ["3", "1 4 4 8"],
    ["4", "2 5"],
  ].map(([stem, leaves]) => ({ stem, leaves, stemShow: "show" as const, leavesShow: "show" as const }));
  s.key = { stem: "2", leaf: "3", represents: "23 years", show: "show" };
  change(s);
  e.document.stemleaf = s;
  return e;
}
const texts = (svg: string, colour = "black") => [...svg.matchAll(new RegExp(`fill="${colour}"[^>]*>([^<]+)</text>`, "g"))].map((m) => m[1]);

describe("stem-and-leaf diagrams", () => {
  it("reads leaves as single digits, with or without spaces, and never sorts them", () => {
    expect(stemLeaves("2 3 3 4 5")).toEqual(["2", "3", "3", "4", "5"]);
    expect(stemLeaves("23345")).toEqual(["2", "3", "3", "4", "5"]);
    expect(stemLeaves("5, 1, 3")).toEqual(["5", "1", "3"]);
    expect(stemLeaves("")).toEqual([]);
    expect(stemLeaves("12 13")).toBeNull();
    expect(stemLeaves("2 a")).toBeNull();
  });

  it("prints 1 cm rows ruled between, the stems, the leaves 5.5 mm apart and the key", () => {
    const e = stems();
    const g = stemleafLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual([]);
    expect(g.rows.map((r) => r.top - g.y0)).toEqual([0, 10, 20]);
    const svg = renderSvg(e);
    // One vertical line, two rules between three rows, the key box and the bar in the key.
    expect(svg.match(/<path /g)).toHaveLength(5);
    expect(texts(svg)).toEqual(["2", "3", "7", "3", "1", "4", "4", "8", "4", "2", "5", "Key:", "2", "3 represents 23 years"]);
  });

  it("a hidden stem or row of leaves is left for pupils and printed pink on answers, at the same size", () => {
    const e = stems((s) => {
      s.rows[1].leavesShow = "hidden";
      s.rows[2].stemShow = "hidden";
    });
    expect(hasHidden(e)).toBe(true);
    const pupil = renderSvg(e);
    expect(texts(pupil)).toEqual(["2", "3", "7", "3", "2", "5", "Key:", "2", "3 represents 23 years"]);
    expect(pupil).not.toContain(PINK);
    const answer = forView(e, "answer", true);
    expect(texts(renderSvg(answer), PINK)).toEqual(["1", "4", "4", "8", "4"]);
    expect(layout(answer).width).toBe(layout(e).width);
    expect(layout(answer).height).toBe(layout(e).height);
  });

  it("an empty key box keeps the key as the answer and the box its size", () => {
    const e = stems((s) => void (s.key.show = "hidden"));
    expect(hasHidden(e)).toBe(true);
    expect(texts(renderSvg(e))).not.toContain("3 represents 23 years");
    const answer = forView(e, "answer", true);
    expect(texts(renderSvg(answer), PINK)).toEqual(["2", "3 represents 23 years"]);
    expect(layout(answer).width).toBe(layout(e).width);
    expect(stemleafLayout(stems((s) => void (s.key.show = "none"))).key).toBeNull();
  });

  it("names a leaf that is not one digit, a stem that is not a number, an unfinished key and an overfull row", () => {
    expect(stemleafLayout(stems((s) => void (s.rows[0].leaves = "3 17"))).issues).toEqual(["Row 1: each leaf is one digit, 0 to 9."]);
    expect(stemleafLayout(stems((s) => void (s.rows[0].stem = "two"))).issues).toEqual(["Row 1: enter a number for the stem, or leave it blank."]);
    expect(stemleafLayout(stems((s) => void (s.key.represents = ""))).issues).toEqual(["Key: fill in the stem, the leaf and what they represent, or leave the key empty for pupils."]);
    expect(stemleafLayout(stems((s) => void (s.rows[0].leaves = "1".repeat(12)))).issues).toEqual(["Row 1: 12 leaves do not fit in a 50 mm leaves column. Make the column wider."]);
  });

  it("notes leaves or stems out of order without changing them", () => {
    const g = stemleafLayout(
      stems((s) => {
        s.rows[1].leaves = "4 1";
        s.rows[2].stem = "3";
      }),
    );
    expect(g.issues).toEqual([]);
    expect(g.notes).toEqual(["Row 2: the leaves are not in order; they print as typed.", "The stems do not go up in order; they print as typed."]);
  });

  it("a new diagram is three empty ruled rows and an empty key box, with no issues", () => {
    const e = create();
    e.document.kind = "stemleaf";
    const g = stemleafLayout(e);
    expect(g.issues).toEqual([]);
    expect(g.rows).toHaveLength(3);
    expect(hasHidden(e)).toBe(false);
  });

  it("hide every stem and leaf, then show all, which also shows a hidden key", () => {
    const hidden = setAllShown(stems((s) => void (s.key.show = "hidden")), "hidden");
    expect(hidden.document.stemleaf!.rows.every((r) => r.stemShow === "hidden" && r.leavesShow === "hidden")).toBe(true);
    const shown = setAllShown(hidden, "show");
    expect(hasHidden(shown)).toBe(false);
    expect(shown.document.stemleaf!.key.show).toBe("show");
  });

  it("the examples draw cleanly in both copies", () => {
    for (const x of examples.filter((x) => x.id.startsWith("stemleaf-"))) {
      for (const worked of [false, true]) expect(layout(x.make(worked)).issues, x.id).toEqual([]);
      if (x.worked) expect(hasHidden(x.make(false)), x.id).toBe(true);
    }
  });

  it("the connector merges the key field by field and replaces rows", async () => {
    const e = io.create({ spec: { example: "stemleaf-scores" } });
    const next = await io.revise({
      envelope: e,
      baseHash: await io.hash(e),
      operations: [{ op: "set_presentation", presentation: { stemleaf: { key: { show: "hidden" }, leafMm: 60 } } }],
    });
    const s = next.document.stemleaf!;
    expect(s.key).toEqual({ stem: "1", leaf: "2", represents: "12 points", show: "hidden" });
    expect(s.leafMm).toBe(60);
    expect(s.rows).toHaveLength(5);
    expect(layout(next).issues).toEqual([]);
  });
});
