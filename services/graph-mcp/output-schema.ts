import { z } from "zod";
import {
  envelopeSchema,
  axisSchema,
  RENDERER_VERSION,
} from "../../packages/graph-core/src/interchange";
const link = z.object({ url: z.string().url(), expiresAt: z.string() });
export const graphOutputSchema = z.object({
  envelope: envelopeSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  rendererVersion: z.literal(RENDERER_VERSION),
  description: z.string(),
  warnings: z.array(z.string()),
  downloads: z.object({
    svg: link.optional(),
    png: link.optional(),
    json: link.optional(),
  }),
  editorUrl: z.string().url().nullable(),
  physicalSizeCm: z.object({ width: z.number(), height: z.number() }),
  printRaster: z.object({ width: z.number().int(), height: z.number().int() }),
  printDpi: z.literal(600),
  printVerified: z.literal(true),
});
export const capabilitiesOutputSchema = z.object({
  rendererVersion: z.literal(RENDERER_VERSION),
  objects: z.array(z.enum(["point", "segment", "line"])),
  unitsPerSquare: z.array(z.number()),
  squares: z.object({ x: z.array(z.number()), y: z.array(z.number()) }),
  maximumObjects: z.literal(50),
  maximumRequestBytes: z.number(),
  printDpi: z.literal(600),
  defaultAxes: z.object({ x: axisSchema, y: axisSchema }),
  revisionOperations: z.array(z.string()),
});
