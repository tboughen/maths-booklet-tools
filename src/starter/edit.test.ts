import { describe, expect, it } from "vitest";
import { validateStarterRun } from "../../packages/resource-core/src/index";
import { year8Run, year9Run } from "../../packages/resource-core/src/starter-fixtures";
import { addStarter, copySlotFromPrevious, copySlotToAll, moveStarter, removeStarter, setTemplate } from "./edit";

const nine = () => validateStarterRun(structuredClone(year9Run));
const ok = <T,>(x: T | string): T => {
  if (typeof x === "string") throw Error(x);
  return x;
};

describe("starter run editing", () => {
  it("copies one starter's question to every starter, leaving the other slots alone", () => {
    const run = nine();
    const next = validateStarterRun(copySlotToAll(run, 2, 0));
    for (const s of next.document.starters) expect(s.cards[0]).toEqual(run.document.starters[2].cards[0]);
    expect(next.document.starters[0].cards[1]).toEqual(run.document.starters[0].cards[1]);
    expect(run.document.starters[0].cards[0]).not.toEqual(run.document.starters[2].cards[0]);
  });

  it("copies the previous starter's question into this one, and not before starter 1", () => {
    const run = nine();
    expect(ok(copySlotFromPrevious(run, 3, 5)).document.starters[3].cards[5]).toEqual(run.document.starters[2].cards[5]);
    expect(copySlotFromPrevious(run, 0, 0)).toMatch(/no starter before/);
  });

  it("adds a copy after a starter up to six, removes down to one, and moves starters", () => {
    expect(addStarter(nine(), 0)).toMatch(/holds 6/);
    const eight = validateStarterRun(structuredClone(year8Run));
    const two = ok(addStarter(eight, 0));
    expect(two.document.starters).toHaveLength(2);
    expect(two.document.starters[1]).toEqual(two.document.starters[0]);
    expect(removeStarter(eight, 0)).toMatch(/at least one/);
    const run = nine();
    const moved = ok(moveStarter(run, 1, 1));
    expect(moved.document.starters[2]).toEqual(run.document.starters[1]);
    expect(moveStarter(run, 0, -1)).toMatch(/already/);
  });

  it("changes template keeping questions in order, adding empty questions or dropping the last slots", () => {
    const eight = validateStarterRun(structuredClone(year8Run));
    const six = validateStarterRun(setTemplate(eight, "six"));
    expect(six.document.slots).toHaveLength(6);
    expect(six.document.starters[0].cards.slice(0, 4)).toEqual(eight.document.starters[0].cards);
    expect(six.document.starters[0].cards[5]).toEqual({ title: "", items: [{ type: "space", kind: "working", heightMm: 8 }] });
    const four = validateStarterRun(setTemplate(nine(), "four"));
    expect(four.document.starters.every((s) => s.cards.length === 4)).toBe(true);
    expect(four.document.slots.map((s) => s.icon)).toEqual(["pencil", "talk", "book", "puzzle"]);
    expect(four.document.slots[0].name).toBe("Multiply fractions");
  });
});
