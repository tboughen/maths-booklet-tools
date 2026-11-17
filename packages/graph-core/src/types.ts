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
   * letter when present, unless the axis also has a name. */
  title?: string;
  /** y-axis only: the title prints above the top of the axis, as many Edexcel graphs print it,
   * instead of beside it, so a titled graph stays narrow (Tim, A3 worksheets, 16 Nov 2026). */
  titleAbove?: true;
  /** The italic letter at the arrow, such as t or v, in place of x or y. With a title, both
   * print: the letter at the arrow and the title beside the axis, as velocity–time graphs do. */
  name?: string;
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

/** Coordinates printed after a point's name, as exam papers write A(2, 3). "show" prints them;
 * "blank" leaves ( ……… , ……… ) for the pupil on the pupil copy, and prints the point's own
 * coordinates in the answer colour on the answers copy. Omitted prints none. */
export type PointCoordinates = "show" | "blank";

export interface PointObject extends BaseObject, NamedObject {
  kind: "point";
  position: Coordinate;
  coordinates?: PointCoordinates;
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
  /** A right-angled triangle under or over the line that shows its gradient (U76). */
  gradientTriangle?: GradientTriangle;
  /** A vector arrowhead (segments only): at the end, or centred on the middle as exam vector
   * diagrams print it. Omitted means no arrowhead. */
  arrow?: "end" | "middle";
}

/** Where a gradient triangle sits on its line, and what its legs print. */
export interface GradientTriangle {
  /** The x where the triangle starts on the line. */
  x: number;
  /** The horizontal leg, from x: positive runs right, negative left. */
  run: number;
  /** "values" prints the run and rise beside the legs; "blank" prints dotted answer spaces on
   * the pupil copy and the values in the answer colour on the answers copy. Omitted: no labels. */
  labels?: "values" | "blank";
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


/** A region shaded by inequalities, such as y > 2x − 1, x ≤ 3 (U73). The inequalities are saved
 * as typed. "wanted" shades the region that satisfies them all; "unwanted" shades everything
 * else, leaving the answer region clear, as some papers ask. With boundaries, each boundary line
 * is drawn across the grid, dashed for < and >, solid for ≤ and ≥. A name, such as R, prints
 * upright in the middle of the region. Hidden answers (answerOnly) shade only the answers copy. */
export interface RegionObject extends BaseObject, NamedObject {
  kind: "region";
  inequalities: string[];
  shade: "wanted" | "unwanted";
  boundaries: boolean;
}

/** A graph drawn through points in order (U914, U862, U611): joined by straight pieces, as a
 * travel graph is, or smooth, as a velocity–time curve or a sketch of y = f(x) is printed. */
export interface CurveObject extends BaseObject, NamedObject {
  kind: "curve";
  /** 2 to 40 points in order, in graph units. */
  points: Coordinate[];
  /** A smooth curve through every point. Omitted joins them with straight pieces. */
  smooth?: true;
  /** Omitted means solid. */
  strokeStyle?: "dashed";
}

/** Dashed reading lines from a point on a graph to the axes, with an arrowhead on the axis where
 * the value is read (U862 conversion graphs, U601 graphical solutions). "y" reads y for a given
 * x: up from the x-axis to the point, then across to the y-axis. "x" reads x for a given y.
 * "both" drops to both axes with a head on each. A reading line is never named. */
export interface ReadingObject extends BaseObject, NamedObject {
  kind: "reading";
  at: Coordinate;
  read: "x" | "y" | "both";
}

/** A circle such as x² + y² = 25: drawn true to the axes' scales, so unequal scales print an
 * ellipse as a graph paper would. */
export interface CircleObject extends BaseObject, NamedObject {
  kind: "circle";
  centre: Coordinate;
  /** In graph units, the same distance along either axis. */
  radius: number;
  /** Omitted means solid. */
  strokeStyle?: "dashed";
}

/** y = a x² + b x + c (+ cubic x³), y = k/x + c, y = coefficient × baseˣ + c, or the trig graph
 * y = amplitude × fn(multiplier × x + shift) + c with x in degrees. */
export type FunctionEquation =
  | { family: "polynomial"; a: number; b: number; c: number; cubic?: number }
  | { family: "reciprocal"; k: number; c: number }
  | { family: "exponential"; coefficient: number; base: number; c: number }
  | { family: "trig"; fn: "sin" | "cos" | "tan"; amplitude: number; multiplier: number; shift: number; c: number };

/** An equation curve drawn exactly (quadratic, cubic, reciprocal, exponential, trig in degrees),
 * between from and to when given, else across the grid. */
export interface FunctionObject extends BaseObject, NamedObject {
  kind: "function";
  equation: FunctionEquation;
  from?: number;
  to?: number;
  /** Omitted means solid. */
  strokeStyle?: "dashed";
}

export type GraphObject = PointObject | StraightObject | PolygonObject | RegionObject | CurveObject | ReadingObject | CircleObject | FunctionObject;

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
  /** The origin mark; absent means an italic O, as Edexcel papers print it. */
  originLabel?: "0" | "O";
  /** Bold lines (U111): the axes and everything plotted are 1.5 times as heavy; the grid keeps its weight. Omitted is normal. */
  lines?: "bold";
  objects: GraphObject[];
}

/** The graph editor's working copy: the saved drawing plus which object is selected. The selection
 * is editor state (U35), so it never reaches a saved file, link, envelope or hash. */
export type GraphEditorDocument = DiagramDocumentV1 & { selectedObjectId: string | null };

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
