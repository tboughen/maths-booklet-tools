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

const at = (href: string) => new URL(href, "https://mathsdock.co.uk");

describe("page addresses", () => {
  it("gives every page its own path and reads it back", () => {
    expect(toolIds).toEqual(bookletTools.map((tool) => tool.id));
    expect(pageHref("home")).toBe("/");
    expect(pageHref("booklet-tools")).toBe("/tools");
    expect(pageHref("venn")).toBe("/tools/venn");
    expect(pageHref("question-bank")).toBe("/question-bank");
    for (const id of [...toolIds, "home", "booklet-tools", "question-bank", "assessment-follow-up"] as const)
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

  it("recognises editor links in either form", () => {
    expect(linkOpensTool("https://mathsdock.co.uk/?tool=venn#venn=a", "venn")).toBe(true);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/venn#venn=a", "venn")).toBe(true);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/venn?tool=graph#venn=a", "venn")).toBe(false);
    expect(linkOpensTool("https://mathsdock.co.uk/tools/graph#venn=a", "venn")).toBe(false);
  });
});
