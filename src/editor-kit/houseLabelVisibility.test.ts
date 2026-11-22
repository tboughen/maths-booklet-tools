import { describe, expect, it } from "vitest";
import { houseVisibility, withHouseVisibility, type HouseLabel } from "./houseLabelVisibility";

const l = (state: HouseLabel["state"], text = "", answer = ""): HouseLabel => ({ state, text, answer });

describe("What pupils see for house label states", () => {
  it("reads five states as three", () => {
    expect([l("value", "62"), l("symbol", "x", "40")].map(houseVisibility)).toEqual(["show", "show"]);
    expect([l("hidden", "", "62"), l("answer-line"), l("blank", "", "62")].map(houseVisibility)).toEqual(["hidden", "hidden", "hidden"]);
    expect(houseVisibility(l("blank"))).toBe("omit");
  });

  it("moves a given size to the saved answer and back, losing nothing", () => {
    const space = withHouseVisibility(l("value", "2x + 10"), "hidden");
    expect(space).toEqual(l("hidden", "", "2x + 10"));
    expect(withHouseVisibility(space as HouseLabel, "show")).toEqual(l("value", "2x + 10"));
    expect(withHouseVisibility(l("answer-line", "", "8"), "omit")).toEqual(l("blank", "8"));
    expect(withHouseVisibility(l("blank", "8"), "show")).toEqual(l("value", "8"));
  });

  it("keeps a letter and its answer, and asks for text it does not have", () => {
    const space = withHouseVisibility(l("symbol", "x", "40"), "hidden") as HouseLabel;
    expect(space).toEqual(l("hidden", "x", "40"));
    expect(withHouseVisibility(space, "show")).toEqual(l("symbol", "x", "40"));
    expect(withHouseVisibility(l("blank"), "hidden")).toMatch(/Type the answer first/);
    expect(withHouseVisibility(l("blank"), "show")).toMatch(/Type the size/);
  });
});
