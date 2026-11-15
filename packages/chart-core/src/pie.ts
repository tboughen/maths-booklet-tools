import { boldLines } from "../../envelope-core/src/house-style";
import {
  CHART_ANSWER_COLOUR,
  esc,
  FONT,
  MARGIN,
  formatNumber,
  n,
  pieOf,
  readNumber,
  revealed,
  singleSetNote,
  text,
  textWidth,
} from "./shared";
import type { Envelope, Target } from "./index";

/**
 * Pie charts: sectors in category order, clockwise from the radius drawn upwards from the
 * centre, as Edexcel prints them. Angles come from the first data set and are exact
 * (360 × value ÷ total). The circle and the starting radius always print at true size so
 * pupils can draw with a protractor; a hidden value leaves its sector for pupils to draw.
 * Coordinates are millimetres.
 */
export type Sector = {
  category: number;
  value: number;
  /** Clockwise from 12 o'clock, in degrees. */
  start: number;
  end: number;
  /** Drawn in this view (shown, or revealed by the answer view). */
  drawn: boolean;
  revealed: boolean;
};
export type PieLabel = { category: number; lines: string[]; x: number; y: number; width: number; height: number; drawn: boolean; revealed: boolean };
/** A sector edge, clockwise from 12 o'clock. Pink edges print only on answers copies. */
export type Edge = { angle: number; revealed: boolean };

const LINE_HEIGHT = FONT * 1.2;
const GAP = 0.8;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** A point at `radius` and `angle` (clockwise from 12 o'clock), relative to the centre. */
const polar = (radius: number, angle: number) => ({ x: radius * Math.sin(rad(angle)), y: -radius * Math.cos(rad(angle)) });
/** Angles and percentages as printed and as the editor's Angle column shows them. */
export const round1 = (v: number) => formatNumber(Math.round(v * 10) / 10);
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + 0.5 && b.x < a.x + a.width + 0.5 && a.y < b.y + b.height + 0.3 && b.y < a.y + a.height + 0.3;
/** The distance from the centre to the nearest point of a centre-relative box. */
const nearest = (b: Box) =>
  Math.hypot(Math.max(b.x, 0, -(b.x + b.width)), Math.max(b.y, 0, -(b.y + b.height)));

/** Whether a box (centre-relative) lies inside a sector, clear of its edges and the circle. */
function fits(box: { x: number; y: number; width: number; height: number }, r: number, start: number, end: number) {
  const span = end - start;
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ];
  return corners.every(([x, y]) => {
    if (Math.hypot(x, y) > r - GAP) return false;
    if (span >= 360 - 1e-9) return true;
    let angle = (Math.atan2(x, -y) * 180) / Math.PI;
    angle = (((angle - start) % 360) + 360) % 360;
    if (angle > span) return false;
    // Clear of both edges by GAP.
    return [start, end].every((a) => {
      const u = polar(1, a),
        along = x * u.x + y * u.y;
      return along < 0 ? Math.hypot(x, y) >= GAP : Math.abs(x * u.y - y * u.x) >= GAP;
    });
  });
}

export function pieLayout(e: Envelope) {
  const d = e.document,
    s = d.series[0],
    settings = pieOf(d),
    r = settings.radiusMm,
    issues: string[] = [],
    notes: string[] = [];
  if (d.series.length > 1)
    notes.push(singleSetNote("Pie chart"));
  const values = s.values.map((c, ci) => {
    const where = d.categories[ci] || `Category ${ci + 1}`;
    if (!c.value.trim()) {
      issues.push(`${where}: enter a number. A pie chart needs every value; tick Hide to leave a sector for pupils to draw.`);
      return 0;
    }
    const v = readNumber(c.value);
    if (v === null) {
      issues.push(`${where}: enter a number.`);
      return 0;
    }
    if (v < 0) {
      issues.push(`${where}: values cannot be negative.`);
      return 0;
    }
    return v;
  });
  const total = values.reduce((a, b) => a + b, 0);
  if (!issues.length && total <= 0) issues.push("The values must add up to more than 0.");
  /** Every value is a number and the total is positive, so the angles are known. */
  const valuesValid = !issues.length;
  const sectors: Sector[] = [];
  let at = 0;
  values.forEach((v, ci) => {
    const angle = total > 0 ? (360 * v) / total : 0,
      cell = s.values[ci];
    sectors.push({ category: ci, value: v, start: at, end: at + angle, drawn: cell.show === "show", revealed: revealed(cell) });
    at += angle;
  });
  if (total > 0 && sectors.some((x) => Math.abs((x.end - x.start) - Math.round(x.end - x.start)) > 1e-6))
    notes.push("Some sector angles are not whole numbers, so pupils can draw them only to the nearest degree.");
  // A hidden sector with both edges printed on the pupil copy leaves pupils only a label to add.
  // Edges print beside drawn sectors; the starting radius (0° and 360°) always prints.
  const printed = [0, 360, ...sectors.slice(0, -1).filter((x, i) => s.values[i].show === "show" || s.values[i + 1].show === "show").map((x) => x.end)];
  const prints = (angle: number) => printed.some((a) => Math.abs(a - angle) < 1e-6);
  sectors.forEach((x, i) => {
    if (s.values[i].show !== "hidden" || x.value <= 0 || x.end - x.start >= 360 - 1e-6) return;
    if (prints(x.start) && prints(x.end))
      notes.push(
        `${d.categories[i] || `Category ${i + 1}`}: both edges of this hidden sector print, so pupils only label it. Hide a neighbouring sector too to leave it for pupils to draw.`,
      );
  });

  // An edge prints in this view when a sector on either side is drawn. It is pink when neither
  // neighbour would be drawn on the pupil copy. The starting radius always prints in black.
  const edges: Edge[] = [{ angle: 0, revealed: false }];
  const pupil = (x: Sector) => x.drawn && !x.revealed;
  sectors.slice(0, -1).forEach((x, i) => {
    const next = sectors[i + 1];
    if (!(x.drawn || next.drawn)) return;
    const pink = !(pupil(x) || pupil(next));
    const same = edges.find((g) => Math.abs(g.angle - x.end) < 1e-6 || Math.abs(g.angle + 360 - x.end) < 1e-6);
    if (same) same.revealed &&= pink;
    else edges.push({ angle: x.end, revealed: pink });
  });

  // Labels sit inside their sector when they fit, otherwise just outside the circle beside
  // its middle, without a leader line. Every label is placed (drawn or not) so the pupil and
  // answers copies are the same size.
  const labels: PieLabel[] = [];
  for (const x of sectors) {
    if (settings.labels === "none" || x.value <= 0) continue;
    const lines = [d.categories[x.category]].filter((l) => l.trim());
    const angle = x.end - x.start;
    if (settings.labels === "name-angle") lines.push(`${round1(angle)}°`);
    if (settings.labels === "name-percent") lines.push(`${round1((x.value / total) * 100)}%`);
    if (!lines.length) continue;
    const width = Math.max(...lines.map((l) => textWidth(l))) + 0.6,
      height = lines.length * LINE_HEIGHT,
      mid = (x.start + x.end) / 2;
    let box: Box | null = null;
    for (const f of [0.6, 0.5, 0.7, 0.4, 0.78, 0.3]) {
      const p = polar(r * f, mid),
        b = { x: p.x - width / 2, y: p.y - height / 2, width, height };
      if (fits(b, r, x.start, x.end) && !labels.some((l) => overlaps(l, b))) {
        box = b;
        break;
      }
    }
    if (!box) {
      // Outside: beside the middle of the sector, moved outwards until it clears the circle
      // and the labels already placed.
      const sx = Math.sin(rad(mid)),
        cy = Math.cos(rad(mid));
      for (let out = 1.5; out <= 16; out += 0.5) {
        const p = polar(r + out, mid),
          b = {
            x: sx > 0.3 ? p.x : sx < -0.3 ? p.x - width : p.x - width / 2,
            y: cy > 0.3 ? p.y - height : cy < -0.3 ? p.y : p.y - height / 2,
            width,
            height,
          };
        box ??= b;
        if (nearest(b) >= r + 1 && !labels.some((l) => overlaps(l, b))) {
          box = b;
          break;
        }
      }
      if (nearest(box!) < r + 1 || labels.some((l) => overlaps(l, box!))) {
        if (!issues.some((i) => i.startsWith("Sector labels overlap")))
          issues.push("Sector labels overlap. Use a larger radius, shorter category names, or labels without angles or percentages.");
      }
    }
    labels.push({ category: x.category, lines, x: box!.x, y: box!.y, width, height, drawn: x.drawn, revealed: x.revealed });
  }
  const left = Math.min(-r, ...labels.map((l) => l.x)),
    top = Math.min(-r, ...labels.map((l) => l.y)),
    right = Math.max(r, ...labels.map((l) => l.x + l.width)),
    bottom = Math.max(r, ...labels.map((l) => l.y + l.height));
  const cx = MARGIN - left,
    cy = MARGIN - top;
  for (const l of labels) {
    l.x += cx;
    l.y += cy;
  }
  const width = Math.ceil((right - left + 2 * MARGIN) * 10) / 10,
    height = Math.ceil((bottom - top + 2 * MARGIN) * 10) / 10;
  if (width > 180) issues.push("The pie chart is wider than 18 cm. Use a smaller radius or shorter labels.");
  if (height > 180) issues.push("The pie chart is taller than 18 cm. Use a smaller radius or shorter labels.");
  // Click targets: each label inside its sector, or a small square inside the sector. A zero
  // sector has no area to click; its value is edited in the Data table.
  const targets: Target[] = sectors.filter((x) => x.value > 0).map((x) => {
    const l = labels.find((b) => b.category === x.category);
    if (l && l.x >= cx - r && l.x + l.width <= cx + r)
      return { series: 0, category: x.category, x: l.x, y: l.y, width: l.width, height: l.height };
    const p = polar(r * 0.6, (x.start + x.end) / 2);
    return { series: 0, category: x.category, x: cx + p.x - 3, y: cy + p.y - 3, width: 6, height: 6 };
  });
  return { width, height, cx, cy, r, total, valuesValid, sectors, edges, labels, targets, issues, notes };
}

export function pieSvg(e: Envelope): string {
  const g = pieLayout(e),
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  out.push(`<circle cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}" fill="none" stroke="black" stroke-width="0.35"/>`);
  const ray = (angle: number) => {
    const p = polar(g.r, angle);
    return `M${n(g.cx)},${n(g.cy)}L${n(g.cx + p.x)},${n(g.cy + p.y)}`;
  };
  const black = g.edges.filter((x) => !x.revealed),
    pink = g.edges.filter((x) => x.revealed);
  out.push(`<path d="${black.map((x) => ray(x.angle)).join("")}" stroke="black" stroke-width="0.35" fill="none"/>`);
  if (pink.length)
    out.push(`<path d="${pink.map((x) => ray(x.angle)).join("")}" stroke="${CHART_ANSWER_COLOUR}" stroke-width="0.35" fill="none"/>`);
  for (const l of g.labels) {
    if (!l.drawn) continue;
    l.lines.forEach((line, i) =>
      out.push(text(line, l.x + l.width / 2, l.y + i * LINE_HEIGHT + FONT * 0.92, "middle", l.revealed ? CHART_ANSWER_COLOUR : "black")),
    );
  }
  const d = e.document;
  const label = `Pie chart${d.categories.length ? ` of ${d.categories.filter(Boolean).join(", ")}` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${boldLines(out.join(""), d.lines)}</svg>`;
}
