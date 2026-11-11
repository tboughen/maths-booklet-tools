import { ratioPrintFacts } from "../../packages/ratio-table-core/src/svg";
import { PRINT_INSTRUCTIONS } from "./placement";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import {
  ratioMetrics,
  renderRatioSvg,
  describeRatio,
  ratioWarnings,
  ratioHash,
  ratioEditorLink,
  RatioError,
} from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import type { DownloadFormat } from "./downloads";
import { RatioDownloads } from "./ratio-downloads";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";

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
    view: "pupil" | "answer" = "pupil",
  ) {
    if (format === "json")
      return {
        body: Buffer.from(JSON.stringify(envelope, null, 2)),
        type: "application/json",
      };
    const metrics = ratioMetrics(envelope.document),
      svg = renderRatioSvg(envelope.document, view);
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
  /** Files and preview for one copy: pupil (default) or answer, which prints hidden answers. */
  async function result(envelope: RatioEnvelope, signal: AbortSignal, view: "pupil" | "answer" = "pupil") {
    const metrics = ratioMetrics(envelope.document),
      hash = await ratioHash(envelope),
      description = describeRatio(envelope, view),
      warnings = ratioWarnings(envelope);
    const printFile = await artifacts(envelope, "png", signal, view);
    const width = Math.min(
        1200,
        Math.floor(Math.sqrt((2_000_000 * metrics.width) / metrics.height)),
      ),
      height = Math.round((width * metrics.height) / metrics.width);
    const preview = await raster.render(
      renderRatioSvg(envelope.document, view),
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
        links[format] = downloads.link(envelope, format, Date.now(), view);
      } catch (error) {
        if (!(error instanceof RatioError) || error.code !== "size_limit")
          throw error;
        const file =
          format === "png"
            ? printFile
            : await artifacts(envelope, format, signal, view);
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
        printGuidance: ratioPrintFacts(envelope.document),
        outputView: view,
        envelope,
        contentHash: hash,
        rendererVersion: envelope.rendererVersion,
        description,
        warnings,
        downloads: links,
        editorUrl,
        physicalSizeCm: { width: metrics.widthCm, height: metrics.heightCm },
        printRaster: printRasterSize(metrics.widthCm, metrics.heightCm),
        printDpi: 600 as const,
        printVerified: true as const,
      },
      content: [...content, { type: "text" as const, text: PRINT_INSTRUCTIONS }],
    };
  }
  return { result, artifacts };
}
