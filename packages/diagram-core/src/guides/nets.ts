import * as nets from "../../../net-core/src/index";
import * as ni from "../../../net-core/src/interchange";
export const netsConfig = {
  kind: "nets" as const,
  name: "nets",
  schema: nets.envelopeSchema,
  createInput: ni.createSchema,
  revision: ni.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [nets.RENDERER_VERSION],
    maximumNets: nets.MAX_NETS,
    maximumFaces: nets.MAX_FACES,
    textLength: nets.MAX_TEXT,
    grids: nets.GRIDS,
    unitCm: [0.5, 1],
    marks: ["dot", "cross", "shade"],
    examples: ni.exampleIds,
    itemStates: ["show", "hidden"],
    maximumRevisionOperations: 40,
    revisionOperations: ni.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden face prints nothing for pupils and is drawn in the answer colour on the answers copy, with its label and mark; hidden labels, marks, letters and captions likewise.",
    folding: "Cube and cuboid nets are checked: warnings say when one does not fold, and which named faces end up opposite and which corner letters meet. Other nets are not folded.",
    creation: "spec or envelope; omit both for cube net 1 with 2-square faces on 1 cm squares",
  },
  createDescription:
    'Create nets of 3D shapes on centimetre squares (GM2.07), up to 6 side by side. Supply envelope OR spec:{example?|nets?, grid?, unitCm?, lines?, worked?}. Each net: {preset|squares, side?, solid?, caption?, faces?, hideAll?, vertices?, edges?, size?}. preset: cube {net:1-11, side?:squares, default 2} | cuboid {length,width,height} | triangular-prism {a,b,length} (right-angled) | square-pyramid {base,slant} | tetrahedron {side} (grid none) | cylinder {radius,height} (rectangle 2πr wide, a circle on each long side) | cone {radius,slant} (sector of angle 360°×radius÷slant, base circle touching its arc; radius < slant). squares: [[column,row],...] square faces, for any arrangement, nets or not. Face order: cube nets row by row; cuboid top, strip of four left to right, bottom; prism three rectangles, top and bottom triangles; pyramid base, then triangles above, right, below, left; cylinder curved rectangle, top circle, bottom circle; cone sector, base circle. faces[i]: null or {label?, mark?: dot|cross|shade|{kind,hidden:true}, hidden?:true}. hideAll:true leaves an empty grid ("draw the net"). vertices [{at:[x,y],label}], edges [{from,to,label:"4 cm"}] in grid squares from the panel corner (nets start at [1,1]). caption under the net ("A" for "which are nets?"). Labels: text or {text,hidden:true}. Never fold or reveal unless asked: mark_opposite (revise) answers "where does the dot end up".',
  reviseDescription:
    'Revise nets atomically using envelope, baseHash:contentHash, max 40 operations: make_net {netId,preset} (replaces faces, clears letters); add_net {preset,caption?}; remove_net; set_net {netId,solid?,caption?,size?}; add_square {netId,at:[x,y],side?}; remove_face {netId,faceId}; set_face {netId,faceId,show?,label?,mark?:{kind?,show?}}; set_vertex {netId,at,text?,show?} and set_edge {netId,from,to,text?,show?} (empty text removes); move_net {netId,dx,dy}; mark_opposite {netId,faceId,kind?} folds a cube or cuboid net and marks the opposite face as a hidden answer; set_settings {settings:{grid?,unitCm?,lines?}}. IDs n1, f1 come from the envelope.',
};
