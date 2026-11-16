import { describe, expect, it } from "vitest";
import { searchHome } from "./homeSearch";

const names = (query: string) => searchHome(query).map((item) => item.name);

describe("Home search", () => {
  it("finds nothing until something is typed", () => {
    expect(searchHome("   ")).toEqual([]);
  });

  it("finds diagram tools by name and by teaching topic, and says which topic matched", () => {
    expect(names("venn")).toEqual(["Venn diagrams"]);
    const [triangles] = searchHome("pythagoras");
    expect(triangles).toMatchObject({ name: "Triangles", href: "/tools/triangle", note: "Diagram tool. Matches “Pythagoras”." });
  });

  it("finds the six pages by name or by what they do, before the tools", () => {
    expect(names("booklet")[0]).toBe("Booklet builder");
    expect(names("mark scheme")).toEqual(["Question bank", "Paper builder"]);
  });

  it("opens a Sparx code in the Question bank, however it is typed", () => {
    for (const typed of ["U332", "u332", " u 332 "])
      expect(searchHome(typed)[0]).toMatchObject({ name: "Sparx code U332", href: "/question-bank?code=U332" });
    expect(names("U33")).not.toContain("Sparx code U33");
  });

  it("finds nothing for words no page or tool has", () => {
    expect(searchHome("not-a-teaching-tool")).toEqual([]);
  });
});
