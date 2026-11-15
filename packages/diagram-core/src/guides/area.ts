import * as core from "../../../area-core/src/index";
import * as ai from "../../../area-core/src/interchange";
export const areaConfig = {
  capabilities: {
    editor: "The returned editor link opens the diagram at /tools/area, where teachers change the shape, label sides, and save or print.",
    schemaVersions: [1],
    rendererVersions: ["area-1"],
    presets: core.PRESETS,
    labelIds: {
      polygon: "e<k> side k (corner k to corner k+1; for a semicircle side, its arc), h<i> dashed height i, area inside",
      circle: "full: r (radius line) or d (diameter line), arc (circumference), area; semicircle: d, arc, area; quarter/sector: r, r2 (the two radii), angle, arc, area",
      hole: "rectangle: hw, hh; circle: hr (draws its radius)",
    },
    pointIds: "polygon: v1 ... (corners); circle: o (centre), a, b (line or radius ends)",
    labelStates: core.STATES,
    corners: { minimum: core.MIN_CORNERS, maximum: core.MAX_CORNERS, rangeMm: 150 },
    fontPt: { minimum: 10, maximum: 14, default: 11 },
    examples: ai.exampleIds,
    maximumRevisionOperations: 30,
    operations: ai.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; the answers copy prints saved answers in the answer colour in place of the labels",
    hiddenAnswers: "A label's answer is saved but prints only on the answers copy. value labels are given lengths and never hold an answer.",
  },
  createDescription:
    'Area and perimeter diagrams, "Diagram NOT accurately drawn" by default: the drawing never has to match the numbers. spec: {example?|preset?, shape?, hole?, labels?, names?, settings?, worked?}. ' +
    'preset: rectangle, l-shape, t-shape, u-shape, triangle, parallelogram, trapezium, house, rectangle-semicircle, rectangle-cut, frame, circle, semicircle, quarter, sector. ' +
    'shape: {type:"polygon", corners:[{x,y}] in mm anticlockwise | outline:[{dir:"right|up|left|down", length}] from the bottom left going right first, the last move closing, arcs?:["none"|"out"|"in" per side] (a semicircle on the side, added or cut out), heights?:[{corner, side}] (dashed, right-angle mark), rightAngles?:[corner]} | {type:"circle", part:"full|semicircle|quarter|sector", radiusMm (10-80), angleDeg (sector), line?:"radius|diameter|none" (full only), centre?}. ' +
    'hole: {type:"rectangle", x, y, w, h} | {type:"circle", x, y, r} | null, inside the shape in the same mm. ' +
    'labels: [{id, text?, state?, answer?}]. id from labelIds. text "8 cm" or "2x + 1" is given (value); a letter "x" is a symbol; no text is blank. answer is saved and printed only on the answers copy (exact: "25π cm²"); a label with only an answer is hidden. a/b prints as a stacked fraction; ^2 as ². ' +
    'names: [{point, text:"A"}]. settings: {shaded:"none|shape|hole", grid (1 cm squares at true size), notToScale, fontPt, lines}. Rectilinear lengths that cannot fit and a diameter that is not twice the radius come back as warnings; nothing is corrected.',
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 30 operations: set_shape {preset?|shape?, hole?, dropMissing?} (keeps settings it does not mention; refuses to drop labels or names the new shape lacks unless dropMissing:true); set_label {label:{id, text?, state?, answer?}}; remove_label {id}; set_name {name:{point, text}} (empty text removes); set_settings {settings}.",
};
