import { describe, expect, it } from "vitest";
import { create, parseFile, starter } from "./index";

describe("starter triangle (U77)", () => {
  it("labels the sides a, b, c opposite A, B, C and leaves the angles blank", () => {
    const e = starter();
    const side = (p: string, q: string) =>
      e.document.edges.find(
        (v) => [v.from, v.to].sort().join("") === [p, q].sort().join(""),
      )!.label;
    expect(
      [side("B", "C"), side("A", "C"), side("A", "B")].map((l) => [
        l.text,
        l.state,
      ]),
    ).toEqual([
      ["a", "symbol"],
      ["b", "symbol"],
      ["c", "symbol"],
    ]);
    expect(e.document.angles.every((a) => a.label.state === "blank")).toBe(
      true,
    );
    expect(e.document.vertices).toEqual(create().document.vertices);
  });
  it("round-trips as an ordinary saved file", () => {
    const e = starter();
    expect(parseFile(JSON.stringify(e)).document).toEqual(e.document);
  });
});
