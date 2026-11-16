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
  // A changed heading takes its italics from its text, as the compact form does: a word is upright.
  expect(headingFromText(DEFAULT_HEADINGS[0], "Mass↑")).toEqual({
    text: "Mass",
    italic: false,
    direction: "up",
  });
  expect(headingFromText(DEFAULT_HEADINGS[0], "x² →")).toEqual({ text: "x^2", italic: true, direction: "right" });
  expect(headingFromText({ text: "1/x", italic: true, direction: "none" }, "m/s")).toEqual({ text: "m/s", italic: false, direction: "none" });
});

it("prints % and £ headings upright even when the heading they replace was italic", () => {
  expect(headingFromText(DEFAULT_HEADINGS[0], "% →")).toEqual({ text: "%", italic: false, direction: "right" });
  expect(headingFromText(DEFAULT_HEADINGS[1], "£")).toEqual({ text: "£", italic: false, direction: "none" });
});
