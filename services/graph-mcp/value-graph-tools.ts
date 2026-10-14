import { z } from "zod";
import { valuePrintFacts } from "../../packages/value-graph-core/src/svg";
import { printGuidanceSchema, PRINT_INSTRUCTIONS } from "./placement";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import {
  create,
  revise,
  metrics,
  renderSvg,
  contentHash,
  warnings,
  editorLink,
  envelopeSchema,
  revisionSchema,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { ValueDownloads } from "./value-downloads";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import type { DownloadFormat } from "./downloads";
const link = z
  .object({ url: z.string().url(), expiresAt: z.string() })
  .strict();
const output = z
  .object({
    envelope: envelopeSchema,
    contentHash: z.string(),
    rendererVersion: z.literal("value-graph-1"),
    warnings: z.array(z.string()),
    downloads: z
      .object({
        svg: link.optional(),
        png: link.optional(),
        json: link.optional(),
      })
      .strict(),
    editorUrl: z.string().url().nullable(),
    physicalSizeCm: z.object({ width: z.number(), height: z.number() }),
    printRaster: z.object({ width: z.number(), height: z.number() }),
    printDpi: z.literal(600),
    printVerified: z.literal(true),
    printGuidance: printGuidanceSchema.optional(),
  })
  .strict();
export function valueGraphTools(
  raster: RasterQueue,
  downloads: ValueDownloads,
  limits: TrafficLimits,
  editorBase: string,
) {
  async function artifacts(
    e: ValueEnvelope,
    format: DownloadFormat,
    signal?: AbortSignal,
  ) {
    if (format === "json")
      return {
        body: Buffer.from(JSON.stringify(e, null, 2)),
        type: "application/json",
      };
    const m = metrics(e),
      size =
        format === "svg"
          ? { width: 1200, height: Math.round((1200 * m.height) / m.width) }
          : printRasterSize(m.widthCm, m.heightCm);
    const result = await raster.render(
      renderSvg(e),
      size.width,
      size.height,
      format === "png",
      format === "svg",
      signal,
      "value-graph",
    );
    return {
      body:
        format === "svg" ? Buffer.from(result.svg!) : Buffer.from(result.png!),
      type: format === "svg" ? "image/svg+xml" : "image/png",
    };
  }
  async function result(e: ValueEnvelope, signal: AbortSignal) {
    const m = metrics(e),
      hash = await contentHash(e),
      print = await artifacts(e, "png", signal),
      notice = warnings(e);
    const width = Math.min(
        1200,
        Math.floor(Math.sqrt((2_000_000 * m.width) / m.height)),
      ),
      height = Math.round((width * m.height) / m.width);
    const preview = await raster.render(
      renderSvg(e),
      width,
      height,
      false,
      false,
      signal,
      "value-graph",
    );
    const content: ContentBlock[] = [
      {
        type: "text",
        text: "Editable table of values and quadratic graph. Unanswered cells are preserved.",
      },
      {
        type: "image",
        mimeType: "image/png",
        data: Buffer.from(preview.png!).toString("base64"),
      },
    ];
    const links: Partial<
      Record<DownloadFormat, { url: string; expiresAt: string }>
    > = {};
    for (const format of ["svg", "png", "json"] as const) {
      try {
        links[format] = downloads.link(e, format);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit")
          throw error;
        const file =
          format === "png" ? print : await artifacts(e, format, signal);
        limits.output(file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `value-graph://${hash}/values.${format}`,
            mimeType: file.type,
            ...(format === "png"
              ? { blob: file.body.toString("base64") }
              : { text: file.body.toString("utf8") }),
          },
        });
        notice.push(
          `${format.toUpperCase()} is included as file content because its download link is too long.`,
        );
      }
    }
    let editorUrl: string | null = null;
    try {
      editorUrl = editorLink(e, editorBase);
    } catch {
      notice.push(
        "Open the editable JSON rather than an editor link for this resource.",
      );
    }
    limits.output(preview.png!.byteLength);
    return {
      structuredContent: {
        printGuidance: valuePrintFacts(e),
        envelope: e,
        contentHash: hash,
        rendererVersion: "value-graph-1" as const,
        warnings: notice,
        downloads: links,
        editorUrl,
        physicalSizeCm: { width: m.widthCm, height: m.heightCm },
        printRaster: printRasterSize(m.widthCm, m.heightCm),
        printDpi: 600 as const,
        printVerified: true as const,
      },
      content: [...content, { type: "text" as const, text: PRINT_INSTRUCTIONS }],
    };
  }
  function register(server: McpServer, connection: AbortSignal) {
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
    server.registerTool(
      "value_graph_capabilities",
      {
        description:
          "Read table-of-values and quadratic graph limits, print style and supported operations. This is the tool for exam graph paper, partial tables, quadratic curves and deliberate straight-join errors.",
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              rendererVersion: "value-graph-1",
              columns: { minimum: 2, maximum: 13 },
              maximumPoints: 40,
              maximumRevisionOperations: 40,
              numberNotation:
                "Numeric strings: integers, decimals up to 6 places and fractions. Values are exact until explicit table-display rounding.",
              print: {
                dpi: 600,
                axisFontPt: 12,
                gridPitchMm: [2, 10, 20],
                gridStrokePt: [0.51, 1.02, 1.417],
                defaultXUnitsPerCm: "1/2",
                defaultYUnitsPerCm: "1",
              },
              cellKinds: ["value", "blank", "answer-line"],
              connections: ["none", "straight-joins"],
              operations: [
                "set_equation",
                "set_cell",
                "insert_column",
                "remove_column",
                "replace_columns",
                "calculate_cells",
                "set_graph",
                "plot_series",
                "put_series",
                "remove_series",
                "set_connection",
                "move_point",
                "set_curve",
                "set_reference_lines",
                "set_presentation",
                "set_print",
              ],
            }),
          },
        ],
      }),
    );
    server.registerTool(
      "create_value_graph",
      {
        description:
          "Create a table of values and exam grid. Omit envelope for the June 2018 scaffold with five blank y cells and no plotted work. Supply a full schemaVersion 1 / rendererVersion value-graph-1 / styleProfile exam-v1 envelope to customize. Numeric data are strings, including fractions. Columns have id,x,y:{kind:blank|answer-line} or y:{kind:value,value:string}. Preserve pupil blanks. A curve is an explicit graph.curves object with id,equation:{a,b,c},min,max; straight joins are a series.connection, never a quadratic curve. Returns real SVG/600 ppi PNG/JSON, hash and editable link.",
        inputSchema: z.object({ envelope: envelopeSchema.optional() }).strict(),
        outputSchema: output,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            create(args.envelope),
            AbortSignal.any([connection, extra.signal]),
          );
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: e instanceof Error ? e.message : "Invalid resource.",
              },
            ],
          };
        }
      },
    );
    server.registerTool(
      "revise_value_graph",
      {
        description:
          "Atomically revise the exact returned envelope with its contentHash as baseHash. All numeric values are strings; references use stable IDs, not indexes. Operations: set_equation {equation:{a,b,c}}; set_cell {columnId,x?,y?}; insert_column {afterId,column:{id,x,y}}; remove_column {columnId}; replace_columns {columns}; calculate_cells {columnIds,overwrite:boolean}; set_graph {settings}; plot_series {id,source:table|equation,columnIds,connection:none|straight-joins}; put_series {series:{id,source,points:[{id,x,y,columnId?}],connection}}; remove_series {id}; set_connection {id,connection}; move_point {seriesId,pointId,x,y,linked:update-table|detach}; set_curve {curve:null|{id,equation:{a,b,c},min,max}}; set_reference_lines {lines:[{id,y}]}; set_presentation {settings}; set_print {settings}. calculate_cells alone supplies answers and requires overwrite:true to replace existing values. Equation edits retain cells/plots. plot_series source:table skips blank cells and includes zero; source:equation explicitly calculates points without filling the table. Empty operations refresh links. Preserve returned envelope/hash after every revision.",
        inputSchema: revisionSchema,
        outputSchema: output,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            await revise(args),
            AbortSignal.any([connection, extra.signal]),
          );
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: e instanceof Error ? e.message : "Invalid revision.",
              },
            ],
          };
        }
      },
    );
  }
  return { register, artifacts };
}
