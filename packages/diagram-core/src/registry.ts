/**
 * The one list of MathsDock diagram families. Every family registered here can be drawn in its
 * own editor, placed in a worksheet or booklet, made through the connector's generic tools
 * (diagram_capabilities, create_diagram, revise_diagram) and offered to the in-site AI maker.
 *
 * This module is pure: no Node, browser or raster imports, so the website, resource-core and the
 * MCP service all read it. Long connector guidance lives beside it in guides.ts, which only the
 * service imports, so the website bundle stays small.
 *
 * Adding a family: add its kind to DIAGRAM_KINDS, an entry to FAMILIES (TypeScript refuses a
 * missing one), its guide in guides.ts and its result adapter in services/graph-mcp/families.ts.
 */
import { z } from "zod";
import * as graph from "../../graph-core/src/interchange";
import { renderDiagramSvg } from "../../graph-core/src/svg";
import * as ratio from "../../ratio-table-core/src/interchange";
import * as value from "../../value-graph-core/src/interchange";
import * as cuboid from "../../cuboid-core/src/index";
import * as cuboidIo from "../../cuboid-core/src/interchange";
import * as line from "../../number-line-core/src/index";
import * as venn from "../../venn-core/src/index";
import * as vennIo from "../../venn-core/src/interchange";
import * as algebra from "../../algebra-grid-core/src/index";
import * as algebraIo from "../../algebra-grid-core/src/interchange";
import * as bar from "../../bar-model-core/src/versioned";
import * as barIo from "../../bar-model-core/src/versioned-interchange";
import * as chart from "../../chart-core/src/index";
import * as chartIo from "../../chart-core/src/interchange";
import * as tree from "../../probability-tree-core/src/index";
import * as treeIo from "../../probability-tree-core/src/interchange";
import * as ftree from "../../frequency-tree-core/src/index";
import * as ftreeIo from "../../frequency-tree-core/src/interchange";
import * as triangle from "../../triangle-core/src/index";
import * as triangleIo from "../../triangle-core/src/interchange";
import * as construction from "../../construction-core/src/index";
import * as constructionIo from "../../construction-core/src/interchange";

export const DIAGRAM_KINDS = [
  "graph",
  "ratio-table",
  "value-graph",
  "cuboids",
  "number-line",
  "venn",
  "algebra-grid",
  "bar-model",
  "charts",
  "probability-tree",
  "frequency-tree",
  "triangle",
  "construction",
] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];
export const diagramKindSchema = z.enum(DIAGRAM_KINDS);
export type View = "pupil" | "answer";

export interface DiagramFamily<E = unknown> {
  kind: DiagramKind;
  /** Lower-case name for sentences: "a <label>". */
  label: string;
  /** One line a model reads before choosing a family. */
  summary: string;
  /** The website editor's path. */
  route: string;
  /** Whether outputView: "answer" draws a different (teacher) copy. */
  answerView: boolean;
  /** The envelope's structural schema. validate() adds the family's deeper checks. */
  envelopeSchema: z.ZodType;
  /** Input of create: { spec?, envelope?, outputView? } for every family. */
  createSchema: z.ZodType;
  /** Input of revise: { envelope, baseHash, operations, outputView? } for every family. */
  revisionSchema: z.ZodType;
  /** Full validation of a saved or supplied envelope, including print checks for the view. */
  validate(raw: unknown, view: View): E;
  create(input: { spec?: unknown; envelope?: unknown }): E;
  revise(input: { envelope: unknown; baseHash: string; operations: unknown[] }): Promise<E>;
  hash(envelope: E): Promise<string>;
  /** Artwork for one view, at its printed size. Never shrunk. */
  svg(envelope: E, view: View): string;
}

const family = <E>(f: DiagramFamily<E>) => f as DiagramFamily<unknown>;
/** Families whose create input is the flat spec itself rather than { spec, envelope }. */
const flatCreate = (create: (spec: unknown) => unknown, validate: (raw: unknown) => unknown) =>
  (input: { spec?: unknown; envelope?: unknown }) => {
    if (input.spec !== undefined && input.envelope !== undefined) throw Error("Supply spec or envelope, not both.");
    return input.envelope !== undefined ? validate(input.envelope) : create(input.spec ?? {});
  };
const check = (issue: string | null | undefined) => {
  if (issue) throw Error(issue);
};

export const FAMILIES: Record<DiagramKind, DiagramFamily> = {
  graph: family<graph.GraphEnvelope>({
    kind: "graph",
    label: "coordinate graph",
    summary: "Coordinate grid with points, segments and straight lines (no curves).",
    route: "/tools/graph",
    answerView: true,
    envelopeSchema: graph.envelopeSchema,
    createSchema: z.object({ spec: graph.graphSpecSchema.optional(), envelope: graph.envelopeSchema.optional() }).strict(),
    revisionSchema: graph.revisionSchema,
    validate: (raw) => graph.validateEnvelope(raw, true),
    create: flatCreate(graph.createGraph, (raw) => graph.validateEnvelope(raw, true)) as (i: object) => graph.GraphEnvelope,
    revise: (input) => graph.reviseGraph(input),
    hash: graph.graphHash,
    svg: (e, view) => renderDiagramSvg(graph.documentFromEnvelope(e), view),
  }),
  "ratio-table": family<ratio.RatioEnvelope>({
    kind: "ratio-table",
    label: "ratio table",
    summary: "Lesson-style ratio table, 1 to 3 columns and up to 6 rows, with blanks, hidden answers and curved scaling arrows.",
    route: "/tools/ratio-table",
    answerView: true,
    envelopeSchema: ratio.ratioEnvelopeSchema,
    createSchema: z.object({ spec: ratio.ratioSpecSchema.optional(), envelope: ratio.ratioEnvelopeSchema.optional() }).strict(),
    revisionSchema: ratio.ratioRevisionSchema,
    validate: (raw) => {
      const e = ratio.validateRatioEnvelope(raw);
      ratio.ratioMetrics(e.document);
      return e;
    },
    create: flatCreate(ratio.createRatioTable, ratio.validateRatioEnvelope) as (i: object) => ratio.RatioEnvelope,
    revise: (input) => ratio.reviseRatioTable(input),
    hash: ratio.ratioHash,
    svg: (e, view) => ratio.renderRatioSvg(e.document, view),
  }),
  "value-graph": family<value.ValueEnvelope>({
    kind: "value-graph",
    label: "table of values and graph",
    summary: "Exam table of values with graph paper, plotted points and an optional quadratic curve.",
    route: "/tools/value-table-graph",
    answerView: false,
    envelopeSchema: value.envelopeSchema,
    createSchema: z.object({ envelope: value.envelopeSchema.optional() }).strict(),
    revisionSchema: value.revisionSchema,
    validate: (raw) => value.validate(raw),
    create: (input) => {
      const empty = input.spec === undefined || (typeof input.spec === "object" && input.spec !== null && Object.keys(input.spec).length === 0);
      if (!empty) throw Error("value-graph has no spec settings: leave spec empty for the blank scaffold or supply a full envelope.");
      return value.create(input.envelope);
    },
    revise: (input) => value.revise(input),
    hash: value.contentHash,
    svg: (e) => value.renderSvg(e),
  }),
  cuboids: family<cuboid.Envelope>({
    kind: "cuboids",
    label: "cuboid diagram",
    summary: "One to three cuboids, cubes, cube grids or separated layers with labelled edges.",
    route: "/tools/cuboids",
    answerView: false,
    envelopeSchema: cuboid.envelopeSchema,
    createSchema: cuboidIo.createSchema,
    revisionSchema: cuboidIo.revisionSchema,
    validate: (raw) => {
      const e = cuboid.validate(raw);
      cuboid.renderSvg(e);
      return e;
    },
    create: (input) => cuboidIo.createCuboid(input),
    revise: (input) => cuboidIo.reviseCuboid(input),
    hash: cuboidIo.hash,
    svg: (e) => cuboid.renderSvg(e),
  }),
  "number-line": family<line.Envelope>({
    kind: "number-line",
    label: "number line",
    summary: "Exam number line with intervals, rays or points, open/closed ends and answer-line ticks.",
    route: "/tools/number-line",
    answerView: false,
    envelopeSchema: line.envelopeSchema,
    createSchema: z.object({ spec: line.specSchema.optional(), envelope: line.envelopeSchema.optional() }).strict(),
    revisionSchema: line.revisionSchema,
    validate: (raw) => line.validate(raw),
    create: (input) => {
      if (input.spec !== undefined && input.envelope !== undefined) throw Error("Supply spec or envelope, not both.");
      return input.envelope !== undefined ? line.validate(input.envelope) : line.create(input.spec);
    },
    revise: (input) => line.revise(input),
    hash: line.hash,
    svg: (e) => line.renderSvg(e),
  }),
  venn: family<venn.Envelope>({
    kind: "venn",
    label: "Venn diagram",
    summary: "One, two or three set Venn diagram with members, counts, shading and hidden answers.",
    route: "/tools/venn",
    answerView: true,
    envelopeSchema: venn.envelopeSchema,
    createSchema: vennIo.createSchema,
    revisionSchema: vennIo.revisionSchema,
    validate: (raw, view) => {
      const e = venn.validate(raw);
      vennIo.assertPrintable(venn.forView(e, view));
      return e;
    },
    create: (input) => vennIo.createVenn(input),
    revise: (input) => vennIo.reviseVenn(input),
    hash: vennIo.hash,
    svg: (e, view) => venn.renderSvg(venn.forView(e, view)),
  }),
  "algebra-grid": family<algebra.Envelope>({
    kind: "algebra-grid",
    label: "expanding and factorising grid",
    summary: "Multiplication grid for expanding brackets or factorising, with blank pupil cells.",
    route: "/tools/expanding-factorising",
    answerView: false,
    envelopeSchema: algebra.schema,
    createSchema: algebraIo.createSchema,
    revisionSchema: algebraIo.revisionSchema,
    validate: (raw) => {
      const e = algebra.validate(raw);
      check(algebra.exportIssue(e));
      return e;
    },
    create: (input) => algebraIo.create(input),
    revise: (input) => algebraIo.revise(input),
    hash: algebraIo.hash,
    svg: (e) => algebra.renderSvg(e),
  }),
  "bar-model": family<bar.Envelope>({
    kind: "bar-model",
    label: "bar model",
    summary: "Bar models with one shared unit width, equal sections, braces and answer lines.",
    route: "/tools/bar-model",
    answerView: false,
    envelopeSchema: bar.schema,
    createSchema: barIo.createSchema,
    revisionSchema: barIo.revisionSchema,
    validate: (raw) => {
      const e = bar.validate(raw);
      check(bar.exportIssue(e));
      return e;
    },
    create: (input) => barIo.create(input),
    revise: (input) => barIo.revise(input),
    hash: bar.hash,
    svg: (e) => bar.renderSvg(e),
  }),
  charts: family<chart.Envelope>({
    kind: "charts",
    label: "bar or line chart",
    summary: "Bar, dual, composite and vertical line charts on exam axes, with bars left for pupils.",
    route: "/tools/charts",
    answerView: true,
    envelopeSchema: chart.envelopeSchema,
    createSchema: chartIo.createSchema,
    revisionSchema: chartIo.revisionSchema,
    validate: (raw, view) => {
      const e = chart.validate(raw);
      check(chart.exportIssue(chart.forView(e, view)));
      return e;
    },
    create: (input) => chartIo.create(input),
    revise: (input) => chartIo.revise(input),
    hash: chartIo.hash,
    svg: (e, view) => chart.renderSvg(chart.forView(e, view)),
  }),
  "probability-tree": family<tree.Envelope>({
    kind: "probability-tree",
    label: "probability tree",
    summary: "Exam probability tree, equal or unequal, with blank or hidden branch probabilities.",
    route: "/tools/probability-tree",
    answerView: true,
    envelopeSchema: tree.envelopeSchema,
    createSchema: treeIo.createSchema,
    revisionSchema: treeIo.revisionSchema,
    validate: (raw, view) => {
      const e = tree.validate(raw);
      check(tree.exportIssue(tree.forView(e, view)));
      return e;
    },
    create: (input) => treeIo.create(input),
    revise: (input) => treeIo.revise(input),
    hash: tree.hash,
    svg: (e, view) => tree.renderSvg(tree.forView(e, view)),
  }),
  "frequency-tree": family<ftree.Envelope>({
    kind: "frequency-tree",
    label: "frequency tree",
    summary: "Exam frequency tree: a total split into groups (2-3 branches, up to 2 levels) with counts in ovals, blank or hidden for pupils.",
    route: "/tools/frequency-tree",
    answerView: true,
    envelopeSchema: ftree.envelopeSchema,
    createSchema: ftreeIo.createSchema,
    revisionSchema: ftreeIo.revisionSchema,
    validate: (raw, view) => {
      const e = ftree.validate(raw);
      check(ftree.exportIssue(ftree.forView(e, view)));
      return e;
    },
    create: (input) => ftreeIo.create(input),
    revise: (input) => ftreeIo.revise(input),
    hash: ftree.hash,
    svg: (e, view) => ftree.renderSvg(ftree.forView(e, view)),
  }),
  triangle: family<triangle.Envelope>({
    kind: "triangle",
    label: "triangle diagram",
    summary: "Triangle diagrams for Pythagoras, trigonometry, sine/cosine rule and area, with answer lines.",
    route: "/tools/triangle",
    answerView: false,
    envelopeSchema: triangleIo.wireEnvelopeSchema,
    createSchema: triangleIo.createSchema,
    revisionSchema: triangleIo.revisionSchema,
    validate: (raw) => {
      const e = triangle.validate(raw);
      triangleIo.assertPrintable(e);
      return e;
    },
    create: (input) => triangleIo.create(input),
    revise: (input) => triangleIo.revise(input),
    hash: triangleIo.hash,
    svg: (e) => triangle.renderSvg(e),
  }),
  construction: family<construction.Envelope>({
    kind: "construction",
    label: "construction drawing",
    summary: "True-size constructions, loci, scale drawings, maps and bearings: points, lines, compass arcs, bisectors, shaded regions and north lines; constructions saved as hidden answers.",
    route: "/tools/construction",
    answerView: true,
    envelopeSchema: construction.envelopeSchema,
    createSchema: constructionIo.createSchema,
    revisionSchema: constructionIo.revisionSchema,
    validate: (raw, view) => {
      const e = construction.validate(raw);
      check(construction.exportIssue(construction.forView(e, view)));
      return e;
    },
    create: (input) => constructionIo.create(input),
    revise: (input) => constructionIo.revise(input),
    hash: construction.hash,
    svg: (e, view) => construction.renderSvg(construction.forView(e, view)),
  }),
};

export function familyOf(kind: string): DiagramFamily {
  const f = (FAMILIES as Record<string, DiagramFamily | undefined>)[kind];
  if (!f) throw Error(`Unknown diagram kind "${kind}". Use one of: ${DIAGRAM_KINDS.join(", ")}.`);
  return f;
}

/** Printed size of an SVG root in millimetres, whatever unit (mm, cm, in, pt) it states. */
export function svgSizeMm(svg: string): { width: number; height: number } {
  const tag = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const read = (name: string) => {
    const m = tag.match(new RegExp(`\\s${name}="([\\d.]+)(mm|cm|in|pt)?"`));
    if (!m) return NaN;
    const k = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 }[(m[2] ?? "mm") as "mm"];
    return Number(m[1]) * k;
  };
  return { width: read("width"), height: read("height") };
}

/** Short alt text: the artwork's own aria-label when it has one, else the family name. */
export function altText(kind: DiagramKind, svg: string): string {
  const label = svg.match(/<svg\b[^>]*\saria-label="([^"]*)"/)?.[1] ?? svg.match(/<title\b[^>]*>([^<]*)<\/title>/)?.[1];
  const text = label?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
  const name = FAMILIES[kind].label;
  return text ? text : `${name[0].toUpperCase()}${name.slice(1)}`;
}

/**
 * Artwork for a worksheet or booklet: the family's own SVG at its printed size, with the larger
 * of the pupil and answer sizes so both copies share one layout.
 */
export function drawDiagram(kind: DiagramKind, envelope: unknown, view: View) {
  const f = FAMILIES[kind];
  // Embedded artwork starts at its <svg> element: no XML declaration inside a page.
  const bare = (svg: string) => svg.replace(/^\s*<\?xml[^>]*\?>\s*/, "").trimStart();
  const pupil = bare(f.svg(envelope, "pupil"));
  const answer = f.answerView ? bare(f.svg(envelope, "answer")) : pupil;
  const a = svgSizeMm(pupil),
    b = svgSizeMm(answer);
  return {
    svg: view === "answer" ? answer : pupil,
    widthMm: Math.max(a.width, b.width),
    heightMm: Math.max(a.height, b.height),
    altText: altText(kind, pupil),
  };
}

/** Readable field-named problems from a zod error, e.g. "spec.series.0.values: Expected array". */
export function describeIssues(error: unknown, limit = 6): string | null {
  if (!(error instanceof z.ZodError)) return null;
  const lines = error.issues.slice(0, limit).map((i) => `${i.path.length ? i.path.join(".") : "input"}: ${i.message}`);
  if (error.issues.length > limit) lines.push(`(${error.issues.length - limit} more)`);
  return lines.join("; ");
}

/** The families whose outputView "answer" draws a teacher copy, for error messages. */
export const ANSWER_VIEW_KINDS = DIAGRAM_KINDS.filter((k) => FAMILIES[k].answerView).join(", ");
