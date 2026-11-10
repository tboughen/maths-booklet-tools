import { describe, expect, it } from "vitest";
import { bookletTools, readSection, siteSections } from "./registry";
import {
  linkOpensTool,
  pageHref,
  pathLink,
  readPage,
  toolIds,
  upgradeLegacyLink,
} from "./routes";

import { examples as vennExamples } from "../../packages/venn-core/src/examples";

const at = (href: string) => new URL(href, "https://mathsdock.co.uk");

describe("page addresses", () => {
  it("gives every page its own path and reads it back", () => {
    expect(toolIds).toEqual(bookletTools.map((tool) => tool.id));
    expect(pageHref("home")).toBe("/");
    expect(pageHref("booklet-tools")).toBe("/tools");
    expect(pageHref("venn")).toBe("/tools/venn");
    expect(pageHref("question-bank")).toBe("/question-bank");
    for (const id of [...toolIds, "home", "booklet-tools", "question-bank", "assessment-follow-up", "worksheets"] as const)
      expect(readPage(at(pageHref(id)))).toBe(id);
    expect(readPage(at("/tools/venn/"))).toBe("venn");
    expect(readPage(at("/index.html"))).toBe("home");
    expect(siteSections.map((section) => readSection(at(section.href)))).toEqual(
      siteSections.map((section) => section.id),
    );
  });

  it("shows the not-found page for unknown, mistyped and asset paths", () => {
    for (const path of ["/tools/nonsense", "/venn", "/tools/venn/extra", "/bank/assets/sha256/a.pdf", "/Tools/venn"])
      expect(readPage(at(path))).toBe("not-found");
  });

  it("gives Venn source links the address their old ?tool= form upgrades to", () => {
    for (const url of vennExamples.map((e) => e.url).filter((u): u is string => !!u)) {
      expect(url).toMatch(/^https:\/\/mathsdock\.co\.uk\/question-bank\?code=[^&]+&question=/);
      expect(upgradeLegacyLink(url.replace("/question-bank?", "/?tool=question-bank&"))).toBe(url);
    }
  });
  it("upgrades old ?tool= links, keeping their state", () => {
    expect(upgradeLegacyLink("https://mathsdock.co.uk/?tool=venn#venn=abc")).toBe(
      "https://mathsdock.co.uk/tools/venn#venn=abc",
    );
    expect(
      upgradeLegacyLink("https://mathsdock.co.uk/?tool=question-bank&code=U1&question=q1&resourceCopy=x"),
    ).toBe("https://mathsdock.co.uk/question-bank?code=U1&question=q1&resourceCopy=x");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/?tool=home")).toBe("https://mathsdock.co.uk/");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/?tool=")).toBe("https://mathsdock.co.uk/");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/?tool=booklet-tools")).toBe("https://mathsdock.co.uk/tools");
    const unknown = upgradeLegacyLink("https://mathsdock.co.uk/?tool=nonsense")!;
    expect(readPage(at(unknown))).toBe("not-found");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/tools/venn#venn=abc")).toBeNull();
    expect(pathLink("https://mathsdock.co.uk/tools/graph?tool=graph#graph=1")).toBe(
      "https://mathsdock.co.uk/tools/graph#graph=1",
    );
  });

  it("opens Worksheets at its own address, including from its old booklet tools address", () => {
    expect(pageHref("worksheets")).toBe("/worksheets");
    expect(readPage(at("/tools/worksheet"))).toBe("worksheets");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/tools/worksheet#x")).toBe("https://mathsdock.co.uk/worksheets#x");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/tools/worksheet/")).toBe("https://mathsdock.co.uk/worksheets");
    expect(upgradeLegacyLink("https://mathsdock.co.uk/?tool=worksheet")).toBe("https://mathsdock.co.uk/worksheets");
    expect(bookletTools.some((tool) => (tool.id as string) === "worksheet")).toBe(false);
  });

  it("recognises editor links in either form", () => {
    expect(linkOpensTool("https://mathsdock.co.uk/?tool=venn#venn=a", "venn")).toBe(true);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/venn#venn=a", "venn")).toBe(true);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/venn?tool=graph#venn=a", "venn")).toBe(false);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/graph#venn=a", "venn")).toBe(false);
  });
});
