import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { frequencyTreeGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { StructureStepper } from "../site/StructureStepper";
import { EditorHint } from "../site/EditorHint";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import {
  EditorDownloadMenu,
  type MenuKind,
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
  addLevel,
  addQuestion,
  addSibling,
  calculateQuestion,
  canonical,
  childrenOf,
  create,
  depthOf,
  fillCounts,
  forView,
  groupName,
  hasHidden,
  hideCounts,
  isLeaf,
  layout,
  MAX_CHILDREN,
  MAX_DEPTH,
  MAX_QUESTIONS,
  maxDepth,
  mergeNode,
  parseFile,
  questionValue,
  removeLastSibling,
  removeLevel,
  renderSvg,
  setCategory,
  showAll,
  splitNode,
  validate,
  type Envelope,
  type Label,
} from "../../packages/frequency-tree-core/src";
import { LINK_PREFIX, frequencyTreeLink, parseFrequencyTreeLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, openDraft, useDocumentHistory, useDraftAutosave, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../site/settings-kit.css";

const STORAGE = copyStorageKey("maths-booklet-tools:frequency-tree:v1");
type Doc = Envelope["document"];

/** A new tree starts from the house style's lines (U111). */
function fresh() {
  const e = create();
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
}
function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh, recoveryMessage: "Saved tree data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({
  id,
  label,
  value,
  onCommit,
  disabled,
  maxLength,
  className,
  inputMode,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  maxLength: number;
  className?: string;
  inputMode?: "numeric" | "text";
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

function HideBox({ label, value, disabled, onChange }: { label: string; value: Label; disabled: boolean; onChange: (hidden: boolean) => void }) {
  return (
    <label className="pt-hide" title="Hidden values are saved answers; pupils see an empty oval or line.">
      <input type="checkbox" aria-label={label} disabled={disabled} checked={value.show === "hidden"} onChange={(ev) => onChange(ev.target.checked)} />
      Hide
    </label>
  );
}

export default function FrequencyTreePage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(forView(e, "answer"));
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const depth = maxDepth(d);
  const selectedNode = d.nodes.find((b) => b.id === selected?.split(":")[1]) ?? null;

  function commit(next: Envelope | null, failure = "That change is not possible for this tree.", label?: string) {
    if (recovery !== null) return;
    if (!next) {
      setMessage(failure);
      return;
    }
    try {
      const valid = validate(next);
      documentHistory.commit(valid, label);
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  function patch(update: (n: Doc) => void) {
    if (blocked) return;
    const n = structuredClone(e);
    update(n.document);
    commit(n);
  }
  const setNodeLabel = (id: string, key: "category" | "count", change: Partial<Label>) =>
    patch((n) => {
      const b = n.nodes.find((x) => x.id === id);
      if (b) Object.assign(b[key], change);
    });
  function undo() {
    if (blocked) return;
    documentHistory.undo();
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
  }
  function replace(next: Envelope, title: string, explanation = "This replaces the current tree. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  function focusField(id: string) {
    requestAnimationFrame(() => {
      const field = document.getElementById(id) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
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
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its saved data is protected." : "Saved tree data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseFrequencyTreeLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked tree?");
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
      if (upload.size > 30000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this tree?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;
  const name = (id: string) => groupName(d, id);
  const fieldId = (key: string, id: string) => `ft-${key}-${id}`;
  const letter = (i: number) => String.fromCharCode(97 + i);

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), undefined, TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), undefined, WORKED_STEP) });
  return (
    <div className="app-shell booklet-editor pt-editor ft-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Frequency trees" description="Draw exam-style frequency trees with a total, groups and counts left for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={frequencyTreeGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                  onWorked={(resource) => commit(resource, undefined, "use worked version")}
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
              onReset={() => replace(fresh(), "Reset the tree?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(displayed, view === "answer"), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed, view === "answer")))}
              menuId="ftree-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="ftree-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                about: titleNote.item,
                worked: worked.item,
                both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                svg: { action: () => downloadImage(displayed, "svg", view === "answer"), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(displayed, "png", view === "answer"), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(displayed, "pdf", view === "answer"), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: {
                  action: () => navigator.clipboard.writeText(frequencyTreeLink(e, location.href)),
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
            <div className="pt-scroll editor-stage" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  className="pt-resource"
                  data-testid="frequency-tree-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.targets.map((t) => {
                    const id = t.kind === "total" ? "ft-total" : fieldId(t.kind, t.id);
                    const b = d.nodes.find((x) => x.id === t.id);
                    const qi = d.questions.findIndex((q) => q.id === t.id);
                    const l = t.kind === "total" ? d.total : t.kind === "answer" ? d.questions[qi]?.answer : t.kind === "count" ? b?.count : b?.category;
                    const hiddenHere = view === "pupil" && l?.show === "hidden";
                    const what =
                      t.kind === "total"
                        ? "total"
                        : t.kind === "answer"
                          ? `answer to question (${letter(qi)})`
                          : `${t.kind === "count" ? "count" : "group name"} for ${b ? name(b.id) : ""}`;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`pt-hit ${selected === `${t.kind}:${t.id}` ? "pt-selected" : ""} ${hiddenHere ? "pt-hidden-answer" : ""}`}
                        aria-label={`Edit ${what}`}
                        title={hiddenHere ? "Hidden answer (pupils fill this in)" : undefined}
                        disabled={blocked}
                        style={{ left: px(t.x, g.width), top: px(t.y, g.height), width: px(t.width, g.width), height: px(t.height, g.height) }}
                        onClick={() => {
                          setSelected(`${t.kind}:${t.id}`);
                          focusField(id);
                        }}
                      />
                    );
                  })}
                </div>
                <StructureStepper
                 
                  vertical
                  name="Levels"
                  caption=""
                  add={{
                    label: "Split every first-level group into a second level",
                    title: "Add level",
                    disabled: blocked || depth >= MAX_DEPTH,
                    onClick: () => commit(addLevel(e)),
                  }}
                  remove={{
                    label: "Remove the second level",
                    title: "Remove level",
                    disabled: blocked || depth <= 1,
                    onClick: () => commit(removeLevel(e)),
                  }}
                />
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="frequency-tree">
                  Click an oval or a name on the tree to edit it. Enter applies;
                  Escape restores.
                </EditorHint>
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
          <aside className="inspector-stack md-kit" aria-label="Frequency tree settings">
            <ReturnToDiagram />
            <div className="md-kit-cards">
            <div>
            {selectedNode && (
              <section className="panel-card pt-panel" aria-label="Selected group">
                <h2>Group: {name(selectedNode.id)}</h2>
                <div className="pt-row">
                  {isLeaf(d, selectedNode.id) ? (
                    <button type="button" disabled={blocked || depthOf(d, selectedNode.id) >= MAX_DEPTH} onClick={() => commit(splitNode(e, selectedNode.id))}>
                      Split this group
                    </button>
                  ) : (
                    <button type="button" disabled={blocked} onClick={() => commit(mergeNode(e, selectedNode.id))}>
                      End the path here
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={blocked || childrenOf(d, selectedNode.parent).length >= MAX_CHILDREN}
                    onClick={() => commit(addSibling(e, selectedNode.parent))}
                  >
                    Add a branch beside it
                  </button>
                  <button
                    type="button"
                    disabled={blocked || childrenOf(d, selectedNode.parent).length <= 2}
                    onClick={() => {
                      commit(removeLastSibling(e, selectedNode.parent));
                      setSelected(null);
                    }}
                  >
                    Remove the last branch here
                  </button>
                </div>
              </section>
            )}
            <section className="panel-card pt-panel">
              <h2>Total and groups</h2>
              <div className="pt-branches">
                <div className={`pt-branch ${selected?.startsWith("total") ? "pt-current" : ""}`}>
                  <span className="pt-note">Total</span>
                  <span>
                    <DraftField
                      id="ft-total"
                      className={selected === "total:total" ? "pt-field-selected" : ""}
                      label="Total"
                      value={d.total.text}
                      maxLength={12}
                      inputMode="numeric"
                      disabled={blocked}
                      onCommit={(v) => patch((n) => void (n.total.text = v))}
                    />
                    <HideBox label="Hide the total for pupils" value={d.total} disabled={blocked} onChange={(h) => patch((n) => void (n.total.show = h ? "hidden" : "show"))} />
                  </span>
                  <span />
                </div>
                {d.nodes.map((b) => {
                  const k = depthOf(d, b.id);
                  return (
                    <div
                      key={b.id}
                      className={`pt-branch ${selectedNode?.id === b.id ? "pt-current" : ""}`}
                      style={{ paddingLeft: k * 14 }}
                      onFocus={() => setSelected((s) => (s?.endsWith(":" + b.id) ? s : `category:${b.id}`))}
                    >
                      <span>
                        <DraftField
                          id={fieldId("category", b.id)}
                          className={selected === `category:${b.id}` ? "pt-field-selected" : ""}
                          label={`Group name for ${name(b.id)}`}
                          value={b.category.text}
                          maxLength={30}
                          disabled={blocked}
                          onCommit={(v) => commit(setCategory(e, b.id, v))}
                        />
                        <HideBox label={`Hide group name ${name(b.id)} for pupils`} value={b.category} disabled={blocked} onChange={(h) => setNodeLabel(b.id, "category", { show: h ? "hidden" : "show" })} />
                      </span>
                      <span>
                        <DraftField
                          id={fieldId("count", b.id)}
                          className={selected === `count:${b.id}` ? "pt-field-selected" : ""}
                          label={`Count for ${name(b.id)}`}
                          value={b.count.text}
                          maxLength={12}
                          inputMode="numeric"
                          disabled={blocked}
                          onCommit={(v) => setNodeLabel(b.id, "count", { text: v })}
                        />
                        <HideBox label={`Hide count for ${name(b.id)}`} value={b.count} disabled={blocked} onChange={(h) => setNodeLabel(b.id, "count", { show: h ? "hidden" : "show" })} />
                      </span>
                      <span className="pt-note">{isLeaf(d, b.id) ? "end" : ""}</span>
                    </div>
                  );
                })}
              </div>
              <p className="pt-note">
                Hide keeps a count as a saved answer and leaves its oval empty for pupils. An empty count is a blank oval with no
                answer. Click an oval or a name on the tree to select it and change the tree's shape.
              </p>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.linkLabels} onChange={(ev) => patch((n) => void (n.linkLabels = ev.target.checked))} />
                Same group names across each level
              </label>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={() => commit(hideCounts(e))}>
                  Hide all counts except the total
                </button>
                <button type="button" disabled={blocked} onClick={() => commit(hideCounts(e, false))}>
                  Hide every count
                </button>
                <button type="button" disabled={blocked || !hasHidden(e)} onClick={() => commit(showAll(e))}>
                  Show all
                </button>
              </div>
            </section>
            </div>
            <div>
            <section className="panel-card pt-panel">
              <h2>Work out counts</h2>
              <p className="pt-note">
                Fills empty counts that follow from the others: a group is the sum of its branches, and one empty branch is its group
                minus the rest. Nothing is filled until you press the button, and it can be undone. Filled counts keep their Hide setting.
              </p>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    const r = fillCounts(e);
                    if (r.filled) commit(r.envelope);
                    else setMessage("No empty count follows from the others yet. Enter more counts first.");
                  }}
                >
                  Work out missing counts
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Questions</h2>
              <p className="pt-note">
                Questions print below the tree with an answer line. To calculate a probability, tick the groups for the top and, if it
                is not the total, the bottom of the fraction.
              </p>
              {d.questions.map((q, qi) => {
                const value = questionValue(d, q);
                return (
                  <div key={q.id} className="pt-question">
                    <label>
                      Question ({letter(qi)})
                      <DraftField label={`Question ${qi + 1} text`} value={q.text} maxLength={60} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].text = v))} />
                    </label>
                    <span>
                      <DraftField id={fieldId("answer", q.id)} label={`Answer to question ${qi + 1}`} value={q.answer.text} maxLength={24} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].answer.text = v))} />
                      <HideBox label={`Hide answer to question ${qi + 1}`} value={q.answer} disabled={blocked} onChange={(h) => patch((n) => void (n.questions[qi].answer.show = h ? "hidden" : "show"))} />
                    </span>
                    <details>
                      <summary>Groups for calculating</summary>
                      <div className="pt-paths">
                        <span>Group</span>
                        <span>Top</span>
                        <span>Bottom</span>
                        {d.nodes.map((b) => (
                          <GroupRow
                            key={b.id}
                            name={name(b.id)}
                            top={q.numerator.includes(b.id)}
                            bottom={q.denominator.includes(b.id)}
                            disabled={blocked}
                            onChange={(part, on) =>
                              patch((n) => {
                                const list = n.questions[qi][part];
                                n.questions[qi][part] = on ? [...list, b.id] : list.filter((x) => x !== b.id);
                              })
                            }
                          />
                        ))}
                      </div>
                      <p className="pt-note">With no bottom groups ticked, the bottom is the total.</p>
                    </details>
                    <div className="pt-row">
                      <button type="button" disabled={blocked || !value} onClick={() => commit(calculateQuestion(e, q.id), "Every chosen group needs a whole-number count.")}>
                        Calculate answer
                      </button>
                      <button type="button" disabled={blocked} onClick={() => patch((n) => void n.questions.splice(qi, 1))}>
                        Remove question
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="pt-row">
                <button type="button" disabled={blocked || d.questions.length >= MAX_QUESTIONS} onClick={() => commit(addQuestion(e, "P( ) ="))}>
                  Add question
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Layout</h2>
              <div className="pt-fields">
                <label>
                  Group names
                  <select aria-label="Group names" value={d.labelPlace} disabled={blocked} onChange={(ev) => patch((n) => void (n.labelPlace = ev.target.value as Doc["labelPlace"]))}>
                    <option value="branch">On the branches</option>
                    <option value="node">Beside the ovals</option>
                  </select>
                </label>
                <label>
                  Shape
                  <select aria-label="Shape" value={d.nodeShape} disabled={blocked} onChange={(ev) => patch((n) => void (n.nodeShape = ev.target.value as Doc["nodeShape"]))}>
                    <option value="oval">Ovals</option>
                    <option value="box">Boxes</option>
                  </select>
                </label>
                <label>
                  Lines
                  <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight))}>
                    {LINE_WEIGHTS.map((v) => (
                      <option key={v} value={v}>
                        {LINE_WEIGHT_NAMES[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Branch length (mm)
                  <select aria-label="Branch length" value={d.branchMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.branchMm = Number(ev.target.value)))}>
                    {[...new Set([24, 28, 30, 34, 38, 42, 46, 50, 55, 60, d.branchMm])].sort((a, b) => a - b).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Spacing (mm)
                  <select aria-label="Spacing" value={d.gapMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.gapMm = Number(ev.target.value)))}>
                    {[...new Set([14, 16, 18, 20, 22, 24, 27, 30, d.gapMm])].sort((a, b) => a - b).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  Click an oval or a name on the tree to edit it. Enter applies; Escape restores. A group can split into 2 or 3 branches,
                  and paths can stop after the first level: select a group and choose Split this group or End the path here. Nothing is
                  calculated or filled in for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the tree; preview zoom never changes it. Download PNG (600 ppi) if
                  your browser blocks copying.
                </p>
              </details>
            </section>
            </div>
            </div>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("frequency-tree", "json", { recovery: true }));
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current tree</button>
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
              Keep this tree and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this tree"
            onCancel={() => {
              consumeLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null) return;
              consumeLink();
              commit(pending.e, undefined, stepName(pending.title));
              setPending(null);
              setSelected(null);
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

function GroupRow({
  name,
  top,
  bottom,
  disabled,
  onChange,
}: {
  name: string;
  top: boolean;
  bottom: boolean;
  disabled: boolean;
  onChange: (part: "numerator" | "denominator", on: boolean) => void;
}) {
  return (
    <>
      <span>{name}</span>
      <input type="checkbox" aria-label={`${name} is in the top`} checked={top} disabled={disabled} onChange={(ev) => onChange("numerator", ev.target.checked)} />
      <input type="checkbox" aria-label={`${name} is in the bottom`} checked={bottom} disabled={disabled} onChange={(ev) => onChange("denominator", ev.target.checked)} />
    </>
  );
}
