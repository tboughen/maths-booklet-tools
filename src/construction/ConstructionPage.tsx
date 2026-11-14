import { useTitleNote } from "../site/TitleNote";
import { WORKED_STEP, useWorkedNotes, withWorkedNotes } from "../site/WorkedNotes";
import { answerSize, previewArt, workedIssue } from "../export/worked";
import { workedOf } from "../../packages/envelope-core/src/worked";
import { TITLE_NOTE_STEP, withAbout } from "../site/titleNoteData";
import { aboutOf } from "../../packages/envelope-core/src/about";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useResourceFit } from "../site/useResourceFit";
import { ExampleGallery } from "../examples/ExampleGallery";
import { constructionGallery } from "../examples/galleryCatalogue";
import { copyStorageKey } from "../site/copyDocument";
import { PreviewControls } from "../site/PreviewControls";
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
import {
  angleBisector,
  arc,
  canonical,
  create,
  formatBearing,
  bearingOf,
  freshId,
  hasHidden,
  HEIGHT,
  layout,
  locusFromPoint,
  locusFromSegment,
  MAX_POINTS,
  measureAngle,
  measureBearing,
  measureSegment,
  newPoint,
  parseFile,
  perpendicularAtPoint,
  perpendicularBisector,
  perpendicularFromPoint,
  pointByBearing,
  remove,
  removeGroup,
  renderSvg,
  segment,
  setRole,
  validate,
  WIDTH,
  label as makeLabel,
  type Envelope,
  type Obj,
  type Point,
  type Role,
} from "../../packages/construction-core/src";
import { LINK_PREFIX, constructionLink, parseConstructionLink } from "./links";
import { copyWord, downloadEditable, downloadImage, printPng, downloadBoth } from "./export";
import { handleUndoKeys, useDocumentHistory, redoLabel as redoStepName, undoLabel as undoStepName, stepName } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "./construction.css";

const STORAGE = copyStorageKey("maths-booklet-tools:construction:v1");
type Doc = Envelope["document"];
type View = "pupil" | "answer";

function initial() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        return { e: parseFile(raw), recovery: null, message: "" };
      } catch {
        return { e: create(), recovery: raw, message: "Saved drawing data needs recovery. Download the original before starting afresh." };
      }
    }
  } catch {
    return { e: create(), recovery: null, message: "Device storage is unavailable. Save an editable file to keep your work." };
  }
  return { e: create(), recovery: null, message: "" };
}

/** Keeps its draft while typing; Enter or leaving applies, Escape restores. */
function DraftField({ id, label, value, onCommit, disabled, maxLength = 40, inputMode, className }: {
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

/** A number typed in centimetres or degrees; anything that is not a number is refused with a message. */
const parseNumber = (text: string) => {
  const v = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(v) ? v : null;
};

const CONSTRUCTIONS = {
  "perpendicular-bisector": { name: "Perpendicular bisector of a line", needs: ["a", "b"], labels: ["From", "To"] },
  "angle-bisector": { name: "Bisector of an angle", needs: ["at", "from", "to"], labels: ["Vertex", "Arm through", "Arm through"] },
  "perpendicular-from-point": { name: "Perpendicular from a point to a line", needs: ["point", "a", "b"], labels: ["Point", "Line from", "Line to"] },
  "perpendicular-at-point": { name: "Perpendicular at a point on a line", needs: ["point", "a", "b"], labels: ["Point on the line", "Line from", "Line to"] },
  "locus-point": { name: "Locus: fixed distance from a point", needs: ["point"], labels: ["Point"], distance: true },
  "locus-segment": { name: "Locus: fixed distance from a line", needs: ["a", "b"], labels: ["Line from", "Line to"], distance: true },
  "point-by-bearing": { name: "Point on a bearing", needs: ["from"], labels: ["From"], distance: true, bearing: true },
} as const;
type ConstructionType = keyof typeof CONSTRUCTIONS;

const OBJECTS = {
  segment: { name: "Line segment", needs: ["from", "to"], labels: ["From", "To"] },
  line: { name: "Straight line (runs past both points)", needs: ["from", "to"], labels: ["Through", "Through"] },
  circle: { name: "Circle", needs: ["center"], labels: ["Centre"], radius: true },
  angle: { name: "Angle mark", needs: ["at", "from", "to"], labels: ["Vertex", "Arm through", "Arm through"] },
  right: { name: "Right-angle mark", needs: ["at", "from", "to"], labels: ["Vertex", "Arm through", "Arm through"] },
  north: { name: "North line", needs: ["at"], labels: ["At"] },
  bearing: { name: "Bearing (arc from north)", needs: ["from", "to"], labels: ["From", "To"] },
} as const;
type ObjectType = keyof typeof OBJECTS;

/** How a saved object reads in the list. */
function describe(o: Obj): string {
  switch (o.type) {
    case "segment":
      return o.extend[0] || o.extend[1] ? `Line through ${o.from} and ${o.to}` : `Segment ${o.from}${o.to}`;
    case "arc":
      return Math.abs(o.sweep) >= 360 ? `Circle, centre ${o.center}, radius ${o.radius} cm` : `Arc, centre ${o.center}`;
    case "angle":
      return `${o.style === "right" ? "Right angle" : "Angle"} ${o.from}${o.at}${o.to}`;
    case "north":
      return `North line at ${o.at}`;
    case "bearing":
      return `Bearing of ${o.to} from ${o.from}`;
    case "polygon":
      return `Shape ${o.points.join("")}`;
    case "text":
      return `Text "${o.label.text}"`;
    case "region":
      return "Shaded region";
  }
}
const GROUP_NAMES: Record<string, string> = {
  pb: "Perpendicular bisector",
  ab: "Angle bisector",
  pf: "Perpendicular from a point",
  pa: "Perpendicular at a point",
  lp: "Locus round a point",
  ls: "Locus round a line",
};
const groupName = (g: string) => `${GROUP_NAMES[g.replace(/\d+$/, "")] ?? "Construction"} (${g})`;

export default function ConstructionPage({ active = true }: { active?: boolean }) {
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
    [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null),
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null);
  const [cType, setCType] = useState<ConstructionType>("perpendicular-bisector"),
    [cPoints, setCPoints] = useState<string[]>([]),
    [cDistance, setCDistance] = useState("3"),
    [cBearing, setCBearing] = useState("070"),
    [cNewId, setCNewId] = useState(""),
    [cShown, setCShown] = useState(false);
  const [oType, setOType] = useState<ObjectType>("segment"),
    [oPoints, setOPoints] = useState<string[]>([]),
    [oRadius, setORadius] = useState("3"),
    [oAnswer, setOAnswer] = useState(false);
  const [scale, setScale] = useState({ cm: "1", per: "1", unit: "cm" });
  const [rule, setRule] = useState({ kind: "distance" as "distance" | "closer", from: "", distance: "2", side: "within" as "within" | "beyond", to: "", than: "", answer: true });
  const file = useRef<HTMLInputElement>(null),
    expected = useRef<string | null>(null),
    stage = useRef<HTMLDivElement>(null);
  const e = history.present,
    d = e.document,
    g = layout(e, view),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = renderSvg(e, "answer");
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const selectedPoint = d.points.find((p) => p.id === selected) ?? null;
  const groups = [...new Set([...d.points, ...d.objects].map((x) => x.group).filter((x): x is string => !!x))];
  const ownPoints = d.points.filter((p) => !p.group);
  const segments = d.objects.filter((o): o is Extract<Obj, { type: "segment" }> => o.type === "segment" && !o.group);
  const pointName = (p: Point) => (p.label.text.trim() && p.label.text.trim() !== p.id ? `${p.label.text} (${p.id})` : p.id);

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
  function setPointField(id: string, update: (p: Point) => void) {
    patch((n) => {
      const p = n.points.find((x) => x.id === id);
      if (p) update(p);
    });
  }
  /** Moving a point would leave saved constructions built from its old place wrong, so it waits until they are removed. */
  function movePoint(id: string, x: number, y: number) {
    const p = d.points.find((q) => q.id === id);
    if (!p || (p.x === x && p.y === y)) return;
    if (p.group || groups.length) {
      setMessage(
        p.group
          ? `${p.id} is part of a construction. Remove the construction and add it again instead.`
          : `Remove the saved construction${groups.length > 1 ? "s" : ""} (${groups.join(", ")}) before moving points, then add ${groups.length > 1 ? "them" : "it"} again.`,
      );
      return;
    }
    setPointField(id, (q) => {
      q.x = Math.round(x * 10) / 10;
      q.y = Math.round(y * 10) / 10;
    });
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current drawing. You can undo the replacement.") {
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
        setMessage("Saved drawing data changed in another tab. Download its data before replacing it.");
      }
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      handleUndoKeys(event, { undo, redo });
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
        const incoming = parseConstructionLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked drawing?");
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
      replace(parseFile(await upload.text()), "Open this drawing?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  // Page millimetres of a saved point, and back from a pointer position.
  const pageX = (x: number) => g.frame.x + x * 10,
    pageY = (y: number) => g.frame.y + g.frame.height - y * 10;
  function pointerToDoc(ev: ReactPointerEvent) {
    const box = stage.current!.getBoundingClientRect();
    const mmX = ((ev.clientX - box.left) / box.width) * g.width,
      mmY = ((ev.clientY - box.top) / box.height) * g.height;
    const x = Math.min(d.width, Math.max(0, (mmX - g.frame.x) / 10)),
      y = Math.min(d.height, Math.max(0, (g.frame.y + g.frame.height - mmY) / 10));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  const px = (mm: number, of: number) => `${(mm / of) * 100}%`;

  /** The first spot near the middle at least 1.5 cm from every point, so new points never sit on top of each other. */
  function freeSpot(): [number, number] {
    const cx = Math.round(d.width * 5) / 10,
      cy = Math.round(d.height * 5) / 10;
    for (let ring = 0; ring < 12; ring++)
      for (let k = 0; k < Math.max(1, ring * 6); k++) {
        const t = (2 * Math.PI * k) / Math.max(1, ring * 6),
          x = Math.round((cx + 2 * ring * Math.cos(t)) * 10) / 10,
          y = Math.round((cy + 2 * ring * Math.sin(t)) * 10) / 10;
        if (x >= 0.5 && y >= 0.5 && x <= d.width - 0.5 && y <= d.height - 0.5 && d.points.every((p) => Math.hypot(p.x - x, p.y - y) >= 1.5)) return [x, y];
      }
    return [cx, cy];
  }
  function addPoint() {
    if (d.points.length >= MAX_POINTS) return setMessage(`A drawing holds at most ${MAX_POINTS} points.`);
    const used = new Set(d.points.map((p) => p.id));
    const id = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").find((l) => !used.has(l)) ?? freshId(d, "P");
    if (commit(() => {
      const n = structuredClone(e);
      n.document.points.push(newPoint(id, ...freeSpot()));
      return n;
    }, `add point ${id}`))
      setSelected(id);
  }
  function addObject() {
    const spec = OBJECTS[oType];
    const pts = spec.needs.map((_, i) => oPoints[i]);
    if (pts.some((p) => !p)) return setMessage(`Choose ${spec.needs.length === 1 ? "a point" : "every point"} for the ${spec.name.toLowerCase()}.`);
    const role: Role = oAnswer ? "answer" : "given";
    const n = structuredClone(e),
      doc = n.document;
    let made: Obj;
    if (oType === "segment" || oType === "line") made = segment(freshId(doc, "s"), pts[0], pts[1], { role, extend: oType === "line" ? [2, 2] : [0, 0] });
    else if (oType === "circle") {
      const r = parseNumber(oRadius);
      if (r === null || r <= 0) return setMessage("Type the circle's radius in centimetres, for example 3.");
      made = arc(freshId(doc, "c"), pts[0], r, 0, 360, { role });
    } else if (oType === "angle" || oType === "right")
      made = { id: freshId(doc, "angle"), type: "angle", at: pts[0], from: pts[1], to: pts[2], style: oType === "right" ? "right" : "arc", reflex: false, label: makeLabel(""), role };
    else if (oType === "north") made = { id: freshId(doc, "north"), type: "north", at: pts[0], length: 2, role };
    else made = { id: freshId(doc, "bearing"), type: "bearing", from: pts[0], to: pts[1], northLine: true, label: makeLabel(""), role };
    doc.objects.push(made);
    if (commit(n, `add ${spec.name.toLowerCase()}`)) setOPoints([]);
  }
  function addConstruction() {
    const spec = CONSTRUCTIONS[cType];
    const pts = spec.needs.map((_, i) => cPoints[i]);
    if (pts.some((p) => !p)) return setMessage(`Choose every point for the ${spec.name.toLowerCase()}.`);
    const role: Role = cShown ? "given" : "answer";
    const distance = parseNumber(cDistance);
    if ("distance" in spec && (distance === null || distance <= 0)) return setMessage("Type the distance in centimetres on the drawing, for example 3.");
    const done = commit(() => {
      switch (cType) {
        case "perpendicular-bisector":
          return perpendicularBisector(e, { a: pts[0], b: pts[1], role });
        case "angle-bisector":
          return angleBisector(e, { at: pts[0], from: pts[1], to: pts[2], role });
        case "perpendicular-from-point":
          return perpendicularFromPoint(e, { point: pts[0], a: pts[1], b: pts[2], role });
        case "perpendicular-at-point":
          return perpendicularAtPoint(e, { point: pts[0], a: pts[1], b: pts[2], role });
        case "locus-point":
          return locusFromPoint(e, { point: pts[0], distance: distance!, role });
        case "locus-segment":
          return locusFromSegment(e, { a: pts[0], b: pts[1], distance: distance!, role });
        case "point-by-bearing": {
          const b = parseNumber(cBearing);
          if (b === null || b < 0 || b >= 360) throw Error("Type a bearing from 000 to 359.");
          const used = new Set(d.points.map((p) => p.id));
          const id = cNewId.trim() || ("ABCDEFGHJKLMNPQRSTUVWXYZ".split("").find((l) => !used.has(l)) ?? freshId(d, "P"));
          return pointByBearing(e, { id, from: pts[0], bearing: b, distance: distance!, role });
        }
      }
    }, `add ${spec.name.toLowerCase()}`);
    if (done) setCPoints([]);
  }
  function addRegion() {
    const ok =
      rule.kind === "distance"
        ? rule.from && parseNumber(rule.distance) !== null
        : rule.to && rule.than && rule.to !== rule.than;
    if (!ok) return setMessage(rule.kind === "distance" ? "Choose a point or line and a distance." : "Choose two different points or two different lines.");
    const n = structuredClone(e);
    n.document.objects.push({
      id: freshId(n.document, "r"),
      type: "region",
      rules: [rule.kind === "distance" ? { kind: "distance", from: rule.from, distance: parseNumber(rule.distance)!, side: rule.side } : { kind: "closer", to: rule.to, than: rule.than }],
      pattern: "hatch",
      role: rule.answer ? "answer" : "given",
    });
    commit(n, "add shaded region");
  }
  /** Adds a second rule to the latest region, so it hatches only where both hold. */
  function narrowRegion(id: string) {
    const ok = rule.kind === "distance" ? rule.from && parseNumber(rule.distance) !== null : rule.to && rule.than && rule.to !== rule.than;
    if (!ok) return setMessage("Set the extra condition first.");
    patch((n) => {
      const r = n.objects.find((o) => o.id === id);
      if (r?.type === "region")
        r.rules.push(rule.kind === "distance" ? { kind: "distance", from: rule.from, distance: parseNumber(rule.distance)!, side: rule.side } : { kind: "closer", to: rule.to, than: rule.than });
    }, "narrow region");
  }
  function measure(o: Obj) {
    if (o.type === "segment") {
      const cm = parseNumber(scale.cm),
        per = parseNumber(scale.per);
      if (!cm || !per) return setMessage("Set the scale first, for example 1 cm represents 4 km.");
      commit(() => measureSegment(e, o.id, { cm, per, unit: scale.unit.trim() || "cm" }), "measure");
    } else if (o.type === "angle") commit(() => measureAngle(e, o.id), "measure");
    else if (o.type === "bearing") commit(() => measureBearing(e, o.id), "measure");
  }

  const pointOptions = (list: Point[]) => [<option key="" value="">Choose</option>, ...list.map((p) => <option key={p.id} value={p.id}>{pointName(p)}</option>)];
  const refOptions = [
    <option key="" value="">Choose</option>,
    ...ownPoints.map((p) => <option key={p.id} value={p.id}>Point {pointName(p)}</option>),
    ...segments.map((s) => <option key={s.id} value={s.id}>Line {s.from}{s.to}</option>),
  ];

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  return (
    <div className="app-shell booklet-editor pt-editor cn-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="Constructions and loci" description="Draw true-size constructions, loci, scale drawings and bearings for pupils to construct, measure and shade.">
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
              onReset={() => replace(create(), "Reset the drawing?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="construction-downloads"
              menuOpen={menu}
              onToggleMenu={() => setMenu(!menu)}
            />
            <EditorDownloadMenu
              wordHelp
              id="construction-downloads"
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
                link: { action: () => navigator.clipboard.writeText(constructionLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
            <div className="pt-preview-bar">
              <PreviewControls zoom={zoom} onZoom={setZoom} />
              <ResourceSize width={g.width / 10} height={g.height / 10} />
              <AnswerCopyToggle checked={view === "answer"} disabled={blocked} onChange={(checked) => setView(checked ? "answer" : "pupil")} />
            </div>
            <EditorHint tool="construction">Drag a point to move it, or select it and use the arrow keys. Add constructions and measurements in the settings.</EditorHint>
            <div className="pt-scroll" ref={fitted.ref}>
              <div className="pt-stage">
                <div
                  ref={stage}
                  className="pt-resource"
                  data-testid="construction-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                  onPointerMove={(ev) => drag && setDrag({ id: drag.id, ...pointerToDoc(ev) })}
                  onPointerUp={() => {
                    if (drag) movePoint(drag.id, drag.x, drag.y);
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(renderSvg(e, view), e, view === "answer") }} />
                  {d.points
                    .filter((p) => !p.group && (view === "answer" || p.role === "given"))
                    .map((p) => {
                      const at = drag?.id === p.id ? drag : p;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`pt-hit cn-point ${selected === p.id ? "pt-selected" : ""} ${p.role === "answer" ? "pt-hidden-answer" : ""}`}
                          aria-label={`Select point ${pointName(p)} at (${p.x}, ${p.y}); drag to move it`}
                          disabled={blocked}
                          style={{ left: px(pageX(at.x) - 2.5, g.width), top: px(pageY(at.y) - 2.5, g.height), width: px(5, g.width), height: px(5, g.height) }}
                          onPointerDown={(ev) => {
                            if (blocked) return;
                            ev.preventDefault();
                            setSelected(p.id);
                            (ev.currentTarget.parentElement as HTMLElement).setPointerCapture?.(ev.pointerId);
                            setDrag({ id: p.id, x: p.x, y: p.y });
                          }}
                          onKeyDown={(ev) => {
                            const step = ev.shiftKey ? 1 : 0.1;
                            const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[ev.key];
                            if (!move) return;
                            ev.preventDefault();
                            movePoint(p.id, Math.round((p.x + move[0]) * 10) / 10, Math.round((p.y + move[1]) * 10) / 10);
                          }}
                        />
                      );
                    })}
                </div>
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
          <aside className="inspector-stack" aria-label="Construction settings">
            <ExampleGallery
              examples={constructionGallery}
              active={active}
              disabled={blocked}
              onUse={(resource, title) => replace(resource, `Open ${title}?`)}
              onWorked={(resource) => commit(resource, "use worked version")}
            />
            {selectedPoint && (
              <section className="panel-card pt-panel" aria-label="Selected point">
                <h2>Point {pointName(selectedPoint)}</h2>
                <div className="pt-fields">
                  <label>
                    Label
                    <DraftField label="Point label" value={selectedPoint.label.text} disabled={blocked} maxLength={40} onCommit={(v) => setPointField(selectedPoint.id, (p) => void (p.label.text = v))} />
                  </label>
                  <label>
                    Across (cm)
                    <DraftField
                      label="Distance across in centimetres"
                      inputMode="decimal"
                      value={String(selectedPoint.x)}
                      disabled={blocked}
                      onCommit={(v) => {
                        const x = parseNumber(v);
                        if (x === null) setMessage("Type a number of centimetres.");
                        else movePoint(selectedPoint.id, x, selectedPoint.y);
                      }}
                    />
                  </label>
                  <label>
                    Up (cm)
                    <DraftField
                      label="Distance up in centimetres"
                      inputMode="decimal"
                      value={String(selectedPoint.y)}
                      disabled={blocked}
                      onCommit={(v) => {
                        const y = parseNumber(v);
                        if (y === null) setMessage("Type a number of centimetres.");
                        else movePoint(selectedPoint.id, selectedPoint.x, y);
                      }}
                    />
                  </label>
                  <label>
                    Label position
                    <select aria-label="Label position" value={selectedPoint.labelAt} disabled={blocked} onChange={(ev) => setPointField(selectedPoint.id, (p) => void (p.labelAt = ev.target.value as Point["labelAt"]))}>
                      {["auto", "n", "ne", "e", "se", "s", "sw", "w", "nw"].map((x) => (
                        <option key={x} value={x}>
                          {x === "auto" ? "Away from lines" : x.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mark
                    <select aria-label="Point mark" value={selectedPoint.mark} disabled={blocked} onChange={(ev) => setPointField(selectedPoint.id, (p) => void (p.mark = ev.target.value as Point["mark"]))}>
                      <option value="cross">Cross</option>
                      <option value="dot">Dot</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                </div>
                <label className="pt-hide">
                  <input type="checkbox" disabled={blocked} checked={selectedPoint.role === "answer"} onChange={(ev) => commit(() => setRole(e, [selectedPoint.id], ev.target.checked ? "answer" : "given"))} />
                  Answer (answers copy only, with anything drawn from it)
                </label>
                <label className="pt-hide">
                  <input type="checkbox" disabled={blocked} checked={selectedPoint.label.show === "hidden"} onChange={(ev) => setPointField(selectedPoint.id, (p) => void (p.label.show = ev.target.checked ? "hidden" : "show"))} />
                  Hide the label for pupils
                </label>
                <div className="pt-row">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (commit(() => remove(e, [selectedPoint.id]), `remove point ${selectedPoint.id}`)) setSelected(null);
                    }}
                  >
                    Remove point and what is drawn from it
                  </button>
                </div>
              </section>
            )}
            <section className="panel-card pt-panel">
              <h2>Points</h2>
              <div className="cn-list">
                {ownPoints.map((p) => (
                  <button key={p.id} type="button" className={`cn-chip ${selected === p.id ? "cn-current" : ""}`} disabled={blocked} onClick={() => setSelected(p.id)}>
                    {pointName(p)} ({p.x}, {p.y}){p.role === "answer" ? " · answer" : ""}
                  </button>
                ))}
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={addPoint}>
                  Add point
                </button>
              </div>
              <p className="pt-note">Drag a point on the drawing, or select it and use the arrow keys (Shift moves 1 cm). Positions are in centimetres from the bottom-left corner.</p>
            </section>
            <section className="panel-card pt-panel">
              <h2>Lines and marks</h2>
              {d.objects.filter((o) => !o.group && o.type !== "region").map((o) => (
                <div key={o.id} className="cn-item">
                  <span>{describe(o)}</span>
                  {"label" in o && o.type !== "text" && (
                    <span className="cn-inline">
                      Label
                      <DraftField label={`Label for ${describe(o)}`} value={o.label.text} disabled={blocked} maxLength={40} onCommit={(v) => patch((n) => void ((n.objects.find((x) => x.id === o.id) as { label: { text: string } }).label.text = v))} />
                      <label className="pt-hide">
                        <input type="checkbox" disabled={blocked} checked={o.label.show === "hidden"} onChange={(ev) => patch((n) => void ((n.objects.find((x) => x.id === o.id) as { label: { show: string } }).label.show = ev.target.checked ? "hidden" : "show"))} />
                        Hide for pupils
                      </label>
                    </span>
                  )}
                  <span className="pt-row">
                    <label className="pt-hide">
                      <input type="checkbox" disabled={blocked} checked={o.role === "answer"} onChange={(ev) => commit(() => setRole(e, [o.id], ev.target.checked ? "answer" : "given"))} />
                      Answer
                    </label>
                    {(o.type === "segment" || o.type === "angle" || o.type === "bearing") && (
                      <button type="button" disabled={blocked} onClick={() => measure(o)} title={o.type === "bearing" ? `Writes ${formatBearing(bearingOf(d.points.find((p) => p.id === o.from)!, d.points.find((p) => p.id === o.to)!))}` : undefined}>
                        Measure
                      </button>
                    )}
                    <button type="button" disabled={blocked} onClick={() => commit(() => remove(e, [o.id]), "remove")}>
                      Remove
                    </button>
                  </span>
                </div>
              ))}
              <div className="pt-fields">
                <label>
                  Add
                  <select aria-label="Line or mark to add" value={oType} disabled={blocked} onChange={(ev) => (setOType(ev.target.value as ObjectType), setOPoints([]))}>
                    {Object.entries(OBJECTS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                {OBJECTS[oType].labels.map((l, i) => (
                  <label key={i}>
                    {l}
                    <select aria-label={`${OBJECTS[oType].name}: ${l}`} value={oPoints[i] ?? ""} disabled={blocked} onChange={(ev) => setOPoints((s) => Object.assign([...s], { [i]: ev.target.value }))}>
                      {pointOptions(d.points.filter((p) => !p.group || p.mark !== "none"))}
                    </select>
                  </label>
                ))}
                {"radius" in OBJECTS[oType] && (
                  <label>
                    Radius (cm)
                    <input aria-label="Circle radius in centimetres" inputMode="decimal" value={oRadius} disabled={blocked} onChange={(ev) => setORadius(ev.target.value)} />
                  </label>
                )}
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={oAnswer} onChange={(ev) => setOAnswer(ev.target.checked)} />
                Answer (answers copy only)
              </label>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={addObject}>
                  Add {OBJECTS[oType].name.toLowerCase()}
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel" aria-label="Ruler and compass constructions">
              <h2>Ruler and compass constructions</h2>
              <p className="pt-note">Each construction draws its compass arcs and is saved as an answer, so pupils see only the starting lines. Tick “Show on the pupil copy” for a worked example.</p>
              {groups.map((grp) => {
                const parts = [...d.points, ...d.objects].filter((x) => x.group === grp);
                const answer = parts.every((x) => x.role === "answer");
                return (
                  <div key={grp} className="cn-item">
                    <span>{groupName(grp)}</span>
                    <span className="pt-row">
                      <label className="pt-hide">
                        <input type="checkbox" disabled={blocked} checked={answer} onChange={(ev) => commit(() => setRole(e, [grp], ev.target.checked ? "answer" : "given"))} />
                        Answer
                      </label>
                      <button type="button" disabled={blocked} onClick={() => commit(() => removeGroup(e, grp), "remove construction")}>
                        Remove
                      </button>
                    </span>
                  </div>
                );
              })}
              <div className="pt-fields">
                <label>
                  Construction
                  <select aria-label="Construction to add" value={cType} disabled={blocked} onChange={(ev) => (setCType(ev.target.value as ConstructionType), setCPoints([]))}>
                    {Object.entries(CONSTRUCTIONS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                {CONSTRUCTIONS[cType].labels.map((l, i) => (
                  <label key={i}>
                    {l}
                    <select aria-label={`${CONSTRUCTIONS[cType].name}: ${l}`} value={cPoints[i] ?? ""} disabled={blocked} onChange={(ev) => setCPoints((s) => Object.assign([...s], { [i]: ev.target.value }))}>
                      {pointOptions(ownPoints)}
                    </select>
                  </label>
                ))}
                {"distance" in CONSTRUCTIONS[cType] && (
                  <label>
                    Distance on the drawing (cm)
                    <input aria-label="Distance in centimetres on the drawing" inputMode="decimal" value={cDistance} disabled={blocked} onChange={(ev) => setCDistance(ev.target.value)} />
                  </label>
                )}
                {"bearing" in CONSTRUCTIONS[cType] && (
                  <>
                    <label>
                      Bearing (degrees)
                      <input aria-label="Bearing in degrees" inputMode="decimal" value={cBearing} disabled={blocked} onChange={(ev) => setCBearing(ev.target.value)} />
                    </label>
                    <label>
                      New point name
                      <input aria-label="Name of the new point" maxLength={16} value={cNewId} placeholder="next letter" disabled={blocked} onChange={(ev) => setCNewId(ev.target.value)} />
                    </label>
                  </>
                )}
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={cShown} onChange={(ev) => setCShown(ev.target.checked)} />
                Show on the pupil copy (worked example)
              </label>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={addConstruction}>
                  Add construction
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Shaded regions</h2>
              {d.objects.filter((o): o is Extract<Obj, { type: "region" }> => o.type === "region").map((o) => (
                <div key={o.id} className="cn-item">
                  <span>
                    Shaded where{" "}
                    {o.rules
                      .map((r) => (r.kind === "distance" ? `${r.side} ${r.distance} cm of ${r.from}` : r.kind === "closer" ? `closer to ${r.to} than ${r.than}` : `${r.side} ${r.shape}`))
                      .join(" and ")}
                  </span>
                  <span className="pt-row">
                    <label className="pt-hide">
                      <input type="checkbox" disabled={blocked} checked={o.role === "answer"} onChange={(ev) => commit(() => setRole(e, [o.id], ev.target.checked ? "answer" : "given"))} />
                      Answer
                    </label>
                    <button type="button" disabled={blocked || o.rules.length >= 6} onClick={() => narrowRegion(o.id)}>
                      Also require the condition below
                    </button>
                    <button type="button" disabled={blocked} onClick={() => commit(() => remove(e, [o.id]), "remove region")}>
                      Remove
                    </button>
                  </span>
                </div>
              ))}
              <div className="pt-fields">
                <label>
                  Condition
                  <select aria-label="Shading condition" value={rule.kind} disabled={blocked} onChange={(ev) => setRule({ ...rule, kind: ev.target.value as "distance" | "closer" })}>
                    <option value="distance">Distance from a point or line</option>
                    <option value="closer">Closer to one than another</option>
                  </select>
                </label>
                {rule.kind === "distance" ? (
                  <>
                    <label>
                      Side
                      <select aria-label="Within or beyond" value={rule.side} disabled={blocked} onChange={(ev) => setRule({ ...rule, side: ev.target.value as "within" | "beyond" })}>
                        <option value="within">Within</option>
                        <option value="beyond">More than</option>
                      </select>
                    </label>
                    <label>
                      Distance (cm)
                      <input aria-label="Shading distance in centimetres" inputMode="decimal" value={rule.distance} disabled={blocked} onChange={(ev) => setRule({ ...rule, distance: ev.target.value })} />
                    </label>
                    <label>
                      Of
                      <select aria-label="Point or line to measure from" value={rule.from} disabled={blocked} onChange={(ev) => setRule({ ...rule, from: ev.target.value })}>
                        {refOptions}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Closer to
                      <select aria-label="Closer to" value={rule.to} disabled={blocked} onChange={(ev) => setRule({ ...rule, to: ev.target.value })}>
                        {refOptions}
                      </select>
                    </label>
                    <label>
                      Than
                      <select aria-label="Than" value={rule.than} disabled={blocked} onChange={(ev) => setRule({ ...rule, than: ev.target.value })}>
                        {refOptions}
                      </select>
                    </label>
                  </>
                )}
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={rule.answer} onChange={(ev) => setRule({ ...rule, answer: ev.target.checked })} />
                Answer (answers copy only)
              </label>
              <div className="pt-row">
                <button type="button" disabled={blocked} onClick={addRegion}>
                  Add shaded region
                </button>
              </div>
            </section>
            <section className="panel-card pt-panel">
              <h2>Drawing</h2>
              <div className="pt-fields">
                <label>
                  Width (cm)
                  <select aria-label="Drawing width" value={d.width} disabled={blocked} onChange={(ev) => patch((n) => void (n.width = Number(ev.target.value)))}>
                    {Array.from({ length: WIDTH.maximum - WIDTH.minimum + 1 }, (_, i) => i + WIDTH.minimum)
                      .concat(d.width)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .sort((a, b) => a - b)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Height (cm)
                  <select aria-label="Drawing height" value={d.height} disabled={blocked} onChange={(ev) => patch((n) => void (n.height = Number(ev.target.value)))}>
                    {Array.from({ length: HEIGHT.maximum - HEIGHT.minimum + 1 }, (_, i) => i + HEIGHT.minimum)
                      .concat(d.height)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .sort((a, b) => a - b)
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Background
                  <select aria-label="Background" value={d.grid} disabled={blocked} onChange={(ev) => patch((n) => void (n.grid = ev.target.value as Doc["grid"]))}>
                    <option value="none">Plain</option>
                    <option value="cm">Centimetre grid</option>
                  </select>
                </label>
                <label>
                  Scale caption
                  <DraftField label="Scale caption" value={d.caption.text} disabled={blocked} maxLength={40} onCommit={(v) => patch((n) => void (n.caption.text = v))} />
                </label>
              </div>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.border} onChange={(ev) => patch((n) => void (n.border = ev.target.checked))} />
                Border round the drawing area
              </label>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.caption.show === "hidden"} onChange={(ev) => patch((n) => void (n.caption.show = ev.target.checked ? "hidden" : "show"))} />
                Hide the caption for pupils
              </label>
              <h3>Scale for measuring lengths</h3>
              <div className="pt-fields cn-scale">
                <label>
                  cm
                  <input aria-label="Centimetres on the drawing" inputMode="decimal" value={scale.cm} disabled={blocked} onChange={(ev) => setScale({ ...scale, cm: ev.target.value })} />
                </label>
                <label>
                  represents
                  <input aria-label="Real distance" inputMode="decimal" value={scale.per} disabled={blocked} onChange={(ev) => setScale({ ...scale, per: ev.target.value })} />
                </label>
                <label>
                  unit
                  <input aria-label="Real unit" maxLength={12} value={scale.unit} disabled={blocked} onChange={(ev) => setScale({ ...scale, unit: ev.target.value })} />
                </label>
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked || !hasHidden(e)} onClick={() => commit(() => setRole(e, [...d.points, ...d.objects].filter((x) => x.role === "answer").map((x) => x.id), "given"), "show all")}>
                  Show every answer on the pupil copy
                </button>
              </div>
              <details>
                <summary>Editing and printing help</summary>
                <p className="pt-note">
                  The drawing prints at true size: 1 cm on the sheet is 1 cm, so pupils can construct, measure and shade on it. Nothing is
                  measured or written for you; Measure writes a length, angle or bearing only when you press it, and can be undone.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the drawing; preview zoom never changes it. Download PNG (600 ppi) or
                  PDF if your browser blocks copying, and print at 100% (actual size).
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("construction", "json", { recovery: true }));
                setProtectedCopy(true);
              }}
            >
              Download protected data
            </button>
            <button onClick={() => downloadEditable(e)}>Save current drawing</button>
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
              Keep this drawing and start saving
            </button>
          </section>
        )}
        {active && pending && (
          <RatioDialog
            title={pending.title}
            confirmLabel="Use this drawing"
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
