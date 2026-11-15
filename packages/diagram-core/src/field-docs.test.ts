// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS } from "./registry";
import { familyCapabilities } from "./guides";
import { SPEC_FIELD_DOCS } from "./field-docs";

type Field = { description?: string; minimum?: number; maximum?: number; minItems?: number; maxItems?: number };
const specOf = (kind: (typeof DIAGRAM_KINDS)[number]) =>
  (familyCapabilities(kind) as { specSchema: { properties?: Record<string, Field> } | null }).specSchema;

describe("spec field descriptions (M10)", () => {
  it("value-graph has no spec to describe", () => {
    expect(specOf("value-graph")).toBeNull();
    expect(SPEC_FIELD_DOCS["value-graph"]).toEqual({});
  });
  it.each([...DIAGRAM_KINDS].filter((k) => k !== "value-graph"))("%s: every top-level spec field says what it does", (kind) => {
    const fields = Object.entries(specOf(kind)?.properties ?? {});
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.filter(([, f]) => !f.description).map(([k]) => k)).toEqual([]);
    // No stale entries for fields the schema no longer has.
    expect(Object.keys(SPEC_FIELD_DOCS[kind]).filter((k) => !fields.some(([f]) => f === k))).toEqual([]);
  });
  it.each([...DIAGRAM_KINDS])("%s: ranges in the descriptions match the schema bounds", (kind) => {
    const fields = specOf(kind)?.properties ?? {};
    for (const [name, doc] of Object.entries(SPEC_FIELD_DOCS[kind])) {
      const f = fields[name];
      if (!f || f.description !== doc) continue;
      const range = doc.match(/\b(\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)\b/);
      // A number field's own range, or an item count when the description opens with it ("1 to 6 rows").
      const bounds = f.minimum !== undefined ? [f.minimum, f.maximum] : /^\d/.test(doc) && f.minItems !== undefined ? [f.minItems, f.maxItems] : null;
      if (range && bounds) expect(bounds, `${kind}.${name}`).toEqual([Number(range[1]), Number(range[2])]);
      const upTo = doc.match(/^Up to (\d+)/);
      if (upTo && f.maxItems !== undefined) expect(f.maxItems, `${kind}.${name}`).toBe(Number(upTo[1]));
    }
  });
});
