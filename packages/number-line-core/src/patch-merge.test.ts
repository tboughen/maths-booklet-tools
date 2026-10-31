import { describe, expect, it } from "vitest";
import { apply, create, operationSchema, specSchema } from "./index";

// Regression: under zod 4, `.partial()` kept field defaults, so a patch reset every key it omitted.
describe("number-line patches change only the keys they send", () => {
  const saved = () =>
    create({
      axis: { minimum: "0", maximum: "10", step: "1", labelEvery: 2, variable: "y", numberFormat: "fraction", variableBelow: true },
      teaching: { answer: "x > 3", prompt: "Show it", labels: { "0": "hidden", "4": "answer-line" }, solutionVisible: false, responseLines: 2 },
      widthCm: 16,
    });

  it("set_presentation keeps the answer, prompt and hidden labels", () => {
    const e = saved(), r = apply(e, [{ op: "set_presentation", teaching: { answerVisible: true } }]);
    expect(r.document.teaching).toEqual({ ...e.document.teaching, answerVisible: true });
    expect(r.document.axis).toEqual(e.document.axis);
  });

  it("set_axis keeps every axis setting it does not name", () => {
    const e = saved(), r = apply(e, [{ op: "set_axis", axis: { maximum: "12" } }]);
    expect(r.document.axis).toEqual({ ...e.document.axis, maximum: "12" });
    expect(r.document.teaching).toEqual(e.document.teaching);
  });

  it("parses patches without inventing omitted keys", () => {
    expect(operationSchema.parse({ op: "set_presentation", teaching: { answerVisible: true } })).toEqual({ op: "set_presentation", teaching: { answerVisible: true } });
    expect(operationSchema.parse({ op: "set_axis", axis: {} })).toEqual({ op: "set_axis", axis: {} });
    expect(specSchema.parse({ axis: { maximum: "6" }, teaching: { prompt: "p" } })).toEqual({ axis: { maximum: "6" }, teaching: { prompt: "p" } });
  });

  it("still fills document defaults when creating from a partial spec", () => {
    const e = create({ teaching: { prompt: "Show it" } });
    expect(e.document.teaching).toEqual({ solutionVisible: true, labels: {}, prompt: "Show it", answer: "", answerVisible: false, responseLines: 0 });
    expect(e.document.axis).toEqual({ minimum: "-5", maximum: "5", step: "1", labelEvery: 1, variable: "x", numberFormat: "decimal", variableBelow: false });
  });

  it("still rejects invalid and unknown patch keys", () => {
    expect(() => apply(saved(), [{ op: "set_presentation", teaching: { responseLines: 9 } }])).toThrow();
    expect(() => apply(saved(), [{ op: "set_presentation", teaching: { colour: "red" } }])).toThrow();
    expect(() => apply(saved(), [{ op: "set_axis", axis: { step: "0" } }])).toThrow();
  });
});
