import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as galleries from "./galleryCatalogue";
import { barLessonGallery } from "./barLessonGallery";
import { exampleIndex, galleryTools, searchExamples, unshownGalleries } from "./galleryTools";

const all: Record<string, unknown> = { ...galleries, barLessonGallery };
const saved = JSON.parse(readFileSync(resolve(__dirname, "exampleIndex.json"), "utf8"));

describe("Diagram builder example index", () => {
  it("names the tool of every gallery", () => {
    const names = Object.entries(all).filter(([, value]) => Array.isArray(value)).map(([name]) => name);
    expect(names.filter((name) => !(name in galleryTools) && !unshownGalleries.includes(name))).toEqual([]);
  });
  it("matches the galleries (run node scripts/generate-example-previews.mjs after changing an example)", () => {
    expect(saved).toEqual(exampleIndex(all));
  });
  it("finds a triangular prism: plain shapes first, then the exam-style prism and the net", () => {
    const found = searchExamples(saved, "triangular prism");
    expect(found.slice(0, 2).map((e) => e.id)).toEqual(["solids-plain-triangular-prism", "solids-plain-roof-prism"]);
    expect(found.map((e) => e.id)).toEqual(expect.arrayContaining(["solids-triangular-prism", "nets-name-the-shape"]));
    expect(found.find((e) => e.id === "nets-name-the-shape")?.tool).toBe("nets");
  });
  it("puts plain shapes first only when their title matches", () => {
    // "triangle" is only in the plain prisms' descriptions, so the Triangles tool's titled examples lead.
    const found = searchExamples(saved, "triangle");
    expect(found[0].title.toLocaleLowerCase()).toContain("triangle");
    const prism = found.findIndex((e) => e.id === "solids-plain-triangular-prism");
    expect(found.slice(prism).every((e) => !e.title.toLocaleLowerCase().includes("triangle"))).toBe(true);
  });
  it("needs every word searched and ignores case", () => {
    expect(searchExamples(saved, "CYLINDER").some((e) => e.id === "solids-plain-cylinder")).toBe(true);
    expect(searchExamples(saved, "cylinder zebra")).toEqual([]);
    expect(searchExamples(saved, "  ")).toEqual([]);
  });
});
