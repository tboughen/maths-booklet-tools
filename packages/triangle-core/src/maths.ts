import { parseNumber } from "../../ratio-table-core/src/numbers";
import {
  allLabels,
  basis,
  getLabel,
  numeric,
  point,
  textOf,
  validate,
  type Envelope,
  type Label,
} from "./model";
import { centre } from "./geometry";

export const methods = [
  "pythagoras-hypotenuse",
  "pythagoras-leg",
  "right-side",
  "right-angle",
  "sine-side",
  "sine-angle",
  "cosine-side",
  "cosine-angle",
  "area-height",
  "height-area",
  "area-sine",
  "area-angle",
  "angle-sum",
] as const;
export type Method = (typeof methods)[number];
export const methodNames: Record<Method, string> = {
  "pythagoras-hypotenuse": "Pythagoras: hypotenuse",
  "pythagoras-leg": "Pythagoras: shorter side",
  "right-side": "Right trigonometry: side",
  "right-angle": "Right trigonometry: angle",
  "sine-side": "Sine rule: side",
  "sine-angle": "Sine rule: angle",
  "cosine-side": "Cosine rule: side",
  "cosine-angle": "Cosine rule: angle",
  "area-height": "Area: base × perpendicular height ÷ 2",
  "height-area": "Height: 2 × area ÷ base",
  "area-sine": "Area: ½bc sin A",
  "area-angle": "Area: find included angle",
  "angle-sum": "Third angle",
};
export type Rounding = { kind: "dp" | "sf" | "exact"; digits: number };
export type Result = {
  value: number;
  exact: string | null;
  formula: string;
  dimension: "length" | "angle" | "area";
  branch: string;
};
const deg = Math.PI / 180;
const positive = (s: string, name: string) => {
  const n = numeric(s);
  if (n <= 0) throw Error(`${name} must be positive.`);
  return n;
};
const angle = (s: string, name: string) => {
  const n = positive(s, name);
  if (n >= 180) throw Error(`${name} must be less than 180°.`);
  return n;
};
const acute = (s: string) => {
  const n = angle(s, "Angle");
  if (n >= 90)
    throw Error("Use an acute angle for right-triangle trigonometry.");
  return n;
};
function domain(n: number) {
  if (!Number.isFinite(n) || n < -1 - 1e-12 || n > 1 + 1e-12)
    throw Error(
      "These values do not produce a valid inverse-trigonometric result.",
    );
  return Math.min(1, Math.max(-1, n));
}
function inequality(a: number, b: number, c: number) {
  if (
    Math.min(a, b, c) <= 0 ||
    Math.min(a + b - c, b + c - a, c + a - b) <= Math.max(a, b, c) * 1e-12
  )
    throw Error("These lengths cannot form a non-degenerate triangle.");
}
const gcd = (a: bigint, b: bigint): bigint => {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
};
function isqrt(n: bigint) {
  if (n < 0n) throw Error("A real square root needs a non-negative value.");
  if (n < 2n) return n;
  let x = n,
    y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
function exactRoot(a: string, b: string, sign = 1) {
  const x = parseNumber(a),
    y = parseNumber(b);
  let n = x.n * x.n * y.d * y.d + BigInt(sign) * y.n * y.n * x.d * x.d,
    d = x.d * x.d * y.d * y.d;
  if (n <= 0n)
    throw Error("The hypotenuse must be longer than the known shorter side.");
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const rootN = isqrt(n),
    rootD = isqrt(d);
  if (rootN * rootN === n && rootD * rootD === d)
    return rootD === 1n ? String(rootN) : `${rootN}/${rootD}`;
  if (rootD * rootD !== d) return `√(${n}/${d})`;
  let factor = 1n,
    remaining = n;
  for (let p = 2n; p <= 10000n && p * p <= remaining; p++) {
    while (remaining % (p * p) === 0n) {
      factor *= p;
      remaining /= p * p;
    }
  }
  const r = isqrt(remaining);
  if (r * r === remaining) {
    factor *= r;
    remaining = 1n;
  }
  const top =
    remaining === 1n
      ? String(factor)
      : `${factor === 1n ? "" : factor}√${remaining}`;
  return rootD === 1n ? top : `(${top})/${rootD}`;
}
export function formatResult(r: Result, round: Rounding) {
  if (round.kind === "exact" && r.exact) return r.exact;
  if (round.kind === "exact")
    throw Error(
      "An exact form is unavailable here. Choose decimal places or significant figures.",
    );
  const max = round.kind === "sf" ? 8 : 6;
  if (
    !Number.isInteger(round.digits) ||
    round.digits < (round.kind === "sf" ? 1 : 0) ||
    round.digits > max
  )
    throw Error(
      `Choose ${round.kind === "sf" ? "1–8 significant figures" : "0–6 decimal places"}.`,
    );
  if (!Number.isFinite(r.value) || r.value <= 0 || r.value > 1e12)
    throw Error("The result is outside the supported positive range.");
  return round.kind === "sf"
    ? r.value.toPrecision(round.digits)
    : r.value.toFixed(round.digits);
}
export function calculate(
  method: Method,
  raw: Record<string, string>,
): Result[] {
  const p = (key: string) => positive(raw[key] ?? "", key),
    a = (key: string) => angle(raw[key] ?? "", key);
  const result = (
    value: number,
    dimension: Result["dimension"],
    formula: string,
    exact: string | null = null,
    branch = "Unique result",
  ): Result => {
    if (!Number.isFinite(value) || value <= 0)
      throw Error("No positive finite result exists for these values.");
    return { value, dimension, formula, exact, branch };
  };
  if (method === "pythagoras-hypotenuse")
    return [
      result(
        Math.hypot(p("p"), p("q")),
        "length",
        `h = √(${raw.p}² + ${raw.q}²)`,
        exactRoot(raw.p, raw.q),
      ),
    ];
  if (method === "pythagoras-leg") {
    const h = p("h"),
      p_ = p("p");
    if (h <= p_)
      throw Error("The hypotenuse must be longer than the known shorter side.");
    return [
      result(
        Math.sqrt((h - p_) * (h + p_)),
        "length",
        `q = √(${raw.h}² − ${raw.p}²)`,
        exactRoot(raw.h, raw.p, -1),
      ),
    ];
  }
  if (method === "right-side") {
    const theta = acute(raw.angle) * deg,
      v = p("known"),
      ratios = { H: 1, O: Math.sin(theta), A: Math.cos(theta) },
      known = raw.knownSide as keyof typeof ratios,
      target = raw.targetSide as keyof typeof ratios;
    if (!(known in ratios) || !(target in ratios) || known === target)
      throw Error(
        "Choose two different sides: hypotenuse, opposite or adjacent.",
      );
    return [
      result(
        (v * ratios[target]) / ratios[known],
        "length",
        `${target} = ${raw.known} × ${target === "H" ? "1" : target === "O" ? `sin ${raw.angle}°` : `cos ${raw.angle}°`} ÷ ${known === "H" ? "1" : known === "O" ? `sin ${raw.angle}°` : `cos ${raw.angle}°`}`,
      ),
    ];
  }
  if (method === "right-angle") {
    const num = p("numerator"),
      den = p("denominator"),
      ratio = raw.ratio ?? "cos";
    if (!["sin", "cos", "tan"].includes(ratio))
      throw Error("Choose sin, cos or tan.");
    if (ratio !== "tan" && num >= den)
      throw Error("A shorter side must be less than the hypotenuse.");
    const v =
      ratio === "tan"
        ? Math.atan(num / den)
        : ratio === "sin"
          ? Math.asin(domain(num / den))
          : Math.acos(domain(num / den));
    return [
      result(
        v / deg,
        "angle",
        `θ = ${ratio}⁻¹(${raw.numerator}/${raw.denominator})`,
      ),
    ];
  }
  if (method === "sine-side") {
    const side = p("a"),
      A = a("A"),
      B = a("B");
    if (A + B >= 180 - 1e-9)
      throw Error("The two angles must add to less than 180°.");
    return [
      result(
        (side * Math.sin(B * deg)) / Math.sin(A * deg),
        "length",
        `b = ${raw.a} sin ${raw.B}° / sin ${raw.A}°`,
      ),
    ];
  }
  if (method === "sine-angle") {
    const known = p("a"),
      A = a("A"),
      b = p("b"),
      B = Math.asin(domain((b * Math.sin(A * deg)) / known)) / deg;
    const candidates = [B, 180 - B].filter(
      (B, i, all) =>
        B > 0 && A + B < 180 - 1e-8 && (i === 0 || Math.abs(B - all[0]) > 1e-8),
    );
    if (!candidates.length)
      throw Error("No triangle satisfies these lengths and angles.");
    return candidates.map((B, i) =>
      result(
        B,
        "angle",
        `sin B = ${raw.b} sin ${raw.A}° / ${raw.a}; C = ${(180 - A - B).toFixed(4)}°`,
        null,
        candidates.length === 1
          ? "Only valid triangle"
          : i === 0
            ? "Acute B"
            : "Obtuse B",
      ),
    );
  }
  if (method === "cosine-side") {
    const b = p("b"),
      c = p("c"),
      A = a("A"),
      v = Math.sqrt((b - c) ** 2 + 4 * b * c * Math.sin((A * deg) / 2) ** 2);
    inequality(v, b, c);
    return [
      result(
        v,
        "length",
        `a² = ${raw.b}² + ${raw.c}² − 2 × ${raw.b} × ${raw.c} cos ${raw.A}°`,
      ),
    ];
  }
  if (method === "cosine-angle") {
    const aa = p("a"),
      b = p("b"),
      c = p("c");
    inequality(aa, b, c);
    return [
      result(
        Math.acos(domain((b * b + c * c - aa * aa) / (2 * b * c))) / deg,
        "angle",
        `A = cos⁻¹((${raw.b}² + ${raw.c}² − ${raw.a}²) / (2 × ${raw.b} × ${raw.c}))`,
      ),
    ];
  }
  if (method === "height-area")
    return [
      result(
        (2 * p("area")) / p("base"),
        "length",
        `h = 2 × ${raw.area} ÷ ${raw.base}`,
      ),
    ];
  if (method === "area-height")
    return [
      result(
        (p("base") * p("height")) / 2,
        "area",
        `Area = ½ × ${raw.base} × ${raw.height}`,
      ),
    ];
  if (method === "area-sine")
    return [
      result(
        (p("b") * p("c") * Math.sin(a("A") * deg)) / 2,
        "area",
        `Area = ½ × ${raw.b} × ${raw.c} × sin ${raw.A}°`,
      ),
    ];
  if (method === "area-angle") {
    const b = p("b"),
      c = p("c"),
      area = p("area"),
      A = Math.asin(domain((2 * area) / (b * c))) / deg;
    return [A, 180 - A]
      .filter((v, i, list) => i === 0 || Math.abs(v - list[0]) > 1e-8)
      .map((A, i) =>
        result(
          A,
          "angle",
          `sin A = 2 × ${raw.area} / (${raw.b} × ${raw.c})`,
          null,
          A === 90
            ? "Right angle"
            : i === 0
              ? "Acute included angle"
              : "Obtuse included angle",
        ),
      );
  }
  if (method === "angle-sum") {
    const A = a("A"),
      B = a("B");
    if (A + B >= 180)
      throw Error("The given angles must add to less than 180°.");
    return [result(180 - A - B, "angle", `C = 180° − ${raw.A}° − ${raw.B}°`)];
  }
  throw Error("Choose a supported calculation.");
}
export function saveAnswer(
  e: Envelope,
  ref: string,
  r: Result,
  round: Rounding,
  unit_: Label["unit"],
  overwrite = false,
) {
  const n = structuredClone(e),
    l = getLabel(n, ref),
    item = allLabels(n).find((x) => x.ref === ref)!;
  if (item.kind === "vertex")
    throw Error("Choose a side, angle, height or caption for the answer.");
  if (
    (r.dimension === "angle" && item.kind !== "angle") ||
    (r.dimension === "length" &&
      !["edge", "height", "caption"].includes(item.kind)) ||
    (r.dimension === "area" && item.kind !== "caption")
  )
    throw Error("Choose a target of the same kind as this result.");
  if ((l.answer || l.state === "value") && !overwrite)
    throw Error(
      "This target already has a given or saved answer. Choose the explicit overwrite action.",
    );
  if (
    (r.dimension === "angle" && unit_ !== "°") ||
    (r.dimension === "area" && !unit_.endsWith("²")) ||
    (r.dimension === "length" && !["mm", "cm", "m", ""].includes(unit_))
  )
    throw Error("Choose a unit matching the result.");
  l.answer = formatResult(r, round);
  l.unit = unit_;
  l.answerVisible = false;
  // The unit itself is part of the mathematical input state; fingerprint after setting it.
  l.calculation = { basis: basis(n), formula: r.formula };
  return validate(n);
}
export function workedCopy(e: Envelope) {
  const n = structuredClone(e);
  for (const { label: l } of allLabels(n)) if (l.answer) l.answerVisible = true;
  return validate(n);
}
export type Construction = "SSS" | "SAS" | "ASA" | "AAS" | "right";
export function construct(
  e: Envelope,
  triangleId: string,
  method: Construction,
  raw: Record<string, string>,
) {
  let aa = 0,
    b = 0,
    c = 0,
    A = 0;
  if (method === "SSS") {
    aa = positive(raw.a, "a");
    b = positive(raw.b, "b");
    c = positive(raw.c, "c");
    inequality(aa, b, c);
    A = Math.acos(domain((b * b + c * c - aa * aa) / (2 * b * c)));
  }
  if (method === "SAS") {
    b = positive(raw.b, "b");
    c = positive(raw.c, "c");
    A = angle(raw.A, "A") * deg;
  }
  if (method === "ASA") {
    const a_ = angle(raw.A, "A"),
      b_ = angle(raw.B, "B"),
      C = 180 - a_ - b_;
    if (C <= 0) throw Error("The two angles must add to less than 180°.");
    c = positive(raw.c, "c");
    b = (c * Math.sin(b_ * deg)) / Math.sin(C * deg);
    A = a_ * deg;
  }
  if (method === "AAS") {
    const a_ = angle(raw.A, "A"),
      c_ = angle(raw.C, "C"),
      B = 180 - a_ - c_;
    if (B <= 0) throw Error("The two angles must add to less than 180°.");
    c = positive(raw.c, "c");
    b = (c * Math.sin(B * deg)) / Math.sin(c_ * deg);
    A = a_ * deg;
  }
  if (method === "right") {
    b = positive(raw.b, "AC");
    c = positive(raw.c, "AB");
    A = Math.PI / 2;
  }
  const n = structuredClone(e),
    t = n.document.triangles.find((t) => t.id === triangleId);
  if (!t) throw Error("Choose an existing triangle.");
  const oldSplit = e.document.split;
  let splitT = 0.5;
  if (oldSplit) {
    const p = point(e, oldSplit.point),
      a = point(e, oldSplit.from),
      b_ = point(e, oldSplit.to);
    splitT =
      ((p.x - a.x) * (b_.x - a.x) + (p.y - a.y) * (b_.y - a.y)) /
      ((b_.x - a.x) ** 2 + (b_.y - a.y) ** 2);
  }
  const origin = centre({
      ...e,
      document: {
        ...e.document,
        vertices: t.vertices.map((id) => point(e, id)),
      },
    }),
    scale = 90 / Math.max(b, c),
    made = [
      { x: 0, y: 0 },
      { x: c * scale, y: 0 },
      { x: b * Math.cos(A) * scale, y: -b * Math.sin(A) * scale },
    ],
    mid = {
      x: made.reduce((s, v) => s + v.x, 0) / 3,
      y: made.reduce((s, v) => s + v.y, 0) / 3,
    };
  t.vertices.forEach((id, i) =>
    Object.assign(point(n, id), {
      x: made[i].x - mid.x + origin.x,
      y: made[i].y - mid.y + origin.y,
    }),
  );
  t.rightAt = method === "right" ? t.vertices[0] : null;
  t.equalAt = null;
  t.equilateral = false;
  for (const a of n.document.angles.filter((a) =>
    a.id.startsWith(t.id + "-"),
  )) {
    if (a.mark === "right") a.mark = "none";
    if (a.vertex === t.rightAt) a.mark = "right";
  }
  if (n.document.split) {
    const s = n.document.split,
      p = point(n, s.point),
      a = point(n, s.from),
      b_ = point(n, s.to);
    Object.assign(p, {
      x: a.x + splitT * (b_.x - a.x),
      y: a.y + splitT * (b_.y - a.y),
    });
  }
  return validate(n);
}
export function measuredLabels(e: Envelope, triangleId: string) {
  const t = e.document.triangles.find((t) => t.id === triangleId)!;
  const [A, B, C] = t.vertices;
  const side = (p: string, q: string) =>
    e.document.edges.find(
      (v) => [v.from, v.to].sort().join(":") === [p, q].sort().join(":"),
    )!.label;
  const number = (l: Label) => {
    if (l.state !== "value") return "";
    try {
      numeric(textOf(e, l));
      return textOf(e, l);
    } catch {
      return "";
    }
  };
  const angle_ = (v: string) => {
    const a = e.document.angles.find((a) => a.id === `${t.id}-${v}`);
    return a?.mark === "right" ? "90" : a ? number(a.label) : "";
  };
  return {
    a: number(side(B, C)),
    b: number(side(A, C)),
    c: number(side(A, B)),
    A: angle_(A),
    B: angle_(B),
    C: angle_(C),
  };
}
