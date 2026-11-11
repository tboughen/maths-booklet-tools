/**
 * The connector's three family-generic diagram tools, built from the diagram registry
 * (packages/diagram-core). They replace the old capabilities/create/revise tool for each family:
 * a family's schema and guidance are read on demand through diagram_capabilities, so tools/list
 * stays small however many families exist.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { DIAGRAM_KINDS, FAMILIES, altText, describeIssues, diagramKindSchema, type DiagramKind } from "../../packages/diagram-core/src/registry";
import { FAMILY_LIST, familyCapabilities } from "../../packages/diagram-core/src/guides";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { RatioError } from "../../packages/ratio-table-core/src/interchange";
import { describeGraph } from "../../packages/graph-core/src/interchange";
import { describeRatio } from "../../packages/ratio-table-core/src/interchange";
import * as line from "../../packages/number-line-core/src/index";
import { diagramSource, type DiagramSource } from "./diagram-source";

type ToolResult = { structuredContent: Record<string, unknown>; content: ContentBlock[] };
/** Builds the finished result (preview, files, links, print facts) for one validated source. */
export type ResultBuilder = (source: DiagramSource, signal: AbortSignal) => Promise<ToolResult>;

const view = z.enum(["pupil", "answer"]).optional();
const object = z.record(z.string(), z.unknown());
const kind = diagramKindSchema.describe("Diagram family. Call diagram_capabilities with this kind first to read its spec and operations.");

export const capabilitiesInput = z
  .object({ kind: diagramKindSchema.optional().describe("Leave out for the list of families; give one for its options, spec schema and operations.") })
  .strict();
export const createInput = z
  .object({
    kind,
    spec: object.optional().describe("Settings for a new diagram, as that family's specSchema describes. Leave out for the family's blank default. Supply spec or envelope, not both."),
    envelope: object.optional().describe("A saved source.json or a previous result's envelope, to re-check it and get fresh files and links."),
    outputView: view,
  })
  .strict();
export const reviseInput = z
  .object({
    kind,
    envelope: object,
    baseHash: z.string(),
    operations: z.array(object).max(40).describe("Edits from the family's operationsSchema, applied in order and atomically. An empty array changes nothing and returns fresh links."),
    outputView: view,
  })
  .strict();
const link = z.object({ url: z.string().url(), expiresAt: z.string() }).strict();
export const diagramOutput = z
  .object({
    kind: diagramKindSchema,
    envelope: object,
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    rendererVersion: z.string(),
    printDpi: z.literal(600),
    printVerified: z.boolean(),
    summary: z.string(),
    altText: z.string(),
    warnings: z.array(z.string()),
    downloads: z.object({ svg: link.optional(), png: link.optional(), json: link.optional() }).strict(),
    editorUrl: z.string().url().nullable(),
    physicalSizeCm: z.object({ width: z.number(), height: z.number() }),
  })
  .passthrough();

/** An error a model can act on: a stable code, the message and, for schema problems, the fields. */
export function diagramFailure(error: unknown, kindName?: string) {
  const fields = describeIssues(error);
  const code = error instanceof GraphError || error instanceof RatioError ? error.code : fields ? "invalid_input" : "invalid_diagram";
  let message = fields ?? (error instanceof Error ? error.message : "The diagram could not be processed.");
  if (code === "render_failed" || (!(error instanceof Error) && !fields)) message = "The diagram could not be rendered. Try again or simplify it.";
  const hint = kindName ? ` Check diagram_capabilities {kind:"${kindName}"} for the expected fields.` : "";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ code, message: message + (fields ? hint : "") }) }],
  };
}

function plainSummary(source: DiagramSource, verb: "Created" | "Revised" | "Checked", size: { width: number; height: number }, alt: string, warnings: string[]) {
  const f = FAMILIES[source.kind];
  const what =
    source.kind === "graph" ? describeGraph(source.envelope) : source.kind === "ratio-table" ? describeRatio(source.envelope, ("outputView" in source && source.outputView) || "pupil") : source.kind === "number-line" ? line.describe(source.envelope) : alt;
  const viewNote = f.answerView ? ` Artwork view: ${("outputView" in source && source.outputView) || "pupil"}.` : "";
  const notes = warnings.length ? ` ${warnings.length} note${warnings.length === 1 ? "" : "s"}: ${warnings.join(" ")}` : "";
  return `${verb} a ${f.label}, ${size.width} × ${size.height} cm at 100%. ${what}${viewNote}${notes}`;
}

const MIME = { svg: "image/svg+xml", png: "image/png", json: "application/json" } as const;
async function finish(source: DiagramSource, verb: "Created" | "Revised" | "Checked", build: ResultBuilder, signal: AbortSignal) {
  const r = await build(source, signal);
  const s = r.structuredContent as { physicalSizeCm: { width: number; height: number }; warnings: string[]; downloads: Partial<Record<keyof typeof MIME, { url: string }>> };
  const view = "outputView" in source && source.outputView ? source.outputView : "pupil";
  const alt = altText(source.kind, FAMILIES[source.kind].svg(source.envelope, view));
  const summary = plainSummary(source, verb, s.physicalSizeCm, alt, s.warnings);
  // Files as MCP resource links, so clients can offer them directly instead of retyping URLs.
  const links: ContentBlock[] = (Object.keys(MIME) as (keyof typeof MIME)[]).flatMap((format) => {
    const d = s.downloads[format];
    return d ? [{ type: "resource_link" as const, uri: d.url, name: `mathsdock-${source.kind}.${format}`, mimeType: MIME[format], description: `${format.toUpperCase()} file, link valid for seven days` }] : [];
  });
  // Drop the builders' own lead-in text: the summary replaces it.
  const content = r.content.filter((c, i) => !(i === 0 && c.type === "text"));
  return {
    structuredContent: { kind: source.kind, ...r.structuredContent, summary, altText: alt },
    content: [{ type: "text" as const, text: summary }, ...content, ...links],
  };
}

export function diagramTools(builders: Record<DiagramKind, ResultBuilder>) {
  function register(server: McpServer, connection: AbortSignal) {
    const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    server.registerTool(
      "diagram_capabilities",
      {
        description: `List the diagram families, or read one family's options, spec schema, operations and rules before create_diagram or revise_diagram. Families: ${DIAGRAM_KINDS.join(", ")}.`,
        inputSchema: capabilitiesInput,
        annotations,
      },
      async (input) => {
        const value = input.kind ? familyCapabilities(input.kind) : { families: FAMILY_LIST, next: "Call diagram_capabilities with one kind for its spec and operations." };
        return { structuredContent: value, content: [{ type: "text" as const, text: JSON.stringify(value) }] };
      },
    );
    server.registerTool(
      "create_diagram",
      {
        description:
          "Create one MathsDock diagram of the given kind from a spec (or re-check a saved envelope). Returns a preview, a plain-text summary and alt text, SVG, verified 600 ppi PNG and editable JSON links, the envelope and contentHash for revisions, the printed size and an editor link where it fits. Pupil blanks, answer lines and hidden answers stay as given; never fill or reveal answers unless asked. Numeric values are strings.",
        inputSchema: createInput,
        outputSchema: diagramOutput,
        annotations,
      },
      async (input, extra) => {
        try {
          const f = FAMILIES[input.kind];
          if (input.outputView !== undefined && !f.answerView) throw new GraphError("invalid_input", "outputView applies only to venn, ratio-table, charts and probability-tree.");
          const envelope = f.create({ ...(input.spec !== undefined ? { spec: input.spec } : {}), ...(input.envelope !== undefined ? { envelope: input.envelope } : {}) });
          const source = diagramSource({ kind: input.kind, envelope, ...(input.outputView ? { outputView: input.outputView } : {}) });
          return await finish(source, input.envelope ? "Checked" : "Created", builders[input.kind], AbortSignal.any([extra.signal, connection]));
        } catch (error) {
          return diagramFailure(error, input.kind);
        }
      },
    );
    server.registerTool(
      "revise_diagram",
      {
        description:
          "Edit the exact envelope a previous call returned, with its contentHash as baseHash and the family's operations (see diagram_capabilities). All operations apply or none do; a changed envelope is refused. Keep unchanged settings, blanks and hidden answers; calculate only when the user asks. Returns the same files and links as create_diagram.",
        inputSchema: reviseInput,
        outputSchema: diagramOutput,
        annotations,
      },
      async (input, extra) => {
        try {
          const f = FAMILIES[input.kind];
          if (input.outputView !== undefined && !f.answerView) throw new GraphError("invalid_input", "outputView applies only to venn, ratio-table, charts and probability-tree.");
          const envelope = await f.revise({ envelope: input.envelope, baseHash: input.baseHash, operations: input.operations });
          const source = diagramSource({ kind: input.kind, envelope, ...(input.outputView ? { outputView: input.outputView } : {}) });
          return await finish(source, "Revised", builders[input.kind], AbortSignal.any([extra.signal, connection]));
        } catch (error) {
          return diagramFailure(error, input.kind);
        }
      },
    );
  }
  return { register };
}
