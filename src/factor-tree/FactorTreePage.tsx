import { EditorHint } from "../site/EditorHint";
import { downloadName } from "../export/filenames";
import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { factorTreeGallery } from "../examples/galleryCatalogue";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu, type MenuKind } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import {
  addTree,
  canonical,
  completeTree,
  create,
  FONT,
  forView,
  isLeaf,
  layout,
  MAX_DEPTH,
  MAX_DIGITS,
  MAX_NODES,
  MAX_PRODUCT,
  MAX_TREES,
  depthOf,
  parseFile,
  removeTree,
  renderSvg,
  setNode,
  setProduct,
  split,
  unsplit,
  validate,
  warnings,
  type Envelope,
} from "../../packages/factor-tree-core/src";
import { LINK_PREFIX, parseFactorTreeLink, factorTreeLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import "../site/settings-kit.css";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { OptionsBox } from "../site/OptionsBox";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { LabelHit, PupilSpaceHint, QuickTip } from "../site/LabelTargets";
import { useCoarsePointer, useQuickTip, useTargetReach } from "../site/labelTargetHooks";
import { commonVisibility, visibilityStep, type Visibility } from "../editor-kit/visibility";
import { Eye, ListTree, Ruler, Wand2 } from "lucide-react";

const STORAGE = copyStorageKey("maths-booklet-tools:factor-tree:v1");
type Doc = Envelope["document"];
/** A number on the diagram: its tree and its ID within the tree. */
type Address = { tree: string; node: string };

/** A new diagram starts from the house style's lines (U111). */
function fresh() {
  const e = create();
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
}
function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return { e: fresh(), recovery: raw, message: "Saved factor tree data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: fresh(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: fresh(), recovery: null, message: "" };
}

/** Lets each refused draft keep its reason on screen until that field is fixed or restored. */
const FieldErrors = createContext<{ lastError: () => string; report: (field: string, error: string | null) => void }>({
  lastError: () => "",
  report: () => undefined,
});
/**
 * Keeps its draft while typing; Enter or leaving applies, Escape restores. A draft the table
 * refuses stays in the box, marked invalid, with the reason beside the table.
 */
function DraftField({
  id,
  label,
  value,
  onCommit,
  disabled,
  maxLength,
  className,
  inputMode,
  onFocus,
  onHistory,
}: {
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
  disabled?: boolean;
  maxLength: number;
  className?: string;
  inputMode?: "decimal" | "text";
  onFocus?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const errors = useContext(FieldErrors);
  useEffect(() => {
    if (!editing && !invalid) setDraft(value);
  }, [value, editing, invalid]);
  const commit = () => {
    setEditing(false);
    if (draft === value) {
      errors.report(label, null);
      return setInvalid(false);
    }
    const ok = onCommit(draft);
    setInvalid(!ok);
    errors.report(label, ok ? null : `${label}: ${errors.lastError()}`);
  };
  return (
    <input
      id={id}
      className={className}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      inputMode={inputMode}
      onFocus={onFocus}
      onChange={(ev) => {
        setEditing(true);
        setDraft(ev.target.value);
      }}
      onBlur={commit}
      onKeyDown={(ev: ReactKeyboardEvent<HTMLInputElement>) => {
        if (draft === value && !invalid && onHistory?.(ev)) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          commit();
        }
        // Escape undoes typing; with nothing typed it passes on, so it closes the options box.
        if (ev.key === "Escape" && (draft !== value || invalid)) {
          ev.preventDefault();
          ev.stopPropagation();
          setDraft(value);
          setEditing(false);
          setInvalid(false);
          errors.report(label, null);
        }
      }}
    />
  );
}

export default function FactorTreePage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Address | null>(null),
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null),
    [hideFilled, setHideFilled] = useState(true),
    [factors, setFactors] = useState<[string, string]>(["", ""]),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    g = layout(displayed),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(forView(e, "answer"));
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const notes = warnings(e);
  const selectedTree = selected ? d.trees.find((t) => t.id === selected.tree) : undefined;
  const selectedNode = selectedTree?.nodes.find((n) => n.id === selected?.node);
  const stackRef = useMoreBelow<HTMLElement>();
  const quick = useQuickTip(),
    tip = quick.tip;
  const coarse = useCoarsePointer();
  const nodeBoxes = g.nodes.map((p) => ({ x: p.x - g.r, y: p.y - g.r, width: 2 * g.r, height: 2 * g.r }));
  const reach = useTargetReach(nodeBoxes, (96 / 25.4) * fitted.scale, coarse);
  const spaceCount = d.trees.reduce((n, t) => n + t.nodes.filter((x) => x.value.show === "hidden").length + (t.product?.show === "hidden" ? 1 : 0), 0);

  const lastError = useRef("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldErrorContext = useRef({
    lastError: () => lastError.current,
    report: (field: string, error: string | null) =>
      setFieldErrors((all) => {
        if ((all[field] ?? null) === error) return all;
        const next = { ...all };
        if (error) next[field] = error;
        else delete next[field];
        return next;
      }),
  }).current;
  const shownMessage = message || Object.values(fieldErrors)[0] || "";
  function commit(next: Envelope | (() => Envelope), label?: string): boolean {
    if (recovery !== null) return false;
    try {
      const valid = validate(typeof next === "function" ? next() : next);
      documentHistory.commit(valid, label);
      setMessage("");
      return true;
    } catch (err) {
      lastError.current = err instanceof Error ? err.message : String(err);
      setMessage(lastError.current);
      return false;
    }
  }
  function patch(update: (n: Doc) => void) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n);
  }
  function undo() {
    if (blocked) return;
    documentHistory.undo();
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
  }
  function replace(next: Envelope, title: string, explanation = "This replaces the current diagram. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }
  const treeName = (treeId: string) => (d.trees.length > 1 ? `tree ${d.trees.findIndex((t) => t.id === treeId) + 1}, ` : "");
  const nodeName = (a: Address) => {
    const t = d.trees.find((x) => x.id === a.tree),
      n = t?.nodes.find((x) => x.id === a.node);
    if (!t || !n) return "";
    // The teacher sees a left-out number faintly, so its name says it; a pupil space keeps its answer out of the name.
    const label = n.value.text && (n.value.show !== "hidden" || view === "answer") ? n.value.text : n.value.text ? "hidden number" : "blank";
    return `${treeName(t.id)}${n.parent ? `level ${depthOf(t, n.id)}` : "top"} ${label}`;
  };
  function choose(a: Address, anchor: HTMLElement) {
    if (selected?.tree !== a.tree || selected.node !== a.node) setFactors(["", ""]);
    setSelected(a);
    setBoxAnchor(anchor);
  }
  /** What pupils see of one number: one undo step. A blank number is already a space for pupils. */
  function setVisibility(a: Address, v: Visibility) {
    const n = d.trees.find((t) => t.id === a.tree)?.nodes.find((x) => x.id === a.node);
    if (blocked || !n || n.value.show === v) return;
    if (v === "hidden" && !n.value.text) return setMessage("This number is a blank with no answer: pupils already see a space. Type the answer first.");
    commit(() => setNode(e, a.tree, a.node, { show: v }), visibilityStep(v, n.value.text || "blank number"));
  }
  /** Every number, or every answer line, at once: one undo step. Blank numbers stay blank spaces. */
  function setKind(kind: "number" | "answer", v: Visibility) {
    patch((n) => {
      for (const t of n.trees) {
        if (kind === "number") for (const x of t.nodes) x.value.show = v === "hidden" && !x.value.text ? "show" : v;
        else if (t.product) t.product.show = v === "hidden" && !t.product.text ? "show" : v;
      }
    });
  }
  function clearSpaces() {
    patch((n) => {
      for (const t of n.trees) {
        for (const x of t.nodes) if (x.value.show === "hidden") x.value.show = "show";
        if (t.product?.show === "hidden") t.product.show = "show";
      }
    });
  }
  // The box closes when its number goes (a smaller tree, a new diagram, or Reset).
  const selectedDrawn = !!selectedNode;
  useEffect(() => {
    if (boxAnchor && (!selectedDrawn || !boxAnchor.isConnected)) setBoxAnchor(null);
  }, [boxAnchor, selectedDrawn]);

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
        setMessage("Saved factor tree data changed in another tab. Download its data before replacing it.");
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
      if (!location.hash.startsWith(LINK_PREFIX) || linkSeen.current === location.href || blocked) return;
      linkSeen.current = location.href;
      try {
        const incoming = parseFactorTreeLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked diagram?");
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
      if (upload.size > 40000) throw Error("This editable file is too large.");
      replace(parseFile(await upload.text()), "Open this diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  return (
    <FieldErrors.Provider value={fieldErrorContext}>
    <div className="app-shell booklet-editor pt-editor ft-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Factor trees" description="Draw factor trees down to circled primes, with an index-form answer line and numbers left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={factorTreeGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) => replace(resource, `Open ${title}?`)}
                  onWorked={(resource) => commit(resource, "use worked version")}
                />
              }
              answers={<AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />}
              canUndo={!blocked && history.past.length > 0}
              canRedo={!blocked && history.future.length > 0}
              onUndo={undo}
              onRedo={redo}
              undoLabel={undoStepName(history)}
              redoLabel={redoStepName(history)}
              resetStep={history.resetStep}
              active={active}
              onReset={() => replace(fresh(), "Reset the diagram?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(displayed, view === "answer"), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(displayed, view === "answer")))}
              menuId="ft-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="ft-downloads"
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
                  action: () => navigator.clipboard.writeText(factorTreeLink(e, location.href)),
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
                  data-testid="factor-tree-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {g.nodes.map((p, i) => {
                    const a = { tree: p.treeId, node: p.id },
                      key = `${p.treeId}:${p.id}`,
                      state = p.node.value.show;
                    return (
                      <LabelHit
                        key={key}
                        what={`the number at ${nodeName(a)}`}
                        state={state}
                        text={p.node.value.text}
                        selected={selected?.tree === p.treeId && selected.node === p.id}
                        boxOpen={boxAnchor !== null}
                        pupilView={view === "pupil"}
                        tipId="fct-quick-tip"
                        tipShown={tip?.key === key}
                        tipHandlers={quick.bind(key, state)}
                        disabled={blocked}
                        coarse={coarse}
                        reach={reach[i]}
                        ghostFontPx={((FONT * 96) / 25.4) * fitted.scale}
                        style={{ left: px(p.x - g.r, g.width), top: px(p.y - g.r, g.height), width: px(2 * g.r, g.width), height: px(2 * g.r, g.height) }}
                        onOpen={(anchor) => choose(a, anchor)}
                        onVisibility={(v) => setVisibility(a, v)}
                      />
                    );
                  })}
                  <QuickTip id="fct-quick-tip" tip={tip && !(boxAnchor && selected && `${selected.tree}:${selected.node}` === tip.key) ? tip : null} />
                </div>
                {boxAnchor && selected && selectedTree && selectedNode && (
                  <OptionsBox
                    anchor={boxAnchor}
                    anchorKey={`${selected.tree}:${selected.node}`}
                    focusField={!coarse}
                    title={`The number at ${nodeName(selected)}`}
                    onClose={() => setBoxAnchor(null)}
                  >
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={selectedNode.value.show} disabled={blocked} onChange={(v) => setVisibility(selected, v)} />
                <>
                  <div className="pt-fields">
                    <label>
                      Number
                      <DraftField
                        key={`${selected.tree}-${selected.node}`}
                        id="ft-selected-value"
                        onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })}
                        label={`Text of the number at ${nodeName(selected)}`}
                        value={selectedNode.value.text}
                        maxLength={MAX_DIGITS}
                        inputMode="decimal"
                        disabled={blocked}
                        onCommit={(v) => commit(() => setNode(e, selected.tree, selected.node, { text: v }))}
                      />
                    </label>
                  </div>
                  <label className="pt-hide" title="Primes are circled. A hidden number's circle prints only on the answers copy.">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={!!selectedNode.circled}
                      onChange={(ev) => commit(() => setNode(e, selected.tree, selected.node, { circled: ev.target.checked }))}
                    />
                    Circle this number
                  </label>
                  {selectedNode.circled ? (
                    <label className="pt-hide" title="Pupils draw this circle themselves; it prints on the answers copy.">
                      <input
                        type="checkbox"
                        disabled={blocked || !selectedNode.value.text}
                        checked={selectedNode.circled === "hidden"}
                        title={selectedNode.value.text ? undefined : "Enter the number first."}
                        onChange={(ev) => commit(() => setNode(e, selected.tree, selected.node, { circled: ev.target.checked ? "hidden" : true }))}
                      />
                      Circle only on the answers copy
                    </label>
                  ) : null}
                  {isLeaf(selectedTree, selectedNode.id) ? (
                    <>
                      <div className="pt-fields ft-factors">
                        <label>
                          First factor
                          <input aria-label="First factor" value={factors[0]} maxLength={MAX_DIGITS} inputMode="decimal" disabled={blocked} onChange={(ev) => setFactors([ev.target.value, factors[1]])} />
                        </label>
                        <label>
                          Second factor
                          <input aria-label="Second factor" value={factors[1]} maxLength={MAX_DIGITS} inputMode="decimal" disabled={blocked} onChange={(ev) => setFactors([factors[0], ev.target.value])} />
                        </label>
                      </div>
                      <div className="md-options-actions">
                        <button
                          type="button"
                          disabled={blocked || depthOf(selectedTree, selectedNode.id) >= MAX_DEPTH || selectedTree.nodes.length + 2 > MAX_NODES}
                          onClick={() => {
                            if (commit(() => split(e, selected.tree, selected.node, factors), "split number")) setFactors(["", ""]);
                          }}
                        >
                          Split into two
                        </button>
                      </div>
                      <p className="pt-note">Leave a factor empty to give pupils a blank. Nothing is worked out for you.</p>
                    </>
                  ) : (
                    <div className="md-options-actions">
                      <button type="button" disabled={blocked} onClick={() => commit(() => unsplit(e, selected.tree, selected.node), "remove branches")}>
                        Remove its branches
                      </button>
                    </div>
                  )}
                  {!selectedNode.value.text && <p>This number is a blank with no answer: pupils already see a space.</p>}
                </>
                  </OptionsBox>
                )}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={shownMessage}
              hint={
                <EditorHint tool="factor-tree">Click a number to type, split or circle it. Double-click it for a pupil space.</EditorHint>
              }
            >
            </EditorFoot>
            {(issue || notes.length > 0) && (
              <div className="pt-status" aria-live="polite">
                {g.issues.map((x) => (
                  <p key={x} className="pt-error" role="alert">
                    {x}
                  </p>
                ))}
                {notes.map((x) => (
                  <p key={x}>Teacher note: {x}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Factor tree settings">
            <ReturnToDiagram />
            {/* One column (the usability pilot, rolled out 22 Nov 2026): the main cards open, the rarer groups folded. */}
            <FoldCard
              tool="factor-tree"
              title="What pupils see"
              icon={Eye}
              defaultOpen
              summary={spaceCount === 0 ? "Every number shows" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
              help={
                <>
                  <p className="pt-note">Pupil space: a blank for pupils to fill in; the answers copy shows the number. Leave out: nothing prints, in either copy.</p>
                  <p className="pt-note">A blank number with no answer is always a space. Each switch sets every label of that kind.</p>
                </>
              }
            >
              {(() => {
                const numbers = commonVisibility(d.trees.flatMap((t) => t.nodes.map((x) => x.value.show)));
                const answers = commonVisibility(d.trees.flatMap((t) => (t.product ? [t.product.show] : [])));
                return (
                  <>
                    {numbers && <VisibilitySwitch name="Numbers" caption="Numbers" value={numbers} disabled={blocked} onChange={(v) => setKind("number", v)} />}
                    {answers && <VisibilitySwitch name="Answer lines" caption="Answer lines" value={answers} disabled={blocked} onChange={(v) => setKind("answer", v)} />}
                  </>
                );
              })()}
              <PupilSpaceHint count={spaceCount} disabled={blocked} onClear={clearSpaces}>
                Double-click a number on the tree for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard
              tool="factor-tree"
              title="Trees and answer lines"
              icon={ListTree}
              defaultOpen
              summary={`${d.trees.length} tree${d.trees.length === 1 ? "" : "s"}${d.trees.some((t) => t.product) ? " · answer lines" : ""}`}
              help={<p className="pt-note">Type answers such as 2^3 × 3^2 × 5 (x and * work too); powers print raised. An empty answer is a line for pupils. A number on the tree has its own options: split it, circle it or remove its branches.</p>}
            >
              {d.trees.map((t, i) => (
                <fieldset key={t.id} className="md-kit-group">
                  <legend>{d.trees.length > 1 ? `Tree ${i + 1}` : "The tree"}</legend>
                  <label className="pt-hide">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={!!t.product}
                      onChange={(ev) => commit(() => setProduct(e, t.id, ev.target.checked ? {} : null))}
                    />
                    Answer line beneath
                  </label>
                  {t.product && (
                    <>
                      <div className="pt-fields">
                        <label className="pt-field-wrap">
                          Answer
                          <DraftField
                            label={`Answer for ${d.trees.length > 1 ? `tree ${i + 1}` : "the tree"}`}
                            value={t.product.text.replace(/\^/g, "^")}
                            maxLength={MAX_PRODUCT + 12}
                            disabled={blocked}
                            onCommit={(v) => commit(() => setProduct(e, t.id, { text: v }))}
                          />
                        </label>
                      </div>
                      {/* Each tree's answer line has its own What pupils see (the Answer lines switch sets them all). */}
                      <VisibilitySwitch
                        name={`What pupils see of the answer for ${d.trees.length > 1 ? `tree ${i + 1}` : "the tree"}`}
                        caption="What pupils see"
                        value={t.product.show}
                        disabled={blocked}
                        onChange={(v) => {
                          if (v === "hidden" && !t.product?.text) return setMessage("This answer line is a blank with no answer: pupils already see a line. Type the answer first.");
                          commit(() => setProduct(e, t.id, { show: v }), visibilityStep(v, "answer line"));
                        }}
                      />
                    </>
                  )}
                  {d.trees.length > 1 && (
                    <div className="pt-row">
                      <button type="button" disabled={blocked} onClick={() => commit(() => removeTree(e, t.id), "remove tree")}>
                        Remove {`tree ${i + 1}`}
                      </button>
                    </div>
                  )}
                </fieldset>
              ))}
              <div className="pt-add-row">
                <button type="button" className="pt-link" aria-disabled={blocked || d.trees.length >= MAX_TREES || undefined} onClick={() => !blocked && d.trees.length < MAX_TREES && commit(() => addTree(e), "add tree")}>
                  + Tree for the same number
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="factor-tree"
              title="Complete the trees"
              icon={Wand2}
              summary={hideFilled ? "Fills blanks and keeps them as answers" : "Fills blanks for pupils to see"}
              help={<p className="pt-note">Complete fills blanks from the numbers around them, splits every number that is not prime by its smallest prime, circles the primes and writes an empty answer line in index form. Numbers you entered are kept. Nothing happens until you press the button, and it can be undone.</p>}
            >
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={hideFilled} onChange={(ev) => setHideFilled(ev.target.checked)} />
                Hide what it fills (keep as answers)
              </label>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    try {
                      const r = completeTree(e, undefined, hideFilled);
                      if (r.filled) commit(r.envelope, "complete trees");
                      else setMessage("There is nothing to complete. Enter a number to split first.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  Complete trees
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="factor-tree"
              title="Layout"
              icon={Ruler}
              summary={`${d.levelMm} mm levels · ${d.blankStyle === "box" ? "boxes" : "dotted lines"}${d.intentionalError ? " · deliberate error" : ""}`}
              help={<p className="pt-note">Up to {MAX_TREES} trees, {MAX_DEPTH} levels and {MAX_NODES} numbers in each. Copy for Word carries the physical size shown under the trees; preview zoom never changes it.</p>}
            >
              <div className="pt-fields">
                <label>
                  Level height (mm)
                  <select aria-label="Level height" value={d.levelMm} disabled={blocked} onChange={(ev) => patch((n) => void (n.levelMm = Number(ev.target.value)))}>
                    {[10, 11, 12, 13, 14, 16, 18, 20, 22, 24].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Blanks
                  <select aria-label="Blanks" value={d.blankStyle} disabled={blocked} onChange={(ev) => patch((n) => void (n.blankStyle = ev.target.value as Doc["blankStyle"]))}>
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
              </div>
              <label className="pt-hide" title="For a spot-the-mistake task: wrong splits, circles and answers raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This diagram has a deliberate error
              </label>
              <label className="pt-hide" title="For a spot-the-mistake task: wrong splits, circles and answers raise no teacher note.">
                <input type="checkbox" disabled={blocked} checked={d.intentionalError} onChange={(ev) => patch((n) => void (n.intentionalError = ev.target.checked))} />
                This diagram has a deliberate error
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("factor-tree", "json", { recovery: true }));
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current diagram</button>
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
              Keep this diagram and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this diagram"
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
            <div className="ratio-import-preview" dangerouslySetInnerHTML={{ __html: renderSvg(pending.e) }} />
          </RatioDialog>
        )}
      </main>
    </div>
    </FieldErrors.Provider>
  );
}
