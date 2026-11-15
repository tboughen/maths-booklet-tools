/**
 * Draw and hold: a rough stroke that the pen holds still at the end of snaps to a straight line or a maths shape
 * (circle, ellipse, triangle, rectangle, square, parallelogram, trapezium, other quadrilateral, pentagon or hexagon).
 * Anything that isn't clearly one of those stays exactly as drawn.
 *
 * Points are in view units. Thresholds that must feel the same on every screen are given in screen pixels and turned
 * into view units with the current zoom; shape tests are proportions of the shape's own size.
 */
export type Point = [number, number];

/** How long the pen must stay still, and how little it may move, before a stroke snaps. */
export const HOLD_MS = 500;
export const HOLD_PX = 5;
/** Lines this close to level or upright become exactly level or upright (Tim, 15 Nov 2026). */
export const LEVEL_DEGREES = 5;

const LINE_MIN_PX = 30;
const LINE_BOW_PX = 10;
const LINE_BOW_SHARE = 0.08;
const SHAPE_MIN_PX = 40;
const CLOSE_SHARE = 0.12;
/** The gap must also be small against the shape's narrow side, so a V or a narrow U isn't read as closed. */
const CLOSE_WIDTH_SHARE = 0.4;
const ELLIPSE_ERROR = 0.07;
const CIRCLE_RATIO = 1.15;
const POLYGON_TOLERANCE = 0.07;
const POLYGON_ERROR = 0.035;
const MANY_SIDED_ERROR = 0.012;
const RIGHT_ANGLE_DEGREES = 10;
const PARALLEL_DEGREES = 10;
const EQUAL_SHARE = 0.1;

const rad = (degrees: number) => degrees * Math.PI / 180;
const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scaleBy = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const unit = (a: Point): Point => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const length = (points: Point[]) => points.reduce((sum, p, i) => i ? sum + dist(points[i - 1], p) : 0, 0);

function segmentDistance(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a), l = dot(ab, ab);
  const t = l ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l)) : 0;
  return dist(p, add(a, scaleBy(ab, t)));
}

/** Angle between two directions, ignoring which way they point, in degrees (0 to 90). */
function lineAngle(a: Point, b: Point): number {
  const c = Math.abs(dot(unit(a), unit(b)));
  return Math.acos(Math.min(1, c)) * 180 / Math.PI;
}

/** Makes a line from `start` to `end` exactly level or upright when it is within LEVEL_DEGREES of either. */
export function snapLevel(start: Point, end: Point): Point {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  if (!dx && !dy) return end;
  const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
  if (angle <= LEVEL_DEGREES || angle >= 180 - LEVEL_DEGREES) return [end[0], start[1]];
  if (Math.abs(angle - 90) <= LEVEL_DEGREES) return [start[0], end[1]];
  return end;
}

/** A stroke that is long enough and bows little enough from the line between its ends to mean a straight line. */
export function isRoughlyStraight(points: Point[], scale: number): boolean {
  if (points.length < 2) return false;
  const px = 1 / Math.max(scale, 0.01);
  const a = points[0], b = points[points.length - 1], span = dist(a, b);
  if (span < LINE_MIN_PX * px) return false;
  const bow = Math.max(...points.map(p => segmentDistance(p, a, b)));
  return bow <= Math.max(LINE_BOW_PX * px, LINE_BOW_SHARE * span);
}

/** `count` points evenly spaced around the closed path. */
function resampleClosed(points: Point[], count: number): Point[] {
  const ring = [...points, points[0]], total = length(ring), step = total / count, out: Point[] = [];
  let i = 1, along = 0;
  for (let k = 0; k < count; k++) {
    const target = k * step;
    while (i < ring.length - 1 && along + dist(ring[i - 1], ring[i]) < target) { along += dist(ring[i - 1], ring[i]); i++; }
    const seg = dist(ring[i - 1], ring[i]) || 1, t = Math.max(0, Math.min(1, (target - along) / seg));
    out.push(add(ring[i - 1], scaleBy(sub(ring[i], ring[i - 1]), t)));
  }
  return out;
}

/** Douglas-Peucker on an open polyline, keeping both ends. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  let worst = 0, at = 0;
  const a = points[0], b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) { const d = segmentDistance(points[i], a, b); if (d > worst) { worst = d; at = i; } }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

interface Ellipse { centre: Point; a: number; b: number; angle: number; error: number }

/** The ellipse along the stroke's main axes that best matches its extents, with how far the stroke strays from it. */
function fitEllipse(ring: Point[]): Ellipse {
  const n = ring.length;
  const mean = scaleBy(ring.reduce(add, [0, 0]), 1 / n);
  let xx = 0, yy = 0, xy = 0;
  for (const p of ring) { const d = sub(p, mean); xx += d[0] * d[0]; yy += d[1] * d[1]; xy += d[0] * d[1]; }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const u: Point = [Math.cos(angle), Math.sin(angle)], v: Point = [-u[1], u[0]];
  const us = ring.map(p => dot(sub(p, mean), u)), vs = ring.map(p => dot(sub(p, mean), v));
  const uMid = (Math.max(...us) + Math.min(...us)) / 2, vMid = (Math.max(...vs) + Math.min(...vs)) / 2;
  const a = (Math.max(...us) - Math.min(...us)) / 2 || 1, b = (Math.max(...vs) - Math.min(...vs)) / 2 || 1;
  const centre = add(mean, add(scaleBy(u, uMid), scaleBy(v, vMid)));
  const error = us.reduce((sum, x, i) => sum + Math.abs(Math.hypot((x - uMid) / a, (vs[i] - vMid) / b) - 1), 0) / n;
  return { centre, a, b, angle, error };
}

function ellipsePoints({ centre, a, b, angle }: Ellipse): Point[] {
  const steps = 72, out: Point[] = [];
  const c = Math.cos(angle), s = Math.sin(angle);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI, x = a * Math.cos(t), y = b * Math.sin(t);
    out.push([centre[0] + x * c - y * s, centre[1] + x * s + y * c]);
  }
  return out;
}

/** The corners of the closed stroke, found by simplifying it from its two furthest-apart points. */
function corners(ring: Point[], tolerance: number): Point[] {
  const furthest = (from: Point) => ring.reduce((best, p, i) => dist(from, p) > dist(from, ring[best]) ? i : best, 0);
  const s = furthest(ring[0]), t = furthest(ring[s]), n = ring.length;
  const rotated = [...ring.slice(s), ...ring.slice(0, s)], split = (t - s + n) % n;
  const first = simplify(rotated.slice(0, split + 1), tolerance), second = simplify([...rotated.slice(split), rotated[0]], tolerance);
  let out = [...first.slice(0, -1), ...second.slice(0, -1)];
  // Drop corners where the outline barely turns.
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i + out.length - 1) % out.length], next = out[(i + 1) % out.length];
      if (segmentDistance(out[i], prev, next) <= tolerance) { out = out.filter((_, j) => j !== i); changed = true; break; }
    }
  }
  return out;
}

/**
 * A stroke that runs on past where it began, as people often close a shape by hand, is cut where it comes back
 * closest to its start.
 */
function trimOverrun(points: Point[]): Point[] {
  const total = length(points);
  let along = 0, best = points.length - 1, bestDistance = dist(points[0], points[points.length - 1]);
  for (let i = 1; i < points.length; i++) {
    along += dist(points[i - 1], points[i]);
    if (along < 0.6 * total) continue;
    const d = dist(points[0], points[i]);
    if (d < bestDistance) { bestDistance = d; best = i; }
  }
  return points.slice(0, best + 1);
}

/** Fits a straight line to the middle of each side and puts each corner where neighbouring sides meet. */
function refineCorners(ring: Point[], polygon: Point[], size: number): Point[] {
  const n = polygon.length, at = polygon.map(p => ring.indexOf(p));
  if (n < 3 || at.some(i => i < 0)) return polygon;
  const lines = at.map((from, i) => {
    const to = at[(i + 1) % n], count = (to - from + ring.length) % ring.length, trim = Math.floor(count * 0.15);
    const side: Point[] = [];
    for (let k = trim; k <= count - trim; k++) side.push(ring[(from + k) % ring.length]);
    if (side.length < 2) return { mid: polygon[i], dir: unit(sub(polygon[(i + 1) % n], polygon[i])) };
    const mid = scaleBy(side.reduce(add, [0, 0]), 1 / side.length);
    let xx = 0, yy = 0, xy = 0;
    for (const p of side) { const d = sub(p, mid); xx += d[0] * d[0]; yy += d[1] * d[1]; xy += d[0] * d[1]; }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    return { mid, dir: [Math.cos(angle), Math.sin(angle)] as Point };
  });
  return polygon.map((corner, i) => {
    const a = lines[(i + n - 1) % n], b = lines[i];
    const cross = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
    if (Math.abs(cross) < 0.2) return corner;
    const t = ((b.mid[0] - a.mid[0]) * b.dir[1] - (b.mid[1] - a.mid[1]) * b.dir[0]) / cross;
    const meet = add(a.mid, scaleBy(a.dir, t));
    return dist(meet, corner) <= 0.25 * size ? meet : corner;
  });
}

function polygonError(ring: Point[], polygon: Point[]): number {
  return ring.reduce((sum, p) => sum + Math.min(...polygon.map((q, i) => segmentDistance(p, q, polygon[(i + 1) % polygon.length]))), 0) / ring.length;
}

/** Rotates the shape about its centre so an edge within LEVEL_DEGREES of level or upright becomes exact. */
function levelShape(polygon: Point[]): Point[] {
  let best: number | undefined;
  for (let i = 0; i < polygon.length; i++) {
    const d = sub(polygon[(i + 1) % polygon.length], polygon[i]);
    const angle = Math.atan2(d[1], d[0]) * 180 / Math.PI;
    const off = ((angle % 90) + 135) % 90 - 45;
    if (Math.abs(off) <= LEVEL_DEGREES && (best === undefined || Math.abs(off) < Math.abs(best))) best = off;
  }
  if (!best) return polygon;
  const centre = scaleBy(polygon.reduce(add, [0, 0]), 1 / polygon.length), r = rad(-best), c = Math.cos(r), s = Math.sin(r);
  return polygon.map(p => { const d = sub(p, centre); return [centre[0] + d[0] * c - d[1] * s, centre[1] + d[0] * s + d[1] * c] as Point; });
}

function interiorAngle(polygon: Point[], i: number): number {
  const p = polygon[i], a = polygon[(i + polygon.length - 1) % polygon.length], b = polygon[(i + 1) % polygon.length];
  return Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(a, p)), unit(sub(b, p)))))) * 180 / Math.PI;
}

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= EQUAL_SHARE * Math.max(a, b);

/** A rectangle (or square) with the drawn quadrilateral's direction and extents. */
function rectangle(quad: Point[], ring: Point[]): Point[] {
  const sides = quad.map((p, i) => sub(quad[(i + 1) % 4], p));
  const longest = sides.reduce((p, q) => Math.hypot(q[0], q[1]) > Math.hypot(p[0], p[1]) ? q : p);
  const u = unit(longest), v: Point = [-u[1], u[0]];
  const us = ring.map(p => dot(p, u)), vs = ring.map(p => dot(p, v));
  let [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  if (nearlyEqual(u1 - u0, v1 - v0)) {
    const side = ((u1 - u0) + (v1 - v0)) / 2, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    [u0, u1, v0, v1] = [uc - side / 2, uc + side / 2, vc - side / 2, vc + side / 2];
  }
  const at = (a: number, b: number) => add(scaleBy(u, a), scaleBy(v, b));
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

/** Moves each corner so opposite sides are exactly parallel, keeping the centre and the average side directions. */
function parallelogram(quad: Point[]): Point[] {
  const centre = scaleBy(quad.reduce(add, [0, 0]), 1 / 4);
  const half1 = scaleBy(add(sub(quad[1], quad[0]), sub(quad[2], quad[3])), 0.25);
  const half2 = scaleBy(add(sub(quad[3], quad[0]), sub(quad[2], quad[1])), 0.25);
  return [sub(sub(centre, half1), half2), add(sub(centre, half2), half1), add(add(centre, half1), half2), add(sub(centre, half1), half2)];
}

/** Turns side `j` about its midpoint to lie exactly parallel to side `i`, the longer of the parallel pair. */
function trapezium(quad: Point[], i: number): Point[] {
  const j = (i + 2) % 4;
  const a = quad[i], b = quad[(i + 1) % 4], c = quad[j], d = quad[(j + 1) % 4];
  const direction = unit(sub(b, a)), mid = scaleBy(add(c, d), 0.5), half = dist(c, d) / 2;
  const sign = dot(sub(d, c), direction) >= 0 ? 1 : -1;
  const out = [...quad];
  out[j] = sub(mid, scaleBy(direction, half * sign));
  out[(j + 1) % 4] = add(mid, scaleBy(direction, half * sign));
  return out;
}

/** Corrects a triangle's nearly-right angle to exactly 90°, or a nearly-equilateral triangle to equilateral. */
function triangle(tri: Point[]): Point[] {
  const sides = tri.map((p, i) => dist(p, tri[(i + 1) % 3]));
  if (nearlyEqual(Math.max(...sides), Math.min(...sides))) {
    const centre = scaleBy(tri.reduce(add, [0, 0]), 1 / 3), r = tri.reduce((sum, p) => sum + dist(p, centre), 0) / 3;
    const start = Math.atan2(tri[0][1] - centre[1], tri[0][0] - centre[0]);
    const turn = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]) > 0 ? 1 : -1;
    return [0, 1, 2].map(k => [centre[0] + r * Math.cos(start + turn * k * 2 * Math.PI / 3), centre[1] + r * Math.sin(start + turn * k * 2 * Math.PI / 3)] as Point);
  }
  for (let i = 0; i < 3; i++) {
    if (Math.abs(interiorAngle(tri, i) - 90) > RIGHT_ANGLE_DEGREES) continue;
    // Keep the longer leg; set the shorter one at right angles to it with its own length.
    const p = tri[i], a = tri[(i + 2) % 3], b = tri[(i + 1) % 3];
    const [keep, move] = dist(p, a) >= dist(p, b) ? [a, b] : [b, a];
    const u = unit(sub(keep, p)), normal: Point = [-u[1], u[0]], legLength = dist(p, move);
    const side = dot(sub(move, p), normal) >= 0 ? 1 : -1;
    const moved = add(p, scaleBy(normal, legLength * side));
    return tri.map(q => q === move ? moved : q);
  }
  return tri;
}

/** Spaces a nearly-regular pentagon or hexagon's corners evenly round a circle. */
function regularise(polygon: Point[]): Point[] {
  const n = polygon.length, sides = polygon.map((p, i) => dist(p, polygon[(i + 1) % n]));
  const angles = polygon.map((_, i) => interiorAngle(polygon, i)), regular = 180 * (n - 2) / n;
  if (Math.max(...sides) > Math.min(...sides) * 1.3 || angles.some(a => Math.abs(a - regular) > 15)) return polygon;
  const centre = scaleBy(polygon.reduce(add, [0, 0]), 1 / n), r = polygon.reduce((sum, p) => sum + dist(p, centre), 0) / n;
  const start = Math.atan2(polygon[0][1] - centre[1], polygon[0][0] - centre[0]);
  const turn = (polygon[1][0] - centre[0]) * (polygon[0][1] - centre[1]) - (polygon[1][1] - centre[1]) * (polygon[0][0] - centre[0]) < 0 ? 1 : -1;
  return polygon.map((_, k) => [centre[0] + r * Math.cos(start + turn * k * 2 * Math.PI / n), centre[1] + r * Math.sin(start + turn * k * 2 * Math.PI / n)] as Point);
}

export type ShapeName = "circle" | "ellipse" | "triangle" | "right-angled triangle" | "equilateral triangle" | "square" | "rectangle" | "parallelogram" | "trapezium" | "quadrilateral" | "pentagon" | "hexagon";
export interface Snapped { name: ShapeName; points: Point[] }

/** Recognises a closed stroke as a maths shape. The points come back closed (the first point repeated at the end). */
export function recogniseShape(points: Point[], scale: number): Snapped | undefined {
  if (points.length < 8) return undefined;
  const px = 1 / Math.max(scale, 0.01), perimeter = length(points);
  if (perimeter < SHAPE_MIN_PX * 3 * px) return undefined;
  points = trimOverrun(points);
  const gap = dist(points[0], points[points.length - 1]);
  if (gap > CLOSE_SHARE * perimeter) return undefined;
  const ring = resampleClosed(points, 96);
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (size < SHAPE_MIN_PX * px) return undefined;
  const ellipse = fitEllipse(ring);
  if (gap > CLOSE_WIDTH_SHARE * 2 * Math.min(ellipse.a, ellipse.b)) return undefined;
  // Whether it's a polygon at all is judged on the rough corners; the corners are then placed where the sides meet.
  const rough = corners(ring, POLYGON_TOLERANCE * size);
  const polyError = rough.length >= 3 && rough.length <= 6 ? polygonError(ring, rough) / size : Infinity;
  let polygon = refineCorners(ring, rough, size);
  const ellipseError = ellipse.error;
  const close = (shape: Point[]) => [...shape, shape[0]];
  if (ellipseError <= ELLIPSE_ERROR && ellipseError * 0.5 <= polyError) {
    if (Math.max(ellipse.a, ellipse.b) / Math.min(ellipse.a, ellipse.b) <= CIRCLE_RATIO) {
      const r = (ellipse.a + ellipse.b) / 2;
      return { name: "circle", points: ellipsePoints({ ...ellipse, a: r, b: r, angle: 0 }) };
    }
    const off = ((ellipse.angle * 180 / Math.PI) % 90 + 135) % 90 - 45;
    const angle = Math.abs(off) <= LEVEL_DEGREES ? ellipse.angle - rad(off) : ellipse.angle;
    return { name: "ellipse", points: ellipsePoints({ ...ellipse, angle }) };
  }
  if (polyError > POLYGON_ERROR) return undefined;
  // A wobbly circle simplifies to five or six corners too, so pentagons and hexagons must have clearly straight sides.
  if (polygon.length >= 5 && polyError > MANY_SIDED_ERROR) return undefined;
  if (polygon.length === 3) {
    const sides = polygon.map((p, i) => dist(p, polygon[(i + 1) % 3]));
    const equilateral = nearlyEqual(Math.max(...sides), Math.min(...sides));
    const right = !equilateral && polygon.some((_, i) => Math.abs(interiorAngle(polygon, i) - 90) <= RIGHT_ANGLE_DEGREES);
    polygon = levelShape(triangle(polygon));
    return { name: equilateral ? "equilateral triangle" : right ? "right-angled triangle" : "triangle", points: close(polygon) };
  }
  if (polygon.length === 4) {
    const sides = polygon.map((p, i) => sub(polygon[(i + 1) % 4], p));
    if (polygon.every((_, i) => Math.abs(interiorAngle(polygon, i) - 90) <= RIGHT_ANGLE_DEGREES * 1.5)) {
      const rect = levelShape(rectangle(polygon, ring));
      return { name: nearlyEqual(dist(rect[0], rect[1]), dist(rect[1], rect[2])) ? "square" : "rectangle", points: close(rect) };
    }
    const pair0 = lineAngle(sides[0], sides[2]) <= PARALLEL_DEGREES, pair1 = lineAngle(sides[1], sides[3]) <= PARALLEL_DEGREES;
    if (pair0 && pair1) return { name: "parallelogram", points: close(levelShape(parallelogram(polygon))) };
    if (pair0 || pair1) {
      const i = pair0 ? (Math.hypot(...sides[0]) >= Math.hypot(...sides[2]) ? 0 : 2) : (Math.hypot(...sides[1]) >= Math.hypot(...sides[3]) ? 1 : 3);
      return { name: "trapezium", points: close(levelShape(trapezium(polygon, i))) };
    }
    return { name: "quadrilateral", points: close(levelShape(polygon)) };
  }
  return { name: polygon.length === 5 ? "pentagon" : "hexagon", points: close(levelShape(regularise(polygon))) };
}
