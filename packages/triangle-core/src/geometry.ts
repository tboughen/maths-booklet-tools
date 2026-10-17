import {
  add,
  cross,
  distance,
  dot,
  label,
  length,
  mul,
  point,
  projection,
  sub,
  unit,
  validate,
  type Envelope,
  type Label,
  type Point,
  type Triangle,
  type Vertex,
} from "./model";

export function build(
  vertices: { id: string; x: number; y: number }[],
  definitions: {
    id: string;
    vertices: [string, string, string];
    rightAt?: string | null;
    equalAt?: string | null;
    equilateral?: boolean;
    role?: Triangle["role"];
    area?: Label;
  }[],
  layout: Envelope["document"]["layout"] = "single",
): Envelope {
  const e: Envelope = {
    kind: "triangle",
    schemaVersion: definitions.some((t) => t.area) ? 2 : 1,
    rendererVersion: definitions.some((t) => t.area)
      ? "triangle-2"
      : "triangle-1",
    styleProfile: "exam-v1",
    document: {
      layout,
      vertices: vertices.map((v) => ({ ...v, label: label(v.id) })),
      edges: [],
      angles: [],
      triangles: definitions.map((t) => ({
        ...t,
        rightAt: t.rightAt ?? null,
        equalAt: t.equalAt ?? null,
        equilateral: t.equilateral ?? false,
        role: t.role ?? "component",
      })),
      heights: [],
      captions: [],
      sharedLabels: [],
      split: null,
      widthCm: layout === "single" ? 12 : 16,
      notToScale: false,
      sourceId: null,
    },
  };
  for (const t of e.document.triangles) {
    const [a, b, c] = t.vertices;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ])
      if (
        !e.document.edges.some(
          (v) => [v.from, v.to].sort().join(":") === [p, q].sort().join(":"),
        )
      )
        e.document.edges.push({
          id: [p, q].sort().join(""),
          from: p,
          to: q,
          label: label("", "blank", "cm"),
          ticks: 0,
          dashed: false,
          draw: true,
        });
    for (const [from, vertex, to] of [
      [b, a, c],
      [a, b, c],
      [a, c, b],
    ])
      e.document.angles.push({
        id: `${t.id}-${vertex}`,
        from,
        vertex,
        to,
        label: label("", "blank", "°"),
        mark: t.rightAt === vertex ? "right" : "none",
      });
  }
  return e;
}
export function create(
  shape: "right" | "scalene" | "isosceles" | "equilateral" = "right",
) {
  if (shape === "right")
    return validate(
      build(
        [
          { id: "A", x: 0, y: 60 },
          { id: "B", x: 0, y: 0 },
          { id: "C", x: 80, y: 60 },
        ],
        [{ id: "T1", vertices: ["A", "B", "C"], rightAt: "A" }],
      ),
    );
  const equal = shape === "isosceles" || shape === "equilateral";
  return validate(
    build(
      [
        { id: "A", x: equal ? 50 : 25, y: 0 },
        { id: "B", x: 0, y: shape === "equilateral" ? Math.sqrt(7500) : 65 },
        { id: "C", x: 100, y: shape === "equilateral" ? Math.sqrt(7500) : 65 },
      ],
      [
        {
          id: "T1",
          vertices: ["A", "B", "C"],
          equalAt: equal ? "A" : undefined,
          equilateral: shape === "equilateral",
        },
      ],
    ),
  );
}
export function centre(e: Envelope): Point {
  const v = e.document.vertices;
  return {
    x: v.reduce((s, p) => s + p.x, 0) / v.length,
    y: v.reduce((s, p) => s + p.y, 0) / v.length,
  };
}
export function transform(
  e: Envelope,
  kind: "left" | "right" | "reflect" | "vertical",
) {
  const n = structuredClone(e),
    c = centre(e);
  for (const v of n.document.vertices) {
    const a = sub(v, c);
    const next =
      kind === "left"
        ? { x: a.y, y: -a.x }
        : kind === "right"
          ? { x: -a.y, y: a.x }
          : kind === "reflect"
            ? { x: -a.x, y: a.y }
            : { x: a.x, y: -a.y };
    Object.assign(v, add(c, next));
  }
  // Label offsets are physical page offsets and remain explicit; text stays upright.
  return validate(n);
}
function constrainOne(e: Envelope, t: Triangle, moved: string) {
  if (t.equilateral) {
    const ids = t.vertices,
      apex = point(e, ids[0]),
      b = point(e, ids[1]),
      c = point(e, ids[2]);
    const base = sub(c, b),
      mid = mul(add(b, c), 0.5),
      normal = unit({ x: -base.y, y: base.x }),
      sign = cross(base, sub(apex, b)) >= 0 ? 1 : -1;
    Object.assign(
      apex,
      add(mid, mul(normal, ((length(base) * Math.sqrt(3)) / 2) * sign)),
    );
  }
  if (t.equalAt && !t.equilateral) {
    const a = point(e, t.equalAt),
      [b, c] = t.vertices
        .filter((id) => id !== t.equalAt)
        .map((id) => point(e, id)),
      mid = mul(add(b, c), 0.5),
      axis = unit({ x: -(c.y - b.y), y: c.x - b.x });
    Object.assign(a, add(mid, mul(axis, dot(sub(a, mid), axis))));
  }
  if (t.rightAt) {
    const a = point(e, t.rightAt),
      [b, c] = t.vertices
        .filter((id) => id !== t.rightAt)
        .map((id) => point(e, id));
    if (moved === a.id) {
      const mid = mul(add(b, c), 0.5),
        radius = distance(b, c) / 2;
      Object.assign(a, add(mid, mul(unit(sub(a, mid)), radius)));
    } else {
      const p = moved === c.id ? c : b,
        q = p === b ? c : b,
        axis = unit({ x: -(q.y - a.y), y: q.x - a.x });
      Object.assign(p, add(a, mul(axis, dot(sub(p, a), axis))));
    }
  }
}
export function moveVertex(e: Envelope, id: string, next: Point) {
  const n = structuredClone(e),
    split = n.document.split;
  let splitT: number | undefined;
  if (split)
    splitT = projection(
      point(n, split.point),
      point(n, split.from),
      point(n, split.to),
    ).t;
  Object.assign(point(n, id), { x: next.x, y: next.y });
  for (const t of n.document.triangles.filter(
    (t) => t.equilateral && t.vertices[0] === id,
  )) {
    const [a, b, c] = t.vertices.map((id) => point(n, id)),
      mid = mul(add(b, c), 0.5),
      height = sub(a, mid),
      half = length(height) / Math.sqrt(3),
      normal = unit({ x: -height.y, y: height.x }),
      sign = dot(sub(b, mid), normal) >= 0 ? 1 : -1;
    Object.assign(b, add(mid, mul(normal, half * sign)));
    Object.assign(c, add(mid, mul(normal, -half * sign)));
  }
  for (let i = 0; i < 24; i++) {
    for (const t of n.document.triangles.filter((t) => t.vertices.includes(id)))
      constrainOne(n, t, id);
    if (split) {
      const p = point(n, split.point),
        a = point(n, split.from),
        b = point(n, split.to);
      const t = id === split.point ? projection(p, a, b).t : splitT!;
      if (t <= 0.03 || t >= 0.97)
        throw Error(
          "Keep the split point inside the side, away from its endpoints.",
        );
      Object.assign(p, add(a, mul(sub(b, a), t)));
    }
  }
  return validate(n);
}
export function setConstraint(
  e: Envelope,
  triangleId: string,
  type: "right" | "equal" | "equilateral" | "none",
  vertex: string,
) {
  const n = structuredClone(e),
    t = n.document.triangles.find((t) => t.id === triangleId)!;
  t.rightAt = type === "right" ? vertex : null;
  t.equalAt = type === "equal" || type === "equilateral" ? vertex : null;
  t.equilateral = type === "equilateral";
  // Explicitly replacing a constraint is one transaction; markers track that choice.
  for (const a of n.document.angles.filter((a) => a.id.startsWith(t.id + "-")))
    if (a.mark === "right") a.mark = "none";
  if (type === "equilateral") {
    t.vertices = [vertex, ...t.vertices.filter((id) => id !== vertex)] as [
      string,
      string,
      string,
    ];
  }
  if (type === "right") {
    const a = point(n, vertex),
      [b, c] = t.vertices
        .filter((id) => id !== vertex)
        .map((id) => point(n, id)),
      axis = unit({ x: -(b.y - a.y), y: b.x - a.x }),
      sign = dot(sub(c, a), axis) >= 0 ? 1 : -1;
    Object.assign(c, add(a, mul(axis, distance(c, a) * sign)));
    const angle = n.document.angles.find((a) => a.id === `${t.id}-${vertex}`);
    if (angle) angle.mark = "right";
  }
  for (let i = 0; i < 24; i++)
    for (const triangle of n.document.triangles)
      constrainOne(n, triangle, vertex);
  return validate(n);
}
function nextId(e: Envelope, candidates: string[]) {
  return candidates.find(
    (id) => !e.document.vertices.some((v) => v.id === id),
  )!;
}
export function addTriangle(
  e: Envelope,
  kind: "separate" | "joined" | "split",
  edgeId?: string,
): Envelope {
  if (e.document.triangles.filter((t) => t.role === "component").length !== 1)
    throw Error(
      "Two component triangles are already present. Remove the second triangle first.",
    );
  const n = structuredClone(e),
    d = n.document,
    t = d.triangles[0],
    base = d.edges.find((v) => v.id === edgeId) ?? d.edges[1];
  if (kind === "separate") {
    const ids = ["P", "Q", "R"].map((id, i) =>
        d.vertices.some((v) => v.id === id)
          ? nextId(n, ["D", "E", "F"].slice(i))
          : id,
      ),
      maxX = Math.max(...d.vertices.map((v) => v.x)),
      minY = Math.min(...d.vertices.map((v) => v.y));
    const points = [
      { id: ids[0], x: maxX + 35, y: minY + 60 },
      { id: ids[1], x: maxX + 35, y: minY },
      { id: ids[2], x: maxX + 115, y: minY + 60 },
    ];
    const second = build(points, [
      { id: "T2", vertices: ids as [string, string, string], rightAt: ids[0] },
    ]);
    d.vertices.push(...second.document.vertices);
    d.edges.push(...second.document.edges);
    d.angles.push(...second.document.angles);
    d.triangles.push(...second.document.triangles);
  } else if (kind === "joined") {
    const a = point(n, base.from),
      b = point(n, base.to),
      old = point(n, t.vertices.find((id) => ![a.id, b.id].includes(id))!),
      mid = mul(add(a, b), 0.5),
      normal = unit({ x: -(b.y - a.y), y: b.x - a.x }),
      sign = cross(sub(b, a), sub(old, a)) >= 0 ? -1 : 1;
    const id = nextId(n, ["D", "E", "F"]),
      v = { id, ...add(mid, mul(normal, distance(a, b) * 0.7 * sign)) },
      second = build([a, b, v], [{ id: "T2", vertices: [a.id, b.id, id] }]);
    d.vertices.push(second.document.vertices[2]);
    d.edges.push(...second.document.edges.filter((v) => v.id !== base.id));
    d.angles.push(...second.document.angles);
    d.triangles.push(second.document.triangles[0]);
  } else {
    const a = point(n, base.from),
      b = point(n, base.to),
      apex = t.vertices.find((id) => ![a.id, b.id].includes(id))!,
      id = nextId(n, ["D", "E", "F"]),
      v = { id, ...mul(add(a, b), 0.5) };
    const made = build(
      [...d.vertices, v].map((v) => ({ id: v.id, x: v.x, y: v.y })),
      [
        { ...t, role: "outer" },
        { id: "T2", vertices: [apex, a.id, id] },
        { id: "T3", vertices: [apex, id, b.id] },
      ],
      "split",
    );
    // Existing labels/IDs survive on outer objects; the full base is an annotation-only side.
    for (const edge of made.document.edges) {
      const old = d.edges.find((v) => v.id === edge.id);
      if (old) Object.assign(edge, structuredClone(old));
      if (edge.id === base.id) edge.draw = false;
    }
    for (const angle of made.document.angles) {
      const old = d.angles.find((v) => v.id === angle.id);
      if (old) Object.assign(angle, structuredClone(old));
    }
    made.document.vertices = d.vertices.concat({ ...v, label: label(id) });
    made.document.heights = d.heights;
    made.document.captions = d.captions;
    made.document.sharedLabels = d.sharedLabels;
    made.document.sourceId = d.sourceId;
    made.document.notToScale = d.notToScale;
    made.document.widthCm = 16;
    made.document.split = { point: id, from: a.id, to: b.id };
    return validate(made);
  }
  d.layout = kind;
  d.widthCm = 16;
  return validate(n);
}
export function removeSecond(e: Envelope) {
  if (e.document.layout === "single") return e;
  const n = structuredClone(e),
    d = n.document,
    keep =
      d.layout === "split"
        ? d.triangles.find((t) => t.role === "outer")!
        : d.triangles[0];
  d.triangles = [{ ...keep, role: "component" }];
  d.vertices = d.vertices.filter((v) => keep.vertices.includes(v.id));
  d.edges = d.edges.filter(
    (v) => keep.vertices.includes(v.from) && keep.vertices.includes(v.to),
  );
  d.edges.forEach((v) => (v.draw = true));
  d.angles = d.angles.filter((a) => a.id.startsWith(keep.id + "-"));
  d.heights = d.heights.filter((h) => h.triangleId === keep.id);
  d.layout = "single";
  d.split = null;
  return validate(n);
}
export function addHeight(e: Envelope, triangleId: string, apex: string) {
  const n = structuredClone(e),
    d = n.document,
    t = d.triangles.find((t) => t.id === triangleId)!;
  if (
    d.heights.length >= 2 ||
    d.heights.some((h) => h.triangleId === triangleId)
  )
    throw Error("Use one height per triangle, up to two heights.");
  const base = d.edges.find(
    (v) =>
      t.vertices.includes(v.from) &&
      t.vertices.includes(v.to) &&
      ![v.from, v.to].includes(apex),
  )!;
  d.heights.push({
    id: d.heights.some((h) => h.id === "H1") ? "H2" : "H1",
    triangleId,
    apex,
    base: base.id,
    label: label("h", "symbol", "cm"),
    footName: "",
  });
  return validate(n);
}
export function heightFoot(e: Envelope, heightId: string) {
  const h = e.document.heights.find((h) => h.id === heightId)!,
    b = e.document.edges.find((b) => b.id === h.base)!;
  return projection(point(e, h.apex), point(e, b.from), point(e, b.to));
}
export function caption(
  e: Envelope,
  text = "",
  state: Label["state"] = "value",
  unit_: Label["unit"] = "",
) {
  const n = structuredClone(e);
  if (n.document.captions.length >= 2) throw Error("Use up to two captions.");
  n.document.captions.push({
    id: n.document.captions.some((c) => c.id === "C1") ? "C2" : "C1",
    label: label(text, state, unit_),
  });
  return validate(n);
}
export function triangleVertices(
  e: Envelope,
  t: Triangle,
): [Vertex, Vertex, Vertex] {
  return t.vertices.map((id) => point(e, id)) as [Vertex, Vertex, Vertex];
}
