import { describe, expect, it } from "vitest";
import { validateBooklet, type Booklet } from "./booklet";
import { bookletGaps, GAP_LIMIT } from "./booklet-render";

// Booklet standard N21 (Tim, 22 November 2026): a page may leave at most GAP_LIMIT mm empty without a card.

const card = (title: string, h: number | null = 10, extra: Record<string, unknown> = {}) => ({
  title,
  items: [{ type: "text", text: "Work it out." }, ...(h === null ? [{ type: "answerLine", prefix: "Answer" }] : [{ type: "space", kind: "working", heightMm: h }])],
  ...extra,
});
const lesson = (sections: unknown[]): Booklet =>
  validateBooklet({
    tool: "resource",
    schemaVersion: 1,
    document: { kind: "booklet-a4", title: "Gaps", code: "T1", notation: "maths", lessons: [{ title: "Gaps", keyIdea: "", teacherNotes: "Notes.", sections }] },
  });

describe("empty space on booklet pages (N21)", () => {
  it("uses a 20 mm limit, shorter than any question row a lesson prints", () => {
    expect(GAP_LIMIT).toBe(20);
  });

  it("finds the empty foot of a page whose cards have no working space to grow", () => {
    const gaps = bookletGaps(lesson([{ kind: "practice", columns: 2, cards: [card("A", null), card("B", null)] }]));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ kind: "foot", lesson: 1 });
    expect(gaps[0].height).toBeGreaterThan(150);
    expect(gaps[0].message).toContain("empty below its last card");
  });

  it("counts spare height given to working space as used, so a page of working spaces passes", () => {
    const cards = Array.from({ length: 6 }, (_, i) => card(String(i + 1), 30));
    expect(bookletGaps(lesson([{ kind: "practice", columns: 2, cards }]))).toEqual([]);
  });

  it("finds a lone card with an empty half row beside it, and a wide card fixes it", () => {
    const three = [card("A", 30), card("B", 30), card("C", 30)];
    const lone = bookletGaps(lesson([{ kind: "practice", columns: 2, cards: three }]), {}, 20).filter((g) => g.kind === "beside");
    expect(lone).toHaveLength(1);
    expect(lone[0].message).toContain("stands alone");
    const wide = [card("A", 30), card("B", 30), card("C", 30, { wide: true })];
    expect(bookletGaps(lesson([{ kind: "practice", columns: 2, cards: wide }])).filter((g) => g.kind === "beside")).toEqual([]);
  });

  it("finds blank height inside a card that has no working space to take it", () => {
    const gaps = bookletGaps(lesson([{ kind: "practice", columns: 2, cards: [card("Tall", 120), card("Short", null)] }]));
    const inside = gaps.filter((g) => g.kind === "inside");
    expect(inside).toHaveLength(1);
    expect(inside[0].message).toContain("no working space to take it");
  });

  it("reports nothing at or under the limit", () => {
    const gaps = bookletGaps(lesson([{ kind: "practice", columns: 2, cards: [card("A", null), card("B", null)] }]), {}, 1000);
    expect(gaps).toEqual([]);
  });

  it("numbers pages as printed when the lesson is given a page offset", () => {
    const b = lesson([{ kind: "practice", columns: 2, cards: [card("A", null), card("B", null)] }]);
    const [plain] = bookletGaps(b);
    const [shifted] = bookletGaps(b, { numbering: { lessonOffset: 0, pageOffset: -1 } });
    expect(shifted.page).toBe(plain.page - 1);
  });
});
