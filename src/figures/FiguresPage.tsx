import { useTitleNote } from "../site/TitleNote";
import { useWorkedNotes } from "../site/WorkedNotes";
import { WORKED_STEP, withWorkedNotes } from "../site/workedNotesData";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery, ReturnToDiagram } from "../examples/ExampleGallery";
import { figuresGallery } from "../examples/galleryCatalogue";
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
import { housePreference, setLines } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, MIN_TEXT_PT, startingTextPt, type LineWeight } from "../../packages/envelope-core/src/house-style";
import {
  canonical,
  create,
  dependents,
  dragHandles,
  dragTo,
  hasHidden,
  hitAnchors,
  label as makeLabel,
  layout,
  LIMITS,
  MARKS,
  parseFile,
  PLACES,
  printed,
  renderSvg,
  SHOWS,
  SIDES,
  STYLES,
  validate,
  type Envelope,
  type FigureDocument,
  type Label,
  type LabelState,
  type Mark,
  type P,
  type Place,
  type PlaceType,
} from "../../packages/figure-core/src";
import { figuresLink, LINK_PREFIX, parseFiguresLink } from "./links";
import { copyWord, downloadBoth, downloadEditable, downloadImage, printPng } from "./export";
import { handleUndoKeys, objectKeyCommand, openDraft, redoLabel as redoStepName, stepName, undoLabel as undoStepName, useDocumentHistory, useDraftAutosave } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "../area/area.css";
import "./figures.css";

const STORAGE = copyStorageKey("maths-booklet-tools:figures:v1");
type View = "pupil" | "answer";
type Kind = "point" | "circle" | "segment" | "angle";
const STATE_NAMES: Record<LabelState, string> = {
  value: "Given",
  symbol: "Letter",
  blank: "Blank (nothing printed)",
  "answer-line": "Answer line",
  hidden: "Hidden",
};
const MARK_NAMES: Record<Mark, string> = { none: "No mark", arc: "Arc", double: "Double arc", triple: "Triple arc", right: "Right angle" };
const STYLE_NAMES: Record<(typeof STYLES)[number], string> = { solid: "Solid", dashed: "Dashed", dotted: "Dotted" };
const SHOW_NAMES: Record<(typeof SHOWS)[number], string> = { none: "Nothing", dot: "Dot", cross: "Cross" };
const SIDE_NAMES: Record<(typeof SIDES)[number], string> = { auto: "Outside the shape", left: "Left (looking along it)", right: "Right (looking along it)" };
const PLACE_NAMES: Record<PlaceType, string> = {
  free: "Anywhere",
  on: "On a circle",
  along: "On a line through two points",
  meet: "Where two lines cross",
  tangent: "Along the tangent at a point",
  tangents: "Where two tangents meet",
  foot: "Foot of a perpendicular",
};
type Field = { key: string; label: string; ref?: "point" | "circle" | "onPoint"; min?: number; max?: number };
const PLACE_FIELDS: Record<PlaceType, Field[]> = {
  free: [
    { key: "x", label: "Across (mm)", min: -150, max: 150 },
    { key: "y", label: "Up (mm)", min: -150, max: 150 },
  ],
  on: [
    { key: "circle", label: "Circle", ref: "circle" },
    { key: "deg", label: "Direction (°)", min: 0, max: 360 },
  ],
  along: [
    { key: "a", label: "From", ref: "point" },
    { key: "b", label: "Towards", ref: "point" },
    { key: "t", label: "Fraction along", min: -3, max: 4 },
  ],
  meet: [
    { key: "a", label: "Line 1 from", ref: "point" },
    { key: "b", label: "Line 1 to", ref: "point" },
    { key: "c", label: "Line 2 from", ref: "point" },
    { key: "d", label: "Line 2 to", ref: "point" },
  ],
  tangent: [
    { key: "at", label: "Touching at", ref: "onPoint" },
    { key: "mm", label: "Distance (mm)", min: -200, max: 200 },
  ],
  tangents: [
    { key: "a", label: "First touch point", ref: "onPoint" },
    { key: "b", label: "Second touch point", ref: "onPoint" },
  ],
  foot: [
    { key: "from", label: "From", ref: "point" },
    { key: "a", label: "Line from", ref: "point" },
    { key: "b", label: "Line to", ref: "point" },
  ],
};

/** A new figure starts at the teacher's house style (U111); saved figures keep their own settings. */
function housed(e: Envelope): Envelope {
  const house = housePreference(),
    n = structuredClone(e);
  const pt = startingTextPt(house.style, 11, { max: 14 });
  n.document.fontPt = pt === 11 ? undefined : pt;
  n.document.lines = house.lines === "bold" ? "bold" : undefined;
  return validate(n);
}
const fresh = () => housed(create());

function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh, recoveryMessage: "Saved geometry figure data needs recovery. Download the original before starting afresh." });
  return { e: start.document, recovery: start.recovery, message: start.message };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({ label, value, onCommit, disabled, maxLength = 24, inputMode }: {
  label: string;
  value: string;
  onCommit: (value: string) => boolean | void;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "decimal" | "text";
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
      aria-invalid={refused || undefined}
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
const round = (v: number) => Math.round(v * 100) / 100;
const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;
const split = (key: string) => {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) as Kind, id: key.slice(i + 1) };
};
/** Every id the figure uses, so a new object never takes one already in use. */
function nextId(d: FigureDocument, prefix: string) {
  const used = new Set([...d.points, ...d.circles, ...d.segments, ...d.angles, ...d.fills, ...d.captions].map((x) => x.id));
  for (let k = 1; ; k++) if (!used.has(`${prefix}${k}`)) return `${prefix}${k}`;
}
/** Removes an object and everything built on it. Returns how many other objects went with it. */
function removeWithDependents(d: FigureDocument, kind: Kind, rid: string): number {
  const gone = kind === "point" || kind === "circle" ? dependents(d, kind, rid) : { points: [], circles: [], segments: [], angles: [], fills: [] };
  const drop = (list: { id: string }[], ids: string[], self: boolean) => list.filter((x) => !ids.includes(x.id) && !(self && x.id === rid));
  d.points = drop(d.points, gone.points, kind === "point") as typeof d.points;
  d.circles = drop(d.circles, gone.circles, kind === "circle") as typeof d.circles;
  d.segments = drop(d.segments, gone.segments, kind === "segment") as typeof d.segments;
  d.angles = drop(d.angles, gone.angles, kind === "angle") as typeof d.angles;
  d.fills = drop(d.fills, gone.fills, false) as typeof d.fills;
  return gone.points.length + gone.circles.length + gone.segments.length + gone.angles.length + gone.fills.length;
}

/** The label editor shared by sides and angles. */
function LabelFields({ value, isAngle, disabled, onChange, onMessage }: {
  value: Label;
  isAngle: boolean;
  disabled: boolean;
  onChange: (update: (l: Label) => void, step: string) => boolean;
  onMessage: (text: string) => void;
}) {
  return (
    <>
      <div className="pt-fields">
        <label>
          Label
          <select
            aria-label="Label shows"
            value={value.state}
            disabled={disabled}
            onChange={(ev) => {
              const state = ev.target.value as LabelState;
              if (state === "value" && value.answer) return onMessage(`A given ${isAngle ? "size" : "length"} prints on both copies, so it cannot keep a saved answer. Clear the saved answer first.`);
              if ((state === "value" || state === "symbol") && !value.text) return onMessage(state === "value" ? (isAngle ? "Type the size first, such as 62." : "Type the length first, such as 8 cm.") : "Type the letter first, such as x.");
              onChange((l) => void (l.state = state), "change label");
            }}
          >
            {(Object.keys(STATE_NAMES) as LabelState[]).map((x) => (
              <option key={x} value={x}>
                {STATE_NAMES[x]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Text
          <DraftField
            label="Label text"
            value={value.text}
            disabled={disabled}
            onCommit={(v) =>
              onChange((l) => {
                l.text = v.trim();
                // Typing a size or a letter shows it; clearing it leaves the place blank.
                if (!l.text && (l.state === "value" || l.state === "symbol")) l.state = l.answer ? "hidden" : "blank";
                else if (l.text && l.state === "blank") l.state = /\d/.test(l.text) && !l.answer ? "value" : "symbol";
              }, "edit label")
            }
          />
        </label>
        <label>
          Saved answer
          <DraftField
            label="Saved answer (answers copy only)"
            value={value.answer}
            disabled={disabled || value.state === "value"}
            onCommit={(v) =>
              onChange((l) => {
                l.answer = v.trim();
                // An answer on an empty place is hidden from pupils.
                if (l.answer && l.state === "blank") l.state = "hidden";
              }, "edit answer")
            }
          />
        </label>
      </div>
      <p className="pt-note">
        {isAngle ? "Type angle sizes without the degree sign: 62 prints as 62° and x as x°." : "Type lengths with their units (8 cm)."} 1/2 prints as a stacked fraction. A saved answer prints only on the answers copy.
      </p>
      {value.state !== "value" && value.answer && <p className="pt-note">The answers copy prints {printed(value, "answer", isAngle).text} here in pink; the pupil copy never shows it.</p>}
    </>
  );
}

export default function FiguresPage({ active = true }: { active?: boolean }) {
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
    [selected, setSelected] = useState<string | null>(null),
    [drag, setDrag] = useState<{ e: Envelope; label: string } | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null),
    [adding, setAdding] = useState<{ place: PlaceType; a: string; b: string; c: string; circle: string }>({ place: "free", a: "", b: "", c: "", circle: "" });
  const file = useRef<HTMLInputElement>(null),
    resource = useRef<HTMLDivElement>(null),
    dragStart = useRef<{ id: string; rect: DOMRect; g: ReturnType<typeof layout>; px: number } | null>(null);
  // While a handle is dragged the preview follows it; the move is one undo step when it is let go.
  const e = drag?.e ?? history.present,
    d = e.document,
    g = useMemo(() => layout(e), [e]),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = useMemo(() => renderSvg(e, "answer"), [e]);
  const viewSvg = useMemo(() => (view === "answer" ? answerSvg : renderSvg(e, "pupil")), [e, view, answerSvg]);
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const pxPerMm = (96 / 25.4) * fitted.scale;
  const lists = { point: d.points, circle: d.circles, segment: d.segments, angle: d.angles } as const;
  const current = selected && lists[split(selected).kind]?.some((x) => x.id === split(selected).id) ? split(selected) : null;
  const nameOf = (pid: string) => d.points.find((p) => p.id === pid)?.name || pid;
  const describe = (kind: Kind, id: string) => {
    if (kind === "point") return `Point ${nameOf(id)}`;
    if (kind === "circle") return `Circle centre ${nameOf(d.circles.find((c) => c.id === id)!.centre)}`;
    if (kind === "segment") {
      const s = d.segments.find((x) => x.id === id)!;
      return `Line ${nameOf(s.a)}${nameOf(s.b)}`;
    }
    const a = d.angles.find((x) => x.id === id)!;
    return `Angle ${nameOf(a.from)}${nameOf(a.at)}${nameOf(a.to)}`;
  };

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
  function patch(update: (n: FigureDocument) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
  }
  function removeObject(kind: Kind, id: string) {
    let more = 0;
    const ok = patch((n) => void (more = removeWithDependents(n, kind, id)), `remove ${kind}`);
    if (ok) {
      setSelected(null);
      if (more > 0) setMessage(`${more === 1 ? "One object" : `${more} objects`} built on it ${more === 1 ? "was" : "were"} removed too. Undo brings ${more === 1 ? "it" : "them"} back.`);
    }
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current figure. You can undo the replacement.") {
    if (!blocked) setPending({ e: next, title, explanation });
  }

  // Autosave with protection for another tab's newer draft (the shared device-draft adapter).
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
      // U9: Escape deselects; Delete removes the selected object, as one undo step.
      const command = objectKeyCommand(event);
      if (!command || !current || blocked) return;
      if (command.kind === "deselect") setSelected(null);
      else if (command.kind === "delete") {
        event.preventDefault();
        if (current.kind === "point" && d.points.length <= 1) setMessage("A figure keeps at least one point.");
        else removeObject(current.kind, current.id);
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
        const incoming = parseFiguresLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked geometry figure?");
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
      replace(parseFile(await upload.text()), "Open this geometry figure?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  /* ---------- Dragging ---------- */

  const handles = blocked && !drag ? [] : dragHandles(d);
  const draggable = new Set(handles.map((h) => h.id));
  function dragAt(id: string, clientX: number, clientY: number, fine: boolean) {
    const start = dragStart.current;
    if (!start || start.id !== id) return;
    // The drag reads the layout from when it began, so the figure growing under the pointer does not feed back.
    const p = start.g.unmap({ x: (clientX - start.rect.left) / start.px, y: (clientY - start.rect.top) / start.px });
    const next = dragTo(history.present, id, p, fine);
    if (next) setDrag({ e: next, label: "drag point" });
  }
  function endDrag() {
    dragStart.current = null;
    if (drag) commit(drag.e, drag.label);
    setDrag(null);
  }
  /** Arrow keys move a point by 1 mm (0.5 mm with Shift) across or up the page; points on a circle or line follow it. */
  function nudge(id: string, key: string, fine: boolean) {
    const at = g.geometry.points.get(id);
    if (!at) return;
    const step = fine ? 0.5 : 1;
    const pnt = d.points.find((x) => x.id === id)!;
    let p: P = { x: at.x + (key === "ArrowRight" ? step : key === "ArrowLeft" ? -step : 0), y: at.y + (key === "ArrowUp" ? step : key === "ArrowDown" ? -step : 0) };
    if (pnt.place.type === "on") {
      // Round a circle, Right and Up turn anticlockwise.
      const c = g.geometry.circles.get(pnt.place.circle)!,
        r = (((key === "ArrowRight" || key === "ArrowUp" ? 1 : -1) * (fine ? 1 : 5)) * Math.PI) / 180,
        v = { x: at.x - c.c.x, y: at.y - c.c.y };
      p = { x: c.c.x + v.x * Math.cos(r) - v.y * Math.sin(r), y: c.c.y + v.x * Math.sin(r) + v.y * Math.cos(r) };
    }
    const next = dragTo(history.present, id, p, true);
    if (next && canonical(next) !== canonical(history.present)) commit(next, "move point");
    else setMessage("That point cannot move further that way.");
  }

  /* ---------- Adding ---------- */

  const pointIds = d.points.map((p) => p.id);
  const onPoints = d.points.filter((p) => p.place.type === "on").map((p) => p.id);
  const pick = (v: string, list: string[], k: number) => (list.includes(v) ? v : list[k] ?? "");
  const addA = pick(adding.a, pointIds, 0),
    addB = pick(adding.b, pointIds.filter((x) => x !== addA), 0),
    addC = pick(adding.c, pointIds.filter((x) => x !== addA && x !== addB), 0),
    addCircle = pick(adding.circle, d.circles.map((c) => c.id), 0);
  function addPoint() {
    const pid = nextId(d, "p");
    let place: Place;
    const xs = d.points.map((p) => g.geometry.points.get(p.id)!.x);
    switch (adding.place) {
      case "free":
        place = { type: "free", x: Math.min(150, Math.round(Math.max(...xs)) + 15), y: 0 };
        break;
      case "on":
        if (!addCircle) return setMessage("Add a circle first.");
        place = { type: "on", circle: addCircle, deg: 45 };
        break;
      case "along":
        place = { type: "along", a: addA, b: addB, t: 0.5 };
        break;
      case "meet": {
        const four = pointIds.slice(0, 4);
        if (four.length < 4) return setMessage("Two crossing lines need four points.");
        place = { type: "meet", a: four[0], b: four[2], c: four[1], d: four[3] };
        break;
      }
      case "tangent":
        if (!onPoints.length) return setMessage("Put a point on a circle first; the tangent touches the circle there.");
        place = { type: "tangent", at: onPoints[0], mm: 25 };
        break;
      case "tangents":
        if (onPoints.length < 2) return setMessage("Put two points on the same circle first.");
        place = { type: "tangents", a: onPoints[0], b: onPoints[1] };
        break;
      case "foot":
        place = { type: "foot", from: addC || addA, a: addA, b: addB };
        break;
    }
    if (d.points.length >= LIMITS.points) return setMessage(`A figure holds up to ${LIMITS.points} points.`);
    if (patch((n) => void n.points.push({ id: pid, place, name: "", show: "none" }), "add point")) setSelected(keyOf("point", pid));
  }
  function addSegment() {
    const sid = nextId(d, "s");
    if (patch((n) => void n.segments.push({ id: sid, a: addA, b: addB, style: "solid", extend: [0, 0], ticks: 0, arrows: 0, label: makeLabel(), side: "auto" }), "add line")) setSelected(keyOf("segment", sid));
  }
  function addAngle() {
    const aid = nextId(d, "g");
    // The vertex is the middle point picked, between the two arms.
    if (patch((n) => void n.angles.push({ id: aid, at: addB, from: addA, to: addC, label: makeLabel(), mark: "arc", shade: false }), "add angle")) setSelected(keyOf("angle", aid));
  }
  function addCircleAt() {
    const cid = nextId(d, "c");
    if (patch((n) => void n.circles.push({ id: cid, centre: addA, r: 25, style: "solid" }), "add circle")) setSelected(keyOf("circle", cid));
  }

  /* ---------- Fields ---------- */

  const mmField = (labelText: string, value: number, apply: (v: number) => boolean, min: number, max: number) => (
    <DraftField
      label={labelText}
      value={String(round(value))}
      inputMode="decimal"
      maxLength={7}
      disabled={blocked}
      onCommit={(v) => {
        const x = num(v);
        if (!(x >= min && x <= max)) {
          setMessage(`Give a number from ${min} to ${max}.`);
          return false;
        }
        return apply(x);
      }}
    />
  );
  const pointSelect = (aria: string, value: string, onPick: (v: string) => void, list = pointIds) => (
    <select aria-label={aria} value={value} disabled={blocked} onChange={(ev) => onPick(ev.target.value)}>
      {list.map((x) => (
        <option key={x} value={x}>
          {nameOf(x) === x ? x : `${nameOf(x)} (${x})`}
        </option>
      ))}
    </select>
  );
  const labelled = (text: string, control: ReactNode, key?: string) => (
    <label key={key}>
      {text}
      {control}
    </label>
  );

  function selectedCard() {
    if (!current) return <p className="pt-note">Click a point, line or angle on the figure, or choose one above, to change it. Drag the round handles to move points.</p>;
    const { kind, id } = current;
    const remove = (
      <div className="pt-row">
        <button type="button" disabled={blocked || (kind === "point" && d.points.length <= 1)} onClick={() => removeObject(kind, id)}>
          Remove {kind === "segment" ? "line" : kind}
        </button>
      </div>
    );
    if (kind === "point") {
      const p = d.points.find((x) => x.id === id)!,
        at = g.geometry.points.get(id)!;
      const setPlace = (update: (pl: Record<string, unknown>) => void, step: string) =>
        patch((n) => {
          const q = n.points.find((x) => x.id === id)!;
          update(q.place as unknown as Record<string, unknown>);
        }, step);
      return (
        <>
          <div className="pt-fields">
            {labelled(
              "Name",
              <DraftField label="Point name" value={p.name} maxLength={3} disabled={blocked} onCommit={(v) => patch((n) => void (n.points.find((x) => x.id === id)!.name = v.trim()), "name point")} />,
            )}
            {labelled(
              "Mark",
              <select aria-label="Point mark" value={p.show} disabled={blocked} onChange={(ev) => patch((n) => void (n.points.find((x) => x.id === id)!.show = ev.target.value as (typeof SHOWS)[number]), "point mark")}>
                {SHOWS.map((x) => (
                  <option key={x} value={x}>
                    {SHOW_NAMES[x]}
                  </option>
                ))}
              </select>,
            )}
          </div>
          <h3 className="fig-sub">Placed {PLACE_NAMES[p.place.type].toLowerCase()}</h3>
          <div className="pt-fields">
            {PLACE_FIELDS[p.place.type].map((f) => {
              const v = (p.place as unknown as Record<string, unknown>)[f.key];
              if (f.ref === "circle")
                return labelled(
                  f.label,
                  <select aria-label={f.label} value={String(v)} disabled={blocked} onChange={(ev) => setPlace((pl) => void (pl[f.key] = ev.target.value), "move point")}>
                    {d.circles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {describe("circle", c.id)}
                      </option>
                    ))}
                  </select>,
                  f.key,
                );
              if (f.ref)
                return labelled(
                  f.label,
                  pointSelect(f.label, String(v), (x) => setPlace((pl) => void (pl[f.key] = x), "move point"), (f.ref === "onPoint" ? onPoints : pointIds).filter((x) => x !== id)),
                  f.key,
                );
              return labelled(f.label, mmField(f.label, Number(v), (x) => setPlace((pl) => void (pl[f.key] = x), "move point"), f.min!, f.max!), f.key);
            })}
          </div>
          {p.place.type !== "free" && (
            <div className="pt-row">
              <button
                type="button"
                disabled={blocked}
                onClick={() => patch((n) => void (n.points.find((x) => x.id === id)!.place = { type: "free", x: round(at.x), y: round(at.y) }), "fix point")}
              >
                Fix it where it is (move freely)
              </button>
            </div>
          )}
          {remove}
          <p className="pt-note">Removing a point also removes the lines, angles, circles and points built on it. Undo brings them back.</p>
        </>
      );
    }
    if (kind === "circle") {
      const c = d.circles.find((x) => x.id === id)!;
      const set = (update: (x: typeof c) => void, step: string) => patch((n) => update(n.circles.find((x) => x.id === id)!), step);
      return (
        <>
          <div className="pt-fields">
            {labelled("Centre", pointSelect("Circle centre", c.centre, (v) => set((x) => void (x.centre = v), "move circle")))}
            {labelled("Radius (mm)", mmField("Radius", c.r, (v) => set((x) => void (x.r = v), "change radius"), 5, 90))}
            {labelled(
              "Line",
              <select aria-label="Circle line" value={c.style} disabled={blocked} onChange={(ev) => set((x) => void (x.style = ev.target.value as typeof c.style), "circle line")}>
                {STYLES.map((x) => (
                  <option key={x} value={x}>
                    {STYLE_NAMES[x]}
                  </option>
                ))}
              </select>,
            )}
          </div>
          {remove}
        </>
      );
    }
    if (kind === "segment") {
      const s = d.segments.find((x) => x.id === id)!;
      const set = (update: (x: typeof s) => void, step: string) => patch((n) => update(n.segments.find((x) => x.id === id)!), step);
      return (
        <>
          <div className="pt-fields">
            {labelled("From", pointSelect("Line from", s.a, (v) => set((x) => void (x.a = v), "change line")))}
            {labelled("To", pointSelect("Line to", s.b, (v) => set((x) => void (x.b = v), "change line")))}
            {labelled(
              "Line",
              <select aria-label="Line style" value={s.style} disabled={blocked} onChange={(ev) => set((x) => void (x.style = ev.target.value as typeof s.style), "line style")}>
                {STYLES.map((x) => (
                  <option key={x} value={x}>
                    {STYLE_NAMES[x]}
                  </option>
                ))}
              </select>,
            )}
            {labelled(
              "Equal-side ticks",
              <select aria-label="Equal-side ticks" value={s.ticks} disabled={blocked} onChange={(ev) => set((x) => void (x.ticks = Number(ev.target.value)), "ticks")}>
                {[0, 1, 2, 3].map((x) => (
                  <option key={x} value={x}>
                    {x || "None"}
                  </option>
                ))}
              </select>,
            )}
            {labelled(
              "Parallel arrows",
              <select aria-label="Parallel arrows" value={s.arrows} disabled={blocked} onChange={(ev) => set((x) => void (x.arrows = Number(ev.target.value)), "arrows")}>
                {[0, 1, 2, 3].map((x) => (
                  <option key={x} value={x}>
                    {x || "None"}
                  </option>
                ))}
              </select>,
            )}
            {labelled(`Beyond ${nameOf(s.a)} (mm)`, mmField(`Extend beyond ${nameOf(s.a)}`, s.extend[0], (v) => set((x) => void (x.extend = [v, x.extend[1]]), "extend line"), 0, 80))}
            {labelled(`Beyond ${nameOf(s.b)} (mm)`, mmField(`Extend beyond ${nameOf(s.b)}`, s.extend[1], (v) => set((x) => void (x.extend = [x.extend[0], v]), "extend line"), 0, 80))}
            {labelled(
              "Label side",
              <select aria-label="Label side" value={s.side} disabled={blocked} onChange={(ev) => set((x) => void (x.side = ev.target.value as typeof s.side), "label side")}>
                {SIDES.map((x) => (
                  <option key={x} value={x}>
                    {SIDE_NAMES[x]}
                  </option>
                ))}
              </select>,
            )}
          </div>
          <LabelFields value={s.label} isAngle={false} disabled={blocked} onMessage={setMessage} onChange={(update, step) => set((x) => update(x.label), step)} />
          {remove}
        </>
      );
    }
    const a = d.angles.find((x) => x.id === id)!;
    const set = (update: (x: typeof a) => void, step: string) => patch((n) => update(n.angles.find((x) => x.id === id)!), step);
    return (
      <>
        <div className="pt-fields">
          {labelled("Arm to", pointSelect("First arm", a.from, (v) => set((x) => void (x.from = v), "change angle")))}
          {labelled("Vertex", pointSelect("Vertex", a.at, (v) => set((x) => void (x.at = v), "change angle")))}
          {labelled("Arm to", pointSelect("Second arm", a.to, (v) => set((x) => void (x.to = v), "change angle")))}
          {labelled(
            "Mark",
            <select aria-label="Angle mark" value={a.mark} disabled={blocked} onChange={(ev) => set((x) => void (x.mark = ev.target.value as Mark), "angle mark")}>
              {MARKS.map((x) => (
                <option key={x} value={x}>
                  {MARK_NAMES[x]}
                </option>
              ))}
            </select>,
          )}
        </div>
        <label className="pt-hide">
          <input type="checkbox" disabled={blocked} checked={a.shade} onChange={(ev) => set((x) => void (x.shade = ev.target.checked), "shade angle")} />
          Shade the angle
        </label>
        <div className="pt-row">
          <button type="button" disabled={blocked} onClick={() => set((x) => void ([x.from, x.to] = [x.to, x.from]), "other side")}>
            Mark the angle on the other side
          </button>
        </div>
        <LabelFields value={a.label} isAngle disabled={blocked} onMessage={setMessage} onChange={(update, step) => set((x) => update(x.label), step)} />
        {remove}
      </>
    );
  }

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const anchors = useMemo(() => hitAnchors(e, g), [e, g]).filter((a) => !(a.kind === "point" && draggable.has(a.id)));
  const objects: { key: string; text: string }[] = (["point", "segment", "angle", "circle"] as Kind[]).flatMap((kind) => lists[kind].map((x) => ({ key: keyOf(kind, x.id), text: `${describe(kind, x.id)} (${x.id})` })));
  const fillNames = (ids: string[]) => ids.map(nameOf).join(" ");
  return (
    <div className="app-shell booklet-editor pt-editor fig-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Geometry figures" description="Draw circles with chords and tangents, similar and congruent shapes and figures for proofs, with lengths and angles given or left for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={figuresGallery}
                  active={active}
                  disabled={blocked}
                  onUse={(r, title) => replace(r, `Open ${title}?`)}
                  onWorked={(r) => commit(r, "use worked version")}
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
              onReset={() => replace(fresh(), "Reset the geometry figure?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="figures-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="figures-downloads"
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
                link: { action: () => navigator.clipboard.writeText(figuresLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
                  ref={resource}
                  className="pt-resource"
                  data-testid="figures-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) setSelected(null);
                  }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(viewSvg, e, view === "answer") }} />
                  {anchors.map((a) => {
                    const k = keyOf(a.kind, a.id),
                      marked = a.kind === "point" || (a.kind === "segment" ? d.segments.find((x) => x.id === a.id)!.label.state !== "blank" : true);
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`fig-hit${current && keyOf(current.kind, current.id) === k ? " fig-current" : ""}${marked ? "" : " fig-unmarked"}`}
                        style={{ left: a.at.x * pxPerMm, top: a.at.y * pxPerMm }}
                        aria-label={`Select ${a.name} (${a.id})`}
                        aria-pressed={!!current && keyOf(current.kind, current.id) === k}
                        disabled={blocked}
                        onClick={() => setSelected(k)}
                      />
                    );
                  })}
                  {handles.map((h) => {
                    const at = g.map(g.geometry.points.get(h.id)!),
                      k = keyOf("point", h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        className={`fig-handle${current && keyOf(current.kind, current.id) === k ? " fig-current" : ""}`}
                        style={{ left: at.x * pxPerMm, top: at.y * pxPerMm }}
                        aria-label={`Drag ${h.name}`}
                        title={`Drag ${h.name}, or click to change it. Arrow keys move it too; hold Shift for small steps.`}
                        disabled={blocked && !drag}
                        onPointerDown={(ev) => {
                          if (blocked || !resource.current) return;
                          ev.preventDefault();
                          ev.currentTarget.setPointerCapture?.(ev.pointerId);
                          dragStart.current = { id: h.id, rect: resource.current.getBoundingClientRect(), g, px: pxPerMm };
                          setSelected(k);
                        }}
                        onPointerMove={(ev) => dragAt(h.id, ev.clientX, ev.clientY, ev.shiftKey)}
                        onPointerUp={endDrag}
                        onPointerCancel={() => {
                          dragStart.current = null;
                          setDrag(null);
                        }}
                        onClick={() => setSelected(k)}
                        onKeyDown={(ev) => {
                          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key) || blocked) return;
                          ev.preventDefault();
                          nudge(h.id, ev.key, ev.shiftKey);
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
              hint={<EditorHint tool="figures">Click a line or an angle to label or mark it. Drag the round handles to move points; points on circles stay on them.</EditorHint>}
            />
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
          <aside className="inspector-stack" aria-label="Geometry figure settings">
            <ReturnToDiagram />
            <section className="panel-card pt-panel" aria-label="Selected object">
              <h2>{current ? describe(current.kind, current.id) : "Selected object"}</h2>
              <div className="pt-fields">
                <label className="fig-wide">
                  Object
                  <select aria-label="Object to edit" value={current ? keyOf(current.kind, current.id) : ""} disabled={blocked} onChange={(ev) => setSelected(ev.target.value || null)}>
                    <option value="">Choose an object</option>
                    {objects.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.text}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedCard()}
              <div className="pt-row">
                <button
                  type="button"
                  disabled={blocked || !hasHidden(e)}
                  onClick={() =>
                    patch((n) => {
                      for (const l of [...n.segments.map((s) => s.label), ...n.angles.map((a) => a.label)])
                        if (l.state !== "value" && l.answer) {
                          l.text = l.answer;
                          l.state = "value";
                          l.answer = "";
                        }
                    }, "show all")
                  }
                >
                  Print every saved answer on the pupil copy
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel" aria-label="Add to the figure">
              <h2>Add to the figure</h2>
              <div className="pt-fields">
                {labelled("First point", pointSelect("First point", addA, (v) => setAdding({ ...adding, a: v })))}
                {labelled("Second point", pointSelect("Second point", addB, (v) => setAdding({ ...adding, b: v }), pointIds.filter((x) => x !== addA)))}
                {labelled("Third point", pointSelect("Third point", addC, (v) => setAdding({ ...adding, c: v }), pointIds.filter((x) => x !== addA && x !== addB)))}
              </div>
              <div className="pt-row fig-row">
                <button type="button" disabled={blocked || !addB || d.segments.length >= LIMITS.segments} onClick={addSegment}>
                  Line from first to second
                </button>
                <button type="button" disabled={blocked || !addC || d.angles.length >= LIMITS.angles} onClick={addAngle}>
                  Angle at the second point
                </button>
                <button type="button" disabled={blocked || d.circles.length >= LIMITS.circles} onClick={addCircleAt}>
                  Circle centred on the first
                </button>
              </div>
              <div className="pt-fields">
                {labelled(
                  "New point",
                  <select aria-label="Place the new point" value={adding.place} disabled={blocked} onChange={(ev) => setAdding({ ...adding, place: ev.target.value as PlaceType })}>
                    {PLACES.map((x) => (
                      <option key={x} value={x}>
                        {PLACE_NAMES[x]}
                      </option>
                    ))}
                  </select>,
                )}
                {adding.place === "on" &&
                  labelled(
                    "Circle",
                    <select aria-label="Circle for the new point" value={addCircle} disabled={blocked} onChange={(ev) => setAdding({ ...adding, circle: ev.target.value })}>
                      {d.circles.map((c) => (
                        <option key={c.id} value={c.id}>
                          {describe("circle", c.id)}
                        </option>
                      ))}
                    </select>,
                  )}
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked || d.points.length >= LIMITS.points} onClick={addPoint}>
                  Add the point
                </button>
              </div>
              <p className="pt-note">
                A point on a line through the first and second points starts halfway. A foot of a perpendicular goes from the third point to the line through the first two. Change any of it once the point is
                added.
              </p>
            </section>
            <section className="panel-card pt-panel" aria-label="Shading and captions">
              <details>
                <summary>Shading and captions</summary>
                <h3 className="fig-sub">Grey regions</h3>
                {d.fills.map((f, i) => (
                  <div key={f.id} className="pt-row fig-row">
                    <span>{fillNames(f.points)}</span>
                    <button type="button" aria-label={`Remove grey region ${i + 1}`} disabled={blocked} onClick={() => patch((n) => void (n.fills = n.fills.filter((x) => x.id !== f.id)), "remove shading")}>
                      Remove
                    </button>
                  </div>
                ))}
                <div className="pt-fields">
                  <label>
                    Shade through points
                    <DraftField
                      label="Points to shade through, in order"
                      value=""
                      maxLength={60}
                      disabled={blocked || d.fills.length >= LIMITS.fills}
                      onCommit={(v) => {
                        const words = v.trim().split(/[\s,]+/).filter(Boolean);
                        const ids = words.map((w) => d.points.find((p) => p.name === w || p.id === w)?.id);
                        if (ids.length < 3 || ids.some((x) => !x)) {
                          setMessage("Give three or more point names in order round the region, such as A B C.");
                          return false;
                        }
                        return patch((n) => void n.fills.push({ id: nextId(n, "f"), points: ids as string[] }), "add shading");
                      }}
                    />
                  </label>
                </div>
                <h3 className="fig-sub">Captions</h3>
                {d.captions.map((c, i) => (
                  <div key={c.id} className="pt-row fig-row">
                    <label>
                      Text
                      <DraftField label={`Caption ${i + 1} text`} value={c.text} maxLength={32} disabled={blocked} onCommit={(v) => patch((n) => {
                        const t = v.trim();
                        if (t) n.captions.find((x) => x.id === c.id)!.text = t;
                        else n.captions = n.captions.filter((x) => x.id !== c.id);
                      }, "edit caption")} />
                    </label>
                    <label>
                      Across
                      {mmField(`Caption ${i + 1} across`, c.x, (v) => patch((n) => void (n.captions.find((x) => x.id === c.id)!.x = v), "move caption"), -150, 150)}
                    </label>
                    <label>
                      Up
                      {mmField(`Caption ${i + 1} up`, c.y, (v) => patch((n) => void (n.captions.find((x) => x.id === c.id)!.y = v), "move caption"), -150, 150)}
                    </label>
                    <label className="pt-hide">
                      <input type="checkbox" disabled={blocked} checked={c.bold} onChange={(ev) => patch((n) => void (n.captions.find((x) => x.id === c.id)!.bold = ev.target.checked), "bold caption")} />
                      Bold
                    </label>
                  </div>
                ))}
                <div className="pt-row">
                  <button
                    type="button"
                    disabled={blocked || d.captions.length >= LIMITS.captions}
                    onClick={() => {
                      const ys = d.points.map((p) => g.geometry.points.get(p.id)!.y);
                      patch((n) => void n.captions.push({ id: nextId(n, "t"), x: 0, y: Math.max(-150, Math.round(Math.min(...ys)) - 10), text: "Triangle A", bold: false }), "add caption");
                    }}
                  >
                    Add a caption
                  </button>
                </div>
              </details>
            </section>
            <section className="panel-card pt-panel">
              <h2>Printing</h2>
              <div className="pt-fields">
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
                  Points can sit anywhere, on a circle, on a line through two points, where two lines cross, along a tangent, where two tangents meet, or at the foot of a perpendicular. Points built on others
                  move with them, so a tangent stays a tangent when you drag the point it touches.
                </p>
                <p className="pt-note">
                  The drawing never has to match the sizes you print: exam diagrams are not accurately drawn. A teacher note says when a right-angle mark is far from 90° or two points share a name.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the figure; preview zoom never changes it. Download PNG (600 ppi) or PDF if your browser blocks copying, and print at 100% (actual size).
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("figures", "json", { recovery: true }));
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current figure</button>
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
              Keep this figure and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this figure"
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
