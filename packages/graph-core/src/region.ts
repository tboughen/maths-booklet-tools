/**
 * Inequality regions (U73): "Shade the region that satisfies y > 2x − 1, x ≤ 3 and y ≥ 0".
 * A region saves the inequalities as the teacher typed them; this module reads them into
 * half-planes, clips the grid rectangle to the wanted region and finds each boundary line.
 */
import type { Bounds, Coordinate, RegionObject, StraightObject } from "./types";
import { visibleStraightPoints } from "./diagram";

export const MAX_REGION_INEQUALITIES = 4;
export const MAX_INEQUALITY_LENGTH = 40;
const MAX_HALF_PLANES = 6;

/** a·x + b·y + c ≥ 0, or > 0 when strict. Strict boundaries print dashed. */
export interface HalfPlane {
  a: number;
  b: number;
  c: number;
  strict: boolean;
}
type Linear = { x: number; y: number; k: number };

function number(text: string): number {
  const [top, bottom] = text.split("/");
  const value = Number(top) / (bottom === undefined ? 1 : Number(bottom));
  if (!Number.isFinite(value)) throw Error(`"${text}" is not a number.`);
  return value;
}
function side(raw: string, whole: string): Linear {
  const out: Linear = { x: 0, y: 0, k: 0 };
  if (!raw) throw Error(`"${whole}" is missing one side of the inequality.`);
  const terms = raw.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join("") !== raw)
    throw Error(`Check the signs in "${whole}".`);
  for (const term of terms) {
    const m = term.match(
      /^([+-]?)(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?|\.\d+)?([xy])?(?:\/(\d+(?:\.\d+)?))?$/,
    );
    if (!m || (!m[2] && !m[3]) || (m[4] && !m[3]))
      throw Error(
        `"${whole}" uses x, y and numbers only, for example y > 2x − 1 or x + y ≤ 6.`,
      );
    const value =
      ((m[1] === "-" ? -1 : 1) * (m[2] ? number(m[2]) : 1)) /
      (m[4] ? number(m[4]) : 1);
    out[(m[3] as "x" | "y" | undefined) ?? "k"] += value;
  }
  return out;
}

/** Reads "y > 2x − 1", "x ≤ 3", "x + y < 6" or "−2 < x ≤ 3" (which gives two half-planes). */
export function parseInequality(raw: string): HalfPlane[] {
  const text = raw
    .replaceAll(/\s/g, "")
    .replaceAll("−", "-")
    .replaceAll(/[≤⩽]/g, "<=")
    .replaceAll(/[≥⩾]/g, ">=");
  if (!text) throw Error("Enter an inequality, for example y > 2x − 1.");
  if (raw.length > MAX_INEQUALITY_LENGTH)
    throw Error(`Keep each inequality to ${MAX_INEQUALITY_LENGTH} characters.`);
  const parts = text.split(/(<=|>=|<|>)/);
  if (parts.length !== 3 && parts.length !== 5)
    throw Error(
      `"${raw}" needs one inequality sign (<, ≤, > or ≥), or two for a range such as −2 < x ≤ 3.`,
    );
  const out: HalfPlane[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const left = side(parts[i - 1], raw),
      right = side(parts[i + 1], raw),
      relation = parts[i],
      sign = relation.startsWith(">") ? 1 : -1;
    const plane = {
      a: sign * (left.x - right.x) || 0,
      b: sign * (left.y - right.y) || 0,
      c: sign * (left.k - right.k) || 0,
      strict: relation.length === 1,
    };
    if (Math.abs(plane.a) < 1e-12 && Math.abs(plane.b) < 1e-12)
      throw Error(`"${raw}" needs x or y on one side.`);
    out.push(plane);
  }
  if (parts.length === 5 && parts[1][0] !== parts[3][0])
    throw Error(`In "${raw}", both signs must point the same way.`);
  return out;
}

export function regionHalfPlanes(
  region: Pick<RegionObject, "inequalities">,
): HalfPlane[] {
  const planes = region.inequalities.flatMap(parseInequality);
  if (planes.length > MAX_HALF_PLANES)
    throw Error(`Use at most ${MAX_HALF_PLANES} boundary lines in one region.`);
  return planes;
}

/** The wanted region inside the grid, as a convex polygon in graph coordinates (may be empty). */
export function regionPolygon(
  planes: HalfPlane[],
  bounds: Bounds,
): Coordinate[] {
  let polygon: Coordinate[] = [
    { x: bounds.xMin, y: bounds.yMin },
    { x: bounds.xMax, y: bounds.yMin },
    { x: bounds.xMax, y: bounds.yMax },
    { x: bounds.xMin, y: bounds.yMax },
  ];
  for (const p of planes) {
    const value = (q: Coordinate) => p.a * q.x + p.b * q.y + p.c;
    const next: Coordinate[] = [];
    polygon.forEach((current, i) => {
      const previous = polygon[(i + polygon.length - 1) % polygon.length],
        vc = value(current),
        vp = value(previous);
      if (vc >= 0 !== vp >= 0) {
        const t = vp / (vp - vc);
        next.push({
          x: previous.x + t * (current.x - previous.x),
          y: previous.y + t * (current.y - previous.y),
        });
      }
      if (vc >= 0) next.push(current);
    });
    polygon = next;
    if (!polygon.length) break;
  }
  return polygonArea(polygon) >
    1e-9 * (bounds.xMax - bounds.xMin) * (bounds.yMax - bounds.yMin)
    ? polygon
    : [];
}
export function polygonArea(polygon: Coordinate[]): number {
  let twice = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}
export function regionCentroid(polygon: Coordinate[]): Coordinate {
  let area = 0,
    x = 0,
    y = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length],
      cross = p.x * q.y - q.x * p.y;
    area += cross;
    x += (p.x + q.x) * cross;
    y += (p.y + q.y) * cross;
  });
  return area ? { x: x / (3 * area), y: y / (3 * area) } : polygon[0];
}

/** Each boundary as the part of its full line that crosses the grid, dashed when strict. */
export function regionBoundaries(
  planes: HalfPlane[],
  bounds: Bounds,
): { start: Coordinate; end: Coordinate; strict: boolean }[] {
  return planes.flatMap((p) => {
    const [start, end] =
      Math.abs(p.b) > 1e-12
        ? [
            { x: bounds.xMin, y: -(p.a * bounds.xMin + p.c) / p.b },
            { x: bounds.xMax, y: -(p.a * bounds.xMax + p.c) / p.b },
          ]
        : [
            { x: -p.c / p.a, y: bounds.yMin },
            { x: -p.c / p.a, y: bounds.yMax },
          ];
    const line: StraightObject = {
      id: "boundary",
      kind: "straight",
      display: "line",
      start,
      end,
      equationVisible: false,
    };
    const visible = visibleStraightPoints(line, bounds);
    return visible
      ? [{ start: visible[0], end: visible[1], strict: p.strict }]
      : [];
  });
}

/** A specific problem with a region's inequalities, or null. */
export function regionProblem(
  region: Pick<RegionObject, "inequalities">,
): string | null {
  if (
    !region.inequalities.length ||
    region.inequalities.length > MAX_REGION_INEQUALITIES
  )
    return `Use 1 to ${MAX_REGION_INEQUALITIES} inequalities.`;
  try {
    regionHalfPlanes(region);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
