import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  createGraph,
  createEnvelope,
  documentFromEnvelope,
  describeGraph,
  editorLink,
  graphHash,
  graphSpecSchema,
  GraphError,
  graphWarnings,
  MAX_REQUEST_BYTES,
  RENDERER_VERSION,
  reviseGraph,
  revisionSchema,
} from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import {
  getExportMetrics,
  renderDiagramSvg,
} from "../../packages/graph-core/src/svg";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import { Downloads } from "./downloads";
import type { DownloadFormat } from "./downloads";
import { RasterQueue } from "./raster";
import { TrafficLimits } from "./limits";
import { graphOutputSchema, capabilitiesOutputSchema } from "./output-schema";

export interface ServiceOptions {
  buildId?: string;
  publicUrl: string;
  editorUrl: string;
  keys: Record<string, string>;
  activeKey: string;
  workerFile?: string;
  fontRoot?: string;
  renderTimeoutMs?: number;
  dailyBytes?: number;
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
  );
  const limits = new TrafficLimits(options.dailyBytes);
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
      content,
    };
  }
  function mcp(connectionSignal: AbortSignal) {
    const server = new McpServer(
      { name: "Maths Booklet Tools", version: "1.0.0" },
      {
        instructions:
          "Create and revise coordinate graphs with these tools. Use returned envelopes and contentHash for revisions. Do not use computer use. Supported objects are points, segments and straight lines only. For new graphs, leave equationVisible false unless the user explicitly asks to print, show or label the equation on the diagram. Asking to plot an equation does not request its label. On revisions retain label visibility unless the user asks to change it. Always retain axis settings and unchanged objects. Show the image, download links and editor link returned by the tool. Do not claim print PNG succeeded until its download succeeds. Explain warnings and unsupported requests.",
      },
    );
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
    server.registerTool(
      "graph_capabilities",
      {
        description:
          "Read supported graph objects, axes, limits and rendering version before choosing settings.",
        inputSchema: z.object({}).strict(),
        outputSchema: capabilitiesOutputSchema,
        annotations,
      },
      async () => ({
        structuredContent: {
          rendererVersion: RENDERER_VERSION,
          objects: ["point", "segment", "line"],
          unitsPerSquare: [0.5, 1, 2],
          squares: { x: [2, 18], y: [2, 26] },
          maximumObjects: 50,
          maximumRequestBytes: MAX_REQUEST_BYTES,
          printDpi: 600,
          defaultAxes: {
            x: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
            y: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
          },
          revisionOperations: [
            "add_object",
            "replace_object",
            "remove_object",
            "set_axes",
            "set_label",
          ],
        },
        content: [
          {
            type: "text",
            text: "One centimetre grid squares; points, segments and straight lines; SVG, PNG and editable JSON. No curves.",
          },
        ],
      }),
    );
    const failure = (error: unknown) => ({
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            code: error instanceof GraphError ? error.code : "render_failed",
            message:
              error instanceof GraphError
                ? error.message
                : "The graph could not be rendered. Try again or simplify the graph.",
          }),
        },
      ],
    });
    server.registerTool(
      "create_graph",
      {
        description:
          "Create a coordinate graph using points, segments or straight lines. Supply exact square counts and scales. Fractions such as 1/2 are supported. Keep equationVisible false unless the user explicitly requests a printed equation label; plotting y = 2x + 1 alone should return an unlabelled line. Returns image preview, editable document and download/editor links. Not for curves or arbitrary code.",
        inputSchema: graphSpecSchema,
        outputSchema: graphOutputSchema,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            createGraph(args),
            AbortSignal.any([extra.signal, connectionSignal]),
          );
        } catch (error) {
          return failure(error);
        }
      },
    );
    server.registerTool(
      "revise_graph",
      {
        description:
          "Revise the exact returned envelope using its contentHash as baseHash. Apply operations atomically. replace_object retains ID; set_label shows, hides or moves a line equation; set_axes sets both axes. An empty operations array refreshes download links. Also accepts human editable JSON; legacy font changes to portable with a warning.",
        inputSchema: revisionSchema,
        outputSchema: graphOutputSchema,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(
            await reviseGraph(args),
            AbortSignal.any([extra.signal, connectionSignal]),
          );
        } catch (error) {
          return failure(error);
        }
      },
    );
    return server;
  }
  return createServer({ maxHeaderSize: 16 * 1024 }, async (req, res) => {
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
          buildId: options.buildId ?? "development",
        });
        return;
      }
      limits.request(req.socket.remoteAddress ?? "unknown");
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
      const code = error instanceof GraphError ? error.code : "invalid_request";
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
          error instanceof GraphError
            ? error.message
            : "The request could not be processed.",
      });
    }
  });
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new GraphError("invalid_request", "Use application/json.");
  let size = 0;
  const parts: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES)
      throw new GraphError("size_limit", "The request exceeds 64 KiB.");
    parts.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new GraphError("invalid_request", "The JSON request cannot be read.");
  }
}
