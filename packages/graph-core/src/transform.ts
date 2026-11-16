import type { Coordinate, PolygonObject, StraightObject } from "./types";
import { parseNumericInput } from "./equations";

/**
 * Transformations of shapes on a grid (GCSE U196 translation, U799 reflection, U696 rotation,
 * U519/U134 enlargement). Pure and exact in graph units, so the Graph tool, the connector and
 * the worked-solution engine all draw the same image. Nothing here runs unless a teacher or a
 * caller asks for an image explicitly: a pupil's shape is never drawn for them.
 */
export type MirrorLine = { kind: "slope"; slope: number; intercept: number } | { kind: "vertical"; x: number };
export type RotationAngle = 90 | 180 | 270;
export type RotationDirection = "clockwise" | "anticlockwise";
export type Transformation =
  | { kind: "translate"; vector: Coordinate }
  | { kind: "reflect"; mirror: MirrorLine }
  | { kind: "rotate"; centre: Coordinate; angle: RotationAngle; direction: RotationDirection }
  | { kind: "enlarge"; centre: Coordinate; scaleFactor: number };

/** Rounds away floating-point dust (0.30000000000000004 → 0.3) and −0. */
export function cleanCoordinate(value: number): number {
  const v = Math.round(value * 1e9) / 1e9;
  return Object.is(v, -0) ? 0 : v;
}

/** Why a transformation cannot be applied, or null when it can. */
export function transformationProblem(t: Transformation): string | null {
  if (t.kind === "enlarge" && Math.abs(t.scaleFactor) < 1e-12) return "an enlargement needs a scale factor that is not 0.";
  if (t.kind === "rotate" && ![90, 180, 270].includes(t.angle)) return "a rotation turns through 90°, 180° or 270°.";
  return null;
}

/** Where one point goes under the transformation. */
export function transformPoint(p: Coordinate, t: Transformation): Coordinate {
  let x: number, y: number;
  if (t.kind === "translate") {
    x = p.x + t.vector.x;
    y = p.y + t.vector.y;
  } else if (t.kind === "reflect") {
    if (t.mirror.kind === "vertical") {
      x = 2 * t.mirror.x - p.x;
      y = p.y;
    } else {
      const { slope: m, intercept: c } = t.mirror;
      const d = (p.x + (p.y - c) * m) / (1 + m * m);
      x = 2 * d - p.x;
      y = 2 * d * m - p.y + 2 * c;
    }
  } else if (t.kind === "rotate") {
    const dx = p.x - t.centre.x, dy = p.y - t.centre.y;
    // A quarter turn clockwise is three quarter turns anticlockwise.
    const quarters = ((t.direction === "anticlockwise" ? t.angle : 360 - t.angle) / 90) % 4;
    const [rx, ry] = quarters === 1 ? [-dy, dx] : quarters === 2 ? [-dx, -dy] : quarters === 3 ? [dy, -dx] : [dx, dy];
    x = t.centre.x + rx;
    y = t.centre.y + ry;
  } else {
    x = t.centre.x + t.scaleFactor * (p.x - t.centre.x);
    y = t.centre.y + t.scaleFactor * (p.y - t.centre.y);
  }
  return { x: cleanCoordinate(x), y: cleanCoordinate(y) };
}

/** The image of every corner, in the same order, so corner i maps to corner i (A → A′). */
export function transformVertices(vertices: Coordinate[], t: Transformation): Coordinate[] {
  return vertices.map((p) => transformPoint(p, t));
}

/**
 * The construction lines an enlargement is checked with: one dashed segment per corner along the
 * ray from the centre, long enough to pass through the centre, the corner and its image. For a
 * negative scale factor the ray runs from the corner, through the centre, to the image.
 */
export function enlargementRays(vertices: Coordinate[], centre: Coordinate, scaleFactor: number): { start: Coordinate; end: Coordinate }[] {
  const out: { start: Coordinate; end: Coordinate }[] = [];
  for (const p of vertices) {
    if (Math.hypot(p.x - centre.x, p.y - centre.y) < 1e-12) continue; // a corner on the centre has no ray
    // Parameter along centre → corner: the centre is 0, the corner 1 and its image k. Join the extremes.
    const lo = Math.min(0, 1, scaleFactor), hi = Math.max(0, 1, scaleFactor);
    const at = (s: number) => ({ x: cleanCoordinate(centre.x + s * (p.x - centre.x)), y: cleanCoordinate(centre.y + s * (p.y - centre.y)) });
    out.push({ start: at(lo), end: at(hi) });
  }
  return out;
}

/** A name for an image: A gives A′; a name that already has a prime gives the next free letter (exam papers never print A″). */
export function imageName(name: string | undefined, taken: Set<string | undefined>): string | undefined {
  if (name && !name.includes("′") && !taken.has(`${name}′`)) return `${name}′`;
  return [..."ABCDEFGHPQRST"].find((letter) => !taken.has(letter));
}

export interface ImageOptions {
  id: string;
  name?: string;
  shaded?: boolean;
  answerOnly?: boolean;
  /** For an enlargement: also draw the dashed construction rays from the centre. */
  rays?: boolean;
  /** Ids for the rays, one per corner; made from id when omitted. */
  rayId?: (index: number) => string;
}

/**
 * The image of a shape as plain graph objects: the image polygon, then (for an enlargement with
 * rays) a dashed segment per corner. Saved drawings hold only the result, so a later edit to
 * the original shape never moves its image behind the teacher's back.
 */
export function imageObjects(source: PolygonObject, t: Transformation, options: ImageOptions): (PolygonObject | StraightObject)[] {
  const problem = transformationProblem(t);
  if (problem) throw Error(problem);
  const flag = options.answerOnly ? { answerOnly: true as const } : {};
  const image: PolygonObject = {
    id: options.id,
    kind: "polygon",
    vertices: transformVertices(source.vertices, t),
    ...(options.shaded ? { shaded: true as const } : {}),
    ...(options.name ? { name: options.name } : {}),
    ...flag,
  };
  const out: (PolygonObject | StraightObject)[] = [image];
  if (options.rays && t.kind === "enlarge")
    enlargementRays(source.vertices, t.centre, t.scaleFactor).forEach((ray, i) =>
      out.push({
        id: options.rayId ? options.rayId(i) : `${options.id}-ray-${i + 1}`,
        kind: "straight",
        display: "segment",
        strokeStyle: "dashed",
        start: ray.start,
        end: ray.end,
        equationVisible: false,
        ...flag,
      }),
    );
  return out;
}

/** Words for a transformation, as a mark scheme would accept them. */
export function describeTransformation(t: Transformation): string {
  const point = (p: Coordinate) => `(${p.x}, ${p.y})`;
  if (t.kind === "translate") return `translation by the vector (${t.vector.x}, ${t.vector.y})`;
  if (t.kind === "reflect")
    return `reflection in the line ${t.mirror.kind === "vertical" ? `x = ${t.mirror.x}` : t.mirror.slope === 0 ? `y = ${t.mirror.intercept}` : `y = ${t.mirror.slope === 1 ? "" : t.mirror.slope === -1 ? "−" : t.mirror.slope}x${t.mirror.intercept ? (t.mirror.intercept > 0 ? ` + ${t.mirror.intercept}` : ` − ${-t.mirror.intercept}`) : ""}`}`;
  if (t.kind === "rotate") return `rotation ${t.angle}°${t.angle === 180 ? "" : ` ${t.direction}`} about ${point(t.centre)}`;
  return `enlargement, scale factor ${t.scaleFactor}, centre ${point(t.centre)}`;
}

/**
 * Reads a mirror line typed as on an exam paper: x = 2, y = −1, y = x, y = −x, y = 2x + 1,
 * y = 1/2x − 3. Returns null when the text is not one of these.
 */
export function parseMirrorLine(text: string): MirrorLine | null {
  const s = text.replace(/\s+/g, "").replaceAll("−", "-").replaceAll("–", "-").toLowerCase();
  const num = String.raw`(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+(?:\.\d+)?)?`;
  const value = (t: string) => parseNumericInput(t);
  let m = s.match(new RegExp(`^x=([+-]?${num})$`));
  if (m) {
    const x = value(m[1]);
    return x === null ? null : { kind: "vertical", x };
  }
  m = s.match(new RegExp(`^y=([+-]?${num})$`));
  if (m) {
    const c = value(m[1]);
    return c === null ? null : { kind: "slope", slope: 0, intercept: c };
  }
  m = s.match(new RegExp(`^y=([+-]?)(${num})?x(?:([+-])(${num}))?$`));
  if (!m) return null;
  const size = m[2] === undefined ? 1 : value(m[2]);
  const c = m[4] === undefined ? 0 : value(m[4]);
  if (size === null || c === null || size === 0) return null;
  return { kind: "slope", slope: cleanCoordinate(m[1] === "-" ? -size : size), intercept: cleanCoordinate(m[3] === "-" ? -c : c) };
}
