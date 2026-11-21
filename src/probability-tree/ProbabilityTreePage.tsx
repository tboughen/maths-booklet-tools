import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { treeGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
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
import { OptionsBox } from "../site/OptionsBox";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { CardHeading, FoldCard, NumberStepper } from "../site/CardHelp";
import { Columns3, MessageCircleQuestion, PaintBucket, Ruler, X } from "lucide-react";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  addQuestion,
  addSibling,
  addStage,
  allLabels,
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
  removeBranch,
  removeStage,
  renderSvg,
  setOutcome,
  validate,
  type Branch,
  type Envelope,
  type Label,
} from "../../packages/probability-tree-core/src";
import { parseTreeLink, treeEditorLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import "./probability-tree.css";
import "../site/settings-kit.css";
import {
  commonVisibility,
  isTypingTarget,
  modalOpen,
  TARGET_TIP,
  TARGET_TIP_SPACE,
  togglePupilSpace,
  visibilityStep,
  visibilityWords,
  type Visibility,
} from "../editor-kit";
import { handleUndoKeys, openDraft, useDocumentHistory, useDraftAutosave, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";

const STORAGE = copyStorageKey("maths-booklet-tools:probability-tree:v1");
type Doc = Envelope["document"];
type LabelKey = "outcome" | "probability" | "endOutcome" | "endProbability";
type TargetKind = LabelKey | "answer";
/** The kinds of label, in the order the What pupils see card lists them. */
const KINDS: { kind: TargetKind; name: string; one: string }[] = [
  { kind: "outcome", name: "Outcomes", one: "outcome" },
  { kind: "probability", name: "Probabilities", one: "probability" },
  { kind: "endOutcome", name: "End outcomes", one: "end outcome" },
  { kind: "endProbability", name: "End probabilities", one: "end probability" },
  { kind: "answer", name: "Question answers", one: "answer" },
];
const BRANCH_STEPS = [12, 16, 20, 24, 28, 32, 36, 40, 45, 50] as const;
const GAP_STEPS = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24] as const;
/** The labels of one kind that print with this tree's settings (end columns only while they are drawn). */
function labelsOf(d: Doc, kind: TargetKind): Label[] {
  if (kind === "answer") return d.questions.map((q) => q.answer);
  if (kind === "endOutcome" && d.endColumn === "none") return [];
  if (kind === "endProbability" && d.endColumn !== "both") return [];
  const list = kind === "endOutcome" || kind === "endProbability" ? leaves(d) : d.branches;
  return list.map((b) => b[kind]);
}
function labelAt(d: Doc, kind: TargetKind, id: string): Label | undefined {
  if (kind === "answer") return d.questions.find((q) => q.id === id)?.answer;
  return d.branches.find((b) => b.id === id)?.[kind];
}

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

/** A touch board or tablet: targets reach further. Follows a tablet docked or undocked while the page is open. */
const COARSE = "(pointer: coarse)";
function useCoarsePointer() {
  return useSyncExternalStore(
    (change) => {
      if (typeof matchMedia !== "function") return () => {};
      const query = matchMedia(COARSE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => typeof matchMedia === "function" && matchMedia(COARSE).matches,
    () => false,
  );
}

/** Under a field in the settings: what pupils see of it, when that is not the value. */
function StateTag({ value }: { value: Label }) {
  if (value.show === "show") return null;
  return <span className={`pt-state pt-state-${value.show}`}>{value.show === "hidden" ? "pupil space" : "left out"}</span>;
}

export default function ProbabilityTreePage({ active = true }: { active?: boolean }) {
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
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null),
    [bag, setBag] = useState("5, 3"),
    [replacement, setReplacementMode] = useState(false),
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
  const paths = leaves(d);
  const selectedBranch = d.branches.find((b) => b.id === selected?.split(":")[1]) ?? null;

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
  const setLabel = (id: string, key: LabelKey, change: Partial<Label>) =>
    patch((n) => {
      const b = n.branches.find((x) => x.id === id);
      if (b) Object.assign(b[key], change);
    });
  const [selKind, selId] = (selected?.split(":") ?? []) as [TargetKind | undefined, string | undefined];
  const selectedLabel = selKind && selId ? labelAt(d, selKind, selId) : undefined;
  function describeTarget(kind: TargetKind, id: string) {
    if (kind === "answer") return `answer to question ${d.questions.findIndex((q) => q.id === id) + 1}`;
    const b = d.branches.find((x) => x.id === id);
    return `${KINDS.find((k) => k.kind === kind)!.one} for ${b ? pathName(d, b.id) : ""}`;
  }
  /** What pupils see of one label: one undo step, named after its value ("pupil space on 3/8"). */
  function setVisibility(kind: TargetKind, id: string, v: Visibility) {
    const l = labelAt(d, kind, id);
    if (blocked || !l || l.show === v) return;
    const n = structuredClone(e);
    labelAt(n.document, kind, id)!.show = v;
    commit(n, undefined, visibilityStep(v, l.text.trim() || describeTarget(kind, id)));
  }
  /** Every label of one kind at once: one undo step. */
  function setKind(kind: TargetKind, v: Visibility) {
    if (blocked) return;
    const n = structuredClone(e);
    for (const l of labelsOf(n.document, kind)) l.show = v;
    commit(n, undefined, visibilityStep(v, `all ${KINDS.find((k) => k.kind === kind)!.name.toLowerCase()}`));
  }
  // Every pupil space in the tree, including end columns that are switched off, so none comes back later.
  const spaceCount = allLabels(d).filter((l) => l.show === "hidden").length;
  function clearSpaces() {
    if (blocked || !spaceCount) return;
    const n = structuredClone(e);
    for (const l of allLabels(n.document)) if (l.show === "hidden") l.show = "show";
    commit(n, undefined, `clear ${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`);
  }
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
      // H: a pupil space on the selected label, and again back to its value. Never while typing ("H" for heads).
      if (
        (event.key === "h" || event.key === "H") &&
        !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat &&
        !isTypingTarget(event.target) && !modalOpen() &&
        boxAnchor && selKind && selId && selectedLabel
      ) {
        event.preventDefault();
        setVisibility(selKind, selId, togglePupilSpace(selectedLabel.show));
      }
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
  // Every target reaches at least 24 px across with a mouse and 44 px on a touch board. The extra reach is an
  // invisible margin (the button's ::before), so the outline still shows the label's real size, and it stops halfway
  // to a neighbouring label, so a press never lands on the wrong one.
  const minTarget = useCoarsePointer() ? 44 : 24;
  const mmToPx = ((96 / 25.4) * fitted.scale) || 1;
  const reach = useMemo(() => {
    const need = minTarget / mmToPx;
    return g.targets.map((t, i) => {
      let gx = Math.max(0, (need - t.width) / 2),
        gy = Math.max(0, (need - t.height) / 2);
      g.targets.forEach((o, j) => {
        if (i === j) return;
        const overlapY = t.y - gy < o.y + o.height && o.y < t.y + t.height + gy;
        const overlapX = t.x - gx < o.x + o.width && o.x < t.x + t.width + gx;
        const gapX = Math.max(o.x - (t.x + t.width), t.x - (o.x + o.width));
        const gapY = Math.max(o.y - (t.y + t.height), t.y - (o.y + o.height));
        if (overlapY && gapX >= 0) gx = Math.min(gx, gapX / 2);
        if (overlapX && gapY >= 0) gy = Math.min(gy, gapY / 2);
      });
      return { x: gx * mmToPx, y: gy * mmToPx };
    });
  }, [g.targets, minTarget, mmToPx]);
  const branchName = (b: Branch) => pathName(d, b.id);
  const fieldId = (key: string, id: string) => `pt-${key}-${id}`;

  // The box closes when its label goes (a smaller tree, a new tree, or Reset).
  const selectedDrawn = !!selected && g.targets.some((t) => `${t.kind}:${t.id}` === selected);
  useEffect(() => {
    if (boxAnchor && (!selectedDrawn || !boxAnchor.isConnected)) setBoxAnchor(null);
  }, [boxAnchor, selectedDrawn]);
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), undefined, TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), undefined, WORKED_STEP) });
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
              examples={
                <ExampleGallery
                  examples={treeGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                  onWorked={(resource) => commit(resource, undefined, "use worked version")}
                />
              }
              answers={
                <AnswerCopyToggle
                  checked={view === "answer"}
                  disabled={blocked}
                  onChange={(checked) => setView(checked ? "answer" : "pupil")}
                />
              }
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
              onCopy={() =>
                void run(() => copyWord(displayed, view === "answer"), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")
              }
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed, view === "answer")))}
              menuId="tree-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
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
                about: titleNote.item,
                worked: worked.item,
                both: { action: () => downloadBoth(e), disabled: blocked || !!issue, success: "Pupil and answers ZIP download started." },
                svg: { action: () => downloadImage(displayed, "svg", view === "answer"), disabled: blocked || !!issue, success: "SVG download started." },
                png: { action: () => downloadImage(displayed, "png", view === "answer"), disabled: blocked || !!issue, success: "PNG download started." },
                pdf: { action: () => downloadImage(displayed, "pdf", view === "answer"), disabled: blocked || !!issue, success: "PDF download started." },
                save: { action: () => downloadEditable(e), disabled: blocked, success: "Editable file download started." },
                open: { action: () => file.current?.click(), disabled: blocked, success: "" },
                link: {
                  action: () => navigator.clipboard.writeText(treeEditorLink(e, location.href)),
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
                  data-testid="tree-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.targets.map((t, i) => {
                    const id = fieldId(t.kind, t.id);
                    const key = `${t.kind}:${t.id}`;
                    const l = labelAt(d, t.kind, t.id);
                    const state = l?.show ?? "show";
                    const spaceHere = view === "pupil" && state === "hidden";
                    const words = visibilityWords(state);
                    return (
                      <button
                        key={id}
                        type="button"
                        data-options-anchor=""
                        className={`pt-hit ${selected === key ? "pt-selected" : ""} ${spaceHere ? "pt-hidden-answer" : ""} ${state === "omit" ? "pt-omitted" : ""}`}
                        aria-label={`Edit ${describeTarget(t.kind, t.id)}${words ? `, ${words}` : ""}`}
                        aria-haspopup="dialog"
                        aria-expanded={selected === key && boxAnchor !== null}
                        title={state === "hidden" ? TARGET_TIP_SPACE : state === "omit" ? `Left out. ${TARGET_TIP}` : TARGET_TIP}
                        disabled={blocked}
                        style={
                          {
                            left: px(t.x, g.width),
                            top: px(t.y, g.height),
                            width: px(t.width, g.width),
                            height: px(t.height, g.height),
                            "--pt-reach-x": `${reach[i]?.x ?? 0}px`,
                            "--pt-reach-y": `${reach[i]?.y ?? 0}px`,
                          } as CSSProperties
                        }
                        onClick={(ev) => {
                          setSelected(key);
                          setBoxAnchor(ev.currentTarget);
                        }}
                        onDoubleClick={() => {
                          // The first click opened the box; the box stays open and shows the new state.
                          if (l) setVisibility(t.kind, t.id, togglePupilSpace(l.show));
                        }}
                      />
                    );
                  })}
                </div>
                {boxAnchor && selKind && selId && selectedLabel && (
                  <OptionsBox
                    anchor={boxAnchor}
                    anchorKey={selected ?? ""}
                    title={describeTarget(selKind, selId).replace(/^./, (c) => c.toUpperCase())}
                    onClose={() => setBoxAnchor(null)}
                  >
                    <VisibilitySwitch
                      name="What pupils see"
                      caption="What pupils see"
                      value={selectedLabel.show}
                      disabled={blocked}
                      onChange={(v) => setVisibility(selKind, selId, v)}
                    />
                    <p>
                      {selectedLabel.show === "hidden" && !selectedLabel.text.trim()
                        ? "No saved answer, so the answers copy will be empty too."
                        : "Double-click the label, or press H, for a pupil space."}
                    </p>
                    <label>
                      Text
                      <DraftField
                        label={`Text of ${describeTarget(selKind, selId)}`}
                        value={selectedLabel.text}
                        maxLength={24}
                        inputMode={selKind === "probability" || selKind === "endProbability" || selKind === "answer" ? "decimal" : "text"}
                        disabled={blocked}
                        onCommit={(v) => {
                          if (selKind === "outcome") commit(setOutcome(e, selId, v));
                          else if (selKind === "answer") patch((n) => void (n.questions.find((q) => q.id === selId)!.answer.text = v));
                          else setLabel(selId, selKind, { text: v });
                        }}
                      />
                    </label>
                    {selectedBranch && (selKind === "outcome" || selKind === "probability") && (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            disabled={blocked}
                            checked={selectedBranch.bold}
                            onChange={(ev) => patch((n) => void (n.branches.find((b) => b.id === selectedBranch.id)!.bold = ev.target.checked))}
                          />
                          Bold branch (to pick out paths)
                        </label>
                        <div className="md-options-actions">
                          {isLeaf(d, selectedBranch.id) ? (
                            <button
                              type="button"
                              disabled={blocked || depthOf(d, selectedBranch.id) >= MAX_DEPTH}
                              title={depthOf(d, selectedBranch.id) >= MAX_DEPTH ? `A tree has at most ${MAX_DEPTH} stages.` : undefined}
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
                            title={childrenOf(d, selectedBranch.parent).length >= MAX_CHILDREN ? `Each point has at most ${MAX_CHILDREN} branches.` : undefined}
                            onClick={() => commit(addSibling(e, selectedBranch.parent), "This tree has too many paths for another branch.")}
                          >
                            Add a branch beside it
                          </button>
                          <button
                            type="button"
                            disabled={blocked || childrenOf(d, selectedBranch.parent).length <= minimumBranches(selectedBranch.parent)}
                            title={childrenOf(d, selectedBranch.parent).length <= minimumBranches(selectedBranch.parent) ? "This point already has as few branches as it can." : undefined}
                            onClick={() => {
                              commit(removeLastSibling(e, selectedBranch.parent));
                              setSelected(null);
                            }}
                          >
                            Remove the last branch here
                          </button>
                        </div>
                      </>
                    )}
                  </OptionsBox>
                )}
                {/* Stages are added and removed in the Branches card: one column of tools (Tim, 21 Nov 2026). */}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="probability-tree">
                  Click a label to edit it. Double-click it, or press H, for a
                  pupil space.
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
          <aside className="inspector-stack md-kit md-kit--one" aria-label="Probability tree settings">
            <ReturnToDiagram />
            {/* One column (Tim, 21 Nov 2026): the main cards, then the rarer groups folded together in one card. */}
            <section className="panel-card pt-panel" aria-label="What pupils see">
              <CardHeading
                title="What pupils see"
                help={
                  <>
                    <p className="pt-note">Show prints the value. Pupil space prints a space to fill in; the answers copy shows the value. Leave out prints nothing in either copy and keeps the value.</p>
                    <p className="pt-note">Each switch sets every label of that kind. Mixed means the labels differ: change one on the tree.</p>
                  </>
                }
              />
              {KINDS.map(({ kind, name }) => {
                const value = commonVisibility(labelsOf(d, kind).map((l) => l.show));
                return value === null ? null : (
                  <VisibilitySwitch key={kind} name={name} caption={name} value={value} disabled={blocked} onChange={(v) => setKind(kind, v)} />
                );
              })}
            </section>
            <section className="panel-card pt-panel" aria-label="Branches">
              <CardHeading
                title="Branches"
                help={
                  <>
                    <p className="pt-note">Type fractions such as 3/8, decimals or algebra such as 1 − x.</p>
                    <p className="pt-note">+ Branch adds a branch at that point; + Stage adds a stage after every path. A label on the tree has its own options.</p>
                  </>
                }
              />
              <div className="pt-branches">
                {(function rows(parent: string | null, k: number): ReactNode[] {
                  const group = childrenOf(d, parent);
                  const out: ReactNode[] = [];
                  for (const b of group) {
                    out.push(
                    <div
                      key={b.id}
                      className={`pt-branch ${selectedBranch?.id === b.id ? "pt-current" : ""}`}
                      style={{ paddingLeft: (k - 1) * 14 }}
                      onFocus={() => setSelected((s) => (s?.endsWith(":" + b.id) ? s : `outcome:${b.id}`))}
                    >
                      <span className="pt-field-wrap">
                        <DraftField
                          id={fieldId("outcome", b.id)}
                          className={selected === `outcome:${b.id}` ? "pt-field-selected" : ""}
                          label={`Outcome for ${branchName(b)}`}
                          value={b.outcome.text}
                          maxLength={24}
                          disabled={blocked}
                          onCommit={(v) => commit(setOutcome(e, b.id, v))}
                        />
                        <StateTag value={b.outcome} />
                      </span>
                      <span className="pt-field-wrap">
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
                        <StateTag value={b.probability} />
                      </span>
                      <span className="pt-row-end">
                        <span className="pt-note" title={isLeaf(d, b.id) ? "This branch ends its path" : undefined}>{isLeaf(d, b.id) ? "path end" : ""}</span>
                        {group.length > minimumBranches(parent) && (
                          <button
                            type="button"
                            className="pt-remove"
                            aria-label={`Remove ${branchName(b)}${isLeaf(d, b.id) ? "" : " and the branches after it"}`}
                            title={isLeaf(d, b.id) ? "Remove this branch (one undo step)" : "Remove this branch and the branches after it (one undo step)"}
                            disabled={blocked}
                            onClick={() => {
                              commit(removeBranch(e, b.id));
                              setSelected(null);
                            }}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </div>
                    );
                    out.push(...rows(b.id, k + 1));
                  }
                  if (group.length > 0 && group.length < MAX_CHILDREN)
                    out.push(
                      <div key={`add:${parent ?? "start"}`} className="pt-add-row" style={{ paddingLeft: (k - 1) * 14 }}>
                        <button
                          type="button"
                          className="pt-link"
                          disabled={blocked}
                          aria-label={parent === null ? "Add a first-stage branch" : `Add a branch after ${branchName(d.branches.find((x) => x.id === parent)!)}`}
                          title="One undo step"
                          onClick={() => commit(addSibling(e, parent), "This tree has too many paths for another branch.")}
                        >
                          + Branch{parent === null ? " at the start" : ""}
                        </button>
                      </div>,
                    );
                  return out;
                })(null, 1)}
              </div>
              <div className="pt-add-row pt-add-stage">
                <button type="button" className="pt-link" aria-label="Add a stage" disabled={blocked || depth >= MAX_DEPTH} title={depth >= MAX_DEPTH ? `A tree has at most ${MAX_DEPTH} stages.` : "Add a stage after every path that reaches the last stage"} onClick={() => { const next = addStage(e); commit(layout(e).width <= 180 && next !== e ? fitBranchLength(next) : next, "This tree has too many paths for another stage."); }}>
                  + Stage
                </button>
                {depth > 1 && (
                  <button type="button" className="pt-link" aria-label="Remove the last stage" disabled={blocked} title="One undo step" onClick={() => commit(removeStage(e))}>
                    Remove last stage
                  </button>
                )}
              </div>
              <div className="pt-hint" aria-live="polite">
                <span>
                  {/* The how-to is in the foot strip and the label tooltips; here only the count (scoring, 21 Nov 2026). */}
                  {spaceCount === 0 ? "No pupil spaces yet" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
                </span>
                {spaceCount > 0 && (
                  <button type="button" className="pt-link" aria-label="Clear pupil spaces" title="Show every value again (one undo step)" disabled={blocked} onClick={clearSpaces}>
                    Clear pupil spaces
                  </button>
                )}
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.linkLabels} onChange={(ev) => patch((n) => void (n.linkLabels = ev.target.checked))} />
                Same outcome names across each stage
              </label>
            </section>
            <div className="md-fold-group">
            <FoldCard
              tool="probability-tree"
              title="Fill probabilities"
              icon={PaintBucket}
              summary={`From a bag of ${bag.trim() || "…"} · ${replacement ? "with" : "without"} replacement, or 1 − p`}
            >
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
            </FoldCard>
            <FoldCard
              tool="probability-tree"
              title="Outcome columns"
              icon={Columns3}
              summary={{ none: "Nothing at the end of each path", outcome: "Outcome at the end of each path", both: "Outcome and probability at the end of each path" }[d.endColumn]}
            >
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
                        <span className="pt-field-wrap">
                          <DraftField id={fieldId("endOutcome", b.id)} label={`End outcome for ${branchName(b)}`} value={b.endOutcome.text} maxLength={24} disabled={blocked} onCommit={(v) => setLabel(b.id, "endOutcome", { text: v })} />
                          <StateTag value={b.endOutcome} />
                        </span>
                        {d.endColumn === "both" && (
                          <span className="pt-field-wrap">
                            <DraftField id={fieldId("endProbability", b.id)} label={`End probability for ${branchName(b)}`} value={b.endProbability.text} maxLength={24} disabled={blocked} onCommit={(v) => setLabel(b.id, "endProbability", { text: v })} />
                            <StateTag value={b.endProbability} />
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
                  </div>
                </>
              )}
            </FoldCard>
            <FoldCard
              tool="probability-tree"
              title={'Questions and "given that"'}
              icon={MessageCircleQuestion}
              summary={d.questions.length ? `${d.questions.length} question${d.questions.length === 1 ? "" : "s"} below the tree` : "None yet"}
              help={
                  <p className="pt-note">
                    Questions print below the tree with an answer space. To calculate an answer, tick the paths in the event and,
                    for a given-that question, the paths in the condition.
                  </p>
                }
            >
              {d.questions.map((q, qi) => {
                const value = questionValue(d, q);
                return (
                  <div key={q.id} className="pt-question">
                    <label>
                      Question ({String.fromCharCode(97 + qi)})
                      <DraftField label={`Question ${qi + 1} text`} value={q.text} maxLength={60} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].text = v))} />
                    </label>
                    <span className="pt-field-wrap">
                      <DraftField id={fieldId("answer", q.id)} label={`Answer to question ${qi + 1}`} value={q.answer.text} maxLength={24} disabled={blocked} onCommit={(v) => patch((n) => void (n.questions[qi].answer.text = v))} />
                      <StateTag value={q.answer} />
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
            </FoldCard>
            <FoldCard
              tool="probability-tree"
              title="Layout"
              icon={Ruler}
              summary={`${d.branchMm} mm branches · ${d.gapMm} mm spacing · ${d.blankStyle === "box" ? "boxes" : "dotted spaces"} · ${LINE_WEIGHT_NAMES[d.lines ?? "normal"].toLowerCase()}`}
              help={
                  <>
                    <p className="pt-note">
                      Paths can be different lengths: click a branch on the tree and choose Add branches after this, or End the
                      path here. Nothing is calculated or filled in for you.
                    </p>
                    <p className="pt-note">
                      Copy for Word carries the physical size shown under the tree; preview zoom never changes it. Download PNG
                      (600 ppi) if your browser blocks copying.
                    </p>
                  </>
                }
            >
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
                  Lines
                  <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight))}>
                    {LINE_WEIGHTS.map((v) => (
                      <option key={v} value={v}>
                        {LINE_WEIGHT_NAMES[v]}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberStepper name="Branch length" unit="mm" value={d.branchMm} steps={BRANCH_STEPS} min={12} max={50} disabled={blocked} onChange={(v) => patch((n) => void (n.branchMm = v))} />
                <NumberStepper name="Path spacing" unit="mm" value={d.gapMm} steps={GAP_STEPS} min={8} max={24} disabled={blocked} onChange={(v) => patch((n) => void (n.gapMm = v))} />
              </div>
            </FoldCard>
            </div>
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card pt-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("probability-tree", "json", { recovery: true }));
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
