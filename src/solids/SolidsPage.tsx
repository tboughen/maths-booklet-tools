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
import { solidsGallery } from "../examples/galleryCatalogue";
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
import { housePreference } from "../site/houseStyle";
import { LINE_WEIGHTS, LINE_WEIGHT_NAMES, MIN_TEXT_PT, startingTextPt, type LineWeight } from "../../packages/envelope-core/src/house-style";
import {
  AXES,
  canonical,
  create,
  DIM_KINDS,
  hasHidden,
  hitAnchors,
  label as makeLabel,
  layout,
  LIMITS,
  MARKS,
  parseFile,
  pointList,
  printed,
  REACH,
  renderSvg,
  SHOWS,
  SIDES,
  SOLID_TYPES,
  solidPointIds,
  STYLES,
  validate,
  type Envelope,
  type Label,
  type LabelState,
  type Place,
  type Solid,
  type SolidsDocument,
  type SolidType,
} from "../../packages/solid-core/src";
import { LINK_PREFIX, parseSolidsLink, solidsLink } from "./links";
import { copyWord, downloadBoth, downloadEditable, downloadImage, printPng } from "./export";
import { handleUndoKeys, objectKeyCommand, openDraft, redoLabel as redoStepName, stepName, undoLabel as undoStepName, useDocumentHistory, useDraftAutosave } from "../editor-kit";
import { downloadName } from "../export/filenames";
import "../probability-tree/probability-tree.css";
import "../area/area.css";
import "../figures/figures.css";

const STORAGE = copyStorageKey("maths-booklet-tools:solids:v1");
type View = "pupil" | "answer";
type Kind = "solid" | "point" | "line" | "dim" | "angle";
const STATE_NAMES: Record<LabelState, string> = {
  value: "Given",
  symbol: "Letter",
  blank: "Blank (nothing printed)",
  "answer-line": "Answer line",
  hidden: "Hidden",
};
const TYPE_NAMES: Record<SolidType, string> = { prism: "Prism or cuboid", pyramid: "Pyramid or frustum", cylinder: "Cylinder", cone: "Cone or frustum", sphere: "Sphere", hemisphere: "Hemisphere" };
const AXIS_NAMES: Record<(typeof AXES)[number], string> = { x: "Across (left to right)", y: "Upwards", z: "Going back" };
const MARK_NAMES: Record<(typeof MARKS)[number], string> = { none: "No mark", arc: "Arc", right: "Right angle" };
const STYLE_NAMES: Record<(typeof STYLES)[number], string> = { solid: "Solid", dashed: "Dashed", dotted: "Dotted" };
const SHOW_NAMES: Record<(typeof SHOWS)[number], string> = { none: "Nothing", dot: "Dot" };
const SIDE_NAMES: Record<(typeof SIDES)[number], string> = { auto: "Outside the solid", left: "Left (looking along it)", right: "Right (looking along it)" };
const DIM_NAMES: Record<(typeof DIM_KINDS)[number], string> = { beside: "Beside the edge", arrow: "On a double arrow" };
const PLACE_NAMES: Record<Place["type"], string> = { at: "Anywhere", along: "On a line through two points", rim: "On a round solid's rim" };

/** A new drawing starts at the teacher's house style (U111); saved drawings keep their own settings. */
function housed(e: Envelope): Envelope {
  const house = housePreference(),
    n = structuredClone(e);
  const pt = startingTextPt(house.style, 11, { max: 14 });
  n.document.fontPt = pt === 11 ? undefined : pt;
  n.document.weight = house.lines === "bold" ? "bold" : undefined;
  return validate(n);
}
const fresh = () => housed(create());

function initial() {
  const start = openDraft({ key: STORAGE, parse: parseFile, fresh, recoveryMessage: "Saved 3D solid data needs recovery. Download the original before starting afresh." });
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
/** Every ID in the drawing, generated corners included, so a new object never takes one in use. */
function usedIds(d: SolidsDocument) {
  return new Set([...d.solids.flatMap((s) => [s.id, ...solidPointIds(s)]), ...d.points, ...d.lines, ...d.dims, ...d.angles].map((x) => (typeof x === "string" ? x : x.id)));
}
function nextId(d: SolidsDocument, prefix: string) {
  const used = usedIds(d);
  for (let k = 1; ; k++) if (!used.has(`${prefix}${k}`)) return `${prefix}${k}`;
}
/** A one-letter solid ID whose corner names are all free. */
function nextSolidId(d: SolidsDocument, type: SolidType) {
  const used = usedIds(d);
  for (const id of "pqrsuvwkcmnjgfedba") {
    const ids = solidPointIds({ ...starter(type, { x: 0, y: 0, z: 0 }), id });
    if (!used.has(id) && ids.every((x) => !used.has(x))) return id;
  }
  return null;
}
function starter(type: SolidType, at: { x: number; y: number; z: number }): Solid {
  switch (type) {
    case "prism":
      return { id: "", type, at, section: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }], length: 25, axis: "z" };
    case "pyramid":
      return { id: "", type, at, base: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }], apex: { x: 15, y: 35, z: -15 }, top: 0 };
    case "cylinder":
      return { id: "", type, at, r: 12, h: 30, axis: "y" };
    case "cone":
      return { id: "", type, at, r: 12, h: 30, top: 0, axis: "y" };
    case "sphere":
      return { id: "", type, at, r: 15, equator: true };
    case "hemisphere":
      return { id: "", type, at, r: 15, flat: "up" };
  }
}
/** A solid changed to another type keeps its place and, where the new type has them, its radius, height and direction. */
function retyped(s: Solid, type: SolidType): Solid {
  const next = { ...starter(type, s.at), id: s.id } as Solid & Record<string, unknown>;
  const old = s as Solid & Record<string, unknown>;
  for (const k of ["r", "h", "axis"]) if (k in next && k in old) next[k] = old[k];
  return next;
}
/** The rims a round solid has: a base (or a sphere's equator), and a top on a cylinder or frustum. */
function rimsOf(s: Solid): ("base" | "top")[] {
  if (s.type === "cylinder" || (s.type === "cone" && s.top > 0)) return ["base", "top"];
  return s.type === "prism" || s.type === "pyramid" ? [] : ["base"];
}
/** The points, lines, lengths and angles that use any of these point IDs, followed through points placed along them. */
function usersOf(d: SolidsDocument, ids: string[], solid?: string) {
  const gone = new Set(ids);
  const points = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of d.points) {
      if (points.has(p.id)) continue;
      const pl = p.place;
      if ((pl.type === "along" && (gone.has(pl.a) || gone.has(pl.b))) || (pl.type === "rim" && pl.solid === solid)) {
        points.add(p.id);
        gone.add(p.id);
        changed = true;
      }
    }
  }
  return {
    gone,
    points,
    lines: d.lines.filter((l) => gone.has(l.a) || gone.has(l.b)).map((l) => l.id),
    dims: d.dims.filter((m) => gone.has(m.a) || gone.has(m.b)).map((m) => m.id),
    angles: d.angles.filter((a) => [a.at, a.from, a.to].some((x) => gone.has(x))).map((a) => a.id),
  };
}
/** Removes an object and everything built on it. Returns how many other objects went with it. */
function removeWithDependents(d: SolidsDocument, kind: Kind, rid: string): number {
  if (kind === "line" || kind === "dim" || kind === "angle") {
    const key = ({ line: "lines", dim: "dims", angle: "angles" } as const)[kind];
    (d[key] as { id: string }[]) = d[key].filter((x) => x.id !== rid);
    return 0;
  }
  const solid = kind === "solid" ? d.solids.find((s) => s.id === rid) : undefined;
  const u = usersOf(d, solid ? solidPointIds(solid) : [rid], solid?.id);
  if (kind === "point") u.points.delete(rid);
  d.solids = d.solids.filter((s) => s.id !== solid?.id);
  d.points = d.points.filter((p) => p.id !== rid && !u.points.has(p.id));
  d.lines = d.lines.filter((x) => !u.lines.includes(x.id));
  d.dims = d.dims.filter((x) => !u.dims.includes(x.id));
  d.angles = d.angles.filter((x) => !u.angles.includes(x.id));
  d.names = d.names.filter((x) => !u.gone.has(x.id) && x.id !== rid);
  return u.points.size + u.lines.length + u.dims.length + u.angles.length;
}
const cornersText = (list: { x: number; y: number }[]) => list.map((p) => `${round(p.x)} ${round(p.y)}`).join(", ");
function parseCorners(text: string): { x: number; y: number }[] | null {
  const pairs = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const out = pairs.map((s) => s.split(/\s+/).map(num));
  if (out.length < 3 || out.length > 12 || out.some((p) => p.length !== 2 || p.some((v) => !(Math.abs(v) <= REACH)))) return null;
  return out.map(([x, y]) => ({ x, y }));
}

/** The label editor shared by lengths and angles. */
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
              if ((state === "value" || state === "symbol") && !value.text) return onMessage(state === "value" ? (isAngle ? "Type the size first, such as 35." : "Type the length first, such as 8 cm.") : "Type the letter first, such as x.");
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
        {isAngle ? "Type angle sizes without the degree sign: 35 prints as 35° and x as x°." : "Type lengths with their units (8 cm)."} 1/2 prints as a stacked fraction. A saved answer prints only on the answers copy.
      </p>
      {value.state !== "value" && value.answer && <p className="pt-note">The answers copy prints {printed(value, "answer", isAngle).text} here in pink; the pupil copy never shows it.</p>}
    </>
  );
}

export default function SolidsPage({ active = true }: { active?: boolean }) {
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
    [pending, setPending] = useState<{ e: Envelope; title: string; explanation: string } | null>(null),
    [adding, setAdding] = useState<{ a: string; b: string; c: string; type: SolidType }>({ a: "", b: "", c: "", type: "cylinder" });
  const file = useRef<HTMLInputElement>(null);
  const e = history.present,
    d = e.document,
    g = useMemo(() => layout(e), [e]),
    blocked = busy || recovery !== null || pending !== null;
  const fitted = useResourceFit((g.width * 96) / 25.4, (g.height * 96) / 25.4, zoom, (w) => (w < 500 ? 72 : 120));
  const answerSvg = useMemo(() => renderSvg(e, "answer"), [e]);
  const viewSvg = useMemo(() => (view === "answer" ? answerSvg : renderSvg(e, "pupil")), [e, view, answerSvg]);
  const issue = [...g.issues, workedIssue(answerSvg, e)].filter(Boolean).join(" ");
  const pxPerMm = (96 / 25.4) * fitted.scale;
  const allPoints = useMemo(() => pointList(d), [d]);
  const pointIds = allPoints.map((p) => p.id);
  const lists = { solid: d.solids, point: allPoints, line: d.lines, dim: d.dims, angle: d.angles } as const;
  const current = selected && lists[split(selected).kind]?.some((x) => x.id === split(selected).id) ? split(selected) : null;
  const nameOf = (pid: string) => d.names.find((x) => x.id === pid)?.text || pid;
  const describe = (kind: Kind, id: string) => {
    if (kind === "solid") return `${TYPE_NAMES[d.solids.find((s) => s.id === id)!.type]} ${id}`;
    if (kind === "point") return `Point ${nameOf(id)}`;
    if (kind === "line") {
      const l = d.lines.find((x) => x.id === id)!;
      return `Line ${nameOf(l.a)}${nameOf(l.b)}`;
    }
    if (kind === "dim") {
      const m = d.dims.find((x) => x.id === id)!;
      return `Length ${nameOf(m.a)}${nameOf(m.b)}`;
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
  function patch(update: (n: SolidsDocument) => void, label?: string) {
    if (blocked) return false;
    const n = structuredClone(e);
    update(n.document);
    return commit(n, label);
  }
  const extra = (id: string) => d.points.some((p) => p.id === id);
  const removable = (kind: Kind, id: string) => (kind === "solid" ? d.solids.length > 1 : kind === "point" ? extra(id) : true);
  function removeObject(kind: Kind, id: string) {
    if (!removable(kind, id)) return setMessage(kind === "solid" ? "A drawing keeps at least one solid. Change its type instead." : "A solid's own corners and centres go only with the solid.");
    let more = 0;
    const ok = patch((n) => void (more = removeWithDependents(n, kind, id)), `remove ${kind === "dim" ? "length" : kind}`);
    if (ok) {
      setSelected(null);
      if (more > 0) setMessage(`${more === 1 ? "One object" : `${more} objects`} built on it ${more === 1 ? "was" : "were"} removed too. Undo brings ${more === 1 ? "it" : "them"} back.`);
    }
  }
  const undo = () => !blocked && documentHistory.undo();
  const redo = () => !blocked && documentHistory.redo();
  function replace(next: Envelope, title: string, explanation = "This replaces the current drawing. You can undo the replacement.") {
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
        removeObject(current.kind, current.id);
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
        const incoming = parseSolidsLink(location.href);
        linkPending.current = true;
        replace(incoming, "Open the linked 3D solid?");
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
      replace(parseFile(await upload.text()), "Open this 3D solid?");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  /* ---------- Adding ---------- */

  const pick = (v: string, list: string[], k: number) => (list.includes(v) ? v : list[k] ?? "");
  const addA = pick(adding.a, pointIds, 0),
    addB = pick(adding.b, pointIds.filter((x) => x !== addA), 0),
    addC = pick(adding.c, pointIds.filter((x) => x !== addA && x !== addB), 0);
  const round3 = d.solids.filter((s) => s.type === "cylinder" || s.type === "cone" || s.type === "sphere" || s.type === "hemisphere");
  function addDim() {
    if (d.dims.length >= LIMITS.dims) return setMessage(`A drawing holds up to ${LIMITS.dims} lengths.`);
    const id = nextId(d, "l");
    if (patch((n) => void n.dims.push({ id, a: addA, b: addB, kind: "beside", offset: 0, gap: false, side: "auto", label: makeLabel() }), "add length")) setSelected(keyOf("dim", id));
  }
  function addLine() {
    if (d.lines.length >= LIMITS.lines) return setMessage(`A drawing holds up to ${LIMITS.lines} extra lines.`);
    const id = nextId(d, "k");
    if (patch((n) => void n.lines.push({ id, a: addA, b: addB, style: "solid" }), "add line")) setSelected(keyOf("line", id));
  }
  function addAngle() {
    if (d.angles.length >= LIMITS.angles) return setMessage(`A drawing holds up to ${LIMITS.angles} angles.`);
    const id = nextId(d, "g");
    // The vertex is the middle point picked, between the two arms.
    if (patch((n) => void n.angles.push({ id, at: addB, from: addA, to: addC, mark: "arc", label: makeLabel() }), "add angle")) setSelected(keyOf("angle", id));
  }
  function addPoint(place: Place, step: string) {
    if (d.points.length >= LIMITS.points) return setMessage(`A drawing holds up to ${LIMITS.points} extra points.`);
    const id = nextId(d, "m");
    if (patch((n) => void n.points.push({ id, place, show: "none" }), step)) setSelected(keyOf("point", id));
  }
  function addSolid() {
    if (d.solids.length >= LIMITS.solids) return setMessage(`A drawing holds up to ${LIMITS.solids} solids.`);
    const sid = nextSolidId(d, adding.type);
    if (!sid) return setMessage("There is no free letter for another solid. Remove one first.");
    // Beside the solids already drawn, so nothing overlaps until the teacher places it.
    const xs = [...g.geometry.built.points.values()].map((p) => p.x);
    const at = { x: Math.min(REACH - 40, Math.round(Math.max(...xs)) + 15), y: 0, z: 0 };
    if (patch((n) => void n.solids.push({ ...starter(adding.type, at), id: sid }), "add solid")) setSelected(keyOf("solid", sid));
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
  const choice = <T extends string>(aria: string, value: T, options: readonly T[], names: Record<T, string>, onPick: (v: T) => void) => (
    <select aria-label={aria} value={value} disabled={blocked} onChange={(ev) => onPick(ev.target.value as T)}>
      {options.map((x) => (
        <option key={x} value={x}>
          {names[x]}
        </option>
      ))}
    </select>
  );
  const pointSelect = (aria: string, value: string, onPick: (v: string) => void, list = pointIds) => (
    <select aria-label={aria} value={value} disabled={blocked} onChange={(ev) => onPick(ev.target.value)}>
      {allPoints
        .filter((p) => list.includes(p.id))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
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
  const xyz = (prefix: string, value: { x: number; y: number; z: number }, apply: (v: { x: number; y: number; z: number }) => boolean) =>
    (["x", "y", "z"] as const).map((k) =>
      labelled(
        `${prefix} ${({ x: "across", y: "up", z: "back" } as const)[k]} (mm)`,
        mmField(`${prefix} ${({ x: "across", y: "up", z: "back" } as const)[k]}`, k === "z" ? -value[k] : value[k], (v) => apply({ ...value, [k]: k === "z" ? -v : v }), -REACH, REACH),
        `${prefix}-${k}`,
      ),
    );

  function solidFields(s: Solid) {
    const set = (update: (x: Solid) => void, step = "change solid") => patch((n) => update(n.solids.find((x) => x.id === s.id)!), step);
    const fields: ReactNode[] = [
      labelled(
        "Solid",
        <select
          aria-label="Solid type"
          value={s.type}
          disabled={blocked}
          onChange={(ev) => {
            const type = ev.target.value as SolidType;
            const next = retyped(s, type);
            // Corners and rims that no longer exist take the points, lengths and angles on them, which the teacher can undo.
            const kept = new Set(solidPointIds(next));
            const rims = rimsOf(next);
            const gone = [
              ...solidPointIds(s).filter((x) => !kept.has(x)),
              ...d.points.filter((p) => p.place.type === "rim" && p.place.solid === s.id && !rims.includes(p.place.end)).map((p) => p.id),
            ];
            const ok = patch((n) => {
              if (gone.length) {
                const u = usersOf(n, gone);
                n.points = n.points.filter((p) => !u.gone.has(p.id));
                n.lines = n.lines.filter((x) => !u.lines.includes(x.id));
                n.dims = n.dims.filter((x) => !u.dims.includes(x.id));
                n.angles = n.angles.filter((x) => !u.angles.includes(x.id));
                n.names = n.names.filter((x) => !u.gone.has(x.id));
              }
              n.solids = n.solids.map((x) => (x.id === s.id ? next : x));
            }, "change solid type");
            if (ok && gone.length) setMessage("What was on corners or rims the new solid does not have was removed with them. Undo brings it back.");
          }}
        >
          {SOLID_TYPES.map((x) => (
            <option key={x} value={x}>
              {TYPE_NAMES[x]}
            </option>
          ))}
        </select>,
        "type",
      ),
      ...xyz(s.type === "prism" || s.type === "pyramid" ? "Corner" : s.type === "hemisphere" ? "Centre of the flat face" : s.type === "sphere" ? "Centre" : "Base centre", s.at, (v) => set((x) => void (x.at = v), "move solid")),
    ];
    if (s.type === "prism")
      fields.push(
        labelled("Length (mm)", mmField("Prism length", s.length, (v) => set((x) => void ((x as typeof s).length = v)), 2, 150), "length"),
        labelled("Runs", choice("Prism direction", s.axis, AXES, AXIS_NAMES, (v) => void set((x) => void ((x as typeof s).axis = v))), "axis"),
        <label key="section" className="fig-wide">
          Cross-section corners (mm, across then up, anticlockwise)
          <DraftField
            label="Cross-section corners"
            value={cornersText(s.section)}
            maxLength={200}
            disabled={blocked}
            onCommit={(v) => {
              const c = parseCorners(v);
              if (!c) {
                setMessage("Give 3 to 12 corners as pairs of numbers, such as 0 0, 30 0, 30 20.");
                return false;
              }
              return set((x) => void ((x as typeof s).section = c), "change cross-section");
            }}
          />
        </label>,
      );
    if (s.type === "pyramid")
      fields.push(
        ...xyz("Apex", s.apex, (v) => set((x) => void ((x as typeof s).apex = v), "move apex")),
        labelled("Cut off (frustum, 0 to 0.9)", mmField("Frustum cut", s.top, (v) => set((x) => void ((x as typeof s).top = v), "frustum"), 0, 0.9), "top"),
        <label key="base" className="fig-wide">
          Base corners (mm, across then back, anticlockwise)
          <DraftField
            label="Base corners"
            value={cornersText(s.base)}
            maxLength={200}
            disabled={blocked}
            onCommit={(v) => {
              const c = parseCorners(v);
              if (!c) {
                setMessage("Give 3 to 12 corners as pairs of numbers, such as 0 0, 30 0, 30 30, 0 30.");
                return false;
              }
              return set((x) => void ((x as typeof s).base = c), "change base");
            }}
          />
        </label>,
      );
    if (s.type === "cylinder" || s.type === "cone") {
      fields.push(
        labelled("Radius (mm)", mmField("Radius", s.r, (v) => set((x) => void ((x as typeof s).r = v)), 3, 80), "r"),
        labelled("Height (mm)", mmField("Height", s.h, (v) => set((x) => void ((x as typeof s).h = v)), 1, 150), "h"),
        labelled("Axis", choice("Axis", s.axis, AXES, AXIS_NAMES, (v) => void set((x) => void ((x as typeof s).axis = v))), "axis"),
      );
      if (s.type === "cone") fields.push(labelled("Top radius (frustum; 0 for a point)", mmField("Top radius", s.top, (v) => set((x) => void ((x as typeof s).top = v)), 0, 80), "top"));
    }
    if (s.type === "sphere" || s.type === "hemisphere") fields.push(labelled("Radius (mm)", mmField("Radius", s.r, (v) => set((x) => void ((x as typeof s).r = v)), 3, 80), "r"));
    if (s.type === "hemisphere")
      fields.push(labelled("Flat face", choice("Flat face", s.flat, ["up", "down"] as const, { up: "On top (a bowl, or a base for a cone)", down: "Underneath (a dome)" }, (v) => void set((x) => void ((x as typeof s).flat = v))), "flat"));
    return (
      <>
        <div className="pt-fields">{fields}</div>
        {s.type === "sphere" && (
          <label className="pt-hide">
            <input type="checkbox" disabled={blocked} checked={s.equator} onChange={(ev) => set((x) => void ((x as typeof s).equator = ev.target.checked), "equator")} />
            Draw the equator (back half dashed)
          </label>
        )}
        <p className="pt-note">
          Its corners and centres are {solidPointIds(s).map((x) => nameOf(x)).join(", ")}. Choose one in the Object list to name it.
        </p>
      </>
    );
  }

  function selectedCard() {
    if (!current) return <p className="pt-note">Click a length, angle or corner on the drawing, or choose an object above, to change it.</p>;
    const { kind, id } = current;
    const remove = (
      <div className="pt-row">
        <button type="button" disabled={blocked || !removable(kind, id)} onClick={() => removeObject(kind, id)}>
          Remove {kind === "dim" ? "length" : kind}
        </button>
      </div>
    );
    if (kind === "solid") {
      const s = d.solids.find((x) => x.id === id)!;
      return (
        <>
          {solidFields(s)}
          {remove}
          <p className="pt-note">Removing a solid also removes the lengths, lines, angles and points on it. Undo brings them back.</p>
        </>
      );
    }
    if (kind === "point") {
      const p = d.points.find((x) => x.id === id);
      const name = d.names.find((x) => x.id === id)?.text ?? "";
      const setPlace = (place: Place, step = "move point") => patch((n) => void (n.points.find((x) => x.id === id)!.place = place), step);
      return (
        <>
          <div className="pt-fields">
            {labelled(
              "Name",
              <DraftField
                label="Point name"
                value={name}
                maxLength={3}
                disabled={blocked}
                onCommit={(v) =>
                  patch((n) => {
                    n.names = n.names.filter((x) => x.id !== id);
                    if (v.trim()) n.names.push({ id, text: v.trim() });
                  }, "name point")
                }
              />,
            )}
            {p && labelled("Mark", choice("Point mark", p.show, SHOWS, SHOW_NAMES, (v) => void patch((n) => void (n.points.find((x) => x.id === id)!.show = v), "point mark")))}
          </div>
          {p && (
            <>
              <h3 className="fig-sub">Placed {PLACE_NAMES[p.place.type].toLowerCase()}</h3>
              <div className="pt-fields">
                {p.place.type === "at" && xyz("Point", p.place, (v) => setPlace({ type: "at", ...v }))}
                {p.place.type === "along" &&
                  (() => {
                    const pl = p.place;
                    const others = pointIds.filter((x) => x !== id);
                    return [
                      labelled("From", pointSelect("From", pl.a, (v) => void setPlace({ ...pl, a: v }), others), "a"),
                      labelled("Towards", pointSelect("Towards", pl.b, (v) => void setPlace({ ...pl, b: v }), others), "b"),
                      labelled("Fraction along", mmField("Fraction along", pl.t, (v) => setPlace({ ...pl, t: v }), -2, 3), "t"),
                    ];
                  })()}
                {p.place.type === "rim" &&
                  (() => {
                    const pl = p.place;
                    return [
                      labelled(
                        "Solid",
                        <select key="s" aria-label="Rim of" value={pl.solid} disabled={blocked} onChange={(ev) => setPlace({ ...pl, solid: ev.target.value })}>
                          {round3.map((s) => (
                            <option key={s.id} value={s.id}>
                              {describe("solid", s.id)}
                            </option>
                          ))}
                        </select>,
                        "solid",
                      ),
                      labelled("Rim", choice("Which rim", pl.end, ["base", "top"] as const, { base: "Base (or equator)", top: "Top" }, (v) => void setPlace({ ...pl, end: v })), "end"),
                      labelled("Round from the right (°)", mmField("Round from the right", pl.deg, (v) => setPlace({ ...pl, deg: v }), 0, 360), "deg"),
                    ];
                  })()}
              </div>
              {p.place.type === "rim" && <p className="pt-note">On an upright solid 0° is the right of the rim, 90° the back, 180° the left and 270° nearest you. Lying along the depth, 0° is the right and 90° the top; lying across, 0° is the back and 90° the top.</p>}
              {remove}
              <p className="pt-note">Removing a point also removes the lengths, lines and angles on it. Undo brings them back.</p>
            </>
          )}
          {!p && <p className="pt-note">This is one of a solid&apos;s own corners or centres; it moves with the solid.</p>}
        </>
      );
    }
    if (kind === "line") {
      const l = d.lines.find((x) => x.id === id)!;
      const set = (update: (x: typeof l) => void, step = "change line") => patch((n) => update(n.lines.find((x) => x.id === id)!), step);
      return (
        <>
          <div className="pt-fields">
            {labelled("From", pointSelect("Line from", l.a, (v) => void set((x) => void (x.a = v))))}
            {labelled("To", pointSelect("Line to", l.b, (v) => void set((x) => void (x.b = v))))}
            {labelled("Line", choice("Line style", l.style, STYLES, STYLE_NAMES, (v) => void set((x) => void (x.style = v), "line style")))}
          </div>
          {remove}
        </>
      );
    }
    if (kind === "dim") {
      const m = d.dims.find((x) => x.id === id)!;
      const set = (update: (x: typeof m) => void, step = "change length") => patch((n) => update(n.dims.find((x) => x.id === id)!), step);
      return (
        <>
          <div className="pt-fields">
            {labelled("From", pointSelect("Length from", m.a, (v) => void set((x) => void (x.a = v))))}
            {labelled("To", pointSelect("Length to", m.b, (v) => void set((x) => void (x.b = v))))}
            {labelled("Shown", choice("Length shown", m.kind, DIM_KINDS, DIM_NAMES, (v) => void set((x) => void (x.kind = v), "length style")))}
            {labelled("Label side", choice("Label side", m.side, SIDES, SIDE_NAMES, (v) => void set((x) => void (x.side = v), "label side")))}
            {m.kind === "arrow" && labelled("Arrow away from the edge (mm)", mmField("Arrow offset", m.offset, (v) => set((x) => void (x.offset = v), "move arrow"), -40, 40))}
          </div>
          {m.kind === "arrow" && (
            <label className="pt-hide">
              <input type="checkbox" disabled={blocked} checked={m.gap} onChange={(ev) => set((x) => void (x.gap = ev.target.checked), "label in the arrow")} />
              Label in a gap in the arrow
            </label>
          )}
          <LabelFields value={m.label} isAngle={false} disabled={blocked} onMessage={setMessage} onChange={(update, step) => set((x) => update(x.label), step)} />
          {remove}
        </>
      );
    }
    const a = d.angles.find((x) => x.id === id)!;
    const set = (update: (x: typeof a) => void, step = "change angle") => patch((n) => update(n.angles.find((x) => x.id === id)!), step);
    return (
      <>
        <div className="pt-fields">
          {labelled("Arm to", pointSelect("First arm", a.from, (v) => void set((x) => void (x.from = v))))}
          {labelled("Vertex", pointSelect("Vertex", a.at, (v) => void set((x) => void (x.at = v))))}
          {labelled("Arm to", pointSelect("Second arm", a.to, (v) => void set((x) => void (x.to = v))))}
          {labelled("Mark", choice("Angle mark", a.mark, MARKS, MARK_NAMES, (v) => void set((x) => void (x.mark = v), "angle mark")))}
        </div>
        <LabelFields value={a.label} isAngle disabled={blocked} onMessage={setMessage} onChange={(update, step) => set((x) => update(x.label), step)} />
        {remove}
      </>
    );
  }

  const titleNote = useTitleNote({ active, about: aboutOf(e), disabled: blocked, onSave: (about) => commit(withAbout(e, about), TITLE_NOTE_STEP) });
  const worked = useWorkedNotes({ active, notes: workedOf(e), size: answerSize(answerSvg), disabled: blocked, onSave: (notes) => commit(withWorkedNotes(e, notes), WORKED_STEP) });
  const anchors = useMemo(() => hitAnchors(e, g), [e, g]);
  const anchorKind = (k: "dim" | "angle" | "point"): Kind => k;
  const objects: { key: string; text: string }[] = [
    ...d.solids.map((s) => ({ key: keyOf("solid", s.id), text: describe("solid", s.id) })),
    ...allPoints.map((p) => ({ key: keyOf("point", p.id), text: `Point ${p.name}` })),
    ...(["dim", "angle", "line"] as Kind[]).flatMap((kind) => (lists[kind] as { id: string }[]).map((x) => ({ key: keyOf(kind, x.id), text: `${describe(kind, x.id)} (${x.id})` }))),
  ];
  const v = d.view;
  const setView3 = (next: typeof d.view, step = "turn the view") => patch((n) => void (n.view = next), step);
  return (
    <div className="app-shell booklet-editor pt-editor fig-editor">
      <main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}>
        <PageHeading title="3D solids" description="Draw prisms, pyramids, cylinders, cones, spheres and hemispheres as exam papers do, with hidden edges dashed and lengths and angles given or left for pupils.">
          <ResourceSaveStatus text={saveState} />
        </PageHeading>
        <section className="workspace">
          <Panel className="editor-card">
            <EditorToolbar
              examples={
                <ExampleGallery
                  examples={solidsGallery}
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
              onReset={() => replace(fresh(), "Reset the 3D solid?")}
              resetDisabled={blocked}
              exportDisabled={blocked || !!issue}
              menuDisabled={blocked}
              busy={busy}
              onCopy={() => void run(() => copyWord(e, view), "Copied for Word at " + formatResourceSize(g.width / 10, g.height / 10) + ". Paste with Ctrl+V.")}
              onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(e, view)))}
              menuId="solids-downloads"
              menuOpen={menu}
              onMenuChange={setMenu}
            />
            <EditorDownloadMenu
              wordHelp
              id="solids-downloads"
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
                link: { action: () => navigator.clipboard.writeText(solidsLink(e, location.href)), disabled: blocked, success: "Editable link copied." },
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
                  data-testid="solids-resource"
                  style={{ width: ((g.width * 96) / 25.4) * fitted.scale, height: ((g.height * 96) / 25.4) * fitted.scale }}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) setSelected(null);
                  }}
                >
                  <div className="pt-art" dangerouslySetInnerHTML={{ __html: previewArt(viewSvg, e, view === "answer") }} />
                  {anchors.map((a) => {
                    const k = keyOf(anchorKind(a.kind), a.id);
                    const marked = a.kind !== "dim" || d.dims.find((x) => x.id === a.id)!.label.state !== "blank";
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
                </div>
              </div>
            </div>
            <EditorFoot
              zoom={zoom}
              onZoom={setZoom}
              scale={fitted.scale}
              size={<ResourceSize width={g.width / 10} height={g.height / 10} />}
              status={message}
              hint={<EditorHint tool="solids">Click a length, angle or corner to label or name it. Turn the view under View; hidden edges are dashed for you.</EditorHint>}
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
          <aside className="inspector-stack" aria-label="3D solid settings">
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
                      for (const l of [...n.dims.map((s) => s.label), ...n.angles.map((a) => a.label)])
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
            <section className="panel-card pt-panel" aria-label="View">
              <h2>View</h2>
              <div className="pt-fields">
                {labelled(
                  "Drawn as",
                  choice("Drawn as", v.type, ["oblique", "turned"] as const, { oblique: "Front face flat", turned: "Turned and tilted" }, (t) =>
                    void setView3(t === "oblique" ? { type: "oblique", angle: 35, scale: 0.5 } : { type: "turned", turn: 0, tilt: 15 }, "change the view"),
                  ),
                )}
                {v.type === "oblique" && labelled("Depth direction (°)", mmField("Depth direction", v.angle, (x) => setView3({ ...v, angle: x }), 10, 170))}
                {v.type === "oblique" && labelled("Depth scale", mmField("Depth scale", v.scale, (x) => setView3({ ...v, scale: x }), 0.3, 1))}
                {v.type === "turned" && labelled("Turn (°)", mmField("Turn", v.turn, (x) => setView3({ ...v, turn: x }), -89, 89))}
                {v.type === "turned" && labelled("Tilt (°)", mmField("Tilt", v.tilt, (x) => setView3({ ...v, tilt: x }), 0, 60))}
              </div>
              <p className="pt-note">Front face flat suits prisms and cuboids; turned and tilted suits cylinders, cones and spheres.</p>
              <p className="pt-note">{v.type === "oblique" ? "45° draws the depth up and to the right, 135° up and to the left." : "A tilt of 10° to 20° shows the top of a cylinder or cone as Edexcel draws it."}</p>
              <label className="pt-hide">
                <input type="checkbox" disabled={blocked} checked={d.hidden === "dashed"} onChange={(ev) => patch((n) => void (n.hidden = ev.target.checked ? "dashed" : "none"), "hidden edges")} />
                Dash the hidden edges (leave them out when unticked)
              </label>
            </section>
            <section className="panel-card pt-panel" aria-label="Add to the drawing">
              <h2>Add to the drawing</h2>
              <div className="pt-fields">
                {labelled("First point", pointSelect("First point", addA, (x) => setAdding({ ...adding, a: x })))}
                {labelled("Second point", pointSelect("Second point", addB, (x) => setAdding({ ...adding, b: x }), pointIds.filter((x) => x !== addA)))}
                {labelled("Third point", pointSelect("Third point", addC, (x) => setAdding({ ...adding, c: x }), pointIds.filter((x) => x !== addA && x !== addB)))}
              </div>
              <div className="pt-row fig-row">
                <button type="button" disabled={blocked || !addB || d.dims.length >= LIMITS.dims} onClick={addDim}>
                  Length from first to second
                </button>
                <button type="button" disabled={blocked || !addB || d.lines.length >= LIMITS.lines} onClick={addLine}>
                  Line from first to second
                </button>
                <button type="button" disabled={blocked || !addC || d.angles.length >= LIMITS.angles} onClick={addAngle}>
                  Angle at the second point
                </button>
                <button type="button" disabled={blocked || !addB || d.points.length >= LIMITS.points} onClick={() => addPoint({ type: "along", a: addA, b: addB, t: 0.5 }, "add midpoint")}>
                  Midpoint of first and second
                </button>
                <button
                  type="button"
                  disabled={blocked || !round3.length || d.points.length >= LIMITS.points}
                  onClick={() => addPoint({ type: "rim", solid: round3[0].id, end: "base", deg: 0 }, "add rim point")}
                >
                  Point on a rim
                </button>
              </div>
              <div className="pt-fields">
                {labelled("New solid", choice("New solid", adding.type, SOLID_TYPES, TYPE_NAMES, (t) => setAdding({ ...adding, type: t })))}
              </div>
              <div className="pt-row">
                <button type="button" disabled={blocked || d.solids.length >= LIMITS.solids} onClick={addSolid}>
                  Add the solid
                </button>
              </div>
              <p className="pt-note">A new solid goes to the right of the drawing; set its position to stand it on another. One solid does not hide another&apos;s edges, so keep joined solids side by side or stacked.</p>
            </section>
            <section className="panel-card pt-panel">
              <h2>Printing</h2>
              <div className="pt-fields">
                <label>
                  Text size
                  <select aria-label="Text size" value={d.fontPt ?? 11} disabled={blocked} onChange={(ev) => patch((n) => void (n.fontPt = Number(ev.target.value)), "change text size")}>
                    {[10, 11, 12, 13, 14].filter((x) => x >= MIN_TEXT_PT).map((x) => (
                      <option key={x} value={x}>
                        {x} pt
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lines
                  <select aria-label="Lines" value={d.weight ?? "normal"} disabled={blocked} onChange={(ev) => patch((n) => void (n.weight = (ev.target.value as LineWeight) === "bold" ? "bold" : undefined), "change lines")}>
                    {LINE_WEIGHTS.map((x) => (
                      <option key={x} value={x}>
                        {LINE_WEIGHT_NAMES[x]}
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
                  Sizes are in millimetres on the drawing: x across, y up and back going away from you. The labels you type never have to match them, as exam diagrams are not accurately drawn. A teacher note
                  says when a right-angle mark is far from 90° in the solid or two points share a name.
                </p>
                <p className="pt-note">
                  Copy for Word carries the physical size shown above the drawing; preview zoom never changes it. Download PNG (600 ppi) or PDF if your browser blocks copying, and print at 100% (actual size).
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
                downloadBlob(new Blob([recovery], { type: "application/json" }), downloadName("solids", "json", { recovery: true }));
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
