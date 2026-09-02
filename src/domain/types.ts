export type UnitsPerSquare = 0.5 | 1 | 2;

export interface Coordinate {
  x: number;
  y: number;
}

export interface AxisConfig {
  negativeSquares: number;
  positiveSquares: number;
  unitsPerSquare: UnitsPerSquare;
}

interface BaseObject {
  id: string;
}

export interface PointObject extends BaseObject {
  kind: "point";
  position: Coordinate;
}

export interface StraightObject extends BaseObject {
  kind: "straight";
  display: "segment" | "line";
  start: Coordinate;
  end: Coordinate;
  equationVisible: boolean;
  equationLabelPosition?: Coordinate;
}

export type GraphObject = PointObject | StraightObject;

export interface DiagramDocumentV1 {
  version: 1;
  axes: {
    x: AxisConfig;
    y: AxisConfig;
  };
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
