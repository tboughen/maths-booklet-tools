import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateSync, inflateSync } from "fflate";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { fileName, renderResource, resourceSchema, SIZE, validate, type Resource, type View } from "../../packages/resource-core/src/index";
import { GraphError } from "../../packages/graph-core/src/interchange";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";

export type WorksheetFormat = "pdf" | "json";
const MAX_LINK = 7500;
const PREVIEW_WIDTH = 1400;

const tokenSchema = z
  .object({
    v: z.literal(1),
    key: z.string().max(32),
    expires: z.number().int(),
    format: z.enum(["pdf", "json"]),
    view: z.enum(["pupil", "answers"]),
    resource: z.unknown(),
  })
  .strict();

/**
 * Signed, stateless download links. The worksheet travels in the link, deflated; the signature
 * covers the compressed token and is checked before anything is decompressed.
 */
export class WorksheetDownloads {
  constructor(
    private base: string,
    private keys: Record<string, string>,
    private active: string,
  ) {
    if (!Object.hasOwn(keys, active)) throw Error("Use a valid active worksheet signing key.");
  }
  private sign(token: string, key: string) {
    return createHmac("sha256", key).update("worksheet:" + token).digest("base64url");
  }
  link(resource: Resource, format: WorksheetFormat, view: View, now = Date.now()) {
    const expires = Math.floor(now / 1000) + 7 * 86400;
    const json = JSON.stringify({ v: 1, key: this.active, expires, format, view, resource });
    const token = Buffer.from(deflateSync(new TextEncoder().encode(json), { level: 9 })).toString("base64url");
    const url = new URL("/worksheet/download", this.base);
    url.searchParams.set("token", token);
    url.searchParams.set("signature", this.sign(token, this.keys[this.active]));
    if (url.href.length > MAX_LINK) throw new GraphError("size_limit", "The worksheet link exceeds its limit; use the included file.");
    return { url: url.href, expiresAt: new Date(expires * 1000).toISOString() };
  }
  verify(url: URL, now = Date.now()) {
    const token = url.searchParams.get("token") ?? "",
      signature = url.searchParams.get("signature") ?? "";
    if (token.length > MAX_LINK || !/^[-_A-Za-z0-9]+$/.test(token) || !/^[-_A-Za-z0-9]{43}$/.test(signature))
      throw new GraphError("invalid_download", "Invalid worksheet download.");
    // Any listed key may have signed it; the key id inside is only readable after inflating.
    const known = Object.values(this.keys).some((key) => timingSafeEqual(Buffer.from(signature), Buffer.from(this.sign(token, key))));
    if (!known) throw new GraphError("invalid_download", "Invalid worksheet signature.");
    let parsed: z.infer<typeof tokenSchema>;
    try {
      parsed = tokenSchema.parse(JSON.parse(new TextDecoder().decode(inflateSync(Buffer.from(token, "base64url")))));
    } catch {
      throw new GraphError("invalid_download", "Invalid worksheet token.");
    }
    if (!Object.hasOwn(this.keys, parsed.key)) throw new GraphError("invalid_download", "Invalid worksheet key.");
    if (parsed.expires * 1000 < now) throw new GraphError("expired_download", "The worksheet link has expired. Create the worksheet again.");
    return { resource: validate(parsed.resource), format: parsed.format, view: parsed.view };
  }
}

const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v);
export const worksheetHash = (r: Resource) => "sha256:" + createHash("sha256").update(canonical(r)).digest("hex");

const link = z.object({ url: z.string().url(), expiresAt: z.string() }).strict();
const output = z
  .object({
    resource: resourceSchema,
    contentHash: z.string(),
    rendererVersion: z.literal("worksheet-a3-1"),
    printReady: z.boolean(),
    issues: z.array(
      z.object({ side: z.number(), column: z.number(), question: z.number().optional(), message: z.string() }).strict(),
    ),
    files: z.object({ pupilPdf: z.string(), answersPdf: z.string(), json: z.string() }).strict(),
    downloads: z.object({ pupilPdf: link.optional(), answersPdf: link.optional(), json: link.optional() }).strict(),
    physicalSizeMm: z.object({ width: z.literal(420), height: z.literal(297) }).strict(),
    sides: z.literal(2),
  })
  .strict();

const LAYOUT = [
  "A3 landscape (420 x 297 mm), exactly two sides, three titled strand columns per side.",
  "Body text Inter 11 pt (nothing below 10 pt); cards never split; diagrams keep their native size.",
  "Text never shrinks to fit. Overflow is returned as issues naming side, column and the millimetres needed; fix by moving a card, trimming wording or reducing working space, then create again.",
  "Spare column height goes to working and drawing space.",
];

const DESCRIPTION =
  "PRODUCE a two-sided A3 landscape worksheet in the MathsDock house style from a FINALISED question set. " +
  "Supply resource:{tool:'resource',schemaVersion:1,document:{kind:'worksheet-a3',title,code,objective,group?,nameLine?,sides:[2 sides, each {instruction?,columns:[3 columns, each {heading,cards:[{title,items}]}]}]}}. " +
  "Cards are numbered automatically across both sides. Items: text, info (pale key-fact card), claim (a pupil's statement), bullets, table (cells with state supplied|blank|hidden), choice (circle|tick options), answerLine {prefix,suffix,answer,inline}, space {kind:working|drawing,heightMm}, diagram {diagram:{tool:'charts'|'probability-tree',envelope}} using the exact envelope returned by create_chart or create_probability_tree, and part {text,items} for lettered parts. Text markup is only **bold** and *italic*. " +
  "Saved answers (answerLine.answer, hidden cells, hidden diagram values) print only in the answers PDF; never invent answers the teacher did not give. " +
  "Returns side previews, pupil and answers vector PDFs, editable JSON, contentHash and layout issues. When issues are returned the sheet is not print-ready: report them and revise the document; do not claim it fits. To change a worksheet, edit the returned resource and call create_worksheet again.";

export function worksheetTools(raster: RasterQueue, downloads: WorksheetDownloads, limits: TrafficLimits) {
  async function artifacts(resource: Resource, format: WorksheetFormat, view: View, signal?: AbortSignal) {
    if (format === "json")
      return { body: Buffer.from(JSON.stringify(resource, null, 2)), type: "application/json", name: fileName(resource, view).replace(/_A3\.pdf$/, ".json") };
    const r = renderResource(resource, { view });
    const pdf = await raster.worksheetPdf(r.pages, resource.document.title, signal);
    return { body: Buffer.from(pdf), type: "application/pdf", name: fileName(resource, view) };
  }

  async function result(resource: Resource, signal: AbortSignal) {
    const pupil = renderResource(resource, { view: "pupil" });
    const hash = worksheetHash(resource);
    const height = Math.round((PREVIEW_WIDTH * SIZE.page.height) / SIZE.page.width);
    const content: ContentBlock[] = [];
    const printReady = pupil.issues.length === 0;
    content.push({
      type: "text",
      text: printReady
        ? `Worksheet "${resource.document.title}" fits two A3 sides with no layout issues.`
        : `Worksheet "${resource.document.title}" is NOT print-ready: ${pupil.issues.length} layout issue(s). ${pupil.issues.map((i) => `Side ${i.side}, column ${i.column}${i.question ? `, question ${i.question}` : ""}: ${i.message}`).join(" ")}`,
    });
    for (const [i, svg] of pupil.pages.entries()) {
      const png = await raster.worksheetPng(svg.replace(/width="420mm" height="297mm"/, `width="${PREVIEW_WIDTH}" height="${height}"`), PREVIEW_WIDTH, height, signal);
      limits.output(png.byteLength);
      content.push({ type: "text", text: `Preview of side ${i + 1} (pupil view, screen resolution; print from the PDF).` });
      content.push({ type: "image", mimeType: "image/png", data: Buffer.from(png).toString("base64") });
    }
    const files = { pupilPdf: fileName(resource, "pupil"), answersPdf: fileName(resource, "answers"), json: fileName(resource).replace(/_A3\.pdf$/, ".json") };
    const links: z.infer<typeof output>["downloads"] = {};
    const wanted = [
      ["pupilPdf", "pdf", "pupil"],
      ["answersPdf", "pdf", "answers"],
      ["json", "json", "pupil"],
    ] as const;
    for (const [slot, format, view] of wanted) {
      try {
        links[slot] = downloads.link(resource, format, view);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit") throw error;
        const file = await artifacts(resource, format, view, signal);
        limits.output(file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `worksheet://${hash.slice(7, 23)}/${encodeURIComponent(file.name)}`,
            mimeType: file.type,
            ...(format === "pdf" ? { blob: file.body.toString("base64") } : { text: file.body.toString("utf8") }),
          },
        });
      }
    }
    content.push({
      type: "text",
      text: "Print the PDFs on A3 at 100% (actual size), double-sided, flipping on the short edge. The answers PDF shows saved answers in dark pink; keep it away from pupils. Keep the JSON to make changes later.",
    });
    return {
      structuredContent: {
        resource,
        contentHash: hash,
        rendererVersion: "worksheet-a3-1" as const,
        printReady,
        issues: pupil.issues,
        files,
        downloads: links,
        physicalSizeMm: { width: 420 as const, height: 297 as const },
        sides: 2 as const,
      },
      content,
    };
  }

  function register(server: McpServer, connection: AbortSignal) {
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    server.registerTool(
      "worksheet_capabilities",
      {
        description: "Read the A3 worksheet layout, item types and limits before PRODUCE. Use with create_worksheet.",
        inputSchema: z.object({}).strict(),
        annotations,
      },
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              rendererVersion: "worksheet-a3-1",
              kinds: ["worksheet-a3"],
              layout: LAYOUT,
              limits: { sides: 2, columnsPerSide: 3, cardsPerColumn: 6, itemsPerCard: 16, itemsPerPart: 8, cardTitleChars: 60, headingChars: 40 },
              items: ["text", "info", "claim", "bullets", "table", "choice", "answerLine", "space", "diagram", "part"],
              diagrams: { charts: "envelope from create_chart", "probability-tree": "envelope from create_probability_tree" },
              cellStates: ["supplied", "blank", "hidden"],
              markup: "**bold** and *italic* only; no HTML",
              outputs: ["pupil PDF", "answers PDF", "editable JSON", "side previews"],
              fileNames: "[code]_[objective]_A3.pdf and [code]_[objective]_Answers_A3.pdf",
            }),
          },
        ],
      }),
    );
    server.registerTool(
      "create_worksheet",
      {
        description: DESCRIPTION,
        inputSchema: z.object({ resource: resourceSchema }).strict(),
        outputSchema: output,
        annotations,
      },
      async (args, extra) => {
        try {
          return await result(validate(args.resource), AbortSignal.any([connection, extra.signal]));
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  code: e instanceof GraphError ? e.code : "invalid_worksheet",
                  message: e instanceof Error ? e.message : "The worksheet could not be made.",
                }),
              },
            ],
          };
        }
      },
    );
  }
  return { register, artifacts };
}
