/**
 * Plain-text summaries of what a diagram prints (M15), for families whose artwork label is only
 * the family name. They describe the pupil copy: hidden answers, saved answers and unprinted
 * values are counted as blanks and never named.
 */
import type { ValueEnvelope } from "../../value-graph-core/src/schema";
import { displayNumber, equationText } from "../../value-graph-core/src/svg";
import { number } from "../../value-graph-core/src/model";
import { appearance, faceAreaLabel, labelText, type Envelope as CuboidEnvelope } from "../../cuboid-core/src/index";
import type { Envelope as AlgebraEnvelope } from "../../algebra-grid-core/src/index";
import { numericExpressionText } from "../../algebra-grid-core/src/numeric";

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
    const xs = d.columns.map((c) => displayNumber(c.x, p.decimalPlaces));
    const given = d.columns.filter((c) => c.y.kind === "value").length,
      blank = d.columns.filter((c) => c.y.kind === "blank").length,
      lines = d.columns.filter((c) => c.y.kind === "answer-line").length;
    parts.push(`table x = ${xs[0]} to ${xs.at(-1)} (${plural(xs.length, "column")}; y: ${counts([[given, "given"], [blank, "blank"], [lines, "answer lines"]])})`);
  }
  if (p.composition !== "table") {
    const b = d.graph.bounds;
    const [x0, x1, y0, y1] = [b.xMin, b.xMax, b.yMin, b.yMax].map(number);
    // Count only what the SVG draws: markers inside the plot area, curves that reach the window.
    const plotted = p.showMarkers ? d.graph.series.flatMap((s) => s.points).filter((q) => number(q.x) >= x0 && number(q.x) <= x1 && number(q.y) >= y0 && number(q.y) <= y1).length : 0;
    const joined = p.showJoins ? d.graph.series.filter((s) => s.connection === "straight-joins" && s.points.length > 1).length : 0;
    const curves = p.showCurves ? d.graph.curves.filter((c) => Math.max(number(c.min), x0) < Math.min(number(c.max), x1)).length : 0;
    const extra = [plotted ? plural(plotted, "plotted point") : "", joined ? (joined === 1 ? "points joined by straight lines" : `${joined} sets of points joined by straight lines`) : "", curves ? "a drawn curve" : "", p.showReferenceLines && d.graph.referenceLines.length ? plural(d.graph.referenceLines.length, "reference line") : ""].filter(Boolean);
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
    // Everything else that prints: the face-area label and the captions under the shape.
    const area = faceAreaLabel(s);
    const extras = [
      area ? (appearance(s).area.mode === "blank" ? `${appearance(s).area.heading.toLowerCase()} blank` : area) : "",
      s.caption ? `caption "${s.caption}"` : "",
      s.workedVolume ? "volume working" : "",
      s.workedArea ? "surface area working" : "",
      s.counts && s.view !== "plain" ? "cube count" : "",
    ].filter(Boolean);
    const labels = [...edges, ...faces, ...extras];
    return `${name}${view}${labels.length ? `: ${labels.join(", ")}` : ", unlabelled"}`;
  });
  const n = e.document.shapes.length;
  return `${n === 1 ? "One" : n === 2 ? "Two" : "Three"} ${e.document.shapes.every((s) => s.cube) ? (n === 1 ? "cube" : "cubes") : n === 1 ? "cuboid" : "cuboids"}. ${shapes.join(". ")}.`;
}

/** The answers copy prints hidden cells, so it is described as that copy, never as the pupil one. */
export function describeAlgebraGrid(e: AlgebraEnvelope, view: "pupil" | "answer" = "pupil"): string {
  const d = e.document;
  const mode = d.mode === "expand" ? "Expanding" : d.mode === "factorise" ? "Factorising" : "Grid-method multiplication";
  // The corner cell holds the × sign, not a term.
  const prints = (c: { value: string | null; hidden?: boolean }) => c.value !== null && c.value !== "" && (!c.hidden || view === "answer");
  const headings = [...d.rows[0].cells.slice(1), ...d.rows.slice(1).map((r) => r.cells[0])],
    working = d.rows.slice(1).flatMap((r) => r.cells.slice(1));
  const tally = (cs: typeof working, word: string) => `${word} ${counts([[cs.filter(prints).length, "shown"], [cs.filter((c) => !prints(c)).length, "blank"]])}`;
  const question = d.questionVisible && d.expression.trim() ? ` for ${d.mode === "multiply" ? numericExpressionText(d.expression) : d.expression.trim()}` : "";
  const grid = d.gridVisible ? `${d.rows.length - 1} by ${d.columns.length - 1} (${tally(headings, "headings")}; ${tally(working, "cells")})` : "grid hidden";
  const answer = d.answerVisible && d.answer ? "; final answer printed" : "";
  const lines = d.answerLines ? `; ${plural(d.answerLines, "answer line")}` : "";
  return `${mode} grid${question}: ${grid}${answer}${lines}.`;
}
