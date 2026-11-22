/**
 * Probability objects: spinners, dice and bags of counters, drawn as an Edexcel paper draws them
 * (SP3, SP5, SP7). Up to four objects sit side by side ("Here is a fair dice and a fair 8-sided
 * spinner").
 *
 * - Spinners are circles or regular polygons cut into 2 to 12 sectors, equal or with given angles,
 *   with a pointer (an arrow from the centre, or the stick through a polygon spinner as recent
 *   papers draw it). Sector labels are numbers, letters or colour words; fills (grey, hatched,
 *   dotted) keep colours readable in black and white.
 * - Dice are a cube with three faces showing, or a row of flat faces, marked with pips or numbers.
 * - Bags hold up to 40 counters in groups, each group with a label and a fill.
 *
 * Every label is {text, show}. Empty text is a pupil blank (a dotted line, unless the object prints
 * nothing for empty labels). A hidden label keeps its saved answer: pupils see the blank and the
 * answers copy prints it in the answer colour. Nothing is ever worked out or filled in.
 */
import { z } from "zod";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";
import { FONT, esc, mathsHeight, mathsMarkup, mathsWidth } from "../../function-machine-core/src/maths-text";

/** The renderer version every new probability-objects envelope carries. */
export const RENDERER_VERSION = "probability-objects-1" as const;

export const MAX_OBJECTS = 4;
export const MIN_SECTORS = 2;
export const MAX_SECTORS = 12;
export const MAX_FACES = 6;
export const MAX_GROUPS = 6;
export const MAX_COUNTERS = 40;
export const MAX_TEXT = 12;
export const MAX_CAPTION = 24;
export const SPINNER_MM = { min: 25, max: 80, default: 40 } as const;
export const DICE_MM = { min: 12, max: 30, default: 18 } as const;
export const ANSWER_COLOUR = "#b0125b";
export const FILLS = ["none", "grey", "hatched", "dotted"] as const;
export type Fill = (typeof FILLS)[number];
export const FILL_NAMES: Record<Fill, string> = { none: "White", grey: "Grey", hatched: "Hatched", dotted: "Dotted" };

/** "omit" (Leave out, 22 Nov 2026) keeps the value but prints nothing in either copy, not even a blank. */
const show = z.enum(["show", "hidden", "omit"]);
export const valueSchema = z.object({ text: z.string().max(MAX_TEXT), show }).strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
const fill = z.enum(FILLS);
const caption = z.string().max(MAX_CAPTION).describe('Printed under the object, such as "Spinner A"; "" for none.');
/** What an empty label prints: a dotted line for pupils to write on, or nothing. */
const emptyLabels = z.enum(["blank", "none"]);

export const sectorSchema = z
  .object({
    label: valueSchema,
    fill,
    /** The sector's angle in degrees, or null to share what is left equally. */
    angle: z.number().positive().max(360).nullable(),
  })
  .strict();
export const spinnerSchema = z
  .object({
    id,
    type: z.literal("spinner"),
    /** A circle, or a regular polygon with one side per sector (equal sectors only). */
    shape: z.enum(["circle", "polygon"]),
    sectors: z.array(sectorSchema).min(MIN_SECTORS).max(MAX_SECTORS),
    /** Where the first sector starts, in degrees clockwise from 12 o'clock. */
    rotation: z.number().min(0).lt(360),
    /** An arrow from the centre, the stick through the spinner, or none. */
    pointer: z.enum(["arrow", "stick", "none"]),
    /** The pointer's direction in degrees clockwise from 12 o'clock. */
    pointerAngle: z.number().min(0).lt(360),
    /** Marks a right angle at the centre of every 90° sector (circles only). */
    rightAngles: z.boolean(),
    sizeMm: z.number().min(SPINNER_MM.min).max(SPINNER_MM.max),
    emptyLabels,
    caption,
  })
  .strict();
export const diceSchema = z
  .object({
    id,
    type: z.literal("dice"),
    /** A cube with its front, top and right faces showing, or a row of flat faces. */
    view: z.enum(["cube", "faces"]),
    /** Cube: exactly three faces, front, top and right. Faces: 1 to 6 faces, left to right. */
    faces: z.array(valueSchema).min(1).max(MAX_FACES),
    /** Pips for the numbers 1 to 6 (anything else prints as written), or every face written. */
    marks: z.enum(["pips", "numbers"]),
    sizeMm: z.number().min(DICE_MM.min).max(DICE_MM.max),
    emptyLabels,
    caption,
  })
  .strict();
export const groupSchema = z
  .object({
    /** Printed on every counter of the group, such as "R" or "5"; "" for plain counters. */
    label: valueSchema,
    fill,
    count: z.number().int().min(1).max(MAX_COUNTERS),
  })
  .strict();
export const bagSchema = z
  .object({
    id,
    type: z.literal("bag"),
    groups: z.array(groupSchema).min(1).max(MAX_GROUPS),
    /** Counters in each row, 1-10. Left out, the bag picks a near-square layout. */
    perRow: z.number().int().min(1).max(10).optional(),
    caption,
  })
  .strict();
export const objectSchema = z.discriminatedUnion("type", [spinnerSchema, diceSchema, bagSchema]);
export const documentSchema = z
  .object({
    objects: z.array(objectSchema).min(1).max(MAX_OBJECTS),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("probability-objects"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(RENDERER_VERSION),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type ObjectsDocument = Envelope["document"];
export type ProbabilityObject = ObjectsDocument["objects"][number];
export type Spinner = Extract<ProbabilityObject, { type: "spinner" }>;
export type Dice = Extract<ProbabilityObject, { type: "dice" }>;
export type Bag = Extract<ProbabilityObject, { type: "bag" }>;
export type Sector = Spinner["sectors"][number];
export type Group = Bag["groups"][number];
export type Value = Sector["label"];
/** A label on an object: a spinner's sector, a dice face or a bag's group of counters. */
export type Slot = `sector:${number}` | `face:${number}` | `group:${number}`;

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });

/* ---------- Validation ---------- */

const EPS = 1e-6;
/** Each sector's angle in degrees: given angles as they are, the rest sharing what is left. */
export function sectorAngles(s: Spinner): number[] {
  const given = s.sectors.reduce((a, x) => a + (x.angle ?? 0), 0),
    open = s.sectors.filter((x) => x.angle === null).length;
  return s.sectors.map((x) => x.angle ?? (360 - given) / open);
}
function checkSpinner(s: Spinner) {
  const given = s.sectors.reduce((a, x) => a + (x.angle ?? 0), 0),
    open = s.sectors.filter((x) => x.angle === null).length;
  if (given > 360 + EPS) throw Error(`The sector angles add up to ${round(given)}°, more than 360°.`);
  if (open === 0 && Math.abs(given - 360) > EPS) throw Error(`The sector angles add up to ${round(given)}°. Make them 360°, or leave one blank to take what is left.`);
  if (open > 0 && 360 - given < EPS) throw Error("The given angles already make 360°, so there is nothing left for the sectors without an angle.");
  if (s.shape === "polygon") {
    const a = sectorAngles(s);
    if (a.some((x) => Math.abs(x - a[0]) > EPS)) throw Error("A polygon spinner has equal sectors. Use a circle for sectors of different sizes.");
    if (s.sectors.length < 3) throw Error("A polygon spinner needs at least 3 sides. Use a circle for 2 sectors.");
  }
}
export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0],
      path = issue?.path ?? [];
    const leaf = path.at(-1),
      size = issue?.code === "too_small" || issue?.code === "too_big";
    if (leaf === "text") throw Error(`Use at most ${MAX_TEXT} characters in each label.`);
    if (leaf === "caption") throw Error(`Use at most ${MAX_CAPTION} characters in a caption.`);
    if (leaf === "angle") throw Error("A sector angle is more than 0° and at most 360°, or empty to share what is left.");
    if (leaf === "fill") throw Error(`A fill is one of ${FILLS.join(", ")}.`);
    if (leaf === "rotation" || leaf === "pointerAngle") throw Error("Turns and pointer directions are 0° up to (not including) 360°.");
    if (leaf === "id") throw Error("Object IDs are short lower-case names such as o1.");
    if (leaf === "count") throw Error(`A group has 1 to ${MAX_COUNTERS} counters.`);
    if (leaf === "perRow") throw Error("A bag has 1 to 10 counters in each row.");
    if (leaf === "sectors" && size) throw Error(`A spinner has ${MIN_SECTORS} to ${MAX_SECTORS} sectors.`);
    if (leaf === "faces" && size) throw Error(`A dice shows 1 to ${MAX_FACES} faces.`);
    if (leaf === "groups" && size) throw Error(`A bag has 1 to ${MAX_GROUPS} groups of counters.`);
    if (leaf === "objects" && size) throw Error(`Use 1 to ${MAX_OBJECTS} objects.`);
    if (leaf === "sizeMm") throw Error(`Spinners are ${SPINNER_MM.min} to ${SPINNER_MM.max} mm across; dice are ${DICE_MM.min} to ${DICE_MM.max} mm.`);
    throw Error("This is not a supported spinners, dice and bags file (version 1 is supported).");
  }
  const e = parsed.data;
  const ids = new Set<string>();
  for (const o of e.document.objects) {
    if (ids.has(o.id)) throw Error(`The object ID ${o.id} appears twice.`);
    ids.add(o.id);
    o.caption = o.caption.trim().replace(/\s+/g, " ");
    if (o.type === "spinner") checkSpinner(o);
    if (o.type === "dice" && o.view === "cube" && o.faces.length !== 3) throw Error("A dice drawn as a cube shows three faces: front, top and right.");
    if (o.type === "bag" && o.groups.reduce((a, g) => a + g.count, 0) > MAX_COUNTERS) throw Error(`A bag holds at most ${MAX_COUNTERS} counters.`);
    for (const v of labels(o)) {
      v.text = v.text.trim().replace(/\s+/g, " ");
      if (!v.text && v.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
    }
  }
  return e;
}
/** Every label of an object, in order. */
export function labels(o: ProbabilityObject): Value[] {
  return o.type === "spinner" ? o.sectors.map((s) => s.label) : o.type === "dice" ? o.faces : o.groups.map((g) => g.label);
}
export function slots(o: ProbabilityObject): Slot[] {
  const kind = o.type === "spinner" ? "sector" : o.type === "dice" ? "face" : "group";
  return labels(o).map((_, i) => `${kind}:${i}` as Slot);
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) => e.document.objects.some((o) => labels(o).some((v) => v.show === "hidden" && !!v.text));

/* ---------- Building ---------- */

export function newSpinner(objectId: string, texts: string[] = ["1", "2", "3", "4"]): Spinner {
  return {
    id: objectId,
    type: "spinner",
    shape: "circle",
    sectors: texts.map((t) => ({ label: value(t), fill: "none", angle: null })),
    rotation: 0,
    pointer: "arrow",
    pointerAngle: 40,
    rightAngles: false,
    sizeMm: SPINNER_MM.default,
    emptyLabels: "blank",
    caption: "",
  };
}
export function newDice(objectId: string, view: Dice["view"] = "cube"): Dice {
  return {
    id: objectId,
    type: "dice",
    view,
    faces: (view === "cube" ? ["3", "1", "2"] : ["1", "2", "3", "4", "5", "6"]).map((t) => value(t)),
    marks: "pips",
    sizeMm: DICE_MM.default,
    emptyLabels: "blank",
    caption: "",
  };
}
export function newBag(objectId: string): Bag {
  return {
    id: objectId,
    type: "bag",
    groups: [
      { label: value("R"), fill: "none", count: 3 },
      { label: value("B"), fill: "grey", count: 2 },
    ],
    caption: "",
  };
}
export const newObject = (type: ProbabilityObject["type"], objectId: string): ProbabilityObject =>
  type === "spinner" ? newSpinner(objectId) : type === "dice" ? newDice(objectId) : newBag(objectId);

/** One fair four-sector spinner, labelled 1 to 4. */
export function create(): Envelope {
  return validate({ kind: "probability-objects", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { objects: [newSpinner("o1")] } });
}
const clone = (e: Envelope) => structuredClone(e);
export function objectOf(d: ObjectsDocument, objectId: string): ProbabilityObject {
  const o = d.objects.find((x) => x.id === objectId);
  if (!o) throw Error(`There is no object ${objectId}.`);
  return o;
}
export function freshObjectId(d: ObjectsDocument) {
  let i = 1;
  while (d.objects.some((o) => o.id === `o${i}`)) i++;
  return `o${i}`;
}
export function slotValue(o: ProbabilityObject, slot: Slot): Value {
  const [kind, at] = slot.split(":"),
    i = Number(at);
  const want = o.type === "spinner" ? "sector" : o.type === "dice" ? "face" : "group";
  const v = kind === want ? labels(o)[i] : undefined;
  if (!v) throw Error(`There is no ${slot.replace(":", " ")} on this ${o.type}.`);
  return v;
}
/** Sets a label's text and visibility. Hiding an empty label is refused: a blank has no answer to keep. */
export function setLabel(e: Envelope, objectId: string, slot: Slot, change: { text?: string; show?: Value["show"] }): Envelope {
  const n = clone(e),
    v = slotValue(objectOf(n.document, objectId), slot);
  if (change.text !== undefined) v.text = change.text.trim();
  if (!v.text && change.show === "hidden") throw Error("A blank cannot hold a hidden answer. Enter the answer, then hide it.");
  // A blank keeps a chosen state (show or left out); an emptied hidden label becomes a plain blank.
  v.show = change.show ?? (!v.text && v.show === "hidden" ? "show" : v.show);
  return validate(n);
}
/** Changes one object's settings (not its ID or type); the result must still be valid. */
export function updateObject(e: Envelope, objectId: string, update: (o: ProbabilityObject) => void): Envelope {
  const n = clone(e),
    o = objectOf(n.document, objectId),
    { id: keep, type } = o;
  update(o);
  if (o.id !== keep || o.type !== type) throw Error("An object keeps its ID and type.");
  return validate(n);
}
export function replaceObject(e: Envelope, objectId: string, next: ProbabilityObject): Envelope {
  const n = clone(e),
    at = n.document.objects.findIndex((o) => o.id === objectId);
  if (at < 0) throw Error(`There is no object ${objectId}.`);
  n.document.objects[at] = { ...structuredClone(next), id: objectId };
  return validate(n);
}
export function addObject(e: Envelope, next: ProbabilityObject | ProbabilityObject["type"]): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.objects.length >= MAX_OBJECTS) throw Error(`Use at most ${MAX_OBJECTS} objects.`);
  const objectId = freshObjectId(d);
  d.objects.push(typeof next === "string" ? newObject(next, objectId) : { ...structuredClone(next), id: objectId });
  return validate(n);
}
export function removeObject(e: Envelope, objectId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.objects.length <= 1) throw Error("A diagram needs at least one object.");
  objectOf(d, objectId);
  d.objects = d.objects.filter((o) => o.id !== objectId);
  return validate(n);
}
/** Moves an object one place left (-1) or right (+1). */
export function moveObject(e: Envelope, objectId: string, by: -1 | 1): Envelope {
  const n = clone(e),
    d = n.document,
    at = d.objects.findIndex((o) => o.id === objectId),
    to = at + by;
  if (at < 0) throw Error(`There is no object ${objectId}.`);
  if (to < 0 || to >= d.objects.length) return e;
  [d.objects[at], d.objects[to]] = [d.objects[to], d.objects[at]];
  return validate(n);
}
/**
 * Adds a sector after sector `after` (default the last). Given angles stay and the new sector shares
 * what is left; when the given angles already make 360°, every sector goes back to an equal share.
 */
export function addSector(e: Envelope, objectId: string, after = Number.POSITIVE_INFINITY, text = ""): Envelope {
  return updateObject(e, objectId, (o) => {
    if (o.type !== "spinner") throw Error("Only a spinner has sectors.");
    if (o.sectors.length >= MAX_SECTORS) throw Error(`A spinner has at most ${MAX_SECTORS} sectors.`);
    const at = Math.max(0, Math.min(o.sectors.length, after + 1));
    const full = o.sectors.every((s) => s.angle !== null);
    o.sectors.splice(at, 0, { label: value(text), fill: "none", angle: null });
    if (full) for (const s of o.sectors) s.angle = null;
  });
}
export function removeSector(e: Envelope, objectId: string, index: number): Envelope {
  return updateObject(e, objectId, (o) => {
    if (o.type !== "spinner") throw Error("Only a spinner has sectors.");
    if (o.sectors.length <= MIN_SECTORS) throw Error(`A spinner needs at least ${MIN_SECTORS} sectors.`);
    if (!o.sectors[index]) throw Error(`There is no sector ${index + 1}.`);
    o.sectors.splice(index, 1);
    // Fixed angles that no longer make 360° would be refused; the sectors then share equally.
    const given = o.sectors.reduce((a, s) => a + (s.angle ?? 0), 0);
    if (o.sectors.every((s) => s.angle !== null) && Math.abs(given - 360) > EPS) for (const s of o.sectors) s.angle = null;
  });
}

/* ---------- Teacher warnings ---------- */

const round = (v: number) => Math.round(v * 100) / 100;
const PIP = /^[1-6]$/;
export function warnings(e: Envelope): string[] {
  const out: string[] = [];
  const many = e.document.objects.length > 1;
  e.document.objects.forEach((o, k) => {
    const where = many ? `${ordinal(k)} ${o.type}: ` : "";
    if (o.type === "dice" && o.view === "cube") {
      const n = o.faces.map((f) => (PIP.test(f.text) ? Number(f.text) : null));
      const names = ["front", "top", "right"];
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
          if (n[i] === null || n[j] === null) continue;
          if (n[i] === n[j]) out.push(`${where}the ${names[i]} and ${names[j]} faces both show ${n[i]}; an ordinary dice has each number once.`);
          else if (n[i]! + n[j]! === 7) out.push(`${where}${n[i]} and ${n[j]} are on opposite faces of an ordinary dice, so they cannot both show.`);
        }
    }
    if (o.type === "spinner") for (const note of layoutSpinner(o).notes) out.push(where + note);
  });
  return [...new Set(out)];
}
const ordinal = (k: number) => ["First", "Second", "Third", "Fourth"][k] ?? `Object ${k + 1}`;

/* ---------- Views ---------- */

const REVEALED = new WeakSet<Value>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const o of n.document.objects)
    for (const v of labels(o)) {
      // A left-out label stays out of the teacher copy too.
      if (v.show === "omit") continue;
      if (mark && v.show === "hidden" && v.text) REVEALED.add(v);
      v.show = "show";
    }
  return n;
}
const printed = (v: Value) => (v.show === "show" ? v.text : "");
const ink = (v: Value) => (REVEALED.has(v) ? ANSWER_COLOUR : "black");

/* ---------- Geometry ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const LINE = 0.3;
const BLANK = 7;
const GAP = 12;
const CAPTION_GAP = 3;
const MARGIN = 1;
const MAX_WIDTH_MM = 270;
const FILL_PAINT: Record<Fill, string> = { none: "white", grey: "#cfcfcf", hatched: "url(#po-hatch)", dotted: "url(#po-dots)" };
const PATTERNS =
  `<defs><pattern id="po-hatch" patternUnits="userSpaceOnUse" width="1.6" height="1.6" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="white"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="black" stroke-width="0.25"/></pattern>` +
  `<pattern id="po-dots" patternUnits="userSpaceOnUse" width="1.6" height="1.6"><rect width="1.6" height="1.6" fill="white"/><circle cx="0.8" cy="0.8" r="0.32" fill="black"/></pattern></defs>`;
const at = (cx: number, cy: number, r: number, deg: number) => {
  const t = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(t), y: cy - r * Math.cos(t) };
};
const dotted = (cx: number, y: number, w = BLANK) =>
  `<line x1="${num(cx - w / 2)}" y1="${num(y)}" x2="${num(cx + w / 2)}" y2="${num(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;
/** A label, or its blank: text centred on (cx, cy); a blank's dotted line sits where the text's baseline would. */
function labelMarkup(v: Value, cx: number, cy: number, empty: "blank" | "none", backing = false): string {
  if (v.show === "omit") return "";
  const p = printed(v);
  if (!p) return empty === "blank" ? (backing ? backingRect(cx, cy, BLANK + 1, FONT * 1.2) : "") + dotted(cx, cy + FONT * 0.4) : "";
  const w = mathsWidth(p),
    h = mathsHeight(p);
  return (backing ? backingRect(cx, cy, w + 1, h) : "") + mathsMarkup(p, cx, cy, ink(v));
}
const backingRect = (cx: number, cy: number, w: number, h: number) =>
  `<rect x="${num(cx - w / 2)}" y="${num(cy - h / 2)}" width="${num(w)}" height="${num(h)}" rx="0.6" fill="white"/>`;
/** The room a label takes: an answer takes the room of its text on both copies. */
const labelWidth = (v: Value) => (v.text ? mathsWidth(v.text) : BLANK);

export type Hit = { objectId: string; slot: Slot; x: number; y: number; width: number; height: number };
type Drawn = { width: number; height: number; svg: string; hits: Omit<Hit, "objectId">[]; notes: string[] };

/* ---------- Spinners ---------- */

function layoutSpinner(s: Spinner): Drawn {
  const R = s.sizeMm / 2,
    angles = sectorAngles(s),
    n = s.sectors.length,
    poly = s.shape === "polygon";
  const starts: number[] = [];
  angles.reduce((a, x) => (starts.push(a), a + x), s.rotation);
  // Work in coordinates centred on (0, 0), then shift to the bounding box.
  const parts: string[] = [],
    hits: Drawn["hits"] = [],
    notes: string[] = [];
  const pts: { x: number; y: number }[] = [];
  const vertex = (k: number) => at(0, 0, R, s.rotation + (k * 360) / n);
  /** Distance from the centre to the outline in a direction. */
  const edgeAt = (deg: number) => {
    if (!poly) return R;
    const step = 360 / n,
      off = ((((deg - s.rotation) % step) + step) % step) - step / 2;
    return (R * Math.cos(Math.PI / n)) / Math.cos((off * Math.PI) / 180);
  };
  if (poly) for (let k = 0; k < n; k++) pts.push(vertex(k));
  else pts.push({ x: -R, y: -R }, { x: R, y: R });
  // Sector fills.
  s.sectors.forEach((sec, i) => {
    if (sec.fill === "none") return;
    const a0 = starts[i],
      a1 = a0 + angles[i];
    let d: string;
    if (poly) {
      const p = vertex(i),
        q = vertex(i + 1);
      d = `M0 0L${num(p.x)} ${num(p.y)}L${num(q.x)} ${num(q.y)}Z`;
    } else if (n === 1 || angles[i] >= 360 - EPS) d = `M${-R} 0A${R} ${R} 0 1 1 ${R} 0A${R} ${R} 0 1 1 ${-R} 0Z`;
    else {
      const p = at(0, 0, R, a0),
        q = at(0, 0, R, a1);
      d = `M0 0L${num(p.x)} ${num(p.y)}A${num(R)} ${num(R)} 0 ${angles[i] > 180 ? 1 : 0} 1 ${num(q.x)} ${num(q.y)}Z`;
    }
    parts.push(`<path d="${d}" fill="${FILL_PAINT[sec.fill]}" stroke="none"/>`);
  });
  // Outline and the lines between sectors.
  if (poly) parts.push(`<path d="M${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z" fill="none" stroke="black" stroke-width="${LINE}" stroke-linejoin="round"/>`);
  else parts.push(`<circle cx="0" cy="0" r="${num(R)}" fill="none" stroke="black" stroke-width="${LINE}"/>`);
  for (let i = 0; i < n; i++) {
    const p = poly ? vertex(i) : at(0, 0, R, starts[i]);
    parts.push(`<line x1="0" y1="0" x2="${num(p.x)}" y2="${num(p.y)}" stroke="black" stroke-width="${LINE}"/>`);
  }
  // Right angles: a small square in the corner of every 90° sector.
  if (s.rightAngles && !poly)
    angles.forEach((a, i) => {
      if (Math.abs(a - 90) > EPS) return;
      const m = 2.4,
        p = at(0, 0, m, starts[i]),
        q = at(0, 0, m, starts[i] + 90),
        c = { x: p.x + q.x, y: p.y + q.y };
      parts.push(`<path d="M${num(p.x)} ${num(p.y)}L${num(c.x)} ${num(c.y)}L${num(q.x)} ${num(q.y)}" fill="none" stroke="black" stroke-width="0.25"/>`);
    });
  // Labels, part way out along the middle of each sector.
  s.sectors.forEach((sec, i) => {
    const mid = starts[i] + angles[i] / 2;
    // Distance from the centre to the edge along the middle of the sector.
    const edge = poly ? R * Math.cos(Math.PI / n) : R;
    const half = (Math.min(angles[i], 180) * Math.PI) / 360;
    const w = labelWidth(sec.label),
      h = sec.label.text ? mathsHeight(sec.label.text) : FONT * 1.2;
    // Far enough out that the label fits between the sector's lines, and inside the edge.
    const needed = (w / 2 + 0.8) / Math.tan(half) + h / 2,
      r = Math.min(Math.max(edge * 0.62, needed), edge - Math.max(w, h) / 2 - 1);
    const c = at(0, 0, Math.max(r, 0), mid);
    if (angles[i] < 180 && needed > edge - Math.max(w, h) / 2 - 1 + EPS && (sec.label.text || s.emptyLabels === "blank"))
      notes.push(`Sector ${i + 1}${sec.label.text ? ` (${sec.label.text})` : ""} is too narrow for its label. Make the spinner bigger or the label shorter.`);
    parts.push(labelMarkup(sec.label, c.x, c.y, s.emptyLabels, sec.fill === "hatched" || sec.fill === "dotted"));
    hits.push({ slot: `sector:${i}`, x: c.x - Math.max(w, 5) / 2 - 1, y: c.y - Math.max(h, 5) / 2 - 0.5, width: Math.max(w, 5) + 2, height: Math.max(h, 5) + 1 });
  });
  // The pointer.
  if (s.pointer === "arrow") {
    const tail = at(0, 0, R * 0.18, s.pointerAngle + 180),
      tip = at(0, 0, R * 0.45, s.pointerAngle),
      back = at(0, 0, R * 0.45 - 2.6, s.pointerAngle),
      l = at(back.x, back.y, 1, s.pointerAngle - 90),
      rr = at(back.x, back.y, 1, s.pointerAngle + 90);
    parts.push(`<line x1="${num(tail.x)}" y1="${num(tail.y)}" x2="${num(back.x)}" y2="${num(back.y)}" stroke="black" stroke-width="0.4"/>`);
    parts.push(`<path d="M${num(tip.x)} ${num(tip.y)}L${num(l.x)} ${num(l.y)}L${num(rr.x)} ${num(rr.y)}Z" fill="black"/>`);
    parts.push(`<circle cx="0" cy="0" r="0.55" fill="black"/>`);
  } else if (s.pointer === "stick") {
    // The stick the spinner turns on: a thick tapering wedge above, a thin end below, as on the paper.
    const out = edgeAt(s.pointerAngle) + R * 0.32,
      tip = at(0, 0, out, s.pointerAngle),
      l = at(tip.x, tip.y, 0.85, s.pointerAngle - 90),
      rr = at(tip.x, tip.y, 0.85, s.pointerAngle + 90),
      a = at(0, 0, edgeAt(s.pointerAngle + 180), s.pointerAngle + 180),
      b = at(0, 0, edgeAt(s.pointerAngle + 180) + R * 0.25, s.pointerAngle + 180);
    parts.push(`<path d="M0 0L${num(l.x)} ${num(l.y)}L${num(rr.x)} ${num(rr.y)}Z" fill="black" stroke="black" stroke-width="0.2" stroke-linejoin="round"/>`);
    parts.push(`<line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" stroke="black" stroke-width="0.4"/>`);
    pts.push(l, rr, b);
  }
  const pad = 0.6,
    minX = Math.min(...pts.map((p) => p.x)) - pad,
    minY = Math.min(...pts.map((p) => p.y)) - pad,
    maxX = Math.max(...pts.map((p) => p.x)) + pad,
    maxY = Math.max(...pts.map((p) => p.y)) + pad;
  for (const h of hits) {
    h.x -= minX;
    h.y -= minY;
  }
  return { width: maxX - minX, height: maxY - minY, svg: `<g transform="translate(${num(-minX)} ${num(-minY)})">${parts.join("")}</g>`, hits, notes };
}

/* ---------- Dice ---------- */

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]],
};
type Affine = [number, number, number, number, number, number];
const apply = (m: Affine, u: number, v: number) => ({ x: m[0] * u + m[2] * v + m[4], y: m[1] * u + m[3] * v + m[5] });
/** A face's mark: pips (as ellipses on a slanted face), its text, or its blank. */
function faceMarkup(d: Dice, face: Value, m: Affine): string {
  const p = printed(face),
    c = apply(m, 0.5, 0.5);
  if (p && d.marks === "pips" && PIP.test(p))
    return `<g transform="matrix(${m.map(num).join(" ")})">${PIPS[Number(p)].map(([u, v]) => `<circle cx="${u}" cy="${v}" r="0.085" fill="${ink(face)}"/>`).join("")}</g>`;
  return labelMarkup(face, c.x, c.y, d.emptyLabels);
}
function layoutDice(d: Dice): Drawn {
  const s = d.sizeMm,
    parts: string[] = [],
    hits: Drawn["hits"] = [],
    o = MARGIN / 2;
  if (d.view === "cube") {
    const k = s * 0.38;
    const front: Affine = [s, 0, 0, s, o, o + k],
      top: Affine = [s, 0, k, -k, o, o + k],
      right: Affine = [k, -k, 0, s, o + s, o + k];
    const face = (m: Affine) => {
      const c = [apply(m, 0, 0), apply(m, 1, 0), apply(m, 1, 1), apply(m, 0, 1)];
      return `<path d="M${c.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z" fill="white" stroke="black" stroke-width="${LINE}" stroke-linejoin="round"/>`;
    };
    [front, top, right].forEach((m, i) => {
      parts.push(face(m), faceMarkup(d, d.faces[i], m));
      const xs = [0, 1].flatMap((u) => [0, 1].map((v) => apply(m, u, v)));
      const x0 = Math.min(...xs.map((p) => p.x)),
        y0 = Math.min(...xs.map((p) => p.y));
      hits.push({ slot: `face:${i}`, x: x0, y: y0, width: Math.max(...xs.map((p) => p.x)) - x0, height: Math.max(...xs.map((p) => p.y)) - y0 });
    });
    // Later buttons sit on top: the top face's over the right face's corner, the front face over both.
    hits.reverse();
    return { width: s + k + MARGIN, height: s + k + MARGIN, svg: parts.join(""), hits, notes: [] };
  }
  const gap = 3;
  d.faces.forEach((f, i) => {
    const x = o + i * (s + gap);
    parts.push(`<rect x="${num(x)}" y="${num(o)}" width="${num(s)}" height="${num(s)}" rx="${num(s * 0.12)}" fill="white" stroke="black" stroke-width="${LINE}"/>`);
    parts.push(faceMarkup(d, f, [s, 0, 0, s, x, o]));
    hits.push({ slot: `face:${i}`, x, y: o, width: s, height: s });
  });
  return { width: d.faces.length * (s + gap) - gap + MARGIN, height: s + MARGIN, svg: parts.join(""), hits, notes: [] };
}

/* ---------- Bags ---------- */

function layoutBag(b: Bag): Drawn {
  const counters = b.groups.flatMap((g, i) => Array.from({ length: g.count }, () => ({ g, i })));
  const widest = Math.max(0, ...b.groups.map((g) => (g.label.text ? mathsWidth(g.label.text) : 0)));
  const D = Math.max(8, widest + 2.6),
    gap = 1.6;
  const cols = Math.min(counters.length, b.perRow ?? Math.max(3, Math.ceil(Math.sqrt(counters.length * 1.6)))),
    rows = Math.ceil(counters.length / cols);
  const inner = cols * D + (cols - 1) * gap,
    W = inner + 8,
    x0 = MARGIN / 2,
    x1 = x0 + W,
    cx = (x0 + x1) / 2,
    nw = Math.max(8, W * 0.32);
  const neckY = MARGIN / 2 + 5,
    shoulderY = neckY + 9,
    firstRow = shoulderY + 1,
    bottom = firstRow + rows * D + (rows - 1) * gap + 4,
    r = Math.min(7, W / 4);
  const parts: string[] = [],
    hits: Drawn["hits"] = [];
  // A drawstring bag: a body with rounded corners, gathered at a tied neck, with a frill above.
  parts.push(
    `<path d="M${num(cx - nw / 2)} ${num(neckY)}Q${num(x0)} ${num(neckY + 2)} ${num(x0)} ${num(shoulderY)}L${num(x0)} ${num(bottom - r)}Q${num(x0)} ${num(bottom)} ${num(x0 + r)} ${num(bottom)}L${num(x1 - r)} ${num(bottom)}Q${num(x1)} ${num(bottom)} ${num(x1)} ${num(bottom - r)}L${num(x1)} ${num(shoulderY)}Q${num(x1)} ${num(neckY + 2)} ${num(cx + nw / 2)} ${num(neckY)}" fill="white" stroke="black" stroke-width="${LINE}" stroke-linejoin="round"/>`,
  );
  parts.push(
    `<path d="M${num(cx - nw / 2)} ${num(neckY)}L${num(cx - nw / 2 - 2.5)} ${num(neckY - 4.5)}Q${num(cx)} ${num(neckY - 2.5)} ${num(cx + nw / 2 + 2.5)} ${num(neckY - 4.5)}L${num(cx + nw / 2)} ${num(neckY)}" fill="white" stroke="black" stroke-width="${LINE}" stroke-linejoin="round"/>`,
  );
  parts.push(`<rect x="${num(cx - nw / 2 - 0.6)}" y="${num(neckY - 0.7)}" width="${num(nw + 1.2)}" height="1.4" rx="0.5" fill="black"/>`);
  counters.forEach(({ g, i }, k) => {
    const row = Math.floor(k / cols),
      inRow = row === rows - 1 ? counters.length - row * cols : cols,
      // A shorter last row is centred.
      left = cx - (inRow * D + (inRow - 1) * gap) / 2,
      ccx = left + (k - row * cols) * (D + gap) + D / 2,
      ccy = firstRow + row * (D + gap) + D / 2;
    parts.push(`<circle cx="${num(ccx)}" cy="${num(ccy)}" r="${num(D / 2)}" fill="${FILL_PAINT[g.fill]}" stroke="black" stroke-width="${LINE}"/>`);
    const p = printed(g.label);
    if (p) parts.push((g.fill === "hatched" || g.fill === "dotted" ? backingRect(ccx, ccy, mathsWidth(p) + 0.8, FONT * 1.15) : "") + mathsMarkup(p, ccx, ccy, ink(g.label)));
    hits.push({ slot: `group:${i}`, x: ccx - D / 2, y: ccy - D / 2, width: D, height: D });
  });
  return { width: W + MARGIN, height: bottom + MARGIN / 2, svg: parts.join(""), hits, notes: [] };
}

/* ---------- Layout ---------- */

function drawObject(o: ProbabilityObject): Drawn {
  return o.type === "spinner" ? layoutSpinner(o) : o.type === "dice" ? layoutDice(o) : layoutBag(o);
}
export type Placed = { object: ProbabilityObject; x: number; y: number; drawn: Drawn; captionY: number; width: number };
export function layout(e: Envelope) {
  const d = e.document,
    drawn = d.objects.map(drawObject),
    issues: string[] = [],
    hits: Hit[] = [];
  const tallest = Math.max(...drawn.map((g) => g.height));
  const captioned = d.objects.some((o) => o.caption);
  const placed: Placed[] = [];
  let x = MARGIN;
  d.objects.forEach((o, i) => {
    const g = drawn[i],
      w = Math.max(g.width, o.caption ? mathsWidth(o.caption) : 0);
    // Objects share a middle line, as the paper sets them side by side.
    const ox = x + (w - g.width) / 2,
      oy = MARGIN + (tallest - g.height) / 2;
    placed.push({ object: o, x: ox, y: oy, drawn: g, captionY: MARGIN + tallest + CAPTION_GAP + FONT * 0.6, width: w });
    for (const h of g.hits) hits.push({ ...h, objectId: o.id, x: h.x + ox, y: h.y + oy });
    x += w + GAP;
  });
  const width = x - GAP + MARGIN,
    height = MARGIN + tallest + (captioned ? CAPTION_GAP + FONT * 1.2 : 0) + MARGIN;
  if (width > MAX_WIDTH_MM) issues.push(`The objects are ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use fewer or smaller objects.`);
  return { width, height, placed, hits, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

function describe(o: ProbabilityObject): string {
  const list = (vs: Value[], blank: string) => vs.map((v) => printed(v) || blank).join(", ");
  if (o.type === "spinner")
    return `${o.shape === "polygon" ? `${o.sectors.length}-sided` : "circular"} spinner with ${o.sectors.length} ${o.sectors.some((s) => s.angle !== null) ? "" : "equal "}sectors: ${list(o.sectors.map((s) => s.label), "blank")}`;
  if (o.type === "dice") return `${o.view === "cube" ? "dice showing" : "dice faces"} ${list(o.faces, "blank")}`;
  return `bag of ${o.groups.reduce((a, g) => a + g.count, 0)} counters: ${o.groups.map((g) => `${g.count} ${printed(g.label) || (g.fill === "none" ? "plain" : g.fill)}`).join(", ")}`;
}
export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [PATTERNS, `<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  for (const p of g.placed) {
    out.push(`<g transform="translate(${num(p.x)} ${num(p.y)})">${p.drawn.svg}</g>`);
    if (p.object.caption) out.push(mathsMarkup(p.object.caption, p.x + p.drawn.width / 2, p.captionY));
  }
  const label = `${d.objects.length > 1 ? "Probability objects" : "Probability object"}: ${d.objects.map(describe).join("; ")}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#probability-objects=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/probability-objects";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported spinners, dice and bags link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This spinners, dice and bags link could not be read. Open an editable file instead.");
  }
}
