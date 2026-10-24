import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { printRasterSize, verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { diagramSource, diagramSourceSchema, prepareDiagram, type DiagramSource, diagramKind } from "./diagram-source";
import { BundleDownloads } from "./bundle-downloads";
import { checkPlacement, placementInputSchema, placementOutputSchema, printGuidanceSchema, PRINT_INSTRUCTIONS } from "./placement";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import { ARCHIVE_NAMES } from "./archive";
import type { DownloadFormat } from "./downloads";
import { registerSvgDelivery } from "./svg-delivery";
export type Artifact = { body: Buffer; type: string };
type Artifacts = (source: DiagramSource, format: DownloadFormat, signal?: AbortSignal) => Promise<Artifact>;
export function diagramOutputTools(raster: RasterQueue, downloads: BundleDownloads, limits: TrafficLimits, artifacts: Artifacts) {
  function portable(source: DiagramSource) {
    if (source.kind === "graph" && source.envelope.styleProfile !== "portable-v1")
      throw new GraphError("unsupported_legacy_bundle", "This graph uses a legacy font profile. Use revise_graph with no operations for the explicit portable conversion, then bundle its returned envelope.");
    return source;
  }
  async function bundle(source: DiagramSource, signal?: AbortSignal): Promise<Artifact> {
    portable(source);
    const info = await prepareDiagram(source, raster, signal);
    const svg = await artifacts(source, "svg", signal), png = await artifacts(source, "png", signal);
    const size = printRasterSize(info.physicalSizeCm.width, info.physicalSizeCm.height);
    verifyPrintBytes(png.body, size.width, size.height);
    const route = source.kind === "algebra-grid" ? "expanding-factorising" : source.kind === "value-graph" ? "value-table-graph" : source.kind;
    const members = {
      "source.json": Buffer.from(JSON.stringify(source.envelope, null, 2)),
      "diagram.svg": svg.body, "diagram.png": png.body,
      "print-info.json": Buffer.from(JSON.stringify({ kind: source.kind, physicalSizeCm: info.physicalSizeCm, printGuidance: info.printGuidance, ...(source.kind === "venn" ? {outputView: source.outputView ?? "pupil"} : {}), printDpi: 600 }, null, 2)),
      "README.txt": Buffer.from(`MathsDock diagram files\n\n${PRINT_INSTRUCTIONS}\n\nNative size: ${info.physicalSizeCm.width} x ${info.physicalSizeCm.height} cm.\nSVG lettering is outlined; use source.json for mathematical edits.\nOpen source.json in https://mathsdock.co.uk/?tool=${route}\n${source.kind === "venn" ? `Artwork view: ${source.outputView ?? "pupil"}. source.json retains the saved pupil visibility and may contain hidden answers. Repeat outputView when regenerating answer artwork.\n` : ""}Blank cells and answer lines remain unfinished. Saving these files to a project is the consuming AI/user's action.\nTo obtain another download link, call download_diagram_bundle with the saved source envelope and kind '${source.kind}'. No server library is retained.\n`),
    };
    return { body: Buffer.from(await raster.pack(members, signal)), type: "application/zip" };
  }
  function register(server: McpServer, connectionSignal: AbortSignal) {
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    server.registerTool("check_diagram_placement", {
      description: "Calculate print consequences without editing. Supply kind graph/ratio-table/value-graph/cuboids/number-line/venn/algebra-grid/bar-model, the exact returned envelope, and positive widthMm and/or heightMm. One dimension derives the other; two define a box and report a proportional fit. Warnings describe reduction or stretching; no universal minimum or booklet fit is assumed. effectivePngDpi concerns PNG only. Venn outputView:pupil|answer selects artwork while retaining pupil source. No baseHash is needed. Use when considering a resize, not at every native-size placement.",
      inputSchema: placementInputSchema, outputSchema: placementOutputSchema, annotations,
    }, async (input, extra) => {
      try {
        const info = await prepareDiagram(diagramSource({kind: input.kind, envelope: input.envelope, outputView: input.outputView}), raster, AbortSignal.any([extra.signal, connectionSignal]));
        const result = checkPlacement(input, info);
        return { structuredContent: result, content: [{ type: "text", text: result.warnings.length ? result.warnings.map((w) => w.message).join("\n") : "Native proportions retained. Measurements describe this diagram only; no external document was inspected." }] };
      } catch (error) { return failure(error); }
    });
    server.registerTool("download_diagram_bundle", {
      description: "Optionally download one existing diagram as ZIP containing editable JSON, outlined SVG, verified 600 ppi PNG, print facts and README. Supply kind graph/ratio-table/value-graph/cuboids/number-line/venn/algebra-grid/bar-model and its returned envelope; no baseHash. Does not edit, save a library, or store a booklet. Links expire after seven days; repeat with saved source to refresh. The linked archive is generated on download, so verify retrieval before claiming success. Oversized links may use bounded inline ZIP; otherwise use individual files. Legacy graph fonts require explicit revise_graph conversion first.",
      inputSchema: diagramSourceSchema,
      outputSchema: z.object({
        kind: diagramKind,
        outputView: z.enum(["pupil", "answer"]).optional(),
        download: z.object({ url: z.string().url(), expiresAt: z.string() }).optional(),
        inline: z.boolean(), filenames: z.array(z.string()),
        physicalSizeCm: z.object({ width: z.number(), height: z.number() }), printGuidance: printGuidanceSchema,
      }).strict(), annotations,
    }, async (input, extra) => {
      try {
        const source = portable(diagramSource(input)), info = await prepareDiagram(source, raster, AbortSignal.any([extra.signal, connectionSignal]));
        let download: { url: string; expiresAt: string } | undefined;
        const content: ContentBlock[] = [];
        try { download = downloads.link(source); }
        catch (error) {
          if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
          const file = await bundle(source, AbortSignal.any([extra.signal, connectionSignal]));
          if (file.body.length > 1024 * 1024) throw new GraphError("bundle_unavailable", "The URL and inline ZIP exceed their limits. Use existing individual downloads or revise with no operations to refresh them.");
          // Include base64 transport overhead in the bounded response accounting.
          const blob = file.body.toString("base64");
          limits.output(Buffer.byteLength(blob));
          content.push({ type: "resource", resource: { uri: `mathsdock-bundle://inline/${randomUUID()}/diagram.zip`, mimeType: file.type, blob } });
        }
        content.unshift({ type: "text", text: download ? "ZIP link ready; archive bytes are generated and validated when downloaded. Retrieve it before claiming file success." : "ZIP is included as bounded file content; save it using the client. No server library was created." });
        return { structuredContent: { kind: source.kind, ...(source.kind === "venn" ? { outputView: source.outputView ?? "pupil" } : {}), download, inline: !download, filenames: ARCHIVE_NAMES, physicalSizeCm: info.physicalSizeCm, printGuidance: info.printGuidance }, content };
      } catch (error) { return failure(error); }
    });
  }
  const registerAll = (server: McpServer, connectionSignal: AbortSignal) => {
    register(server, connectionSignal);
    registerSvgDelivery(server, connectionSignal, raster, limits, artifacts);
  };
  return { register: registerAll, bundle };
}
function failure(error: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: error instanceof GraphError ? `${error.code}: ${error.message}` : "The diagram output request could not be processed." }] };
}
