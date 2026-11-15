/**
 * Shapes freehand ink the way good pen apps do: smoothed, thicker when slow and thinner when fast, with tapered
 * ends. The shape is worked out from the stored points each time ink is drawn and is never stored itself.
 *
 * Everything is measured in multiples of the stroke's own size, in view units, so a stroke keeps exactly the same
 * shape at every zoom. Speed is measured in screen pixels at the zoom the stroke was drawn at, so a stroke's width
 * is fixed once drawn and the same hand speed gives the same width at any zoom. The numbers follow CueCurve's Present pen (tested on whiteboards, tablets and iPads), where a
 * medium pen is 4.3 px wide on a 1080p screen: smoothing reaches 7 px, the stroke is respaced every 1.5 px and a
 * step of 14 px between samples counts as fully fast.
 */
export type Point = [number, number];

const MEDIUM_PEN = 4.3;
const RESPACE = 1.5 / MEDIUM_PEN;
const REACH = 7 / MEDIUM_PEN;
/** A step of this many screen pixels between captured points counts as fully fast. */
const FAST_STEP_PX = 14;
/** The stroke turns more than this within the smoothing reach: a corner (a tick, a cross, an arrowhead) kept sharp. */
const CORNER_DEGREES = 70;
const SLOW_WIDTH = 1.18;
const FAST_WIDTH = 0.72;
const SPEED_PASSES = 4;
const TAPER_TO = 0.55;
const TAPER_WIDTHS = 3;
const TAPER_SHARE = 1 / 5;
/** The highlighter is wide, so it is smoothed with a medium pen's reach rather than its own size. */
const HIGHLIGHTER_UNIT = 3.5;

interface Sample { x: number; y: number; speed: number }

/** Each point's step from the one before, averaged with its neighbours so the width changes gradually. */
export function strokeSpeeds(points: Point[]): number[] {
  if (points.length < 2) return points.map(() => 0);
  let speeds = points.map((p, i) => i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0);
  speeds[0] = speeds[1];
  for (let pass = 0; pass < SPEED_PASSES; pass++) {
    speeds = speeds.map((s, i) => {
      const a = speeds[i - 1] ?? s, b = speeds[i + 1] ?? s;
      return (a + s + b) / 3;
    });
  }
  return speeds;
}

/** Evenly spaced samples along the stroke, every `spacing`, always keeping both ends where the pen put them. */
function respace(points: Point[], speeds: number[], spacing: number): Sample[] {
  const out: Sample[] = [{ x: points[0][0], y: points[0][1], speed: speeds[0] }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    let at = spacing - carry;
    while (at <= length) {
      const t = at / length;
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, speed: speeds[i - 1] + (speeds[i] - speeds[i - 1]) * t });
      at += spacing;
    }
    carry = length - (at - spacing);
  }
  const [lx, ly] = points[points.length - 1], last = out[out.length - 1];
  if (points.length > 1 && (last.x !== lx || last.y !== ly)) out.push({ x: lx, y: ly, speed: speeds[speeds.length - 1] });
  return out;
}

/**
 * The captured points where the stroke turns sharply (a tick, a cross, an arrowhead), comparing the directions to the
 * points about `reach` away along the stroke on either side. The ink is smoothed in pieces between them, so they stay
 * sharp and exactly where the pen turned.
 */
function cornersOf(points: Point[], reach: number): number[] {
  const n = points.length, along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const turn: number[] = new Array(n).fill(0);
  let a = 0, b = 0;
  for (let i = 1; i < n - 1; i++) {
    while (a < i && along[i] - along[a + 1] >= reach) a++;
    if (b < i) b = i;
    while (b < n - 1 && along[b] - along[i] < reach) b++;
    if (along[i] - along[a] < reach || along[b] - along[i] < reach) continue;
    const ux = points[i][0] - points[a][0], uy = points[i][1] - points[a][1], vx = points[b][0] - points[i][0], vy = points[b][1] - points[i][1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    turn[i] = lu && lv ? Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI : 180;
  }
  const out: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (turn[i] < CORNER_DEGREES) continue;
    // One corner per bend: the sharpest point within reach, the middle one when several tie.
    let first = i, last = i, peak = true;
    for (let j = i - 1; j >= 0 && along[i] - along[j] < reach; j--) { if (turn[j] > turn[i]) peak = false; if (turn[j] === turn[i]) first = j; }
    for (let j = i + 1; j < n && along[j] - along[i] < reach; j++) { if (turn[j] > turn[i]) peak = false; if (turn[j] === turn[i]) last = j; }
    if (peak && i === Math.floor((first + last) / 2) && !out.includes(i)) out.push(i);
  }
  return out;
}

/** A Gaussian blur along the stroke. Its reach shrinks near the ends, so the line never lags behind the nib. */
function smooth(samples: Sample[], reach: number): Sample[] {
  const n = samples.length;
  if (n < 3 || reach < 1) return samples;
  const sigma = reach / 2;
  return samples.map((sample, i) => {
    const k = Math.min(reach, i, n - 1 - i);
    if (k < 1) return sample;
    let x = 0, y = 0, total = 0;
    for (let j = -k; j <= k; j++) {
      const w = Math.exp(-(j * j) / (2 * sigma * sigma)), s = samples[i + j];
      x += s.x * w; y += s.y * w; total += w;
    }
    return { x: x / total, y: y / total, speed: sample.speed };
  });
}

function shapedSamples(points: Point[], unit: number): Sample[] {
  const spacing = Math.max(RESPACE * unit, 0.01), speeds = strokeSpeeds(points), reach = Math.round(REACH / RESPACE);
  const cuts = [0, ...cornersOf(points, REACH * unit), points.length - 1];
  const out: Sample[] = [];
  for (let c = 1; c < cuts.length; c++) {
    const piece = smooth(respace(points.slice(cuts[c - 1], cuts[c] + 1), speeds.slice(cuts[c - 1], cuts[c] + 1), spacing), reach);
    out.push(...(c > 1 ? piece.slice(1) : piece));
  }
  return out;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** A dot for a single tap: a circle of the stroke's slow width. */
function dot(x: number, y: number, r: number): string {
  return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

/**
 * The filled outline of a freehand pen stroke: the left edge, a round cap, the right edge back and a round cap.
 * The caller fills it in the ink colour (and may add a hairline stroke so the edge looks crisp).
 */
export function penOutline(points: Point[], size: number, scale: number): string {
  if (!points.length) return "";
  const samples = shapedSamples(points, size);
  if (samples.length < 2) return dot(points[0][0], points[0][1], size * SLOW_WIDTH / 2);
  const n = samples.length;
  const along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  const total = along[n - 1];
  const widths = samples.map(s => size * (SLOW_WIDTH + (FAST_WIDTH - SLOW_WIDTH) * Math.min(1, s.speed * scale / FAST_STEP_PX)));
  const taper = Math.min(TAPER_WIDTHS * size, total * TAPER_SHARE);
  const ease = (t: number) => TAPER_TO + (1 - TAPER_TO) * (1 - (1 - t) * (1 - t));
  for (let i = 0; i < n; i++) {
    const end = Math.min(along[i], total - along[i]);
    if (taper > 0 && end < taper) widths[i] *= ease(end / taper);
  }
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    const r = widths[i] / 2, s = samples[i];
    left.push([s.x - dy * r, s.y + dx * r]);
    right.push([s.x + dy * r, s.y - dx * r]);
  }
  const startR = widths[0] / 2, endR = widths[n - 1] / 2;
  let d = `M${f(left[0][0])} ${f(left[0][1])}`;
  for (let i = 1; i < n; i++) d += `L${f(left[i][0])} ${f(left[i][1])}`;
  d += `A${f(endR)} ${f(endR)} 0 0 0 ${f(right[n - 1][0])} ${f(right[n - 1][1])}`;
  for (let i = n - 2; i >= 0; i--) d += `L${f(right[i][0])} ${f(right[i][1])}`;
  return d + `A${f(startR)} ${f(startR)} 0 0 0 ${f(left[0][0])} ${f(left[0][1])}Z`;
}

/** The centre line of a smoothed highlighter stroke, drawn at an even width by the caller. */
export function highlighterLine(points: Point[]): string {
  if (!points.length) return "";
  const samples = points.length < 3 ? points.map(([x, y]) => ({ x, y, speed: 0 })) : shapedSamples(points, HIGHLIGHTER_UNIT);
  if (samples.length === 1) return `M${f(samples[0].x)} ${f(samples[0].y)}L${f(samples[0].x + 0.01)} ${f(samples[0].y)}`;
  return samples.map((s, i) => `${i ? "L" : "M"}${f(s.x)} ${f(s.y)}`).join("");
}
