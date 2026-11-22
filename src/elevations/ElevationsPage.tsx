import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { elevationsGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu, type MenuKind } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { EditorHint } from "../site/EditorHint";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  canonical,
  create,
  cubeCount,
  DEFAULT_LABELS,
  flatView,
  layout,
  MAX_HEIGHT,
  MAX_PANELS,
  MAX_SIDE,
  panel as makePanel,
  parseFile,
  renderSvg,
  validate,
  VIEWS,
  type Envelope,
  type Panel as ViewPanel,
  type ViewKind,
} from "../../packages/elevation-core/src";
import { LINK_PREFIX, parseElevationsLink, elevationsLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { openDraft, useDraftAutosave, handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "./elevations.css";
import "../site/settings-kit.css";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { OptionsBox } from "../site/OptionsBox";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { PupilSpaceHint } from "../site/LabelTargets";
import { useCoarsePointer } from "../site/labelTargetHooks";
import { commonVisibility, TARGET_TIP, TARGET_TIP_SPACE, togglePupilSpace, visibilityStep, visibilityWords, type Visibility } from "../editor-kit/visibility";
import { Boxes, Eye, LayoutGrid, Printer } from "lucide-react";

const STORAGE = copyStorageKey("maths-booklet-tools:elevations:v1");
type Doc = Envelope["document"];
type View = "pupil" | "answer";
const VIEW_NAMES: Record<ViewKind, string> = { isometric: "Isometric drawing", plan: "Plan", front: "Front elevation", side: "Side elevation" };
/**
 * What pupils see of a panel (wave 1d, 22 Nov 2026): Show draws it on both copies; Pupil space is an empty grid
 * for pupils, drawn on the answers copy; Leave out is an empty grid on both copies (no answer).
 */
const PANEL_VISIBILITY: Record<ViewPanel["state"], Visibility> = { drawn: "show", answer: "hidden", blank: "omit" };
const PANEL_STATE: Record<Visibility, ViewPanel["state"]> = { show: "drawn", hidden: "answer", omit: "blank" };
/** A panel's own words: Pupil space and Leave out both print an empty grid for pupils. */
const PANEL_HELP = { hidden: "An empty grid for pupils. The answers copy draws the view.", omit: "An empty grid on both copies, with no answer." };

function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh: create, recoveryMessage: "Saved views data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({ id, label, value, onCommit, disabled, maxLength = 40, inputMode, className, onHistory }: {
  /** With nothing typed, Ctrl+Z / Ctrl+Y go to the diagram's undo; return true when handled. */
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
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
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (draft === value && onHistory?.(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        // Escape undoes typing; with nothing typed it passes on, so it closes the options box.
        if (ev.key === "Escape" && draft !== value) {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}


export default function ElevationsPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<View>("pupil"),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const stackRef = useMoreBelow<HTMLElement>(),
    coarse = useCoarsePointer();
  const e = history.present,
    d = e.document,
    g = layout(e, view),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(e, "answer");
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const rows = d.heights.length,
    cols = d.heights[0].length;
  const current = selected !== null && selected < d.panels.length ? selected : null;
  const spaceCount = d.panels.filter((q) => q.state === "answer").length + d.panels.filter((q) => q.label.show === "hidden").length;
  // The box closes when its panel goes (a removal, an undo).
  useEffect(() => {
    if (boxAnchor && (current === null || !boxAnchor.isConnected)) setBoxAnchor(null);
  }, [boxAnchor, current]);
  const panelName = (i: number) => `panel ${i + 1} (${VIEW_NAMES[d.panels[i].view].toLowerCase()})`;

  function commit(next: Envelope | null | (() => Envelope), label?: string) {
    if (recovery !== null || !next) return false;
    try {
      const valid = validate(typeof next === "function" ? next() : next);
      documentHistory.commit(valid, label);
      setMessage("");
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return false;
    }
  }
  function patch(update: (n: Doc) => void, label?: string) {
    if (blocked) return;
    const n = structuredClone(e);
    update(n.document);
    commit(n, label);
  }
  function setPanel(i: number, update: (p: ViewPanel) => void, label?: string) {
    patch((n) => update(n.panels[i]), label);
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current views. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
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
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its saved data is protected." : "Saved data changed in another tab. Download its data before replacing it.");
    },
  });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (handleUndoKeys(event, { undo, redo })) return;
      if (event.key === "Escape" && current !== null && !boxAnchor) setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function run(action: () => Promise<void>, success = "Image copied. Paste with Ctrl+V.") {
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
      if (!location.hash.startsWith(LINK_PREFIX) || linkSeen.current === location.href || blocked) return;
      linkSeen.current = location.href;
      try {
        const incoming = parseElevationsLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked views?");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  function consumeLink() {
    if (linkPending.current && location.hash.startsWith(LINK_PREFIX)) window.history.replaceState(null, "", location.pathname + location.search);
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 200000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open these views?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  function setHeight(r: number, c: number, h: number) {
    if (d.heights[r][c] === h) return;
    if (h === 0 && cubeCount(d) === d.heights[r][c]) return setMessage("The solid needs at least one cube.");
    patch((n) => void (n.heights[r][c] = h), `set height to ${h}`);
  }
  /** Rows grow at the back and columns on the right, so the front and left edges stay where they are. */
  function resize(dr: number, dc: number) {
    patch((n) => {
      if (dr > 0) n.heights.push(Array(cols).fill(0));
      if (dr < 0) n.heights.pop();
      if (dc > 0) for (const row of n.heights) row.push(0);
      if (dc < 0) for (const row of n.heights) row.pop();
    }, dr > 0 ? "add a row" : dr < 0 ? "remove the back row" : dc > 0 ? "add a column" : "remove the right column");
  }
  function addPanel(kind: ViewKind) {
    if (d.panels.length >= MAX_PANELS) return setMessage(`Use at most ${MAX_PANELS} panels.`);
    patch((n) => void n.panels.push(makePanel(kind, "answer")), `add ${VIEW_NAMES[kind].toLowerCase()}`);
  }
  /** What pupils see of one panel's drawing: one undo step. */
  function setVisibility(i: number, v: Visibility) {
    return setPanel(i, (q) => void (q.state = PANEL_STATE[v]), visibilityStep(v, panelName(i)));
  }
  function movePanel(i: number, by: number) {
    patch((n) => {
      const [p] = n.panels.splice(i, 1);
      n.panels.splice(i + by, 0, p);
    }, "move panel");
    // The box follows the panel it was editing to its new place.
    setSelected(i + by);
    const hit = document.querySelectorAll<HTMLElement>(".ev-hit")[i + by];
    if (boxAnchor && hit) setBoxAnchor(hit);
  }
  function changeView(i: number, kind: ViewKind) {
    setPanel(i, (p) => {
      if (p.label.text === DEFAULT_LABELS[p.view]) p.label.text = DEFAULT_LABELS[kind];
      p.view = kind;
    }, "change view");
  }

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  return (
    <div className="app-shell booklet-editor pt-editor ev-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Plans and elevations" description="Build a solid from cubes and print its isometric drawing, plan and elevations, with blank grids for pupils to draw on.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={elevationsGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                  onWorked={(resource) => commit(resource, "use worked version")}
                />
              }
              answers={<AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />}
              canUndo={!blocked && history.past.length > 0}
              undoLabel={undoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              redoLabel={redoStepName(history)}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(create(), "Reset the views?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="elevations-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="elevations-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                about: titleNote.item,
                worked: worked.item,
                both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                svg: { action: () => downloadImage(e, "svg", view), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(e, "png", view), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(e, "pdf", view), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: { action: () => navigator.clipboard.writeText(elevationsLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
            <div className="pt-scroll editor-stage" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  className="pt-resource"
                  data-testid="elevations-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(e, view), e, view === "answer") }} />
                  {g.placed.map(({ x, y, p: q, b }, i) => {
                    const pxPerMm = (96 / 25.4) * fitted.scale,
                      words = visibilityWords(PANEL_VISIBILITY[q.state]);
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ev-hit${current === i ? " ev-current" : ""}`}
                        style={{ left: (x + g.margin) * pxPerMm, top: (y + g.margin) * pxPerMm, width: b.width * pxPerMm, height: (b.height + (q.label.text.trim() ? 6 : 0)) * pxPerMm }}
                        aria-label={`Edit ${panelName(i)}${words ? `, ${words}` : ""}`}
                        aria-pressed={current === i}
                        aria-haspopup="dialog"
                        data-options-anchor=""
                        title={q.state === "answer" ? TARGET_TIP_SPACE : TARGET_TIP}
                        disabled={blocked}
                        onClick={(ev) => {
                          setSelected(i);
                          setBoxAnchor(ev.currentTarget);
                        }}
                        onDoubleClick={() => setVisibility(i, togglePupilSpace(PANEL_VISIBILITY[q.state]))}
                      />
                    );
                  })}
                </div>
                {boxAnchor && current !== null && (() => {
                  const i = current,
                    q = d.panels[i];
                  const fit = q.view === "isometric" ? null : flatView(d, q.view);
                  return (
                    <OptionsBox anchor={boxAnchor} anchorKey={String(i)} focusField={!coarse} title={`Panel ${i + 1}: ${VIEW_NAMES[q.view]}`} onClose={() => setBoxAnchor(null)}>
                      <VisibilitySwitch name="What pupils see" caption="What pupils see" help={PANEL_HELP} value={PANEL_VISIBILITY[q.state]} disabled={blocked} onChange={(v) => setVisibility(i, v)} />
                      <div className="pt-fields">
                        <label>
                          Label
                          <DraftField label={`Panel ${i + 1} label`} onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })} value={q.label.text} disabled={blocked} onCommit={(v) => setPanel(i, (x) => void (x.label.text = v), "edit label")} />
                        </label>
                        <label>
                          View
                          <select aria-label={`Panel ${i + 1} view`} value={q.view} disabled={blocked} onChange={(ev) => changeView(i, ev.target.value as ViewKind)}>
                            {VIEWS.map((v) => (
                              <option key={v} value={v}>
                                {VIEW_NAMES[v]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {q.view !== "isometric" && q.state !== "drawn" && (
                          <label>
                            Grid size
                            <select
                              aria-label={`Panel ${i + 1} grid size`}
                              value={q.squares.across ? `${q.squares.across}x${q.squares.up}` : "fit"}
                              disabled={blocked}
                              onChange={(ev) =>
                                setPanel(i, (x) => {
                                  const [a, u] = ev.target.value === "fit" ? [0, 0] : ev.target.value.split("x").map(Number);
                                  x.squares = { across: a, up: u };
                                }, "change grid size")
                              }
                            >
                              <option value="fit">Fit the view, one square spare</option>
                              {[4, 6, 8, 10]
                                .concat(q.squares.across || [])
                                .filter((v, k, a) => a.indexOf(v) === k)
                                .sort((a, b) => a - b)
                                .map((v) => (
                                  <option key={v} value={`${v}x${q.squares.up && q.squares.across === v ? q.squares.up : v}`}>
                                    {v} by {q.squares.up && q.squares.across === v ? q.squares.up : v} squares
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                      </div>
                      {fit && q.state !== "drawn" && q.squares.across > 0 && (q.squares.across < fit.across || q.squares.up < fit.up) && (
                        <p className="pt-note">This grid is smaller than the view ({fit.across} by {fit.up} squares).</p>
                      )}
                      <label className="pt-hide">
                        <input type="checkbox" disabled={blocked || !q.label.text.trim()} checked={q.label.show === "hidden"} onChange={(ev) => setPanel(i, (x) => void (x.label.show = ev.target.checked ? "hidden" : "show"), "hide label")} />
                        Hide the label for pupils
                      </label>
                      <p className="pt-note">Pupil space: an empty grid for pupils, drawn on the answers copy. Leave out: an empty grid on both copies.</p>
                      <div className="md-options-actions">
                        <button type="button" aria-label={`Move panel ${i + 1} earlier`} disabled={blocked || i === 0} onClick={() => movePanel(i, -1)}>
                          Earlier
                        </button>
                        <button type="button" aria-label={`Move panel ${i + 1} later`} disabled={blocked || i === d.panels.length - 1} onClick={() => movePanel(i, 1)}>
                          Later
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove panel ${i + 1}`}
                          disabled={blocked || d.panels.length <= 1}
                          onClick={() => {
                            patch((n) => void n.panels.splice(i, 1), "remove panel");
                            setBoxAnchor(null);
                            setSelected(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </OptionsBox>
                  );
                })()}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="elevations">Click a panel to change it. Double-click it for a pupil space. Change the solid in the settings.</EditorHint>
              }
            >
            </EditorFoot>
            {(issue || g.notes.length > 0) && (
              <div className="pt-status" aria-live="polite">
                {g.issues.map((x) => (
                  <p key={x} className="pt-error" role="alert">
                    {x}
                  </p>
                ))}
                {g.notes.map((x) => (
                  <p key={x}>Teacher note: {x}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Plans and elevations settings">
            <ReturnToDiagram />
            {/* One column (the usability rollout, 22 Nov 2026): the main cards open, the rarer groups folded. */}
            <FoldCard
              tool="elevations"
              title="What pupils see"
              icon={Eye}
              defaultOpen
              summary={spaceCount === 0 ? "No pupil spaces" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
              help={<p className="pt-note">Show: the view is drawn on both copies. Pupil space: an empty grid for pupils, drawn on the answers copy. Leave out: an empty grid on both copies, with no answer.</p>}
            >
              {(() => {
                const all = commonVisibility(d.panels.map((q) => PANEL_VISIBILITY[q.state]));
                return (
                  all && (
                    <VisibilitySwitch
                      name="Panels"
                      caption="Panels"
                      help={PANEL_HELP}
                      value={all}
                      disabled={blocked}
                      onChange={(v) => patch((n) => n.panels.forEach((q) => (q.state = PANEL_STATE[v])), visibilityStep(v, "all panels"))}
                    />
                  )
                );
              })()}
              <PupilSpaceHint
                count={spaceCount}
                disabled={blocked}
                onClear={() =>
                  patch((n) => {
                    for (const q of n.panels) {
                      if (q.state === "answer") q.state = "drawn";
                      q.label.show = "show";
                    }
                  }, "show all")
                }
              >
                Double-click a panel for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard tool="elevations" title="The solid" icon={Boxes} defaultOpen summary={`${cubeCount(d)} cubes`}>
              <p className="pt-note">Seen from above: each square is a stack of cubes. The front of the solid is at the bottom of this grid.</p>
              <table className="ev-heights">
                <tbody>
                  {d.heights
                    .map((row, r) => (
                      <tr key={r}>
                        {row.map((h, c) => (
                          <td key={c}>
                            <select
                              aria-label={`Cubes in row ${r + 1} from the front, column ${c + 1} from the left`}
                              className={h ? "ev-filled" : ""}
                              value={h}
                              disabled={blocked}
                              onChange={(ev) => setHeight(r, c, Number(ev.target.value))}
                            >
                              {Array.from({ length: MAX_HEIGHT + 1 }, (_, v) => (
                                <option key={v} value={v}>
                                  {v || "·"}
                                </option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))
                    .reverse()}
                </tbody>
              </table>
              <p className="pt-note">Front</p>
              <div className="pt-row">
                <button type="button" disabled={blocked || rows >= MAX_SIDE} onClick={() => resize(1, 0)}>
                  Add a row at the back
                </button>
                <button type="button" disabled={blocked || rows <= 1} onClick={() => resize(-1, 0)}>
                  Remove the back row
                </button>
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked || cols >= MAX_SIDE} onClick={() => resize(0, 1)}>
                  Add a column on the right
                </button>
                <button type="button" disabled={blocked || cols <= 1} onClick={() => resize(0, -1)}>
                  Remove the right column
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="elevations"
              title="Panels"
              icon={LayoutGrid}
              defaultOpen
              summary={`${d.panels.length} panel${d.panels.length === 1 ? "" : "s"}`}
              help={<p className="pt-note">Panels print left to right in this order. Click a panel on the drawing, or its name here, to change it.</p>}
            >
              <div className="pt-row fig-row">
                {d.panels.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-haspopup="dialog"
                    data-options-anchor=""
                    aria-pressed={current === i}
                    disabled={blocked}
                    onClick={(ev) => {
                      setSelected(i);
                      setBoxAnchor(ev.currentTarget);
                    }}
                  >
                    {i + 1}. {VIEW_NAMES[q.view]}
                  </button>
                ))}
              </div>
              <div className="pt-row">
                {VIEWS.map((v) => (
                  <button key={v} type="button" disabled={blocked || d.panels.length >= MAX_PANELS} onClick={() => addPanel(v)}>
                    Add {VIEW_NAMES[v].toLowerCase()}
                  </button>
                ))}
              </div>
            </FoldCard>
            <FoldCard
              tool="elevations"
              title="Printing"
              icon={Printer}
              summary={`${d.unitCm} cm cubes`}
              help={
                <>
                  <p className="pt-note">
                    Plans and elevations follow the exam convention: the outline, with a line wherever the solid steps in height or depth. A blank
                    isometric panel is plain space for pupils to sketch the solid, as in the papers.
                  </p>
                  <p className="pt-note">
                    Copy for Word carries the physical size shown above the drawing; preview zoom never changes it. Download PNG (600 ppi) or
                    PDF if your browser blocks copying, and print at 100% (actual size).
                  </p>
                </>
              }
            >
              <div className="pt-fields">
                <label>
                  Cube edge on the grids
                  <select aria-label="Cube edge on the grids" value={d.unitCm} disabled={blocked} onChange={(ev) => patch((n) => void (n.unitCm = Number(ev.target.value) as Doc["unitCm"]))}>
                    <option value={0.5}>0.5 cm</option>
                    <option value={1}>1 cm</option>
                    <option value={2}>2 cm</option>
                  </select>
                </label>
                <label>
                  Widest row (cm)
                  <select aria-label="Widest row of panels" value={d.maxWidthCm} disabled={blocked} onChange={(ev) => patch((n) => void (n.maxWidthCm = Number(ev.target.value)))}>
                    {Array.from({ length: 20 }, (_, k) => k + 8).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.arrows} onChange={(ev) => patch((n) => void (n.arrows = ev.target.checked))} />
                Front and Side arrows on the isometric drawing
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.isoDots} onChange={(ev) => patch((n) => void (n.isoDots = ev.target.checked))} />
                Isometric dots behind the drawing
              </label>
            </FoldCard>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("elevations", "json", { recovery: true }));
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current views</button>
            <button
              disabled={!protectedCopy}
              onClick={() => {
                try {
                  if (!keepStored(recovery)) {
                    setRecovery(localStorage.getItem(STORAGE) ?? "");
                    setProtectedCopy(false);
                    setMessage("Saved data changed again. Download this latest copy first.");
                    return;
                  }
                  setRecovery(null);
                  setMessage("");
                } catch {
                  setMessage("Storage is unavailable. Keep your downloaded files.");
                }
              }}
            >
              Keep these views and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use these views"
            onCancel={() => {
              consumeLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null) return;
              consumeLink();
              commit(pending.e, stepName(pending.title));
              setPending(null);
              setView("pupil");
            }}
          >
            <p>{pending.explanation}</p>
            <div className="ratio-import-preview" dangerouslySetInnerHTML={{ __html: renderSvg(pending.e) }} />
          </RatioDialog>
        )}
      </main>
    </div>
  );
}
