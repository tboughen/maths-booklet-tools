import { describe, expect, it } from "vitest";
import { a7Booklet } from "../../../packages/resource-core/src/booklet-fixtures";
import { checkLesson, estimateTokens, lessonChangeRequest, lessonRequest, lessonSystem, planJob, planRequest, planSystem } from "./brief";
import { isPlaceholder, placeholderLesson, planFromBooklet } from "./make";
import * as edit from "../edit";
import { schemeSchema } from "../../worksheet/ai/scheme";

const [plot, gradient] = a7Booklet.document.lessons;

describe("booklet AI prompts", () => {
  it("keeps the cached system prompts stable and self-contained", () => {
    for (const s of [lessonSystem, planSystem]) {
      expect(s).toContain("Maths Resource Design Guide");
      expect(s).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
    expect(lessonSystem).toContain("Worked example");
    expect(lessonSystem).toContain('"letters"');
    // The example lesson teaches the spec form of diagrams, not saved envelopes.
    expect(lessonSystem).toContain('"spec":{"axes"');
  });

  it("asks for one lesson with the unit around it and only the diagram families it needs", () => {
    const plan = planFromBooklet(a7Booklet);
    const r = lessonRequest(plan, 1, { group: "Year 9", context: "No calculators." });
    expect(r).toContain("Write lesson 2 of 2");
    expect(r).toContain("Objective code: A7.03");
    expect(r).toContain("No calculators.");
    expect(r).toContain('kind="graph"');
    expect(r).not.toContain('kind="venn"');
  });

  it("plans from the ticked objectives", () => {
    const r = planRequest({ code: "A7", title: "Visualising", group: "Year 9", objectives: [{ code: "A7.01", text: "Plot graphs" }], context: "", checkInLesson: true });
    expect(r).toContain("- A7.01: Plot graphs");
    expect(r).toContain("Check-in lesson first: yes");
  });

  it("sends the current lesson for a change and keeps its diagrams' families", () => {
    const r = lessonChangeRequest(gradient, 1, "Add a negative gradient");
    expect(r).toContain("<current_lesson>");
    expect(r).toContain('kind="graph"');
  });

  it("asks for the agreed booklet lesson shape", () => {
    for (const phrase of ["used **with** the teaching", "From earlier", "Exam-style questions", "(Total for Question 2 is 3 marks)", "Answer on your mini whiteboard.", "Explain …'s mistake.", "at least three unaided questions", "One new step at a time", "The school's method"])
      expect(lessonSystem).toContain(phrase);
    expect(planSystem).toContain("From earlier");
  });

  it("names the school's methods only when the scheme has them", () => {
    const methods = [{ topic: "Gradient of a straight line", method: "Example method", layout: "Two steps." }];
    const brief = { code: "A7", title: "Visualising", group: "Year 9", objectives: [{ code: "A7.03", text: "Find gradients" }], context: "", checkInLesson: false };
    expect(planRequest(brief)).not.toContain("School methods");
    expect(planRequest({ ...brief, methods })).toContain("- Gradient of a straight line: Example method. Two steps.");
    const plan = planFromBooklet(a7Booklet);
    expect(lessonRequest(plan, 1, { group: "", context: "" })).not.toContain("School methods");
    expect(lessonRequest(plan, 1, { group: "", context: "", methods })).toContain("School methods");
    expect(schemeSchema.safeParse({ schemaVersion: 1, kind: "scheme-of-work", name: "S", units: [{ code: "A7", title: "T", objectives: [] }], methods }).success).toBe(true);
  });

  it("gives a rough token budget that grows with the lessons", () => {
    expect(estimateTokens(7).output).toBeGreaterThan(estimateTokens(2).output);
  });
});

describe("lesson checks", () => {
  it("accepts a good lesson and builds its diagrams", () => {
    const r = checkLesson({ flags: "", lesson: gradient });
    expect(r.ok).toBe(true);
  });

  it("names schema problems by path", () => {
    const bad = structuredClone(gradient) as unknown as { sections: { kind: string }[] };
    bad.sections[0].kind = "starter";
    const r = checkLesson({ flags: "", lesson: bad });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feedback).toMatch(/lesson\.sections\.0\.kind/);
  });

  it("returns layout problems with the millimetres involved", () => {
    const wide = structuredClone(gradient);
    const item = wide.sections[2].cards[0].items[0] as { diagram: { tool: string; envelope?: unknown; spec?: unknown } };
    item.diagram = { tool: "graph", spec: { axes: { x: { negativeSquares: 1, positiveSquares: 14, unitsPerSquare: 1 }, y: { negativeSquares: 1, positiveSquares: 6, unitsPerSquare: 1 } }, objects: [] } };
    const r = checkLesson({ flags: "", lesson: wide });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.feedback).toMatch(/mm wide/);
  });

  it("refuses worked-answer settings on pupil diagrams", () => {
    const leak = structuredClone(plot);
    (leak.sections[2].cards[0].items[1] as { diagram: unknown }).diagram = { tool: "graph", spec: { axes: { x: { negativeSquares: 1, positiveSquares: 4, unitsPerSquare: 1 }, y: { negativeSquares: 1, positiveSquares: 4, unitsPerSquare: 1 } }, objects: [], answerVisible: true } };
    const r = checkLesson({ flags: "", lesson: leak });
    expect(r.ok).toBe(false);
  });

  it("checks a plan's shape", () => {
    expect(planJob.check({ plan: "", flags: "", title: "T", coverNote: "", intro: {}, lessons: [] }).ok).toBe(false);
  });
});

describe("booklet edits", () => {
  it("keeps a failed lesson's place and plan so it can be rebuilt", () => {
    const p = placeholderLesson({ title: "Gradient", code: "A7.03", objective: "Find gradients", keyIdea: "", plan: "Use perfect points." }, "Stopped.");
    expect(isPlaceholder(p)).toBe(true);
    expect(planFromBooklet({ ...a7Booklet, document: { ...a7Booklet.document, lessons: [p] } }).lessons[0].plan).toBe("Use perfect points.");
  });

  it("moves, duplicates and removes without losing content", () => {
    const moved = edit.moveLesson(a7Booklet, 0, 1);
    expect(moved.document.lessons.map((l) => l.code)).toEqual(["A7.03", "A7.01"]);
    const twice = edit.duplicateCard(a7Booklet, 1, 0, 0);
    expect(twice.document.lessons[1].sections[0].cards).toHaveLength(5);
    expect(edit.removeLesson(edit.removeLesson(a7Booklet, 0), 0).document.lessons).toHaveLength(1);
    const across = edit.moveCardAcross(a7Booklet, 1, 0, 3, 1);
    expect(across.document.lessons[1].sections[1].cards[0].title).toBe("Fill in the blanks");
  });
});
