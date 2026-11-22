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
import { algebraTilesGallery } from "../examples/galleryCatalogue";
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
  addTerm,
  canonical,
  collect,
  create,
  forView,
  layout,
  MAX_COUNT,
  MAX_TERMS,
  MAX_TEXT,
  moveTerm,
  parseFile,
  readKind,
  removeTerm,
  renderSvg,
  setItem,
  setLetters,
  setTerm,
  setTiles,
  termLetters,
  tilesExpression,
  validate,
  warnings,
  writeExpression,
  type Envelope,
  type Item,
} from "../../packages/algebra-tile-core/src";
import { LINK_PREFIX, parseAlgebraTilesLink, algebraTilesLink } from "./links";
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
import { FONT } from "../../packages/function-machine-core/src/maths-text";
import { Eye, Grid2x2, Ruler, Wand2 } from "lucide-react";
const STORAGE = copyStorageKey("maths-booklet-tools:algebra-tiles:v1");
type Doc = Envelope["document"];
/** What is selected on the diagram: a term (all its tiles) or a line under the tiles. */
type Address = { term: string } | { item: Item };

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
        return { e: fresh(), recovery: raw, message: "Saved algebra tiles data needs recovery. Download the original before starting afresh." };
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
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
  disabled?: boolean;
  maxLength: number;
  className?: string;
  inputMode?: "decimal" | "text";
  onFocus?: () => void;
  /** With nothing typed, Ctrl+Z / Ctrl+Y go to the diagram's undo; return true when handled. */
  onHistory?: (event: ReactKeyboardEvent<HTMLInputElement>) => boolean;
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

const sameAddress = (a: Address | null, b: Address) =>
  !!a && ("term" in a ? "term" in b && a.term === b.term : "item" in b && a.item === b.item);
const ITEM_NAMES: Record<Item, string> = { expression: "expression", answer: "answer" };

export default function AlgebraTilesPage({ active = true }: { active?: boolean }) {
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
  const selectedTerm = selected && "term" in selected ? d.terms.find((t) => t.id === selected.term) : undefined;
  const selectedItem = selected && "item" in selected ? selected.item : undefined;
  const selectedLine = selectedItem ? d[selectedItem] : null;
  const stackRef = useMoreBelow<HTMLElement>();
  const quick = useQuickTip(),
    tip = quick.tip;
  const coarse = useCoarsePointer();
  const lines = [d.expression, d.answer].filter((v): v is NonNullable<typeof v> => !!v);
  const spaceCount = d.terms.filter((t) => t.show === "hidden").length + lines.filter((v) => v.show === "hidden").length + (d.zeroPairs === "hidden" ? 1 : 0);

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
  function patch(update: (n: Doc) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
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
  const termName = (termId: string) => {
    const i = d.terms.findIndex((t) => t.id === termId),
      t = d.terms[i];
    return t ? `term ${i + 1} (${t.count < 0 ? "−" : ""}${Math.abs(t.count) === 1 ? "" : Math.abs(t.count)}${termLetters(t, d.letters) === "1" && Math.abs(t.count) !== 1 ? "" : termLetters(t, d.letters)})` : "term";
  };
  const addressName = (a: Address) => ("term" in a ? termName(a.term) : ITEM_NAMES[a.item]);
  function choose(a: Address, anchor: HTMLElement) {
    setSelected(a);
    setBoxAnchor(anchor);
  }
  const stateOf = (a: Address) => ("term" in a ? d.terms.find((t) => t.id === a.term)?.show : d[a.item]?.show);
  /** What pupils see of one term or line: one undo step. An empty line is already a space for pupils. */
  function setVisibility(a: Address, v: Visibility) {
    if (blocked || stateOf(a) === v) return;
    if ("term" in a) return void commit(() => setTerm(e, a.term, { show: v }), visibilityStep(v, termName(a.term)));
    const line = d[a.item];
    if (!line) return;
    if (v === "hidden" && !line.text) return setMessage("This is an answer line with no answer: pupils already see a line. Type the answer first.");
    commit(() => setItem(e, a.item, { show: v }), visibilityStep(v, ITEM_NAMES[a.item]));
  }
  /** Every term, or both lines, at once: one undo step. Empty lines stay plain answer lines. */
  function setKind(kind: "tiles" | "lines", v: Visibility) {
    patch((n) => {
      if (kind === "tiles") for (const t of n.terms) t.show = v;
      else for (const x of [n.expression, n.answer]) if (x) x.show = v === "hidden" && !x.text ? "show" : v;
    }, "what pupils see");
  }
  function clearSpaces() {
    patch((n) => {
      for (const t of n.terms) if (t.show === "hidden") t.show = "show";
      for (const x of [n.expression, n.answer]) if (x?.show === "hidden") x.show = "show";
      if (n.zeroPairs === "hidden") n.zeroPairs = "show";
    }, "clear pupil spaces");
  }
  // The box closes when its term or line goes (a removed term, a new diagram, or Reset).
  const selectedDrawn = !!(selectedTerm || selectedLine);
  useEffect(() => {
    if (boxAnchor && (!selectedDrawn || !boxAnchor.isConnected)) setBoxAnchor(null);
  }, [boxAnchor, selectedDrawn]);
  const readCount = (text: string) => {
    const n = Number(text.trim().replace(/[−–]/g, "-"));
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > MAX_COUNT) throw Error(`Type a whole number of tiles from 1 to ${MAX_COUNT}, with − for negative tiles.`);
    return n;
  };

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
        setMessage("Saved algebra tiles data changed in another tab. Download its data before replacing it.");
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
        const incoming = parseAlgebraTilesLink(location.href);
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
  function explicit(action: (e: Envelope, hidden: boolean) => { envelope: Envelope; filled: boolean }, label: string, nothing: string) {
    try {
      const r = action(e, hideFilled);
      if (r.filled) commit(r.envelope, label);
      else setMessage(nothing);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  // As written, one button per term on each row (the box round its tiles); grouped, one per tile, since a term's tiles may sit apart.
  const hitList: typeof g.hits = [];
  {
    const rows = new Map<string, (typeof g.hits)[number]>();
    for (const h of g.hits) {
      if ("item" in h.target || d.arrangement === "grouped") {
        hitList.push(h);
        continue;
      }
      const key = `${h.target.term}|${Math.round((h.y + h.height) * 100)}`,
        seen = rows.get(key);
      if (!seen) {
        const copy = { ...h };
        rows.set(key, copy);
        hitList.push(copy);
      } else {
        const x2 = Math.max(seen.x + seen.width, h.x + h.width),
          y1 = Math.min(seen.y, h.y);
        seen.width = x2 - seen.x;
        seen.height = seen.y + seen.height - y1;
        seen.y = y1;
      }
    }
  }
  const reach = useTargetReach(hitList, (96 / 25.4) * fitted.scale, coarse);
  return (
    <FieldErrors.Provider value={fieldErrorContext}>
    <div className="app-shell booklet-editor pt-editor at-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Algebra tiles" description="Draw algebra tiles for collecting like terms, with a²b and ab² blocks, negative tiles and zero pairs, and the answer left blank or hidden for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={algebraTilesGallery}
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
              menuId="at-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="at-downloads"
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
                  action: () => navigator.clipboard.writeText(algebraTilesLink(e, location.href)),
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
                  data-testid="algebra-tiles-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, view === "answer") }} />
                  {hitList.map((h, k) => {
                    const a: Address = "term" in h.target ? { term: h.target.term } : { item: h.target.item },
                      id = "term" in a ? a.term : a.item,
                      key = `${id}:${k}`,
                      state = stateOf(a) ?? "show",
                      text = "term" in a ? termName(a.term) : (d[a.item]?.text ?? "");
                    return (
                      <LabelHit
                        key={key}
                        what={`the ${addressName(a)}`}
                        state={state}
                        text={"term" in a ? "" : text}
                        selected={sameAddress(selected, a)}
                        boxOpen={boxAnchor !== null}
                        pupilView={view === "pupil"}
                        tipId="at-quick-tip"
                        tipShown={tip?.key === key}
                        tipHandlers={quick.bind(key, state)}
                        disabled={blocked}
                        coarse={coarse}
                        reach={reach[k]}
                        ghostFontPx={((FONT * 96) / 25.4) * fitted.scale}
                        style={{ left: px(h.x, g.width), top: px(h.y, g.height), width: px(h.width, g.width), height: px(h.height, g.height) }}
                        onOpen={(anchor) => choose(a, anchor)}
                        onVisibility={(nv) => setVisibility(a, nv)}
                      />
                    );
                  })}
                  <QuickTip id="at-quick-tip" tip={tip && !(boxAnchor && selected && tip.key.startsWith(`${"term" in selected ? selected.term : selected.item}:`)) ? tip : null} />
                </div>
                {boxAnchor && selected && selectedTerm && (
                  <OptionsBox anchor={boxAnchor} anchorKey={selectedTerm.id} focusField={!coarse} title={`The ${termName(selectedTerm.id)}`} onClose={() => setBoxAnchor(null)}>
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={selectedTerm.show} disabled={blocked} onChange={(v) => setVisibility(selected, v)} />
                  <div className="pt-fields">
                    <label>
                      Tile
                      <DraftField
                        key={`${selectedTerm.id}-kind`}
                        onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })}
                        label={`Tile of the ${termName(selectedTerm.id)}`}
                        value={termLetters(selectedTerm, d.letters)}
                        maxLength={12}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setTerm(e, selectedTerm.id, { term: v }), "change tile")}
                      />
                    </label>
                    <label>
                      How many (− for negative)
                      <DraftField
                        key={`${selectedTerm.id}-count`}
                        onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })}
                        label="How many"
                        value={String(selectedTerm.count).replace("-", "−")}
                        maxLength={4}
                        inputMode="text"
                        disabled={blocked}
                        onCommit={(v) =>
                          commit(() => setTerm(e, selectedTerm.id, { count: readCount(v) }), "change count")
                        }
                      />
                    </label>
                  </div>
                  <div className="md-options-actions">
                    <button type="button" disabled={blocked || d.terms[0].id === selectedTerm.id} onClick={() => commit(() => moveTerm(e, selectedTerm.id, -1), "move term")}>
                      Move earlier
                    </button>
                    <button type="button" disabled={blocked || d.terms.at(-1)!.id === selectedTerm.id} onClick={() => commit(() => moveTerm(e, selectedTerm.id, 1), "move term")}>
                      Move later
                    </button>
                    <button
                      type="button"
                      disabled={blocked || d.terms.length >= MAX_TERMS}
                      onClick={() => commit(() => addTerm(e, { count: 1, ...readKind(termLetters(selectedTerm, d.letters), d.letters) }, selectedTerm.id), "add term")}
                    >
                      Add a term after it
                    </button>
                    <button
                      type="button"
                      disabled={blocked || d.terms.length <= 1}
                      onClick={() => {
                        if (commit(() => removeTerm(e, selectedTerm.id), "remove term")) setSelected(null);
                      }}
                    >
                      Remove this term
                    </button>
                  </div>
                  <p className="pt-note">
                    Type a tile such as {d.letters.long}, {d.letters.long}², {d.letters.long}
                    {d.letters.short}, {d.letters.long}²{d.letters.short} or 1 (^2 also makes a square).
                  </p>
                  </OptionsBox>
                )}
                {boxAnchor && selected && selectedItem && selectedLine && (
                  <OptionsBox anchor={boxAnchor} anchorKey={selectedItem} focusField={!coarse} title={`The ${ITEM_NAMES[selectedItem]}`} onClose={() => setBoxAnchor(null)}>
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={selectedLine.show} disabled={blocked} onChange={(v) => setVisibility(selected, v)} />
                  <div className="pt-fields">
                    <label>
                      {selectedItem === "answer" ? "Answer" : "Expression"}
                      <DraftField
                        key={selectedItem}
                        onHistory={(ev) => handleUndoKeys(ev.nativeEvent, { undo, redo }, { inField: true })}
                        label={`Text of the ${ITEM_NAMES[selectedItem]}`}
                        value={selectedLine.text}
                        maxLength={MAX_TEXT}
                        disabled={blocked}
                        onCommit={(v) => commit(() => setItem(e, selectedItem, { text: v }), `change ${selectedItem}`)}
                      />
                    </label>
                  </div>
                    {!selectedLine.text && <p className="pt-note">This is an answer line with no answer: pupils already see a line.</p>}
                    <p className="pt-note">Type ^2 or ² for squares and - for minus: they print as on a paper, letters in italic.</p>
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
              hint={<EditorHint tool="algebra-tiles">Click a term's tiles, the expression or the answer to type it. Double-click it for a pupil space.</EditorHint>}
            ></EditorFoot>
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
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Algebra tiles settings">
            <ReturnToDiagram />
            {/* One column (the usability pilot, rolled out 22 Nov 2026): the main cards open, the rarer groups folded. */}
            <FoldCard
              tool="algebra-tiles"
              title="What pupils see"
              icon={Eye}
              defaultOpen
              summary={spaceCount === 0 ? "Everything shows" : `${spaceCount} pupil space${spaceCount === 1 ? "" : "s"}`}
              help={
                <>
                  <p className="pt-note">Pupil space: pupils draw the tiles or write the line; the answers copy shows them. Leave out: nothing prints, not even a line, in either copy.</p>
                  <p className="pt-note">An empty line is an answer line with no answer, and is always a space.</p>
                </>
              }
            >
              {(() => {
                const tiles = commonVisibility(d.terms.map((t) => t.show));
                const written = commonVisibility(lines.map((v) => v.show));
                return (
                  <>
                    {tiles && <VisibilitySwitch name="Tiles" caption="Tiles" value={tiles} disabled={blocked} onChange={(v) => setKind("tiles", v)} />}
                    {written && <VisibilitySwitch name="Expression and answer" caption="Expression and answer" value={written} disabled={blocked} onChange={(v) => setKind("lines", v)} />}
                  </>
                );
              })()}
              <PupilSpaceHint count={spaceCount} disabled={blocked} onClear={clearSpaces}>
                Double-click a term&apos;s tiles or a line for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard
              tool="algebra-tiles"
              title="Tiles"
              icon={Grid2x2}
              defaultOpen
              summary={`${d.terms.length} term${d.terms.length === 1 ? "" : "s"}`}
            >
              <div className="pt-fields">
                <label>
                  Tiles for
                  <DraftField
                    key={canonical(e)}
                    label="Tiles for"
                    value={tilesExpression(d)}
                    maxLength={120}
                    disabled={blocked}
                    onCommit={(v) => {
                      const ok = commit(() => setTiles(e, v), "set tiles");
                      if (ok) setSelected(null);
                      return ok;
                    }}
                  />
                </label>
              </div>
              <p className="pt-note">Type the terms as they should appear, such as 3a + 2b − a²b + ab² − 4. Nothing is collected.</p>
              <div className="pt-fields">
                <label>
                  Long letter
                  <DraftField
                    label="Long letter"
                    value={d.letters.long}
                    maxLength={1}
                    disabled={blocked}
                    onCommit={(v) => commit(() => setLetters(e, { long: v, short: d.letters.short }), "change letters")}
                  />
                </label>
                <label>
                  Short letter
                  <DraftField
                    label="Short letter"
                    value={d.letters.short}
                    maxLength={1}
                    disabled={blocked}
                    onCommit={(v) => commit(() => setLetters(e, { long: d.letters.long, short: v }), "change letters")}
                  />
                </label>
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked || d.terms.length >= MAX_TERMS} onClick={() => commit(() => addTerm(e, { count: 1, long: 0, short: 0 }), "add term")}>
                  Add a term
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="algebra-tiles"
              title="Expression and answer"
              icon={Wand2}
              summary={[d.expression ? "Expression" : "", d.answer ? "Answer" : ""].filter(Boolean).join(" and ") || "No lines"}
              help={
                <p className="pt-note">
                  An empty line is an answer line for pupils. These buttons fill an empty line from the tiles; nothing happens until you press one, and
                  it can be undone.
                </p>
              }
            >
              <label className="pt-hide">
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={d.expression !== null}
                  onChange={(ev) => commit(() => setItem(e, "expression", ev.target.checked ? {} : null), ev.target.checked ? "add expression line" : "remove expression line")}
                />
                Expression under the tiles
              </label>
              <label className="pt-hide">
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={d.answer !== null}
                  onChange={(ev) => commit(() => setItem(e, "answer", ev.target.checked ? {} : null), ev.target.checked ? "add answer line" : "remove answer line")}
                />
                Simplified answer (after =)
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={hideFilled} onChange={(ev) => setHideFilled(ev.target.checked)} />
                Make what it fills pupil spaces
              </label>
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => explicit(writeExpression, "write expression", "The expression is already written. Clear it to write it again.")}
                >
                  Write the expression
                </button>
                <button type="button" disabled={blocked} onClick={() => explicit(collect, "collect like terms", "The answer is already written. Clear it to collect again.")}>
                  Collect like terms
                </button>
              </div>
            </FoldCard>
            <FoldCard
              tool="algebra-tiles"
              title="Layout"
              icon={Ruler}
              summary={`${d.arrangement === "grouped" ? "Like tiles grouped" : "As written"}${d.fill === "plain" ? " · white tiles" : ""}${d.lines === "bold" ? " · bold lines" : ""}`}
              help={
                <>
                  <p className="pt-note">
                    Each kind of term has its own tile: 1 is a small square, a letter a strip, a squared letter a square, two letters a rectangle and
                    three letters a block (a²b is a by a by b; ab² is a by b by b). Negative tiles are red and hatched (and signed while labels print), so they still read in
                    black and white. Up to {MAX_TERMS} terms of {MAX_COUNT} tiles each.
                  </p>
                  <p className="pt-note">
                    Copy for Word carries the physical size shown under the tiles; preview zoom never changes it. Download PNG (600 ppi) if your
                    browser blocks copying.
                  </p>
                </>
              }
            >
              <div className="pt-fields">
                <label>
                  Arrangement
                  <select aria-label="Arrangement" value={d.arrangement} disabled={blocked} onChange={(ev) => patch((n) => void (n.arrangement = ev.target.value as Doc["arrangement"]), "change arrangement")}>
                    <option value="as-written">As written</option>
                    <option value="grouped">Like tiles grouped</option>
                  </select>
                </label>
                <label>
                  Zero pairs
                  <select aria-label="Zero pairs" value={d.zeroPairs} disabled={blocked} onChange={(ev) => patch((n) => void (n.zeroPairs = ev.target.value as Doc["zeroPairs"]), "change zero pairs")}>
                    <option value="none">Not ringed</option>
                    <option value="show">Ringed</option>
                    <option value="hidden">Ringed on the answers copy</option>
                  </select>
                </label>
                <label>
                  Tiles
                  <select aria-label="Tile colours" value={d.fill} disabled={blocked} onChange={(ev) => patch((n) => void (n.fill = ev.target.value as Doc["fill"]), "change colours")}>
                    <option value="colour">Yellow and red</option>
                    <option value="plain">White</option>
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
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.labels} onChange={(ev) => patch((n) => void (n.labels = ev.target.checked), "change labels")} />
                Print the term on each tile
              </label>
              <label className="pt-hide" title="A dashed frame round the tiles: room for pupils to draw them.">
                <input type="checkbox" disabled={blocked} checked={d.frame} onChange={(ev) => patch((n) => void (n.frame = ev.target.checked), "change frame")} />
                Frame round the tiles
              </label>
              <label className="pt-hide" title="For a spot-the-mistake task: an expression or answer that does not match raises no teacher note.">
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("algebra-tiles", "json", { recovery: true }));
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
              setBoxAnchor(null);
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
