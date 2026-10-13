import { expect, it } from "vitest";
import { headingFromText, headingText } from "./headingText";
import { DEFAULT_HEADINGS } from "../../packages/ratio-table-core/src/schema";

it("exposes default arrows as deletable Unicode and retains unchanged legacy headings", () => {
  expect(DEFAULT_HEADINGS.map(headingText)).toEqual(["x →", "y ↑"]);
  DEFAULT_HEADINGS.forEach((heading) =>
    expect(headingFromText(heading, headingText(heading))).toEqual(heading),
  );
  expect(headingFromText(DEFAULT_HEADINGS[0], "x")).toEqual({
    text: "x",
    italic: true,
    direction: "none",
  });
  expect(headingFromText(DEFAULT_HEADINGS[1], "y")).toEqual({
    text: "y",
    italic: true,
    direction: "none",
  });
  expect(headingFromText(DEFAULT_HEADINGS[0], "Mass↑")).toEqual({
    text: "Mass",
    italic: true,
    direction: "up",
  });
});
