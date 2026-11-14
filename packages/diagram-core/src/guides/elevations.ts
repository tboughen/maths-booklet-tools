import * as core from "../../../elevation-core/src/index";
import * as ei from "../../../elevation-core/src/interchange";
export const elevationsConfig = {
  capabilities: {
    editor: "No website editor yet (it is a later step); reopen a drawing from its JSON envelope.",
    schemaVersions: [1],
    rendererVersions: ["elevations-1"],
    solids: "cube solids only, as a height map; prisms, cylinders and pyramids are not supported yet",
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
    "Plans and elevations of solids made of centimetre cubes. spec: {example?|heights?, panels?, settings?, worked?}. heights is a grid of cube counts: heights[row][column], row 0 is the FRONT row, column 0 the LEFT, 0 to 6 cubes per square, up to 6 by 6. " +
    "panels (printed left to right, wrapping): [{view: isometric|plan|front|side, state?: drawn|blank|answer, label?, labelHidden?, across?, up?}]. drawn prints the view on both copies; answer gives pupils an empty cm grid (isometric dot paper for isometric) and draws the view on the answer copy; blank is an empty grid only. across/up size an empty grid in squares (0 = fit the solid with a square spare). Labels default to Plan, Front elevation, Side elevation. " +
    "The isometric drawing shows the top, the front and the LEFT side; its Front and Side arrows (settings.arrows, default true) show the viewing directions, and the side elevation is the view from the left. settings: {unitCm: 0.5|1|2 cube edge on the grids (2 for \"2 cm to 1 cube\"), arrows, isoDots, maxWidthCm}. " +
    "Elevations follow the exam convention: the outline plus a line where the visible surface steps back. Typical questions: draw the views (isometric drawn, views answer) or draw the solid (views drawn, isometric answer). outputView pupil (default) or answer.",
  reviseDescription:
    "Revise atomically with envelope, baseHash:contentHash and at most 30 operations: set_heights {heights}; set_height {row, column, height} (row 0 front, column 0 left); set_panels {panels}; set_panel {index (from 0), panel:{state?,label?,labelHidden?,across?,up?}}; set_settings {settings}; show_all {} draws every answer view. Keep unchanged panels and settings.",
};
