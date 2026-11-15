import { describe, expect, it } from "vitest";
import { keepTogether, typesetText } from "./typeset";
import { wrap } from "./text";

const kept = (s: string) => keepTogether(typesetText(s)).replace(/\u00a0/g, "·");

describe("line breaks that read badly are prevented (Tim, A7 marking, 15 Nov 2026)", () => {
  it("never leaves a number or a short word alone on the last line", () => {
    expect(kept("What is the gradient of the line? It is 6")).toBe("What is the gradient of the line? It is·6");
    expect(kept("Find the value of the gradient, m.")).toBe("Find the value of the gradient,·*m*.");
    expect(kept("Plot the points and join them with a straight line")).toBe("Plot the points and join them with a straight line");
  });
  it("keeps ranges, units and short equations together", () => {
    expect(kept("for values of x from -1 to 1 inclusive")).toBe("for values of *x* from −1·to·1 inclusive");
    expect(kept("The side is 5 cm long")).toBe("The side is 5·cm long");
    expect(kept("Draw the graph of y = 2x + 1 on the grid")).toBe("Draw the graph of *y*·=·2*x*·+·1 on the grid");
  });
  it("never glues a run longer than 24 printed characters", () => {
    const long = kept("Show that 2x + 3x + 4x + 5x + 6x + 7x = 27x for every value");
    for (const run of long.split(" ")) expect(run.replace(/\*/g, "").length).toBeLessThanOrEqual(24);
  });
  it("moves the word before a short last word down with it, so the number is never alone", () => {
    const text = keepTogether(typesetText("Work out the gradient of the line that passes through both points. It is 6"));
    // Find a width that would leave "6" alone on its own line with ordinary spaces.
    const last = (lines: ReturnType<typeof wrap>) => lines[lines.length - 1].map((r) => r.text).join("");
    let w = 120;
    while (last(wrap(text.replace(/\u00a0/g, " "), 3.88, w, "regular", true)) !== "6" && w > 40) w -= 0.5;
    expect(last(wrap(text.replace(/\u00a0/g, " "), 3.88, w, "regular", true))).toBe("6");
    expect(last(wrap(text, 3.88, w, "regular", true))).toBe("is\u00a06");
  });
});
