import { describe, expect, it } from "vitest";
import { z } from "zod";
import { patchSchema } from "./patch-schema";
import * as algebra from "../../algebra-grid-core/src/interchange";
import * as barV1 from "../../bar-model-core/src/interchange";
import * as bar from "../../bar-model-core/src/versioned-interchange";
import * as cuboid from "../../cuboid-core/src/interchange";
import * as graph from "./interchange";
import * as numberLine from "../../number-line-core/src/index";
import * as ratio from "../../ratio-table-core/src/interchange";
import * as ratioSpec from "../../ratio-table-core/src/schema";
import * as valueGraph from "../../value-graph-core/src/schema";
import * as venn from "../../venn-core/src/interchange";

const sample = z.object({ a: z.string().default("x"), b: z.number().min(0).default(1), c: z.boolean().optional(), d: z.string() }).strict();

describe("patchSchema", () => {
  it("keeps omitted keys omitted and validates the keys that are sent", () => {
    expect(patchSchema(sample).parse({})).toEqual({});
    expect(patchSchema(sample).parse({ b: 2 })).toEqual({ b: 2 });
    expect(() => patchSchema(sample).parse({ b: -1 })).toThrow();
    expect(() => patchSchema(sample).parse({ e: 1 })).toThrow();
  });

  it("advertises the same JSON Schema as .partial()", () => {
    for (const io of ["input", "output"] as const)
      expect(z.toJSONSchema(patchSchema(sample), { io })).toEqual(z.toJSONSchema(sample.partial(), { io }));
  });
});

// Every optional field in an MCP create/revise input must stay absent when omitted. A ZodDefault
// inside a ZodOptional (what zod 4's `.partial()` produces) fills the default instead, so a patch
// silently overwrites saved values. Saved envelopes are skipped: their defaults are intended.
const inputs: Record<string, unknown> = {
  "algebra-grid create": algebra.createSchema, "algebra-grid revise": algebra.revisionSchema,
  "bar-model v1 create": barV1.createSchema, "bar-model v1 revise": barV1.revisionSchema,
  "bar-model create": bar.createSchema, "bar-model revise": bar.revisionSchema,
  "cuboid create": cuboid.createSchema, "cuboid revise": cuboid.revisionSchema,
  "graph spec": graph.graphSpecSchema, "graph revise": graph.revisionSchema,
  "number-line spec": numberLine.specSchema, "number-line revise": numberLine.revisionSchema,
  "ratio-table spec": ratioSpec.ratioSpecSchema, "ratio-table revise": ratio.ratioRevisionSchema,
  "value-graph revise": valueGraph.revisionSchema,
  "venn create": venn.createSchema, "venn revise": venn.revisionSchema,
};
type Def = { type: string; [key: string]: unknown };
function defaultedOptionals(schema: unknown, path: string, seen = new Set<unknown>()): string[] {
  const def = (schema as { def?: Def } | undefined)?.def;
  if (!def || seen.has(schema)) return [];
  seen.add(schema);
  if (def.type === "optional" && (def.innerType as { def?: Def }).def?.type === "default") return [path];
  if (def.type === "object")
    return Object.entries(def.shape as Record<string, unknown>).flatMap(([k, v]) => (k === "envelope" ? [] : defaultedOptionals(v, `${path}.${k}`, seen)));
  const children = ["innerType", "element", "in", "out", "valueType", "left", "right"].map(k => def[k]);
  for (const k of ["options", "items"]) if (Array.isArray(def[k])) children.push(...(def[k] as unknown[]));
  return children.flatMap(c => defaultedOptionals(c, path, seen));
}

describe("MCP patch inputs", () => {
  it.each(Object.entries(inputs))("%s never fills defaults for omitted optional keys", (_, schema) => {
    expect(defaultedOptionals(schema, "input")).toEqual([]);
  });
});
