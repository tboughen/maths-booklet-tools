import { createHash } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GraphError, graphHash } from "../../packages/graph-core/src/interchange";
import { ratioHash } from "../../packages/ratio-table-core/src/interchange";
import { contentHash as valueHash } from "../../packages/value-graph-core/src/interchange";
import { hash as cuboidHash } from "../../packages/cuboid-core/src/interchange";
import { hash as lineHash } from "../../packages/number-line-core/src/index";
import { hash as vennHash } from "../../packages/venn-core/src/interchange";
import { hash as algebraHash } from "../../packages/algebra-grid-core/src/interchange";
import { diagramKind, diagramSource, diagramSourceSchema, prepareDiagram, type DiagramSource } from "./diagram-source";
import type { Artifact } from "./diagram-output-tools";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";

export const SVG_CHUNK_BYTES = 48 * 1024;
export const SVG_RESPONSE_BYTES = 256 * 1024;
export const SVG_FILE_BYTES = 10 * 1024 * 1024;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const svgDeliveryInput = diagramSourceSchema.extend({
  offsetBytes: z.number().int().min(0).max(SVG_FILE_BYTES).optional(),
  maxChunkBytes: z.number().int().min(1024).max(SVG_CHUNK_BYTES).optional(),
  expectedSvgSha256: digest.optional(),
}).strict();
export type SvgDeliveryInput = z.infer<typeof svgDeliveryInput>;
export const svgDeliveryOutput = z.object({
  kind: diagramKind, filename: z.literal("diagram.svg"),
  mimeType: z.literal("image/svg+xml"), encoding: z.literal("utf-8"),
  rendererVersion: z.string(), sourceContentHash: digest,
  physicalSizeCm: z.object({ width: z.number(), height: z.number() }).strict(),
  outputView: z.enum(["pupil", "answer"]).optional(),
  svgSha256: digest, totalBytes: z.number().int().positive().max(SVG_FILE_BYTES),
  offsetBytes: z.number().int().nonnegative(),
  chunkBytes: z.number().int().positive().max(SVG_CHUNK_BYTES),
  chunkSha256: digest, svgChunk: z.string().max(SVG_CHUNK_BYTES),
  nextOffsetBytes: z.number().int().positive().nullable(), complete: z.boolean(),
}).strict();
export type SvgDelivery = z.infer<typeof svgDeliveryOutput>;
export const svgSha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Pure byte transport. Production bytes come only from the existing renderer. */
export function sliceSvg(bytes: Buffer, offsetBytes = 0, maxChunkBytes = SVG_CHUNK_BYTES, expectedSvgSha256?: string) {
  if (!bytes.length || bytes.length > SVG_FILE_BYTES)
    throw new GraphError("size_limit", "SVG delivery requires a nonempty file of at most 10 MiB.");
  if (!isUtf8(bytes)) throw new GraphError("invalid_svg_encoding", "The SVG is not valid UTF-8.");
  if (!Number.isSafeInteger(offsetBytes) || offsetBytes < 0 || offsetBytes >= bytes.length ||
      (bytes[offsetBytes] & 0xc0) === 0x80 || !Number.isSafeInteger(maxChunkBytes) ||
      maxChunkBytes < 1024 || maxChunkBytes > SVG_CHUNK_BYTES)
    throw new GraphError("invalid_svg_range", "Use a valid UTF-8 byte boundary before EOF and maxChunkBytes from 1024 to 49152.");
  if (offsetBytes > 0 && !expectedSvgSha256)
    throw new GraphError("svg_hash_required", "Continuation requires expectedSvgSha256 from the first response.");
  const fullHash = svgSha256(bytes);
  if (expectedSvgSha256 !== undefined && expectedSvgSha256 !== fullHash)
    throw new GraphError("svg_hash_mismatch", "The SVG differs from the expected file. Keep the source and outputView unchanged; restart from byte zero after reviewing any renderer change.");
  let end = Math.min(bytes.length, offsetBytes + maxChunkBytes);
  while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
  const chunk = bytes.subarray(offsetBytes, end), complete = end === bytes.length;
  return { svgSha256: fullHash, totalBytes: bytes.length, offsetBytes,
    chunkBytes: chunk.length, chunkSha256: svgSha256(chunk), svgChunk: chunk.toString("utf8"),
    nextOffsetBytes: complete ? null : end, complete };
}

async function sourceHash(source: DiagramSource) {
  switch (source.kind) {
    case "graph": return graphHash(source.envelope);
    case "ratio-table": return ratioHash(source.envelope);
    case "value-graph": return valueHash(source.envelope);
    case "cuboids": return cuboidHash(source.envelope);
    case "number-line": return lineHash(source.envelope);
    case "venn": return vennHash(source.envelope);
    case "algebra-grid": return algebraHash(source.envelope);
  }
}

export function svgDeliveryResult(data: SvgDelivery) {
  // Compatibility text and structuredContent both count towards the transport cap.
  const result = { structuredContent: data, content: [{ type: "text" as const, text: JSON.stringify(data) }] };
  const responseBytes = Buffer.byteLength(JSON.stringify(result));
  if (responseBytes > SVG_RESPONSE_BYTES)
    throw new GraphError("size_limit", "The serialized response exceeds 256 KiB. Retry with a smaller maxChunkBytes.");
  return { result, responseBytes };
}

export function registerSvgDelivery(server: McpServer, connection: AbortSignal, raster: RasterQueue,
  limits: TrafficLimits, artifacts: (source: DiagramSource, format: "svg", signal?: AbortSignal) => Promise<Artifact>) {
  server.registerTool("get_diagram_svg", {
    description: "Retrieve original outlined SVG content through MCP when external SVG downloads are blocked. Supply kind graph/ratio-table/value-graph/cuboids/number-line/venn/algebra-grid and the exact returned envelope; no URL or baseHash. Venn outputView defaults pupil; answer must be explicitly requested. Does not revise or save a file. First call: omit offsetBytes; maxChunkBytes defaults to 49152 (1024..49152). Save decoded svgChunk as exact UTF-8 with no extra newline. For continuation use returned nextOffsetBytes and expectedSvgSha256:svgSha256, repeating source/outputView. Verify contiguous offsets, chunkBytes/chunkSha256, unchanged file metadata, then totalBytes/svgSha256 before embedding. sourceContentHash is the revision hash; svgSha256 is a different file checksum. complete means this is the last chunk, not that a client saved a file or printed a PDF. Do not redraw, normalize text, or substitute the preview. If exact saving fails, report the client limitation. Existing download links remain available.",
    inputSchema: svgDeliveryInput, outputSchema: svgDeliveryOutput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (input, extra) => {
    try {
      if ((input.offsetBytes ?? 0) > 0 && !input.expectedSvgSha256)
        throw new GraphError("svg_hash_required", "Continuation requires expectedSvgSha256 from the first response.");
      const source = diagramSource({ kind: input.kind, envelope: input.envelope, outputView: input.outputView });
      const signal = AbortSignal.any([connection, extra.signal]);
      const file = await artifacts(source, "svg", signal);
      if (file.type !== "image/svg+xml") throw new GraphError("invalid_svg_encoding", "The renderer did not return SVG.");
      const chunk = sliceSvg(file.body, input.offsetBytes, input.maxChunkBytes, input.expectedSvgSha256);
      const info = await prepareDiagram(source, raster, signal);
      const data: SvgDelivery = { kind: source.kind, filename: "diagram.svg", mimeType: "image/svg+xml", encoding: "utf-8",
        rendererVersion: source.envelope.rendererVersion, sourceContentHash: await sourceHash(source),
        physicalSizeCm: info.physicalSizeCm, ...(source.kind === "venn" ? { outputView: source.outputView ?? "pupil" } : {}), ...chunk };
      // Mirror the exact JSON for clients that do not expose structuredContent.
      const { result, responseBytes } = svgDeliveryResult(data);
      limits.output(responseBytes);
      return result;
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const,
        text: error instanceof GraphError ? `${error.code}: ${error.message}` : "The original SVG could not be delivered." }] };
    }
  });
}
