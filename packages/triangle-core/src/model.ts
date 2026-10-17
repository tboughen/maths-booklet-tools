import { z } from "zod";
import { parseNumber } from "../../ratio-table-core/src/numbers";

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/);
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (s) =>
        Array.from(s).every(
          (c) =>
            c === "\n" ||
            c === "\t" ||
            (c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
        ),
      "Use printable mathematical text.",
    );
export const labelSchema = z
  .object({
    state: z.enum(["value", "symbol", "blank", "answer-line", "hidden"]),
    text: safeText(120),
    prefix: safeText(16),
    unit: z.enum(["", "mm", "cm", "m", "°", "mm²", "cm²", "m²"]),
    answer: safeText(40),
    answerVisible: z.boolean(),
    shared: id.nullable(),
    dx: z.number().finite().min(-60).max(60),
    dy: z.number().finite().min(-60).max(60),
    calculation: z
      .object({ basis: z.string().max(20000), formula: safeText(240) })
      .strict()
      .nullable(),
  })
  .strict();
export type Label = z.infer<typeof labelSchema>;
const vertexSchema = z
  .object({
    id,
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
    label: labelSchema,
  })
  .strict();
const edgeSchema = z
  .object({
    id,
    from: id,
    to: id,
    label: labelSchema,
    ticks: z.number().int().min(0).max(3),
    dashed: z.boolean(),
    draw: z.boolean(),
  })
  .strict();
const angleSchema = z
  .object({
    id,
    from: id,
    vertex: id,
    to: id,
    label: labelSchema,
    mark: z.enum(["none", "arc", "double", "triple", "right"]),
  })
  .strict();
const triangleSchema = z
  .object({
    id,
    vertices: z.tuple([id, id, id]),
    role: z.enum(["component", "outer"]),
    rightAt: id.nullable(),
    equalAt: id.nullable(),
    equilateral: z.boolean(),
    area: labelSchema.optional(),
  })
  .strict();
const heightSchema = z
  .object({
    id,
    triangleId: id,
    apex: id,
    base: id,
    label: labelSchema,
    footName: safeText(8),
  })
  .strict();
export const documentSchema = z
  .object({
    layout: z.enum(["single", "separate", "joined", "split"]),
    vertices: z.array(vertexSchema).min(3).max(6),
    edges: z.array(edgeSchema).min(3).max(7),
    angles: z.array(angleSchema).min(3).max(9),
    triangles: z.array(triangleSchema).min(1).max(3),
    heights: z.array(heightSchema).max(2),
    captions: z.array(z.object({ id, label: labelSchema }).strict()).max(2),
    sharedLabels: z.array(z.object({ id, text: safeText(40) }).strict()).max(4),
    split: z.object({ point: id, from: id, to: id }).strict().nullable(),
    widthCm: z.number().finite().min(6).max(18),
    notToScale: z.boolean(),
    sourceId: z
      .string()
      .regex(/^1MA1_[A-Z0-9_]+$/)
      .nullable(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("triangle"),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    rendererVersion: z.enum(["triangle-1", "triangle-2"]),
    styleProfile: z.literal("exam-v1"),
    document: documentSchema,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type TriangleDocument = Envelope["document"];
export type Vertex = TriangleDocument["vertices"][number];
export type Triangle = TriangleDocument["triangles"][number];
export type Edge = TriangleDocument["edges"][number];
export type Angle = TriangleDocument["angles"][number];
export type Point = { x: number; y: number };
export const label = (
  text = "",
  state: Label["state"] = text ? "value" : "blank",
  unit: Label["unit"] = "",
): Label => ({
  state,
  text,
  prefix: "",
  unit,
  answer: "",
  answerVisible: false,
  shared: null,
  dx: 0,
  dy: 0,
  calculation: null,
});
export const point = (e: Envelope, name: string): Vertex => {
  const v = e.document.vertices.find((v) => v.id === name);
  if (!v) throw Error("This vertex no longer exists.");
  return v;
};
export const sub = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
export const add = (a: Point, b: Point): Point => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
export const mul = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const length = (a: Point) => Math.hypot(a.x, a.y);
export const distance = (a: Point, b: Point) => length(sub(a, b));
export const unit = (a: Point): Point => {
  const n = length(a);
  return n ? mul(a, 1 / n) : { x: 1, y: 0 };
};
export function projection(p: Point, a: Point, b: Point) {
  const ab = sub(b, a);
  const t = dot(sub(p, a), ab) / dot(ab, ab);
  return { point: add(a, mul(ab, t)), t };
}
export function allLabels(e: Envelope): {
  ref: string;
  label: Label;
  kind: "vertex" | "edge" | "angle" | "height" | "caption" | "area";
}[] {
  const d = e.document;
  return [
    ...d.vertices.map((v) => ({
      ref: `v:${v.id}`,
      label: v.label,
      kind: "vertex" as const,
    })),
    ...d.edges.map((v) => ({
      ref: `e:${v.id}`,
      label: v.label,
      kind: "edge" as const,
    })),
    ...d.angles.map((v) => ({
      ref: `a:${v.id}`,
      label: v.label,
      kind: "angle" as const,
    })),
    ...d.heights.map((v) => ({
      ref: `h:${v.id}`,
      label: v.label,
      kind: "height" as const,
    })),
    ...d.captions.map((v) => ({
      ref: `c:${v.id}`,
      label: v.label,
      kind: "caption" as const,
    })),
    ...d.triangles.flatMap((t) =>
      t.area
        ? [{ ref: `r:${t.id}`, label: t.area, kind: "area" as const }]
        : [],
    ),
  ];
}
export function getLabel(e: Envelope, ref: string) {
  const item = allLabels(e).find((v) => v.ref === ref);
  if (!item) throw Error("Select an existing label.");
  return item.label;
}
export const textOf = (e: Envelope, l: Label) =>
  l.shared
    ? e.document.sharedLabels.find((s) => s.id === l.shared)!.text
    : l.text;
export const nameOf = (e: Envelope, id: string) =>
  textOf(e, point(e, id).label) || id;
export function refName(e: Envelope, ref: string) {
  const [kind, id] = ref.split(":");
  const d = e.document;
  if (kind === "v") return `Vertex ${nameOf(e, id)}`;
  if (kind === "e") {
    const a = d.edges.find((v) => v.id === id)!;
    return `Side ${nameOf(e, a.from)}${nameOf(e, a.to)}`;
  }
  if (kind === "a") {
    const a = d.angles.find((v) => v.id === id)!;
    return `Angle ${nameOf(e, a.from)}${nameOf(e, a.vertex)}${nameOf(e, a.to)}`;
  }
  if (kind === "h")
    return `Height ${d.heights.findIndex((v) => v.id === id) + 1}`;
  if (kind === "r") {
    const t = d.triangles.find((t) => t.id === id)!;
    return `Area of triangle ${t.vertices.map((v) => nameOf(e, v)).join("")}${t.role === "outer" ? " (outer)" : ""}`;
  }
  return `Caption ${d.captions.findIndex((v) => v.id === id) + 1}`;
}
export const basis = (e: Envelope) =>
  JSON.stringify({
    labels: allLabels(e)
      .filter(
        (x) =>
          x.kind !== "vertex" &&
          (x.kind !== "caption" || x.label.unit.endsWith("²")),
      )
      .map(({ ref, label: l }) => [ref, textOf(e, l), l.unit]),
    triangles: e.document.triangles.map((t) => [t.id, t.vertices, t.rightAt]),
  });
export const isStale = (e: Envelope, l: Label) =>
  !!l.calculation && l.calculation.basis !== basis(e);
export function shown(e: Envelope, l: Label, showAnswers = false) {
  if (l.answer && (l.answerVisible || showAnswers))
    return (
      l.prefix + l.answer + (l.unit ? (l.unit === "°" ? "" : " ") + l.unit : "")
    );
  if (l.state === "hidden" || l.state === "blank") return "";
  if (l.state === "answer-line")
    return l.prefix + "____" + (l.unit ? " " + l.unit : "");
  const text = textOf(e, l);
  return (
    l.prefix +
    text +
    (text && l.unit ? (l.unit === "°" ? "" : " ") + l.unit : "")
  );
}
export function numeric(text: string): number {
  const q = parseNumber(text);
  return Number(q.n) / Number(q.d);
}
export function validate(raw: unknown): Envelope {
  const e = envelopeSchema.parse(raw),
    d = e.document;
  if (
    (e.schemaVersion === 1 &&
      (e.rendererVersion !== "triangle-1" ||
        d.triangles.some((t) => t.area))) ||
    (e.schemaVersion === 2 && e.rendererVersion !== "triangle-2")
  )
    throw Error("Triangle area labels need schema 2 and renderer triangle-2.");
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  for (const list of [
    d.vertices,
    d.edges,
    d.angles,
    d.triangles,
    d.heights,
    d.captions,
    d.sharedLabels,
  ])
    if (!unique(list.map((v) => v.id)))
      throw Error("Every object needs a unique stable ID.");
  for (const { label: l } of allLabels(e))
    if (l.shared && !d.sharedLabels.some((s) => s.id === l.shared))
      throw Error("A shared label is missing.");
  if (d.vertices.some((v) => textOf(e, v.label).length > 8))
    throw Error("Vertex names may contain up to 8 characters.");
  for (const { kind, label: l } of allLabels(e))
    if (kind !== "caption" && textOf(e, l).length > 40)
      throw Error(
        "Use labels of up to 40 characters; captions may contain 120.",
      );
  const pairs = new Set<string>();
  for (const edge of d.edges) {
    point(e, edge.from);
    point(e, edge.to);
    const key = [edge.from, edge.to].sort().join(":");
    if (
      edge.from === edge.to ||
      pairs.has(key) ||
      distance(point(e, edge.from), point(e, edge.to)) < 1e-5
    )
      throw Error(
        "A side must join two different vertices and occur only once.",
      );
    pairs.add(key);
  }
  const component = d.triangles.filter((t) => t.role === "component");
  if (
    component.length !== (d.layout === "single" ? 1 : 2) ||
    d.triangles.length !== (d.layout === "split" ? 3 : component.length)
  )
    throw Error("The triangle structure does not match its layout.");
  if (
    d.vertices.some((v) => !d.triangles.some((t) => t.vertices.includes(v.id)))
  )
    throw Error("A vertex is not part of the triangle structure.");
  if (
    d.edges.some(
      (edge) =>
        !d.triangles.some(
          (t) => t.vertices.includes(edge.from) && t.vertices.includes(edge.to),
        ),
    )
  )
    throw Error("A side is not part of the triangle structure.");
  if (d.layout === "joined") {
    const [a, b] = component,
      shared = a.vertices.filter((id) => b.vertices.includes(id));
    if (shared.length !== 2)
      throw Error("Joined triangles must share exactly one side.");
    const [p, q] = shared.map((id) => point(e, id)),
      u = point(e, a.vertices.find((id) => !shared.includes(id))!),
      v = point(e, b.vertices.find((id) => !shared.includes(id))!);
    if (cross(sub(q, p), sub(u, p)) * cross(sub(q, p), sub(v, p)) >= 0)
      throw Error(
        "Keep joined triangles on opposite sides of their shared side.",
      );
  }
  if (d.layout === "separate") {
    const [a, b] = component;
    if (a.vertices.some((id) => b.vertices.includes(id)))
      throw Error("Separate triangles must have independent vertices.");
    const box = (t: Triangle) => {
        const p = t.vertices.map((id) => point(e, id));
        return {
          l: Math.min(...p.map((v) => v.x)),
          r: Math.max(...p.map((v) => v.x)),
          t: Math.min(...p.map((v) => v.y)),
          b: Math.max(...p.map((v) => v.y)),
        };
      },
      x = box(a),
      y = box(b);
    if (x.l < y.r && x.r > y.l && x.t < y.b && x.b > y.t)
      throw Error(
        "Keep the separate triangles apart. Move a vertex back or use a joined layout.",
      );
  }
  for (const t of d.triangles) {
    if (!unique(t.vertices))
      throw Error("A triangle needs three different vertices.");
    const [a, b, c] = t.vertices.map((id) => point(e, id)),
      ab = sub(b, a),
      ac = sub(c, a),
      extent = Math.max(distance(a, b), distance(b, c), distance(a, c));
    if (Math.abs(cross(ab, ac)) < extent * extent * 1e-4)
      throw Error("The triangle is too flat. Move its vertices further apart.");
    for (let i = 0; i < 3; i++)
      if (!pairs.has([t.vertices[i], t.vertices[(i + 1) % 3]].sort().join(":")))
        throw Error("A triangle side is missing.");
    for (const id of t.vertices) {
      const expected = d.angles.find((a) => a.id === `${t.id}-${id}`);
      if (
        !expected ||
        expected.vertex !== id ||
        ![expected.from, expected.to].every(
          (v) => t.vertices.includes(v) && v !== id,
        )
      )
        throw Error(
          "Each triangle needs a correctly anchored angle at every vertex.",
        );
    }
    if (t.rightAt) {
      if (!t.vertices.includes(t.rightAt))
        throw Error("The right angle must belong to its triangle.");
      const v = point(e, t.rightAt),
        others = t.vertices
          .filter((id) => id !== t.rightAt)
          .map((id) => sub(point(e, id), v));
      if (Math.abs(dot(unit(others[0]), unit(others[1]))) > 1e-5)
        throw Error("The right-angle constraint is not satisfied.");
    }
    if (t.equalAt) {
      if (!t.vertices.includes(t.equalAt))
        throw Error("Choose the apex of the equal sides.");
      const v = point(e, t.equalAt),
        [p, q] = t.vertices
          .filter((id) => id !== t.equalAt)
          .map((id) => point(e, id));
      if (Math.abs(distance(v, p) - distance(v, q)) > extent * 1e-5)
        throw Error("The equal-side constraint is not satisfied.");
    }
    if (
      t.equilateral &&
      (t.rightAt ||
        Math.max(distance(a, b), distance(a, c), distance(b, c)) -
          Math.min(distance(a, b), distance(a, c), distance(b, c)) >
          extent * 1e-5)
    )
      throw Error("The equilateral constraint is not satisfied.");
  }
  for (const a of d.angles) {
    const p = point(e, a.from),
      v = point(e, a.vertex),
      q = point(e, a.to);
    if (
      !unique([a.from, a.vertex, a.to]) ||
      !d.triangles.some((t) =>
        [a.from, a.vertex, a.to].every((id) => t.vertices.includes(id)),
      )
    )
      throw Error("An angle must identify two sides of an existing triangle.");
    if (
      a.mark === "right" &&
      Math.abs(dot(unit(sub(p, v)), unit(sub(q, v)))) > 1e-5
    )
      throw Error(
        "A right-angle square needs perpendicular sides. Constrain the triangle first.",
      );
  }
  if (d.layout === "split" && !d.split)
    throw Error("The split constraint is missing.");
  if (d.layout !== "split" && d.split)
    throw Error("Only a split triangle may contain a split constraint.");
  if (d.split) {
    const { point: p, from, to } = d.split;
    const projection_ = projection(point(e, p), point(e, from), point(e, to));
    if (
      projection_.t <= 0.03 ||
      projection_.t >= 0.97 ||
      distance(projection_.point, point(e, p)) >
        distance(point(e, from), point(e, to)) * 1e-5
    )
      throw Error(
        "Keep the split point inside its parent side, away from the endpoints.",
      );
  }
  for (const h of d.heights) {
    const t = d.triangles.find((t) => t.id === h.triangleId),
      b = d.edges.find((b) => b.id === h.base);
    if (
      !t ||
      !b ||
      !t.vertices.includes(h.apex) ||
      !t.vertices.includes(b.from) ||
      !t.vertices.includes(b.to) ||
      [b.from, b.to].includes(h.apex)
    )
      throw Error("A height needs a vertex and its opposite base.");
  }
  for (const { kind, label: l } of allLabels(e)) {
    if (kind === "area" && !["", "mm²", "cm²", "m²"].includes(l.unit))
      throw Error("Use square units or no unit for an area label.");
    if (kind === "angle" && !["", "°"].includes(l.unit))
      throw Error("Use degrees or no unit for an angle label.");
    if (
      (kind === "edge" || kind === "height") &&
      !["", "mm", "cm", "m"].includes(l.unit)
    )
      throw Error("Use a length unit or no unit for a side or height.");
    if (l.state === "value" && kind !== "caption" && kind !== "vertex") {
      const s = textOf(e, l).trim();
      if (/^[+-]?(?:\d|\.)[\d\s./+-]*$/.test(s)) {
        const n = numeric(s);
        if (n <= 0 || (kind === "angle" && n >= 180))
          throw Error(
            kind === "angle"
              ? "An interior angle must be greater than 0° and less than 180°."
              : kind === "area"
                ? "Use a positive area. Blank and zero are different states."
                : "Use a positive length. Blank and zero are different states.",
          );
      }
    }
  }
  return e;
}
export function canonical(e: Envelope) {
  return JSON.stringify(validate(e));
}
export function parseFile(text: string) {
  if (new TextEncoder().encode(text).length > 64000)
    throw Error("Use a triangle file smaller than 64 KiB.");
  return validate(JSON.parse(text));
}
export function editLabel(e: Envelope, ref: string, update: Partial<Label>) {
  const n = structuredClone(e),
    l = getLabel(n, ref);
  if (update.text !== undefined && l.shared) {
    n.document.sharedLabels.find((s) => s.id === l.shared)!.text = update.text;
    update = { ...update, text: "" };
  }
  Object.assign(l, update);
  return validate(n);
}
export function warnings(e: Envelope): string[] {
  const result: string[] = [];
  for (const t of e.document.triangles) {
    const angles = e.document.angles
      .filter((a) =>
        [a.from, a.vertex, a.to].every((id) => t.vertices.includes(id)),
      )
      .map((a) =>
        a.label.state === "value"
          ? textOf(e, a.label)
          : a.mark === "right"
            ? "90"
            : "",
      );
    const sideLabels = e.document.edges
        .filter((a) => t.vertices.includes(a.from) && t.vertices.includes(a.to))
        .map((a) => a.label),
      sides = sideLabels.map((l) => (l.state === "value" ? textOf(e, l) : "")),
      mixed =
        new Set(
          sideLabels
            .filter((l) => l.state === "value")
            .map((l) => l.unit)
            .filter(Boolean),
        ).size > 1;
    if (mixed)
      result.push(
        "Mixed length units are entered. Convert the givens to one unit before calculating.",
      );
    try {
      if (
        angles.length === 3 &&
        angles.every(Boolean) &&
        Math.abs(angles.reduce((s, a) => s + numeric(a), 0) - 180) > 0.05
      )
        result.push(
          "The entered angles do not add to 180°. They are retained for an error-spotting task.",
        );
    } catch {
      /* Algebraic labels are intentional. */
    }
    try {
      if (!mixed && sides.length === 3 && sides.every(Boolean)) {
        const [a, b, c] = sides.map(numeric).sort((a, b) => a - b);
        if (a + b <= c)
          result.push(
            "The entered lengths cannot form a triangle. The labels are retained; numerical construction will refuse them.",
          );
      }
    } catch {
      /* Non-numeric teaching labels do not request a solver. */
    }
  }
  if (allLabels(e).some((x) => isStale(e, x.label)))
    result.push(
      "A saved calculated answer is out of date. Recalculate it or keep it as a manual answer before showing it.",
    );
  return [...new Set(result)];
}
