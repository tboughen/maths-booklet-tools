import { describe, expect, it } from "vitest";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { validateBooklet } from "../../packages/resource-core/src/index";
import * as edit from "./edit";

describe("full editing of a booklet (stage 5)", () => {
  const b = validateBooklet(a7Booklet);
  it("adds a section of a kind after another, holding one new question, and the booklet stays valid", () => {
    const next = edit.addSectionAfter(b, 0, 0, "practice");
    expect(next.document.lessons[0].sections.length).toBe(b.document.lessons[0].sections.length + 1);
    expect(next.document.lessons[0].sections[1]).toMatchObject({ kind: "practice", cards: [{ title: "New question" }] });
    expect(() => validateBooklet(next)).not.toThrow();
  });
  it("inserts a question straight after another", () => {
    const next = edit.insertCardAfter(b, 0, 0, 0, edit.newCard());
    expect(next.document.lessons[0].sections[0].cards[1].title).toBe("New question");
    expect(next.document.lessons[0].sections[0].cards[2]).toEqual(b.document.lessons[0].sections[0].cards[1]);
  });
  it("adds, moves and removes items; the first item never sits beside anything and a card keeps one item", () => {
    const withTwo = edit.addItem(b, 0, 0, 0, { type: "answerLine", prefix: "", suffix: "", answer: "", inline: false, beside: true } as never);
    const items = withTwo.document.lessons[0].sections[0].cards[0].items;
    const moved = edit.moveItem(withTwo, 0, 0, 0, items.length - 1, 0).document.lessons[0].sections[0].cards[0].items;
    expect(moved[0]).toMatchObject({ type: "answerLine" });
    expect("beside" in moved[0]).toBe(false);
    let one = withTwo;
    while (one.document.lessons[0].sections[0].cards[0].items.length > 1) one = edit.removeItem(one, 0, 0, 0, 0);
    expect(edit.removeItem(one, 0, 0, 0, 0).document.lessons[0].sections[0].cards[0].items).toEqual(one.document.lessons[0].sections[0].cards[0].items);
    expect(() => validateBooklet(edit.moveItem(withTwo, 0, 0, 0, items.length - 1, 0))).not.toThrow();
  });
});
