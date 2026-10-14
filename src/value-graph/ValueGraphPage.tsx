import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Copy, Download } from "lucide-react";
import {
  apply,
  canonical,
  decode,
  defaultEnvelope,
  editorLink,
  metrics,
  number,
  parseFile,
  preset,
  PRESETS,
  rangeColumns,
  tableDomain,
  renderSvg,
  warnings,
  type ValueEnvelope,
  type ValueOperation,
  type PlotPoint,
  type ValueDocument,
} from "../../packages/value-graph-core/src/interchange";
import {
  parseNumber,
  rational,
  fractionString,
} from "../../packages/ratio-table-core/src/numbers";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { downloadBlob } from "../export/clipboard";
import { download, copyForWord } from "./export";
import { recovery, save, STORAGE_KEY } from "./persistence";
import { Field } from "./Field";
import { equationText } from "../../packages/value-graph-core/src/svg";
import { parseEquation } from "./equation";
import { LocalEditor } from "./LocalEditor";
import { InspectorEditor } from "./InspectorEditor";
import "./value-graph.css";

type Selection =
  | { kind: "cell"; id: string; row: "x" | "y" }
  | { kind: "point"; seriesId: string; pointId: string }
  | {
      kind:
        | "equation"
        | "table"
        | "layout"
        | "examples"
        | "graph"
        | "plot"
        | "add"
        | "objects";
    }
  | { kind: "axis"; axis: "x" | "y" }
  | { kind: "bound"; key: keyof ValueDocument["graph"]["bounds"] }
  | { kind: "series"; id: string }
  | { kind: "curve"; id: string }
  | { kind: "reference"; id: string }
  | null;
type History = {
  past: ValueEnvelope[];
  present: ValueEnvelope;
  future: ValueEnvelope[];
};
type Pending = { title: string; description: string; action: () => void };
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "This action could not be completed.";
const uniqueId = (prefix: string) => prefix + crypto.randomUUID().slice(0, 12);
export default function ValueGraphPage({
  active = true,
}: {
  active?: boolean;
}) {
  const [storageKey] = useState(() => {
    const draft = new URL(location.href).searchParams.get("draft");
    return draft && /^[a-zA-Z0-9_-]{1,40}$/.test(draft)
      ? `${STORAGE_KEY}:${draft}`
      : STORAGE_KEY;
  });
  const [startup] = useState(() => recovery(storageKey));
  const [history, setHistory] = useState<History>({
    past: [],
    present: startup.envelope,
    future: [],
  });
  const [recoverRaw, setRecoverRaw] = useState(startup.raw),
    [message, setMessage] = useState(startup.error);
  const [saved, setSaved] = useState(!startup.error),
    [pending, setPending] = useState<Pending | null>(null);
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null),
    [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"select" | "point">("select"),
    [snap, setSnap] = useState(true),
    [linkedPolicy, setLinkedPolicy] = useState<"detach" | "update-table">(
      "detach",
    );
  const [zoom, setZoom] = useState(1),
    [exportOpen, setExportOpen] = useState(false);
  const [pointDraft, setPointDraft] = useState({ x: "0", y: "0" });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [referenceDraft, setReferenceDraft] = useState("0");
  const [range, setRange] = useState({ start: "-3", end: "3", step: "1" });
  const [drag, setDrag] = useState<{
    op: ValueOperation;
    initial: ValueEnvelope;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    drawing = useRef<HTMLDivElement>(null),
    handled = useRef<string>("");
  const current = useRef(history.present);
  current.current = history.present;
  const expected = useRef<string | null>(null),
    initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    try {
      expected.current = localStorage.getItem(storageKey);
    } catch {
      /* Saving reports the failure. */
    }
  }
  const envelope = history.present,
    d = envelope.document,
    g = d.graph;
  const blocked = !!recoverRaw || busy || pendingFields.size > 0;
  const onPending = useCallback(
    (key: string, value: boolean) =>
      setPendingFields((previous) => {
        if (previous.has(key) === value) return previous;
        const next = new Set(previous);
        if (value) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const commit = useCallback((next: ValueEnvelope) => {
    renderSvg(next);
    setHistory((previous) => ({
      past: [...previous.past.slice(-79), previous.present],
      present: next,
      future: [],
    }));
    setMessage("");
  }, []);
  function change(ops: ValueOperation[]) {
    commit(apply(current.current, ops));
  }
  function act(action: () => void) {
    if (blocked) return;
    try {
      action();
    } catch (e) {
      setMessage(errorText(e));
    }
  }
  function field(
    label: string,
    value: string,
    onCommit: (v: string) => void,
    key = label,
    autoFocus = false,
  ) {
    return (
      <Field
        key={key}
        label={label}
        value={value}
        onCommit={onCommit}
        onPending={(p) => onPending(key, p)}
        autoFocus={autoFocus}
      />
    );
  }
  function ask(title: string, description: string, action: () => void) {
    if (blocked) return;
    setPending({ title, description, action });
  }
  function undo() {
    if (blocked) return;
    setSelection(null);
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  }
  function redo() {
    if (blocked) return;
    setSelection(null);
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  }
  useEffect(() => {
    if (recoverRaw) return;
    try {
      expected.current = save(envelope, expected.current, storageKey);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setMessage(errorText(e));
    }
  }, [envelope, recoverRaw, storageKey]);
  useEffect(() => {
    if (!active) return;
    const keys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea,select,[contenteditable=true]")
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Escape" && !pendingFields.size) {
        setSelection(null);
        setMode("select");
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });
  useEffect(() => {
    if (!active) return;
    const load = () => {
      if (
        !location.hash.startsWith("#values=") ||
        handled.current === location.hash
      )
        return;
      handled.current = location.hash;
      try {
        const incoming = decode(location.hash.slice(8));
        renderSvg(incoming);
        setPending({
          title: "Open the linked resource?",
          description:
            "Your current valid resource is retained until you confirm. Opening is undoable.",
          action: () => {
            commit(incoming);
            setSelection(null);
          },
        });
      } catch (e) {
        setMessage(errorText(e));
      }
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, [active, commit]);
  let shown = envelope;
  if (drag)
    try {
      shown = apply(drag.initial, [drag.op]);
    } catch {
      /* Retain the last valid artwork. */
    }
  let svg = "",
    renderError = "";
  try {
    svg = renderSvg(shown);
  } catch (e) {
    renderError = errorText(e);
  }
  const m = metrics(shown),
    pxPerMm = (96 / 25.4) * zoom;
  const selectedColumn =
    selection?.kind === "cell"
      ? d.columns.find((c) => c.id === selection.id)
      : undefined;
  const selectedSeries =
    selection?.kind === "point"
      ? g.series.find((s) => s.id === selection.seriesId)
      : selection?.kind === "series"
        ? g.series.find((s) => s.id === selection.id)
        : undefined;
  const selectedPoint =
    selection?.kind === "point"
      ? selectedSeries?.points.find((p) => p.id === selection.pointId)
      : undefined;
  const sx = number(g.xUnitsPer10mm),
    sy = number(g.yUnitsPer10mm);
  const pointPosition = (p: PlotPoint) => ({
    x: m.plot.left + ((number(p.x) - number(g.bounds.xMin)) * 10) / sx,
    y: m.plot.top + ((number(g.bounds.yMax) - number(p.y)) * 10) / sy,
  });
  function pointerPosition(e: PointerEvent) {
    const rect = drawing.current!.getBoundingClientRect();
    let x =
        number(g.bounds.xMin) +
        (((e.clientX - rect.left) / pxPerMm - m.plot.left) * sx) / 10,
      y =
        number(g.bounds.yMax) -
        (((e.clientY - rect.top) / pxPerMm - m.plot.top) * sy) / 10;
    if (snap) {
      x =
        (Math.round(x / ((g.minorPitchMm * sx) / 10)) * g.minorPitchMm * sx) /
        10;
      y =
        (Math.round(y / ((g.minorPitchMm * sy) / 10)) * g.minorPitchMm * sy) /
        10;
    }
    return { x: String(Number(x.toFixed(6))), y: String(Number(y.toFixed(6))) };
  }
  function addPoint(x: string, y: string) {
    const series = g.series.find((s) => s.id === "custom-points") ?? {
      id: "custom-points",
      source: "custom" as const,
      connection: "none" as const,
      points: [],
    };
    const point = { id: uniqueId("p-"), x, y };
    change([
      {
        op: "put_series",
        series: { ...series, points: [...series.points, point] },
      },
    ]);
    setSelection({ kind: "point", seriesId: series.id, pointId: point.id });
  }
  function startDrag(
    e: PointerEvent<HTMLButtonElement>,
    seriesId: string,
    pointId: string,
  ) {
    if (blocked) return;
    e.stopPropagation();
    setSelection({ kind: "point", seriesId, pointId });
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = g.series
      .find((s) => s.id === seriesId)!
      .points.find((p) => p.id === pointId)!;
    setDrag({
      initial: envelope,
      op: {
        op: "move_point",
        seriesId,
        pointId,
        x: p.x,
        y: p.y,
        linked: linkedPolicy,
      },
    });
  }
  async function exportAction(action: () => Promise<void>) {
    if (blocked || renderError) return;
    setBusy(true);
    try {
      await action();
      setMessage("Export ready.");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const ids = d.columns.map((c) => c.id);
  function calculate(all = false) {
    const targets = all
      ? ids
      : selection?.kind === "cell"
        ? [selection.id]
        : d.columns.filter((c) => c.y.kind !== "value").map((c) => c.id);
    if (!targets.length) {
      setMessage("There are no blank cells to fill.");
      return;
    }
    const overwrite = targets.some(
      (id) => d.columns.find((c) => c.id === id)!.y.kind === "value",
    );
    const action = () =>
      change([{ op: "calculate_cells", columnIds: targets, overwrite }]);
    if (overwrite)
      ask(
        "Replace selected values?",
        `Calculate ${targets.length} values from the equation. Existing values in these cells will be replaced.`,
        action,
      );
    else act(action);
  }
  function plot(source: "table" | "equation") {
    act(() => {
      change([
        {
          op: "plot_series",
          id: "points",
          source,
          columnIds: ids,
          connection: "none",
        },
      ]);
      const count =
        source === "equation"
          ? ids.length
          : d.columns.filter((c) => c.y.kind === "value").length;
      setMessage(
        `${count} points plotted${source === "table" ? `; ${ids.length - count} unanswered cells skipped` : ""}.`,
      );
    });
  }
  function curve(equation = d.equation) {
    act(() => {
      change([
        {
          op: "set_curve",
          curve: {
            id: "quadratic",
            equation,
            ...tableDomain(d.columns),
          },
        },
      ]);
    });
  }
  function generateRange() {
    act(() => {
      const columns = rangeColumns(range.start, range.end, range.step);
      setPending({
        title: "Replace the x-value range?",
        description:
          "This replaces the table with blank y cells and removes table-linked points. Independent points and curves are retained.",
        action: () => change([{ op: "replace_columns", columns }]),
      });
    });
  }
  function fit() {
    act(() => {
      const pts = g.series.flatMap((s) => s.points),
        b = g.bounds;
      if (!pts.length)
        throw Error("Plot points first, then fit the grid to them.");
      const dx = (g.minorPitchMm * sx) / 10,
        dy = (g.minorPitchMm * sy) / 10;
      change([
        {
          op: "set_graph",
          settings: {
            bounds: {
              xMin: String(
                Math.floor(
                  Math.min(number(b.xMin), ...pts.map((p) => number(p.x))) / dx,
                ) * dx,
              ),
              xMax: String(
                Math.ceil(
                  Math.max(number(b.xMax), ...pts.map((p) => number(p.x))) / dx,
                ) * dx,
              ),
              yMin: String(
                Math.floor(
                  Math.min(number(b.yMin), ...pts.map((p) => number(p.y))) / dy,
                ) * dy,
              ),
              yMax: String(
                Math.ceil(
                  Math.max(number(b.yMax), ...pts.map((p) => number(p.y))) / dy,
                ) * dy,
              ),
            },
          },
        },
      ]);
    });
  }
  function stepBound(
    key: keyof ValueDocument["graph"]["bounds"],
    direction: 1 | -1,
  ) {
    act(() => {
      const value = parseNumber(g.bounds[key]),
        step = parseNumber(
          key.startsWith("x") ? g.xUnitsPer10mm : g.yUnitsPer10mm,
        );
      const next = fractionString(
        rational(
          value.n * step.d + BigInt(direction) * step.n * value.d,
          value.d * step.d,
        ),
      );
      change([
        { op: "set_graph", settings: { bounds: { ...g.bounds, [key]: next } } },
      ]);
    });
  }
  const toggle = (
    key: keyof Pick<
      ValueDocument["presentation"],
      | "showEquation"
      | "showMarkers"
      | "showJoins"
      | "showCurves"
      | "showReferenceLines"
    >,
    label: string,
  ) => (
    <label className="vg-check">
      <input
        type="checkbox"
        checked={d.presentation[key]}
        disabled={blocked}
        onChange={(e) =>
          act(() =>
            change([
              { op: "set_presentation", settings: { [key]: e.target.checked } },
            ]),
          )
        }
      />
      {label}
    </label>
  );

  function choose(next: Selection, target?: HTMLElement) {
    if (blocked) return;
    setSelection(next);
    setAnchor(target ?? drawing.current);
    setMode("select");
  }
  const selectedCurve =
    selection?.kind === "curve"
      ? g.curves.find((c) => c.id === selection.id)
      : undefined;
  const selectedLine =
    selection?.kind === "reference"
      ? g.referenceLines.find((l) => l.id === selection.id)
      : undefined;
  const seriesName = (index: number) =>
    g.series[index]?.source === "table"
      ? "Table points"
      : g.series[index]?.source === "equation"
        ? "Equation points"
        : "Independent points " + (index + 1);
  function appendColumn() {
    const last = d.columns[d.columns.length - 1],
      previous = d.columns[d.columns.length - 2];
    const a = parseNumber(last.x),
      b = parseNumber(previous.x);
    let step = rational(a.n * b.d - b.n * a.d, a.d * b.d);
    if (!step.n) step = rational(1n);
    const x = fractionString(
      rational(a.n * step.d + step.n * a.d, a.d * step.d),
    );
    change([
      {
        op: "insert_column",
        afterId: last.id,
        column: { id: uniqueId("c-"), x, y: { kind: "blank" } },
      },
    ]);
  }
  function workedCopy() {
    ask(
      "Create a separate worked version?",
      "Your pupil resource remains saved with its unanswered cells. The worked copy opens separately.",
      () => {
        const next = apply(envelope, [
          { op: "calculate_cells", columnIds: ids, overwrite: true },
          {
            op: "plot_series",
            id: "points",
            source: "table",
            columnIds: ids,
            connection: "none",
          },
          {
            op: "set_curve",
            curve: {
              id: "quadratic",
              equation: d.equation,
              ...tableDomain(d.columns),
            },
          },
        ]);
        const url = new URL(location.href);
        url.searchParams.set("draft", uniqueId("worked-"));
        window.open(editorLink(next, url.href), "_blank");
      },
    );
  }
  const option = (
    label: string,
    value: string,
    choices: [string, string][],
    update: (v: string) => void,
  ) => (
    <label className="vg-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={blocked}
        onChange={(e) => act(() => update(e.target.value))}
      >
        {choices.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  const button = (label: string, action: () => void, disabled = false) => (
    <button disabled={blocked || disabled} onClick={() => act(action)}>
      {label}
    </button>
  );
  const close = () => {
    if (!blocked) {
      anchor?.focus();
      setSelection(null);
    }
  };
  const removeSelectedPoint = () => {
    if (!selectedPoint || !selectedSeries) return;
    const remaining = selectedSeries.points.filter(
      (p) => p.id !== selectedPoint.id,
    );
    change(
      remaining.length
        ? [
            {
              op: "put_series",
              series: { ...selectedSeries, points: remaining },
            },
          ]
        : [{ op: "remove_series", id: selectedSeries.id }],
    );
    setSelection(null);
  };
  function contextContent() {
    if (!selection) return null;
    switch (selection.kind) {
      case "equation":
        return (
          <>
            {field(
              "Equation",
              equationText(d.equation),
              (value) =>
                change([
                  { op: "set_equation", equation: parseEquation(value) },
                ]),
              "question-equation",
              true,
            )}
            <p>
              Use expanded form, for example y = x² − x − 6. Existing values and
              plots are retained.
            </p>
          </>
        );
      case "cell":
        return (
          selectedColumn && (
            <>
              {field(
                "Edit " +
                  selection.row +
                  " for column " +
                  (d.columns.indexOf(selectedColumn) + 1),
                selection.row === "x"
                  ? selectedColumn.x
                  : selectedColumn.y.kind === "value"
                    ? selectedColumn.y.value
                    : "",
                (value) =>
                  change([
                    {
                      op: "set_cell",
                      columnId: selectedColumn.id,
                      ...(selection.row === "x"
                        ? { x: value }
                        : {
                            y: value.trim()
                              ? { kind: "value", value }
                              : { kind: "blank" },
                          }),
                    },
                  ]),
                "cell-" + selectedColumn.id + "-" + selection.row,
                true,
              )}
              {selection.row === "y" && (
                <div className="vg-actions">
                  {button("Blank", () =>
                    change([
                      {
                        op: "set_cell",
                        columnId: selectedColumn.id,
                        y: { kind: "blank" },
                      },
                    ]),
                  )}
                  {button("Answer line", () =>
                    change([
                      {
                        op: "set_cell",
                        columnId: selectedColumn.id,
                        y: { kind: "answer-line" },
                      },
                    ]),
                  )}
                  <button disabled={blocked} onClick={() => calculate()}>
                    Calculate y
                  </button>
                </div>
              )}
            </>
          )
        );
      case "bound":
        return field(
          "Axis " + selection.key,
          g.bounds[selection.key],
          (v) =>
            change([
              {
                op: "set_graph",
                settings: { bounds: { ...g.bounds, [selection.key]: v } },
              },
            ]),
          selection.key,
          true,
        );
      case "axis": {
        const axis = selection.axis;
        return (
          <>
            {field(
              axis + " units per cm",
              g[axis === "x" ? "xUnitsPer10mm" : "yUnitsPer10mm"],
              (v) =>
                change([
                  {
                    op: "set_graph",
                    settings: {
                      [axis === "x" ? "xUnitsPer10mm" : "yUnitsPer10mm"]: v,
                    },
                  },
                ]),
            )}
            {field(
              axis + " label interval",
              g[axis === "x" ? "xLabelEvery" : "yLabelEvery"],
              (v) =>
                change([
                  {
                    op: "set_graph",
                    settings: {
                      [axis === "x" ? "xLabelEvery" : "yLabelEvery"]: v,
                    },
                  },
                ]),
            )}
            <p>The printed axis values keep their exam size: 12 pt.</p>
          </>
        );
      }
      case "table":
        return (
          <>
            <div className="vg-fields">
              {(["start", "end", "step"] as const).map((k) =>
                field(
                  "Range " + k,
                  range[k],
                  (v) => {
                    parseNumber(v);
                    setRange((previous) => ({ ...previous, [k]: v }));
                  },
                  "range-" + k,
                ),
              )}
            </div>
            <button disabled={blocked} onClick={generateRange}>
              Replace x-value range
            </button>
            <button disabled={blocked} onClick={() => calculate(true)}>
              Calculate whole row
            </button>
            <button disabled={blocked} onClick={workedCopy}>
              Create separate worked version
            </button>
            {option(
              "Table number display",
              String(d.presentation.decimalPlaces ?? "exact"),
              [
                ["exact", "Exact values"],
                ...[0, 1, 2, 3, 4, 5, 6].map(
                  (n) => [String(n), n + " decimal places"] as [string, string],
                ),
              ],
              (v) =>
                change([
                  {
                    op: "set_presentation",
                    settings: {
                      decimalPlaces: v === "exact" ? null : Number(v),
                    },
                  },
                ]),
            )}
            {(["tableWidthMm", "tableRowHeightMm", "gapMm"] as const).map((k) =>
              field(
                k === "tableWidthMm"
                  ? "Table width (mm)"
                  : k === "gapMm"
                    ? "Table–graph gap (mm)"
                    : "Table row height (mm)",
                String(d.print[k]),
                (v) =>
                  change([{ op: "set_print", settings: { [k]: number(v) } }]),
              ),
            )}
            <p>
              Rounding changes displayed table text; coordinates keep their
              exact values.
            </p>
          </>
        );
      case "layout":
        return (
          <>
            {option(
              "Resource layout",
              d.presentation.composition,
              [
                ["combined", "Table and graph"],
                ["table", "Table only"],
                ["graph", "Graph only"],
              ],
              (v) =>
                change([
                  {
                    op: "set_presentation",
                    settings: {
                      composition:
                        v as ValueDocument["presentation"]["composition"],
                    },
                  },
                ]),
            )}
            {toggle("showEquation", "Equation heading")}
          </>
        );
      case "examples":
        return (
          <>
            {PRESETS.map((name) => (
              <button
                key={name}
                disabled={blocked}
                onClick={() =>
                  ask(
                    "Replace with this example?",
                    name + " replaces the current resource. You can undo this.",
                    () => {
                      commit(preset(name));
                      setSelection(null);
                    },
                  )
                }
              >
                {name}
              </button>
            ))}
          </>
        );
      case "graph":
        return (
          <>
            {option(
              "Fine grid spacing",
              String(g.minorPitchMm),
              [
                ["1", "1 mm"],
                ["2", "2 mm (exam)"],
                ["5", "5 mm"],
              ],
              (v) =>
                change([
                  {
                    op: "set_graph",
                    settings: { minorPitchMm: Number(v) as 1 | 2 | 5 },
                  },
                ]),
            )}
            {option(
              "Axis style",
              g.axisStyle,
              [
                ["exam", "Exam axes"],
                ["plain", "Plain axes"],
              ],
              (v) =>
                change([
                  {
                    op: "set_graph",
                    settings: { axisStyle: v as "exam" | "plain" },
                  },
                ]),
            )}
            {option(
              "Origin label",
              g.originLabel,
              [
                ["O", "O"],
                ["0", "0"],
              ],
              (v) =>
                change([
                  {
                    op: "set_graph",
                    settings: { originLabel: v as "O" | "0" },
                  },
                ]),
            )}
            <label className="vg-check">
              <input
                type="checkbox"
                checked={g.positiveEndArrows}
                disabled={blocked}
                onChange={(e) =>
                  act(() =>
                    change([
                      {
                        op: "set_graph",
                        settings: { positiveEndArrows: e.target.checked },
                      },
                    ]),
                  )
                }
              />
              Positive-end arrows
            </label>
            {toggle("showMarkers", "Point markers")}
            {toggle("showJoins", "Straight joins")}
            {toggle("showCurves", "Smooth curve")}
            {toggle("showReferenceLines", "Reference lines")}
            <button disabled={blocked} onClick={fit}>
              Fit grid to points
            </button>
            <p>Medium lines every 1 cm; heavy lines every 2 cm.</p>
          </>
        );
      case "plot":
        return (
          <div className="vg-actions">
            <button disabled={blocked} onClick={() => plot("table")}>
              Plot entered table pairs
            </button>
            <button disabled={blocked} onClick={() => plot("equation")}>
              Plot equation at table x values
            </button>
            <p>
              Plotting skips unanswered cells and retains them in the table.
            </p>
          </div>
        );
      case "add":
        return (
          <>
            <div className="vg-fields">
              {(["x", "y"] as const).map((k) =>
                field("New point " + k, pointDraft[k], (v) => {
                  parseNumber(v);
                  setPointDraft((prev) => ({ ...prev, [k]: v }));
                }),
              )}
            </div>
            {button("Add point", () => addPoint(pointDraft.x, pointDraft.y))}
            <button
              disabled={blocked}
              aria-pressed={mode === "point"}
              onClick={() => {
                setMode(mode === "point" ? "select" : "point");
                setSelection(null);
              }}
            >
              Place point on grid
            </button>
            <label className="vg-check">
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />
              Snap to fine grid
            </label>
            {field("New horizontal line y", referenceDraft, (v) => {
              parseNumber(v);
              setReferenceDraft(v);
            })}
            {button(
              "Add horizontal line",
              () => {
                const line = { id: uniqueId("line-"), y: referenceDraft };
                change([
                  {
                    op: "set_reference_lines",
                    lines: [...g.referenceLines, line],
                  },
                ]);
                setSelection({ kind: "reference", id: line.id });
              },
              g.referenceLines.length >= 4,
            )}
          </>
        );
      case "point":
        return (
          selectedPoint &&
          selectedSeries && (
            <>
              <div className="vg-fields">
                {(["x", "y"] as const).map((k) =>
                  field(
                    "Point " + k,
                    selectedPoint[k],
                    (v) =>
                      change([
                        {
                          op: "move_point",
                          seriesId: selectedSeries.id,
                          pointId: selectedPoint.id,
                          x: k === "x" ? v : selectedPoint.x,
                          y: k === "y" ? v : selectedPoint.y,
                          linked: linkedPolicy,
                        },
                      ]),
                    "point-" + selectedPoint.id + "-" + k,
                  ),
                )}
              </div>
              {selectedPoint.columnId &&
                option(
                  "When moving this linked point",
                  linkedPolicy,
                  [
                    ["detach", "Keep table as entered"],
                    ["update-table", "Update linked table cell"],
                  ],
                  (v) => setLinkedPolicy(v as "detach" | "update-table"),
                )}
              <label className="vg-check">
                <input
                  type="checkbox"
                  checked={snap}
                  onChange={(e) => setSnap(e.target.checked)}
                />
                Snap to fine grid
              </label>
              {button("Edit point set", () =>
                setSelection({ kind: "series", id: selectedSeries.id }),
              )}
              {button("Remove point", removeSelectedPoint)}
            </>
          )
        );
      case "series":
        return (
          selectedSeries && (
            <>
              {option(
                "Join points",
                selectedSeries.connection,
                [
                  ["none", "Points only"],
                  ["straight-joins", "Straight line joins"],
                ],
                (v) =>
                  change([
                    {
                      op: "set_connection",
                      id: selectedSeries.id,
                      connection: v as "none" | "straight-joins",
                    },
                  ]),
              )}
              {button("Remove point set", () => {
                change([{ op: "remove_series", id: selectedSeries.id }]);
                setSelection(null);
              })}
              <p>
                Straight joins are retained independently of the smooth curve.
              </p>
            </>
          )
        );
      case "curve":
        return (
          selectedCurve && (
            <>
              {field(
                "Drawn curve equation",
                equationText(selectedCurve.equation),
                (v) =>
                  change([
                    {
                      op: "set_curve",
                      curve: { ...selectedCurve, equation: parseEquation(v) },
                    },
                  ]),
                "curve-" + selectedCurve.id,
                true,
              )}
              <div className="vg-fields">
                {(["min", "max"] as const).map((k) =>
                  field(
                    "Curve " + (k === "min" ? "start" : "end") + " x",
                    selectedCurve[k],
                    (v) =>
                      change([
                        {
                          op: "set_curve",
                          curve: { ...selectedCurve, [k]: v },
                        },
                      ]),
                  ),
                )}
              </div>
              {button("Use question equation", () =>
                change([
                  {
                    op: "set_curve",
                    curve: { ...selectedCurve, equation: d.equation },
                  },
                ]),
              )}
              {button("Remove curve", () => {
                change([{ op: "set_curve", curve: null }]);
                setSelection(null);
              })}
              <p>
                This drawn curve may deliberately differ from the question
                equation.
              </p>
            </>
          )
        );
      case "reference":
        return (
          selectedLine && (
            <>
              {field("Horizontal line y", selectedLine.y, (v) =>
                change([
                  {
                    op: "set_reference_lines",
                    lines: g.referenceLines.map((l) =>
                      l.id === selectedLine.id ? { ...l, y: v } : l,
                    ),
                  },
                ]),
              )}
              {button("Remove horizontal line", () => {
                change([
                  {
                    op: "set_reference_lines",
                    lines: g.referenceLines.filter(
                      (l) => l.id !== selectedLine.id,
                    ),
                  },
                ]);
                setSelection(null);
              })}
            </>
          )
        );
      case "objects":
        return (
          <>
            {option(
              "Select an object",
              "",
              [
                ["", "Choose…"],
                ...g.series.flatMap((s, i) => [
                  ["series:" + s.id, seriesName(i)] as [string, string],
                  ...s.points.map(
                    (p) =>
                      [
                        "point:" + s.id + ":" + p.id,
                        "Point (" + p.x + ", " + p.y + ") — " + seriesName(i),
                      ] as [string, string],
                  ),
                ]),
                ...g.curves.map(
                  (c) =>
                    ["curve:" + c.id, "Curve: " + equationText(c.equation)] as [
                      string,
                      string,
                    ],
                ),
                ...g.referenceLines.map(
                  (l) =>
                    ["reference:" + l.id, "Horizontal line y = " + l.y] as [
                      string,
                      string,
                    ],
                ),
              ],
              (v) => {
                const [kind, id, pointId] = v.split(":");
                if (kind === "point")
                  setSelection({ kind, seriesId: id, pointId });
                else if (
                  kind === "series" ||
                  kind === "curve" ||
                  kind === "reference"
                )
                  setSelection({ kind, id });
              },
            )}
            <p>Includes hidden, overlapping and off-grid objects.</p>
          </>
        );
    }
  }
  const contextTitle =
    selection?.kind === "cell"
      ? "Table cell"
      : selection?.kind === "bound"
        ? "Axis endpoint"
        : selection?.kind === "axis"
          ? selection.axis + " axis scale"
          : selection?.kind === "series"
            ? seriesName(g.series.findIndex((s) => s.id === selection.id))
            : selection?.kind === "reference"
              ? "Horizontal line"
              : selection
                ? selection.kind[0].toUpperCase() + selection.kind.slice(1)
                : "";
  const zero = pointPosition({ id: "origin", x: "0", y: "0" });
  const axisX = Math.max(
    m.plot.left,
    Math.min(zero.x, m.plot.left + m.plot.width),
  );
  const axisY = Math.max(
    m.plot.top,
    Math.min(zero.y, m.plot.top + m.plot.height),
  );
  const localSelection =
    selection &&
    ["equation", "axis", "bound", "cell", "point"].includes(selection.kind);

  return (
    <div className="app-shell booklet-editor vg-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Table of values & graphs"
          description="Click the equation, table or graph to edit your resource."
        >
          <div
            className={`save-indicator save-indicator--${saved ? "saved" : "error"}`}
          >
            <span />
            {saved ? "Saved on this device" : "Not saved on device"}
          </div>
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && !!history.past.length}
              canRedo={!blocked && !!history.future.length}
              onUndo={undo}
              onRedo={redo}
              onReset={() =>
                ask(
                  "Reset this resource?",
                  "Replace with the June 2018 scaffold. You can undo this.",
                  () => {
                    commit(defaultEnvelope());
                    setSelection(null);
                  },
                )
              }
              resetDisabled={blocked}
              exportDisabled={blocked || !!renderError}
              busy={busy}
              onCopy={() => void exportAction(() => copyForWord(envelope))}
              menuOpen={exportOpen}
              onToggleMenu={() => setExportOpen(!exportOpen)}
            />
            <div className="editor-export-popover" hidden={!exportOpen}>
              {exportOpen && (
                <div className="export-menu" role="menu">
                  {(["svg", "png", "json"] as const).map((format) => (
                    <button
                      key={format}
                      role="menuitem"
                      disabled={blocked || !!renderError}
                      onClick={() =>
                        void exportAction(() => download(envelope, format))
                      }
                    >
                      <Download size={17} aria-hidden="true" />
                      <span>
                        Download{" "}
                        {format === "png"
                          ? "PNG (600 ppi)"
                          : format === "json"
                            ? "editable JSON"
                            : "SVG"}
                      </span>
                    </button>
                  ))}
                  <button
                    role="menuitem"
                    disabled={blocked}
                    onClick={() =>
                      act(() => {
                        file.current?.click();
                      })
                    }
                  >
                    <Copy size={17} aria-hidden="true" />
                    <span>Open editable file</span>
                  </button>
                  <button
                    role="menuitem"
                    disabled={blocked}
                    onClick={() =>
                      void exportAction(async () => {
                        await navigator.clipboard.writeText(
                          editorLink(envelope, location.href),
                        );
                      })
                    }
                  >
                    <Copy size={17} aria-hidden="true" />
                    <span>Copy editable link</span>
                  </button>
                </div>
              )}
            </div>
            <input
              type="file"
              accept=".json,application/json"
              ref={file}
              hidden
              onChange={async (e) => {
                const chosen = e.target.files?.[0];
                e.target.value = "";
                if (!chosen) return;
                try {
                  const incoming = parseFile(await chosen.text());
                  renderSvg(incoming);
                  ask(
                    "Open this resource?",
                    "Your current valid resource is retained until you confirm. Opening is undoable.",
                    () => {
                      commit(incoming);
                      setSelection(null);
                    },
                  );
                } catch (error) {
                  setMessage(errorText(error));
                }
              }}
            />
            <div className="ratio-preview-controls">
              <label>
                Preview zoom{" "}
                <select
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                >
                  <option value={0.75}>75%</option>
                  <option value={1}>100%</option>
                  <option value={1.25}>125%</option>
                  <option value={1.5}>150%</option>
                </select>
              </label>
            </div>
            {!!message && (
              <p role="status" className="vg-message">
                {message}
              </p>
            )}
            {!!recoverRaw && (
              <div className="vg-recovery" role="alert">
                <p>
                  Preserved recovery data must be downloaded before starting
                  afresh.
                </p>
                <button
                  onClick={() => {
                    downloadBlob(
                      new Blob([recoverRaw], { type: "application/json" }),
                      "value-graph-recovery.json",
                    );
                    setMessage(
                      "Recovery download prepared. You can now start afresh.",
                    );
                  }}
                >
                  Download recovery data
                </button>
                <button
                  onClick={() => {
                    if (
                      message !==
                      "Recovery download prepared. You can now start afresh."
                    )
                      return;
                    try {
                      expected.current = save(
                        defaultEnvelope(),
                        recoverRaw,
                        storageKey,
                      );
                      setRecoverRaw(null);
                      commit(defaultEnvelope());
                    } catch (e) {
                      setMessage(errorText(e));
                    }
                  }}
                >
                  Start afresh after downloading
                </button>
              </div>
            )}
            {pendingFields.size > 0 && (
              <p className="vg-message" role="status">
                Apply or cancel the unfinished input before calculating,
                changing structure or exporting.
              </p>
            )}
            {!!renderError && <p role="alert">{renderError}</p>}

            <div className="vg-scroll">
              <div
                className="vg-editor-frame"
                style={{
                  width: m.width * pxPerMm + 240,
                  height:
                    Math.max(m.height * pxPerMm, m.withGraph ? 500 : 250) + 112,
                }}
              >
                <div
                  className="vg-paper"
                  ref={drawing}
                  style={{
                    width: m.width * pxPerMm,
                    height: m.height * pxPerMm,
                    left: 112,
                    top: 56,
                  }}
                  onClick={(e) => {
                    if (!(e.target instanceof Element) || blocked) return;
                    const curveTarget = e.target.closest("[data-curve]");
                    const seriesTarget = e.target.closest(
                      "polyline[data-series]",
                    );
                    if (curveTarget)
                      choose(
                        {
                          kind: "curve",
                          id: curveTarget.getAttribute("data-curve")!,
                        },
                        drawing.current!,
                      );
                    else if (seriesTarget)
                      choose(
                        {
                          kind: "series",
                          id: seriesTarget.getAttribute("data-series")!,
                        },
                        drawing.current!,
                      );
                  }}
                  onPointerDown={(e) => {
                    if (
                      mode !== "point" ||
                      blocked ||
                      !m.withGraph ||
                      (e.target instanceof Element &&
                        e.target.closest("input,button"))
                    )
                      return;
                    const p = pointerPosition(e),
                      x = number(p.x),
                      y = number(p.y);
                    if (
                      x < number(g.bounds.xMin) ||
                      x > number(g.bounds.xMax) ||
                      y < number(g.bounds.yMin) ||
                      y > number(g.bounds.yMax)
                    )
                      return;
                    act(() => addPoint(p.x, p.y));
                    setMode("select");
                    setAnchor(drawing.current);
                  }}
                >
                  <div
                    className="vg-art"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <button
                    className={
                      "vg-equation-target " +
                      (!d.presentation.showEquation ? "vg-placeholder" : "")
                    }
                    aria-label="Edit equation"
                    title="Click to edit equation"
                    disabled={blocked}
                    style={{
                      left: 0,
                      top: d.presentation.showEquation ? 0 : -38,
                      width: m.width * pxPerMm,
                      height: 9 * pxPerMm,
                    }}
                    onClick={(e) =>
                      choose({ kind: "equation" }, e.currentTarget)
                    }
                  >
                    {!d.presentation.showEquation
                      ? "Add equation heading"
                      : null}
                  </button>
                  {m.withTable &&
                    d.columns.map((c, i) =>
                      (["x", "y"] as const).map((row) => {
                        const w = m.table.width / (d.columns.length + 1);
                        return (
                          <div
                            className="vg-cell-target"
                            key={c.id + "-" + row}
                            style={{
                              left: (m.table.left + (i + 1) * w) * pxPerMm,
                              top:
                                (m.table.top +
                                  (row === "y" ? m.table.rowHeight : 0)) *
                                pxPerMm,
                              width: w * pxPerMm,
                              height: m.table.rowHeight * pxPerMm,
                            }}
                          >
                            <button
                              disabled={blocked || mode !== "select"}
                              aria-label={
                                "Edit " + row + " for column " + (i + 1)
                              }
                              onClick={(e) =>
                                choose(
                                  { kind: "cell", id: c.id, row },
                                  e.currentTarget,
                                )
                              }
                            />
                          </div>
                        );
                      }),
                    )}
                  {m.withGraph &&
                    d.presentation.showMarkers &&
                    g.series.flatMap((s) =>
                      s.points.map((p) => {
                        const pos = pointPosition(p);
                        if (
                          pos.x < m.plot.left ||
                          pos.x > m.plot.left + m.plot.width ||
                          pos.y < m.plot.top ||
                          pos.y > m.plot.top + m.plot.height
                        )
                          return null;
                        return (
                          <button
                            key={`${s.id}-${p.id}`}
                            className={`vg-point-target ${selectedPoint?.id === p.id && selectedSeries?.id === s.id ? "vg-point-selected" : ""}`}
                            style={{
                              left: pos.x * pxPerMm - 12,
                              top: pos.y * pxPerMm - 12,
                            }}
                            disabled={blocked}
                            aria-label={`Select point (${p.x}, ${p.y})`}
                            onPointerDown={(e) => {
                              setAnchor(e.currentTarget);
                              startDrag(e, s.id, p.id);
                            }}
                            onPointerMove={(e) => {
                              if (!drag || drag.op.op !== "move_point") return;
                              const value = pointerPosition(e);
                              setDrag({
                                ...drag,
                                op: { ...drag.op, ...value },
                              });
                            }}
                            onPointerUp={(e) => {
                              if (!drag) return;
                              e.currentTarget.releasePointerCapture(
                                e.pointerId,
                              );
                              try {
                                const next = apply(drag.initial, [drag.op]);
                                if (canonical(next) !== canonical(drag.initial))
                                  commit(next);
                              } catch (error) {
                                setMessage(errorText(error));
                              }
                              setDrag(null);
                            }}
                            onPointerCancel={() => setDrag(null)}
                            onClick={(e) => {
                              setAnchor(e.currentTarget);
                              setSelection({
                                kind: "point",
                                seriesId: s.id,
                                pointId: p.id,
                              });
                            }}
                          />
                        );
                      }),
                    )}
                  {m.withTable && (
                    <div
                      className="vg-table-tools"
                      style={{
                        left: (m.table.left + m.table.width) * pxPerMm + 18,
                        top: m.table.top * pxPerMm,
                      }}
                    >
                      <div className="vg-actions">
                        <strong>Table</strong>
                        <button
                          aria-label="Add column"
                          title="Add column"
                          disabled={blocked || d.columns.length >= 13}
                          onClick={() => act(appendColumn)}
                        >
                          ＋
                        </button>
                        <button
                          aria-label={
                            selectedColumn
                              ? "Remove selected column"
                              : "Remove last column"
                          }
                          title="Remove column"
                          disabled={blocked || d.columns.length <= 2}
                          onClick={() =>
                            act(() => {
                              change([
                                {
                                  op: "remove_column",
                                  columnId:
                                    selectedColumn?.id ??
                                    d.columns[d.columns.length - 1].id,
                                },
                              ]);
                              setSelection(null);
                            })
                          }
                        >
                          −
                        </button>
                      </div>
                    </div>
                  )}
                  {m.withGraph && (
                    <>
                      {(["xMin", "xMax", "yMin", "yMax"] as const).map(
                        (key) => {
                          const side =
                              key === "xMin"
                                ? "x left"
                                : key === "xMax"
                                  ? "x right"
                                  : key === "yMin"
                                    ? "y bottom"
                                    : "y top",
                            dir = key.endsWith("Min") ? -1 : 1;
                          const vertical = key.startsWith("y");
                          const left = vertical
                            ? axisX * pxPerMm + (key === "yMax" ? 38 : -44)
                            : key === "xMin"
                              ? m.plot.left * pxPerMm - 104
                              : (m.plot.left + m.plot.width) * pxPerMm + 52;
                          const top = vertical
                            ? key === "yMax"
                              ? m.plot.top * pxPerMm - 48
                              : (m.plot.top + m.plot.height) * pxPerMm + 10
                            : axisY * pxPerMm - 20;
                          return (
                            <div
                              key={key}
                              className="vg-axis-end"
                              style={{ left, top }}
                              aria-label={side + " endpoint"}
                            >
                              <button
                                aria-label={"Extend " + side + " range"}
                                title="Add one centimetre"
                                disabled={blocked}
                                onClick={() => stepBound(key, dir)}
                              >
                                +
                              </button>
                              <button
                                aria-label={"Shorten " + side + " range"}
                                title="Remove one centimetre"
                                disabled={
                                  blocked || number(g.bounds[key]) === 0
                                }
                                onClick={() =>
                                  stepBound(key, dir === 1 ? -1 : 1)
                                }
                              >
                                −
                              </button>
                              <button
                                className="vg-bound-value"
                                aria-label={"Edit " + side + " endpoint"}
                                title="Set exact endpoint"
                                disabled={blocked}
                                onClick={(e) =>
                                  choose(
                                    { kind: "bound", key },
                                    e.currentTarget,
                                  )
                                }
                              >
                                {g.bounds[key]}
                              </button>
                            </div>
                          );
                        },
                      )}
                      <button
                        className="vg-axis-name"
                        aria-label="Edit x axis scale"
                        title="Click x to edit its scale"
                        disabled={blocked}
                        style={{
                          left:
                            (m.plot.left +
                              m.plot.width +
                              (g.positiveEndArrows ? 5 : 0) +
                              1.5) *
                              pxPerMm -
                            12,
                          top: axisY * pxPerMm - 8,
                        }}
                        onClick={(e) =>
                          choose({ kind: "axis", axis: "x" }, e.currentTarget)
                        }
                      >
                        x scale
                      </button>
                      <button
                        className="vg-axis-name"
                        aria-label="Edit y axis scale"
                        title="Click y to edit its scale"
                        disabled={blocked}
                        style={{
                          left: (axisX - 3) * pxPerMm - 12,
                          top:
                            (m.plot.top - (g.positiveEndArrows ? 5 : 0) - 1) *
                              pxPerMm -
                            18,
                        }}
                        onClick={(e) =>
                          choose({ kind: "axis", axis: "y" }, e.currentTarget)
                        }
                      >
                        y scale
                      </button>
                      {g.referenceLines.map((line) => {
                        const pos = pointPosition({
                          id: line.id,
                          x: g.bounds.xMin,
                          y: line.y,
                        });
                        return d.presentation.showReferenceLines &&
                          pos.y >= m.plot.top &&
                          pos.y <= m.plot.top + m.plot.height ? (
                          <button
                            key={line.id}
                            className="vg-reference-target"
                            aria-label={"Edit horizontal line y = " + line.y}
                            style={{
                              left: m.plot.left * pxPerMm,
                              top: pos.y * pxPerMm - 6,
                              width: m.plot.width * pxPerMm,
                            }}
                            onClick={(e) =>
                              choose(
                                { kind: "reference", id: line.id },
                                e.currentTarget,
                              )
                            }
                          />
                        ) : null;
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
            <p className="vg-size">
              Print size: {(m.width / 10).toFixed(1)} ×{" "}
              {(m.height / 10).toFixed(1)} cm. Axis numbers: 12 pt. Preview zoom
              does not change print size.
            </p>
            {warnings(envelope).map((w) => (
              <p className="vg-warning" key={w}>
                {w}
              </p>
            ))}
            {selection && localSelection && (
              <LocalEditor
                anchor={anchor}
                title={contextTitle}
                blocked={blocked}
                active={active && !pending}
                onClose={close}
              >
                <div
                  key={JSON.stringify(selection)}
                  className="vg-context-content"
                >
                  {contextContent()}
                </div>
              </LocalEditor>
            )}
          </Panel>
          <aside
            className="inspector-stack"
            aria-label="Table and graph settings"
          >
            <section className="panel-card specialist-tools">
              <h2>Table and graph tools</h2>
              <div className="specialist-actions">
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "table" }, e.currentTarget)}
                >
                  Table options
                </button>
                <button
                  disabled={blocked}
                  onClick={() =>
                    act(() => {
                      const blanks = d.columns
                        .filter((c) => c.y.kind !== "value")
                        .map((c) => c.id);
                      if (!blanks.length) {
                        setMessage("There are no blank cells to fill.");
                        return;
                      }
                      change([
                        {
                          op: "calculate_cells",
                          columnIds: blanks,
                          overwrite: false,
                        },
                      ]);
                    })
                  }
                >
                  Fill blank values
                </button>
              </div>
              <div className="specialist-actions">
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "plot" }, e.currentTarget)}
                >
                  Plot
                </button>
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "add" }, e.currentTarget)}
                >
                  Add
                </button>
                <button
                  disabled={blocked}
                  onClick={(e) => {
                    if (!g.curves.length) curve();
                    choose(
                      {
                        kind: "curve",
                        id: g.curves[0]?.id ?? "quadratic",
                      },
                      e.currentTarget,
                    );
                  }}
                >
                  Curve
                </button>
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "graph" }, e.currentTarget)}
                >
                  Graph options
                </button>
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "objects" }, e.currentTarget)}
                >
                  Select object
                </button>
                {mode === "point" && (
                  <>
                    <p>Click the grid to place a point.</p>
                    <button onClick={() => setMode("select")}>
                      Cancel placement
                    </button>
                  </>
                )}
              </div>
            </section>
            <section className="panel-card specialist-tools">
              <h2>Resource settings</h2>
              <div className="specialist-actions">
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "layout" }, e.currentTarget)}
                >
                  Layout
                </button>
                <button
                  disabled={blocked}
                  onClick={(e) => choose({ kind: "examples" }, e.currentTarget)}
                >
                  Examples
                </button>
              </div>
            </section>
            {selection && !localSelection ? (
              <InspectorEditor
                title={contextTitle}
                active={active && !pending}
                blocked={blocked}
                onClose={close}
              >
                <div key={JSON.stringify(selection)}>{contextContent()}</div>
              </InspectorEditor>
            ) : (
              <section className="panel-card">
                <h2>Edit resource</h2>
                <p>
                  Click the equation, a table cell, an axis label or a plotted
                  object to edit it. Use the tools above for other settings.
                </p>
              </section>
            )}
          </aside>
        </section>
        {active && pending && (
          <RatioDialog
            title={pending.title}
            onCancel={() => setPending(null)}
            onConfirm={() => {
              try {
                pending.action();
                setPending(null);
              } catch (e) {
                setMessage(errorText(e));
                setPending(null);
              }
            }}
            confirmLabel="Continue"
            disabled={blocked}
          >
            <p>{pending.description}</p>
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
