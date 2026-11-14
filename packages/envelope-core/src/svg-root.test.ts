import { describe, expect, it } from "vitest";
import { tidySvgRoot } from "./svg-root";

describe("tidySvgRoot (U38)", () => {
  it("rounds root width, height and viewBox to four decimals", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="5.515280000000001cm" height="6.174569018181818cm" viewBox="0 0 551.528 61.745690181818176" role="img"><rect width="1.23456789"/></svg>';
    expect(tidySvgRoot(svg)).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="5.5153cm" height="6.1746cm" viewBox="0 0 551.528 61.7457" role="img"><rect width="1.23456789"/></svg>');
  });
  it("keeps tidy numbers, units, negatives and the rest of the file", () => {
    const svg = '<?xml version="1.0"?><svg width="120mm" height="80mm" viewBox="-5 -2.5 120 80"><text>0.123456</text></svg>';
    expect(tidySvgRoot(svg)).toBe(svg);
  });
});
