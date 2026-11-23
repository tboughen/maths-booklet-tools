/**
 * Starting nets for the shapes Year 7 meets (Hanley GM2.07): the eleven nets of a cube, a cuboid,
 * a triangular prism, a square-based pyramid and a tetrahedron. Each returns its faces as polygons in
 * grid squares, with the net's top-left corner one square in from the panel's edge.
 *
 * Face order is part of the contract (the connector names faces by their place in this order):
 * - cube nets: the squares row by row, left to right;
 * - cuboid: the top, the four faces of the strip from left to right, then the bottom;
 * - triangular prism: the three rectangles from left to right, then the top and bottom triangles;
 * - square-based pyramid: the square base, then the triangles above, right, below and left;
 * - tetrahedron: the middle triangle, then the left, right and top triangles;
 * - cylinder: the curved surface (a rectangle as wide as the circumference), then the top and bottom circles;
 * - cone: the curved surface (a sector), then the base circle.
 */
export type Pt = [number, number];
/** A curved edge: edge i (corner i to the next) is an arc round `centre`, the short way unless `large`. */
export type Arc = { edge: number; centre: Pt; large: boolean };
/** A face of a preset: its corners, and its curved edges if it has any. */
export type Shape = { points: Pt[]; arcs?: Arc[] };

/** Grid cells [column, row] of the 11 nets of a cube: six 1-4-1, three 2-3-1, one 2-2-2 and one 3-3. */
export const CUBE_NETS: readonly (readonly Pt[])[] = [
  // 1-4-1: a strip of four with one square above and one below.
  ...(
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 1],
      [1, 2],
    ] as const
  ).map(([a, b]): Pt[] => [[a, 0], [0, 1], [1, 1], [2, 1], [3, 1], [b, 2]]),
  // 2-3-1: two on top (one overlapping the strip of three), one below.
  ...[1, 2, 3].map((b): Pt[] => [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [b, 2]]),
  // 2-2-2: the staircase.
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]],
  // 3-3: two strips of three.
  [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],
];
export const CUBE_NET_NAMES = [
  "1-4-1, both ends",
  "1-4-1, steps of one",
  "1-4-1, steps of two",
  "1-4-1, opposite ends",
  "1-4-1, cross",
  "1-4-1, cross offset",
  "2-3-1, below the first",
  "2-3-1, below the middle",
  "2-3-1, below the end",
  "2-2-2 staircase",
  "3-3",
] as const;

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const at = (pts: Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [r3(x + dx), r3(y + dy)]);
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
/** Moves faces so the net's top-left corner sits one square in from the panel's edge. */
function placed(faces: Pt[][]): Pt[][] {
  const xs = faces.flat().map((p) => p[0]),
    ys = faces.flat().map((p) => p[1]);
  const dx = 1 - Math.min(...xs),
    dy = 1 - Math.min(...ys);
  return faces.map((f) => at(f, dx, dy));
}

export function cubeNet(index: number, side = 1): Pt[][] {
  const cells = CUBE_NETS[index];
  if (!cells) throw Error(`Choose cube net 1 to ${CUBE_NETS.length}.`);
  return placed(cells.map(([c, r]) => rect(c * side, r * side, side, side)));
}
/** Squares at the given cells, each `side` squares across: for building or completing a cube net. */
export function squaresNet(cells: readonly Pt[], side = 1): Pt[][] {
  return cells.map(([c, r]) => rect(c * side, r * side, side, side));
}
/** The usual cuboid net: a strip of four faces (length, width, length, width) of height `height`, top and bottom on the first. */
export function cuboidNet(length: number, width: number, height: number): Pt[][] {
  return placed([
    rect(0, 0, length, width),
    rect(0, width, length, height),
    rect(length, width, width, height),
    rect(length + width, width, length, height),
    rect(2 * length + width, width, width, height),
    rect(0, width + height, length, width),
  ]);
}
/**
 * A prism on a right-angled triangle with shorter sides a and b (3, 4 and 5 lie on the grid): three
 * rectangles a, b and the hypotenuse wide and `length` tall, with the triangles above and below the first.
 */
export function triangularPrismNet(a: number, b: number, length: number): Pt[][] {
  const c = Math.hypot(a, b);
  return placed([
    rect(0, 0, a, length),
    rect(a, 0, b, length),
    rect(a + b, 0, c, length),
    [
      [0, 0],
      [a, 0],
      [a, -b],
    ],
    [
      [0, length],
      [a, length],
      [a, length + b],
    ],
  ]);
}
/** A square base `base` across with a triangle `slant` tall on each side. */
export function squarePyramidNet(base: number, slant: number): Pt[][] {
  const m = base / 2;
  // The triangles only meet at an apex if each is taller than half the base.
  if (slant <= m) throw Error("Make the triangles taller than half the base, or they cannot fold up to meet.");
  return placed([
    rect(0, 0, base, base),
    [
      [0, 0],
      [base, 0],
      [m, -slant],
    ],
    [
      [base, 0],
      [base, base],
      [base + slant, m],
    ],
    [
      [base, base],
      [0, base],
      [m, base + slant],
    ],
    [
      [0, base],
      [0, 0],
      [-slant, m],
    ],
  ]);
}
/** Four equilateral triangles of side `side` in one large triangle (best on plain paper). */
export function tetrahedronNet(side: number): Pt[][] {
  const h = (side * Math.sqrt(3)) / 2;
  const A: Pt = [0, 2 * h],
    B: Pt = [2 * side, 2 * h],
    C: Pt = [side, 0],
    ab: Pt = [side, 2 * h],
    bc: Pt = [1.5 * side, h],
    ca: Pt = [0.5 * side, h];
  return placed([
    [ca, bc, ab],
    [A, ab, ca],
    [ab, B, bc],
    [ca, bc, C],
  ]);
}

/** A circle as a face: three corners on it, a third of the way round from each other, every edge an arc. */
function circle(c: Pt, r: number, start: number): Shape {
  const points = [0, 1, 2].map((k): Pt => [c[0] + r * Math.cos(start + (k * 2 * Math.PI) / 3), c[1] + r * Math.sin(start + (k * 2 * Math.PI) / 3)]);
  return { points, arcs: [0, 1, 2].map((edge) => ({ edge, centre: c, large: false })) };
}
/** Moves shapes so the net's top-left corner sits one square in from the panel's edge, rounding to 0.001. */
function placedShapes(shapes: Shape[], extent: { minX: number; minY: number }): Shape[] {
  const dx = 1 - extent.minX,
    dy = 1 - extent.minY;
  return shapes.map((s) => ({
    points: at(s.points, dx, dy),
    ...(s.arcs ? { arcs: s.arcs.map((a) => ({ ...a, centre: at([a.centre], dx, dy)[0] })) } : {}),
  }));
}
/**
 * A cylinder of radius r and height h: the curved surface is a rectangle 2πr wide and h tall, with
 * the top circle touching its top edge and the bottom circle its bottom edge, both at the middle.
 */
export function cylinderNet(r: number, h: number): Shape[] {
  const w = 2 * Math.PI * r;
  return placedShapes(
    [{ points: rect(0, 2 * r, w, h) }, circle([w / 2, r], r, Math.PI / 2), circle([w / 2, 3 * r + h], r, -Math.PI / 2)],
    { minX: 0, minY: 0 },
  );
}
/**
 * A cone of base radius r and slant height l: the curved surface is a sector of radius l and angle
 * 360° × r ÷ l, pointing up, with the base circle touching the middle of its arc.
 */
export function coneNet(r: number, l: number): Shape[] {
  if (r >= l) throw Error("A cone's slant height must be longer than its radius.");
  const angle = (2 * Math.PI * r) / l,
    down = Math.PI / 2;
  const A: Pt = [l * Math.cos(down - angle / 2), l * Math.sin(down - angle / 2)],
    B: Pt = [l * Math.cos(down + angle / 2), l * Math.sin(down + angle / 2)];
  const sector: Shape = { points: [[0, 0], A, B], arcs: [{ edge: 1, centre: [0, 0], large: angle > Math.PI }] };
  // The sector's widest point: its arc reaches l to either side once it passes a quarter turn from the bottom.
  const half = angle > Math.PI ? l : Math.max(Math.abs(A[0]), r);
  const top = angle > 2 * Math.PI - 1e-9 ? -l : Math.min(0, A[1], angle > Math.PI ? -l * Math.cos(Math.PI - angle / 2) : 0);
  return placedShapes([sector, circle([0, l + r], r, -Math.PI / 2)], { minX: -half, minY: top });
}

export const PRESET_TYPES = ["cube", "cuboid", "triangular-prism", "square-pyramid", "tetrahedron", "cylinder", "cone"] as const;
export type PresetType = (typeof PRESET_TYPES)[number];
export type Preset =
  | { type: "cube"; net: number; side: number }
  | { type: "cuboid"; length: number; width: number; height: number }
  | { type: "triangular-prism"; a: number; b: number; length: number }
  | { type: "square-pyramid"; base: number; slant: number }
  | { type: "tetrahedron"; side: number }
  | { type: "cylinder"; radius: number; height: number }
  | { type: "cone"; radius: number; slant: number };
export const DEFAULT_PRESETS: Record<PresetType, Preset> = {
  cube: { type: "cube", net: 1, side: 2 },
  cuboid: { type: "cuboid", length: 4, width: 2, height: 3 },
  "triangular-prism": { type: "triangular-prism", a: 3, b: 4, length: 5 },
  "square-pyramid": { type: "square-pyramid", base: 3, slant: 3 },
  tetrahedron: { type: "tetrahedron", side: 3 },
  cylinder: { type: "cylinder", radius: 1, height: 4 },
  cone: { type: "cone", radius: 2, slant: 5 },
};
/** The faces of a preset (cube nets are numbered 1 to 11). */
export function presetFaces(p: Preset): Shape[] {
  const flat = (faces: Pt[][]): Shape[] => faces.map((points) => ({ points }));
  switch (p.type) {
    case "cube":
      return flat(cubeNet(p.net - 1, p.side));
    case "cuboid":
      return flat(cuboidNet(p.length, p.width, p.height));
    case "triangular-prism":
      return flat(triangularPrismNet(p.a, p.b, p.length));
    case "square-pyramid":
      return flat(squarePyramidNet(p.base, p.slant));
    case "tetrahedron":
      return flat(tetrahedronNet(p.side));
    case "cylinder":
      return cylinderNet(p.radius, p.height);
    case "cone":
      return coneNet(p.radius, p.slant);
  }
}
