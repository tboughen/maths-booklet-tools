/** Units per 1 cm square. The editor's buttons offer 0.5, 1 and 2; saved files and the
 * connector may use any positive scale, such as 5, 10, 25 or 30 minutes. */
export type UnitsPerSquare = number;
/** How the numbers on an axis are written. "time" reads values as minutes after midnight and
 * prints them as exam papers do: 09 00, 12 30. */
export type AxisNumberFormat = "number" | "time";
/** Grid squares: 1 cm (the default), or a fine grid of 5 mm or 2 mm squares inside heavier
 * 1 cm lines. Every axis scale still counts 1 cm squares. "none" draws sketch axes: no grid and
 * no axis numbers, only the axes, x, y and the origin. */
export type GridSize = "1cm" | "5mm" | "2mm" | "none";
export type StraightStrokeStyle = "solid" | "dashed";

export interface Coordinate {
  x: number;
  y: number;
}

export interface AxisConfig {
  negativeSquares: number;
  positiveSquares: number;
  unitsPerSquare: UnitsPerSquare;
  /** The value where the other axis crosses this one. Omitted means 0. */
  origin?: number;
  /** Number every nth 1 cm line, counted from the origin. Omitted keeps the classic rule:
   * every line, or every second line at 0.5 units a square. */
  labelEvery?: number;
  /** Omitted means "number". */
  format?: AxisNumberFormat;
  /** Words and unit in brackets, such as "Distance from home (km)". Replaces the italic axis
   * letter when present. */
  title?: string;
}

interface BaseObject {
  id: string;
  /** A hidden answer: drawn, in the answer colour, only on the answers copy. The pupil copy
   * leaves the grid blank for the pupil to draw on. Omitted means drawn on both copies. */
  answerOnly?: true;
}

export type GraphView = "pupil" | "answer";

/** An exam-style name printed beside an object: a capital letter with an optional prime and
 * subscript number, such as A, B′, L or L1 (printed L₁). Lines print bold, points italic. */
export interface NamedObject {
  name?: string;
  /** Centre of the printed name in graph coordinates. Omitted places it automatically. */
  namePosition?: Coordinate;
}

export interface PointObject extends BaseObject, NamedObject {
  kind: "point";
  position: Coordinate;
}

/** Where a short label sits beside the point it labels. */
export type LabelSide =
  | "left"
  | "right"
  | "above"
  | "below"
  | "above-left"
  | "above-right"
  | "below-left"
  | "below-right";

/** A short text printed beside a point on a line, such as "3", "−2" or "(0, 3)" where a sketch
 * crosses an axis. It belongs to its line, so an answer-only line hides its labels too. */
export interface PointLabel {
  at: Coordinate;
  text: string;
  /** Omitted: left of the y-axis, below the x-axis, otherwise above and to the right. */
  side?: LabelSide;
}

export interface StraightObject extends BaseObject, NamedObject {
  kind: "straight";
  display: "segment" | "line";
  /** Optional so diagrams saved before dashed lines were added still load as solid. */
  strokeStyle?: StraightStrokeStyle;
  start: Coordinate;
  end: Coordinate;
  equationVisible: boolean;
  equationLabelPosition?: Coordinate;
  labels?: PointLabel[];
}

/** A closed shape for transformations, such as triangle A or shape P (U72). Its name prints
 * upright in the middle of the shape, as exam papers label shapes. */
export interface PolygonObject extends BaseObject, NamedObject {
  kind: "polygon";
  /** 3 to 12 corners in order, in graph coordinates. */
  vertices: Coordinate[];
  /** Grey shading inside the shape. Omitted means unshaded. */
  shaded?: true;
}

export type GraphObject = PointObject | StraightObject | PolygonObject;

export interface DiagramDocumentV1 {
  version: 1;
  /** Legacy documents omit this field. Kept with undo and local recovery. */
  styleProfile?: "legacy" | "portable-v1";
  axes: {
    x: AxisConfig;
    y: AxisConfig;
  };
  /** Omitted means "1cm". */
  grid?: GridSize;
  /** "O" prints an italic O at the origin, as exam papers do. Omitted prints 0. */
  originLabel?: "0" | "O";
  objects: GraphObject[];
  selectedObjectId: string | null;
}

export type DrawingTool = "select" | "point" | "segment";

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SvgLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  square: number;
  bounds: Bounds;
}
