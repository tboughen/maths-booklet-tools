// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DIAGRAM_KINDS } from "./registry";
import { familyCapabilities } from "./guides";
import { SPEC_FIELD_DOCS } from "./field-docs";

describe("spec field descriptions (M10)", () => {
  it.each([...DIAGRAM_KINDS])("%s: every top-level spec field says what it does", (kind) => {
    const spec = (familyCapabilities(kind) as { specSchema: { properties?: Record<string, { description?: string }> } | null }).specSchema;
    const fields = Object.entries(spec?.properties ?? {});
    expect(fields.filter(([, f]) => !f.description).map(([k]) => k)).toEqual([]);
    // No stale entries for fields the schema no longer has.
    expect(Object.keys(SPEC_FIELD_DOCS[kind]).filter((k) => !fields.some(([f]) => f === k))).toEqual([]);
  });
});
