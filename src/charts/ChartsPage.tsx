import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { chartGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
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
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import "./charts.css";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:charts:v1");
type Doc = Envelope["document"];

function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return {
          e: create(),
          recovery: raw,
          message:
            "Saved chart data needs recovery. Download the original before starting afresh.",
        };
      }
    }
  } catch {
    return {
      e: create(),
      recovery: null,
      message:
        "Device storage is unavailable. Save an editable file to keep your work.",
    };
  }
  return { e: create(), recovery: null, message: "" };
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

export default function ChartsPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device"),
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
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit(
    (g.width * 96) / 25.4,
    (g.height * 96) / 25.4,
    zoom,
    (w) => (w < 500 ? 72 : 120),
  );
  const issue = g.issues.join(" ");
  const series = drawnSeries(e);
  const line = d.kind === "vline";

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
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(STORAGE),
        text = canonical(history.present);
      if (
        expected.current !== null &&
        raw !== expected.current &&
        raw !== text
      ) {
        setRecovery(raw ?? "");
        setProtectedCopy(false);
        setMessage(
          "A newer draft exists in another tab. Its saved data is protected.",
        );
        return;
      }
      localStorage.setItem(STORAGE, text);
      expected.current = text;
      setSaveState("Saved on this device");
    } catch {
      setSaveState("Save unavailable — download editable file");
    }
  }, [history.present, recovery]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE && event.newValue !== expected.current) {
        setRecovery(event.newValue ?? "");
        setProtectedCopy(false);
        setMessage(
          "Saved chart data changed in another tab. Download its data before replacing it.",
        );
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
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

  return (
    <div className="app-shell booklet-editor ch-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Bar and line charts"
          description="Make bar charts, dual and composite bar charts and vertical line charts on exam-style axes."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              redoLabel={redoStepName(history)}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replacement(create(), "Reset the chart?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(
                  () => copyWord(displayed),
                  "Copied for Word at " +
                    formatResourceSize(g.width / 10, g.height / 10) +
                    ". Paste with Ctrl+V.",
                )
              }
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(displayed)))
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
                svg: {
                  action: () => downloadImage(displayed, "svg"),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                png: {
                  action: () => downloadImage(displayed, "png"),
                  disabled: blocked || !!issue,
                  success: "PNG download started.",
                },
                pdf: {
                  action: () => downloadImage(displayed, "pdf"),
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
            <div className="ch-preview-bar">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
              <AnswerCopyToggle
                checked={view === "answer"}
                disabled={blocked}
                onChange={(checked) => setView(checked ? "answer" : "pupil")}
              />
            </div>
            <div className="ch-scroll" ref={fitted.ref}>
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
                    dangerouslySetInnerHTML={{ __html: renderSvg(displayed) }}
                  />
                  {g.targets.map((t) => {
                    const cell = d.series[t.series].values[t.category];
                    const id = `ch-value-${t.series}-${t.category}`;
                    const hiddenHere =
                      view === "pupil" &&
                      cell.show === "hidden" &&
                      cell.value.trim();
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`ch-hit ${selected === id ? "ch-selected" : ""} ${hiddenHere ? "ch-hidden-answer" : ""}`}
                        aria-label={`Edit ${line ? "line" : "bar"}: ${d.categories[t.category] || `category ${t.category + 1}`}${series.length > 1 ? `, ${d.series[t.series].name}` : ""}`}
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
                  {d.categories.map((c, i) => (
                    <button
                      key={`cat-${i}`}
                      type="button"
                      className={`ch-hit ${selected === `ch-cat-${i}` ? "ch-selected" : ""}`}
                      aria-label={`Edit category label ${c || i + 1}`}
                      disabled={blocked}
                      style={{
                        left: px(g.centres[i] - g.slot / 2, g.width),
                        top: px(g.labelY - 4, g.height),
                        width: px(g.slot, g.width),
                        height: px(5.5, g.height),
                      }}
                      onClick={() => focusField(`ch-cat-${i}`)}
                    />
                  ))}
                </div>
                <div
                  className="ch-structure"
                  role="group"
                  aria-label="Categories"
                >
                  <button
                    type="button"
                    disabled={blocked || d.categories.length >= MAX_CATEGORIES}
                    aria-label="Add a category at the end"
                    title="Add category"
                    onClick={() => {
                      commit(addCategory(e));
                      requestAnimationFrame(() =>
                        focusField(`ch-cat-${d.categories.length}`),
                      );
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={blocked || d.categories.length <= 1}
                    aria-label={`Remove the last category (${d.categories[d.categories.length - 1] || "unnamed"})`}
                    title="Remove last category"
                    onClick={() => commit(removeCategory(e))}
                  >
                    −
                  </button>
                </div>
              </div>
            </div>
            {(message || issue || g.notes.length > 0) && (
              <div className="ch-status" aria-live="polite">
                {message && (
                  <p className="resource-feedback" role="status">
                    {message}
                  </p>
                )}
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
                          {!line && (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ch-note">
                Leave a value blank for no {line ? "line" : "bar"}; 0 is a
                value. Hide keeps the value as a saved answer for pupils to
                draw.
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
            <section className="panel-card ch-panel">
              <details>
                <summary>Editing and printing help</summary>
                <p className="ch-note">
                  Click a bar, line or category label to edit its value in the
                  Data table. Enter applies; Escape restores. Switching chart
                  type keeps every data set. Nothing is calculated or filled in
                  for you.
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
                  "chart-recovery.json",
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
                  const raw = localStorage.getItem(STORAGE);
                  if (raw !== recovery) {
                    setRecovery(raw ?? "");
                    setProtectedCopy(false);
                    setMessage(
                      "Saved data changed again. Download this latest copy first.",
                    );
                    return;
                  }
                  expected.current = raw;
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
