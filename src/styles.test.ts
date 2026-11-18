import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");
// The Graph tool's settings are on the settings kit, which sets their sizes (32 px, 44 px for fingers; measured in
// e2e/settings-kit.spec.ts). What is left to pin here is how the tool lays its fields and choices out.
const graphSettings = readFileSync("src/graph-settings.css", "utf8");

describe("accessible control sizing", () => {
  it("uses Carbon-aligned productive button sizes and type", () => {
    expect(styles).toContain("--control-md: 40px");
    expect(styles).toContain("--control-lg: 48px");
    expect(styles).toContain("--button-label: 14px");
    expect(styles).toMatch(/\.tool-button, \.icon-button \{[^}]*min-height: var\(--control-lg\)[^}]*font-size: var\(--button-label\)/);
  });

  it("keeps two-line scale buttons and graph controls clearly legible", () => {
    expect(graphSettings).toMatch(/\.scale-options \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(graphSettings).toMatch(/\.scale-options button \{[^}]*display: grid/);
    expect(styles).toMatch(/\.axis-end-control text \{[^}]*24px/);
  });

  it("uses two equal columns for point coordinates", () => {
    expect(graphSettings).toMatch(/\.coordinate-fields--point \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
