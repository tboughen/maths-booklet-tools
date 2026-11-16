import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { anglesGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { EditorFoot } from "../site/EditorFoot";
import { ResourceSaveStatus } from "../site/ResourceSaveStatus";
import { EditorDownloadMenu } from "../site/EditorDownloadMenu";
import { diagramFileMenu } from "../site/fileMenu";
import { ResourceSize } from "../site/ResourceSize";
import { AnswerCopyToggle } from "../site/AnswerPreviewToggle";
import { formatResourceSize } from "../site/resourceSizeFormat";
import { EditorToolbar } from "../site/EditorToolbar";
import { EditorHint } from "../site/EditorHint";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, MIN_TEXT_PT, startingTextPt, type LineWeight } from "../../packages/envelope-core/src/house-style";
import {
  angle as makeAngle,
  canonical,
  degrees,
  dragHandles,
  dragTo,
  figurePoint,
  FIGURE_NAMES,
  FIGURES,
  hasHidden,
  hitAnchors,
  irregularCorners,
  layout,
  letterOf,
  MARKS,
  MAX_SIDES,
  MIN_SIDES,
  parseFile,
  pointIdsOf,
  polygonCorners,
  prune,
  rawPoints,
  remapRays,
  renderSvg,
  slotsOf,
  starter,
  validate,
  type Angle,
  type AngleDocument,
  type Envelope,
  type Figure,
  type FigureKind,
  type LabelState,
  type Mark,
  type P,
  type ParallelFigure,
} from "../../packages/angle-core/src";
import { anglesLink, LINK_PREFIX, parseAnglesLink } from "./links";
import { copyWord, downloadBoth, downloadEditable, downloadImage, printPng } from "./export";
import { handleUndoKeys, objectKeyCommand, redoLabel as redoStepName, stepName, undoLabel as undoStepName, useDocumentHistory } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "./angles.css";

const STORAGE = copyStorageKey("maths-booklet-tools:angles:v1");
type View = "pupil" | "answer";
const STATE_NAMES: Record<LabelState, string> = {
  value: "Given size",
  symbol: "Letter",
  blank: "Blank (arc only)",
  "answer-line": "Answer line",
  hidden: "Hidden",
};
const MARK_NAMES: Record<Mark, string> = { arc: "Arc", double: "Double arc", triple: "Triple arc", right: "Right-angle mark", none: "No mark" };
const POINT_NAMES: Record<string, string> = {
  left: "Left end of the line",
  right: "Right end of the line",
  o: "The vertex",
  ta: "Bottom of the transversal",
  tb: "Top of the transversal",
  ua: "Bottom of the second transversal",
  ub: "Top of the second transversal",
  m: "Where the transversals meet",
};
const pointName = (id: string) =>
  POINT_NAMES[id] ??
  (/^r\d+$/.test(id)
    ? `End of ray ${id.slice(1)}`
    : /^v\d+$/.test(id)
      ? `Corner ${id.slice(1)}`
      : /^e\d+$/.test(id)
        ? `End of the extended side at corner ${id.slice(1)}`
        : /^x\d+$/.test(id)
          ? `Where the transversal crosses line ${id.slice(1)}`
          : /^y\d+$/.test(id)
            ? `Where the second transversal crosses line ${id.slice(1)}`
            : /^p\d+v\d+$/.test(id)
              ? `Shape ${id.slice(1, id.indexOf("v"))}, corner ${id.slice(id.indexOf("v") + 1)}`
          : /^l\d+a$/.test(id)
            ? `Left end of line ${id.slice(1, -1)}`
            : /^l\d+b$/.test(id)
              ? `Right end of line ${id.slice(1, -1)}`
              : id);

/** A new diagram starts at the teacher's house style (U111); saved diagrams keep their own settings. */
function housed(e: Envelope): Envelope {
  const house = housePreference(),
    n = structuredClone(e);
  const pt = startingTextPt(house.style, 11, { max: 14 });
  n.document.fontPt = pt === 11 ? undefined : pt;
  n.document.lines = house.lines === "bold" ? "bold" : undefined;
  return validate(n);
}
const fresh = () => housed(starter("straight-line"));

function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return { e: fresh(), recovery: raw, message: "Saved angle diagram data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: fresh(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: fresh(), recovery: null, message: "" };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({ label, value, onCommit, disabled, maxLength = 24, inputMode, invalid }: {
  label: string;
  value: string;
  onCommit: (value: string) => boolean | void;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const commit = () => {
    if (draft === value) {
      setEditing(false);
      setRefused(false);
      return;
    }
    // A refused value stays in the box, marked, so the teacher can correct it.
    const ok = onCommit(draft) !== false;
    setRefused(!ok);
    if (ok) setEditing(false);
  };
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || refused || undefined}
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
          setRefused(false);
        }
      }}
    />
  );
}

const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : NaN);

export default function AnglesPage({ active = true }: { active?: boolean }) {
  const [startup] = useState(initial),
    documentHistory = useDocumentHistory<Envelope>(startup.e, { equals: (a, b) => canonical(a) === canonical(b) }),
    history = documentHistory.history;
  const [recovery, setRecovery] = useState<string | null>(startup.recovery),
    [protectedCopy, setProtectedCopy] = useState(false),
    [message, setMessage] = useState(startup.message),
    [saveState, setSaveState] = useState("Saved on this device"),
    [zoom, setZoom] = useState(0),
    [view, setView] = useState<View>("pupil"),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [drag, setDrag] = useState<{ e: Envelope; label: string } | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null),
    resource = useRef<HTMLDivElement>(null),
    dragStart = useRef<{ id: string; rect: DOMRect; g: ReturnType<typeof layout>; px: number } | null>(null);
  // While a handle is dragged the preview follows it; the move is one undo step when it is let go.
  const e = drag?.e ?? history.present,
    d = e.document,
    f = d.figure,
    g = layout(e),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(e, "answer");
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const slots = slotsOf(d);
  const current = selected && slots.some((s) => s.id === selected) ? selected : null;
  const marked = current ? d.angles.find((a) => a.id === current) : undefined;
  const pxPerMm = (96 / 25.4) * fitted.scale;

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
  function patch(update: (n: AngleDocument) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
  }
  /** Changes the selected angle, marking it first if it is not marked yet. */
  function setAngle(id: string, update: (a: Angle) => void, label?: string) {
    return patch((n) => {
      let a = n.angles.find((x) => x.id === id);
      if (!a) {
        a = makeAngle(id);
        n.angles.push(a);
      }
      update(a);
    }, label);
  }
  function removeAngle(id: string) {
    if (!d.angles.some((a) => a.id === id)) return;
    patch((n) => void (n.angles = n.angles.filter((a) => a.id !== id)), "remove angle");
  }
  /** A new figure keeps every label it still has; Undo brings back any it lost. */
  function setFigure(next: Figure, label: string, remap = false) {
    if (blocked) return false;
    const n = structuredClone(e);
    n.document.figure = next;
    if (remap) Object.assign(n.document, remapRays(d, n.document));
    const kept = prune(n);
    const lostAngles = d.angles.length - kept.document.angles.length,
      lostNames = d.names.length - kept.document.names.length,
      lostLetters = (d.letters?.length ?? 0) - (kept.document.letters?.length ?? 0);
    const ok = commit(kept, label);
    const parts = [
      ...(lostAngles ? [lostAngles === 1 ? "One labelled angle" : `${lostAngles} labelled angles`] : []),
      ...(lostNames ? [lostNames === 1 ? "one point name" : `${lostNames} point names`] : []),
      ...(lostLetters ? [lostLetters === 1 ? "one Z, F or C shape" : `${lostLetters} Z, F or C shapes`] : []),
    ];
    if (ok && parts.length) {
      const one = lostAngles + lostNames + lostLetters === 1;
      const list = parts.join(" and ");
      setMessage(`${list[0].toUpperCase()}${list.slice(1)} ${one ? "is" : "are"} not in the new figure and ${one ? "was" : "were"} removed. Undo brings ${one ? "it" : "them"} back.`);
    }
    return ok;
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current diagram. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
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
        setMessage("Saved data changed in another tab. Download its data before replacing it.");
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
      // U9: Escape deselects; Delete removes the selected angle's mark and label, as one undo step.
      const command = objectKeyCommand(event);
      if (!command || !current || blocked) return;
      if (command.kind === "deselect") setSelected(null);
      else if (command.kind === "delete" && marked) {
        event.preventDefault();
        removeAngle(current);
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
      if (!location.hash.startsWith(LINK_PREFIX) || linkSeen.current === location.href || blocked) return;
      linkSeen.current = location.href;
      try {
        const incoming = parseAnglesLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked angle diagram?");
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
      replace(parseFile(await upload.text()), "Open this angle diagram?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  /* ---------- Figure editing ---------- */

  const rays = f.type === "crossing" ? f.lines : f.type === "straight-line" || f.type === "point" ? f.rays : [];
  const rayRange = f.type === "straight-line" ? [5, 175] : f.type === "crossing" ? [0, 179] : [0, 359.9];
  /** Rays are kept in order of direction, so "Ray 2" in the settings is always the second ray round. */
  function withRays(unsorted: number[]): Figure {
    const list = [...unsorted].sort((a, b) => a - b);
    if (f.type === "crossing") return { ...f, lines: list };
    if (f.type === "straight-line" || f.type === "point") return { ...f, rays: list };
    return f;
  }
  /** Moves one ray. It stays between its neighbours, so every label stays with its angle. */
  function moveRay(i: number, text: string) {
    const v = num(text);
    // Rays are saved in order, so a ray stays between its neighbours (and never wraps past 0°).
    const sorted = [...rays].sort((a, b) => a - b),
      at = i;
    const gapAcross = f.type === "point" ? 360 : f.type === "crossing" ? 180 : 0;
    const lo = Math.max(rayRange[0], at > 0 ? sorted[at - 1] + 5 : gapAcross ? sorted[sorted.length - 1] - gapAcross + 5 : rayRange[0]);
    const hi = Math.min(rayRange[1], at < sorted.length - 1 ? sorted[at + 1] - 5 : gapAcross ? sorted[0] + gapAcross - 5 : rayRange[1]);
    if (!Number.isFinite(v) || v < lo || v > hi) {
      setMessage(`Give a direction from ${Math.ceil(lo)} to ${Math.floor(hi)}°, between the neighbouring ${f.type === "crossing" ? "lines" : "rays"}, so every label stays with its angle.`);
      return false;
    }
    const list = [...sorted];
    list[at] = v;
    return setFigure(withRays(list), "move ray");
  }
  /** Adds a ray in the middle of the widest angle. */
  function addRay() {
    const sorted = [...rays].sort((a, b) => a - b);
    const bounds = f.type === "straight-line" ? [0, ...sorted, 180] : f.type === "crossing" ? [...sorted, sorted[0] + 180] : [...sorted, sorted[0] + 360];
    let best = 0;
    for (let i = 1; i < bounds.length - 1; i++) if (bounds[i + 1] - bounds[i] > bounds[best + 1] - bounds[best]) best = i;
    const v = Math.round((bounds[best] + bounds[best + 1]) / 2) % (f.type === "crossing" ? 180 : 360);
    setFigure(withRays([...rays, v]), f.type === "crossing" ? "add line" : "add ray", true);
  }
  function removeRay(i: number) {
    const sorted = [...rays].sort((a, b) => a - b);
    setFigure(withRays(sorted.filter((_, k) => k !== i)), f.type === "crossing" ? "remove line" : "remove ray", true);
  }
  function changeKind(kind: FigureKind) {
    if (kind === f.type) return;
    const s = starter(kind).document;
    setFigure(s.figure, "change figure");
  }
  function setPolygon(update: (p: Extract<Figure, { type: "polygon" }>) => void, label: string) {
    if (f.type !== "polygon") return false;
    const p = structuredClone(f);
    update(p);
    return setFigure(p, label);
  }
  const corners = f.type === "polygon" ? polygonCorners(f, d.sizeMm) : [];

  /* ---------- Second transversal, Z, F and C shapes, polygons meeting ---------- */

  function setSecond(on: boolean) {
    if (f.type !== "parallel") return;
    if (!on) {
      const { second: _gone, ...rest } = f;
      void _gone;
      setFigure(rest, "remove second transversal");
      return;
    }
    // The mirror image of the first transversal, unless that is too close to it; then a clear offset.
    const angle = Math.abs(180 - 2 * f.crossDeg) >= 20 ? 180 - f.crossDeg : f.crossDeg < 90 ? f.crossDeg + 50 : f.crossDeg - 50;
    for (const offsetMm of [30, 40, 20, -30, 50]) {
      const next: ParallelFigure = { ...f, second: { crossDeg: Math.min(160, Math.max(20, angle)), offsetMm } };
      try {
        validate({ ...e, document: { ...d, figure: next } });
        setFigure(next, "add second transversal");
        return;
      } catch {
        // Try the next offset.
      }
    }
    setMessage("There is no clear room for a second transversal. Change the first transversal's angle or the gap between the lines.");
  }
  /** Pairs offered for a new shape, in teaching order: alternate, corresponding, co-interior. */
  const LETTER_PAIRS: [string, string][] = [
    ["p1-lr", "p2-ul"],
    ["p1-ur", "p2-ur"],
    ["p1-lr", "p2-ur"],
    ["p1-ll", "p2-ur"],
    ["p1-ul", "p2-ul"],
    ["p1-ll", "p2-ul"],
  ];
  function addLetter() {
    const have = new Set((d.letters ?? []).map((l) => [l.a, l.b].sort().join(" ")));
    const offered = f.type === "parallel" && f.second ? [...LETTER_PAIRS, ...LETTER_PAIRS.map(([a, b]) => [a.replace("p", "q"), b.replace("p", "q")] as [string, string])] : LETTER_PAIRS;
    const pair = offered.find(([a, b]) => !have.has([a, b].sort().join(" ")));
    if (pair) patch((n) => void (n.letters = [...(n.letters ?? []), { a: pair[0], b: pair[1] }]), "add shape");
  }
  const letterSlots = slots.filter((s) => /^[pq]\d-/.test(s.id));
  /**
   * Changing one angle of a shape keeps a shape: when the new angle makes no letter with the other one,
   * the other moves to the nearest angle that does, keeping the same letter where it can.
   */
  function withPartner(changed: string, other: string, letter: string | undefined, index: number): string {
    if (letterOf(changed, other)) return other;
    const taken = new Set((d.letters ?? []).filter((_, k) => k !== index).map((l) => [l.a, l.b].sort().join(" ")));
    const line = Number(changed.slice(1, changed.indexOf("-"))),
      near = (id: string) => Math.abs(Number(id.slice(1, id.indexOf("-"))) - line);
    const options = letterSlots.map((s) => s.id).filter((id) => letterOf(changed, id) && !taken.has([changed, id].sort().join(" ")));
    options.sort((x, y) => Number(letterOf(changed, y)!.letter === letter) - Number(letterOf(changed, x)!.letter === letter) || near(x) - near(y));
    return options[0] ?? other;
  }
  function setPolygons(sides: number[], ticks: number, label: string) {
    if (f.type !== "polygons") return false;
    return setFigure({ type: "polygons", sides, ticks }, label);
  }

  /* ---------- Dragging ---------- */

  const handles = blocked && !drag ? [] : dragHandles(d);
  const points = rawPoints(d);
  function dragAt(id: string, clientX: number, clientY: number, fine: boolean) {
    const start = dragStart.current;
    if (!start || start.id !== id) return;
    // The drag reads the layout from when it began, so the diagram growing under the pointer does not feed back.
    const p = figurePoint(start.g, history.present.document.turnDeg, { x: (clientX - start.rect.left) / start.px, y: (clientY - start.rect.top) / start.px });
    // Each step starts from where the preview has got to, so a long drag of a transversal stops at its limit.
    const next = dragTo(drag?.e ?? history.present, id, p, fine);
    if (next) setDrag({ e: next, label: id.startsWith("v") ? "drag corner" : f.type === "parallel" ? "drag transversal" : f.type === "crossing" ? "drag line" : "drag ray" });
  }
  function endDrag() {
    dragStart.current = null;
    if (drag) commit(drag.e, drag.label);
    setDrag(null);
  }
  /** Arrow keys move a handle: directions by 5° (1° with Shift), points by 1 mm (0.5 mm with Shift). */
  function nudge(id: string, key: string, fine: boolean, pivot: P | null) {
    const at = points[id]?.at;
    if (!at) return;
    const sign = key === "ArrowRight" || key === "ArrowUp" ? 1 : -1;
    let p: P;
    if (pivot) {
      const r = ((sign * (fine ? 1 : 5)) * Math.PI) / 180,
        v = { x: at.x - pivot.x, y: at.y - pivot.y };
      p = { x: pivot.x + v.x * Math.cos(r) - v.y * Math.sin(r), y: pivot.y + v.x * Math.sin(r) + v.y * Math.cos(r) };
    } else {
      // Arrow keys move the point across and up the screen, whatever the figure's turn.
      const step = fine ? 0.5 : 1,
        sx = key === "ArrowRight" ? step : key === "ArrowLeft" ? -step : 0,
        sy = key === "ArrowUp" ? step : key === "ArrowDown" ? -step : 0,
        r = (-d.turnDeg * Math.PI) / 180;
      p = { x: at.x + sx * Math.cos(r) - sy * Math.sin(r), y: at.y + sx * Math.sin(r) + sy * Math.cos(r) };
    }
    const next = dragTo(history.present, id, p, true);
    if (next) commit(next, id.startsWith("v") ? "move corner" : f.type === "parallel" ? "move transversal" : f.type === "crossing" ? "move line" : "move ray");
    else setMessage("That handle cannot move further that way: rays stay between their neighbours and polygons stay convex.");
  }

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const anchors = hitAnchors(e);
  const slotName = (id: string) => slots.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="app-shell booklet-editor pt-editor ang-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Angle diagrams" description="Draw angles on straight lines and round points, parallel lines with a transversal, and polygons, with sizes given or left for pupils.">
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
              onReset={() => replace(fresh(), "Reset the angle diagram?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="angles-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="angles-downloads"
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
                link: { action: () => navigator.clipboard.writeText(anglesLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
                  ref={resource}
                  data-testid="angles-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) setSelected(null);
                  }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(e, view), e, view === "answer") }} />
                  {anchors.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`ang-hit${a.id === current ? " ang-current" : ""}${d.angles.some((x) => x.id === a.id) ? "" : " ang-unmarked"}`}
                      style={{ left: a.at.x * pxPerMm, top: a.at.y * pxPerMm }}
                      aria-label={`Select ${a.name} (${a.id})`}
                      aria-pressed={a.id === current}
                      disabled={blocked}
                      onClick={() => setSelected(a.id)}
                    />
                  ))}
                  {handles.map((h) => {
                    const at = g.map(g.geometry.points[h.id].at);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        className="ang-handle"
                        style={{ left: at.x * pxPerMm, top: at.y * pxPerMm }}
                        aria-label={`Drag ${h.name}`}
                        title={`Drag ${h.name}. Arrow keys move it too; hold Shift for small steps.`}
                        disabled={blocked && !drag}
                        onPointerDown={(ev) => {
                          if (blocked || !resource.current) return;
                          ev.preventDefault();
                          ev.currentTarget.setPointerCapture?.(ev.pointerId);
                          dragStart.current = { id: h.id, rect: resource.current.getBoundingClientRect(), g, px: pxPerMm };
                        }}
                        onPointerMove={(ev) => dragAt(h.id, ev.clientX, ev.clientY, ev.shiftKey)}
                        onPointerUp={endDrag}
                        onPointerCancel={() => {
                          dragStart.current = null;
                          setDrag(null);
                        }}
                        onKeyDown={(ev) => {
                          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key) || blocked) return;
                          ev.preventDefault();
                          nudge(h.id, ev.key, ev.shiftKey, h.pivot);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={
                <EditorHint tool="angles">Click an angle on the diagram to mark and label it. Drag the round handles to move rays, transversals and corners.</EditorHint>
              }
            >
              <AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />
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
          <aside className="inspector-stack" aria-label="Angle diagram settings">
            <ExampleGallery
              examples={anglesGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) => commit(resource, "use worked version")}
            />
            <section className="panel-card pt-panel" aria-label="Selected angle">
              <h2>{current ? `Angle: ${slotName(current)}` : "Selected angle"}</h2>
              <div className="pt-fields">
                <label>
                  Angle
                  <select aria-label="Angle to edit" value={current ?? ""} disabled={blocked} onChange={(ev) => setSelected(ev.target.value || null)}>
                    <option value="">Choose an angle</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id}){d.angles.some((a) => a.id === s.id) ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {current ? (
                <>
                  <div className="pt-fields">
                    <label>
                      Label
                      <select
                        aria-label="Label shows"
                        value={marked?.label.state ?? "blank"}
                        disabled={blocked}
                        onChange={(ev) => {
                          const state = ev.target.value as LabelState;
                          if (state === "value" && marked?.label.answer) {
                            setMessage("A given size prints on both copies, so it cannot keep a saved answer. Clear the saved answer first.");
                            return;
                          }
                          if ((state === "value" || state === "symbol") && !marked?.label.text) {
                            setMessage(state === "value" ? "Type the given size first, such as 62 or 2x + 10." : "Type the letter first, such as x.");
                            return;
                          }
                          setAngle(current, (a) => void (a.label.state = state), "change label");
                        }}
                      >
                        {(Object.keys(STATE_NAMES) as LabelState[]).map((s) => (
                          <option key={s} value={s}>
                            {STATE_NAMES[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Text
                      <DraftField
                        label="Label text"
                        value={marked?.label.text ?? ""}
                        disabled={blocked}
                        onCommit={(v) =>
                          setAngle(current, (a) => {
                            a.label.text = v.trim();
                            // Typing a size or a letter shows it; clearing it leaves an arc.
                            if (!a.label.text && (a.label.state === "value" || a.label.state === "symbol")) a.label.state = "blank";
                            // Typing on a plain arc shows the text; hidden and answer-line labels stay as they are.
                            else if (a.label.text && a.label.state === "blank") a.label.state = /\d/.test(a.label.text) && !a.label.answer ? "value" : "symbol";
                          }, "edit label")
                        }
                      />
                    </label>
                    <label>
                      Saved answer
                      <DraftField
                        label="Saved answer (answers copy only)"
                        value={marked?.label.answer ?? ""}
                        disabled={blocked || marked?.label.state === "value"}
                        onCommit={(v) => setAngle(current, (a) => void (a.label.answer = v.trim()), "edit answer")}
                      />
                    </label>
                    <label>
                      Mark
                      <select aria-label="Angle mark" value={marked?.mark ?? "none"} disabled={blocked} onChange={(ev) => setAngle(current, (a) => void (a.mark = ev.target.value as Mark), "change mark")}>
                        {MARKS.map((m) => (
                          <option key={m} value={m}>
                            {MARK_NAMES[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="pt-note">A given size prints with a degree sign (62°, (2x + 10)°); a letter prints as typed. A saved answer prints only on the answers copy.</p>
                  <label className="pt-hide">
                    <input type="checkbox" disabled={blocked} checked={!!marked?.shade} onChange={(ev) => setAngle(current, (a) => void (a.shade = ev.target.checked), "shade angle")} />
                    Shade this angle (for teaching pairs of angles)
                  </label>
                  {marked?.label.state === "value" && <p className="pt-note">A given size is printed on both copies, so it has no saved answer.</p>}
                  {marked && marked.label.state !== "value" && marked.label.answer && (
                    <p className="pt-note">The answers copy prints {degrees(marked.label.answer)} here in pink; the pupil copy never shows it.</p>
                  )}
                  <div className="pt-row">
                    <button type="button" disabled={blocked || !marked} onClick={() => removeAngle(current)}>
                      Remove mark and label
                    </button>
                  </div>
                </>
              ) : (
                <p className="pt-note">Click an angle on the diagram, or choose one above, to mark and label it.</p>
              )}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const a of n.angles)
                        if (a.label.state !== "value" && a.label.answer) {
                          a.label.text = a.label.answer;
                          a.label.state = "value";
                          a.label.answer = "";
                        }
                    }, "show all")
                  }
                >
                  Print every saved answer on the pupil copy
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel" aria-label="Figure">
              <h2>Figure</h2>
              <div className="pt-fields">
                <label>
                  Figure
                  <select aria-label="Figure" value={f.type} disabled={blocked} onChange={(ev) => changeKind(ev.target.value as FigureKind)}>
                    {FIGURES.map((k) => (
                      <option key={k} value={k}>
                        {FIGURE_NAMES[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {(f.type === "straight-line" || f.type === "point" || f.type === "crossing") && (
                <>
                  <p className="pt-note">
                    Directions are in degrees, anticlockwise from the right{f.type === "straight-line" ? ", between 5 and 175 above the line" : ""}. The drawing does not have to match the sizes you print.
                  </p>
                  {[...rays].sort((a, b) => a - b).map((r, i) => (
                    <div key={i} className="pt-row ang-ray">
                      <label>
                        {f.type === "crossing" ? `Line ${i + 1}` : `Ray ${i + 1}`}
                        <DraftField label={`${f.type === "crossing" ? "Line" : "Ray"} ${i + 1} direction`} value={String(r)} inputMode="decimal" maxLength={6} disabled={blocked} onCommit={(v) => moveRay(i, v)} />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${f.type === "crossing" ? "line" : "ray"} ${i + 1}`}
                        disabled={blocked || rays.length <= (f.type === "straight-line" ? 1 : 2)}
                        onClick={() => removeRay(i)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="pt-row">
                    <button type="button" disabled={blocked || rays.length >= (f.type === "straight-line" ? 5 : f.type === "crossing" ? 3 : 8)} onClick={addRay}>
                      {f.type === "crossing" ? "Add a line" : "Add a ray"}
                    </button>
                  </div>
                </>
              )}
              {f.type === "parallel" && (
                <div className="pt-fields">
                  <label>
                    Parallel lines
                    <select aria-label="Number of parallel lines" value={f.count} disabled={blocked} onChange={(ev) => setFigure({ ...f, count: Number(ev.target.value) as 2 | 3 }, "change lines")}>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                  <label>
                    Transversal angle (°)
                    <DraftField
                      label="Transversal angle"
                      value={String(f.crossDeg)}
                      inputMode="decimal"
                      maxLength={6}
                      disabled={blocked}
                      onCommit={(v) => {
                        const x = num(v);
                        if (!(x >= 20 && x <= 160)) {
                          setMessage("Give the transversal an angle from 20 to 160°.");
                          return false;
                        }
                        return setFigure({ ...f, crossDeg: x }, "turn transversal");
                      }}
                    />
                  </label>
                  <label>
                    Gap between lines
                    <select aria-label="Gap between lines" value={f.gapMm} disabled={blocked} onChange={(ev) => setFigure({ ...f, gapMm: Number(ev.target.value) }, "change gap")}>
                      {[16, 20, 24, 28, 32, 40].concat(f.gapMm).filter((v, k, a) => a.indexOf(v) === k).sort((a, b) => a - b).map((v) => (
                        <option key={v} value={v}>
                          {v} mm
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Arrow marks
                    <select aria-label="Arrow marks" value={f.arrows} disabled={blocked} onChange={(ev) => setFigure({ ...f, arrows: Number(ev.target.value) }, "change arrows")}>
                      {[0, 1, 2, 3].map((v) => (
                        <option key={v} value={v}>
                          {v === 0 ? "None" : v === 1 ? "Single arrow" : v === 2 ? "Double arrow" : "Triple arrow"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {f.type === "parallel" && (
                <>
                  <label className="pt-hide">
                    <input type="checkbox" disabled={blocked} checked={!!f.second} onChange={(ev) => setSecond(ev.target.checked)} />
                    Second transversal
                  </label>
                  {f.second && (
                    <div className="pt-fields">
                      <label>
                        Its angle (°)
                        <DraftField
                          label="Second transversal angle"
                          value={String(f.second.crossDeg)}
                          inputMode="decimal"
                          maxLength={6}
                          disabled={blocked}
                          onCommit={(v) => {
                            const x = num(v);
                            if (!(x >= 20 && x <= 160)) {
                              setMessage("Give the second transversal an angle from 20 to 160°.");
                              return false;
                            }
                            return setFigure({ ...f, second: { ...f.second!, crossDeg: x } }, "turn second transversal");
                          }}
                        />
                      </label>
                      <label>
                        Along the top line (mm)
                        <DraftField
                          label="Second transversal offset"
                          value={String(f.second.offsetMm)}
                          inputMode="decimal"
                          maxLength={6}
                          disabled={blocked}
                          onCommit={(v) => {
                            const x = num(v);
                            if (!(x >= -80 && x <= 80)) {
                              setMessage("Give an offset from -80 to 80 mm: how far along the top line the second transversal crosses, right of the first.");
                              return false;
                            }
                            return setFigure({ ...f, second: { ...f.second!, offsetMm: x } }, "move second transversal");
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {f.second && <p className="pt-note">Where the two transversals meet between or near the lines, its four angles (m1 to m4) can be marked, and a teacher note checks each triangle adds to 180°.</p>}
                  <fieldset className="ang-corners ang-letters">
                    <legend>Z, F and C shapes</legend>
                    <p className="pt-note">Pick a pair of angles: alternate angles make a Z, corresponding angles an F, co-interior angles a C. The shape prints thick and grey under the lines.</p>
                    {(d.letters ?? []).map((l, i) => {
                      const shape = letterOf(l.a, l.b);
                      const set = (next: { a: string; b: string }) => patch((n) => void (n.letters = (n.letters ?? []).map((x, k) => (k === i ? next : x))), "change shape");
                      const choose = (side: "a" | "b", id: string) =>
                        set(side === "a" ? { a: id, b: withPartner(id, l.b, shape?.letter, i) } : { a: withPartner(id, l.a, shape?.letter, i), b: id });
                      return (
                        <div key={i} className="pt-row ang-letter">
                          {(["a", "b"] as const).map((side) => (
                            <select key={side} aria-label={`Shape ${i + 1} ${side === "a" ? "first" : "second"} angle`} value={l[side]} disabled={blocked} onChange={(ev) => choose(side, ev.target.value)}>
                              {letterSlots.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.id})
                                </option>
                              ))}
                            </select>
                          ))}
                          <span className="ang-letter-name">{shape ? `${shape.letter}: ${shape.name}` : ""}</span>
                          <button type="button" aria-label={`Remove shape ${i + 1}`} disabled={blocked} onClick={() => patch((n) => void (n.letters = (n.letters ?? []).filter((_, k) => k !== i)), "remove shape")}>
                            Remove
                          </button>
                        </div>
                      );
                    })}
                    <div className="pt-row">
                      <button type="button" disabled={blocked || (d.letters?.length ?? 0) >= 3} onClick={addLetter}>
                        Add a Z, F or C shape
                      </button>
                    </div>
                  </fieldset>
                </>
              )}
              {f.type === "polygons" && (
                <>
                  <div className="pt-fields">
                    <label>
                      Polygons
                      <select
                        aria-label="Number of polygons"
                        value={f.sides.length}
                        disabled={blocked}
                        onChange={(ev) => {
                          if (Number(ev.target.value) === 2) return void setPolygons(f.sides.slice(0, 2), f.ticks, "remove polygon");
                          // The third polygon takes the most sides that still fit round the corner.
                          for (const extra of [8, 6, 5, 4, 3])
                            try {
                              validate({ ...e, document: { ...d, figure: { ...f, sides: [...f.sides, extra] } } });
                              return void setPolygons([...f.sides, extra], f.ticks, "add polygon");
                            } catch {
                              // Too wide; try fewer sides.
                            }
                          setMessage("There is no room for a third polygon at the shared corner. Use polygons with fewer sides.");
                        }}
                      >
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                    {f.sides.map((n, k) => (
                      <label key={k}>
                        Shape {k + 1} sides
                        <select
                          aria-label={`Sides of shape ${k + 1}`}
                          value={n}
                          disabled={blocked}
                          onChange={(ev) => setPolygons(f.sides.map((x, j) => (j === k ? Number(ev.target.value) : x)), f.ticks, "change sides")}
                        >
                          {Array.from({ length: MAX_SIDES - MIN_SIDES + 1 }, (_, j) => j + MIN_SIDES).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label>
                      Equal-side ticks
                      <select aria-label="Equal-side ticks on every side" value={f.ticks} disabled={blocked} onChange={(ev) => setPolygons(f.sides, Number(ev.target.value), "change ticks")}>
                        {[0, 1, 2, 3].map((v) => (
                          <option key={v} value={v}>
                            {v === 0 ? "None" : `${v} on every side`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="pt-note">Regular polygons round one corner, each sharing a side with the next. Any space left at the corner is the gap angle g.</p>
                </>
              )}
              {f.type === "polygon" && (
                <>
                  <div className="pt-fields">
                    <label>
                      Sides
                      <select
                        aria-label="Number of sides"
                        value={corners.length}
                        disabled={blocked}
                        onChange={(ev) => {
                          const sides = Number(ev.target.value);
                          setPolygon((p) => {
                            p.sides = sides;
                            p.corners = p.corners ? irregularCorners(sides, d.sizeMm) : null;
                            p.ticks = Array(sides).fill(p.corners ? 0 : (p.ticks[0] ?? 1));
                            p.exterior = p.exterior.filter((k) => k <= sides);
                          }, "change sides");
                        }}
                      >
                        {Array.from({ length: MAX_SIDES - MIN_SIDES + 1 }, (_, k) => k + MIN_SIDES).map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Shape
                      <select
                        aria-label="Regular or irregular"
                        value={f.corners ? "irregular" : "regular"}
                        disabled={blocked}
                        onChange={(ev) =>
                          setPolygon((p) => {
                            const irregular = ev.target.value === "irregular";
                            p.corners = irregular ? irregularCorners(p.sides, d.sizeMm) : null;
                            p.ticks = Array(p.sides).fill(irregular ? 0 : 1);
                          }, ev.target.value === "irregular" ? "make irregular" : "make regular")
                        }
                      >
                        <option value="regular">Regular</option>
                        <option value="irregular">Irregular</option>
                      </select>
                    </label>
                    <label>
                      Equal-side ticks
                      <select
                        aria-label="Equal-side ticks on every side"
                        value={f.ticks.every((t) => t === f.ticks[0]) ? f.ticks[0] : "mixed"}
                        disabled={blocked}
                        onChange={(ev) => setPolygon((p) => void (p.ticks = Array(p.sides).fill(Number(ev.target.value))), "change ticks")}
                      >
                        {!f.ticks.every((t) => t === f.ticks[0]) && <option value="mixed">Different on each side</option>}
                        {[0, 1, 2, 3].map((v) => (
                          <option key={v} value={v}>
                            {v === 0 ? "None" : `${v} on every side`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="pt-hide">
                    <input type="checkbox" disabled={blocked} checked={f.diagonals} onChange={(ev) => setPolygon((p) => void (p.diagonals = ev.target.checked), "diagonals")} />
                    Dashed diagonals from corner 1 (split into triangles)
                  </label>
                  <fieldset className="ang-corners">
                    <legend>Extend a side to show the exterior angle at corner</legend>
                    {corners.map((_, k) => (
                      <label key={k} className="pt-hide">
                        <input
                          type="checkbox"
                          aria-label={`Exterior angle at corner ${k + 1}`}
                          disabled={blocked}
                          checked={f.exterior.includes(k + 1)}
                          onChange={(ev) =>
                            setPolygon((p) => {
                              p.exterior = ev.target.checked ? [...p.exterior, k + 1].sort((a, b) => a - b) : p.exterior.filter((x) => x !== k + 1);
                            }, "exterior angle")
                          }
                        />
                        {k + 1}
                      </label>
                    ))}
                  </fieldset>
                  <details>
                    <summary>Corners and side ticks</summary>
                    <p className="pt-note">Corners are numbered anticlockwise from the bottom left. Positions are in mm from the centre (up is positive); changing one makes the polygon irregular.</p>
                    <table className="ang-corner-table">
                      <thead>
                        <tr>
                          <th scope="col">Corner</th>
                          <th scope="col">Across</th>
                          <th scope="col">Up</th>
                          <th scope="col">Ticks on the next side</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corners.map((c, k) => (
                          <tr key={k}>
                            <th scope="row">{k + 1}</th>
                            {(["x", "y"] as const).map((axis) => (
                              <td key={axis}>
                                <DraftField
                                  label={`Corner ${k + 1} ${axis === "x" ? "across" : "up"}`}
                                  value={String(Math.round(c[axis] * 10) / 10)}
                                  inputMode="decimal"
                                  maxLength={7}
                                  disabled={blocked}
                                  onCommit={(v) => {
                                    const x = num(v);
                                    if (!Number.isFinite(x)) {
                                      setMessage("Give a number of millimetres.");
                                      return false;
                                    }
                                    return setPolygon((p) => {
                                      p.corners = corners.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 }));
                                      p.corners[k] = { ...p.corners[k], [axis]: x };
                                    }, "move corner");
                                  }}
                                />
                              </td>
                            ))}
                            <td>
                              <select
                                aria-label={`Ticks on side ${k + 1}`}
                                value={f.ticks[k]}
                                disabled={blocked}
                                onChange={(ev) => setPolygon((p) => void (p.ticks[k] = Number(ev.target.value)), "change ticks")}
                              >
                                {[0, 1, 2, 3].map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </section>
            <section className="panel-card pt-panel" aria-label="Point names">
              <details>
                <summary>Point names (A, B, C …)</summary>
                <p className="pt-note">Letters print upright beside their points, for questions such as “Work out the size of angle ABC”.</p>
                <div className="pt-fields">
                  {pointIdsOf(d).map((id) => (
                    <label key={id}>
                      {pointName(id)}
                      <DraftField
                        label={`Name of ${pointName(id).toLowerCase()}`}
                        value={d.names.find((x) => x.id === id)?.text ?? ""}
                        maxLength={3}
                        disabled={blocked}
                        onCommit={(v) =>
                          patch((n) => {
                            n.names = n.names.filter((x) => x.id !== id);
                            if (v.trim()) n.names.push({ id, text: v.trim() });
                          }, "name point")
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
            </section>
            <section className="panel-card pt-panel">
              <h2>Printing</h2>
              <div className="pt-fields">
                <label>
                  Size
                  <select aria-label="Diagram size" value={d.sizeMm} disabled={blocked} onChange={(ev) => {
                    const size = Number(ev.target.value);
                    patch((n) => {
                      // An irregular polygon grows with the size, like a regular one.
                      if (n.figure.type === "polygon" && n.figure.corners) n.figure.corners = n.figure.corners.map((c) => ({ x: Math.round(((c.x * size) / d.sizeMm) * 10) / 10, y: Math.round(((c.y * size) / d.sizeMm) * 10) / 10 }));
                      n.sizeMm = size;
                    }, "change size");
                  }}>
                    {[40, 50, 60, 70, 80, 90, 100, 120].concat(d.sizeMm).filter((v, k, a) => a.indexOf(v) === k).sort((a, b) => a - b).map((v) => (
                      <option key={v} value={v}>
                        {v} mm
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Turn (°)
                  <DraftField
                    label="Turn the figure"
                    value={String(d.turnDeg)}
                    inputMode="decimal"
                    maxLength={5}
                    disabled={blocked}
                    onCommit={(v) => {
                      const x = num(v);
                      if (!(x >= 0 && x <= 359)) {
                        setMessage("Turn the figure by 0 to 359°.");
                        return false;
                      }
                      return patch((n) => void (n.turnDeg = x), "turn figure");
                    }}
                  />
                </label>
                <label>
                  Text size
                  <select aria-label="Text size" value={d.fontPt ?? 11} disabled={blocked} onChange={(ev) => patch((n) => void (n.fontPt = Number(ev.target.value)), "change text size")}>
                    {[10, 11, 12, 13, 14].filter((v) => v >= MIN_TEXT_PT).map((v) => (
                      <option key={v} value={v}>
                        {v} pt
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lines
                  <select aria-label="Lines" value={d.lines ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => setLines(n, ev.target.value as LineWeight), "change lines")}>
                    {LINE_WEIGHTS.map((v) => (
                      <option key={v} value={v}>
                        {LINE_WEIGHT_NAMES[v]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.notToScale} onChange={(ev) => patch((n) => void (n.notToScale = ev.target.checked), "not accurately drawn")} />
                Print “Diagram NOT accurately drawn”
              </label>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  The drawing never has to match the sizes: exam angle diagrams are not accurately drawn. When given sizes cannot all be right (a
                  straight line that does not make 180°, unequal vertically opposite or corresponding angles, a polygon’s angle sum) a teacher note
                  says so. Leave it if the error is deliberate.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the diagram; preview zoom never changes it. Download PNG (600 ppi) or PDF if
                  your browser blocks copying, and print at 100% (actual size).
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("angles", "json", { recovery: true }));
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
  );
}
