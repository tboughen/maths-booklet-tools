import {
  canonicalNumber,
  fractionString,
  parseNumber,
  rational,
  sameNumber,
  type Rational,
} from "../../ratio-table-core/src/numbers";
import {
  envelopeSchema,
  operationSchema,
  type ValueEnvelope,
  type ValueOperation,
  type ValueDocument,
  type Equation,
  type Column,
} from "./schema";

export const AXIS_FONT_PT = 12;
export const PT_MM = 25.4 / 72;
export function tableDomain(columns: Column[]) {
  const sorted = [...columns].sort((a, b) => number(a.x) - number(b.x));
  return { min: sorted[0].x, max: sorted[sorted.length - 1].x };
}
export function number(value: string) {
  const r = parseNumber(value);
  return Number(r.n) / Number(r.d);
}
export function rangeColumns(start: string, end: string, step: string) {
  const first = parseNumber(start),
    last = parseNumber(end),
    increment = parseNumber(step);
  if (increment.n <= 0n || first.n * last.d >= last.n * first.d)
    throw Error("Use a positive step and an end after the start.");
  const columns = [];
  let x = first;
  while (x.n * last.d <= last.n * x.d) {
    if (columns.length >= 13) throw Error("Choose a range with 2–13 x values.");
    columns.push({
      id: `c${columns.length + 1}`,
      x: fractionString(x),
      y: { kind: "blank" as const },
    });
    x = add(x, increment);
  }
  if (columns.length < 2) throw Error("Choose a range with 2–13 x values.");
  return columns;
}
function add(a: Rational, b: Rational) {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}
function multiply(a: Rational, b: Rational) {
  return rational(a.n * b.n, a.d * b.d);
}
export function evaluate(equation: Equation, x: string): string {
  const v = parseNumber(x);
  return fractionString(
    add(
      add(
        multiply(multiply(parseNumber(equation.a), v), v),
        multiply(parseNumber(equation.b), v),
      ),
      parseNumber(equation.c),
    ),
  );
}
export function validate(raw: unknown): ValueEnvelope {
  const e = envelopeSchema.parse(raw),
    d = e.document,
    g = d.graph;
  if (!number(d.equation.a))
    throw Error("Use a nonzero coefficient a for a quadratic.");
  const ids = d.columns.map((c) => c.id);
  if (new Set(ids).size !== ids.length)
    throw Error("Column IDs must be unique.");
  if (
    new Set(d.columns.map((c) => fractionString(parseNumber(c.x)))).size !==
    ids.length
  )
    throw Error("Each table column needs a different x value.");
  d.columns.forEach((c) => {
    evaluate(d.equation, c.x);
  });
  const { xMin, xMax, yMin, yMax } = g.bounds,
    sx = number(g.xUnitsPer10mm),
    sy = number(g.yUnitsPer10mm);
  if (sx <= 0 || sy <= 0 || sx > 10 || sy > 10)
    throw Error("Axis units per cm must be greater than zero and at most 10.");
  const width = ((number(xMax) - number(xMin)) * 10) / sx,
    height = ((number(yMax) - number(yMin)) * 10) / sy;
  if (
    width < 60 - 1e-6 ||
    width > 180 + 1e-6 ||
    height < 40 - 1e-6 ||
    height > 240 + 1e-6
  )
    throw Error("Choose a graph 60–180 mm wide and 40–240 mm high.");
  if (
    number(xMin) > 0 ||
    number(xMax) < 0 ||
    number(yMin) > 0 ||
    number(yMax) < 0
  )
    throw Error("Both axis ranges must include zero.");
  for (const [bound, scale] of [
    [xMin, sx],
    [xMax, sx],
    [yMin, sy],
    [yMax, sy],
  ] as const) {
    const squares = (number(bound) * 10) / scale / g.minorPitchMm;
    if (Math.abs(squares - Math.round(squares)) > 1e-6)
      throw Error("Bounds must align with the fine-grid spacing.");
  }
  if (width / g.minorPitchMm + height / g.minorPitchMm > 430)
    throw Error("This grid has too many fine lines. Use wider spacing.");
  for (const [every, scale, span] of [
    [g.xLabelEvery, sx, number(xMax) - number(xMin)],
    [g.yLabelEvery, sy, number(yMax) - number(yMin)],
  ] as const) {
    if (
      number(every) <= 0 ||
      (number(every) * 10) / scale < 4 ||
      span / number(every) > 60
    )
      throw Error(
        "Space axis labels at least 4 mm apart; use a larger label interval.",
      );
  }
  const allIds = [
    ...g.series.map((s) => s.id),
    ...g.curves.map((c) => c.id),
    ...g.referenceLines.map((l) => l.id),
  ];
  if (new Set(allIds).size !== allIds.length)
    throw Error("Plot object IDs must be unique.");
  if (g.series.reduce((sum, s) => sum + s.points.length, 0) > 40)
    throw Error("Use at most 40 plotted points.");
  for (const s of g.series) {
    if (new Set(s.points.map((p) => p.id)).size !== s.points.length)
      throw Error("Point IDs must be unique within their series.");
    s.points.forEach((p) => {
      if (p.columnId && !ids.includes(p.columnId))
        throw Error("A point refers to a missing table column.");
      if (p.columnId) {
        const c = d.columns.find((c) => c.id === p.columnId)!;
        if (
          c.y.kind !== "value" ||
          !sameNumber(parseNumber(c.x), parseNumber(p.x)) ||
          !sameNumber(parseNumber(c.y.value), parseNumber(p.y))
        )
          throw Error(
            "A linked point must match its table pair. Detach it to make a deliberate error.",
          );
      }
    });
    if (
      s.connection === "straight-joins" &&
      new Set(s.points.map((p) => fractionString(parseNumber(p.x)))).size !==
        s.points.length
    )
      throw Error("Straight joins need distinct x values.");
  }
  for (const c of g.curves)
    if (!number(c.equation.a) || number(c.min) >= number(c.max))
      throw Error("A curve needs a nonzero a and increasing domain bounds.");
  return e;
}
export function wrap(document: ValueDocument): ValueEnvelope {
  return validate({
    schemaVersion: 1,
    rendererVersion: "value-graph-1",
    styleProfile: "exam-v1",
    document,
  });
}
export function defaultEnvelope(): ValueEnvelope {
  return wrap({
    equation: { a: "1", b: "-1", c: "-6" },
    columns: Array.from({ length: 7 }, (_, i) => ({
      id: `c${i + 1}`,
      x: String(i - 3),
      y:
        i === 0
          ? { kind: "value", value: "6" }
          : i === 3
            ? { kind: "value", value: "-6" }
            : { kind: "blank" },
    })),
    graph: {
      bounds: { xMin: "-3", xMax: "3", yMin: "-7", yMax: "7" },
      xUnitsPer10mm: "1/2",
      yUnitsPer10mm: "1",
      minorPitchMm: 2,
      intermediatePitchMm: 10,
      heavyPitchMm: 20,
      xLabelEvery: "1",
      yLabelEvery: "1",
      originLabel: "O",
      axisStyle: "exam",
      positiveEndArrows: true,
      series: [],
      curves: [],
      referenceLines: [],
    },
    presentation: {
      composition: "combined",
      showEquation: true,
      showMarkers: true,
      showJoins: true,
      showCurves: true,
      showReferenceLines: true,
      decimalPlaces: null,
    },
    print: { tableWidthMm: 104, tableRowHeightMm: 10, gapMm: 8 },
  });
}
export function apply(
  raw: ValueEnvelope,
  operations: ValueOperation[],
): ValueEnvelope {
  const e = structuredClone(validate(raw)),
    d = e.document;
  const getColumn = (id: string) => {
    const c = d.columns.find((c) => c.id === id);
    if (!c) throw Error(`Column ${id} was not found.`);
    return c;
  };
  const sync = (id: string) => {
    const c = getColumn(id);
    for (const s of d.graph.series) {
      s.points = s.points.flatMap((p) =>
        p.columnId === id
          ? c.y.kind === "value"
            ? [{ ...p, x: c.x, y: c.y.value }]
            : []
          : [p],
      );
    }
  };
  for (const input of operations) {
    const op = operationSchema.parse(input);
    switch (op.op) {
      case "set_equation":
        d.equation = op.equation;
        break;
      case "set_cell": {
        const c = getColumn(op.columnId);
        if (op.x !== undefined) c.x = canonicalNumber(op.x);
        if (op.y) c.y = op.y;
        sync(c.id);
        break;
      }
      case "insert_column": {
        getColumn(op.afterId);
        d.columns.splice(
          d.columns.findIndex((c) => c.id === op.afterId) + 1,
          0,
          op.column,
        );
        break;
      }
      case "remove_column":
        getColumn(op.columnId);
        d.columns = d.columns.filter((c) => c.id !== op.columnId);
        d.graph.series.forEach((s) => {
          s.points = s.points.filter((p) => p.columnId !== op.columnId);
        });
        break;
      case "replace_columns":
        d.columns = op.columns;
        d.graph.series.forEach((s) => {
          s.points = s.points.filter((p) => !p.columnId);
        });
        break;
      case "calculate_cells":
        for (const id of op.columnIds) {
          const c = getColumn(id);
          if (c.y.kind === "value" && !op.overwrite)
            throw Error("Explicit overwrite is required for existing values.");
          c.y = { kind: "value", value: evaluate(d.equation, c.x) };
          sync(id);
        }
        break;
      case "set_graph":
        d.graph = { ...d.graph, ...op.settings };
        break;
      case "plot_series": {
        const points = op.columnIds.flatMap((id) => {
          const c = getColumn(id);
          return op.source === "equation" || c.y.kind === "value"
            ? [
                {
                  id: `p-${id}`,
                  x: c.x,
                  y:
                    op.source === "equation"
                      ? evaluate(d.equation, c.x)
                      : c.y.kind === "value"
                        ? c.y.value
                        : "0",
                  ...(op.source === "table" ? { columnId: id } : {}),
                },
              ]
            : [];
        });
        d.graph.series = d.graph.series.filter((s) => s.id !== op.id);
        d.graph.series.push({
          id: op.id,
          source: op.source,
          points,
          connection: op.connection,
        });
        break;
      }
      case "put_series":
        d.graph.series = d.graph.series.filter((s) => s.id !== op.series.id);
        d.graph.series.push(op.series);
        break;
      case "remove_series":
        d.graph.series = d.graph.series.filter((s) => s.id !== op.id);
        break;
      case "set_connection": {
        const s = d.graph.series.find((s) => s.id === op.id);
        if (!s) throw Error("Select a point series.");
        s.connection = op.connection;
        break;
      }
      case "move_point": {
        const s = d.graph.series.find((s) => s.id === op.seriesId),
          p = s?.points.find((p) => p.id === op.pointId);
        if (!p) throw Error("That point was not found.");
        if (p.columnId && op.linked === "update-table") {
          const c = getColumn(p.columnId);
          c.x = op.x;
          c.y = { kind: "value", value: op.y };
          sync(c.id);
        } else {
          p.x = op.x;
          p.y = op.y;
          delete p.columnId;
          s!.source = "custom";
        }
        break;
      }
      case "set_curve":
        d.graph.curves = op.curve ? [op.curve] : [];
        break;
      case "set_reference_lines":
        d.graph.referenceLines = op.lines;
        break;
      case "set_presentation":
        d.presentation = { ...d.presentation, ...op.settings };
        break;
      case "set_print":
        d.print = { ...d.print, ...op.settings };
        break;
    }
  }
  return validate(e);
}
export function warnings(e: ValueEnvelope): string[] {
  const d = e.document,
    out: string[] = [];
  const pointMatches = (x: string, y: string) => {
    try {
      return sameNumber(parseNumber(y), parseNumber(evaluate(d.equation, x)));
    } catch {
      return false;
    }
  };
  if (
    d.columns.some(
      (c) =>
        c.y.kind === "value" &&
        !sameNumber(
          parseNumber(c.y.value),
          parseNumber(evaluate(d.equation, c.x)),
        ),
    )
  )
    out.push(
      "Some table values disagree with the equation. They have been retained for your teaching example.",
    );
  for (const s of d.graph.series) {
    if (s.points.some((p) => !pointMatches(p.x, p.y)))
      out.push(
        "Some plotted points disagree with the equation; replot explicitly or retain the deliberate error.",
      );
    if (s.connection === "straight-joins")
      out.push(
        "Straight segments are selected. This can show the mistake of joining a quadratic with straight lines.",
      );
  }
  if (
    d.graph.curves.some((c) =>
      ["a", "b", "c"].some(
        (k) =>
          !sameNumber(
            parseNumber(c.equation[k as keyof Equation]),
            parseNumber(d.equation[k as keyof Equation]),
          ),
      ),
    )
  )
    out.push(
      "The retained curve uses a different equation. Replot explicitly or retain it as an error.",
    );
  const b = d.graph.bounds;
  if (
    d.graph.series.some((s) =>
      s.points.some(
        (p) =>
          number(p.x) < number(b.xMin) ||
          number(p.x) > number(b.xMax) ||
          number(p.y) < number(b.yMin) ||
          number(p.y) > number(b.yMax),
      ),
    )
  )
    out.push(
      "Some points lie outside the grid and will be clipped. Change bounds explicitly if needed.",
    );
  return [...new Set(out)];
}
export const PRESETS = [
  "June 2018",
  "November 2018",
  "November 2021",
  "November 2017 error",
  "Mock set 08",
  "Fractions",
] as const;
export function preset(name: string): ValueEnvelope {
  const d = defaultEnvelope().document;
  const set = (
    eq: Equation,
    xs: number[],
    known: Record<number, string>,
    bounds: ValueDocument["graph"]["bounds"],
    sy: string,
    ly = "1",
  ) => {
    d.equation = eq;
    d.columns = xs.map((x, i) => ({
      id: `c${i + 1}`,
      x: String(x),
      y:
        known[x] === undefined
          ? { kind: "blank" }
          : { kind: "value", value: known[x] },
    }));
    d.graph.bounds = bounds;
    d.graph.yUnitsPer10mm = sy;
    d.graph.yLabelEvery = ly;
  };
  switch (name) {
    case "November 2018":
      set(
        { a: "1", b: "1", c: "-4" },
        [-3, -2, -1, 0, 1, 2, 3],
        { "-2": "-2", "-1": "-4", 1: "-2" },
        { xMin: "-3.5", xMax: "3.5", yMin: "-10", yMax: "15" },
        "2.5",
        "5",
      );
      break;
    case "November 2021":
      set(
        { a: "1", b: "-2", c: "2" },
        [-2, -1, 0, 1, 2, 3, 4],
        { "-2": "10", 0: "2", 3: "5" },
        { xMin: "-2.5", xMax: "4.5", yMin: "-3", yMax: "11" },
        "1",
        "2",
      );
      break;
    case "November 2017 error":
      set(
        { a: "1", b: "0", c: "1" },
        [-3, -2, -1, 0, 1, 2, 3],
        {},
        { xMin: "-5", xMax: "5", yMin: "0", yMax: "10" },
        "1",
      );
      d.graph.xUnitsPer10mm = "1";
      break;
    case "Mock set 08":
      set(
        { a: "2", b: "4", c: "1" },
        [-3, -2, -1, 0, 1, 2],
        { "-3": "7", "-2": "1", 1: "7" },
        { xMin: "-3.5", xMax: "2.5", yMin: "-2", yMax: "18" },
        "1",
      );
      break;
    case "Fractions":
      set(
        { a: "1/2", b: "-1", c: "-3/2" },
        [-2, -1, 0, 1, 2],
        { 0: "-3/2" },
        { xMin: "-3", xMax: "3", yMin: "-4", yMax: "4" },
        "1",
      );
      break;
  }
  let e = wrap(d);
  if (name === "November 2017 error")
    e = apply(e, [
      {
        op: "calculate_cells",
        columnIds: d.columns.map((c) => c.id),
        overwrite: false,
      },
      {
        op: "plot_series",
        id: "points",
        source: "table",
        columnIds: d.columns.map((c) => c.id),
        connection: "straight-joins",
      },
    ]);
  return e;
}
