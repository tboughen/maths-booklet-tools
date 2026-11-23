import { useTitleNote } from "../site/TitleNote";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { vennGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { EditorHint } from "../site/EditorHint";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { vennEditorLink, parseVennLink } from "./links";
import {
  EditorDownloadMenu,
  type MenuKind,
} from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  create,
  validate,
  canonical,
  parseFile,
  regionName,
  changeSets,
  hasThirdData,
  activeMasks,
  arrangement,
  changeArrangement,
  hasRegionData,
  forView,
  relationship,
  type Arrangement,
  expressionMasks,
  warnings,
  layout,
  membership,
  renderSvg,
  kinds,
  type Envelope,
  type Region,
} from "../../packages/venn-core/src";
import { EditorToolbar } from "../site/EditorToolbar";
import { handleUndoKeys, objectKeyCommand, openDraft, useDocumentHistory, useDraftAutosave, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { houseStyled, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, MIN_TEXT_PT, type LineWeight } from "../../packages/envelope-core/src/house-style";
import { printPng, downloadImage, copyWord, downloadEditable, downloadBoth } from "./export";
import { VennFloatingEditor } from "./VennFloatingEditor";
import { LiveText } from "../site/LiveText";
import { OptionsBox } from "../site/OptionsBox";
import { FoldCard } from "../site/CardHelp";
import { useMoreBelow } from "../site/useMoreBelow";
import { useCoarsePointer } from "../site/labelTargetHooks";
import { VisibilitySwitch } from "../site/VisibilitySwitch";
import { PupilSpaceHint } from "../site/LabelTargets";
import { TARGET_TIP, TARGET_TIP_SPACE, commonVisibility, togglePupilSpace, visibilityStep, type Visibility } from "../editor-kit/visibility";
import { Eye, Paintbrush, Ruler, Shapes, Type, Wrench } from "lucide-react";
import "./venn.css";
import "../site/settings-kit.css";
import { downloadName } from "../export/filenames";


/** A new Venn diagram at the teacher's house style text size (U111); its own setting overrides it. */
function freshVenn() {
  const e = create();
  houseStyled(e.document, { max: 14 });
  return e;
}

const STORAGE = copyStorageKey("maths-booklet-tools:venn:v1");
const arrangementNames: Record<Arrangement, string> = {
  overlap: "Overlap",
  separate: "Separate",
  "b-inside-a": "Nested",
  "a-inside-b": "Nested",
};
const layoutChoices = ["overlap", "separate", "b-inside-a"] as const;
function ArrangementIcon({ value }: { value: Arrangement }) {
  const nested = value.endsWith("inside-a") || value.endsWith("inside-b");
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">
      {nested ? (
        <>
          <circle cx="32" cy="20" r="17" />
          <circle cx="39" cy="20" r="8" />
          <text x="23" y="23">
            {value === "b-inside-a" ? "A" : "B"}
          </text>
          <text x="39" y="23">
            {value === "b-inside-a" ? "B" : "A"}
          </text>
        </>
      ) : (
        <>
          <circle
            cx={value === "separate" ? 17 : 25}
            cy="20"
            r={value === "separate" ? 13 : 16}
          />
          <circle
            cx={value === "separate" ? 47 : 39}
            cy="20"
            r={value === "separate" ? 13 : 16}
          />
        </>
      )}
    </svg>
  );
}
function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh: freshVenn, recoveryMessage: "Saved Venn data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}
/** The one vocabulary: an answer line is a pupil space drawn as a dotted line. */
const pupilSees = (v: Region["visibility"]): Visibility => (v === "line" ? "hidden" : v);
/** Setting a pupil space keeps a dotted line where there was one. */
const savedVisibility = (v: Visibility, was: Region["visibility"]): Region["visibility"] =>
  v === "hidden" && was === "line" ? "line" : v;
type OptionsTarget = { type: "region" | "label" | "definition"; index: number; anchor: string };
/** The Apply editor is kept only for shading a set expression, which replaces all the shading at once. */
type Draft = {
  type: "expression";
  index: number;
  text: string;
  kind: Region["kind"];
  visibility: Region["visibility"];
  anchor: string;
  title: string;
};
export default function VennPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [message, setMessage] = useState(startup.message);
  const [box, setBox] = useState<OptionsTarget | null>(null),
    [boxAnchor, setBoxAnchor] = useState<HTMLElement | null>(null),
    [boxError, setBoxError] = useState("");
  const stackRef = useMoreBelow<HTMLElement>(),
    coarse = useCoarsePointer();
  const [draft, setDraft] = useState<Draft | null>(null),
    [draftError, setDraftError] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [mode, setMode] = useState("edit"),
    [shade, setShade] = useState<Region["shade"]>("grey"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<"pupil" | "answer">("pupil"),
    [menu, setMenu] = useState<MenuKind | false>(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      e: Envelope;
      title: string;
      explanation: string;
    } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const e = history.present,
    d = e.document,
    displayed = forView(e, view),
    answers = view === "answer",
    answerSvg = renderSvg(forView(e, "answer")),
    g = layout(displayed),
    blocked = busy || recovery !== null || draft !== null || pending !== null;
  const fitted = useResourceFit(
    (g.width * 96) / 25.4,
    (g.height * 96) / 25.4,
    zoom,
  );
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" "),
    note = warnings(e);
  const nested = d.sets === 2 && arrangement(e).includes("inside");
  function labelName(index: number) {
    if (index === 0) return "universe";
    if (nested)
      return index === (arrangement(e) === "a-inside-b" ? 2 : 1)
        ? "outer set"
        : "inner set";
    return "set " + "ABC"[index - 1];
  }
  const panelName = (index: number) => {
    const name = labelName(index);
    return name[0].toUpperCase() + name.slice(1);
  };
  // What pupils see: the regions and labels that have something to print.
  const shownRegions = activeMasks(e).filter((m) => d.regions[m].kind !== "empty" && d.regions[m].text.trim() !== ""),
    shownLabels = d.labels.slice(0, d.sets + 1).flatMap((l, i) => (l.text.trim() ? [i] : [])),
    spaceCount =
      activeMasks(e).filter((m) => pupilSees(d.regions[m].visibility) === "hidden").length +
      d.labels.slice(0, d.sets + 1).filter((l) => pupilSees(l.visibility) === "hidden").length,
    seenSummary = spaceCount === 0 ? "No pupil spaces" : `${spaceCount} pupil ${spaceCount === 1 ? "space" : "spaces"}`;
  function commit(next: Envelope, label?: string) {
    if (recovery !== null) return;
    const valid = validate(next);
    documentHistory.commit(valid, label);
    setMessage("");
  }
  function patch(update: (n: Envelope["document"]) => void, label?: string) {
    if (blocked) return;
    const n = structuredClone(e);
    update(n.document);
    commit(n, label);
  }
  function undo() {
    if (blocked) return;
    documentHistory.undo();
    setSelected(null);
  }
  function redo() {
    if (blocked) return;
    documentHistory.redo();
    setSelected(null);
  }
  function replacement(
    next: Envelope,
    title: string,
    explanation = "This replaces the current diagram. You can undo the replacement.",
  ) {
    if (blocked) return;
    closeBox();
    setPending({ e: next, title, explanation });
  }
  function selectCount(sets: 1 | 2 | 3) {
    if (blocked || sets === d.sets) return;
    const n = changeSets(e, sets);
    if ((sets === 1 || d.sets === 1) && d.regions.some(hasRegionData))
      replacement(
        n,
        "Start a blank layout?",
        "Changing to or from one set changes the meaning of the regions. This clears all region contents, hidden answers, answer lines and shading; labels, definitions and print settings are retained. No values are combined. You can undo it.",
      );
    else if (d.sets === 3 && sets === 2 && hasThirdData(e))
      replacement(
        n,
        "Remove the third set?",
        "This removes all four regions inside the third set, including hidden answers and shading. Values outside the third set are retained. You can undo it.",
      );
    else {
      commit(n);
      setSelected(null);
    }
  }
  function selectArrangement(value: Arrangement) {
    if (blocked || value === arrangement(e)) return;
    const n = changeArrangement(e, value);
    const removed = activeMasks(e).filter(
      (i) => !activeMasks(n).includes(i) && hasRegionData(d.regions[i]),
    );
    if (removed.length)
      replacement(
        n,
        "Discard incompatible regions?",
        `The ${arrangementNames[value]} layout removes: ${removed.map((i) => regionName(i, e)).join("; ")}. Their contents, hidden answers, answer lines and shading will be cleared. Other regions are retained. No values are moved or combined. You can undo it.`,
      );
    else {
      commit(n);
      setSelected(null);
    }
  }
  function closeDraft() {
    const anchor = draft?.anchor;
    setDraft(null);
    setSelected(null);
    setDraftError("");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-vn-anchor="${anchor}"]`)
        ?.focus({ preventScroll: true }),
    );
  }
  function open(type: Draft["type"], index: number, anchor: string) {
    if (blocked) return;
    closeBox();
    setDraftError("");
    setDraft({ type, index, anchor, title: "Shade a set expression", text: d.sets === 1 ? "A'" : "A ∩ B", kind: "text", visibility: "show" });
  }
  function applyDraft() {
    if (!draft) return;
    try {
      const n = structuredClone(e);
      const masks = expressionMasks(draft.text, d.sets, activeMasks(e));
      n.document.regions.forEach((r, i) => {
        r.shade = masks.includes(i) ? shade : "none";
      });
      commit(n);
      closeDraft();
      if (masks.length === 0) setMessage("This expression has no region in this layout. All shading has been cleared.");
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
    }
  }
  /** The live options box beside a region, label or definition: every change is one undo step, with no Apply. */
  function openBox(type: OptionsTarget["type"], index: number, anchor: string) {
    if (blocked) return;
    const el = document.querySelector<HTMLElement>(`[data-vn-anchor="${anchor}"]`);
    setBox({ type, index, anchor });
    setBoxAnchor(el);
    setBoxError("");
    setSelected(type === "region" ? index : null);
  }
  function closeBox() {
    setBox(null);
    setBoxAnchor(null);
    setBoxError("");
  }
  /** One undo step from the box; a refused value is reported in the box and nothing changes. */
  function boxEdit(update: (n: Envelope["document"]) => void, label?: string) {
    if (blocked) return false;
    try {
      const n = structuredClone(e);
      update(n.document);
      commit(n, label);
      setBoxError("");
      return true;
    } catch (err) {
      setBoxError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }
  const regionWords = (mask: number) => regionName(mask, e);
  function setRegionVisibility(mask: number, v: Visibility) {
    boxEdit((n) => {
      n.regions[mask].visibility = savedVisibility(v, n.regions[mask].visibility);
    }, visibilityStep(v, regionWords(mask)));
  }
  function setLabelVisibility(index: number, v: Visibility) {
    boxEdit((n) => {
      n.labels[index].visibility = savedVisibility(v, n.labels[index].visibility);
    }, visibilityStep(v, `${labelName(index)} label`));
  }
  /** Double-click: a pupil space, and again back to the content. */
  function toggleRegion(mask: number) {
    if (blocked || mode === "shade") return;
    setRegionVisibility(mask, togglePupilSpace(pupilSees(d.regions[mask].visibility)));
  }
  function toggleLabel(index: number) {
    if (blocked) return;
    setLabelVisibility(index, togglePupilSpace(pupilSees(d.labels[index].visibility)));
  }
  function chooseRegion(mask: number, anchor: string) {
    if (blocked) return;
    setSelected(mask);
    if (mode === "shade")
      patch((n) => {
        n.regions[mask].shade =
          n.regions[mask].shade === shade ? "none" : shade;
      });
    else openBox("region", mask, anchor);
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
      setMessage(reason === "newer" ? "A newer draft exists in another tab. Its saved data is protected." : "Saved Venn data changed in another tab. Download its data before replacing it.");
    },
  });
  // A box whose region or label has gone (fewer sets, a new layout, undo, shade mode) closes.
  useEffect(() => {
    if (!box) return;
    const gone =
      mode === "shade" ||
      !boxAnchor?.isConnected ||
      (box.type === "region" ? !activeMasks(e).includes(box.index) : box.index > d.sets);
    if (gone) closeBox();
  });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === "Escape" && draft) {
        event.preventDefault();
        closeDraft();
        return;
      }
      if (box && event.key === "Escape") return;
      if (handleUndoKeys(event, { undo, redo })) return;
      // U9: Escape deselects; Delete clears the selected region's shading (never a set or region).
      const command = objectKeyCommand(event);
      if (!command || draft || selected === null || blocked) return;
      if (command.kind === "deselect") setSelected(null);
      else if (
        command.kind === "delete" &&
        d.regions[selected] &&
        d.regions[selected].shade !== "none"
      ) {
        event.preventDefault();
        const mask = selected;
        patch((n) => {
          n.regions[mask].shade = "none";
        }, "clear shading");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function run(
    action: () => Promise<void>,
    allowOverflow = false,
    success = "Image copied. Paste with Ctrl+V.",
  ) {
    if (blocked || (!allowOverflow && issue)) return;
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
  const linkPending = useRef(false);
  const linkSeen = useRef("");
  useEffect(() => {
    if (!active) return;
    const inspect = () => {
      if (
        !location.hash.startsWith("#venn=") ||
        linkSeen.current === location.href ||
        blocked
      )
        return;
      linkSeen.current = location.href;
      try {
        const incoming = parseVennLink(location.href);
        linkPending.current = true;
        replacement(incoming, "Open the linked Venn diagram?");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    inspect();
    window.addEventListener("hashchange", inspect);
    return () => window.removeEventListener("hashchange", inspect);
  });
  function consumeVennLink() {
    if (linkPending.current && location.hash.startsWith("#venn="))
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
      replacement(parseFile(await upload.text()), "Open this Venn diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }
  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  // The help closes the last card, Region contents or Region shading. It is one of two elements as
  // the mode changes, so the page remembers whether it is open.
  const help = (
    <details open={helpOpen} onToggle={(ev) => setHelpOpen(ev.currentTarget.open)}>
      <summary>Editing and printing help</summary>
      <p>
        Use commas, semicolons or new lines between members. Use 1/2 for a
        stacked fraction. Blank, hidden content, an answer line and zero are
        different states. No automatic solving.
      </p>
      <p>
        Changes apply as you type, each one undo step; Escape closes the box. Save an editable file to keep a
        portable copy. Copy for Word carries the physical size shown above the
        diagram. Download PNG (600 ppi) if your browser blocks copying.
      </p>
    </details>
  );
  return (
    <div className="app-shell booklet-editor vn-editor">
      <main
        className="main-content"
        id={active ? "main-content" : undefined}
        tabIndex={-1}
      >
        <PageHeading
          title="Venn diagrams"
          description="Build blank, populated and shaded diagrams for your teaching resources."
        >
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={vennGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(resource, title) =>
                    replacement(resource, `Open ${title}?`)
                  }
                  onWorked={(resource) => commit(resource, "use worked version")}
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
              onReset={() => replacement(freshVenn(), "Reset the Venn diagram?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() =>
                void run(
                  () => copyWord(displayed, answers),
                  false,
                  "Copied for Word at " +
                    formatResourceSize(g.width / 10, g.height / 10) +
                    ". Paste with Ctrl+V.",
                )
              }
              onCopyClipboard={() =>
                void run(() => copyPngToClipboard(() => printPng(displayed, answers)))
              }
              menuId="venn-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="venn-downloads"
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
                  action: () => downloadImage(displayed, "svg", answers),
                  disabled: blocked || !!issue,
                  success: "SVG download started.",
                },
                png: {
                  action: () => downloadImage(displayed, "png", answers),
                  disabled: blocked || !!issue,
                  success: "PNG download started.",
                },
                pdf: {
                  action: () => downloadImage(displayed, "pdf", answers),
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
                      vennEditorLink(e, location.href),
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
            <div
              className="vn-scroll editor-stage"
              ref={fitted.ref}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && !draft) {
                  setSelected(null);
                  closeBox();
                }
              }}
            >
              <div
                className="vn-resource"
                data-testid="venn-resource"
                style={{
                  width: ((g.width * 96) / 25.4) * fitted.scale,
                  height: ((g.height * 96) / 25.4) * fitted.scale,
                }}
                onClick={(ev) => {
                  if (blocked || (ev.target as HTMLElement).closest("button"))
                    return;
                  const r = ev.currentTarget.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * g.width) / r.width,
                    y = ((ev.clientY - r.top) * g.height) / r.height;
                  if (
                    x > g.box.x &&
                    x < g.box.x + g.box.width &&
                    y > g.box.y &&
                    y < g.box.y + g.box.height
                  ) {
                    const mask = membership(g, x, y);
                    chooseRegion(mask, `region-${mask}`);
                  } else {
                    setSelected(null);
                    closeBox();
                  }
                }}
                onDoubleClick={(ev) => {
                  if (blocked || (ev.target as HTMLElement).closest("button")) return;
                  const r = ev.currentTarget.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * g.width) / r.width,
                    y = ((ev.clientY - r.top) * g.height) / r.height;
                  if (x > g.box.x && x < g.box.x + g.box.width && y > g.box.y && y < g.box.y + g.box.height) toggleRegion(membership(g, x, y));
                }}
              >
                <div
                  className="vn-art"
                  dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(displayed), e, answers) }}
                />
                {activeMasks(e).map((mask) => {
                  const p = g.anchors[mask];
                  return (
                    <button
                      key={`r${mask}`}
                      className={`vn-hit ${selected === mask ? "vn-selected" : ""}`}
                      data-vn-anchor={`region-${mask}`}
                      data-options-anchor=""
                      data-region-hit={mask}
                      aria-label={`${mode === "shade" ? "Shade" : "Edit"} region: ${regionName(mask, e)}`}
                      title={mode === "shade" ? regionName(mask, e) : `${regionName(mask, e)} · ${pupilSees(d.regions[mask].visibility) === "hidden" ? TARGET_TIP_SPACE : TARGET_TIP}`}
                      disabled={busy || recovery !== null}
                      style={{
                        left: `${(p.x / g.width) * 100}%`,
                        top: `${(p.y / g.height) * 100}%`,
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        chooseRegion(mask, `region-${mask}`);
                      }}
                      onDoubleClick={(ev) => {
                        ev.stopPropagation();
                        toggleRegion(mask);
                      }}
                    />
                  );
                })}
                {g.labelPoints.map((p, i) => (
                  <button
                    key={`l${i}`}
                    className="vn-hit vn-label-hit"
                    data-vn-anchor={`label-${i}`}
                    data-options-anchor=""
                    aria-label={`Edit ${labelName(i)} label`}
                    title={pupilSees(d.labels[i].visibility) === "hidden" ? TARGET_TIP_SPACE : TARGET_TIP}
                    disabled={busy || recovery !== null}
                    style={{
                      left: `${(p.x / g.width) * 100}%`,
                      top: `${(p.y / g.height) * 100}%`,
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openBox("label", i, `label-${i}`);
                    }}
                    onDoubleClick={(ev) => {
                      ev.stopPropagation();
                      toggleLabel(i);
                    }}
                  />
                ))}
                {d.showDefinitions &&
                  d.definitions
                    .slice(0, d.sets + 1)
                    .map((text, index) => ({ text, index }))
                    .filter((x) => x.text)
                    .map(({ index }, row) => (
                      <button
                        key={`d${index}`}
                        className="vn-hit vn-definition-hit"
                        data-vn-anchor={`direct-definition-${index}`}
                        data-options-anchor=""
                        aria-label={`Edit printed ${labelName(index)} definition`}
                        style={{
                          left: "50%",
                          top: `${((4 + g.font * 0.65 + row * (g.font + 2)) / g.height) * 100}%`,
                          width: "94%",
                        }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openBox("definition", index, `direct-definition-${index}`);
                        }}
                      />
                    ))}
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint
                  tool="venn"
                  prompt={
                    mode === "shade"
                      ? "Shade mode: click a region to shade or clear it."
                      : undefined
                  }
                >
                  Click a region or label to edit it. Double-click one for a pupil space.
                </EditorHint>
              }
            >
            </EditorFoot>
            {(draft || issue || note.length > 0) && (
              <div className="vn-status" aria-live="polite">
                {draft && <p>Apply or cancel the set expression before another edit or export.</p>}
                {issue && (
                  <p className="vn-error" role="alert">
                    {issue}
                  </p>
                )}
                {note.map((w) => (
                  <p key={w}>Teacher note: {w}</p>
                ))}
              </div>
            )}
          </Panel>
          <aside ref={stackRef} className="inspector-stack md-kit md-kit--one" aria-label="Venn diagram settings">
            <ReturnToDiagram />
            {/* One folding column: What pupils see, the tools, then the settings. Shade mode swaps the contents for the shading. */}
            <FoldCard tool="venn" title="What pupils see" icon={Eye} defaultOpen summary={seenSummary} help="Each region and label prints its content, a pupil space or nothing. Click one on the diagram for its own choice.">
              {shownRegions.length > 0 && (
                <VisibilitySwitch
                  name="Regions"
                  caption="Regions"
                  disabled={blocked}
                  value={commonVisibility(shownRegions.map((m) => pupilSees(d.regions[m].visibility))) ?? "show"}
                  onChange={(v) =>
                    boxEdit((n) => {
                      for (const m of shownRegions) n.regions[m].visibility = savedVisibility(v, n.regions[m].visibility);
                    }, visibilityStep(v, "all regions"))
                  }
                />
              )}
              {shownLabels.length > 0 && (
                <VisibilitySwitch
                  name="Labels"
                  caption="Labels"
                  disabled={blocked}
                  value={commonVisibility(shownLabels.map((i) => pupilSees(d.labels[i].visibility))) ?? "show"}
                  onChange={(v) =>
                    boxEdit((n) => {
                      for (const i of shownLabels) n.labels[i].visibility = savedVisibility(v, n.labels[i].visibility);
                    }, visibilityStep(v, "all labels"))
                  }
                />
              )}
              {shownRegions.length + shownLabels.length === 0 && <p className="md-kit-note">Type in a region or label first.</p>}
              <PupilSpaceHint
                count={spaceCount}
                disabled={blocked}
                onClear={() =>
                  boxEdit((n) => {
                    for (const r of n.regions) if (r.visibility === "hidden" || r.visibility === "line") r.visibility = "show";
                    for (const l of n.labels) if (l.visibility === "hidden" || l.visibility === "line") l.visibility = "show";
                  }, "clear pupil spaces")
                }
              >
                Double-click a region or label for a pupil space.
              </PupilSpaceHint>
            </FoldCard>
            <FoldCard tool="venn" title="Diagram tools" icon={Wrench} defaultOpen summary={`${mode === "shade" ? "Shade" : "Edit"} · ${d.sets} ${d.sets === 1 ? "set" : "sets"}`}>
              <div className="vn-structure">
                <div
                  className="vn-mode-switch"
                  role="group"
                  aria-label="Diagram mode"
                >
                  <button
                    disabled={blocked}
                    aria-pressed={mode === "edit"}
                    onClick={() => {
                      setMode("edit");
                      setSelected(null);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={blocked}
                    aria-pressed={mode === "shade"}
                    onClick={() => {
                      setMode("shade");
                      setSelected(null);
                    }}
                  >
                    Shade
                  </button>
                </div>
                <label>
                  Number of sets
                  <select
                    aria-label="Number of sets"
                    disabled={blocked}
                    value={d.sets}
                    onChange={(ev) =>
                      selectCount(Number(ev.target.value) as 1 | 2 | 3)
                    }
                  >
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {d.sets === 2 && (
                <div
                  className="vn-arrangements"
                  role="group"
                  aria-label="Set arrangement"
                >
                  {layoutChoices.map((value) => (
                    <button
                      key={value}
                      aria-pressed={
                        value === "b-inside-a"
                          ? nested
                          : arrangement(e) === value
                      }
                      disabled={blocked}
                      onClick={() =>
                        selectArrangement(
                          value === "b-inside-a" &&
                            arrangement(e) === "a-inside-b"
                            ? "a-inside-b"
                            : value,
                        )
                      }
                    >
                      <ArrangementIcon
                        value={
                          value === "b-inside-a" && nested
                            ? arrangement(e)
                            : value
                        }
                      />
                      <span>{arrangementNames[value]}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="vn-view-note">
                {view === "pupil"
                  ? "Pupil view · exports keep your pupil blanks and hidden answers."
                  : "Answer view · exports reveal saved answers only. Editable files keep the pupil settings."}
              </p>
            </FoldCard>
            {mode === "edit" && (
              <FoldCard tool="venn" title="Diagram" icon={Shapes} summary={`${d.shape === "ovals" ? "Wider ovals" : "Circles"} · labels and definitions`}>
                <label>
                  Outline
                  <select
                    aria-label="Outline"
                    disabled={blocked || d.sets === 3}
                    value={d.shape}
                    onChange={(ev) =>
                      patch((n) => {
                        n.shape = ev.target.value as "circles" | "ovals";
                      })
                    }
                  >
                    <option value="circles">Circles</option>
                    <option value="ovals">Wider ovals</option>
                  </select>
                </label>
                {relationship(e) && (
                  <label>
                    Relationship caption
                    <select
                      aria-label="Relationship caption"
                      disabled={blocked}
                      value={e.document.caption}
                      onChange={(ev) => {
                        const n = structuredClone(e);
                        n.document.caption = ev.target.value as
                          | "off"
                          | "relationship"
                          | "line";
                        commit(n);
                      }}
                    >
                      <option value="off">No caption</option>
                      <option value="relationship">
                        {relationship(e)}
                      </option>
                      <option value="line">Pupil answer line</option>
                    </select>
                  </label>
                )}
                <details>
                  <summary>Labels and definitions</summary>
                  <p>
                    Click a label on the diagram or choose it here.
                  </p>
                  {d.labels.slice(0, d.sets + 1).map((l, i) => (
                    <div className="vn-label-row" key={i}>
                      <button
                        data-vn-anchor={"panel-label-" + i}
                        data-options-anchor=""
                        disabled={blocked}
                        onClick={() => openBox("label", i, "panel-label-" + i)}
                      >
                        {panelName(i)}: {l.text || "(empty)"}
                        <small>
                          {l.visibility === "hidden"
                            ? "Pupil space"
                            : l.visibility === "line"
                              ? "Pupil space on a dotted line"
                              : l.visibility === "omit"
                                ? "Left out"
                                : "Edit label"}
                        </small>
                      </button>
                    </div>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={d.showDefinitions}
                      disabled={blocked}
                      onChange={(ev) =>
                        patch((n) => {
                          n.showDefinitions = ev.target.checked;
                        })
                      }
                    />
                    Show definitions above diagram
                  </label>
                  {d.definitions.slice(0, d.sets + 1).map((text, i) => (
                    <button
                      className="vn-definition"
                      key={i}
                      data-vn-anchor={"definition-" + i}
                        data-options-anchor=""
                      disabled={blocked}
                      onClick={() => openBox("definition", i, "definition-" + i)}
                    >
                      {panelName(i)} definition: {text || "Add text"}
                    </button>
                  ))}
                  <p>
                    Definitions describe your sets; they do not fill or
                    calculate regions. Geometry is schematic.
                  </p>
                </details>
              </FoldCard>
            )}
            {mode === "edit" && (
              <FoldCard tool="venn" title="Print size" icon={Ruler} summary={`${d.widthCm} cm wide · ${d.fontPt} pt`}>
                <div className="vn-pair">
                  <label>
                    Print width
                    <select
                      aria-label="Print width"
                      disabled={blocked}
                      value={d.widthCm}
                      onChange={(ev) =>
                        patch((n) => {
                          n.widthCm = Number(ev.target.value);
                        })
                      }
                    >
                      {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((v) => (
                        <option key={v} value={v}>
                          {v} cm
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Text size
                    <select
                      aria-label="Text size"
                      value={d.fontPt}
                      disabled={blocked}
                      onChange={(ev) =>
                        patch((n) => {
                          n.fontPt = Number(ev.target.value);
                        })
                      }
                    >
                      {[10, 11, 12, 13, 14].filter((v) => v >= MIN_TEXT_PT).map((v) => (
                        <option key={v} value={v}>
                          {v} pt
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                  <label>
                    Lines
                    <select
                      aria-label="Lines"
                      value={d.lines ?? "normal"}
                      disabled={blocked}
                      onChange={(ev) =>
                        patch((n) => {
                          setLines(n, ev.target.value as LineWeight);
                        })
                      }
                    >
                      {LINE_WEIGHTS.map((v) => (
                        <option key={v} value={v}>
                          {LINE_WEIGHT_NAMES[v]}
                        </option>
                      ))}
                    </select>
                  </label>
              </FoldCard>
            )}
            {mode === "edit" && (
              <FoldCard tool="venn" title="Region contents" icon={Type} summary={`${activeMasks(e).length} regions`}>
                <p>
                  Click the diagram or choose a region. Lists, frequencies,
                  fractions, algebra and pupil blanks stay editable.
                </p>
                <div className="vn-regions">
                  {activeMasks(e).map((mask) => (
                    <button
                      key={mask}
                      data-vn-anchor={`panel-region-${mask}`}
                        data-options-anchor=""
                      disabled={blocked}
                      onClick={() => {
                        openBox("region", mask, `panel-region-${mask}`);
                      }}
                    >
                      <span>{regionName(mask, e)}</span>
                      <small>
                        {d.regions[mask].visibility === "hidden"
                          ? "Pupil space"
                          : d.regions[mask].visibility === "line"
                            ? "Pupil space on a dotted line"
                            : d.regions[mask].visibility === "omit"
                              ? "Left out"
                              : d.regions[mask].text ||
                              (d.regions[mask].kind === "members"
                                ? "Empty member list"
                                : "Empty space")}
                      </small>
                    </button>
                  ))}
                </div>
                {help}
              </FoldCard>
            )}
            {mode === "shade" && (
              <FoldCard tool="venn" title="Region shading" icon={Paintbrush} defaultOpen summary={shade === "hatch" ? "Monochrome hatching" : "Neutral grey"}>
                <label>
                  Shading style
                  <select
                    aria-label="Shading style"
                    disabled={blocked}
                    value={shade}
                    onChange={(ev) =>
                      setShade(ev.target.value as Region["shade"])
                    }
                  >
                    <option value="grey">Neutral grey</option>
                    <option value="hatch">Monochrome hatching</option>
                  </select>
                </label>
                <button
                  disabled={blocked}
                  data-vn-anchor="expression"
                  onClick={() => open("expression", 0, "expression")}
                >
                  Shade a set expression
                </button>
                <p>
                  Use stable set IDs:{" "}
                  {d.labels
                    .slice(1, d.sets + 1)
                    .map((l, i) => `${"ABC"[i]} = ${l.text || "unnamed"}`)
                    .join("; ")}
                  . ∩ means both; ∪ means either; ' means complement.
                </p>
                <button
                  disabled={blocked}
                  onClick={() =>
                    patch((n) =>
                      n.regions.forEach((r) => {
                        r.shade = "none";
                      }),
                    )
                  }
                >
                  Clear all shading
                </button>
                <div className="vn-regions">
                  {activeMasks(e).map((mask) => (
                    <button
                      key={mask}
                      disabled={blocked}
                      aria-pressed={d.regions[mask].shade !== "none"}
                      onClick={() =>
                        patch((n) => {
                          n.regions[mask].shade =
                            n.regions[mask].shade === shade
                              ? "none"
                              : shade;
                        })
                      }
                    >
                      {regionName(mask, e)}
                      <small>{d.regions[mask].shade}</small>
                    </button>
                  ))}
                </div>
                {help}
              </FoldCard>
            )}
          </aside>
        </section>
        {recovery !== null && (
          <section className="panel-card vn-recovery" role="alert">
            <h2>Protect saved data</h2>
            <p>{message}</p>
            <button
              onClick={() => {
                downloadBlob(
                  new Blob([recovery], { type: "application/json" }),
                  downloadName("venn", "json", { recovery: true }),
                );
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>
              Save current diagram
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
              Keep this diagram and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this diagram"
            onCancel={() => {
              consumeVennLink();
              setPending(null);
            }}
            onConfirm={() => {
              if (busy || recovery !== null || draft !== null) return;
              consumeVennLink();
              commit(pending.e, stepName(pending.title));
              setPending(null);
              setSelected(null);
              setView("pupil");
            }}
          >
            <p>{pending.explanation}</p>
            <div
              className="ratio-import-preview"
              dangerouslySetInnerHTML={{
                __html: renderSvg(forView(pending.e, "pupil")),
              }}
            />
          </RatioDialog>
        )}
        {box && boxAnchor && (
          <OptionsBox
            anchor={boxAnchor}
            anchorKey={box.anchor}
            hidden={!active}
            focusField={!coarse}
            // Beside the diagram, the box stays over the diagram's card and never covers the settings.
            // Beside the whole diagram, so it never covers a neighbouring region or label.
            placeBy={boxAnchor.closest<HTMLElement>(".vn-resource")}
            bounds={boxAnchor.closest(".vn-resource") ? boxAnchor.closest<HTMLElement>(".editor-card") : null}
            title={box.type === "region" ? regionName(box.index, e) : `${panelName(box.index)} ${box.type}`}
            // A refused value keeps the box open, so it stays visible until it is fixed.
            onClose={() => {
              if (!boxError) {
                closeBox();
                setSelected(null);
              }
            }}
          >
            <div className="vn-box">
              {box.type === "region" && (() => {
                const r = d.regions[box.index], seen = pupilSees(r.visibility);
                return (
                  <>
                    <label>
                      Region content
                      <LiveText
                        label="Region content"
                        value={r.text}
                        multiline={r.kind === "members" || r.kind === "empty"}
                        invalid={!!boxError}
                        onRevert={() => setBoxError("")}
                        onCommit={(text) =>
                          boxEdit((n) => {
                            n.regions[box.index].text = text;
                            if (n.regions[box.index].kind === "empty" && text.trim()) n.regions[box.index].kind = "members";
                          }, `edit ${regionWords(box.index)}`)
                        }
                      />
                    </label>
                    <label>
                      Content type
                      <select
                        aria-label="Content type"
                        value={r.kind}
                        disabled={blocked}
                        onChange={(ev) =>
                          boxEdit((n) => {
                            n.regions[box.index].kind = ev.target.value as Region["kind"];
                          }, "content type")
                        }
                      >
                        {kinds.map((k) => (
                          <option key={k} value={k}>
                            {
                              {
                                empty: "Empty space",
                                members: "Member list",
                                frequency: "Frequency",
                                number: "Number or fraction",
                                algebra: "Algebraic label",
                                text: "Ordinary text",
                              }[k]
                            }
                          </option>
                        ))}
                      </select>
                    </label>
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={seen} disabled={blocked} onChange={(v) => setRegionVisibility(box.index, v)} />
                    {seen === "hidden" && (
                      <label className="vn-check">
                        <input
                          type="checkbox"
                          checked={r.visibility === "line"}
                          disabled={blocked}
                          onChange={(ev) =>
                            boxEdit((n) => {
                              n.regions[box.index].visibility = ev.target.checked ? "line" : "hidden";
                            }, ev.target.checked ? "dotted answer line" : "plain pupil space")
                          }
                        />
                        On a dotted answer line
                      </label>
                    )}
                    <p className="vn-note">
                      For members, use commas or new lines (Shift+Enter). An empty member list prints no zero. Empty space keeps any text for later.
                    </p>
                  </>
                );
              })()}
              {box.type === "label" && (() => {
                const l = d.labels[box.index], seen = pupilSees(l.visibility);
                return (
                  <>
                    <label>
                      Label text
                      <LiveText
                        label="Label text"
                        value={l.text}
                        invalid={!!boxError}
                        onRevert={() => setBoxError("")}
                        onCommit={(text) =>
                          boxEdit((n) => {
                            n.labels[box.index].text = text;
                          }, `edit ${labelName(box.index)} label`)
                        }
                      />
                    </label>
                    <VisibilitySwitch name="What pupils see" caption="What pupils see" value={seen} disabled={blocked} onChange={(v) => setLabelVisibility(box.index, v)} />
                    {seen === "hidden" && (
                      <label className="vn-check">
                        <input
                          type="checkbox"
                          checked={l.visibility === "line"}
                          disabled={blocked}
                          onChange={(ev) =>
                            boxEdit((n) => {
                              n.labels[box.index].visibility = ev.target.checked ? "line" : "hidden";
                            }, ev.target.checked ? "dotted answer line" : "plain pupil space")
                          }
                        />
                        On a dotted answer line
                      </label>
                    )}
                  </>
                );
              })()}
              {box.type === "definition" && (
                <label>
                  Definition text
                  <LiveText
                    label="Definition text"
                    value={d.definitions[box.index]}
                    invalid={!!boxError}
                        onRevert={() => setBoxError("")}
                    onCommit={(text) =>
                      boxEdit((n) => {
                        n.definitions[box.index] = text;
                      }, `edit ${labelName(box.index)} definition`)
                    }
                  />
                </label>
              )}
              {boxError && (
                <p className="vn-error" role="alert">
                  {boxError}
                </p>
              )}
            </div>
          </OptionsBox>
        )}
        {draft && (
          <VennFloatingEditor
            active={active && !pending && recovery === null}
            anchor={draft.anchor}
            title={draft.title}
          >
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                applyDraft();
              }}
            >
              <label>
                Set expression
                <input
                  aria-label="Set expression"
                  value={draft.text}
                  aria-invalid={!!draftError}
                  onChange={(ev) => {
                    setDraft({ ...draft, text: ev.target.value });
                    setDraftError("");
                  }}
                />
              </label>
              <>
                  <div className="vn-expression-buttons">
                    {[
                      ..."ABC".slice(0, d.sets),
                      " ∪ ",
                      " ∩ ",
                      "'",
                      "(",
                      ")",
                    ].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() =>
                          setDraft({ ...draft, text: draft.text + s })
                        }
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, text: "" })}
                    >
                      Clear
                    </button>
                  </div>
                  <p className="vn-note">
                    For example {d.sets === 1 ? "A'" : "A ∩ B or (A ∪ B)'"}.
                    Applying replaces the current shading.
                  </p>
                </>

              {draftError && (
                <p className="vn-error" role="alert">
                  {draftError}
                </p>
              )}
              <div className="vn-actions">
                <button type="submit">Apply</button>
                <button type="button" onClick={closeDraft}>
                  Cancel
                </button>
              </div>
            </form>
          </VennFloatingEditor>
        )}
      </main>
    </div>
  );
}
