// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS, FAMILIES } from "../../packages/diagram-core/src/registry";
import { diagramSource } from "./diagram-source";

describe("the connector reads a titled diagram (U34)", () => {
  it("accepts and keeps a title and note for every family", () => {
    for (const kind of DIAGRAM_KINDS) {
      const plain = FAMILIES[kind].create(kind === "graph" ? { spec: { objects: [] } } : {}) as Record<string, unknown>;
      const source = diagramSource({ kind, envelope: { ...plain, title: "Starter", note: "Lesson 3" } });
      expect(source.envelope, kind).toMatchObject({ title: "Starter", note: "Lesson 3" });
    }
  });
});
