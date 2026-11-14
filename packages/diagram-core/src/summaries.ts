/**
 * Plain-text summaries of what a diagram prints (M15), for families whose artwork label is only
 * the family name. They describe the pupil copy: hidden answers, saved answers and unprinted
 * values are counted as blanks and never named.
 */
import type { ValueEnvelope } from "../../value-graph-core/src/schema";
import { displayNumber, equationText } from "../../value-graph-core/src/svg";
import { labelText, type Envelope as CuboidEnvelope } from "../../cuboid-core/src/index";
import type { Envelope as AlgebraEnvelope } from "../../algebra-grid-core/src/index";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const counts = (parts: [number, string][]) =>
  parts
    .filter(([n]) => n > 0)
    .map(([n, word]) => `${n} ${word}`)
    .join(", ");

export function describeValueGraph(e: ValueEnvelope): string {
  const d = e.document,
    p = d.presentation;
  const parts: string[] = [];
  if (p.showEquation) parts.push(`for ${equationText(d.equation)}`);
  if (p.composition !== "graph") {
    const xs = d.columns.map((c) => displayNumber(c.x));
    const given = d.columns.filter((c) => c.y.kind === "value").length,
      blank = d.columns.filter((c) => c.y.kind === "blank").length,
      lines = d.columns.filter((c) => c.y.kind === "answer-line").length;
    parts.push(`table x = ${xs[0]} to ${xs.at(-1)} (${plural(xs.length, "column")}; y: ${counts([[given, "given"], [blank, "blank"], [lines, "answer lines"]])})`);
  }
  if (p.composition !== "table") {
    const b = d.graph.bounds;
    const plotted = p.showMarkers ? d.graph.series.reduce((n, s) => n + s.points.length, 0) : 0;
    const extra = [plotted ? plural(plotted, "plotted point") : "", p.showCurves && d.graph.curves.length ? "a drawn curve" : "", p.showReferenceLines && d.graph.referenceLines.length ? plural(d.graph.referenceLines.length, "reference line") : ""].filter(Boolean);
    parts.push(`graph x ${displayNumber(b.xMin)} to ${displayNumber(b.xMax)}, y ${displayNumber(b.yMin)} to ${displayNumber(b.yMax)}${extra.length ? ` with ${extra.join(", ")}` : ", empty grid"}`);
  }
  const what = p.composition === "table" ? "Table of values" : p.composition === "graph" ? "Coordinate graph" : "Table of values and graph";
  return `${what} ${parts.join("; ")}.`;
}

export function describeCuboids(e: CuboidEnvelope): string {
  const shapes = e.document.shapes.map((s) => {
    const name = s.title.trim() || (s.cube ? "Cube" : "Cuboid");
    // The label exactly as it prints; a blank prints as dots, so it is called blank here.
    const printed = (k: Parameters<typeof labelText>[1]) => (s.labels[k].mode === "blank" ? "blank" : labelText(s, k).trim());
    const edges = (["width", "depth", "height"] as const).flatMap((k) => (printed(k) ? [`${k} ${printed(k)}`] : []));
    const faces = (["front", "top", "side"] as const).flatMap((k) => (printed(k) ? [`${k} face ${printed(k)}`] : []));
    const view = s.view === "plain" ? "" : s.view === "cubes" ? " drawn in unit cubes" : " drawn in layers";
    const labels = [...edges, ...faces];
    return `${name}${view}${labels.length ? `: ${labels.join(", ")}` : ", unlabelled"}`;
  });
  const n = e.document.shapes.length;
  return `${n === 1 ? "One" : n === 2 ? "Two" : "Three"} ${e.document.shapes.every((s) => s.cube) ? (n === 1 ? "cube" : "cubes") : n === 1 ? "cuboid" : "cuboids"}. ${shapes.join(". ")}.`;
}

export function describeAlgebraGrid(e: AlgebraEnvelope): string {
  const d = e.document;
  const mode = d.mode === "expand" ? "Expanding" : d.mode === "factorise" ? "Factorising" : "Grid-method multiplication";
  // The corner cell holds the × sign, not a term.
  const cells = d.rows.flatMap((r, i) => (i === 0 ? r.cells.slice(1) : r.cells));
  const shown = cells.filter((c) => c.value !== null && c.value !== "" && !c.hidden).length,
    blank = cells.length - shown;
  const question = d.questionVisible && d.expression.trim() ? ` for ${d.expression.trim()}` : "";
  const grid = d.gridVisible ? `${d.rows.length - 1} by ${d.columns.length - 1} (${counts([[shown, shown === 1 ? "cell shown" : "cells shown"], [blank, "blank"]])})` : "grid hidden";
  const lines = d.answerLines ? `; ${plural(d.answerLines, "answer line")}` : "";
  return `${mode} grid${question}: ${grid}${lines}.`;
}
