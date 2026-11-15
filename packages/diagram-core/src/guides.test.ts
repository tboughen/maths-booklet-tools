import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DIAGRAM_KINDS, FAMILIES } from "./registry";
import { familyCapabilities } from "./guides";

/** Replaces every {"$ref":"#/$defs/name"} with the shape it names, so the schema reads inline. */
function resolve(schema: unknown): unknown {
  const root = schema as { $defs?: Record<string, unknown> } | null;
  const defs = root?.$defs ?? {};
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const ref = (v as { $ref?: unknown }).$ref;
    if (typeof ref === "string") {
      const name = ref.replace(/^#\/\$defs\//, "");
      expect(defs, `${ref} is defined`).toHaveProperty([name]);
      const siblings = Object.fromEntries(Object.entries(v).filter(([k]) => k !== "$ref"));
      return { ...(walk(defs[name]) as object), ...(walk(siblings) as object) };
    }
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "$defs").map(([k, x]) => [k, walk(x)]));
  };
  return walk(schema);
}
const inline = (schema: z.ZodType, field: string) => {
  const s = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as { properties?: Record<string, unknown> };
  return s.properties?.[field] ?? null;
};

describe("diagram_capabilities schemas (M1, M14)", () => {
  it.each([...DIAGRAM_KINDS])("%s: the shared-shape schemas say exactly what the inline ones say", (kind) => {
    const c = familyCapabilities(kind);
    expect(resolve(c.specSchema)).toEqual(inline(FAMILIES[kind].createSchema, "spec"));
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
