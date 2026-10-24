import { triangleName, owningTriangles } from "../../packages/triangle-core/src/ownership";
export { triangleName, owningTriangles } from "../../packages/triangle-core/src/ownership";
import {
  allLabels,
  refName,
  shown,
  type Envelope,
  type Metrics,
  type Point,
} from "../../packages/triangle-core/src";

export function objectName(e: Envelope, ref: string) {
  return ref.startsWith("t:")
    ? `Triangle ${triangleName(e, ref.slice(2))}${e.document.triangles.find((t) => t.id === ref.slice(2))?.role === "outer" ? " (outer)" : ""}`
    : refName(e, ref);
}
export function objects(e: Envelope) {
  return [
    ...e.document.triangles.map((t) => ({
      ref: `t:${t.id}`,
      group: "Triangles",
      name: objectName(e, `t:${t.id}`),
    })),
    ...allLabels(e).map((l) => ({
      ref: l.ref,
      group: {
        vertex: "Vertices",
        edge: "Sides",
        angle: "Angles",
        height: "Heights",
        caption: "Captions",
        area: "Areas",
      }[l.kind],
      name: refName(e, l.ref),
    })),
  ];
}
export function oppositeEdge(e: Envelope, vertex: string) {
  const t = e.document.triangles[0];
  const edge = e.document.edges.find(
    (a) =>
      t.vertices.includes(a.from) &&
      t.vertices.includes(a.to) &&
      a.from !== vertex &&
      a.to !== vertex,
  );
  if (!edge) throw Error("Choose an apex of the original triangle.");
  return edge.id;
}
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    den = dx * dx + dy * dy;
  const t = den
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / den))
    : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Partition a crowded vertex/name hit area at their midpoint: both centres
 * remain directly reachable instead of one transparent button hiding another. */
export function vertexHandleClip(
  vertex: Point,
  label: Point | undefined,
  size: number,
) {
  if (!label) return undefined;
  const dx = label.x - vertex.x,
    dy = label.y - vertex.y,
    distance = Math.hypot(dx, dy);
  if (distance < 1) return undefined;
  const f = (p: Point) =>
    (p.x * dx) / distance + (p.y * dy) / distance - distance / 2;
  const half = size / 2,
    source = [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: half, y: half },
      { x: -half, y: half },
    ],
    out: Point[] = [];
  source.forEach((a, i) => {
    const b = source[(i + 1) % 4],
      fa = f(a),
      fb = f(b);
    if (fa <= 0) out.push(a);
    if (fa <= 0 !== fb <= 0) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  });
  return `polygon(${out.map((p) => `${((p.x + half) / size) * 100}% ${((p.y + half) / size) * 100}%`).join(",")})`;
}
const cross = (a: Point, b: Point, p: Point) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
export function geometryHits(
  e: Envelope,
  g: Metrics,
  p: Point,
  tolerance: number,
) {
  const sides = e.document.edges
    .filter(
      (a) =>
        a.draw &&
        segmentDistance(p, g.vertices[a.from], g.vertices[a.to]) <= tolerance,
    )
    .map((a) => `e:${a.id}`);
  const angles = e.document.angles
    .filter((a) => {
      if (insideWedge(e, g, `a:${a.id}`, p)) return true;
      // Printed text remains clickable after repositioning, without a second
      // visible rectangle or a duplicate keyboard stop.
      const anchor = g.anchors.find((v) => v.ref === `a:${a.id}`);
      if (
        shown(e, a.label) &&
        anchor &&
        Math.abs(p.x - anchor.x) <= anchor.w / 2 &&
        Math.abs(p.y - anchor.y) <= anchor.h / 2
      )
        return true;
      if (a.mark === "none") return false;
      const v = g.vertices[a.vertex],
        a1 = g.vertices[a.from],
        a2 = g.vertices[a.to];
      const u = { x: a1.x - v.x, y: a1.y - v.y },
        w = { x: a2.x - v.x, y: a2.y - v.y };
      const ul = Math.hypot(u.x, u.y),
        wl = Math.hypot(w.x, w.y);
      if (a.mark === "right") {
        const r = Math.min(2.5, Math.min(ul, wl) * 0.13);
        const p1 = { x: v.x + (u.x / ul) * r, y: v.y + (u.y / ul) * r },
          p3 = { x: v.x + (w.x / wl) * r, y: v.y + (w.y / wl) * r },
          p2 = { x: p1.x + (w.x / wl) * r, y: p1.y + (w.y / wl) * r };
        return (
          Math.min(segmentDistance(p, p1, p2), segmentDistance(p, p2, p3)) <=
          tolerance
        );
      }
      const start = Math.atan2(u.y, u.x),
        end = Math.atan2(w.y, w.x);
      const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
      const delta = wrap(end - start),
        at = wrap(Math.atan2(p.y - v.y, p.x - v.x) - start);
      if (delta > 0 ? at < 0 || at > delta : at > 0 || at < delta) return false;
      const radius = Math.min(6, Math.min(ul, wl) * 0.2),
        distance = Math.hypot(p.x - v.x, p.y - v.y);
      return Array.from(
        { length: { arc: 1, double: 2, triple: 3 }[a.mark] },
        (_, i) => Math.abs(distance - radius - i * 1.1),
      ).some((d) => d <= tolerance);
    })
    .map((a) => `a:${a.id}`);
  if (angles.length) return angles;
  if (sides.length) {
    const shared = sides.flatMap((ref) => owningTriangles(e, ref));
    return [
      ...new Set([
        ...sides,
        ...(shared.length > 1 ? shared.map((t) => `t:${t.id}`) : []),
      ]),
    ];
  }
  return e.document.triangles
    .filter((t) => {
      const [a, b, c] = t.vertices.map((id) => g.vertices[id]);
      const xs = [cross(a, b, p), cross(b, c, p), cross(c, a, p)];
      return xs.every((x) => x >= 0) || xs.every((x) => x <= 0);
    })
    .map((t) => `t:${t.id}`);
}

/** Editor-only emphasis for the exact two rays of a selected angle. */
export function wedgePoints(e: Envelope, g: Metrics, ref: string | null) {
  const a = e.document.angles.find((a) => `a:${a.id}` === ref);
  if (!a) return null;
  const v = g.vertices[a.vertex],
    p = g.vertices[a.from],
    q = g.vertices[a.to],
    pl = Math.hypot(p.x - v.x, p.y - v.y),
    ql = Math.hypot(q.x - v.x, q.y - v.y),
    r = Math.min(14, Math.min(pl, ql) * 0.35);
  return [
    v,
    { x: v.x + ((p.x - v.x) * r) / pl, y: v.y + ((p.y - v.y) * r) / pl },
    { x: v.x + ((q.x - v.x) * r) / ql, y: v.y + ((q.y - v.y) * r) / ql },
  ];
}
export function angleWedge(e: Envelope, g: Metrics, ref: string | null) {
  return (
    wedgePoints(e, g, ref)
      ?.map((p) => `${p.x},${p.y}`)
      .join(" ") ?? null
  );
}
function insideWedge(e: Envelope, g: Metrics, ref: string, p: Point) {
  const points = wedgePoints(e, g, ref);
  if (!points) return false;
  const [a, b, c] = points;
  const values = [cross(a, b, p), cross(b, c, p), cross(c, a, p)];
  return values.every((v) => v >= -1e-8) || values.every((v) => v <= 1e-8);
}
export function triangleCentre(e: Envelope, g: Metrics, id: string) {
  const t = e.document.triangles.find((t) => t.id === id)!;
  return t.vertices.reduce(
    (s, id) => ({
      x: s.x + g.vertices[id].x / 3,
      y: s.y + g.vertices[id].y / 3,
    }),
    { x: 0, y: 0 },
  );
}
