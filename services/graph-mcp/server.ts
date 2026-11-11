import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { MathsDockMcpServer, serverVersion } from "./tool-metadata";
import servicePackage from "./package.json" with { type: "json" };
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createEnvelope,
  documentFromEnvelope,
  describeGraph,
  editorLink,
  graphHash,
  GraphError,
  graphWarnings,
  MAX_REQUEST_BYTES,
  RENDERER_VERSION,
} from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import {
  getExportMetrics,
  renderDiagramSvg,
  graphPrintFacts,
} from "../../packages/graph-core/src/svg";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { Downloads } from "./downloads";
import type { DownloadFormat } from "./downloads";
import { RasterQueue } from "./raster";
import { TrafficLimits, clientAddress, type QuotaStore } from "./limits";
import { RatioDownloads } from "./ratio-downloads";
import { ratioTools } from "./ratio-table-tools";
import { ValueDownloads } from "./value-downloads";
import { valueGraphTools } from "./value-graph-tools";
import { WorksheetDownloads, worksheetTools } from "./worksheet-tools";
import type { DocumentStore } from "./document-store";
import { ResourceDownloads } from "./resource-downloads";
import { resourceTools, type NewSource } from "./resource-tools";
import { diagramTools, type ResultBuilder } from "./diagram-tools";
import type { DiagramKind } from "../../packages/diagram-core/src/registry";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import type { ValueEnvelope } from "../../packages/value-graph-core/src/schema";
import { BundleDownloads } from "./bundle-downloads";
import { diagramOutputTools } from "./diagram-output-tools";
import { PRINT_INSTRUCTIONS } from "./placement";
import { RatioError, RATIO_RENDERER_VERSION } from "../../packages/ratio-table-core/src/interchange";

/** What every client reads first; family detail lives in diagram_capabilities. */
export const SERVER_INSTRUCTIONS =
  "Create and revise MathsDock teaching diagrams and A3 worksheets. Diagram families: coordinate graphs, ratio tables, tables of values with quadratic graphs, cuboids, number lines, Venn diagrams, expanding/factorising grids, bar models, bar and line charts, probability trees and triangles. Call diagram_capabilities {kind} before the first create_diagram or revise_diagram of a family, and follow its createGuide, reviseGuide and schemas. Revise with the exact returned envelope and its contentHash as baseHash. Preserve pupil blanks, answer lines, hidden answers and zero as distinct states. Do not fill pupil answers, calculate, reveal answers or show worked solutions unless the user explicitly asks. Keep unchanged settings and objects on revisions. For a finalised two-sided A3 worksheet (the PRODUCE step) call create_worksheet with the whole document and report any layout issues it returns. Show the returned preview and real download or editor links; do not claim a file was saved until that succeeds. Explain warnings and unsupported requests. Do not silently redraw. Graphs: leave equationVisible false unless the user asks to show the equation. Bar models keep one shared unit width; labels never set widths. For horizontal fractions and 12 mm above/3 mm below handwriting space, request bar-model spec.schemaVersion 3. Do not use computer use to draw diagrams. If SVG download is blocked, get_diagram_svg returns the same SVG in checked chunks; follow its byte-count and checksum instructions.";
export interface ServiceOptions {
  buildId?: string;
  publicUrl: string;
  editorUrl: string;
  keys: Record<string, string>;
  activeKey: string;
  workerFile?: string;
  fontRoot?: string;
  /** Worksheet text fonts; defaults to assets/resource-fonts. */
  textFontRoot?: string;
  renderTimeoutMs?: number;
  dailyBytes?: number;
  /** Keeps the daily served-byte total across sleeps and restarts. */
  quotaStore?: QuotaStore;
  /** Keeps documents too large for a link (whole booklets). Defaults to memory. */
  documentStore?: DocumentStore;
  /** Rate-limit on the host edge's X-Forwarded-For address instead of the socket. */
  trustForwardedFor?: boolean;
  onQuotaStoreError?: (message: string) => void;
  log?: (entry: {
    requestId: string;
    status: number;
    durationMs: number;
    bytes: number;
  }) => void;
}
function validateBase(base: string) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw Error("Use HTTPS for a public service.");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("The service URL must be a clean origin.");
  return url;
}
export function graphService(options: ServiceOptions) {
  const base = validateBase(options.publicUrl);
  const editorBase = new URL(options.editorUrl);
  if (
    editorBase.username ||
    editorBase.password ||
    (editorBase.protocol !== "https:" &&
      !(
        editorBase.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(editorBase.hostname)
      ))
  )
    throw Error("Use an HTTPS or local loopback graph editor URL.");
  const downloads = new Downloads(base.href, options.keys, options.activeKey);
  const raster = new RasterQueue(
    options.workerFile ?? resolve("service-dist/raster-worker.js"),
    options.fontRoot ?? resolve("assets/graph-fonts"),
    options.renderTimeoutMs,
    options.textFontRoot ?? resolve("assets/resource-fonts"),
  );
  const limits = new TrafficLimits(options.dailyBytes, {
    store: options.quotaStore,
    onStoreError: options.onQuotaStoreError,
  });
  const ratioDownloads = new RatioDownloads(base.href, options.keys, options.activeKey);
  const ratios = ratioTools(raster, ratioDownloads, limits, options.editorUrl);
  const valueDownloads = new ValueDownloads(base.href, options.keys, options.activeKey);
  const values = valueGraphTools(raster, valueDownloads, limits, options.editorUrl);
  const resourceDownloads = new ResourceDownloads(base.href, options.keys, options.activeKey);
  const resources = resourceTools(raster, resourceDownloads, limits, options.editorUrl);
  const worksheetDownloads = new WorksheetDownloads(base.href, options.keys, options.activeKey, options.documentStore);
  const worksheets = worksheetTools(raster, worksheetDownloads, limits);
  const artifacts = async (
    envelope: GraphEnvelope,
    format: DownloadFormat,
    signal?: AbortSignal,
  ) => {
    const document = documentFromEnvelope(envelope),
      metrics = getExportMetrics(document),
      svg = renderDiagramSvg(document);
    if (format === "json")
      return {
        body: Buffer.from(JSON.stringify(envelope, null, 2)),
        type: "application/json",
      };
    const size =
      format === "svg"
        ? {
            width: 1200,
            height: Math.round((1200 * metrics.height) / metrics.width),
          }
        : printRasterSize(metrics.widthCm, metrics.heightCm);
    const rendered = await raster.render(
      svg,
      size.width,
      size.height,
      format === "png",
      format === "svg",
      signal,
    );
    return {
      body:
        format === "svg"
          ? Buffer.from(rendered.svg!)
          : Buffer.from(rendered.png!),
      type: format === "svg" ? "image/svg+xml" : "image/png",
    };
  };
  const bundles = new BundleDownloads(base.href, options.keys, options.activeKey);
  const diagramOutputs = diagramOutputTools(raster, bundles, limits, (source, format, signal) => {
    switch (source.kind) {
      case "graph": return artifacts(source.envelope, format, signal);
      case "ratio-table": return ratios.artifacts(source.envelope, format, signal, source.outputView);
      case "value-graph": return values.artifacts(source.envelope, format, signal);
      case "cuboids": case "number-line": case "venn": case "algebra-grid": case "bar-model": case "charts": case "probability-tree": case "triangle": return resources.artifacts(source, format, signal);
    }
  });
  const resource: ResultBuilder = (s, signal) => resources.result(s as NewSource, signal);
  const diagrams = diagramTools({
    graph: (s, signal) => result(s.envelope as GraphEnvelope, signal),
    "ratio-table": (s, signal) => ratios.result(s.envelope as RatioEnvelope, signal, "outputView" in s ? s.outputView : undefined),
    "value-graph": (s, signal) => values.result(s.envelope as ValueEnvelope, signal),
    cuboids: resource, "number-line": resource, venn: resource, "algebra-grid": resource,
    "bar-model": resource, charts: resource, "probability-tree": resource, triangle: resource,
  } satisfies Record<DiagramKind, ResultBuilder>);
  async function result(raw: GraphEnvelope, signal?: AbortSignal) {
    // Imported human graphs acquire the explicit portable profile on the server.
    const converted = raw.styleProfile !== "portable-v1";
    const envelope = converted
      ? createEnvelope({
          ...documentFromEnvelope(raw),
          styleProfile: "portable-v1",
        })
      : raw;
    const document = documentFromEnvelope(envelope),
      metrics = getExportMetrics(document);
    // Generate and independently verify the print artifact before advertising it.
    const printFile = await artifacts(envelope, "png", signal);
    const width = Math.min(
      1200,
      Math.floor(Math.sqrt((2_000_000 * metrics.width) / metrics.height)),
    );
    const height = Math.round((width * metrics.height) / metrics.width);
    const preview = await raster.render(
      renderDiagramSvg(document),
      width,
      height,
      false,
      false,
      signal,
    );
    const content: ContentBlock[] = [];
    const description = describeGraph(envelope),
      hash = await graphHash(envelope);
    const warnings = graphWarnings(envelope);
    if (converted)
      warnings.unshift(
        "The graph now uses the portable print font; mathematical values are unchanged.",
      );
    const links: Partial<
      Record<DownloadFormat, { url: string; expiresAt: string }>
    > = {};
    for (const format of ["svg", "png", "json"] as const) {
      try {
        links[format] = downloads.link(envelope, format);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit")
          throw error;
        const file =
          format === "png"
            ? printFile
            : await artifacts(envelope, format, signal);
        limits.output(file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `graph://${hash}/maths-graph.${format}`,
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
      editorUrl = editorLink(envelope, options.editorUrl);
    } catch {
      warnings.push(
        "The graph is too large for an editor link. Open its editable JSON file instead.",
      );
    }
    limits.output(preview.png!.byteLength);
    content.unshift(
      { type: "text", text: description },
      {
        type: "image",
        data: Buffer.from(preview.png!).toString("base64"),
        mimeType: "image/png",
      },
    );
    return {
      structuredContent: {
        printGuidance: graphPrintFacts(document),
        envelope,
        contentHash: hash,
        rendererVersion: RENDERER_VERSION,
        description,
        warnings,
        downloads: links,
        editorUrl,
        physicalSizeCm: { width: metrics.widthCm, height: metrics.heightCm },
        printRaster: printRasterSize(metrics.widthCm, metrics.heightCm),
        printDpi: 600,
        printVerified: true as const,
      },
      content: [...content, { type: "text" as const, text: PRINT_INSTRUCTIONS }],
    };
  }
  function mcp(connectionSignal: AbortSignal) {
    const server = new MathsDockMcpServer(
      { name: "Maths Booklet Tools", version: serverVersion(servicePackage.version, options.buildId) },
      {
        instructions: SERVER_INSTRUCTIONS,
      },
    );
    diagrams.register(server, connectionSignal);
    diagramOutputs.register(server, connectionSignal);
    worksheets.register(server, connectionSignal);
    return server;
  }
  const service = createServer({ maxHeaderSize: 16 * 1024 }, async (req, res) => {
    const started = Date.now(),
      requestId = randomUUID();
    let bytes = 0;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Request-ID", requestId);
    res.once("finish", () =>
      options.log?.({
        requestId,
        status: res.statusCode,
        durationMs: Date.now() - started,
        bytes,
      }),
    );
    const send = (status: number, value: unknown) => {
      const text = JSON.stringify(value);
      bytes = Buffer.byteLength(text);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(text);
    };
    try {
      if (req.headers.host !== base.host)
        throw new GraphError(
          "invalid_host",
          "Use the configured service hostname.",
        );
      if (req.headers.origin && req.headers.origin !== base.origin)
        throw new GraphError("invalid_origin", "This origin is not allowed.");
      if ((req.url?.length ?? 0) > 8192)
        throw new GraphError("size_limit", "The URL is too long.");
      const url = new URL(req.url ?? "/", base);
      if (req.method === "GET" && url.pathname === "/healthz") {
        send(200, {
          ok: true,
          rendererVersion: RENDERER_VERSION,
          ratioRendererVersion: RATIO_RENDERER_VERSION,
          valueGraphRendererVersion: "value-graph-1",
          cuboidRendererVersions: ["cuboids-1", "cuboids-2"],
          numberLineRendererVersion: "number-line-1",
          vennRendererVersions: ["venn-1", "venn-2"],
          barModelRendererVersion: "bar-model-1",
          barModelRendererVersions: ["bar-model-1","bar-model-2","bar-model-3"],
            algebraGridRendererVersion: "algebra-grid-1",
          chartRendererVersion: "charts-1",
          probabilityTreeRendererVersion: "probability-tree-1",
          triangleRendererVersions: ["triangle-1", "triangle-2"],
          buildId: options.buildId ?? "development",
        });
        return;
      }
      limits.request(clientAddress(req, options.trustForwardedFor ?? false));
      if (req.method === "GET" && url.pathname === "/resource/download") {
        const {source, format} = resourceDownloads.verify(url);
        if (source.kind !== "cuboids" && source.kind !== "number-line" && source.kind !== "venn" && source.kind !== "algebra-grid" && source.kind !== "bar-model" && source.kind !== "charts" && source.kind !== "probability-tree" && source.kind !== "triangle") throw new GraphError("invalid_download", "Use the original download route for this resource.");
        const abort = new AbortController();
        res.once("close", () => {if (!res.writableFinished) abort.abort();});
        const file = await resources.artifacts(source, format, abort.signal);
        limits.output(file.body.length); bytes = file.body.length;
        res.writeHead(200, {"Content-Type":file.type,"Content-Disposition":`attachment; filename="mathsdock-${source.kind}.${format}"`,"Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox"});
        res.end(file.body); return;
      }
      if (req.method === "GET" && url.pathname === "/worksheet/download") {
        const { resource, format, view, numbering } = await worksheetDownloads.verify(url);
        const abort = new AbortController();
        res.once("close", () => { if (!res.writableFinished) abort.abort(); });
        const file = await worksheets.artifacts(resource, format, view, abort.signal, numbering);
        limits.output(file.body.length); bytes = file.body.length;
        const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
        res.writeHead(200, { "Content-Type": file.type,
          "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "Content-Security-Policy": "default-src 'none'; sandbox" });
        res.end(file.body); return;
      }
      if (req.method === "GET" && url.pathname === "/diagram-bundle/download") {
        const source = bundles.verify(url);
        const abort = new AbortController();
        res.once("close", () => { if (!res.writableFinished) abort.abort(); });
        const file = await diagramOutputs.bundle(source, abort.signal);
        limits.output(file.body.length); bytes = file.body.length;
        res.writeHead(200, { "Content-Type": file.type,
          "Content-Disposition": 'attachment; filename="mathsdock-diagram.zip"',
          "Content-Security-Policy": "default-src 'none'; sandbox" });
        res.end(file.body); return;
      }
      if (req.method === "GET" && url.pathname === "/value-graph/download") {
        const { envelope, format } = valueDownloads.verify(url);
        const abort = new AbortController();
        res.once("close", () => { if (!res.writableFinished) abort.abort(); });
        const file = await values.artifacts(envelope, format, abort.signal);
        limits.output(file.body.length); bytes = file.body.length;
        res.writeHead(200, { "Content-Type": file.type,
          "Content-Disposition": `attachment; filename="mathsdock-values-and-graph.${format}"`,
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
        res.end(file.body); return;
      }
      if (req.method === "GET" && url.pathname === "/ratio-table/download") {
        const { envelope, format, view } = ratioDownloads.verify(url);
        const abort = new AbortController();
        res.once("close", () => { if (!res.writableFinished) abort.abort(); });
        const file = await ratios.artifacts(envelope, format, abort.signal, view);
        limits.output(file.body.length); bytes = file.body.length;
        res.writeHead(200, {
          "Content-Type": file.type,
          "Content-Disposition": `attachment; filename="maths-ratio-table${view === "answer" ? "-answers" : ""}.${format}"`,
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        });
        res.end(file.body); return;
      }
      if (req.method === "GET" && url.pathname === "/download") {
        const { envelope, format } = downloads.verify(url);
        const abort = new AbortController();
        res.once("close", () => {
          if (!res.writableFinished) abort.abort();
        });
        const file = await artifacts(envelope, format, abort.signal);
        limits.output(file.body.length);
        bytes = file.body.length;
        res.writeHead(200, {
          "Content-Type": file.type,
          "Content-Disposition": `attachment; filename="maths-graph.${format}"`,
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        });
        res.end(file.body);
        return;
      }
      if (url.pathname === "/mcp" && req.method === "POST") {
        const body = await readBody(req);
        if (Array.isArray(body))
          throw new GraphError(
            "invalid_graph",
            "Send one MCP message per request.",
          );
        const connection = new AbortController();
        req.once("aborted", () => connection.abort());
        const server = mcp(connection.signal),
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
            enableDnsRebindingProtection: true,
            allowedHosts: [base.host],
            allowedOrigins: [base.origin],
          });
        res.once("close", () => {
          if (!res.writableFinished) connection.abort();
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }
      if (url.pathname === "/mcp") {
        res.setHeader("Allow", "POST");
        send(405, { error: "method_not_allowed" });
        return;
      }
      send(404, { error: "not_found" });
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const code = error instanceof GraphError || error instanceof RatioError ? error.code : "invalid_request";
      const status =
        code === "rate_limited"
          ? 429
          : code === "busy"
            ? 503
            : code === "expired_download"
              ? 410
              : code === "render_timeout"
                ? 504
                : 400;
      if (status === 429) res.setHeader("Retry-After", "60");
      send(status, {
        error: code,
        message:
          error instanceof GraphError || error instanceof RatioError
            ? error.message
            : "The request could not be processed.",
      });
    }
  });
  /** Saves the daily served-byte total; call before the process exits. */
  return Object.assign(service, { flushQuota: () => limits.flush() });
}
/** One MCP message is at most 64 KiB, except a create_booklet call, which carries a whole unit
 * booklet and may be up to 512 KiB. Diagram families keep their own smaller limits inside. */
export const MAX_MCP_BODY_BYTES = 512 * 1024;
const LARGE_BODY_TOOLS = new Set(["create_booklet"]);
async function readBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new GraphError("invalid_request", "Use application/json.");
  let size = 0;
  const parts: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_MCP_BODY_BYTES)
      throw new GraphError("size_limit", "The request exceeds 512 KiB.");
    parts.push(Buffer.from(chunk));
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new GraphError("invalid_request", "The JSON request cannot be read.");
  }
  if (size > MAX_REQUEST_BYTES) {
    const m = body as { method?: unknown; params?: { name?: unknown } } | null;
    const large = m && typeof m === "object" && m.method === "tools/call" && typeof m.params?.name === "string" && LARGE_BODY_TOOLS.has(m.params.name);
    if (!large) throw new GraphError("size_limit", "The request exceeds 64 KiB.");
  }
  return body;
}
