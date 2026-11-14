/**
 * Connector guidance for each diagram family: the limits, options and operation notes that
 * diagram_capabilities returns on request. Kept out of tools/list so a chat only pays for the
 * families it uses. Only the MCP service imports this module.
 */
import { z } from "zod";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "./registry";
import * as graph from "../../graph-core/src/interchange";
import * as ratio from "../../ratio-table-core/src/interchange";
import * as ci from "../../cuboid-core/src/interchange";
import * as line from "../../number-line-core/src/index";
import * as venn from "../../venn-core/src/index";
import * as vi from "../../venn-core/src/interchange";
import { algebraConfig } from "./guides/algebra";
import { barConfig } from "./guides/bar";
import { chartConfig } from "./guides/chart";
import { treeConfig } from "./guides/probability-tree";
import { frequencyTreeConfig } from "./guides/frequency-tree";
import { triangleConfig } from "./guides/triangle";

export interface FamilyGuide {
  /** Limits, versions and option lists. */
  capabilities: Record<string, unknown>;
  /** How to write create_diagram's spec for this family. */
  create: string;
  /** The revise_diagram operations and their rules. */
  revise: string;
}

const graphGuide: FamilyGuide = {
  capabilities: {
    rendererVersion: graph.RENDERER_VERSION,
    objects: ["point", "segment", "line"],
    unitsPerSquare: "any positive scale per 1 cm square, such as 0.5, 1, 2, 5, 10, 20, 25, 50; minutes for time axes",
    commonUnitsPerSquare: [0.5, 1, 2, 5, 10, 20, 25, 50],
    axisOptions: ["origin", "labelEvery (1-10)", "format: number | time", "title"],
    grids: ["1cm", "5mm", "2mm", "none"],
    originLabels: ["0", "O"],
    objectNames: "A, B, P′, L, L1, L2 (capital letter, optional prime, optional subscript number)",
    squares: { x: [2, 18], y: [2, 26] },
    maximumObjects: 50,
    maximumRequestBytes: graph.MAX_REQUEST_BYTES,
    defaultAxes: {
      x: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
      y: { negativeSquares: 5, positiveSquares: 5, unitsPerSquare: 1 },
    },
    revisionOperations: ["add_object", "replace_object", "remove_object", "set_axes", "set_label", "set_grid", "set_name"],
  },
  create:
    "One-centimetre grid squares with points, segments and straight lines; no curves. spec is {schemaVersion?:1, axes, grid?, originLabel?, objects}: supply exact square counts and scales. Fractions such as 1/2 are supported. Keep equationVisible false unless the user explicitly asks to print, show or label the equation; plotting y = 2x + 1 alone gives an unlabelled line. A point, segment end or line may sit anywhere, including off the grid, for example a deliberate non-perfect point in a spot-the-mistake question: coordinates need not be on grid lines or crossings (e.g. {x:3,y:2.6}); only parts inside the axes are drawn. " +
    "Edexcel style: originLabel \"O\" prints an italic O; name:\"L\" (or \"L1\", \"L2\") prints a bold line name beside the line; a point with name:\"A\" prints an italic A beside its cross. Names never reveal answers, so add them only when the question names the object. " +
    "Hidden answers: answerOnly:true on a point, segment or line draws it in the answer colour only on the answers copy (outputView answer, or a worksheet's answers view); the pupil copy keeps the grid blank. Use it for the line or shape a pupil is asked to draw; ask for outputView answer only when the user wants the answers copy. " +
    "Real-life graphs: each axis takes unitsPerSquare (any positive scale per 1 cm square, e.g. 5, 10, 25), origin (value where the axes cross), labelEvery (number every nth 1 cm line), format \"time\" (values are minutes after midnight, printed 12 00) and title (words and unit, e.g. \"Distance from home (km)\", replacing the italic letter). grid \"2mm\" or \"5mm\" adds a fine grid inside heavier 1 cm lines; points and line ends may sit on fine lines. " +
    "Sketch questions: grid \"none\" draws sketch axes (no grid, no axis numbers, just the axes with x, y and, with originLabel \"O\", an italic O). Squares still set the size and scale. A segment or line takes labels: up to 4 {at:{x,y}, text, side?} short texts such as \"3\", \"-2\" (printed −2) or \"(0, 3)\" beside a point, usually where it crosses an axis; side defaults to the free corner left of the y-axis or below the x-axis. Labels follow the line's answerOnly, so a sketch answer is a line with answerOnly:true and its intercept labels, and the pupil copy is blank axes. " +
    "Example travel graph 12 00 to 14 30, 0 to 30 km: axes {x:{negativeSquares:0,positiveSquares:15,unitsPerSquare:10,origin:720,labelEvery:3,format:\"time\",title:\"Time of day\"}, y:{negativeSquares:0,positiveSquares:6,unitsPerSquare:5,labelEvery:2,title:\"Distance from home (km)\"}}, grid \"2mm\", segments in minutes and km such as {kind:\"segment\",start:{x:720,y:0},end:{x:765,y:25}}.",
  revise:
    "Operations apply atomically. replace_object keeps the ID (use it to change a line's labels); set_label shows, hides or moves a line equation; set_axes sets both axes (include every axis option you want to keep); set_grid {grid?, originLabel?} changes the grid or origin mark; set_name {id, name?: string|null, position?: {x,y}|null} names, renames, unnames or moves an object's printed name. Keep label visibility, names, axis settings and unchanged objects unless asked. A human editable JSON with a legacy font converts to the portable print font with a warning.",
};

const ratioGuide: FamilyGuide = {
  capabilities: {
    rendererVersions: [ratio.RATIO_RENDERER_VERSION, ratio.RATIO_THREE_COLUMN_RENDERER_VERSION],
    styleProfile: ratio.RATIO_STYLE_PROFILE,
    /** Legacy defaults, not limits: a bare create gives two columns with ratio-1. */
    columns: 2,
    rendererVersion: ratio.RATIO_RENDERER_VERSION,
    supportedColumns: [1, 2, 3],
    rows: { minimum: 1, maximum: 6 },
    cellKinds: ["number", "empty", "answer-line", "hidden"],
    headingDirections: ["right", "up", "down", "none"],
    compactSpec: { columns: "heading strings ending in → ↑ ↓", table: "rows of cell strings: 3, -1/2, \"\", _, [3], [3]_", steps: "\"\", × 2, ÷ 2, [÷ 2]" },
    sizes: ["compact", "standard", "large"],
    modes: ["simple", "annotated"],
    maximumRequestBytes: ratio.RATIO_MAX_REQUEST_BYTES,
    maximumRevisionOperations: 20,
    numberLimits: ratio.NUMBER_LIMITS,
    revisionOperations: ratio.ratioOperationSchema.options.map((o) => o.shape.op.value),
  },
  create:
    "Lesson-style ratio table with 1-6 rows and 1-3 columns; omit spec for a blank two-column table with two empty rows. spec.schemaVersion 1 is two columns with at least two rows; 2 is one row, one column or three columns. Each row has one explicit cell per column: {kind:number,value:string}, {kind:empty}, {kind:answer-line} or {kind:hidden,value,line?} (a saved answer: blank, or an answer line with line:true, in the pupil copy; printed in the answer colour only in the answers copy, outputView answer). A transition with hidden:true prints its operation only in the answers copy; pupils get an answer line beside the arrow. Row IDs default to row-1, row-2. A transition between adjacent rows applies one operation to every column. mode annotated shows the curved arrows and factors; simple hides them. Default headings x → and y ↑; direction is right, up, down or none (y ↓ for a negative gradient). Compact form for booklets and worksheets with many tables, instead of headings/rows/transitions: {columns:[\"x →\",\"y ↓\"], table:[[\"2\",\"6\"],[\"1\",\"[3]\"]], steps:[\"[÷ 2]\"]}. A cell is \"3\", \"-1/2\", \"2 1/2\" (a mixed number), \"\" (empty), \"_\" (answer line), \"[3]\" (hidden answer) or \"[3]_\" (hidden answer on an answer line); a step is \"\" (none), \"× 2\" or \"÷ 2\", in brackets to hide it; any step turns the arrows on. Numbers (cells, hidden answers and factors) are integers, decimals (up to 6 places), fractions such as 5/2, or mixed numbers such as \"2 1/2\" or \"2½\" (saved as \"2 1/2\"; the fraction part is less than 1). Fractions always print stacked; a mixed number prints the whole number beside a stacked fraction. Write the number in the form pupils should see: 5/2 stays improper and 2 1/2 stays mixed. Keep unanswered cells even when the answer is calculable.",
  revise:
    'Each operation is {op,...}: add_column {heading:{text,italic,direction}}; remove_column {column}; set_cell {rowId,column,cell}; add_row {after,row:{id,cells}}; remove_row {rowId}; set_transition {transition:{from,to,operation,factor}}; remove_transition {from}; set_headings {headings}; set_size {size}; set_annotation_visibility {mode?,showArrows?,showOperations?}; fill_next_row {from,overwrite?}. Example: {"op":"set_transition","transition":{"from":"start","to":"target","operation":"multiply","factor":"4"}}. Column indexes are zero-based; after is a row ID or null. fill_next_row solves only when the user explicitly asks, and overwriting needs overwrite:true. Row and column changes renormalise to schemaVersion 1/ratio-1 (two columns, two or more rows) or 2/ratio-2.',
};

const valueGuide: FamilyGuide = {
  capabilities: {
    rendererVersion: "value-graph-1",
    columns: { minimum: 2, maximum: 13 },
    maximumPoints: 40,
    maximumRevisionOperations: 40,
    numberNotation: "Numeric strings: integers, decimals up to 6 places and fractions. Exact until explicit table-display rounding.",
    print: { axisFontPt: 12, gridPitchMm: [2, 10, 20], gridStrokePt: [0.51, 1.02, 1.417], defaultXUnitsPerCm: "1/2", defaultYUnitsPerCm: "1" },
    cellKinds: ["value", "blank", "answer-line"],
    connections: ["none", "straight-joins"],
  },
  create:
    "Table of values and exam graph paper, for partial tables, quadratic curves and deliberate straight-join errors. Omit envelope for the June 2018 scaffold with five blank y cells and nothing plotted; there is no spec. To customise, supply a full schemaVersion 1 / value-graph-1 / exam-v1 envelope. Columns are {id,x,y} with y {kind:blank|answer-line} or {kind:value,value}. A curve is graph.curves {id,equation:{a,b,c},min,max}; straight joins are a series connection, never a curve.",
  revise:
    "References use stable IDs, not indexes. set_equation {equation:{a,b,c}}; set_cell {columnId,x?,y?}; insert_column {afterId,column}; remove_column {columnId}; replace_columns {columns}; calculate_cells {columnIds,overwrite} (the only operation that supplies answers; replacing values needs overwrite:true); set_graph {settings}; plot_series {id,source:table|equation,columnIds,connection}; put_series {series}; remove_series {id}; set_connection {id,connection}; move_point {seriesId,pointId,x,y,linked:update-table|detach}; set_curve {curve|null}; set_reference_lines {lines:[{id,y}]}; set_presentation {settings}; set_print {settings}. plot_series source:table skips blanks and includes zero; source:equation calculates points without filling the table.",
};

const cuboidGuide: FamilyGuide = {
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
    maximumRevisionOperations: 30,
    operations: ci.operationSchema.options.map((o) => o.shape.op.value),
    cubeLock: "set_cube enabled:true requires referenceAxis unless already locked",
    units: ["cm", "mm", "m"],
  },
  create:
    "One to three cuboids, cubes, cube grids or separated layers; omit spec for one unworked version-2 cuboid. spec.shapes: [{dimensions:{width,depth,height}, unit, labels, presentation}]; omitted fields take unworked defaults. New requests use cuboids-2; older envelopes keep their version. Artwork is cropped at unchanged scale. Large layer and cube combinations may exceed print limits.",
  revise:
    "add_shape {afterId?,shape}; remove_shape {id}; replace_shape {id,shape} keeps the ID; set_dimension {id,axis:width|depth|height,value}; set_unit {id,unit} converts dimensions; set_cube {id,enabled,referenceAxis?} needs an explicit reference when enabling; set_cube_side {id,value} in the displayed unit; set_view {id,view}; set_projection {id,direction?,projection?,schematic?,proportions?}; set_label {id,key,label}; set_appearance {id,appearance}; set_presentation {id,settings}; set_print {widthCm}; upgrade_document {} (needed before version-2 appearance on legacy files). Worked calculations stay explicit; custom captions are kept.",
};

const lineGuide: FamilyGuide = {
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
  },
  create:
    "Examination number line; omit spec for a blank -5 to 5 axis. spec:{axis?,solution?,teaching?,widthCm?}. axis has minimum, maximum and step as numeric strings (integers, decimals, fractions such as 3/2, or mixed numbers such as \"1 1/2\" or \"1½\", saved as 3/2); axis.numberFormat is decimal (decimals where exact), fraction (stacked, improper: 3/2) or mixed (stacked, mixed: 1 and a half); fractions always print stacked; solution is null, interval, ray or points with stable IDs. Keep solutionVisible, tick-label answer lines, prompt and answer visibility.",
  revise:
    "set_axis {axis}; set_solution {solution}; set_endpoint {id,endpoint:lower|upper|value,value?,included?}; add_point {point}; set_point {id,value?,included?}; connect_points {interval:{id,from,to}}; remove_interval {id}; remove_point {id} (also removes its joins); set_tick_label {value,state:value|hidden|answer-line}; set_presentation {teaching}; set_print {widthCm}. Axis changes never silently discard solutions; a truncated ray needs intentional:true.",
};

const vennGuide: FamilyGuide = {
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
    fontPt: { minimum: 10, maximum: 14 },
    lines: ["normal", "bold"],
    maximumRevisionOperations: 30,
    regionMasks: "0=outside; A=bit1, B=bit2, C=bit4; use only active masks for the layout",
    visibility: venn.visibility,
    regionKinds: venn.kinds,
    operations: vi.operationSchema.options.map((o) => o.shape.op.value),
  },
  create:
    "One, two or three set Venn diagrams; omit spec for a blank two-set version-2 overlap. spec: {sets, shape, arrangement, widthCm, fontPt (10-14), lines (normal|bold; bold prints every stroke 1.5 times as thick), labels:[{set,label}], definitions:[{set,text}], regions:[{mask,region}], showDefinitions, caption}. Region mask 0 is outside; bits A=1 B=2 C=4. Arrangements overlap, separate, b-inside-a, a-inside-b (non-overlap only with two sets). Region kind and show/hidden/line visibility are explicit; zero is not blank. outputView answer must be explicitly requested.",
  revise:
    "set_region {mask,region}; set_label {set:universe|A|B|C,label}; set_definition {set,text}; set_definitions_visible {visible}; set_layout {sets?,shape?,arrangement?,caption?,discardIncompatible?}; shade_regions {masks,style:none|grey|hatch,mode:replace|add}; shade_expression {expression,style,mode}; clear_shading {}; set_print {widthCm?,fontPt?,lines?}; upgrade_document {}. Expressions use A/B/C, union, intersection, complement and brackets. Lossy layout changes need the user's explicit discard request and discardIncompatible:true; never merge values. Legacy files need an explicit upgrade for new layouts.",
};

const fromConfig = (c: { capabilities: Record<string, unknown>; createDescription: string; reviseDescription: string }): FamilyGuide => ({
  capabilities: c.capabilities,
  create: c.createDescription,
  revise: c.reviseDescription,
});

export const GUIDES: Record<DiagramKind, FamilyGuide> = {
  graph: graphGuide,
  "ratio-table": ratioGuide,
  "value-graph": valueGuide,
  cuboids: cuboidGuide,
  "number-line": lineGuide,
  venn: vennGuide,
  "algebra-grid": fromConfig(algebraConfig),
  "bar-model": {
    capabilities: { ...barConfig.capabilities, maximumRequestBytes: 32768 },
    create:
      "Bar models keep one shared unit width and stable anchored spans; labels never set widths or calculate answers. For horizontal working fractions and 12 mm above / 3 mm below handwriting space request spec.schemaVersion:3 explicitly (explicit 2 and bare legacy requests keep their versions). V3 Maths captions stack simple a/b fractions; Plain text is explicit for dates and literal slashes; ambiguity is refused, never silently changed. " +
      barConfig.createDescription,
    revise:
      "Deleting structure a span refers to needs explicit span removal or discard intent. upgrade_document {targetSchemaVersion:3} upgrades an older file; without a target it still means v1 to v2. " +
      barConfig.reviseDescription,
  },
  charts: fromConfig(chartConfig),
  "probability-tree": fromConfig(treeConfig),
  "frequency-tree": fromConfig(frequencyTreeConfig),
  triangle: {
    ...fromConfig(triangleConfig),
    create: "Triangle keeps explicit labels, topology and saved answers; calculate only when the user asks, and never measure drawn proportions. " + triangleConfig.createDescription,
  },
};

const jsonSchema = (schema: z.ZodType) => {
  const s = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
};
const cache = new Map<DiagramKind, Record<string, unknown>>();
/** Everything diagram_capabilities returns for one family, built once per process. */
export function familyCapabilities(kind: DiagramKind): Record<string, unknown> {
  let v = cache.get(kind);
  if (!v) {
    const f = FAMILIES[kind],
      g = GUIDES[kind];
    const create = jsonSchema(f.createSchema) as { properties?: Record<string, unknown> };
    const revise = jsonSchema(f.revisionSchema) as { properties?: Record<string, unknown> };
    v = {
      kind,
      label: f.label,
      summary: f.summary,
      editor: `https://mathsdock.co.uk${f.route}`,
      answerView: f.answerView,
      printDpi: 600,
      ...g.capabilities,
      createGuide: g.create,
      reviseGuide: g.revise,
      // The envelope is copied back from a previous result, so only the parts a model writes are listed.
      specSchema: create.properties?.spec ?? null,
      operationsSchema: revise.properties?.operations ?? null,
    };
    cache.set(kind, v);
  }
  return v;
}

/** The short family list diagram_capabilities returns without a kind. */
export const FAMILY_LIST = DIAGRAM_KINDS.map((kind) => ({ kind, summary: FAMILIES[kind].summary, answerView: FAMILIES[kind].answerView }));
