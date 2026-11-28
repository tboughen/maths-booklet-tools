import { describe, expect, it } from "vitest";
import { A4, MISCONCEPTION } from "../../../packages/resource-core/src/booklet-render";
import { BAND, bandText } from "./teacherNotes";

const MM = 72 / 25.4;
const page = { width: 595.28, height: 841.89 };
const at = (str: string, xmm: number, ymm: number) => ({ str, transform: [1, 0, 0, 1, xmm * MM, page.height - ymm * MM] });

describe("Present teacher notes", () => {
  it("reads the misconception band where the booklet renderer puts it", () => {
    expect(BAND.top).toBeCloseTo(MISCONCEPTION.top - 0.3);
    expect(BAND.bottom).toBeCloseTo(MISCONCEPTION.top + MISCONCEPTION.h + 0.3);
    expect(BAND.left).toBeCloseTo(A4.marginX - 0.3);
    expect(BAND.right).toBeCloseTo(A4.page.width - A4.marginX + 0.3);
  });
  it("splits the band into Watch for and Ask, leaving out the page number and the rest of the page", () => {
    const items = [at("Watch for", 15, 287), at("change in x ÷ change in y.", 32, 287), at("Page 5", 105, 290.5), at("Ask:", 120, 287), at("which way is the line going?", 128, 287), at("Q3 answer 2", 40, 100)];
    expect(bandText(items, page)).toEqual({ watch: "change in x ÷ change in y.", ask: "which way is the line going?" });
  });
  it("finds nothing on a footer without a misconception", () => {
    expect(bandText([at("Page 4", 105, 290.5), at("STOP", 20, 288)], page)).toEqual({});
  });
});
