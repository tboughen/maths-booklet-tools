import { describe, expect, it } from "vitest";
import { parseLineInput } from "./lineInput";

describe("bounded straight-line input", () => {
  it.each([
    ["y = 2x + 1", { kind: "slope", slope: 2, intercept: 1 }],
    ["y = −x − 3", { kind: "slope", slope: -1, intercept: -3 }],
    ["y = 1/2x - 2", { kind: "slope", slope: 0.5, intercept: -2 }],
    ["y = x", { kind: "slope", slope: 1, intercept: 0 }],
    ["y = +x", { kind: "slope", slope: 1, intercept: 0 }],
    ["y = 0", { kind: "slope", slope: 0, intercept: 0 }],
    ["y = -3/2", { kind: "slope", slope: 0, intercept: -1.5 }],
    ["x = -3", { kind: "vertical", x: -3 }],
    ["x = .25", { kind: "vertical", x: 0.25 }],
  ])("%s maps to an existing line model", (text, expected) =>
    expect(parseLineInput(text as string)).toEqual(expected),
  );
  it.each([
    "",
    "y=x^2",
    "y=sin(x)",
    "y<2x",
    "2x+3y=6",
    "y=2x+-1",
    "y=x+",
    "y=xjunk",
    "y=1/0x",
    "y=Infinity",
    "x=NaN",
    "y=x;x=2",
    "y=2xx",
    "y=1000001x",
    "alert(1)",
  ])("rejects the entire unsupported expression %s", (text) =>
    expect(() => parseLineInput(text)).toThrow(),
  );
  it("bounds the input before parsing", () =>
    expect(() => parseLineInput(" ".repeat(161))).toThrow("160"));
});
