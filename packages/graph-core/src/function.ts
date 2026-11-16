import type { Bounds, Coordinate, FunctionEquation, FunctionObject } from "./types";

/**
 * Equation curves for exam graph work: quadratics and cubics, y = k/x, y = k × bˣ and the trig
 * graphs in degrees (y = a sin(bx + d) + c). Drawn as joined cubic Bézier pieces that match the
 * curve's value and gradient at every joint, broken at asymptotes and where the curve leaves the
 * grid by a wide margin, so a steep branch is clipped rather than joined across the gap.
 */

const RAD = Math.PI / 180;

/** y and dy/dx at x, or null where the curve has no value (an asymptote). */
export function functionValue(e: FunctionEquation, x: number): { y: number; slope: number } | null {
  let out: { y: number; slope: number };
  if (e.family === "polynomial") {
    const d = e.cubic ?? 0;
    out = { y: d * x ** 3 + e.a * x * x + e.b * x + e.c, slope: 3 * d * x * x + 2 * e.a * x + e.b };
  } else if (e.family === "reciprocal") {
    if (Math.abs(x) < 1e-12) return null;
    out = { y: e.k / x + e.c, slope: -e.k / (x * x) };
  } else if (e.family === "exponential") {
    const p = e.coefficient * e.base ** x;
    out = { y: p + e.c, slope: p * Math.log(e.base) };
  } else {
    const angle = (e.multiplier * x + e.shift) * RAD, inner = e.multiplier * RAD;
    if (e.fn === "sin") out = { y: e.amplitude * Math.sin(angle) + e.c, slope: e.amplitude * inner * Math.cos(angle) };
    else if (e.fn === "cos") out = { y: e.amplitude * Math.cos(angle) + e.c, slope: -e.amplitude * inner * Math.sin(angle) };
    else {
      const cos = Math.cos(angle);
      if (Math.abs(cos) < 1e-9) return null;
      out = { y: e.amplitude * Math.tan(angle) + e.c, slope: (e.amplitude * inner) / (cos * cos) };
    }
  }
  return Number.isFinite(out.y) && Number.isFinite(out.slope) ? out : null;
}

/** A teacher-readable reason the equation cannot be drawn, or null. */
export function functionProblem(e: FunctionEquation): string | null {
  const values = Object.values(e).filter((v): v is number => typeof v === "number");
  if (values.some((v) => !Number.isFinite(v))) return "use finite numbers.";
  if (e.family === "polynomial" && !(e.cubic ?? 0) && !e.a) return "the equation needs an x² or x³ term; use a straight line for y = mx + c.";
  if (e.family === "reciprocal" && !e.k) return "use a nonzero k in y = k/x.";
  if (e.family === "exponential") {
    if (!(e.base > 0) || e.base === 1) return "use a positive base other than 1, such as 2 or 1/2.";
    if (!e.coefficient) return "use a nonzero number in front of the power.";
  }
  if (e.family === "trig") {
    if (!e.amplitude) return "use a nonzero number in front of the trig function.";
    if (!e.multiplier) return "use a nonzero multiple of x inside the trig function.";
  }
  return null;
}

/** The x values inside (from, to) where the curve has an asymptote. */
export function asymptotes(e: FunctionEquation, from: number, to: number): number[] {
  if (e.family === "reciprocal") return from < 0 && to > 0 ? [0] : [];
  if (e.family !== "trig" || e.fn !== "tan") return [];
  // multiplier·x + shift = 90 + 180k.
  const period = 180 / Math.abs(e.multiplier);
  const first = (90 - e.shift) / e.multiplier;
  const out: number[] = [];
  for (let k = Math.ceil((from - first) / period); first + k * period < to && out.length < 200; k++) {
    const x = first + k * period;
    if (x > from) out.push(x);
  }
  return out;
}

/** The x range the curve is drawn over: its own from/to, inside the grid. */
export function functionDomain(object: FunctionObject, bounds: Bounds): { from: number; to: number } | null {
  const from = Math.max(object.from ?? bounds.xMin, bounds.xMin), to = Math.min(object.to ?? bounds.xMax, bounds.xMax);
  return to - from > 1e-9 ? { from, to } : null;
}

type Sample = Coordinate & { slope: number };

/**
 * The curve as runs of samples (value and gradient) on the grid's x range. A run ends at an
 * asymptote, where the curve has no value, or where it goes far beyond the grid vertically.
 */
export function functionRuns(object: FunctionObject, bounds: Bounds): Sample[][] {
  const domain = functionDomain(object, bounds);
  if (!domain) return [];
  const span = bounds.yMax - bounds.yMin;
  const low = bounds.yMin - span, high = bounds.yMax + span;
  const edges = [domain.from, ...asymptotes(object.equation, domain.from, domain.to), domain.to];
  const runs: Sample[][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    // Stay a hair away from an asymptote; pieces are short enough to follow any curve here.
    const a = edges[i] + (i > 0 ? 1e-6 * (domain.to - domain.from) : 0);
    const b = edges[i + 1] - (i + 2 < edges.length ? 1e-6 * (domain.to - domain.from) : 0);
    // At least 24 pieces per trig period, so a fast-repeating graph is not undersampled.
    const e = object.equation;
    const periods = e.family === "trig" ? ((b - a) * Math.abs(e.multiplier)) / (e.fn === "tan" ? 180 : 360) : 0;
    const steps = Math.min(4000, Math.max(8, Math.ceil(((b - a) / (domain.to - domain.from)) * 160), Math.ceil(periods * 24)));
    const sample = (x: number): Sample | null => {
      const v = functionValue(e, x);
      return v && v.y >= low && v.y <= high ? { x, y: v.y, slope: v.slope } : null;
    };
    // Where the curve leaves (or enters) the window between two samples, bisect for the last
    // point inside it, so a steep branch still reaches the grid's edge.
    const edge = (inside: number, outside: number): Sample | null => {
      let good = inside, bad = outside;
      for (let k = 0; k < 50; k++) {
        const m = (good + bad) / 2;
        if (sample(m)) good = m;
        else bad = m;
      }
      return good === inside ? null : sample(good);
    };
    let run: Sample[] = [];
    let previous = a;
    for (let k = 0; k <= steps; k++) {
      const x = a + ((b - a) * k) / steps;
      const s = sample(x);
      if (!s) {
        if (run.length) {
          const end = edge(previous, x);
          if (end) run.push(end);
        }
        if (run.length > 1) runs.push(run);
        run = [];
      } else {
        if (!run.length && k > 0) {
          const start = edge(x, previous);
          if (start) run.push(start);
        }
        run.push(s);
      }
      previous = x;
    }
    if (run.length > 1) runs.push(run);
  }
  return runs;
}

/** SVG path data for the curve, with `map` taking graph units to drawing units. */
export function functionPathData(object: FunctionObject, bounds: Bounds, map: (p: Coordinate) => Coordinate, format: (n: number) => string = (n) => String(Number(n.toFixed(3)))): string {
  return functionRuns(object, bounds)
    .map((run) => {
      const start = map(run[0]);
      let d = `M ${format(start.x)} ${format(start.y)}`;
      for (let i = 1; i < run.length; i++) {
        // Hermite to Bézier in graph units; the map is affine, so the curve maps exactly.
        const p = run[i - 1], q = run[i], h = (q.x - p.x) / 3;
        const c1 = map({ x: p.x + h, y: p.y + p.slope * h }), c2 = map({ x: q.x - h, y: q.y - q.slope * h }), end = map(q);
        d += ` C ${format(c1.x)} ${format(c1.y)} ${format(c2.x)} ${format(c2.y)} ${format(end.x)} ${format(end.y)}`;
      }
      return d;
    })
    .join(" ");
}

/** True when some of the curve is on the grid. */
export function functionVisible(object: FunctionObject, bounds: Bounds): boolean {
  return functionRuns(object, bounds).some((run) => run.some((p) => p.y >= bounds.yMin - 1e-9 && p.y <= bounds.yMax + 1e-9));
}

/** The curve's value and gradient at x, inside its own from/to, or null. */
export function functionValueOn(object: FunctionObject, x: number): { y: number; slope: number } | null {
  if ((object.from !== undefined && x < object.from - 1e-9) || (object.to !== undefined && x > object.to + 1e-9)) return null;
  return functionValue(object.equation, x);
}

/** A number as printed: a fraction such as 1/3 when it is one with a small denominator. */
const fmt = (n: number) => {
  for (let d = 2; d <= 12; d++) {
    const top = Math.round(n * d);
    if (Math.abs(n * d - top) < 1e-9 && top % d !== 0) {
      const g = gcd(Math.abs(top), d);
      return `${top < 0 ? "−" : ""}${Math.abs(top) / g}/${d / g}`;
    }
  }
  return String(Number(n.toFixed(6))).replace("-", "−");
};
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** A signed term such as " + 3x" or " − x²", or "" for zero. */
function term(k: number, power: string, first: boolean): string {
  if (!k) return "";
  const sign = k < 0 ? (first ? "−" : " − ") : first ? "" : " + ";
  const size = Math.abs(k);
  return `${sign}${size === 1 && power ? "" : fmt(size)}${power}`;
}

/** The equation as printed, such as y = x² − 3x + 1 or y = 2 sin(x + 30)° + 1 (degrees). */
export function formatFunction(e: FunctionEquation): string {
  if (e.family === "polynomial") {
    const parts = [[e.cubic ?? 0, "x³"], [e.a, "x²"], [e.b, "x"], [e.c, ""]] as const;
    let out = "";
    for (const [k, p] of parts) out += term(k, p, out === "");
    return `y = ${out}`;
  }
  const constant = e.c ? term(e.c, "", false) : "";
  // k prints as a decimal (0.5/x, not 1/2/x).
  if (e.family === "reciprocal") return `y = ${e.k < 0 ? "−" : ""}${Number(Math.abs(e.k).toFixed(6))}/x${constant}`;
  if (e.family === "exponential") return `y = ${e.coefficient === 1 ? "" : e.coefficient === -1 ? "−" : `${fmt(e.coefficient)} × `}${e.base > 0 && e.base < 1 ? `(${fmt(e.base)})` : fmt(e.base)}ˣ${constant}`;
  const inside = `${term(e.multiplier, "x", true)}${e.shift ? term(e.shift, "", false) : ""}`;
  const front = e.amplitude === 1 ? "" : e.amplitude === -1 ? "−" : fmt(e.amplitude);
  return `y = ${front}${e.fn} ${inside === "x" ? "x" : `(${inside})`}${constant}`;
}

/** The last point of the curve on the grid, where its name goes, or null. */
export function functionNameAnchor(object: FunctionObject, bounds: Bounds): Coordinate | null {
  const runs = functionRuns(object, bounds);
  for (let r = runs.length - 1; r >= 0; r--)
    for (let i = runs[r].length - 1; i >= 0; i--) {
      const p = runs[r][i];
      if (p.y >= bounds.yMin - 1e-9 && p.y <= bounds.yMax + 1e-9) return { x: p.x, y: p.y };
    }
  return null;
}
