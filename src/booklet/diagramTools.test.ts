import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES } from "../../packages/diagram-core/src/registry";
import { closeDiagramCopy, openDiagramCopy, readDiagramCopy, TOOL_STORAGE } from "./diagramTools";
import { a7Booklet } from "../../packages/resource-core/src/booklet-fixtures";
import { diagramEnvelope } from "../../packages/resource-core/src/schema";

const src = resolve(import.meta.dirname, "..");
const sources = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.|booklet[\\/]diagramTools/.test(f))
  .map((f) => readFileSync(join(src, f), "utf8"));

describe("diagram tools opened from a booklet card", () => {
  afterEach(() => localStorage.clear());

  it("knows where every diagram tool keeps its document", () => {
    for (const kind of DIAGRAM_KINDS) {
      const key = TOOL_STORAGE[kind];
      expect(sources.some((text) => text.includes(`"${key}"`)), `${kind}: ${key}`).toBe(true);
    }
  });

  it("opens a copy, reads back only a change, and checks it with the family", () => {
    const diagram = a7Booklet.document.lessons.flatMap((l) => l.sections.flatMap((s) => s.cards.flatMap((c) => c.items))).find((i) => i.type === "diagram");
    if (diagram?.type !== "diagram") throw Error("The example booklet has no diagram.");
    const envelope = diagramEnvelope(diagram.diagram);
    const copy = openDiagramCopy(diagram.diagram.tool, envelope);
    expect(copy.href).toMatch(new RegExp(`${FAMILIES[diagram.diagram.tool].route}\\?resourceCopy=[a-f0-9-]{36}&embed=booklet$`));
    expect(readDiagramCopy(copy)).toBeNull();
    localStorage.setItem(copy.key, JSON.stringify(envelope, null, 1));
    expect(readDiagramCopy(copy)).toEqual(envelope);
    localStorage.setItem(copy.key, JSON.stringify({ nonsense: true }));
    expect(() => readDiagramCopy(copy)).toThrow();
    closeDiagramCopy(copy);
    expect(localStorage.getItem(copy.key)).toBeNull();
    expect(() => readDiagramCopy(copy)).toThrow(/not found/);
  });

  it("keeps the bar model's storage record", () => {
    const envelope = FAMILIES["bar-model"].create({});
    const copy = openDiagramCopy("bar-model", envelope);
    expect(JSON.parse(localStorage.getItem(copy.key)!)).toEqual({ storageVersion: 1, envelope: JSON.parse(JSON.stringify(envelope)) });
    localStorage.setItem(copy.key, JSON.stringify({ storageVersion: 1, envelope: { ...JSON.parse(JSON.stringify(envelope)) }, extra: 1 }));
    expect(readDiagramCopy(copy)).toEqual(JSON.parse(JSON.stringify(envelope)));
  });
});
