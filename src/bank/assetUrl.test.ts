import { describe, expect, it } from "vitest";
import { resolveBankAssetUrl } from "./assetUrl";
describe("hosting asset URLs", () => {
  it("keeps catalogue, PDF worker support files and normal Pages assets on their site", () => {
    const origin = "https://assets.mathsdock.co.uk";
    expect(resolveBankAssetUrl("bank/catalogue.json", "/", origin)).toBe("/bank/catalogue.json");
    expect(resolveBankAssetUrl("bank/pdfjs/cmaps/", "/", origin)).toBe("/bank/pdfjs/cmaps/");
    expect(resolveBankAssetUrl("bank/assets/test.pdf", "/maths-booklet-tools/")).toBe("/maths-booklet-tools/bank/assets/test.pdf");
  });
  it("uses R2 for question PDFs and PNGs including paths with an initial slash", () => {
    expect(resolveBankAssetUrl("/bank/assets/sha256/test.png", "/", "https://assets.mathsdock.co.uk/")).toBe("https://assets.mathsdock.co.uk/bank/assets/sha256/test.png");
  });
});
