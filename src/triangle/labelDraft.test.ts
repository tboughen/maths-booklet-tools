import { describe, expect, it } from "vitest";
import {
  create,
  canonical,
  editLabel,
  getLabel,
  addTriangle,
  layout,
  saveAnswer,
  calculate,
  isStale,
} from "../../packages/triangle-core/src";
import { example } from "../../packages/triangle-core/src/examples";
import {
  applyLabelDraft,
  canMarkRight,
  labelDraft,
  labelState,
} from "./labelDraft";
import { printedInputBasis, calculationContexts } from "./calculationContext";
import { angleWedge, geometryHits } from "./interaction";

describe("triangle label choices", () => {
  it("keeps arc, text, units and hidden answers independent across mode changes", () => {
    const e = example("sine-angle"),
      original = canonical(e),
      ref = `a:${e.document.angles[1].id}`;
    const draft = labelDraft(e, ref);
    draft.value.answer = "42";
    draft.value.answerVisible = false;
    draft.mark = "double";
    const originalText = draft.text;
    Object.assign(draft, labelState(draft, "hidden"));
    const n = applyLabelDraft(e, draft),
      angle = n.document.angles[1];
    expect(angle.mark).toBe("double");
    expect(angle.label.text).toBe(originalText);
    expect(angle.label.answer).toBe("42");
    expect(angle.label.answerVisible).toBe(false);
    expect(canonical(e)).toBe(original);
  });
  it("suggests x only for an empty unlinked unknown, preserving populated or linked text", () => {
    const draft = labelDraft(create(), "e:AB");
    expect(labelState(draft, "symbol").text).toBe("x");
    draft.text = "6";
    expect(labelState(draft, "symbol").text).toBe("6");
    draft.text = "";
    draft.value.shared = "s";
    expect(labelState(draft, "symbol").text).toBe("");
  });
  it("preserves explicit None when typing, selecting a value and reopening", () => {
    const e = create(),
      draft = labelDraft(e, "a:T1-B");
    draft.text = "40";
    Object.assign(draft, labelState(draft, "value"));
    const n = applyLabelDraft(e, draft);
    expect(labelDraft(n, draft.ref).mark).toBe("none");
    expect(labelDraft(n, draft.ref).text).toBe("40");
  });
  it("keeps a legacy vertex style and its hidden metadata on a no-op apply", () => {
    const e = editLabel(create(), "v:A", {
      state: "answer-line",
      prefix: "P",
      answer: "a",
      answerVisible: false,
    });
    expect(canonical(applyLabelDraft(e, labelDraft(e, "v:A")))).toBe(
      canonical(e),
    );
  });
  it("uses the same right-angle condition as final model validation without reshaping", () => {
    const right = create(),
      wrong = create("scalene");
    expect(canMarkRight(right, "a:T1-A")).toBe(true);
    expect(canMarkRight(wrong, "a:T1-A")).toBe(false);
    const draft = labelDraft(wrong, "a:T1-A");
    draft.mark = "right";
    expect(() => applyLabelDraft(wrong, draft)).toThrow(/perpendicular/);
  });
  it("reloads prepared inputs after changing printed givens but preserves saved mathematical answers", () => {
    let e = example("missing-side");
    const before = printedInputBasis(e),
      context = calculationContexts(e, "e:BC", "T1");
    e = saveAnswer(
      e,
      "e:BC",
      calculate("pythagoras-hypotenuse", { p: "6", q: "8" })[0],
      { kind: "exact", digits: 1 },
      "cm",
      true,
    );
    e = editLabel(e, "e:AB", { state: "hidden" });
    expect(printedInputBasis(e)).not.toBe(before);
    expect(calculationContexts(e, "e:BC", "T1")).not.toEqual(context);
    expect(isStale(e, getLabel(e, "e:BC"))).toBe(false);
    expect(getLabel(e, "e:BC").answer).toBe("10");
  });
  it("treats ordinary arc style as presentation and a right square as a printed given", () => {
    const e = create("scalene"),
      before = printedInputBasis(e);
    e.document.angles[0].mark = "triple";
    expect(printedInputBasis(e)).toBe(before);
    const right = create(),
      original = printedInputBasis(right);
    right.document.angles[0].mark = "none";
    expect(printedInputBasis(right)).not.toBe(original);
  });
  it("returns named overlapping angle hits and highlights their distinct rays", () => {
    const e = addTriangle(create(), "split", "BC");
    const outer = e.document.angles.find((a) => a.id === "T1-A")!,
      inner = e.document.angles.find((a) => a.id === "T2-A")!;
    outer.mark = "arc";
    inner.mark = "arc";
    const g = layout(e),
      v = g.vertices[inner.vertex],
      p = g.vertices[inner.from],
      q = g.vertices[inner.to];
    const u = {
        x: (p.x - v.x) / Math.hypot(p.x - v.x, p.y - v.y),
        y: (p.y - v.y) / Math.hypot(p.x - v.x, p.y - v.y),
      },
      w = {
        x: (q.x - v.x) / Math.hypot(q.x - v.x, q.y - v.y),
        y: (q.y - v.y) / Math.hypot(q.x - v.x, q.y - v.y),
      };
    const den = Math.hypot(u.x + w.x, u.y + w.y),
      at = {
        x: v.x + (6 * (u.x + w.x)) / den,
        y: v.y + (6 * (u.y + w.y)) / den,
      };
    expect(geometryHits(e, g, at, 0.1)).toEqual(
      expect.arrayContaining(["a:T1-A", "a:T2-A"]),
    );
    expect(angleWedge(e, g, "a:T1-A")).not.toBe(angleWedge(e, g, "a:T2-A"));
  });
});
