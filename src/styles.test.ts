import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("accessible control sizing", () => {
  it("uses Carbon-aligned productive button sizes and type", () => {
    expect(styles).toContain("--control-md: 40px");
    expect(styles).toContain("--control-lg: 48px");
    expect(styles).toContain("--button-label: 14px");
    expect(styles).toMatch(/\.tool-button, \.icon-button \{[^}]*min-height: var\(--control-lg\)[^}]*font-size: var\(--button-label\)/);
    expect(styles).toMatch(/\.visibility-button,[^}]*min-height: var\(--control-lg\)[^}]*font-size: var\(--button-label\)/);
  });

  it("keeps two-line scale buttons and graph controls clearly legible", () => {
    expect(styles).toMatch(/\.scale-options button \{[^}]*min-height: 64px/);
    expect(styles).toMatch(/\.scale-options button span \{[^}]*font-size: var\(--button-label\)/);
    expect(styles).toMatch(/\.axis-end-control text \{[^}]*24px/);
  });
});
