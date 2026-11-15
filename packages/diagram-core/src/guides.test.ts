import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DIAGRAM_KINDS, FAMILIES, drawDiagram } from "./registry";
import { GUIDES, familyCapabilities, withFieldDocs } from "./guides";
import { SPEC_FIELD_DOCS } from "./field-docs";

/**
 * Replaces every {"$ref":"#/$defs/name"} with the shape it names, so the schema reads inline. A shape
 * that holds itself (a factor tree's nested numbers) is expanded once, and its inner reference reads
 * {"$ref":"recursive"}, whatever the shape is called.
 */
function resolve(schema: unknown, defs = (schema as { $defs?: Record<string, unknown> } | null)?.$defs ?? {}): unknown {
  const walk = (v: unknown, open: string[]): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, open));
    if (!v || typeof v !== "object") return v;
    const ref = (v as { $ref?: unknown }).$ref;
    if (typeof ref === "string") {
      const name = ref.replace(/^#\/\$defs\//, "");
      expect(defs, `${ref} is defined`).toHaveProperty([name]);
      const siblings = Object.fromEntries(Object.entries(v).filter(([k]) => k !== "$ref"));
      if (open.includes(name)) return { $ref: "recursive", ...(walk(siblings, open) as object) };
      return { ...(walk(defs[name], [...open, name]) as object), ...(walk(siblings, open) as object) };
    }
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "$defs").map(([k, x]) => [k, walk(x, open)]));
  };
  return walk(schema, []);
}
const inline = (schema: z.ZodType, field: string) => {
  const s = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as { properties?: Record<string, unknown>; $defs?: Record<string, unknown> };
  const shape = s.properties?.[field] ?? null;
  return shape && s.$defs ? resolve(shape, s.$defs) : shape;
};

describe("diagram_capabilities schemas (M1, M14)", () => {
  it.each([...DIAGRAM_KINDS])("%s: the shared-shape schemas say exactly what the inline ones say", (kind) => {
    const c = familyCapabilities(kind);
    // M10 adds each top-level field's short description on top of the core schema.
    expect(resolve(c.specSchema)).toEqual(withFieldDocs(inline(FAMILIES[kind].createSchema, "spec"), SPEC_FIELD_DOCS[kind]));
    expect(resolve(c.operationsSchema)).toEqual(inline(FAMILIES[kind].revisionSchema, "operations"));
  });
  it("names shared shapes after what they hold and keeps no unused ones", () => {
    for (const kind of DIAGRAM_KINDS)
      for (const key of ["specSchema", "operationsSchema"]) {
        const schema = familyCapabilities(kind)[key] as { $defs?: Record<string, unknown> } | null;
        const text = JSON.stringify(schema);
        for (const name of Object.keys(schema?.$defs ?? {})) {
          expect(name, `${kind}.${key}`).not.toMatch(/^__schema/);
          expect(text, `${kind}.${key} uses ${name}`).toContain(`"#/$defs/${name}"`);
        }
      }
  });
});

describe("ratio-table gradient guidance (Tim, 15 Nov 2026)", () => {
  const guide = GUIDES["ratio-table"].create;
  it("always heads a gradient table y ↑ with a negative movement, never y ↓", () => {
    expect(guide).toContain("Never use y ↓ for a gradient");
    expect(guide).not.toMatch(/y ↓ for a negative gradient/);
  });
  it("its compact example builds and prints the negative movement", () => {
    const match = guide.match(/Compact form[^{]*(\{columns:.*?\})\./);
    expect(match, "the guide has a compact-form example").not.toBeNull();
    const spec = JSON.parse(match![1].replace(/(\w+):\[/g, '"$1":['));
    expect(spec.columns).toEqual(["x →", "y ↑"]);
    const envelope = FAMILIES["ratio-table"].create({ spec });
    const answer = drawDiagram("ratio-table", envelope, "answer").svg;
    expect(answer).toContain("−4");
    expect(answer).toContain("−2");
  });
});
