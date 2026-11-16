import * as core from "../../../figure-core/src/index";
import * as ai from "../../../figure-core/src/interchange";
export const figuresConfig = {
  capabilities: {
    editor: "The returned editor link opens the figure at /tools/figures, where teachers drag points, label sides and angles, and save or print.",
    schemaVersions: [1],
    rendererVersions: [core.RENDERER_VERSION],
    units: "mm on the printed page, y up; keep everything within 150 mm of (0, 0). A figure 60 to 120 mm wide suits a worksheet.",
    placeTypes: {
      free: "{type:'free', x, y}",
      on: "{type:'on', circle, deg}: on a circle, deg anticlockwise from the right of its centre (90 is the top)",
      along: "{type:'along', a, b, t}: on the line through a and b; t 0 at a, 1 at b, 0.5 the midpoint, beyond 0-1 extends past the ends",
      meet: "{type:'meet', a, b, c, d}: where line ab meets line cd (chords crossing, a point on two straight lines)",
      tangent: "{type:'tangent', at, mm}: mm along the tangent at point at (which must be 'on' a circle); positive goes anticlockwise round the circle",
      tangents: "{type:'tangents', a, b}: where the tangents at a and b (on the same circle) meet",
      foot: "{type:'foot', from, a, b}: foot of the perpendicular from a point to line ab",
    },
    pointShows: core.SHOWS,
    lineStyles: core.STYLES,
    labelStates: core.STATES,
    marks: core.MARKS,
    limits: core.LIMITS,
    fontPt: { minimum: 10, maximum: 14, default: 11 },
    examples: ai.exampleIds,
    maximumRevisionOperations: 40,
    operations: ai.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; the answers copy prints saved answers in the answer colour in place of the labels",
    hiddenAnswers: "A side or angle label's answer is saved but prints only on the answers copy. value labels are givens and never hold an answer.",
  },
  createDescription:
    'Geometry figures in Edexcel style, "Diagram NOT accurately drawn" by default: named points, circles, chords, tangents, straight lines, side lengths and marked angles. Use for circle theorems, similar and congruent shapes, parallel lines in triangles and geometric proofs. spec: {example?|points, circles?, segments?, angles?, fills?, captions?, settings?}. ' +
    "points: [{id, place, name?:'A', show?:'dot'|'cross'}]; ids are short lower case (a, b2, o). Place each point exactly by its geometry (placeTypes in diagram_capabilities) so the figure stays true when points move: points on a circle 'on', a tangent's ends 'tangent', the external point of two tangents 'tangents', chords crossing 'meet', a point on a side 'along'. A circle's centre is a 'free' point, usually with show:'dot' and name 'O'. " +
    "circles: [{id, centre, r}] (mm). segments: [{id, a, b, label?, style?:'dashed', extend?:[mm past a, mm past b], ticks?:1-3 (equal sides), arrows?:1-3 (parallel, pointing a to b), side?}]. Draw only lines the paper's diagram draws. label {text:'9 cm'} is a given length (state value); {text:'x'} a letter; no text a blank; give answer only if the user asks. " +
    "angles: [{id, at, from, to, label?, mark?}] the angle at vertex at, sweeping ANTICLOCKWISE from the arm towards from to the arm towards to (swap from and to for the other side). label {text:'62'} prints 62°; a letter {text:'x'} prints x°. mark arc (default), double, triple (matching angles in similar shapes), right, none. " +
    "fills: [{id, points:[...]}] grey regions. captions: [{id, x, y, text:'Triangle A', bold?}] (mm, the text's centre). Two separate shapes (similar pairs) are just points set side by side. Never calculate or fill answers unless asked. outputView pupil (default) or answer.",
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 40 operations, applied together then checked once: set_point {point}, set_circle {circle}, set_segment {segment}, set_angle {angle}, set_fill {fill}, set_caption {caption} each add the object or change only the fields given on an existing id; remove {what:'point'|'circle'|'segment'|'angle'|'fill'|'caption', id} (a point still used by another object is refused: remove the users first, earlier in the same list); set_settings {settings}. Keep unchanged objects and settings.",
};
