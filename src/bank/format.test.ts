import { describe, expect, it } from "vitest";
import { formatCount } from "./format";

describe("formatCount (S91)", () => {
  it("adds en-GB thousands separators to bank counts", () => {
    expect(formatCount(2375)).toBe("2,375");
    expect(formatCount(20000)).toBe("20,000");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
  it("leaves small counts and zero unchanged", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1)).toBe("1");
    expect(formatCount(999)).toBe("999");
  });
});
