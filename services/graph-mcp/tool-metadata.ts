// Tool titles, field descriptions and honest capabilities for every MathsDock MCP tool
// (improvement list M4, M10, M17, M18). Titles are what Claude, ChatGPT and other clients show
// in tool pickers and approval prompts; they never change a tool's name, input or hashes.
import { McpServer, type RegisteredTool, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";

export const TOOL_TITLES: Readonly<Record<string, string>> = {
  diagram_capabilities: "Diagram options",
  create_diagram: "Create a diagram",
  revise_diagram: "Edit a diagram",
  check_diagram_placement: "Check a diagram's print size",
  download_diagram_bundle: "Download diagram files",
  get_diagram_svg: "Get a diagram's SVG",
  worksheet_capabilities: "Worksheet and booklet options",
  create_worksheet: "Make an A3 worksheet",
  create_booklet: "Make an A4 booklet",
};
export function toolTitle(name: string): string {
  const title = TOOL_TITLES[name];
  if (!title) throw Error(`Tool ${name} has no title in tool-metadata.ts.`);
  return title;
}

// Descriptions for fields that mean the same thing in every tool, wherever they appear in an input.
export const FIELD_DOCS: Readonly<Record<string, string>> = {
  envelope:
    "The exact envelope a previous call returned, or a saved source.json. Change it with operations, not by hand.",
  baseHash:
    "The contentHash returned with this exact envelope. If the envelope has changed, the revision is refused and nothing is applied.",
  operations:
    "Edits applied in order and atomically: all succeed or none apply. An empty array changes nothing and returns fresh download links.",
  outputView:
    "pupil (default) or answer. answer draws a teacher copy with hidden answers shown in the answer colour (Venn diagrams, ratio tables, charts, probability and frequency trees, expanding and factorising grids, triangles). Artwork only: the returned envelope and contentHash stay the pupil source.",
  schemaVersion:
    "File format version. Keep the value a previous call returned. The tool description says which versions a new resource may request.",
  rendererVersion: "Drawing rules version recorded in the file. Keep the value a previous call returned.",
  styleProfile: "Print style recorded in the file. Keep the value a previous call returned.",
  document: "The editable content inside an envelope. Change it with operations, not by hand.",
  tool: "The MathsDock tool this file belongs to. Keep the value a previous call returned.",
  widthCm: "Printed width in centimetres at 100% size.",
  fontPt: "Printed text size in points.",
  unitMm: "Printed size in millimetres.",
  barHeightMm: "Printed size in millimetres.",
  nameWidthMm: "Printed size in millimetres.",
  cellMm: "Printed size in millimetres.",
  gridLineMm: "Printed size in millimetres.",
};
// Fields described only at the top level of a tool's input, where their meaning is fixed.
const TOP_LEVEL_DOCS: Readonly<Record<string, string>> = {
  spec: "Settings for a new resource; settings left out take their defaults. Supply spec or envelope, not both.",
  kind: "The diagram family the envelope belongs to.",
  widthMm: "Target printed width in millimetres. Nothing is edited.",
  heightMm: "Target printed height in millimetres. Nothing is edited.",
};

type Def = { type: string; shape?: Record<string, z.ZodType>; options?: z.ZodType[]; innerType?: z.ZodType; element?: z.ZodType; in?: z.ZodType; left?: z.ZodType; right?: z.ZodType; valueType?: z.ZodType };
const defOf = (schema: z.ZodType) => (schema as unknown as { _zod: { def: Def } })._zod.def;
const described = (schema: z.ZodType): boolean => {
  if (z.globalRegistry.get(schema)?.description) return true;
  const def = defOf(schema);
  return ["optional", "nullable", "default", "readonly", "prefault", "catch"].includes(def.type) && !!def.innerType && described(def.innerType);
};
const done = new WeakSet<object>();
/**
 * Adds FIELD_DOCS descriptions to the input schema's fields in place, through zod's metadata
 * registry, so the schema's structure, validation and every hash stay exactly the same.
 * Fields that already have a description keep it.
 */
export function documentFields(schema: z.ZodType, topLevel = true): void {
  if (done.has(schema)) return;
  done.add(schema);
  const def = defOf(schema);
  if (def.type === "object" && def.shape) {
    for (const [key, field] of Object.entries(def.shape)) {
      const text = FIELD_DOCS[key] ?? (topLevel ? TOP_LEVEL_DOCS[key] : undefined);
      if (text && !described(field)) z.globalRegistry.add(field, { description: text });
      // A saved file is copied back unchanged, so its inner fields need no descriptions; leaving
      // them out keeps tools/list from repeating them inside every envelope.
      if (key !== "envelope" && key !== "document") documentFields(field, false);
    }
    return;
  }
  for (const child of [...(def.options ?? []), def.innerType, def.element, def.in, def.left, def.right, def.valueType])
    if (child) documentFields(child, topLevel && def.type !== "array" && def.type !== "record");
}

/**
 * McpServer with MathsDock's tool metadata: every tool gets its title and field descriptions,
 * and the server says truthfully that its tool list never changes during a connection (the
 * service is stateless, so it never sends notifications/tools/list_changed).
 */
export class MathsDockMcpServer extends McpServer {
  override registerTool<OutputArgs extends ZodRawShapeCompat | AnySchema, InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations?: ToolAnnotations;
      _meta?: Record<string, unknown>;
    },
    cb: ToolCallback<InputArgs>,
  ): RegisteredTool {
    if (config.inputSchema instanceof z.ZodType) documentFields(config.inputSchema);
    return super.registerTool(name, { ...config, title: config.title ?? toolTitle(name) }, cb);
  }
  override async connect(transport: Transport) {
    this.server.registerCapabilities({ tools: { listChanged: false } });
    return super.connect(transport);
  }
}

/** serverInfo.version: the package version plus the start of the build ID that /healthz reports. */
export function serverVersion(packageVersion: string, buildId: string | undefined): string {
  return `${packageVersion}+${(buildId ?? "development").slice(0, 12)}`;
}
