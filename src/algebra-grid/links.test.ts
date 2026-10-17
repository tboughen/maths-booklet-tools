import { expect, it } from "vitest";
import {
  example,
  canonical,
  setCell,
} from "../../packages/algebra-grid-core/src";
import { editorLink, parseLink } from "./links";
it("reopens exact Unicode, hidden answers and blanks, and guards link routes/length", () => {
  const e = setCell(example(), 1, 1, "x^2", true),
    url = editorLink(e, "https://mathsdock.co.uk/?tool=graph#old");
  expect(url).toContain("?tool=expanding-factorising#algebra-grid=");
  expect(canonical(parseLink(url))).toBe(canonical(e));
  expect(() =>
    parseLink(url.replace("tool=expanding-factorising", "tool=graph")),
  ).toThrow();
  expect(() => parseLink(url + "!")).toThrow();
  expect(() => parseLink(url + "a".repeat(16000))).toThrow();
});
