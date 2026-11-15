import * as core from "../../../angle-core/src/index";
import * as ai from "../../../angle-core/src/interchange";
export const anglesConfig = {
  capabilities: {
    editor: "The returned editor link opens the diagram at /tools/angles, where teachers change the figure, mark and label angles, and save or print.",
    schemaVersions: [1],
    rendererVersions: [core.RENDERER_VERSION],
    figures: core.FIGURES,
    angleIds: {
      "straight-line": "s1, s2 ... anticlockwise from the right-hand end of the line (s1 is between the line's right end and the lowest-direction ray)",
      point: "s1, s2 ... anticlockwise, s1 starting at the lowest-direction ray",
      crossing: "s1 to s4 (two lines) or s1 to s6 (three), anticlockwise from the lowest direction; s1 and s3 are vertically opposite with two lines",
      parallel: "p<line>-<ur|ul|ll|lr>: line 1 is the top line; ur = above the line, right of the transversal; ul above left; ll below left; lr below right. p1-ur and p2-ur are corresponding; p1-lr and p2-ul are alternate; p1-lr and p2-ur are co-interior",
      polygon: "i1 ... interior angle at corner k (corner 1 is the bottom left of a regular polygon, then anticlockwise); e<k> is the exterior angle where the side into corner k is extended (only when k is in exterior)",
    },
    pointIds: {
      "straight-line": "left, right, o (the vertex), r1 ... (ray ends)",
      point: "o, r1 ...",
      crossing: "o, r1 ... (line ends)",
      parallel: "l<k>a / l<k>b (left/right ends of line k), x<k> (crossings), ta / tb (transversal ends)",
      polygon: "v1 ... (corners), e<k> (end of an extended side)",
    },
    labelStates: core.STATES,
    marks: core.MARKS,
    sides: { minimum: core.MIN_SIDES, maximum: core.MAX_SIDES },
    sizeMm: { minimum: 30, maximum: 140 },
    fontPt: { minimum: 10, maximum: 14, default: 11 },
    examples: ai.exampleIds,
    maximumRevisionOperations: 30,
    operations: ai.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; the answers copy prints saved answers in the answer colour in place of the labels",
    hiddenAnswers: "An angle's answer is saved but prints only on the answers copy. value labels are given sizes and never hold an answer.",
  },
  createDescription:
    'Angle facts diagrams, always "Diagram NOT accurately drawn" by default: the drawing never has to match the numbers. spec: {example?|figure?, angles?, names?, settings?, worked?}. ' +
    'figure: {type:"straight-line", rays:[48,115]} (1-5 ray directions in degrees, 5-175, measured anticlockwise from the right) | {type:"point", rays:[10,105,200,285]} (2-8, 0-360) | {type:"crossing", lines:[20,75]} (2-3 straight lines through one point, 0-179) | {type:"parallel", count?:2|3, gapMm?, crossDeg?:20-160 (the transversal\'s angle to the parallels), arrows?:0-3} | {type:"polygon", sides:3-10, corners?:[{x,y}...] in mm anticlockwise for an irregular convex polygon (omit for regular), exterior?:[corner numbers whose incoming side is extended], diagonals?:true (dashed, from corner 1), ticks?: one number or one per side}. ' +
    'angles: [{id, text?, state?, answer?, mark?, shade?}]. id is a slot from angleIds (diagram_capabilities). text "62" or "3x + 10" is a given size (state value; printed 62° and (3x + 10)°); a letter "x" is a symbol printed as typed; no text is a blank arc. answer is saved and printed only on the answers copy, in place of the label: give it only if the user asks for answers. mark: arc (default), double, triple, right, none. shade:true greys the angle for teaching (alternate/corresponding pairs). Unlisted angles are not marked. ' +
    'names: [{point, text:"A"}] letters beside points (pointIds). settings: {turnDeg, sizeMm, notToScale, fontPt, lines}. Sizes that cannot all be right (a straight line not adding to 180, unequal vertically opposite or corresponding angles, a polygon sum) come back as warnings unless the user wants a deliberate error. Never calculate or fill answers unless asked. outputView pupil (default) or answer.',
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 30 operations: set_figure {figure, dropMissing?} (keeps the current numbers it does not mention; refuses to drop labelled angles or names the new figure lacks unless dropMissing:true); set_angle {angle:{id, text?, state?, answer?, mark?, shade?}} adds or changes one angle; remove_angle {id}; set_name {name:{point, text}} (empty text removes); set_settings {settings}. Keep unchanged angles and settings.",
};
