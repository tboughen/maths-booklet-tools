import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { downloadName } from "../export/filenames";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { chartGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { StructureStepper } from "../site/StructureStepper";
import { EditorHint } from "../site/EditorHint";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import {
  EditorDownloadMenu,
} from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  addCategory,
  addSeries,
  axisKind,
  canonical,
  create,
  drawnSeries,
  fillNames,
  fills,
  forView,
  gridChoices,
  hasHidden,
  kindNames,
  kinds,
  layout,
  MAX_CATEGORIES,
  MAX_SERIES,
  minorChoices,
  parseFile,
  PIE_RADIUS,
  SYMBOL_MM,
  pictogramOf,
  symbolChoices,
  symbolNames,
  MAX_POINTS,
  MAX_READINGS,
  SCATTER_MM,
  scatterTableChoices,
  scatterTableNames,
  scatterOf,
  type ScatterSettings,
  pieLabelChoices,
  pieLabelNames,
  pieOf,
  pieLayout,
  round1,
  removeCategory,
  removeSeries,
  renderSvg,
  setAllShown,
  singleSet,
  validate,
  type Envelope,
  type Fill,
} from "../../packages/chart-core/src";
import { chartEditorLink, parseChartLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import "./charts.css";
import { openDraft, useDraftAutosave, handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:charts:v1");
type Doc = Envelope["document"];

/** A new chart starts from the house style's lines (U111). */
function fresh() {
  const e = create();
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
}
function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh: fresh, recoveryMessage: "Saved chart data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}

/** Text field that keeps its draft while typing and commits on Enter or leaving
 * the field; Escape restores the saved text. Invalid numbers are committed as
 * typed so they stay visible with an error and block export. */
function DraftField({
  id,
  label,
  value,
  onCommit,
  disabled,
  invalid,
  inputMode,
  maxLength,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputMode?: "decimal";
  maxLength: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      id={id}
      className={className}
      aria-label={label}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      aria-invalid={invalid || undefined}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

/** Settings cards for a scatter graph: points, axes and grid, and the line of best fit with readings. */
function ScatterCards({
  sc,
  blocked,
  selected,
  issues,
  onChange,
  linesControl,
}: {
  sc: ScatterSettings;
  blocked: boolean;
  selected: string | null;
  issues: string[];
  onChange: (update: (s: ScatterSettings) => void) => void;
  linesControl: React.ReactNode;
}) {
  const bad = (prefix: string) => issues.some((x) => x.startsWith(prefix));
  /** Marks the axis field each axis error is about. */
  const axisBad = (axis: string, field: "min" | "max" | "step") =>
    issues.some((x) => {
      if (!x.includes(`${axis} axis`) || x.startsWith("Reading")) return false;
      if (field === "min") return x.includes("axis start") || x.includes("greater than its start");
      if (field === "max") return x.includes("axis end");
      return x.includes("axis step") || x.includes("steps on the") || x.includes("Small grid squares");
    });
  const axisFields = (key: "xAxis" | "yAxis", name: string) => (
    <fieldset className="ch-fieldset">
      <legend>{name} axis</legend>
      <div className="ch-fields">
        {(["min", "max", "step"] as const).map((f) => (
          <label key={f}>
            {{ min: "Start", max: "End", step: "Step" }[f]}
            <DraftField
              label={`${name} axis ${{ min: "start", max: "end", step: "step" }[f]}`}
              value={sc[key][f]}
              maxLength={12}
              inputMode="decimal"
              disabled={blocked}
              invalid={axisBad(name.toLowerCase(), f)}
              onCommit={(v) => onChange((s) => void (s[key][f] = v))}
            />
          </label>
        ))}
        <label>
          Length (mm)
          <select
            aria-label={`${name} axis length`}
            value={sc[key].mm}
            disabled={blocked}
            onChange={(ev) => onChange((s) => void (s[key].mm = Number(ev.target.value)))}
          >
            {[...new Set([40, 60, 80, 100, 120, 140, 160, sc[key].mm])]
              .filter((x) => x >= SCATTER_MM.minimum && x <= SCATTER_MM.maximum)
              .sort((a, b) => a - b)
              .map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
          </select>
        </label>
        <label className="ch-wide">
          Title
          <DraftField label={`${name} axis title`} value={sc[key].title} maxLength={40} disabled={blocked} onCommit={(v) => onChange((s) => void (s[key].title = v))} />
        </label>
        <label className="ch-check">
          <input
            type="checkbox"
            aria-label={`Break the ${name.toLowerCase()} axis`}
            checked={sc[key].broken}
            disabled={blocked}
            onChange={(ev) => onChange((s) => void (s[key].broken = ev.target.checked))}
          />
          Zig-zag break (axis does not start at 0)
        </label>
      </div>
    </fieldset>
  );
  const fit = sc.bestFit;
  return (
    <>
      <section className="panel-card ch-panel">
        <h2>Points</h2>
        <div className="ch-table-wrap">
          <table className="ch-table ch-points">
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">x</th>
                <th scope="col">y</th>
                <th scope="col">Hide</th>
                <th scope="col">Ring</th>
              </tr>
            </thead>
            <tbody>
              {sc.points.map((p, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  {(["x", "y"] as const).map((c) => (
                    <td key={c}>
                      <DraftField
                        id={`ch-point-${c}-${i}`}
                        className={selected === `ch-point-${c}-${i}` ? "ch-field-selected" : ""}
                        label={`Point ${i + 1} ${c}`}
                        value={p[c]}
                        maxLength={12}
                        inputMode="decimal"
                        disabled={blocked}
                        invalid={bad(`Point ${i + 1}:`)}
                        onCommit={(v) => onChange((s) => void (s.points[i][c] = v))}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Hide point ${i + 1} for pupils`}
                      checked={p.show === "hidden"}
                      disabled={blocked}
                      onChange={(ev) => onChange((s) => void (s.points[i].show = ev.target.checked ? "hidden" : "show"))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Ring point ${i + 1} (outlier)`}
                      checked={p.ring}
                      disabled={blocked}
                      onChange={(ev) => onChange((s) => void (s.points[i].ring = ev.target.checked))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ch-note">
          Values stay as typed. Hide keeps a point as a saved answer for pupils to plot; Ring circles
          an outlier. Use + and − beside the graph to add or remove the last point.
        </p>
        <div className="ch-fields">
          <label>
            Table of values
            <select aria-label="Table of values" value={sc.table} disabled={blocked} onChange={(ev) => onChange((s) => void (s.table = ev.target.value as ScatterSettings["table"]))}>
              {scatterTableChoices.map((x) => (
                <option key={x} value={x}>
                  {scatterTableNames[x]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ch-row">
          <button type="button" disabled={blocked || !sc.points.length} onClick={() => onChange((s) => s.points.forEach((p) => (p.show = "hidden")))}>
            Hide all points (pupils plot)
          </button>
          <button
            type="button"
            disabled={blocked || !sc.points.some((p) => p.show === "hidden")}
            onClick={() => onChange((s) => s.points.forEach((p) => (p.show = "show")))}
          >
            Show all points
          </button>
        </div>
      </section>
      <section className="panel-card ch-panel">
        <h2>Axes and grid</h2>
        {axisFields("xAxis", "Horizontal")}
        {axisFields("yAxis", "Vertical")}
        <div className="ch-fields">
          <label>
            Grid
            <select aria-label="Grid" value={sc.grid} disabled={blocked} onChange={(ev) => onChange((s) => void (s.grid = ev.target.value as ScatterSettings["grid"]))}>
              <option value="none">No grid</option>
              <option value="major">Lines at each step</option>
              <option value="fine">Graph paper</option>
            </select>
          </label>
          <label>
            Small squares per step
            <select
              aria-label="Small squares per step"
              value={sc.minor}
              disabled={blocked || sc.grid !== "fine"}
              onChange={(ev) => onChange((s) => void (s.minor = Number(ev.target.value) as ScatterSettings["minor"]))}
            >
              {minorChoices.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          {linesControl}
        </div>
      </section>
      <section className="panel-card ch-panel">
        <h2>Line of best fit and readings</h2>
        <label className="ch-check">
          <input
            type="checkbox"
            checked={!!fit}
            disabled={blocked}
            onChange={(ev) =>
              onChange((s) => {
                if (ev.target.checked) s.bestFit = { from: { x: "", y: "" }, to: { x: "", y: "" }, show: "show" };
                else delete s.bestFit;
              })
            }
          />
          Draw a line of best fit
        </label>
        {fit && (
          <div className="ch-fields">
            {(["from", "to"] as const).flatMap((end) =>
              (["x", "y"] as const).map((c) => (
                <label key={end + c}>
                  {end === "from" ? "Through" : "and"} {c}
                  <DraftField
                    label={`Line of best fit ${end === "from" ? "first" : "second"} point ${c}`}
                    value={fit[end][c]}
                    maxLength={12}
                    inputMode="decimal"
                    disabled={blocked}
                    invalid={bad("Line of best fit")}
                    onCommit={(v) => onChange((s) => void (s.bestFit![end][c] = v))}
                  />
                </label>
              )),
            )}
            <label className="ch-check">
              <input
                type="checkbox"
                checked={fit.show === "hidden"}
                disabled={blocked}
                onChange={(ev) => onChange((s) => void (s.bestFit!.show = ev.target.checked ? "hidden" : "show"))}
              />
              Hide the line (pupils draw it)
            </label>
          </div>
        )}
        <p className="ch-note">
          You choose two points the line passes through; it is drawn across the grid. Nothing is
          fitted for you.
        </p>
        {sc.readings.map((r, i) => (
          <div className="ch-fields" key={i}>
            <label>
              Reading {i + 1} from
              <select
                aria-label={`Reading ${i + 1} axis`}
                value={r.axis}
                disabled={blocked}
                onChange={(ev) => onChange((s) => void (s.readings[i].axis = ev.target.value as "x" | "y"))}
              >
                <option value="x">Horizontal axis</option>
                <option value="y">Vertical axis</option>
              </select>
            </label>
            <label>
              Value
              <DraftField
                label={`Reading ${i + 1} value`}
                value={r.value}
                maxLength={12}
                inputMode="decimal"
                disabled={blocked}
                invalid={bad(`Reading ${i + 1}:`)}
                onCommit={(v) => onChange((s) => void (s.readings[i].value = v))}
              />
            </label>
            <label className="ch-check">
              <input
                type="checkbox"
                checked={r.show === "hidden"}
                disabled={blocked}
                onChange={(ev) => onChange((s) => void (s.readings[i].show = ev.target.checked ? "hidden" : "show"))}
              />
              Hide (pupils read it)
            </label>
            <button type="button" disabled={blocked} onClick={() => onChange((s) => void s.readings.splice(i, 1))}>
              Remove reading {i + 1}
            </button>
          </div>
        ))}
        <div className="ch-row">
          <button
            type="button"
            disabled={blocked || !fit || sc.readings.length >= MAX_READINGS}
            onClick={() => onChange((s) => void s.readings.push({ axis: "x", value: "", show: "show" }))}
          >
            Add a reading
          </button>
        </div>
        <p className="ch-note">
          A reading draws dashed guides from a value on one axis to the line and across to the other
          axis. The value read off is never printed.
        </p>
      </section>
    </>
  );
}

export default function ChartsPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [pending, setPending] = useState<{
      e: Envelope;
      title: string;
      explanation: string;
    } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view, true),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit(
    (g.width * 96) / 25.4,
    (g.height * 96) / 25.4,
    zoom,
    (w) => (w < 500 ? 72 : 120),
  );
  const answerSvg = renderSvg(forView(e, "answer", true));
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const series = drawnSeries(e);
  const line = d.kind === "vline",
    pie = d.kind === "pie",
    pictogram = d.kind === "pictogram",
    scatter = d.kind === "scatter",
    sc = scatterOf(d),
    mark = pie ? "sector" : pictogram ? "row" : scatter ? "point" : line ? "line" : "bar";
  /** Teacher-facing sector angles for the Data table (exact; the chart draws them). */
  const pieAngles = pie ? pieLayout(e) : null,
    angles = pieAngles?.valuesValid ? pieAngles.sectors.map((x) => x.end - x.start) : [];
  /** A hidden sector's angle is a saved answer: the Angle column shows it only on the teacher copy. */
  const s0Hidden = (ci: number) => d.series[0].values[ci]?.show === "hidden";

  function commit(next: Envelope, label?: string) {
    if (recovery !== null) return;
    const valid = validate(next);
    documentHistory.commit(valid, label);
    setMessage("");
  }
  function patch(update: (n: Doc) => void) {
    if (blocked) return;
    const n = structuredClone(e);
    update(n.document);
    try {
      commit(n);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  /** One undoable edit of the scatter graph's settings. */
  function patchScatter(update: (s: ScatterSettings) => void) {
    patch((n) => {
      const next = structuredClone(scatterOf(n));
      update(next);
      n.scatter = next;
    });
  }
  function undo() {
    if (blocked) return;
    documentHistory.undo();
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
  }
  function replacement(
    next: Envelope,
    title: string,
    explanation = "This replaces the current chart. You can undo the replacement.",
  ) {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  function focusField(id: string) {
    setSelected(id);
    const field = document.getElementById(id) as HTMLInputElement | null;
    field?.focus();
    field?.select();
  }

  // Autosave with protection for another tab's newer draft.
  const savedText = useMemo(() => canonical(history.present), [history.present]);
  const { saveState, keepStored } = useDraftAutosave({
    key: STORAGE,
    text: savedText,
    paused: recovery !== null,
    onConflict: (raw, reason) => {
      setRecovery(raw);
      setProtectedCopy(false);
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its saved data is protected." : "Saved chart data changed in another tab. Download its data before replacing it.");
    },
  });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (handleUndoKeys(event, { undo, redo })) return;
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function run(
    action: () => Promise<void>,
    success = "Image copied. Paste with Ctrl+V.",
  ) {
    if (blocked || issue) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  const linkPending = useRef(false),
    linkSeen = useRef("");
  useEffect(() => {
    if (!active) return;
    const inspect = () => {
      if (
        !location.hash.startsWith("#chart=") ||
        linkSeen.current === location.href ||
        blocked
      )
        return;
      linkSeen.current = location.href;
      try {
        const incoming = parseChartLink(location.href);
        linkPending.current = true;
        replacement(incoming, "Open the linked chart?");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  function consumeLink() {
    if (linkPending.current && location.hash.startsWith("#chart="))
      window.history.replaceState(
        null,
        "",
        location.pathname + location.search,
      );
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 40000) throw Error("This editable file is too large.");
      replacement(parseFile(await upload.text()), "Open this chart?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const valueInvalid = (si: number, ci: number) => {
    const name = `${d.categories[ci] || `Category ${ci + 1}`}${series.length > 1 ? `, ${d.series[si].name || `data set ${si + 1}`}` : ""}:`;
    return g.issues.some((x) => x.startsWith(name));
  };
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;

  const linesControl = (
    <label>
      Lines
      <select
        aria-label="Lines"
        value={d.lines ?? "normal"}
        disabled={blocked}
        onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight))}
      >
        {LINE_WEIGHTS.map((v) => (
          <option key={v} value={v}>
            {LINE_WEIGHT_NAMES[v]}
          </option>
        ))}
      </select>
    </label>
  );
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  return (
    <div className="app-shell booklet-editor ch-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Statistical charts"
          description="Make bar, dual, composite and vertical line charts on exam-style axes, pie charts at true size, pictograms and scatter graphs."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replacement(fresh(), "Reset the chart?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(
                  () => copyWord(displayed, view === "answer"),
                  "Copied for Word at " +
                    formatResourceSize(g.width / 10, g.height / 10) +
                    ". Paste with Ctrl+V.",
                )
              }
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(displayed, view === "answer")))
              }
              menuId="chart-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="chart-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                about: titleNote.item,
                worked: worked.item,
                both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                svg: {
                  action: () => downloadImage(displayed, "svg", view === "answer"),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                png: {
                  action: () => downloadImage(displayed, "png", view === "answer"),
                  disabled: blocked || !!issue,
                  success: "PNG download started.",
                },
                pdf: {
                  action: () => downloadImage(displayed, "pdf", view === "answer"),
                  disabled: blocked || !!issue,
                  success: "PDF download started.",
                },
                save: {
                  action: () => downloadEditable(e),
                  disabled: blocked,
                  success: "Editable file download started.",
                },
                open: {
                  action: () => file.current?.click(),
                  disabled: blocked,
                  success: "",
                },
                link: {
                  action: () =>
                    navigator.clipboard.writeText(
                      chartEditorLink(e, location.href),
                    ),
                  disabled: blocked,
                  success: "Editable link copied.",
                },
              })}
            />
            {titleNote.dialog}
            {worked.dialog}
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(ev) => {
                const upload = ev.target.files?.[0];
                ev.target.value = "";
                if (upload) void importFile(upload);
              }}
            />
            <div className="ch-scroll editor-stage" ref={fitted.ref}>
              <div className="ch-stage">
                <div
                  className="ch-resource"
                  data-testid="chart-resource"
                  style={{
                    width: ((g.width * 96) / 25.4) * fitted.scale,
                    height: ((g.height * 96) / 25.4) * fitted.scale,
                  }}
                >
                  <div
                    className="ch-art"
                    dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }}
                  />
                  {g.targets.map((t) => {
                    const point = scatter ? sc.points[t.category] : null;
                    const cell = point ?? d.series[t.series].values[t.category];
                    const id = point ? `ch-point-x-${t.category}` : `ch-value-${t.series}-${t.category}`;
                    const hiddenHere =
                      view === "pupil" &&
                      cell.show === "hidden" &&
                      (point !== null || (cell as { value: string }).value.trim() !== "");
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`ch-hit ${selected === id ? "ch-selected" : ""} ${hiddenHere ? "ch-hidden-answer" : ""}`}
                        aria-label={
                          point
                            ? `Edit point ${t.category + 1}: (${point.x}, ${point.y})`
                            : `Edit ${mark}: ${d.categories[t.category] || `category ${t.category + 1}`}${series.length > 1 ? `, ${d.series[t.series].name}` : ""}`
                        }
                        title={
                          hiddenHere
                            ? "Hidden answer (pupils draw this)"
                            : undefined
                        }
                        disabled={blocked}
                        style={{
                          left: px(t.x, g.width),
                          top: px(t.y, g.height),
                          width: px(t.width, g.width),
                          height: px(t.height, g.height),
                        }}
                        onClick={() => focusField(id)}
                      />
                    );
                  })}
                  {g.labels.map(({ category: i, ...box }) => (
                    <button
                      key={`cat-${i}`}
                      type="button"
                      className={`ch-hit ${selected === `ch-cat-${i}` ? "ch-selected" : ""}`}
                      aria-label={`Edit category label ${d.categories[i] || i + 1}`}
                      disabled={blocked}
                      style={{
                        left: px(box.x, g.width),
                        top: px(box.y, g.height),
                        width: px(box.width, g.width),
                        height: px(box.height, g.height),
                      }}
                      onClick={() => focusField(`ch-cat-${i}`)}
                    />
                  ))}
                </div>
                {scatter ? (
                <StructureStepper
                  vertical
                  name="Points"
                  caption=""
                  add={{
                    label: "Add a point at the end",
                    title: "Add point",
                    disabled: blocked || sc.points.length >= MAX_POINTS,
                    onClick: () => {
                      patchScatter((s) => void s.points.push({ x: "", y: "", show: "show", ring: false }));
                      requestAnimationFrame(() => focusField(`ch-point-x-${sc.points.length}`));
                    },
                  }}
                  remove={{
                    label: `Remove the last point${sc.points.length ? ` (point ${sc.points.length})` : ""}`,
                    title: "Remove last point",
                    disabled: blocked || sc.points.length === 0,
                    onClick: () => patchScatter((s) => void s.points.pop()),
                  }}
                />
                ) : (
                <StructureStepper
                                    vertical
                  name="Categories"
                  caption=""
                  add={{
                    label: "Add a category at the end",
                    title: "Add category",
                    disabled: blocked || d.categories.length >= MAX_CATEGORIES,
                    onClick: () => {
                      commit(addCategory(e));
                      requestAnimationFrame(() =>
                        focusField(`ch-cat-${d.categories.length}`),
                      );
                    },
                  }}
                  remove={{
                    label: `Remove the last category (${d.categories[d.categories.length - 1] || "unnamed"})`,
                    title: "Remove last category",
                    disabled: blocked || d.categories.length <= 1,
                    onClick: () => commit(removeCategory(e)),
                  }}
                />
                )}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="charts">
                  Click a {pie ? "sector" : pictogram ? "row or category" : scatter ? "point" : "bar, line or category label"} to edit its value. Enter
                  applies; Escape restores.
                </EditorHint>
              }
            >
              <AnswerCopyToggle
                checked={view === "answer"}
                disabled={blocked}
                onChange={(checked) => setView(checked ? "answer" : "pupil")}
              />
            </EditorFoot>
            {(issue || g.notes.length > 0) && (
              <div className="ch-status" aria-live="polite">
                {g.issues.map((x) => (
                  <p key={x} className="ch-error" role="alert">
                    {x}
                  </p>
                ))}
                {g.notes.map((x) => (
                  <p key={x}>Teacher note: {x}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside className="inspector-stack" aria-label="Chart settings">
            <ExampleGallery
              examples={chartGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) =>
                replacement(resource, `Open ${title}?`)
              }
              onWorked={(resource) => commit(resource, "use worked version")}
            />
            <section className="panel-card ch-panel">
              <h2>Chart type</h2>
              <div className="ch-kinds" role="group" aria-label="Chart type">
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={blocked}
                    aria-pressed={d.kind === k}
                    onClick={() =>
                      patch((n) => {
                        n.kind = k;
                        if (!singleSet(k) && n.series.length < 2) {
                          const two = addSeries({ ...e, document: n });
                          n.series = two.document.series;
                        }
                      })
                    }
                  >
                    {kindNames[k]}
                  </button>
                ))}
              </div>
            </section>
            {!scatter && (
            <section className="panel-card ch-panel">
              <h2>Data</h2>
              <div className="ch-table-wrap">
                <table className="ch-table">
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      {series.map((s, si) => (
                        <th scope="col" key={si}>
                          <DraftField
                            label={`Name of data set ${si + 1}`}
                            value={s.name}
                            maxLength={24}
                            disabled={blocked}
                            onCommit={(v) =>
                              patch((n) => void (n.series[si].name = v))
                            }
                          />
                          {!line && !pie && !pictogram && (
                            <select
                              aria-label={`Fill for ${s.name || `data set ${si + 1}`}`}
                              value={s.fill}
                              disabled={blocked}
                              onChange={(ev) =>
                                patch(
                                  (n) =>
                                    void (n.series[si].fill = ev.target
                                      .value as Fill),
                                )
                              }
                            >
                              {fills.map((f) => (
                                <option key={f} value={f}>
                                  {fillNames[f]}
                                </option>
                              ))}
                            </select>
                          )}
                        </th>
                      ))}
                      {pie && <th scope="col">Angle</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.categories.map((c, ci) => (
                      <tr key={ci}>
                        <th scope="row">
                          <DraftField
                            id={`ch-cat-${ci}`}
                            className={
                              selected === `ch-cat-${ci}`
                                ? "ch-field-selected"
                                : ""
                            }
                            label={`Category ${ci + 1} label`}
                            value={c}
                            maxLength={16}
                            disabled={blocked}
                            onCommit={(v) =>
                              patch((n) => void (n.categories[ci] = v))
                            }
                          />
                        </th>
                        {series.map((s, si) => {
                          const cell = s.values[ci];
                          const name = `${c || `category ${ci + 1}`}${series.length > 1 ? `, ${s.name || `data set ${si + 1}`}` : ""}`;
                          return (
                            <td key={si}>
                              <DraftField
                                id={`ch-value-${si}-${ci}`}
                                className={
                                  selected === `ch-value-${si}-${ci}`
                                    ? "ch-field-selected"
                                    : ""
                                }
                                label={`Value for ${name}`}
                                value={cell.value}
                                maxLength={12}
                                inputMode="decimal"
                                invalid={valueInvalid(si, ci)}
                                disabled={blocked}
                                onCommit={(v) =>
                                  patch(
                                    (n) =>
                                      void (n.series[si].values[ci].value = v),
                                  )
                                }
                              />
                              <label className="ch-hide">
                                <input
                                  type="checkbox"
                                  disabled={blocked}
                                  checked={cell.show === "hidden"}
                                  aria-label={`Hide ${name} for pupils`}
                                  onChange={(ev) =>
                                    patch(
                                      (n) =>
                                        void (n.series[si].values[ci].show = ev
                                          .target.checked
                                          ? "hidden"
                                          : "show"),
                                    )
                                  }
                                />
                                Hide
                              </label>
                            </td>
                          );
                        })}
                        {pie && (
                          <td className="ch-angle" aria-label={`Angle for ${c || `category ${ci + 1}`}`}>
                            {angles[ci] === undefined
                              ? "—"
                              : s0Hidden(ci) && view === "pupil"
                                ? "Hidden"
                                : `${round1(angles[ci])}°`}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ch-note">
                {pie
                  ? "Every category needs a value; 0 is a value. Angles are 360 × value ÷ total, rounded here to 1 decimal place. Hide keeps a sector as a saved answer for pupils to draw; its angle shows here only on the teacher copy."
                  : pictogram
                    ? "Leave a value blank for an empty row; 0 is a value. Each row draws value ÷ key symbols. Hide keeps a row as a saved answer for pupils to draw."
                    : `Leave a value blank for no ${mark}; 0 is a value. Hide keeps the value as a saved answer for pupils to draw.`}
              </p>
              <div className="ch-row">
                {!singleSet(d.kind) && (
                  <>
                    <button
                      type="button"
                      disabled={blocked || d.series.length >= MAX_SERIES}
                      onClick={() => commit(addSeries(e))}
                    >
                      Add data set
                    </button>
                    <button
                      type="button"
                      disabled={blocked || d.series.length <= 1}
                      onClick={() => commit(removeSeries(e))}
                    >
                      Remove last data set
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => commit(setAllShown(e, "hidden"))}
                >
                  Hide all (pupils draw)
                </button>
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() => commit(setAllShown(e, "show"))}
                >
                  Show all
                </button>
              </div>
            </section>
            )}
            {scatter && <ScatterCards sc={sc} blocked={blocked} selected={selected} issues={g.issues} onChange={patchScatter} linesControl={linesControl} />}
            {pie && (
              <section className="panel-card ch-panel">
                <h2>Pie chart</h2>
                <div className="ch-fields">
                  <label>
                    Radius (mm)
                    <select
                      aria-label="Pie chart radius"
                      value={pieOf(d).radiusMm}
                      disabled={blocked}
                      onChange={(ev) => patch((n) => void (n.pie = { ...pieOf(n), radiusMm: Number(ev.target.value) }))}
                    >
                      {[...new Set([25, 30, 35, 40, 45, 50, 60, 70, pieOf(d).radiusMm])]
                        .filter((x) => x >= PIE_RADIUS.minimum && x <= PIE_RADIUS.maximum)
                        .sort((a, b) => a - b)
                        .map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Sector labels
                    <select
                      aria-label="Sector labels"
                      value={pieOf(d).labels}
                      disabled={blocked}
                      onChange={(ev) => patch((n) => void (n.pie = { ...pieOf(n), labels: ev.target.value as (typeof pieLabelChoices)[number] }))}
                    >
                      {pieLabelChoices.map((x) => (
                        <option key={x} value={x}>
                          {pieLabelNames[x]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {linesControl}
                </div>
                <p className="ch-note">
                  The circle and the starting radius print at true size for protractor work. Sectors
                  run clockwise from the radius in table order. Labels that do not fit inside a sector
                  sit just outside the circle.
                </p>
              </section>
            )}
            {pictogram && (
              <section className="panel-card ch-panel">
                <h2>Pictogram</h2>
                <div className="ch-fields">
                  <label>
                    Symbol
                    <select
                      aria-label="Symbol"
                      value={pictogramOf(d).symbol}
                      disabled={blocked}
                      onChange={(ev) => patch((n) => void (n.pictogram = { ...pictogramOf(n), symbol: ev.target.value as (typeof symbolChoices)[number] }))}
                    >
                      {symbolChoices.map((x) => (
                        <option key={x} value={x}>
                          {symbolNames[x]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Symbol size (mm)
                    <select
                      aria-label="Symbol size"
                      value={pictogramOf(d).symbolMm}
                      disabled={blocked}
                      onChange={(ev) => patch((n) => void (n.pictogram = { ...pictogramOf(n), symbolMm: Number(ev.target.value) }))}
                    >
                      {Array.from({ length: SYMBOL_MM.maximum - SYMBOL_MM.minimum + 1 }, (_, i) => SYMBOL_MM.minimum + i).map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    One symbol represents
                    <DraftField
                      label="Key value"
                      value={pictogramOf(d).key.value}
                      maxLength={12}
                      inputMode="decimal"
                      invalid={g.issues.some((x) => x.startsWith("Enter what one symbol") || x.startsWith("The key value must"))}
                      disabled={blocked}
                      onCommit={(v) => patch((n) => void (n.pictogram = { ...pictogramOf(n), key: { ...pictogramOf(n).key, value: v } }))}
                    />
                  </label>
                  <label>
                    Unit (after the key value)
                    <DraftField
                      label="Key unit"
                      value={pictogramOf(d).unit}
                      maxLength={24}
                      disabled={blocked}
                      onCommit={(v) => patch((n) => void (n.pictogram = { ...pictogramOf(n), unit: v }))}
                    />
                  </label>
                  <label className="ch-check">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={pictogramOf(d).key.show === "hidden"}
                      onChange={(ev) =>
                        patch((n) => void (n.pictogram = { ...pictogramOf(n), key: { ...pictogramOf(n).key, show: ev.target.checked ? "hidden" : "show" } }))
                      }
                    />
                    Hide the key value (pupils complete the key)
                  </label>
                  <label>
                    Category column heading
                    <DraftField label="Category column heading" value={d.xTitle} maxLength={40} disabled={blocked} onCommit={(v) => patch((n) => void (n.xTitle = v))} />
                  </label>
                  <label>
                    Symbol column heading
                    <DraftField label="Symbol column heading" value={d.yTitle} maxLength={40} disabled={blocked} onCommit={(v) => patch((n) => void (n.yTitle = v))} />
                  </label>
                  {linesControl}
                </div>
                <p className="ch-note">
                  Part symbols are exact: part of a square is drawn open on its right, and part of a
                  circle is a sector (a half is the left half). Leave both headings empty for a table
                  without a heading row.
                </p>
              </section>
            )}
            {axisKind(d.kind) && (
            <section className="panel-card ch-panel">
              <h2>Axes and grid</h2>
              <div className="ch-fields">
                <label>
                  Axis start
                  <DraftField
                    label="Axis start"
                    value={d.axis.min}
                    maxLength={12}
                    inputMode="decimal"
                    disabled={blocked}
                    onCommit={(v) => patch((n) => void (n.axis.min = v))}
                  />
                </label>
                <label>
                  Axis end
                  <DraftField
                    label="Axis end"
                    value={d.axis.max}
                    maxLength={12}
                    inputMode="decimal"
                    disabled={blocked}
                    onCommit={(v) => patch((n) => void (n.axis.max = v))}
                  />
                </label>
                <label>
                  Step
                  <DraftField
                    label="Axis step"
                    value={d.axis.step}
                    maxLength={12}
                    inputMode="decimal"
                    disabled={blocked}
                    onCommit={(v) => patch((n) => void (n.axis.step = v))}
                  />
                </label>
                <label>
                  Grid
                  <select
                    aria-label="Grid"
                    value={d.grid}
                    disabled={blocked}
                    onChange={(ev) =>
                      patch(
                        (n) => void (n.grid = ev.target.value as Doc["grid"]),
                      )
                    }
                  >
                    {gridChoices.map((x) => (
                      <option key={x} value={x}>
                        {
                          {
                            none: "No grid",
                            major: "Lines at each step",
                            fine: "Graph paper",
                          }[x]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Small squares per step
                  <select
                    aria-label="Small squares per step"
                    value={d.axis.minor}
                    disabled={blocked || d.grid !== "fine"}
                    onChange={(ev) =>
                      patch(
                        (n) =>
                          void (n.axis.minor = Number(
                            ev.target.value,
                          ) as Doc["axis"]["minor"]),
                      )
                    }
                  >
                    {minorChoices.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Vertical axis title
                  <DraftField
                    label="Vertical axis title"
                    value={d.yTitle}
                    maxLength={40}
                    disabled={blocked}
                    onCommit={(v) => patch((n) => void (n.yTitle = v))}
                  />
                </label>
                <label>
                  Horizontal axis title
                  <DraftField
                    label="Horizontal axis title"
                    value={d.xTitle}
                    maxLength={40}
                    disabled={blocked}
                    onCommit={(v) => patch((n) => void (n.xTitle = v))}
                  />
                </label>
                {linesControl}
                <label>
                  Chart height (mm)
                  <select
                    aria-label="Chart height"
                    value={d.heightMm}
                    disabled={blocked}
                    onChange={(ev) =>
                      patch((n) => void (n.heightMm = Number(ev.target.value)))
                    }
                  >
                    {[
                      ...new Set([
                        40,
                        50,
                        60,
                        70,
                        80,
                        90,
                        100,
                        120,
                        140,
                        d.heightMm,
                      ]),
                    ]
                      .sort((a, b) => a - b)
                      .map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                  </select>
                </label>
                {!line && (
                  <label>
                    Bar width (mm)
                    <select
                      aria-label="Bar width"
                      value={d.barMm}
                      disabled={blocked}
                      onChange={(ev) =>
                        patch((n) => void (n.barMm = Number(ev.target.value)))
                      }
                    >
                      {[
                        ...new Set([
                          5,
                          6,
                          7,
                          8,
                          9,
                          10,
                          12,
                          14,
                          16,
                          20,
                          d.barMm,
                        ]),
                      ]
                        .sort((a, b) => a - b)
                        .map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="ch-check">
                  <input
                    type="checkbox"
                    disabled={blocked || series.length < 2}
                    checked={d.key}
                    onChange={(ev) =>
                      patch((n) => void (n.key = ev.target.checked))
                    }
                  />
                  Show key
                </label>
              </div>
            </section>
            )}
            <section className="panel-card ch-panel">
              <details>
                <summary>Editing and printing help</summary>
                <p className="ch-note">
                  Click a bar, line, sector or category label to edit its value in the
                  Data table. Enter applies; Escape restores. Switching chart
                  type keeps every data set. Pie charts draw sector angles from
                  the values; nothing else is calculated or filled in for you.
                </p>
                <p className="ch-note">
                  Copy for Word carries the physical size shown above the chart;
                  preview zoom never changes it. Download PNG (600 ppi) if your
                  browser blocks copying.
                </p>
              </details>
            </section>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card ch-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(
                  new Blob([recovery], { type: "application/json" }),
                  downloadName("charts", "json", { recovery: true }),
                );
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>
              Save current chart
            </button>
            <button
              disabled={!protectedCopy}
              onClick={() => {
                try {
                  if (!keepStored(recovery)) {
                    setRecovery(localStorage.getItem(STORAGE) ?? "");
                    setProtectedCopy(false);
                    setMessage(
                      "Saved data changed again. Download this latest copy first.",
                    );
                    return;
                  }
                  setRecovery(null);
                  setMessage("");
                } catch {
                  setMessage(
                    "Storage is unavailable. Keep your downloaded files.",
                  );
                }
              }}
            >
              Keep this chart and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this chart"
            onCancel={() => {
              consumeLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null) return;
              consumeLink();
              commit(pending.e, stepName(pending.title));
              setPending(null);
              setSelected(null);
              setView("pupil");
            }}
          >
            <p>{pending.explanation}</p>
            <div
              className="ratio-import-preview"
              dangerouslySetInnerHTML={{ __html: renderSvg(pending.e) }}
            />
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
