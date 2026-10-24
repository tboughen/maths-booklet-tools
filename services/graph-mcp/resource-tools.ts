import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import * as cuboid from "../../packages/cuboid-core/src/index";
import * as ci from "../../packages/cuboid-core/src/interchange";
import * as line from "../../packages/number-line-core/src/index";
import * as venn from "../../packages/venn-core/src/index";
import * as vi from "../../packages/venn-core/src/interchange";
import * as algebra from "../../packages/algebra-grid-core/src/index";
import * as ai from "../../packages/algebra-grid-core/src/interchange";
import * as triangle from "../../packages/triangle-core/src/index";
import * as ti from "../../packages/triangle-core/src/interchange";
import { triangleConfig } from "./triangle-config";
import { algebraConfig } from "./algebra-config";
import { renderPortableSvg } from "../../packages/venn-core/src/portable";
import { GraphError } from "../../packages/graph-core/src/interchange";
import { printRasterSize } from "../../packages/graph-core/src/png-bytes";
import {
  diagramSource,
  prepareDiagram,
  type DiagramSource,
} from "./diagram-source";
import type { RasterQueue } from "./raster";
import type { TrafficLimits } from "./limits";
import type { ResourceDownloads } from "./resource-downloads";
import type { DownloadFormat } from "./downloads";
import { printGuidanceSchema, PRINT_INSTRUCTIONS } from "./placement";
type NewSource = Extract<
  DiagramSource,
  { kind: "cuboids" | "number-line" | "venn" | "algebra-grid" | "triangle" }
>;
const lineCreateSchema = z
  .object({
    spec: line.specSchema.optional(),
    envelope: line.envelopeSchema.optional(),
  })
  .strict();
const commonDescription =
  "Return a preview, SVG, verified 600 ppi PNG, editable JSON, contentHash, actual physicalSizeCm and an editor link where bounded. Preserve pupil blanks/hidden answers and retain the returned envelope/hash. Numeric mathematical values are strings. Never infer answers.";
const configs = [
  {
    kind: "cuboids" as const,
    name: "cuboid",
    schema: cuboid.envelopeSchema,
    createInput: ci.createSchema,
    revision: ci.revisionSchema,
    capabilities: {
      schemaVersions: [1, 2],
      rendererVersions: ["cuboids-1", "cuboids-2"],
      defaultRendererVersion: "cuboids-2",
      shapes: { minimum: 1, maximum: 3 },
      widthCm: { minimum: 4, maximum: 18 },
      views: ["plain", "cubes", "layers"],
      maximumCubesPerEdge: 40,
      maximumCubesPerShape: 10000,
      maximumLayers: 20,
      minimumPrintedCellMm: 2,
      maximumPrintPixels: 32000000,
      maximumRevisionOperations: 30,
      operations: Object.keys(
        ci.operationSchema.options.reduce(
          (v, o) => ({ ...v, [o.shape.op.value]: true }),
          {},
        ),
      ),
      cubeLock:
        "set_cube enabled:true requires referenceAxis unless already locked",
      units: ["cm", "mm", "m"],
      creation: "spec or envelope; omit for one unworked version-2 cuboid",
    },
    createDescription: `Create one to three cuboids, cubes, cube grids or separated layers. Use spec.shapes with dimensions:{width,depth,height}, unit, labels and presentation; omitted shape fields use unworked defaults. Or supply an existing envelope, never both. New requests use cuboids-2; older envelopes retain their version. Rendering crops around actual artwork at unchanged scale. Large layer/cube combinations may exceed service print limits. ${commonDescription}`,
    reviseDescription: `Revise the returned cuboid envelope with baseHash and atomic operations (max30). add_shape {afterId?,shape}; remove_shape {id}; replace_shape {id,shape} retains ID; set_dimension {id,axis:width|depth|height,value}; set_unit {id,unit} converts physical dimensions; set_cube {id,enabled,referenceAxis?} requires an explicit reference when enabling; set_cube_side {id,value} is in the displayed unit; set_view {id,view}; set_projection {id,direction?,projection?,schematic?,proportions?}; set_label {id,key,label}; set_appearance {id,appearance}; set_presentation {id,settings}; set_print {widthCm}; upgrade_document {}. Version-2 appearance requires explicit upgrade_document for legacy files. Worked calculations remain explicit; custom captions are retained. Empty operations refresh links. ${commonDescription}`,
  },
  {
    kind: "number-line" as const,
    name: "number_line",
    schema: line.envelopeSchema,
    createInput: lineCreateSchema,
    revision: line.revisionSchema,
    capabilities: {
      schemaVersions: [1],
      rendererVersions: ["number-line-1"],
      styleProfile: "examination-v1",
      widthCm: { minimum: 8, maximum: 18 },
      tickIntervals: { minimum: 2, maximum: 32 },
      maximumPoints: 33,
      maximumConnections: 32,
      maximumRevisionOperations: 30,
      solutionKinds: ["interval", "ray", "points"],
      labelStates: ["value", "hidden", "answer-line"],
      operations: line.operationSchema.options.map((o) => o.shape.op.value),
      creation: "spec or envelope; omit for a blank -5 to 5 axis",
    },
    createDescription: `Create an examination number line. Supply spec:{axis?,solution?,teaching?,widthCm?} or an existing envelope. axis has minimum,maximum,step numeric strings; solution is null, interval, ray or points with stable IDs. Preserve solutionVisible, tick-label answer lines, prompt and answer visibility. Omit both for a blank -5..5 axis. ${commonDescription}`,
    reviseDescription: `Revise a number line atomically using envelope, baseHash and max30 operations. set_axis {axis}; set_solution {solution}; set_endpoint {id,endpoint:lower|upper|value,value?,included?}; add_point {point}; set_point {id,value?,included?}; connect_points {interval:{id,from,to}}; remove_interval {id}; remove_point {id} also removes incident joins; set_tick_label {value,state:value|hidden|answer-line}; set_presentation {teaching}; set_print {widthCm}. Axis changes never silently discard solutions. A truncated ray requires intentional:true. Empty operations refresh links. ${commonDescription}`,
  },
  {
    kind: "venn" as const,
    name: "venn",
    schema: venn.envelopeSchema,
    createInput: vi.createSchema,
    revision: vi.revisionSchema,
    capabilities: {
      schemaVersions: [1, 2],
      rendererVersions: ["venn-1", "venn-2"],
      defaultRendererVersion: "venn-2",
      setCounts: [1, 2, 3],
      arrangements: venn.arrangements,
      shapes: ["circles", "ovals"],
      maximumMembers: 40,
      maximumMembersPerRegion: 20,
      widthCm: { minimum: 8, maximum: 16 },
      fontPt: { minimum: 9, maximum: 14 },
      maximumRevisionOperations: 30,
      regionMasks:
        "0=outside; A=bit1, B=bit2, C=bit4; use only active masks for the layout",
      visibility: venn.visibility,
      regionKinds: venn.kinds,
      operations: vi.operationSchema.options.map((o) => o.shape.op.value),
      outputView:
        "pupil (default) or explicitly requested answer; source JSON and hash always retain saved pupil visibility",
      hiddenAnswers: "Editable files/links can contain hidden answers.",
      creation: "spec or envelope; omit for blank two-set version-2 overlap",
    },
    createDescription: `Create editable one/two/three-set Venn diagrams. Supply spec with sets,shape,arrangement,widthCm,fontPt,labels:[{set,label}],definitions:[{set,text}],regions:[{mask,region}],showDefinitions,caption; or an existing envelope, never both. Region mask0 is outside; bits A=1 B=2 C=4. arrangements overlap/separate/b-inside-a/a-inside-b (non-overlap only two sets). Region kind and show/hidden/line visibility are explicit; zero is not blank. outputView defaults pupil; answer must be explicitly requested. Returned JSON/editor source always preserves pupil visibility and can include hidden answers. ${commonDescription}`,
    reviseDescription: `Revise Venn envelope/baseHash atomically (max30). set_region {mask,region}; set_label {set:universe|A|B|C,label}; set_definition {set,text}; set_definitions_visible {visible}; set_layout {sets?,shape?,arrangement?,caption?,discardIncompatible?}; shade_regions {masks,style:none|grey|hatch,mode:replace|add}; shade_expression {expression,style,mode}; clear_shading {}; set_print {widthCm?,fontPt?}; upgrade_document {}. Expressions use stable A/B/C IDs, union/intersection/complement and brackets. Lossy layout changes require the user's explicit discard request and discardIncompatible:true; never merge values. Legacy files need explicit upgrade for new layouts. outputView pupil|answer affects artwork only; retain returned pupil source/hash. Empty operations refresh links. ${commonDescription}`,
  },
  algebraConfig,
  triangleConfig,
];
export function resourceTools(
  raster: RasterQueue,
  downloads: ResourceDownloads,
  limits: TrafficLimits,
  editorBase: string,
) {
  async function artifacts(
    source: NewSource,
    format: DownloadFormat,
    signal?: AbortSignal,
  ) {
    if (format === "json")
      return {
        body: Buffer.from(JSON.stringify(source.envelope, null, 2)),
        type: "application/json",
      };
    const info = await prepareDiagram(source, raster, signal);
    const svg =
      source.kind === "triangle" ? triangle.renderSvg(source.envelope) : source.kind === "algebra-grid" ? algebra.renderSvg(source.envelope) : source.kind === "cuboids"
        ? info.crop!.svg
        : source.kind === "number-line"
          ? line.renderSvg(source.envelope)
          : (format === "svg" ? renderPortableSvg : venn.renderSvg)(
              venn.forView(source.envelope, source.outputView ?? "pupil"),
            );
    const size =
      format === "png"
        ? printRasterSize(info.physicalSizeCm.width, info.physicalSizeCm.height)
        : {
            width: 1200,
            height: Math.max(
              1,
              Math.round(
                (1200 * info.physicalSizeCm.height) / info.physicalSizeCm.width,
              ),
            ),
          };
    const r = await raster.render(
      svg,
      size.width,
      size.height,
      format === "png",
      format === "svg",
      signal,
      source.kind,
    );
    return {
      body: Buffer.from(format === "svg" ? r.svg! : r.png!),
      type: format === "svg" ? "image/svg+xml" : "image/png",
    };
  }
  async function result(source: NewSource, signal: AbortSignal) {
    const info = await prepareDiagram(source, raster, signal);
    const print = await artifacts(source, "png", signal);
    const svg =
      source.kind === "triangle" ? triangle.renderSvg(source.envelope) : source.kind === "algebra-grid" ? algebra.renderSvg(source.envelope) : source.kind === "cuboids"
        ? info.crop!.svg
        : source.kind === "number-line"
          ? line.renderSvg(source.envelope)
          : venn.renderSvg(
              venn.forView(source.envelope, source.outputView ?? "pupil"),
            );
    const width = Math.min(
        1200,
        Math.floor(
          Math.sqrt(
            (2_000_000 * info.physicalSizeCm.width) /
              info.physicalSizeCm.height,
          ),
        ),
      ),
      height = Math.max(
        1,
        Math.round(
          (width * info.physicalSizeCm.height) / info.physicalSizeCm.width,
        ),
      );
    const preview = await raster.render(
      svg,
      width,
      height,
      false,
      false,
      signal,
      source.kind,
    );
    const hash =
      source.kind === "triangle" ? await ti.hash(source.envelope) : source.kind === "algebra-grid" ? await ai.hash(source.envelope) : source.kind === "cuboids"
        ? await ci.hash(source.envelope)
        : source.kind === "number-line"
          ? await line.hash(source.envelope)
          : await vi.hash(source.envelope);
    const warnings =
      source.kind === "triangle" ? triangle.warnings(source.envelope) : source.kind === "algebra-grid" ? algebra.warnings(source.envelope) : source.kind === "cuboids"
        ? source.envelope.document.shapes.flatMap((s) => cuboid.warnings(s))
        : source.kind === "number-line"
          ? line.warnings(source.envelope)
          : venn.warnings(source.envelope);
    const content: ContentBlock[] = [
      {
        type: "text",
        text: `Editable ${source.kind} resource. Pupil blanks and saved visibility are retained.`,
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
        links[format] = downloads.link(source, format);
      } catch (error) {
        if (!(error instanceof GraphError) || error.code !== "size_limit")
          throw error;
        const file =
          format === "png" ? print : await artifacts(source, format, signal);
        const blob =
          format === "png" ? file.body.toString("base64") : undefined;
        limits.output(blob ? Buffer.byteLength(blob) : file.body.length);
        content.push({
          type: "resource",
          resource: {
            uri: `mathsdock-${source.kind}://${hash}/source.${format}`,
            mimeType: file.type,
            ...(blob ? { blob } : { text: file.body.toString("utf8") }),
          },
        });
        warnings.push(
          `${format.toUpperCase()} is included as file content because its link is too long.`,
        );
      }
    }
    let editorUrl: string | null =
      source.kind === "triangle" ? ti.editorLink(source.envelope,editorBase) : source.kind === "algebra-grid" ? ai.editorLink(source.envelope,editorBase) : source.kind === "cuboids"
        ? cuboid.editorLink(source.envelope, editorBase)
        : source.kind === "number-line"
          ? line.editorLink(source.envelope, editorBase)
          : vi.editorLink(source.envelope, editorBase);
    if (
      editorUrl &&
      editorUrl.length > (source.kind === "venn" || source.kind === "triangle" ? 16_000 : 7500)
    )
      editorUrl = null;
    if (!editorUrl)
      warnings.push(
        "Open the editable JSON file rather than an editor link for this resource.",
      );
    if (source.kind === "venn" || source.kind === "algebra-grid" || source.kind === "triangle")
      warnings.push(
        "Editable JSON and editor links retain the pupil document and may contain hidden answers.",
      );
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
        printRaster: printRasterSize(
          info.physicalSizeCm.width,
          info.physicalSizeCm.height,
        ),
        printDpi: 600 as const,
        printVerified: true as const,
        ...(source.kind === "triangle" ? { calculationContexts: ti.contexts(source.envelope) } : {}),
        ...(source.kind === "venn"
          ? {
              outputView: source.outputView ?? "pupil",
              activeRegions: venn.activeMasks(source.envelope),
            }
          : {}),
      },
      content: [
        ...content,
        { type: "text" as const, text: PRINT_INSTRUCTIONS },
      ],
    };
  }
  function register(server: McpServer, connection: AbortSignal) {
    const annotations = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
    for (const c of configs) {
      const outputBase = z
        .object({
          envelope: c.schema,
          contentHash: z.string(),
          rendererVersion: z.string(),
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
          printGuidance: printGuidanceSchema,
          printRaster: z.object({ width: z.number(), height: z.number() }),
          printDpi: z.literal(600),
          printVerified: z.literal(true),
          outputView: vi.outputViewSchema.optional(),
          activeRegions: z.array(z.number().int()).optional(),
        })
        .strict();
      const output = c.kind === "triangle" ? outputBase.extend({ calculationContexts: z.array(ti.contextSchema) }) : outputBase;
      server.registerTool(
        `${c.name}_capabilities`,
        {
          description: `Read supported ${c.kind} content, versions, limits, presentation and revision operations before creating a resource.`,
          inputSchema: z.object({}).strict(),
          annotations,
        },
        async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ...c.capabilities,
                printDpi: 600,
                maximumRequestBytes: 65536,
              }),
            },
          ],
        }),
      );
      // Concrete Zod schemas are passed unchanged to discovery and core validators.
      server.registerTool(
        `create_${c.name}`,
        {
          description: c.createDescription,
          inputSchema: c.createInput,
          outputSchema: output,
          annotations,
        },
        async (
          args: Record<string, unknown>,
          extra: { signal: AbortSignal },
        ) => {
          try {
            let envelope: unknown;
            if (c.kind === "triangle") envelope = ti.create(args);
            else if (c.kind === "algebra-grid") envelope = ai.create(args);
            else if (c.kind === "cuboids") envelope = ci.createCuboid(args);
            else if (c.kind === "venn") envelope = vi.createVenn(args);
            else {
              const v = lineCreateSchema.parse(args);
              if (v.spec && v.envelope)
                throw Error("Supply spec or envelope, not both.");
              envelope = v.envelope
                ? line.validate(v.envelope)
                : line.create(v.spec);
            }
            return await result(
              diagramSource({
                kind: c.kind,
                envelope,
                ...("outputView" in args && args.outputView !== undefined
                  ? { outputView: args.outputView }
                  : {}),
              }) as NewSource,
              AbortSignal.any([extra.signal, connection]),
            );
          } catch (e) {
            return failure(e);
          }
        },
      );
      server.registerTool(
        `revise_${c.name}`,
        {
          description: c.reviseDescription,
          inputSchema: c.revision,
          outputSchema: output,
          annotations,
        },
        async (
          args: Record<string, unknown>,
          extra: { signal: AbortSignal },
        ) => {
          try {
            const envelope =
              c.kind === "triangle" ? await ti.revise(args) : c.kind === "algebra-grid" ? await ai.revise(args) : c.kind === "cuboids"
                ? await ci.reviseCuboid(args)
                : c.kind === "venn"
                  ? await vi.reviseVenn(args)
                  : await line.revise(args);
            return await result(
              diagramSource({
                kind: c.kind,
                envelope,
                ...("outputView" in args && args.outputView !== undefined
                  ? { outputView: args.outputView }
                  : {}),
              }) as NewSource,
              AbortSignal.any([extra.signal, connection]),
            );
          } catch (e) {
            return failure(e);
          }
        },
      );
    }
  }
  return { register, artifacts };
}
const link = z
  .object({ url: z.string().url(), expiresAt: z.string() })
  .strict();
function failure(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text:
          error instanceof Error
            ? error.message
            : "The resource could not be processed.",
      },
    ],
  };
}
