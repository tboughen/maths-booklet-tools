import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import * as cuboid from "../../packages/cuboid-core/src/index";
import * as line from "../../packages/number-line-core/src/index";
import * as venn from "../../packages/venn-core/src/index";
import * as vi from "../../packages/venn-core/src/interchange";
import * as algebra from "../../packages/algebra-grid-core/src/index";
import * as ai from "../../packages/algebra-grid-core/src/interchange";
import * as bar from "../../packages/bar-model-core/src/versioned";
import * as bi from "../../packages/bar-model-core/src/versioned-interchange";
import * as chart from "../../packages/chart-core/src/index";
import * as chi from "../../packages/chart-core/src/interchange";
import * as tree from "../../packages/probability-tree-core/src/index";
import * as ftree from "../../packages/frequency-tree-core/src/index";
import * as triangle from "../../packages/triangle-core/src/index";
import * as tri from "../../packages/triangle-core/src/interchange";
import { renderPortableSvg } from "../../packages/venn-core/src/portable";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { FAMILIES } from "../../packages/diagram-core/src/registry";
import { prepareDiagram, type DiagramSource } from "./diagram-source";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import type { ResourceDownloads } from "./resource-downloads";
import type { DownloadFormat } from "./downloads";
import { PRINT_INSTRUCTIONS } from "./placement";

/** Families served by the shared /resource/download route and this result builder. */
export const RESOURCE_KINDS = ["cuboids", "number-line", "venn", "algebra-grid", "bar-model", "charts", "probability-tree", "frequency-tree", "triangle"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];
export type NewSource = Extract<DiagramSource, { kind: ResourceKind }>;
export const isResourceSource = (source: DiagramSource): source is NewSource =>
  (RESOURCE_KINDS as readonly string[]).includes(source.kind);

const viewOf = (source: NewSource) => ("outputView" in source ? source.outputView : undefined) ?? "pupil";

function warningsOf(source: NewSource): string[] {
  switch (source.kind) {
    case "triangle": return triangle.warnings(source.envelope);
    case "probability-tree": return tree.warnings(source.envelope);
    case "frequency-tree": return ftree.warnings(source.envelope);
    case "charts": return [...chart.layout(source.envelope).notes];
    case "bar-model": return bar.warnings(source.envelope);
    case "algebra-grid": return algebra.warnings(source.envelope);
    case "cuboids": return source.envelope.document.shapes.flatMap((s) => cuboid.warnings(s));
    case "number-line": return line.warnings(source.envelope);
    case "venn": return venn.warnings(source.envelope);
  }
}
function editorLinkOf(source: NewSource, base: string): string | null {
  switch (source.kind) {
    case "triangle": return tri.editorLink(source.envelope, base);
    case "probability-tree": return tree.editorLink(source.envelope, base);
    case "frequency-tree": return ftree.editorLink(source.envelope, base);
    case "charts": return chi.editorLink(source.envelope, base);
    case "bar-model": try { return bi.editorLink(source.envelope, base); } catch { return null; }
    case "algebra-grid": return ai.editorLink(source.envelope, base);
    case "cuboids": return cuboid.editorLink(source.envelope, base);
    case "number-line": return line.editorLink(source.envelope, base);
    case "venn": return vi.editorLink(source.envelope, base);
  }
}
/** Longest editor link a chat client handles reliably for each family's link format. */
const editorLimit = (source: NewSource) =>
  source.kind === "venn" || source.kind === "triangle" || source.kind === "charts" || source.kind === "probability-tree" || source.kind === "frequency-tree" || (source.kind === "bar-model" && source.envelope.schemaVersion === 2) ? 16_000 : 7500;
/** Families whose editable files can hold answers hidden from the pupil artwork. */
const HIDDEN_ANSWER_KINDS: readonly ResourceKind[] = ["venn", "algebra-grid", "bar-model", "charts", "probability-tree", "frequency-tree", "triangle"];

export function resourceTools(
  raster: RasterQueue,
  downloads: ResourceDownloads,
  limits: TrafficLimits,
  editorBase: string,
) {
  /** The artwork for the requested view; cuboids use the measured crop, Venn SVG files outline text. */
  function artwork(source: NewSource, info: Awaited<ReturnType<typeof prepareDiagram>>, format: DownloadFormat | "preview") {
    if (source.kind === "cuboids") return info.crop!.svg;
    if (source.kind === "venn" && format === "svg") return renderPortableSvg(venn.forView(source.envelope, viewOf(source)));
    return FAMILIES[source.kind].svg(source.envelope, viewOf(source));
  }
  async function artifacts(source: NewSource, format: DownloadFormat, signal?: AbortSignal) {
    if (format === "json")
      return { body: Buffer.from(JSON.stringify(source.envelope, null, 2)), type: "application/json" };
    const info = await prepareDiagram(source, raster, signal);
    const { width: w, height: h } = info.physicalSizeCm;
    const size = format === "png" ? printRasterSize(w, h) : { width: 1200, height: Math.max(1, Math.round((1200 * h) / w)) };
    const r = await raster.render(artwork(source, info, format), size.width, size.height, format === "png", format === "svg", signal, source.kind);
    return { body: Buffer.from(format === "svg" ? r.svg! : r.png!), type: format === "svg" ? "image/svg+xml" : "image/png" };
  }
  async function result(source: NewSource, signal: AbortSignal) {
    const info = await prepareDiagram(source, raster, signal);
    const print = await artifacts(source, "png", signal);
    const { width: w, height: h } = info.physicalSizeCm;
    const width = Math.min(1200, Math.floor(Math.sqrt((2_000_000 * w) / h))),
      height = Math.max(1, Math.round((width * h) / w));
    const preview = await raster.render(artwork(source, info, "preview"), width, height, false, false, signal, source.kind);
    const hash = await FAMILIES[source.kind].hash(source.envelope);
    const warnings = warningsOf(source);
    const content: ContentBlock[] = [{ type: "image", mimeType: "image/png", data: Buffer.from(preview.png!).toString("base64") }];
    const links: Partial<Record<DownloadFormat, { url: string; expiresAt: string }>> = {};
    for (const format of ["svg", "png", "json"] as const) {
      try {
        links[format] = downloads.link(source, format);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
        const file = format === "png" ? print : await artifacts(source, format, signal);
        const blob = format === "png" ? file.body.toString("base64") : undefined;
        limits.output(blob ? Buffer.byteLength(blob) : file.body.length);
        content.push({
          type: "resource",
          resource: { uri: `mathsdock-${source.kind}://${hash}/source.${format}`, mimeType: file.type, ...(blob ? { blob } : { text: file.body.toString("utf8") }) },
        });
        warnings.push(`${format.toUpperCase()} is included as file content because its link is too long.`);
      }
    }
    let editorUrl = editorLinkOf(source, editorBase);
    if (editorUrl && editorUrl.length > editorLimit(source)) editorUrl = null;
    if (!editorUrl) warnings.push("Open the editable JSON file rather than an editor link for this resource.");
    if (HIDDEN_ANSWER_KINDS.includes(source.kind))
      warnings.push("Editable JSON and editor links retain the pupil document and may contain hidden answers.");
    limits.output(preview.png!.byteLength);
    return {
      structuredContent: {
        envelope: source.envelope,
        contentHash: hash,
        rendererVersion: source.envelope.rendererVersion,
        warnings,
        downloads: links,
        editorUrl,
        physicalSizeCm: info.physicalSizeCm,
        printGuidance: info.printGuidance,
        printRaster: printRasterSize(w, h),
        printDpi: 600 as const,
        printVerified: true as const,
        ...(FAMILIES[source.kind].answerView ? { outputView: viewOf(source) } : {}),
        ...(source.kind === "triangle" ? { calculationContexts: tri.contexts(source.envelope) } : {}),
        ...(source.kind === "venn" ? { activeRegions: venn.activeMasks(source.envelope) } : {}),
      },
      content: [...content, { type: "text" as const, text: PRINT_INSTRUCTIONS }],
    };
  }
  return { result, artifacts };
}
