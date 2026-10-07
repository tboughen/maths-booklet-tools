import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import {
  createRatioTable,
  reviseRatioTable,
  ratioSpecSchema,
  ratioRevisionSchema,
  ratioEnvelopeSchema,
  ratioMetrics,
  renderRatioSvg,
  describeRatio,
  ratioWarnings,
  ratioHash,
  ratioEditorLink,
  RATIO_RENDERER_VERSION,
  RATIO_STYLE_PROFILE,
  RATIO_MAX_REQUEST_BYTES,
  RatioError,
  NUMBER_LIMITS,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import type { DownloadFormat } from "./downloads";
import { RatioDownloads } from "./ratio-downloads";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";

const link = z
  .object({ url: z.string().url(), expiresAt: z.string() })
  .strict();
export const ratioOutputSchema = z
  .object({
    envelope: ratioEnvelopeSchema,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    rendererVersion: z.literal(RATIO_RENDERER_VERSION),
    description: z.string(),
    warnings: z.array(z.string()),
    downloads: z
      .object({
        svg: link.optional(),
        png: link.optional(),
        json: link.optional(),
      })
      .strict(),
    editorUrl: z.string().url().nullable(),
    physicalSizeCm: z
      .object({ width: z.number(), height: z.number() })
      .strict(),
    printRaster: z
      .object({ width: z.number().int(), height: z.number().int() })
      .strict(),
    printDpi: z.literal(600),
    printVerified: z.literal(true),
  })
  .strict();
const ratioCapabilitiesSchema = z
  .object({
    rendererVersion: z.literal(RATIO_RENDERER_VERSION),
    styleProfile: z.literal(RATIO_STYLE_PROFILE),
    columns: z.literal(2),
    rows: z.object({ minimum: z.literal(2), maximum: z.literal(6) }),
    cellKinds: z.array(z.enum(["number", "empty", "answer-line"])),
    sizes: z.array(z.enum(["compact", "standard", "large"])),
    modes: z.array(z.enum(["simple", "annotated"])),
    printDpi: z.literal(600),
    maximumRequestBytes: z.literal(RATIO_MAX_REQUEST_BYTES),
    maximumRevisionOperations: z.literal(20),
    numberLimits: z
      .object({
        inputCharacters: z.number(),
        decimalPlaces: z.number(),
        numerator: z.number(),
        denominator: z.number(),
        absoluteValue: z.number(),
      })
      .strict(),
    revisionOperations: z.array(z.string()),
  })
  .strict();
export function ratioTools(
  raster: RasterQueue,
  downloads: RatioDownloads,
  limits: TrafficLimits,
  editorBase: string,
) {
  async function artifacts(
    envelope: RatioEnvelope,
    format: DownloadFormat,
    signal?: AbortSignal,
  ) {
    if (format === "json")
      return {
        body: Buffer.from(JSON.stringify(envelope, null, 2)),
        type: "application/json",
      };
    const metrics = ratioMetrics(envelope.document),
      svg = renderRatioSvg(envelope.document);
    const size =
      format === "svg"
        ? {
            width: 1200,
            height: Math.round((1200 * metrics.height) / metrics.width),
          }
        : printRasterSize(metrics.widthCm, metrics.heightCm);
    const result = await raster.render(
      svg,
      size.width,
      size.height,
      format === "png",
      format === "svg",
      signal,
      "ratio-table",
    );
    return {
      body:
        format === "svg" ? Buffer.from(result.svg!) : Buffer.from(result.png!),
      type: format === "svg" ? "image/svg+xml" : "image/png",
    };
  }
  async function result(envelope: RatioEnvelope, signal: AbortSignal) {
    const metrics = ratioMetrics(envelope.document),
      hash = await ratioHash(envelope),
      description = describeRatio(envelope),
      warnings = ratioWarnings(envelope);
    const printFile = await artifacts(envelope, "png", signal);
    const width = Math.min(
        1200,
        Math.floor(Math.sqrt((2_000_000 * metrics.width) / metrics.height)),
      ),
      height = Math.round((width * metrics.height) / metrics.width);
    const preview = await raster.render(
      renderRatioSvg(envelope.document),
      width,
      height,
      false,
      false,
      signal,
      "ratio-table",
    );
    const content: ContentBlock[] = [
      { type: "text", text: description },
      {
        type: "image",
        data: Buffer.from(preview.png!).toString("base64"),
        mimeType: "image/png",
      },
    ];
    const links: Partial<
      Record<DownloadFormat, { url: string; expiresAt: string }>
    > = {};
    for (const format of ["svg", "png", "json"] as const) {
      try {
        links[format] = downloads.link(envelope, format);
      } catch (error) {
        if (!(error instanceof RatioError) || error.code !== "size_limit")
          throw error;
        const file =
          format === "png"
            ? printFile
            : await artifacts(envelope, format, signal);
        limits.output(file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `ratio-table://${hash}/maths-ratio-table.${format}`,
            mimeType: file.type,
            ...(format === "png"
              ? { blob: file.body.toString("base64") }
              : { text: file.body.toString("utf8") }),
          },
        });
        warnings.push(
          `${format.toUpperCase()} is included as file content because its download link would be too long.`,
        );
      }
    }
    let editorUrl: string | null = null;
    try {
      editorUrl = ratioEditorLink(envelope, editorBase);
    } catch {
      warnings.push(
        "Open the editable JSON file instead of an editor link for this table.",
      );
    }
    limits.output(preview.png!.byteLength);
    return {
      structuredContent: {
        envelope,
        contentHash: hash,
        rendererVersion: RATIO_RENDERER_VERSION,
        description,
        warnings,
        downloads: links,
        editorUrl,
        physicalSizeCm: { width: metrics.widthCm, height: metrics.heightCm },
        printRaster: printRasterSize(metrics.widthCm, metrics.heightCm),
        printDpi: 600 as const,
        printVerified: true as const,
      },
      content,
    };
  }
  function register(server: McpServer, connectionSignal: AbortSignal) {
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
    const failure = (error: unknown) => ({
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            code:
              error instanceof RatioError || error instanceof GraphError
                ? error.code
                : "render_failed",
            message:
              error instanceof RatioError || error instanceof GraphError
                ? error.message
                : "The ratio table could not be rendered. Try again or simplify it.",
          }),
        },
      ],
    });
    server.registerTool(
      "ratio_table_capabilities",
      {
        description:
          "Read supported ratio-table cells, rows, sizes, limits and operations before creating a table. Lesson-style two-column diagrams with optional paired curved scaling arrows.",
        inputSchema: z.object({}).strict(),
        outputSchema: ratioCapabilitiesSchema,
        annotations,
      },
      async () => ({
        structuredContent: {
          rendererVersion: RATIO_RENDERER_VERSION,
          styleProfile: RATIO_STYLE_PROFILE,
          columns: 2 as const,
          rows: { minimum: 2 as const, maximum: 6 as const },
          cellKinds: ["number", "empty", "answer-line"] as Array<
            "number" | "empty" | "answer-line"
          >,
          sizes: ["compact", "standard", "large"] as Array<
            "compact" | "standard" | "large"
          >,
          modes: ["simple", "annotated"] as Array<"simple" | "annotated">,
          printDpi: 600 as const,
          maximumRequestBytes: RATIO_MAX_REQUEST_BYTES,
          maximumRevisionOperations: 20 as const,
          numberLimits: NUMBER_LIMITS,
          revisionOperations: [
            "set_cell",
            "add_row",
            "remove_row",
            "set_transition",
            "remove_transition",
            "set_headings",
            "set_size",
            "set_annotation_visibility",
            "fill_next_row",
          ],
        },
        content: [
          {
            type: "text",
            text: "Use number cells with string values (e.g. 2/3), empty cells or answer-line cells. Default headings x → and y ↑. Preserve pupil blanks; fill_next_row solves only when explicitly requested. Long values/headings must fit at the fixed lesson font size. SVG, verified 600 ppi PNG and editable JSON are available. Word exports are images.",
          },
        ],
      }),
    );
    server.registerTool(
      "create_ratio_table",
      {
        description:
          "Create a lesson-style two-column ratio table. Supply schemaVersion 1 and 2–6 rows with exactly two explicit cell states each: number with string value, empty, or answer-line. IDs are generated row-1, row-2, etc. Use explicit IDs for scaling transitions between adjacent rows. Preserve unanswered cells even if their answer is calculable. Set mode annotated to show paired curved arrows and factor labels; simple hides annotations. Use this renderer for ratio diagrams in booklets. Returns preview, PNG/SVG/JSON, contentHash and editable website link.",
        inputSchema: ratioSpecSchema,
        outputSchema: ratioOutputSchema,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            createRatioTable(args),
            AbortSignal.any([connectionSignal, extra.signal]),
          );
        } catch (error) {
          return failure(error);
        }
      },
    );
    server.registerTool(
      "revise_ratio_table",
      {
        description:
          "Revise the exact returned ratio-table envelope using its contentHash as baseHash. Operations are atomic. Use stable row IDs. Keep blank/answer-line cells unless the user explicitly asks to fill them. fill_next_row requires a chosen transition and both source values; overwriting existing values requires overwrite true. Empty operations refresh expired links. Preserve unchanged values/settings and show the returned image and links.",
        inputSchema: ratioRevisionSchema,
        outputSchema: ratioOutputSchema,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            await reviseRatioTable(args),
            AbortSignal.any([connectionSignal, extra.signal]),
          );
        } catch (error) {
          return failure(error);
        }
      },
    );
  }
  return { register, artifacts };
}
