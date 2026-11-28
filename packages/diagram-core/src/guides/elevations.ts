import * as core from "../../../elevation-core/src/index";
import * as ei from "../../../elevation-core/src/interchange";
export const elevationsConfig = {
  capabilities: {
    editor: "The returned editor link opens the views at /tools/elevations, where teachers set cube heights or shapes, choose panels and save or print.",
    schemaVersions: [1],
    rendererVersions: [core.RENDERER_VERSION],
    solids: "cube solids as a height map, or up to 4 shapes: prism (any 3-12 corner cross-section), pyramid, cylinder, cone, sphere, hemisphere",
    shapeTypes: core.SHAPE_TYPES,
    maximumShapes: core.MAX_SHAPES,
    shapeSpaceSquares: core.MAX_EXTENT,
    maximumLengths: core.MAX_LENGTH_LABELS,
    hiddenLines: ["none (default, Edexcel)", "dashed"],
    maximumGrid: { rows: core.MAX_SIDE, columns: core.MAX_SIDE, height: core.MAX_HEIGHT },
    views: core.VIEWS,
    panelStates: ["drawn", "blank", "answer"],
    unitCm: [0.5, 1, 2],
    maximumPanels: core.MAX_PANELS,
    examples: ei.exampleIds,
    maximumRevisionOperations: 30,
    operations: ei.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer",
  },
  createDescription:
    "Plans and elevations of solids made of centimetre cubes or of shapes. spec: {example?|heights?|shapes?, lengths?, panels?, settings?, worked?}. heights is a grid of cube counts: heights[row][column], row 0 is the FRONT row, column 0 the LEFT, 0 to 6 cubes per square, up to 6 by 6. " +
    "shapes (instead of heights; grid squares, x across to the right, y BACK from the front, z up, the whole solid inside 0..12, whole or half squares): prism {at:{x,y,z}, section:[[a,b],...3-12 corners], axis: y (section is the FRONT face (across, up), runs back) | x (LEFT end (back, up), runs right) | z (BASE (across, back), stands up), length}; pyramid {at, base:[[across,back],...], apex:{x,y,z} offset from at}; cylinder|cone {at: centre of base, r, h, axis}; sphere {at: centre, r}; hemisphere {at: centre of flat face, r, flat: down|up}. Shapes may stack (a pyramid roof on a cuboid prism); shared faces leave no seam. " +
    "lengths (shapes only, up to 8): [{a:{x,y,z}, b:{x,y,z}, text e.g. \"6 cm\", hidden?}] printed beside that line of the isometric drawing; hidden ones appear on the answers copy only. True 3D faces: hidden edges are left out as on Edexcel elevations unless settings.hiddenLines is dashed; a cone's plan has its apex dot. " +
    "panels (printed left to right, wrapping): [{view: isometric|plan|front|side, state?: drawn|blank|answer, label?, labelHidden?, across?, up?}]. drawn prints the view on both copies; answer gives pupils an empty cm grid (plain sketching space for isometric, as in Edexcel \"draw a sketch of the solid shape\"; isoDots adds dot paper) and draws the view on the answer copy; blank is an empty grid only. across/up size an empty grid in squares (0 = fit the solid with a square spare). Labels default to Plan, Front elevation, Side elevation. " +
    "The isometric drawing shows the top, the front and the LEFT side; its Front and Side arrows (settings.arrows, default true) show the viewing directions, and the side elevation is the view from the left. settings: {unitCm: 0.5|1|2 cube edge on the grids (2 for \"2 cm to 1 cube\"), arrows, isoDots (default false: dot paper behind isometric panels; Edexcel papers 2017-2021 never use it), maxWidthCm, hiddenLines: none|dashed}. " +
    "Elevations follow the exam convention: the outline plus a line where the visible surface steps back. Typical questions: draw the views (isometric drawn, views answer) or draw the solid (views drawn, isometric answer). outputView pupil (default) or answer.",
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 30 operations: set_heights {heights} (makes a cube solid); set_shapes {shapes} (makes a shapes solid); set_lengths {lengths}; set_height {row, column, height} (cube solids; row 0 front, column 0 left); set_panels {panels}; set_panel {index (from 0), panel:{state?,label?,labelHidden?,across?,up?}}; set_settings {settings}; show_all {} draws every answer view. Keep unchanged panels and settings.",
};
