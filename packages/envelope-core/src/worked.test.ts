import { describe, expect, it } from "vitest";
import { noteBox, withWorked, workedIssues, wrapNote } from "./worked";

const art = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>`;

describe("worked notes (U116)", () => {
  it("wraps at word boundaries to the note's width", () => {
    const lines = wrapNote({ text: "Divide both sides by the same number, then check", x: 0, y: 0, widthMm: 30 });
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Divide both sides by the same number, then check");
  });

  it("draws text in user units of the artwork's viewBox, with no leader unless asked", () => {
    const svg = withWorked(art, [{ text: "Add 3", x: 10, y: 5 }]);
    expect(svg).toMatch(/<text x="20" y="[\d.]+">Add 3<\/text>/);
    expect(svg).not.toContain("<line");
    expect(svg.endsWith("</g></g></svg>")).toBe(true);
    expect(withWorked(art, [])).toBe(art);
  });

  it("draws one straight leader that starts clear of the note and ends at its point", () => {
    const svg = withWorked(art, [{ text: "Add 3", x: 10, y: 5, leader: { x: 80, y: 40 } }]);
    const line = svg.match(/<line x1="([\d.]+)" y1="([\d.]+)" x2="160" y2="80"\/>/);
    expect(line).not.toBeNull();
    const box = noteBox({ text: "Add 3", x: 10, y: 5 });
    expect(Number(line![1]) / 2).toBeGreaterThan(box.x + box.width);
  });

  it("names each problem a teacher must fix", () => {
    const size = { width: 100, height: 50 };
    expect(workedIssues([{ text: "Add 3", x: 95, y: 1 }], size)[0]).toMatch(/^Worked note 1 runs [\d.]+ mm past the right edge/);
    expect(workedIssues([{ text: "Add 3", x: 1, y: 49 }], size)[0]).toMatch(/below the bottom/);
    expect(workedIssues([{ text: "Add 3", x: 1, y: 1, leader: { x: 120, y: 1 } }], size)[0]).toMatch(/leader ends outside/);
    expect(workedIssues([{ text: "Add 3", x: 1, y: 1, leader: { x: 2, y: 2 } }], size)[0]).toMatch(/leader ends on the note/);
    expect(workedIssues([{ text: "Add 3", x: 1, y: 1 }, { text: "Then 4", x: 3, y: 2 }], size)).toEqual(["Worked note 2 overlaps worked note 1. Move one of them."]);
    expect(() => withWorked(art, [{ text: "Add 3", x: 95, y: 1 }])).toThrow(/Worked note 1/);
  });
});
