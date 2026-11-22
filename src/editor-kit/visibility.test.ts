import { describe, expect, it } from "vitest";
import { commonVisibility, togglePupilSpace, visibilityStep, visibilityWords } from "./visibility";

describe("what pupils see", () => {
  it("toggles a pupil space and back, and a left-out label becomes a pupil space", () => {
    expect(togglePupilSpace("show")).toBe("hidden");
    expect(togglePupilSpace("hidden")).toBe("show");
    expect(togglePupilSpace("omit")).toBe("hidden");
  });
  it("reports the state a group shares, or Mixed", () => {
    expect(commonVisibility([])).toBeNull();
    expect(commonVisibility(["hidden", "hidden"])).toBe("hidden");
    expect(commonVisibility(["show", "omit"])).toBe("mixed");
  });
  it("names undo steps and screen-reader states in teacher words", () => {
    expect(visibilityStep("hidden", "3/8")).toBe("pupil space on 3/8");
    expect(visibilityStep("omit", "3/8")).toBe("leave out 3/8");
    expect(visibilityStep("show", "all probabilities")).toBe("show all probabilities");
    expect([visibilityWords("show"), visibilityWords("hidden"), visibilityWords("omit")]).toEqual(["", "pupil space", "left out"]);
  });
});
