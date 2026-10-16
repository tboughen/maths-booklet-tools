import { expect, it } from "vitest";
import { canonical, editLabel } from "../../packages/triangle-core/src";
import { example } from "../../packages/triangle-core/src/examples";
import { parseTriangleLink, triangleEditorLink } from "./links";
it("reopens complete UTF-8 triangle links including hidden answers", () => {
  const e = editLabel(example("missing-side"), "e:BC", { text: "θ" });
  const href = triangleEditorLink(e, "https://mathsdock.co.uk/?tool=graph#old");
  expect(href).toContain("?tool=triangle#triangle=");
  expect(canonical(parseTriangleLink(href))).toBe(canonical(e));
});
it("rejects wrong-tool, malformed and oversized links without truncating", () => {
  expect(() =>
    parseTriangleLink("https://mathsdock.co.uk/?tool=venn#triangle=x"),
  ).toThrow();
  expect(() =>
    parseTriangleLink("https://mathsdock.co.uk/?tool=triangle#triangle=%%"),
  ).toThrow();
  expect(() =>
    parseTriangleLink(
      "https://mathsdock.co.uk/?tool=triangle#triangle=" + "a".repeat(16000),
    ),
  ).toThrow();
});
