import { z } from "zod";

type Patch<T extends z.ZodRawShape> = z.ZodObject<{
  [K in keyof T]: z.ZodOptional<T[K] extends z.ZodDefault<infer I> ? I : T[K]>;
}>;

// A partial "patch" of an object schema that leaves omitted keys omitted.
//
// Under zod 4, `schema.partial()` keeps each field's `.default()`, so parsing a patch such as
// `{ answerVisible: true }` fills every other field with its default, and merging that over a
// saved document silently resets answers, prompts and hidden labels. This unwraps each top-level
// default so only the keys the caller sent survive parsing, and keeps the default as JSON Schema
// metadata so the advertised MCP schema is unchanged (src/gates/contracts.test.ts).
export function patchSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): Patch<T> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape) as [string, z.ZodType][]) {
    if (field instanceof z.ZodDefault) {
      const value = field.def.defaultValue;
      shape[key] = (field.unwrap() as z.ZodType).optional().meta({ default: value });
    } else shape[key] = field.optional();
  }
  return schema.extend(shape) as unknown as Patch<T>;
}
