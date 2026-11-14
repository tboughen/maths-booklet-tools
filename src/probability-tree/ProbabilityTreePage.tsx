import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { treeGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
import { StructureStepper } from "../site/StructureStepper";
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
  addQuestion,
  addSibling,
  addStage,
  calculateQuestion,
  canonical,
  childrenOf,
  create,
  depthOf,
  extendBranch,
  fillComplements,
  fillEnd,
  fillFromBag,
  fitBranchLength,
  forView,
  hasHidden,
  isLeaf,
  layout,
  leaves,
  MAX_CHILDREN,
  MAX_DEPTH,
  MAX_QUESTIONS,
  maxDepth,
  parseFile,
  pathName,
  pruneBranch,
  questionValue,
  minimumBranches,
  removeLastSibling,
  removeStage,
  renderSvg,
  setAllShown,
  setOutcome,
  validate,
  type Branch,
  type Envelope,
  type Label,
} from "../../packages/probability-tree-core/src";
import { parseTreeLink, treeEditorLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng } from "./export";
import "./probability-tree.css";
import { handleUndoKeys, useDocumentHistory } from "../editor-kit";

const STORAGE = copyStorageKey("maths-booklet-tools:probability-tree:v1");
type Doc = Envelope["document"];
type LabelKey = "outcome" | "probability" | "endOutcome" | "endProbability";

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
          message: "Saved tree data needs recovery. Download the original before starting afresh.",
        };
      }
    }
  } catch {
    return { e: create(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: create(), recovery: null, message: "" };
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
  inputMode?: "decimal" | "text";
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
    <label className="pt-hide" title="Hidden values are saved answers; pupils see a space.">
      <input type="checkbox" aria-label={label} disabled={disabled} checked={value.show === "hidden"} onChange={(ev) => onChange(ev.target.checked)} />
      Hide
    </label>
  );
}

export default function ProbabilityTreePage({ active = true }: { active?: boolean }) {
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
    [bag, setBag] = useState("5, 3"),
    [replacement, setReplacementMode] = useState(false),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const issue = g.issues.join(" ");
  const depth = maxDepth(d);
  const paths = leaves(d);
  const selectedBranch = d.branches.find((b) => b.id === selected?.split(":")[1]) ?? null;

  function commit(next: Envelope | null, failure = "That change is not possible for this tree.") {
    if (recovery !== null) return;
    if (!next) {
      setMessage(failure);
      return;
    }
    try {
      const valid = validate(next);
      documentHistory.commit(valid);
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
  const setLabel = (id: string, key: LabelKey, change: Partial<Label>) =>
    patch((n) => {
      const b = n.branches.find((x) => x.id === id);
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
    setSelected(id);
    requestAnimationFrame(() => {
      const field = document.getElementById(id) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    });
  }

  // Autosave with protection for another tab's newer draft.
  useEffect(() => {
    if (recovery !== null) return;
    try {
      const raw = localStorage.getItem(STORAGE),
        text = canonical(history.present);
      if (expected.current !== null && raw !== expected.current && raw !== text) {
        setRecovery(raw ?? "");
        setProtectedCopy(false);
        setMessage("A newer draft exists in another tab. Its saved data is protected.");
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
        setMessage("Saved tree data changed in another tab. Download its data before replacing it.");
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
      if (!location.hash.startsWith("#tree=") || linkSeen.current === location.href || blocked) return;
      linkSeen.current = location.href;
      try {
        const incoming = parseTreeLink(location.href);
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
    if (linkPending.current && location.hash.startsWith("#tree="))
      window.history.replaceState(null, "", location.pathname + location.search);
    linkPending.current = false;
    linkSeen.current = "";
  }
  async function importFile(upload: File) {
    try {
      if (upload.size > 60000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this tree?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  function bagFill() {
    const counts = bag.split(/[,\s]+/).filter(Boolean).map(Number);
    const next = fillFromBag(e, counts, replacement);
    if (!next) {
      setMessage(
        `Fill from bag needs whole-number counts, one for each branch at every point (${childrenOf(d, null).length} here), and enough items for every stage.`,
      );
      return;
    }
    if (d.branches.some((b) => b.probability.text.trim()))
      replace(next, "Replace the probabilities from the bag?", "This overwrites every branch probability. Hidden values stay hidden. You can undo it.");
    else commit(next);
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;
  const branchName = (b: Branch) => pathName(d, b.id);
  const fieldId = (key: string, id: string) => `pt-${key}-${id}`;

  return (
    <div className="app-shell booklet-editor pt-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading
          title="Probability trees"
          description="Draw exam-style probability tree diagrams, including unequal trees and given-that questions."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              onReset={() => replace(create(), "Reset the tree?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(() => copyWord(displayed), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")
              }
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed)))}
              menuId="tree-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="tree-downloads"
              open={menu}
              active={active}
              onClose={() => setMenu(false)}
              onBusyChange={setBusy}
              onMessage={setMessage}
              actions={diagramFileMenu({
                svg: { action: () => downloadImage(displayed, "svg"), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(displayed, "png"), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(displayed, "pdf"), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: {
                  action: () => navigator.clipboard.writeText(treeEditorLink(e, location.href)),
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
            <div className="pt-preview-bar">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
              <AnswerCopyToggle
                checked={view === "answer"}
                disabled={blocked}
                onChange={(checked) => setView(checked ? "answer" : "pupil")}
              />
            </div>
            <div className="pt-scroll" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  className="pt-resource"
                  data-testid="tree-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: renderSvg(displayed) }} />
                  {g.targets.map((t) => {
                    const id = fieldId(t.kind, t.id);
                    const b = d.branches.find((x) => x.id === t.id);
                    const l = t.kind === "answer" ? d.questions.find((q) => q.id === t.id)?.answer : b?.[t.kind];
                    const hiddenHere = view === "pupil" && l?.show === "hidden";
                    const what =
                      t.kind === "answer"
                        ? `answer to question ${d.questions.findIndex((q) => q.id === t.id) + 1}`
                        : `${{ outcome: "outcome", probability: "probability", endOutcome: "end outcome", endProbability: "end probability" }[t.kind]} for ${b ? branchName(b) : ""}`;
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
                          setSelected(`${t.kind}:${t.id}`);
                        }}
                      />
                    );
                  })}
                </div>
                <StructureStepper
                  className="pt-structure"
                  vertical
                  name="Stages"
                  caption=""
                  add={{
                    label: "Add a stage after every path that reaches the last stage",
                    title: "Add stage",
                    disabled: blocked || depth >= MAX_DEPTH,
                    onClick: () => {
                      // A tree that fitted the page keeps fitting: the new stage shortens branches if it must (one undo step).
                      const next = addStage(e);
                      commit(layout(e).width <= 180 && next !== e ? fitBranchLength(next) : next, "This tree has too many paths for another stage.");
                    },
                  }}
                  remove={{
                    label: "Remove the last stage",
                    title: "Remove last stage",
                    disabled: blocked || depth <= 1,
                    onClick: () => commit(removeStage(e)),
                  }}
                />
              </div>
            </div>
            {(message || issue || g.notes.length > 0) && (
              <div className="pt-status" aria-live="polite">
                {message && (
                  <p className="resource-feedback" role="status">
                    {message}
                  </p>
                )}
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
          <aside className="inspector-stack" aria-label="Probability tree settings">
            <ExampleGallery
              examples={treeGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) => commit(resource)}
            />
            {selectedBranch && (
              <section className="panel-card pt-panel" aria-label="Selected branch">
                <h2>Branch: {branchName(selectedBranch)}</h2>
                <div className="pt-row">
                  {isLeaf(d, selectedBranch.id) ? (
                    <button
                      type="button"
                      disabled={blocked || depthOf(d, selectedBranch.id) >= MAX_DEPTH}
                      onClick={() => commit(extendBranch(e, selectedBranch.id), "This tree has too many paths for more branches.")}
                    >
                      Add branches after this
                    </button>
                  ) : (
                    <button type="button" disabled={blocked} onClick={() => commit(pruneBranch(e, selectedBranch.id))}>
                      End the path here
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={blocked || childrenOf(d, selectedBranch.parent).length >= MAX_CHILDREN}
                    onClick={() => commit(addSibling(e, selectedBranch.parent), "This tree has too many paths for another branch.")}
                  >
                    Add a branch beside it
                  </button>
                  <button
                    type="button"
                    disabled={blocked || childrenOf(d, selectedBranch.parent).length <= minimumBranches(selectedBranch.parent)}
                    onClick={() => {
                      commit(removeLastSibling(e, selectedBranch.parent));
                      setSelected(null);
                    }}
                  >
                    Remove the last branch here
                  </button>
                  <label className="pt-hide">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={selectedBranch.bold}
                      onChange={(ev) => patch((n) => void (n.branches.find((b) => b.id === selectedBranch.id)!.bold = ev.target.checked))}
                    />
                    Bold branch (to pick out paths)
                  </label>
                </div>
              </section>
            )}
            <section className="panel-card pt-panel">
              <h2>Branches</h2>
              <div className="pt-branches">
                {d.branches.map((b) => {
                  const k = depthOf(d, b.id);
                  return (
                    <div
                      key={b.id}
                      className={`pt-branch ${selectedBranch?.id === b.id ? "pt-current" : ""}`}
                      style={{ paddingLeft: (k - 1) * 14 }}
                      onFocus={() => setSelected((s) => (s?.endsWith(":" + b.id) ? s : `outcome:${b.id}`))}
                    >
                      <span>
                        <DraftField
                          id={fieldId("outcome", b.id)}
                          className={selected === `outcome:${b.id}` ? "pt-field-selected" : ""}
                          label={`Outcome for ${branchName(b)}`}
                          value={b.outcome.text}
                          maxLength={24}
                          disabled={blocked}
                          onCommit={(v) => commit(setOutcome(e, b.id, v))}
                        />
                        <HideBox label={`Hide outcome ${branchName(b)} for pupils`} value={b.outcome} disabled={blocked} onChange={(h) => setLabel(b.id, "outcome", { show: h ? "hidden" : "show" })} />
                      </span>
                      <span>
                        <DraftField
                          id={fieldId("probability", b.id)}
                          className={selected === `probability:${b.id}` ? "pt-field-selected" : ""}
                          label={`Probability for ${branchName(b)}`}
                          value={b.probability.text}
                          maxLength={24}
                          inputMode="decimal"
                          disabled={blocked}
                          onCommit={(v) => setLabel(b.id, "probability", { text: v })}
                        />
                        <HideBox label={`Hide probability for ${branchName(b)}`} value={b.probability} disabled={blocked} onChange={(h) => setLabel(b.id, "probability", { show: h ? "hidden" : "show" })} />
                      </span>
                      <span className="pt-note">{isLeaf(d, b.id) ? "end" : ""}</span>
                    </div>
                  );
                })}
              </div>
              <p className="pt-note">
                Type fractions such as 3/8, decimals or algebra such as 1 − x. Hide keeps a value as a saved answer and leaves a
                space for pupils. Click a branch label on the tree to select it and change its shape.
              </p>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.linkLabels} onChange={(ev) => patch((n) => void (n.linkLabels = ev.target.checked))} />
                Same outcome names across each stage
              </label>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={() => commit(setAllShown(e, "probabilities", "hidden"))}>
                  Hide all probabilities
                </button>
                <button type="button" disabled={blocked || !hasHidden(e)} onClick={() => commit(setAllShown(e, "all", "show"))}>
                  Show all
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Fill probabilities</h2>
              <p className="pt-note">Nothing is filled until you press a button. Each fill can be undone.</p>
              <div className="pt-fields">
                <label>
                  Items in the bag, in branch order
                  <input aria-label="Items in the bag, in branch order" value={bag} disabled={blocked} onChange={(ev) => setBag(ev.target.value)} />
                </label>
                <label>
                  Drawing
                  <select aria-label="Drawing" value={replacement ? "with" : "without"} disabled={blocked} onChange={(ev) => setReplacementMode(ev.target.value === "with")}>
                    <option value="without">Without replacement</option>
                    <option value="with">With replacement</option>
                  </select>
                </label>
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={bagFill}>
                  Fill from bag
                </button>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    const r = fillComplements(e);
                    if (r.filled) commit(r.envelope);
                    else setMessage("No group has exactly one missing probability with the others as numbers.");
                  }}
                >
                  Fill missing 1 − p
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Outcome columns</h2>
              <div className="pt-fields">
                <label>
                  At the end of each path
                  <select aria-label="End columns" value={d.endColumn} disabled={blocked} onChange={(ev) => patch((n) => void (n.endColumn = ev.target.value as Doc["endColumn"]))}>
                    <option value="none">Nothing</option>
                    <option value="outcome">Outcome</option>
                    <option value="both">Outcome and probability</option>
                  </select>
                </label>
              </div>
              {d.endColumn !== "none" && (
                <>
                  <div className="pt-branches">
                    {paths.map((b) => (
                      <div key={b.id} className="pt-branch">
                        <span>
                          <DraftField id={fieldId("endOutcome", b.id)} label={`End outcome for ${branchName(b)}`} value={b.endOutcome.text} maxLength={24} disabled={blocked} onCommit={(v) => setLabel(b.id, "endOutcome", { text: v })} />
                          <HideBox label={`Hide end outcome for ${branchName(b)}`} value={b.endOutcome} disabled={blocked} onChange={(h) => setLabel(b.id, "endOutcome", { show: h ? "hidden" : "show" })} />
                        </span>
                        {d.endColumn === "both" && (
                          <span>
                            <DraftField id={fieldId("endProbability", b.id)} label={`End probability for ${branchName(b)}`} value={b.endProbability.text} maxLength={24} disabled={blocked} onCommit={(v) => setLabel(b.id, "endProbability", { text: v })} />
                            <HideBox label={`Hide end probability for ${branchName(b)}`} value={b.endProbability} disabled={blocked} onChange={(h) => setLabel(b.id, "endProbability", { show: h ? "hidden" : "show" })} />
                          </span>
                        )}
                        <span />
                      </div>
                    ))}
                  </div>
                  <div className="pt-row">
                    <button type="button" disabled={blocked} onClick={() => commit(fillEnd(e, "outcome"))}>
                      Fill outcome names
                    </button>
                    {d.endColumn === "both" && (
                      <button type="button" disabled={blocked} onClick={() => commit(fillEnd(e, "probability"))}>
                        Calculate path probabilities
                      </button>
                    )}
                    <button type="button" disabled={blocked} onClick={() => commit(setAllShown(e, "end", "hidden"))}>
                      Hide the columns
                    </button>
                  </div>
                </>
              )}
            </section>
            <section className="panel-card pt-panel">
              <h2>Questions and "given that"</h2>
              <p className="pt-note">
                Questions print below the tree with an answer space. To calculate an answer, tick the paths in the event and, for a
                given-that question, the paths in the condition.
              </p>
              {d.questions.map((q, qi) => {
                const value = questionValue(d, q);
                return (
                  <div key={q.id} className="pt-question">
                    <label>
                      Question ({String.fromCharCode(97 + qi)})
                      <DraftField label={`Question ${qi + 1} text`} value={q.text} maxLength={60} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].text = v))} />
                    </label>
                    <span>
                      <DraftField id={fieldId("answer", q.id)} label={`Answer to question ${qi + 1}`} value={q.answer.text} maxLength={24} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].answer.text = v))} />
                      <HideBox label={`Hide answer to question ${qi + 1}`} value={q.answer} disabled={blocked} onChange={(h) => patch((n) => void (n.questions[qi].answer.show = h ? "hidden" : "show"))} />
                    </span>
                    <details>
                      <summary>Paths for calculating</summary>
                      <div className="pt-paths">
                        <span>Path</span>
                        <span>Event</span>
                        <span>Given</span>
                        {paths.map((b) => (
                          <PathRow
                            key={b.id}
                            name={branchName(b)}
                            event={q.event.includes(b.id)}
                            given={q.given.includes(b.id)}
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
                    </details>
                    <div className="pt-row">
                      <button type="button" disabled={blocked || !value} onClick={() => commit(calculateQuestion(e, q.id), "Every chosen path needs numerical probabilities.")}>
                        Calculate answer
                      </button>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => patch((n) => void n.questions.splice(qi, 1))}
                      >
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
                {Array.from({ length: depth }, (_, k) => (
                  <label key={k}>
                    Stage {k + 1} title
                    <DraftField
                      label={`Stage ${k + 1} title`}
                      value={d.stageTitles[k] ?? ""}
                      maxLength={24}
                      disabled={blocked}
                      onCommit={(v) =>
                        patch((n) => {
                          while (n.stageTitles.length <= k) n.stageTitles.push("");
                          n.stageTitles[k] = v;
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Pupil spaces
                  <select aria-label="Pupil spaces" value={d.blankStyle} disabled={blocked} onChange={(ev) => patch((n) => void (n.blankStyle = ev.target.value as Doc["blankStyle"]))}>
                    <option value="dots">Dotted lines</option>
                    <option value="box">Boxes</option>
                  </select>
                </label>
                <label>
                  Branch length (mm)
                  <select aria-label="Branch length" value={d.branchMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.branchMm = Number(ev.target.value)))}>
                    {[...new Set([20, 24, 28, 32, 36, 40, 45, 50, d.branchMm])].sort((a, b) => a - b).map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Path spacing (mm)
                  <select aria-label="Path spacing" value={d.gapMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.gapMm = Number(ev.target.value)))}>
                    {[...new Set([10, 11, 12, 13, 14, 16, 18, 20, 24, d.gapMm])].sort((a, b) => a - b).map((x) => (
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
                  Click a label on the tree to edit it. Enter applies; Escape restores. Paths can be different lengths: select a
                  branch and choose Add branches after this, or End the path here. Nothing is calculated or filled in for you.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the tree; preview zoom never changes it. Download PNG (600
                  ppi) if your browser blocks copying.
                </p>
              </details>
            </section>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), "probability-tree-recovery.json");
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
                  const raw = localStorage.getItem(STORAGE);
                  if (raw !== recovery) {
                    setRecovery(raw ?? "");
                    setProtectedCopy(false);
                    setMessage("Saved data changed again. Download this latest copy first.");
                    return;
                  }
                  expected.current = raw;
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
              commit(pending.e);
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

function PathRow({
  name,
  event,
  given,
  disabled,
  onChange,
}: {
  name: string;
  event: boolean;
  given: boolean;
  disabled: boolean;
  onChange: (part: "event" | "given", on: boolean) => void;
}) {
  return (
    <>
      <span>{name}</span>
      <input type="checkbox" aria-label={`${name} is in the event`} checked={event} disabled={disabled} onChange={(ev) => onChange("event", ev.target.checked)} />
      <input type="checkbox" aria-label={`${name} is in the condition`} checked={given} disabled={disabled} onChange={(ev) => onChange("given", ev.target.checked)} />
    </>
  );
}
