import { describe, expect, it } from "vitest";
import { layoutSample } from "../../packages/resource-core/src/layout-sample";
import { moveCard } from "./edit";

// Kept beside the website code: the service build type-checks packages/resource-core alone, so
// tests there must not import from src/.
describe("worksheet editor moves", () => {
  it("moves cards across columns on sides with fewer columns", () => {
    const moved = moveCard(layoutSample, 1, 0, 0, "next");
    expect(moved?.document.sides[1].columns[1].cards[0].title).toBe("Draw y = 3x − 2");
    const back = moveCard(layoutSample, 1, 0, 0, "previous");
    expect(back?.document.sides[0].columns[2].cards.at(-1)?.title).toBe("Draw y = 3x − 2");
    expect(moveCard(layoutSample, 1, 1, 0, "next")).toBeNull();
  });
});
