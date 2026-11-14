import * as core from "../../../construction-core/src/index";
import * as ci from "../../../construction-core/src/interchange";
export const constructionConfig = {
  capabilities: {
    editor: "No website editor yet (it is the next step); reopen a drawing from its JSON envelope.",
    schemaVersions: [1],
    rendererVersions: ["construction-1"],
    units: "centimetres, y upwards, origin at the bottom-left corner of the drawing area; printed at true size (1 cm prints as 1 cm)",
    widthCm: core.WIDTH,
    heightCm: core.HEIGHT,
    grids: ["none", "cm"],
    maximumPoints: core.MAX_POINTS,
    maximumObjects: core.MAX_OBJECTS,
    objectTypes: ["segment", "arc", "angle", "north", "bearing", "polygon", "text", "region"],
    constructions: ci.constructionInput.options.map((o) => o.shape.type.value),
    regionRules: ["distance {from, distance, side: within|beyond}", "closer {to, than}", "inside {shape, side}"],
    examples: ci.exampleIds,
    roles: "given (both copies) or answer (answers copy only); labels also have their own hidden state",
    maximumRevisionOperations: 30,
    operations: ci.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep the saved roles",
  },
  createDescription:
    "Constructions, loci, scale drawings, maps and bearings drawn at TRUE SIZE in centimetres (y up, origin bottom-left of the drawing area), so pupils can measure and construct on the printed sheet with ruler, compasses and protractor. Edexcel look: points are crosses with italic letters, north lines have an arrow and N, the scale sits in a box under the drawing. " +
    "spec: {example?|points?,objects?,constructions?, widthCm, heightCm, grid?: none|cm, border?, caption? (e.g. \"Scale: 1 cm represents 4 km.\"), captionHidden?, worked?}. Make the drawing area big enough to construct in (arcs reach beyond the lines). " +
    "points:[{id:\"A\",x:2,y:3,label? (defaults to id; \"\" for none),labelAt?: auto|n|ne|e|se|s|sw|w|nw, mark?: cross|dot|none, labelHidden?, answer?}]. " +
    "objects (each with optional id and answer): segment {from,to,extend?:[cmBeyondFrom,cmBeyondTo] for lines/rays,dash?,label? e.g. \"7 cm\",labelHidden?,measure?:{scaleCm,represents,unit}}; arc {center,radius,start,sweep} in degrees anticlockwise from east (sweep 360 = circle); angle {at,from,to,style?:arc|right,reflex?,label? e.g. \"64°\" or \"x\",measure?:true}; north {at,length? cm}; bearing {from,to,northLine? (default true),label? e.g. \"070°\",measure?:true} draws the clockwise arc from north; polygon {points:[ids]}; text {x,y,text,italic?}; region {rules,pattern?: hatch|cross} hatches the points meeting EVERY rule: {kind:\"distance\",from:pointOrSegmentId,distance,side:\"within\"|\"beyond\"}, {kind:\"closer\",to,than} (two points = perpendicular-bisector side; two segments = angle-bisector side), {kind:\"inside\",shape:polygonId,side}. " +
    "constructions (explicit ruler-and-compasses helpers; answer defaults to TRUE so pupils see only the starting lines): perpendicular-bisector {a,b,radius?,extend? cm past the arcs,reach? segment id to run the line on to}; angle-bisector {at,from,to,radius?,extend?,reach?} (use reach, e.g. the far side of a garden, or extend so the line shows where it meets other loci); perpendicular-from-point {point,a,b}; perpendicular-at-point {point,a,b,side?: left|right}; locus-point {point,distance} (circle); locus-segment {a,b,distance} (parallel lines and semicircles); point-by-bearing {id,from,bearing,distance (drawing cm, so 18 km at 1 cm : 4 km is 4.5),answer? default false}. Each helper draws its compass arcs and is one group (removable with remove_group). " +
    "For a question pupils answer by constructing, leave the construction as answer:true. For a worked example (booklets) set answer:false on the helper or worked:true. Measurements are written only by measure or measure:true. outputView pupil (default) or answer.",
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 30 operations: set_drawing {widthCm?,heightCm?,grid?,border?,caption?,captionHidden?}; add_point {point}; set_point {id,point:{x?,y?,label?,labelHidden?,labelAt?,mark?,answer?}}; add_object {object}; set_object {id,fields} (only fields of that object type); add_construction {construction}; remove {ids} also removes objects that depend on them; remove_group {group}; set_answer {ids (points, objects or groups),answer}; measure {id,scaleCm?,represents?,unit?} writes a segment length, angle size or three-figure bearing into its label; show_all {} makes every answer given. Keep IDs from the returned envelope and keep unchanged items.",
};
