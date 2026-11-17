import * as core from "../../../solid-core/src/index";
import * as ai from "../../../solid-core/src/interchange";
export const solidsConfig = {
  capabilities: {
    editor: "The returned editor link opens the drawing at /tools/solids, where teachers turn the view, change the solids, name corners, label lengths and angles, and save or print.",
    schemaVersions: [1],
    rendererVersions: [core.RENDERER_VERSION],
    units: "mm in 3D, x across, y up, z towards you (negative z goes back); keep everything within 120 mm of (0, 0, 0). A drawing 50 to 100 mm across suits a worksheet.",
    solidTypes: {
      prism: "{id, type:'prism', at:{x,y,z}, section:[{x,y} 3-12 corners], length, axis:'x'|'y'|'z'}: axis z the section faces you and runs back; x the section is the left end and runs right; y the section is the bottom and runs up. Corners id1..idn at the start, idb1..idbn at the end. A cuboid is a prism with a rectangle section.",
      pyramid: "{id, type:'pyramid', at, base:[{x,y} 3-12 corners, x across and y going back], apex:{x,y,z} from at (y is the height, z negative goes back), top:0 or 0.1-0.9 for a frustum}. Corners id1..idn, apex idt, frustum top idb1..idbn.",
      cylinder: "{id, type:'cylinder', at, r, h, axis}: base centre ido, top centre idt.",
      cone: "{id, type:'cone', at, r, h, top:0 (or a frustum's top radius), axis}: base centre ido, apex or top centre idt.",
      sphere: "{id, type:'sphere', at, r, equator:true|false}: centre ido.",
      hemisphere: "{id, type:'hemisphere', at, r, flat:'up' (a bowl, or a base for a cone) | 'down' (a dome)}: flat face centre ido.",
    },
    placeTypes: {
      at: "{type:'at', x, y, z}",
      along: "{type:'along', a, b, t}: on the line through a and b; t 0 at a, 1 at b, 0.5 the midpoint",
      rim: "{type:'rim', solid, end:'base'|'top', deg}: on a round solid's rim. Upright (axis y): deg 0 right, 90 back, 270 nearest you. Axis z: 0 right, 90 top. Axis x: 0 back, 90 top",
    },
    views: {
      oblique: "{type:'oblique', angle:10-170, scale:0.3-1}: front faces true shape, depth drawn at angle (45 up and right, 135 up and left) and scale. Edexcel's usual prisms and cuboids.",
      turned: "{type:'turned', turn:-89-89, tilt:0-60}: an exact view, turned round the vertical and tilted to look down. Cylinders, cones and spheres (tilt 10-20).",
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
    hiddenAnswers: "A length or angle label's answer is saved but prints only on the answers copy. value labels are givens and never hold an answer.",
    limitation: "Hidden edges are worked out within each solid; one solid never hides another's edges, so place joined solids so they do not overlap in the drawing. Two prisms or pyramids sharing a face both draw its edges; a pyramid on a cuboid can show a back edge solid that should be dashed, so check the drawing.",
  },
  createDescription:
    "3D solids in Edexcel style, with hidden edges dashed and \"Diagram NOT accurately drawn\" by default: prisms (cuboids, triangular and other prisms), pyramids and frustums, cylinders, cones, spheres and hemispheres, alone or joined. Use for volume and surface area, 3D Pythagoras and trigonometry, and compound solids. spec: {example?|solids, points?, names?, lines?, dims?, angles?, settings?}. " +
    "solids: see solidTypes in diagram_capabilities; ids are 1-3 lower-case letters and name the generated corners and centres (p1, pb1, pt, co, ct). names: [{id:'p1', text:'A'}] letters printed beside points. points: extra points [{id, place}] such as a midpoint (along t 0.5) or a point on a rim. lines: [{id, a, b, style?:'dotted'|'dashed'}] for heights, diagonals and radii the paper draws. " +
    "dims: [{id, a, b, label, kind?:'beside'|'arrow', offset?, gap?, side?:'left'|'right'}] a length on edge or line ab; arrow draws a double-headed arrow offset mm from ab with the label beside it or in a gap (gap:true), as Edexcel does for cylinders and cones; side is looking from a to b. label {text:'15 cm'} is a given length; {text:'x'} a letter; no text a blank; give answer only if the user asks. " +
    "angles: [{id, at, from, to, mark?:'arc'|'right'|'none', label?}]; label {text:'35'} prints 35°. settings: view (oblique or turned, see views), hidden 'dashed'|'none', notToScale, fontPt, lines. Never calculate or fill answers unless asked. outputView pupil (default) or answer.",
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 40 operations, applied together then checked once: set_solid {solid} replaces or adds a whole solid; set_point {point}, set_line {line}, set_dim {dim}, set_angle {angle} add the object or change only the fields given on an existing id; set_name {name} (empty text removes the name); remove {what:'solid'|'point'|'line'|'dim'|'angle', id} (anything still used is refused, naming its users: remove those too, in any order in the same list); set_settings {settings}. Keep unchanged objects and settings.",
};
