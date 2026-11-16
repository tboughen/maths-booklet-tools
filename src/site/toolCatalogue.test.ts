import { describe, expect, it } from "vitest";
import { catalogue, isNew, searchTool, strands } from "./toolCatalogue";
import { toolIds } from "./routes";

const tool = (id: (typeof toolIds)[number], name: string, description = "") => ({ id, name, description });

describe("Diagram builder catalogue", () => {
  it("puts every tool in a strand with at least two topics", () => {
    for (const id of toolIds) {
      expect(strands.map((s) => s.id)).toContain(catalogue[id].strand);
      expect(catalogue[id].topics.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("uses the scheme's four strands, with the graph tools under Algebra", () => {
    expect(strands.map((s) => s.name)).toEqual(["Number and proportion", "Algebra", "Geometry and measure", "Statistics and probability"]);
    expect(toolIds.filter((id) => catalogue[id].strand === "algebra")).toEqual(["expanding-factorising", "graph", "value-table-graph", "function-machine", "bubble-method", "algebra-tiles"]);
  });
  it("finds tools by teaching words and names the topic that matched", () => {
    expect(searchTool(tool("triangle", "Triangles"), "hypotenuse")).toEqual({ found: true, matched: "hypotenuse" });
    expect(searchTool(tool("construction", "Constructions and loci"), "bearings")).toEqual({ found: true, matched: "Bearings" });
    expect(searchTool(tool("triangle", "Triangles"), "triangles")).toEqual({ found: true, matched: "" });
    expect(searchTool(tool("venn", "Venn diagrams"), "pythagoras").found).toBe(false);
    expect(searchTool(tool("venn", "Venn diagrams"), "  ")).toEqual({ found: true, matched: "" });
    // A strand's name finds its tools, and the heading already says why.
    expect(searchTool(tool("graph", "Graph tool"), "algebra")).toEqual({ found: true, matched: "" });
    expect(searchTool(tool("venn", "Venn diagrams"), "algebra").found).toBe(false);
  });
  it("shows the New badge for 30 days after a tool is added", () => {
    expect(isNew("angles", new Date("2026-11-20"))).toBe(true);
    expect(isNew("angles", new Date("2026-12-20"))).toBe(false);
    expect(isNew("graph", new Date("2026-11-20"))).toBe(false);
  });
});
