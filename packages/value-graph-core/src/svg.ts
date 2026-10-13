import {
  fractionString,
  parseNumber,
} from "../../ratio-table-core/src/numbers";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { number, AXIS_FONT_PT, PT_MM, validate } from "./model";
import type { Equation, ValueEnvelope } from "./schema";

const FONT = AXIS_FONT_PT * PT_MM;
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function displayNumber(v: string, places: number | null = null): string {
  if (places !== null)
    return Number(number(v).toFixed(places)).toString().replaceAll("-", "−");
  return (v.includes("/") ? fractionString(parseNumber(v)) : v).replaceAll(
    "-",
    "−",
  );
}
export function equationText(e: Equation): string {
  const terms: [string, string][] = [
    [e.a, "x²"],
    [e.b, "x"],
    [e.c, ""],
  ];
  let out = "";
  for (const [v, suffix] of terms) {
    const n = number(v);
    if (!n) continue;
    const magnitude = displayNumber(v.replace(/^[−-]/, ""));
    out +=
      (out ? (n < 0 ? " − " : " + ") : n < 0 ? "−" : "") +
      (suffix && Math.abs(n) === 1 ? "" : magnitude) +
      suffix;
  }
  return "y = " + out;
}
export function metrics(e: ValueEnvelope) {
  const d = e.document,
    g = d.graph,
    graphWidth =
      ((number(g.bounds.xMax) - number(g.bounds.xMin)) * 10) /
      number(g.xUnitsPer10mm),
    graphHeight =
      ((number(g.bounds.yMax) - number(g.bounds.yMin)) * 10) /
      number(g.yUnitsPer10mm);
  const withTable = d.presentation.composition !== "graph",
    withGraph = d.presentation.composition !== "table";
  const width =
    Math.max(
      withTable ? d.print.tableWidthMm : 0,
      withGraph ? graphWidth + 17 : 0,
    ) + 4;
  const equationHeight = d.presentation.showEquation ? 9 : 0;
  const tableTop = 2 + equationHeight,
    tableHeight = withTable ? d.print.tableRowHeightMm * 2 : 0;
  const graphTop =
    tableTop + tableHeight + (withGraph && withTable ? d.print.gapMm : 0) + 7;
  const height = withGraph
    ? graphTop + graphHeight + 8
    : tableTop + tableHeight + 2;
  return {
    width,
    height,
    widthCm: width / 10,
    heightCm: height / 10,
    graphWidth,
    graphHeight,
    table: {
      left: (width - d.print.tableWidthMm) / 2,
      top: tableTop,
      width: d.print.tableWidthMm,
      rowHeight: d.print.tableRowHeightMm,
    },
    plot: {
      left: (width - (graphWidth + 17)) / 2 + 9,
      top: graphTop,
      width: graphWidth,
      height: graphHeight,
    },
    withTable,
    withGraph,
  };
}
export function labels(min: number, max: number, every: number): number[] {
  const out: number[] = [];
  for (
    let i = Math.ceil((min - 1e-9) / every);
    i <= Math.floor((max + 1e-9) / every);
    i++
  )
    if (i !== 0) out.push(Number((i * every).toFixed(8)));
  return out;
}
export function renderSvg(raw: ValueEnvelope): string {
  const e = validate(raw),
    d = e.document,
    g = d.graph,
    m = metrics(e),
    b = g.bounds,
    sx = number(g.xUnitsPer10mm),
    sy = number(g.yUnitsPer10mm),
    f = FONT;
  const elements: string[] = [];
  const text = (
    x: number,
    y: number,
    label: string,
    anchor = "middle",
    italic = false,
    size = f,
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}>${escape(label)}</text>`;
  const plainWidth = (label: string, size = f) =>
    [...label].reduce((sum, c) => sum + glyphAdvance(c) * size, 0);
  const width = (label: string, size = f) => {
    if (label.includes("/")) {
      const [n, den] = label.split("/");
      return (
        Math.max(plainWidth(n, size * 0.8), plainWidth(den, size * 0.8)) + 0.8
      );
    }
    return plainWidth(label, size);
  };
  const numericText = (
    x: number,
    y: number,
    label: string,
    anchor = "middle",
    background = false,
  ) => {
    const w = width(label),
      left = anchor === "end" ? x - w : anchor === "start" ? x : x - w / 2;
    const backing = background
      ? `<rect x="${left - 0.5}" y="${y - f * 0.77}" width="${w + 1}" height="${f * 0.96}" fill="white"/>`
      : "";
    if (label.includes("/")) {
      const [n, den] = label.split("/"),
        center = left + w / 2,
        mid = y - f * 0.3;
      return (
        backing +
        text(center, mid - 0.7, n, "middle", false, f * 0.8) +
        `<path d="M${left} ${mid + 0.15}h${w}" stroke="black" stroke-width="0.18"/>` +
        text(center, mid + 3.3, den, "middle", false, f * 0.8)
      );
    }
    return backing + text(x, y, label, anchor);
  };
  if (d.presentation.showEquation) {
    const equation = escape(equationText(d.equation)).replace(
      /[xy]/g,
      (v) => `<tspan font-style="italic">${v}</tspan>`,
    );
    elements.push(
      `<text x="${m.width / 2}" y="7" font-size="${f}" text-anchor="middle">${equation}</text>`,
    );
  }
  if (m.withTable) {
    const t = m.table,
      cw = t.width / (d.columns.length + 1),
      base = t.top + t.rowHeight / 2 + f * 0.3;
    for (let row = 0; row <= 2; row++)
      elements.push(
        `<path d="M${t.left} ${t.top + row * t.rowHeight}h${t.width}" stroke="#888" stroke-width="0.18"/>`,
      );
    for (let col = 0; col <= d.columns.length + 1; col++)
      elements.push(
        `<path d="M${t.left + col * cw} ${t.top}v${t.rowHeight * 2}" stroke="#888" stroke-width="0.18"/>`,
      );
    elements.push(
      text(t.left + cw / 2, base, "x", "middle", true),
      text(t.left + cw / 2, base + t.rowHeight, "y", "middle", true),
    );
    d.columns.forEach((c, i) => {
      const x = t.left + (i + 1.5) * cw;
      const val = displayNumber(c.x, d.presentation.decimalPlaces);
      if (width(val) > cw - 1.5)
        throw Error(
          "A table value does not fit. Increase table width or use fewer columns.",
        );
      elements.push(numericText(x, base, val));
      if (c.y.kind === "value") {
        const label = displayNumber(c.y.value, d.presentation.decimalPlaces);
        if (width(label) > cw - 1.5)
          throw Error(
            "A table value does not fit. Increase table width or use fewer columns.",
          );
        elements.push(numericText(x, base + t.rowHeight, label));
      } else if (c.y.kind === "answer-line")
        elements.push(
          `<path d="M${x - cw * 0.3} ${base + t.rowHeight + 0.6}h${cw * 0.6}" stroke="black" stroke-width="0.18"/>`,
        );
    });
  }
  if (m.withGraph) {
    const p = m.plot,
      px = (x: number) => p.left + ((x - number(b.xMin)) * 10) / sx,
      py = (y: number) => p.top + ((number(b.yMax) - y) * 10) / sy;
    const ox = px(0),
      oy = py(0),
      paths = ["", "", ""];
    const tier = (offset: number) =>
      Math.abs(offset / 20 - Math.round(offset / 20)) < 1e-6
        ? 2
        : Math.abs(offset / 10 - Math.round(offset / 10)) < 1e-6
          ? 1
          : 0;
    const startX = (number(b.xMin) * 10) / sx,
      startY = (number(b.yMin) * 10) / sy;
    for (let i = 0; i <= Math.round(p.width / g.minorPitchMm); i++) {
      const x = p.left + i * g.minorPitchMm;
      paths[tier(startX + i * g.minorPitchMm)] += `M${x} ${p.top}v${p.height}`;
    }
    for (let i = 0; i <= Math.round(p.height / g.minorPitchMm); i++) {
      const y = p.top + p.height - i * g.minorPitchMm;
      paths[tier(startY + i * g.minorPitchMm)] += `M${p.left} ${y}h${p.width}`;
    }
    elements.push(
      `<g data-layer="grid">${paths.map((path, i) => `<path data-grid-tier="${["fine", "intermediate", "heavy"][i]}" d="${path}" fill="none" stroke="#b3b3b3" stroke-width="${[0.51, 1.02, 1.417][i] * PT_MM}"/>`).join("")}</g>`,
    );
    const extra = g.positiveEndArrows ? 5 : 0;
    elements.push(
      `<g data-layer="axes" stroke="black" stroke-width="0.3"><path d="M${p.left} ${oy}H${p.left + p.width + extra}M${ox} ${p.top + p.height}V${p.top - extra}" fill="none"/>`,
    );
    if (g.positiveEndArrows)
      elements.push(
        `<path d="M${p.left + p.width + extra} ${oy}l-2 -1v2zM${ox} ${p.top - extra}l-1 2h2z" fill="black" stroke="none"/>`,
      );
    elements.push(
      "</g>",
      text(p.left + p.width + extra + 1.5, oy + 3, "x", "middle", true),
      text(ox - 3, p.top - extra - 1, "y", "middle", true),
    );
    const xl = labels(number(b.xMin), number(b.xMax), number(g.xLabelEvery)),
      yl = labels(number(b.yMin), number(b.yMax), number(g.yLabelEvery));
    const verifyLabelSpacing = (values: number[], scale: number) => {
      for (let i = 1; i < values.length; i++) {
        const a = displayNumber(String(values[i - 1])),
          c = displayNumber(String(values[i]));
        if (
          ((values[i] - values[i - 1]) * 10) / scale <
          (width(a) + width(c)) / 2 + 1
        )
          throw Error("Axis labels overlap. Use a larger label interval.");
      }
    };
    verifyLabelSpacing(xl, sx);
    elements.push(`<g data-layer="axis-values" data-font-points="12">`);
    xl.forEach((x) =>
      elements.push(
        numericText(
          px(x),
          oy + 4,
          displayNumber(String(x)),
          "middle",
          g.axisStyle === "exam",
        ),
      ),
    );
    yl.forEach((y) =>
      elements.push(
        numericText(
          ox - 1.6,
          py(y) + f * 0.3,
          displayNumber(String(y)),
          "end",
          g.axisStyle === "exam",
        ),
      ),
    );
    elements.push(
      text(ox - 2, oy + 4, g.originLabel, "end", g.originLabel === "O"),
      "</g>",
    );
    elements.push(
      `<defs><clipPath id="vg-plot-clip"><rect x="${p.left}" y="${p.top}" width="${p.width}" height="${p.height}"/></clipPath></defs><g data-layer="plots" clip-path="url(#vg-plot-clip)" stroke="black" fill="none" stroke-width="${1.2 * PT_MM}">`,
    );
    if (d.presentation.showReferenceLines)
      g.referenceLines.forEach((l) =>
        elements.push(
          `<path d="M${p.left} ${py(number(l.y))}h${p.width}" stroke-dasharray="1.8 1.2"/>`,
        ),
      );
    if (d.presentation.showCurves)
      g.curves.forEach((c) => {
        const min = Math.max(number(c.min), number(b.xMin)),
          max = Math.min(number(c.max), number(b.xMax));
        if (min >= max) return;
        const a = number(c.equation.a),
          bb = number(c.equation.b),
          cc = number(c.equation.c);
        // A quadratic Bezier is the exact polynomial, including between sampled table x values.
        const y0 = a * min * min + bb * min + cc,
          y1 = a * max * max + bb * max + cc;
        const controlY = y0 + ((2 * a * min + bb) * (max - min)) / 2;
        elements.push(
          `<path data-curve="${escape(c.id)}" d="M${px(min)} ${py(y0)}Q${px((min + max) / 2)} ${py(controlY)} ${px(max)} ${py(y1)}"/>`,
        );
      });
    const markers: string[] = [];
    for (const s of g.series) {
      const points = [...s.points].sort((a, b) => number(a.x) - number(b.x));
      if (
        d.presentation.showJoins &&
        s.connection === "straight-joins" &&
        points.length > 1
      )
        elements.push(
          `<polyline data-series="${escape(s.id)}" points="${points.map((p) => `${px(number(p.x))},${py(number(p.y))}`).join(" ")}"/>`,
        );
      if (d.presentation.showMarkers)
        for (const point of points) {
          const x = px(number(point.x)),
            y = py(number(point.y)),
            r = 1;
          if (
            x < p.left - 1e-6 ||
            x > p.left + p.width + 1e-6 ||
            y < p.top - 1e-6 ||
            y > p.top + p.height + 1e-6
          )
            continue;
          markers.push(
            `<path data-point-id="${escape(point.id)}" data-series-id="${escape(s.id)}" d="M${x - r} ${y - r}l${r * 2} ${r * 2}M${x - r} ${y + r}l${r * 2} ${-r * 2}"/>`,
          );
        }
    }
    elements.push(
      "</g>",
      `<g data-layer="point-markers" stroke="black" fill="none" stroke-width="${1.2 * PT_MM}">${markers.join("")}</g>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}mm" height="${m.height}mm" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="Table of values and coordinate graph"><rect width="100%" height="100%" fill="white"/><g font-family="'STIX Two Text', serif" fill="black">${elements.join("")}</g></svg>`;
}
