import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import {
  add,
  allLabels,
  distance,
  dot,
  getLabel,
  isStale,
  mul,
  nameOf,
  shown,
  sub,
  unit,
  validate,
  type Envelope,
  type Point,
} from "./model";
import { heightFoot } from "./geometry";

export const FONT = (11 * 25.4) / 72;
export const escapeXml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const f = (v: number) => Number(v.toFixed(4));
export type Rect = { x: number; y: number; w: number; h: number };
export type Anchor = {
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
export type Metrics = {
  width: number;
  height: number;
  anchors: Anchor[];
  vertices: Record<string, Point>;
  issues: string[];
  svg: string;
  scale: number;
  origin: Point;
  translation: Point;
};
const overlaps = (a: Rect, b: Rect, gap = 0.65) =>
  a.x + a.w + gap > b.x &&
  b.x + b.w + gap > a.x &&
  a.y + a.h + gap > b.y &&
  b.y + b.h + gap > a.y;
const measure = (text: string, size = FONT) =>
  Array.from(text).reduce((sum, c) => sum + glyphAdvance(c), 0) * size;
function mathMetrics(text: string, size = FONT) {
  const q = text.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)(.*)$/);
  return q
    ? {
        w:
          Math.max(measure(q[1], size * 0.85), measure(q[2], size * 0.85)) +
          1.2 +
          measure(q[3], size),
        h: size * 2.1,
      }
    : {
        w: measure(text.replaceAll(/\^([23])/g, "$1"), size) + 0.5,
        h: size * 1.3,
      };
}
function superText(text: string) {
  return escapeXml(text).replace(
    /\^([0-9]+)/g,
    '<tspan baseline-shift="super" font-size="72%">$1</tspan>',
  );
}
function textSvg(text: string, c: Point, size = FONT, italic = false) {
  const q = text.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)(.*)$/);
  if (q) {
    const width =
        Math.max(measure(q[1], size * 0.85), measure(q[2], size * 0.85)) + 0.8,
      total = width + measure(q[3], size),
      x = c.x - total / 2 + width / 2;
    return `<g><text x="${f(x)}" y="${f(c.y - size * 0.27)}" font-size="${f(size * 0.85)}" text-anchor="middle">${escapeXml(q[1])}</text><line x1="${f(x - width / 2)}" x2="${f(x + width / 2)}" y1="${f(c.y)}" y2="${f(c.y)}" stroke-width=".2" stroke="#111"/><text x="${f(x)}" y="${f(c.y + size * 0.85)}" font-size="${f(size * 0.85)}" text-anchor="middle">${escapeXml(q[2])}</text><text x="${f(x + width / 2)}" y="${f(c.y + size * 0.32)}" font-size="${f(size)}">${escapeXml(q[3])}</text></g>`;
  }
  return `<text x="${f(c.x)}" y="${f(c.y + size * 0.32)}" text-anchor="middle" font-size="${f(size)}"${italic ? ' font-style="italic"' : ""}>${superText(text)}</text>`;
}
function intersectsLine(r: Rect, a: Point, b: Point) {
  // Liang–Barsky against the text rectangle. No test against the whole SVG box.
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ]) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
}
export function layout(e: Envelope, showAnswers = false): Metrics {
  validate(e);
  const d = e.document,
    width = d.widthCm * 10,
    feet = d.heights.map((h) => heightFoot(e, h.id).point),
    raw = [...d.vertices, ...feet];
  const minX = Math.min(...raw.map((v) => v.x)),
    minY = Math.min(...raw.map((v) => v.y)),
    maxX = Math.max(...raw.map((v) => v.x)),
    maxY = Math.max(...raw.map((v) => v.y));
  let scale = Math.min(
    (width - 32) / (maxX - minX),
    175 / Math.max(1, maxY - minY),
  );
  let final: Metrics | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    const origin = { x: minX, y: minY },
      map = (v: Point) => ({
        x: 16 + (v.x - minX) * scale,
        y: 12 + (v.y - minY) * scale,
      });
    const vertices = Object.fromEntries(d.vertices.map((v) => [v.id, map(v)])),
      p = (id: string) => vertices[id];
    const lines: { a: Point; b: Point; dashed: boolean }[] = d.edges
      .filter((edge) => edge.draw)
      .map((edge) => ({ a: p(edge.from), b: p(edge.to), dashed: edge.dashed }));
    const shape: string[] = [],
      labels: string[] = [],
      boxes: Rect[] = [],
      anchors: Anchor[] = [],
      issues: string[] = [];
    const bounds: Point[] = [...Object.values(vertices), ...feet.map(map)];
    const drawLine = (a: Point, b: Point, dashed = false) =>
      `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}"${dashed ? ' stroke-dasharray="1.6 1.3"' : ""}/>`;
    for (const line of lines) shape.push(drawLine(line.a, line.b, line.dashed));
    const place = (
      ref: string,
      proposed: Point,
      candidates: Point[] = [],
      italic = false,
      size = FONT,
    ) => {
      const l = getLabel(e, ref),
        text = shown(e, l, showAnswers),
        m = mathMetrics(text, size),
        hasOffset = l.dx !== 0 || l.dy !== 0;
      let c = add(proposed, { x: l.dx, y: l.dy });
      const rect = (v: Point): Rect => ({
        x: v.x - m.w / 2 - 0.5,
        y: v.y - m.h / 2 - 0.25,
        w: m.w + 1,
        h: m.h + 0.5,
      });
      if (text && !hasOffset) {
        const choices = [proposed, ...candidates],
          found = choices.find(
            (v) =>
              !boxes.some((b) => overlaps(rect(v), b)) &&
              !lines.some((line) => intersectsLine(rect(v), line.a, line.b)),
          );
        if (found) c = found;
      }
      const r = rect(c);
      if (text) {
        if (boxes.some((b) => overlaps(r, b, 0.1)))
          issues.push(
            "Some labels overlap. Adjust their positions or increase print width.",
          );
        if (lines.some((line) => intersectsLine(r, line.a, line.b)))
          issues.push(
            "A label crosses a side or construction line. Adjust its position.",
          );
        boxes.push(r);
        bounds.push({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h });
        labels.push(
          `<g data-triangle-label="${escapeXml(ref)}"><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="white" stroke="none"/>${textSvg(text, c, size, italic)}</g>`,
        );
      }
      anchors.push({
        ref,
        x: c.x,
        y: c.y,
        w: Math.max(5, m.w + 2),
        h: Math.max(5, m.h + 2),
      });
    };
    // Names first, then angles and side values: values may move, identities remain stable.
    for (const v of d.vertices) {
      const neighbours = d.edges
          .filter((edge) => edge.from === v.id || edge.to === v.id)
          .map((edge) => p(edge.from === v.id ? edge.to : edge.from)),
        inside = mul(
          neighbours.reduce((sum, v) => add(sum, v), { x: 0, y: 0 }),
          1 / neighbours.length,
        ),
        out = unit(sub(p(v.id), inside)),
        c = add(p(v.id), mul(out, 5));
      place(
        `v:${v.id}`,
        c,
        [7, 9, 12].map((r) => add(p(v.id), mul(out, r))),
        true,
      );
    }
    for (const a of d.angles) {
      const v = p(a.vertex),
        u = unit(sub(p(a.from), v)),
        w = unit(sub(p(a.to), v)),
        theta = Math.acos(Math.min(1, Math.max(-1, dot(u, w)))),
        bisector = unit(add(u, w));
      const interior = Math.min(distance(p(a.from), v), distance(p(a.to), v));
      const radius = Math.min(6, interior * 0.2),
        start = Math.atan2(u.y, u.x),
        end = Math.atan2(w.y, w.x);
      let delta = end - start;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      if (a.mark === "right") {
        const r = Math.min(2.5, interior * 0.13),
          p1 = add(v, mul(u, r)),
          p2 = add(p1, mul(w, r)),
          p3 = add(v, mul(w, r));
        shape.push(
          `<path d="M${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}L${f(p3.x)} ${f(p3.y)}"/>`,
        );
      } else if (a.mark !== "none") {
        for (let i = 0; i < { arc: 1, double: 2, triple: 3 }[a.mark]; i++) {
          const r = radius + i * 1.1,
            p1 = add(v, mul(u, r)),
            p2 = add(v, mul(w, r));
          shape.push(
            `<path d="M${f(p1.x)} ${f(p1.y)}A${f(r)} ${f(r)} 0 0 ${delta > 0 ? 1 : 0} ${f(p2.x)} ${f(p2.y)}"/>`,
          );
        }
      }
      const m = mathMetrics(shown(e, a.label, showAnswers)),
        r = Math.max(
          radius + 4,
          (m.w / 2 + 1.5) / Math.max(0.1, Math.sin(theta / 2)),
        );
      const proposed = add(v, mul(bisector, r));
      const candidates = [r + 3, r + 6, r + 10, r + 15].map((r) =>
        add(v, mul(bisector, r)),
      );
      place(`a:${a.id}`, proposed, candidates);
    }
    for (const edge of d.edges) {
      const a = p(edge.from),
        b = p(edge.to),
        mid = mul(add(a, b), 0.5),
        u = unit(sub(b, a));
      const owner = d.triangles.find(
          (t) => t.vertices.includes(edge.from) && t.vertices.includes(edge.to),
        ),
        other = owner
          ? p(owner.vertices.find((id) => ![edge.from, edge.to].includes(id))!)
          : mid;
      const normal = { x: -u.y, y: u.x },
        out = mul(normal, dot(normal, sub(other, mid)) > 0 ? -1 : 1);
      const text = shown(e, edge.label, showAnswers),
        m = mathMetrics(text),
        gap = 4.5 + Math.min(3, Math.abs(out.x) * m.w * 0.3);
      place(
        `e:${edge.id}`,
        add(mid, mul(out, gap)),
        [gap + 3, gap + 6, gap + 10].flatMap((r) => [
          add(mid, mul(out, r)),
          add(add(mid, mul(out, r)), mul(u, 5)),
          add(add(mid, mul(out, r)), mul(u, -5)),
        ]),
      );
      for (let i = 0; i < edge.ticks; i++) {
        const tick = add(mid, mul(u, (i - (edge.ticks - 1) / 2) * 1.3)),
          a = add(tick, mul(normal, -1.5)),
          b = add(tick, mul(normal, 1.5));
        shape.push(drawLine(a, b));
        bounds.push(a, b);
      }
    }
    for (const h of d.heights) {
      const projection_ = heightFoot(e, h.id),
        foot = map(projection_.point),
        apex = p(h.apex),
        base = d.edges.find((b) => b.id === h.base)!,
        a = p(base.from),
        b = p(base.to),
        axis = unit(sub(b, a));
      lines.push({ a: apex, b: foot, dashed: true });
      shape.push(drawLine(apex, foot, true));
      if (projection_.t < 0 || projection_.t > 1) {
        const end = projection_.t < 0 ? a : b;
        lines.push({ a: end, b: foot, dashed: true });
        shape.push(drawLine(end, foot, true));
      }
      const up = unit(sub(apex, foot)),
        toward = mul(axis, projection_.t < 0.5 ? 1 : -1),
        r = Math.min(2.5, distance(apex, foot) / 4),
        a_ = add(foot, mul(up, r)),
        b_ = add(a_, mul(toward, r)),
        c_ = add(foot, mul(toward, r));
      shape.push(
        `<path d="M${f(a_.x)} ${f(a_.y)}L${f(b_.x)} ${f(b_.y)}L${f(c_.x)} ${f(c_.y)}"/>`,
      );
      const mid = mul(add(apex, foot), 0.5),
        normal = unit({ x: -(apex.y - foot.y), y: apex.x - foot.x });
      place(`h:${h.id}`, add(mid, mul(normal, 5)), [
        add(mid, mul(normal, -5)),
        add(mid, mul(normal, 10)),
        add(mid, mul(normal, -10)),
      ]);
      if (h.footName) {
        const c = add(foot, { x: 0, y: 5 }),
          m = mathMetrics(h.footName);
        boxes.push({ x: c.x - m.w / 2, y: c.y - m.h / 2, w: m.w, h: m.h });
        bounds.push({ x: c.x - m.w / 2, y: c.y + m.h / 2 });
        labels.push(textSvg(h.footName, c, FONT, true));
      }
    }
    // Area annotations follow their own triangle, including after reshape/rotation.
    for (const t of d.triangles) {
      if (!t.area) continue;
      const centre = mul(
        t.vertices.map(p).reduce((a, b) => add(a, b), { x: 0, y: 0 }),
        1 / 3,
      );
      place(`r:${t.id}`, centre);
    }
    // A later height can cross an earlier annotation; check all final construction lines.
    if (
      boxes.some((b) => lines.some((line) => intersectsLine(b, line.a, line.b)))
    )
      issues.push(
        "A label crosses a side or construction line. Adjust its position.",
      );
    let bottom = Math.max(...bounds.map((v) => v.y));
    const wrap = (s: string) => {
      const rows: string[] = [];
      let current = "";
      for (const word of s.split(/\s+/)) {
        if (measure(word) > width - 8)
          issues.push("A caption word is too long for this print width.");
        const next = current ? current + " " + word : word;
        if (measure(next) > width - 8 && current) {
          rows.push(current);
          current = word;
        } else current = next;
      }
      if (current) rows.push(current);
      return rows;
    };
    for (const c of d.captions) {
      const text = shown(e, c.label, showAnswers),
        rows = wrap(text);
      bottom += 6;
      const start = bottom;
      anchors.push({
        ref: `c:${c.id}`,
        x: width / 2 + c.label.dx,
        y: bottom + c.label.dy,
        w: Math.min(width - 8, Math.max(20, measure(text))),
        h: 6,
      });
      for (const row of rows) {
        const p = { x: width / 2 + c.label.dx, y: bottom + c.label.dy };
        labels.push(
          `<g data-triangle-label="c:${escapeXml(c.id)}">${textSvg(row, p)}</g>`,
        );
        const m = mathMetrics(row);
        bounds.push(
          { x: p.x - m.w / 2, y: p.y - m.h / 2 },
          { x: p.x + m.w / 2, y: p.y + m.h / 2 },
        );
        bottom += 5.5;
      }
      if (!rows.length) bounds.push({ x: width / 2, y: start + 2 });
    }
    if (d.notToScale) {
      bottom += 6;
      labels.push(
        textSvg("Diagram not accurately drawn", { x: width / 2, y: bottom }, 3),
      );
      bounds.push(
        {
          x: width / 2 - measure("Diagram not accurately drawn", 3) / 2,
          y: bottom - 2,
        },
        {
          x: width / 2 + measure("Diagram not accurately drawn", 3) / 2,
          y: bottom + 2,
        },
      );
    }
    const left = Math.min(...bounds.map((v) => v.x)),
      right = Math.max(...bounds.map((v) => v.x)),
      top = Math.min(...bounds.map((v) => v.y)),
      low = Math.max(...bounds.map((v) => v.y)),
      contentWidth = right - left;
    if (contentWidth > width - 4 && attempt < 11) {
      scale *= 0.9;
      continue;
    }
    const translation = { x: (width - contentWidth) / 2 - left, y: 2 - top },
      height = Math.max(24, low - top + 4);
    if (contentWidth > width - 4)
      issues.push(
        "The labels do not fit this print width. Shorten or reposition them, or increase the width.",
      );
    if (height > 240)
      issues.push(
        "The resource is taller than 24 cm. Adjust the shape or captions.",
      );
    const stale = allLabels(e).some(
      ({ label: l }) =>
        l.answer && isStale(e, l) && (l.answerVisible || showAnswers),
    );
    if (stale)
      issues.push(
        "Resolve the out-of-date saved answer before exporting a worked view.",
      );
    const movedAnchors = anchors.map((a) => ({
      ...a,
      x: a.x + translation.x,
      y: a.y + translation.y,
    }));
    // Blank/hidden angle targets remain available in the labelled inspector even
    // when a narrow wedge makes their transparent direct hit area hard to reach.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width / 10)}cm" height="${f(height / 10)}cm" viewBox="0 0 ${f(width)} ${f(height)}"><title>Triangle diagram</title><rect width="100%" height="100%" fill="white"/><g transform="translate(${f(translation.x)} ${f(translation.y)})" fill="none" stroke="#111" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round">${shape.join("")}</g><g transform="translate(${f(translation.x)} ${f(translation.y)})" font-family="STIX Two Text,STIX Two Math,serif" fill="#111" stroke="none">${labels.join("")}</g></svg>`;
    final = {
      width,
      height,
      anchors: movedAnchors,
      vertices: Object.fromEntries(
        Object.entries(vertices).map(([id, p]) => [id, add(p, translation)]),
      ),
      issues: [...new Set(issues)],
      svg,
      scale,
      origin,
      translation,
    };
    break;
  }
  return final!;
}
export const renderSvg = (e: Envelope) => layout(e).svg;
export function exportIssue(e: Envelope) {
  return layout(e).issues.join(" ");
}
export function annotationName(e: Envelope, ref: string) {
  if (ref.startsWith("v:")) return nameOf(e, ref.slice(2));
  return ref;
}
