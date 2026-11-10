import { valuePrintFacts } from "../../packages/value-graph-core/src/svg";
import { PRINT_INSTRUCTIONS } from "./placement";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import {
  metrics,
  renderSvg,
  contentHash,
  warnings,
  editorLink,
  type ValueEnvelope,
} from "../../packages/value-graph-core/src/interchange";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { ValueDownloads } from "./value-downloads";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import type { DownloadFormat } from "./downloads";
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
  return { result, artifacts };
}
