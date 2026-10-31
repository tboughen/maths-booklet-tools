import { describe, expect, it } from "vitest";
import { canonical, create } from "../../packages/venn-core/src";
import { parseVennLink, vennEditorLink } from "./links";

describe("editable Venn links", () => {
  it("preserves Unicode, zero, pupil blanks and hidden saved answers exactly", () => {
    const e = create();
    e.document.labels[1].text = "Ω";
    e.document.regions[0] = {
      kind: "number",
      text: "0",
      visibility: "show",
      shade: "none",
    };
    e.document.regions[1] = {
      kind: "number",
      text: "3/4",
      visibility: "line",
      shade: "grey",
    };
    e.document.regions[3] = {
      kind: "members",
      text: "1,2,3",
      visibility: "hidden",
      shade: "none",
    };
    const before = canonical(e),
      url = vennEditorLink(e, "https://mathsdock.co.uk/?tool=graph#old");
    expect(new URL(url).pathname).toBe("/tools/venn");
    expect(new URL(url).search).toBe("");
    expect(canonical(parseVennLink(url))).toBe(before);
    // Links made before path addresses still open.
    const legacy = new URL(url);
    legacy.pathname = "/";
    legacy.search = "?tool=venn";
    expect(canonical(parseVennLink(legacy.href))).toBe(before);
    expect(canonical(e)).toBe(before);
  });
  it("rejects malformed, unsupported and excessive links without dropping data", () => {
    expect(() =>
      parseVennLink("https://mathsdock.co.uk/?tool=venn#venn=bad!"),
    ).toThrow(/supported/);
    expect(() =>
      parseVennLink("https://mathsdock.co.uk/?tool=graph#venn=abcd"),
    ).toThrow(/supported/);
    expect(() =>
      parseVennLink("https://mathsdock.co.uk/tools/graph#venn=abcd"),
    ).toThrow(/supported/);
    const unsupported =
      "https://mathsdock.co.uk/?tool=venn#venn=" +
      btoa(JSON.stringify({ tool: "venn", schemaVersion: 999 })).replace(
        /=+$/g,
        "",
      );
    expect(() => parseVennLink(unsupported)).toThrow(/could not be read/);
    const e = create();
    const before = canonical(e);
    // Links always point at the Venn page, so only a huge address can exceed the limit.
    const hugeHost = `https://${"a".repeat(60)}.`.padEnd(16_100, "b") + ".uk/";
    expect(() => vennEditorLink(e, hugeHost)).toThrow(/too large/);
    expect(canonical(e)).toBe(before);
  });
});
