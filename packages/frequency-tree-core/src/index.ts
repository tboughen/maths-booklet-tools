import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Frequency trees, drawn left to right as in GCSE papers: the total in the
 * first oval, then one oval per group with its count, and the group names on
 * the branches or beside the ovals.
 *
 * The tree is a flat list of nodes after the total; `parent: null` joins a
 * node to the total and sibling order is list order. A node without children
 * ends its path. Every printed value is a label with its own visibility:
 * "show" prints it, "hidden" keeps it as a saved answer and leaves the oval
 * (or a dotted line) empty for pupils. An empty shown label prints nothing.
 * Nothing is calculated except by the explicit fill and calculate actions
 * below. Lengths are millimetres. The layout follows the probability tree
 * tool (packages/probability-tree-core).
 */
export const MAX_DEPTH = 2;
export const MAX_CHILDREN = 3;
export const MAX_NODES = MAX_CHILDREN + MAX_CHILDREN * MAX_CHILDREN;
export const MAX_QUESTIONS = 4;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"),
      "Use ordinary text without markup.",
    );
const show = z.enum(["show", "hidden"]);
export const countSchema = z.object({ text: plain(12), show }).strict();
export const categorySchema = z.object({ text: plain(30), show }).strict();
export const answerSchema = z.object({ text: plain(24), show }).strict();
const nodeId = z.string().regex(/^n[0-9]{1,2}$/);
export const nodeSchema = z
  .object({
    id: nodeId,
    parent: nodeId.nullable(),
    /** The group name, printed on the branch or beside the oval. */
    category: categorySchema,
    /** The frequency printed in the oval. */
    count: countSchema,
  })
  .strict();
export const questionSchema = z
  .object({
    id: z.string().regex(/^q[0-9]$/),
    text: plain(60),
    answer: answerSchema,
    /** Groups added for the top of the fraction, for the explicit Calculate action only. */
    numerator: z.array(nodeId).max(MAX_NODES),
    /** Groups added for the bottom; empty means the total. */
    denominator: z.array(nodeId).max(MAX_NODES),
  })
  .strict();
export const documentSchema = z
  .object({
    total: countSchema,
    nodes: z.array(nodeSchema).min(2).max(MAX_NODES),
    linkLabels: z.boolean(),
    labelPlace: z.enum(["branch", "node"]),
    nodeShape: z.enum(["oval", "box"]),
    questions: z.array(questionSchema).max(MAX_QUESTIONS),
    branchMm: z.number().int().min(24).max(60),
    gapMm: z.number().int().min(14).max(30),
  })
  .strict();
export const envelopeSchema = z
  .object({
    tool: z.literal("frequency-tree"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("frequency-tree-1"),
    document: documentSchema,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type TreeDocument = Envelope["document"];
export type TreeNode = z.infer<typeof nodeSchema>;
export type Label = { text: string; show: "show" | "hidden" };
export type Question = z.infer<typeof questionSchema>;

export const label = (text = "", visibility: Label["show"] = "show"): Label => ({ text, show: visibility });

/* ---------- Tree structure helpers ---------- */

export const childrenOf = (d: TreeDocument, parent: string | null) => d.nodes.filter((b) => b.parent === parent);
export const isLeaf = (d: TreeDocument, id: string) => !d.nodes.some((b) => b.parent === id);
export function depthOf(d: TreeDocument, id: string): number {
  let depth = 0,
    current: string | null = id;
  const byId = new Map(d.nodes.map((b) => [b.id, b]));
  while (current !== null && depth <= MAX_DEPTH + 1) {
    depth++;
    current = byId.get(current)?.parent ?? null;
  }
  return depth;
}
/** Nodes from the first level to this one. */
export function pathTo(d: TreeDocument, id: string): TreeNode[] {
  const byId = new Map(d.nodes.map((b) => [b.id, b]));
  const path: TreeNode[] = [];
  let current = byId.get(id);
  while (current && path.length <= MAX_DEPTH) {
    path.unshift(current);
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return path;
}
/** Path ends in reading order (top to bottom). */
export function leaves(d: TreeDocument): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (parent: string | null) => {
    for (const b of childrenOf(d, parent)) {
      if (isLeaf(d, b.id)) out.push(b);
      else walk(b.id);
    }
  };
  walk(null);
  return out;
}
export const maxDepth = (d: TreeDocument) => Math.max(1, ...d.nodes.map((b) => depthOf(d, b.id)));
export const siblingIndex = (d: TreeDocument, b: TreeNode) => childrenOf(d, b.parent).findIndex((x) => x.id === b.id);
function nextId(d: TreeDocument): string {
  return `n${Math.max(0, ...d.nodes.map((b) => Number(b.id.slice(1)))) + 1}`;
}
export function newNode(id: string, parent: string | null, category = "", count = ""): TreeNode {
  return { id, parent, category: label(category), count: label(count) };
}
/** Plain-language name of a group, such as "men, like coffee". */
export const groupName = (d: TreeDocument, id: string) =>
  pathTo(d, id)
    .map((b) => b.category.text.trim() || "?")
    .join(", ");

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("count") || path.includes("total"))
      throw Error("Use counts of at most 12 characters, without markup.");
    if (path.includes("category")) throw Error("Use group names of at most 30 characters, without markup.");
    if (path.includes("questions"))
      throw Error(`Use at most ${MAX_QUESTIONS} questions of at most 60 characters, with answers of at most 24.`);
    if (path.includes("nodes")) throw Error(`Use 2 to ${MAX_NODES} groups with IDs such as n1.`);
    if (path.includes("branchMm")) throw Error("Choose a branch length from 24 to 60 mm.");
    if (path.includes("gapMm")) throw Error("Choose a spacing from 14 to 30 mm.");
    throw Error("This is not a supported frequency tree file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const ids = new Set<string>();
  for (const b of d.nodes) {
    if (ids.has(b.id)) throw Error(`Group ${b.id} appears twice.`);
    if (b.parent !== null && !ids.has(b.parent)) throw Error("List each group after the group it splits.");
    ids.add(b.id);
  }
  const groups = new Map<string | null, number>();
  for (const b of d.nodes) groups.set(b.parent, (groups.get(b.parent) ?? 0) + 1);
  for (const [, count] of groups)
    if (count < 2 || count > MAX_CHILDREN) throw Error(`Each split needs 2 or ${MAX_CHILDREN} branches.`);
  if (maxDepth(d) > MAX_DEPTH) throw Error(`Use at most ${MAX_DEPTH} levels of branches.`);
  const qids = new Set<string>();
  for (const q of d.questions) {
    if (qids.has(q.id)) throw Error(`Question ${q.id} appears twice.`);
    qids.add(q.id);
    if ([...q.numerator, ...q.denominator].some((id) => !ids.has(id)))
      throw Error("Question groups must name existing groups.");
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 30000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}

/** Pupil view leaves hidden labels as spaces; the answer view prints them. */
/**
 * The teacher copy shows every label. With `mark`, labels shown only because they were saved hidden
 * are drawn in the answer colour (worksheet answers copies and outputView answer); worked copies
 * made by create keep plain black.
 */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = structuredClone(e);
  for (const l of allLabels(n.document)) {
    if (mark && l.show === "hidden" && l.text.trim()) REVEALED.add(l);
    l.show = "show";
  }
  return n;
}
/** Labels a teacher copy shows only because they were saved hidden: drawn in the answer colour. */
const REVEALED = new WeakSet<Label>();
/** The house answer colour, as on ratio tables, graphs and worksheet answer lines. */
export const TREE_ANSWER_COLOUR = "#b0125b";
export function allLabels(d: TreeDocument): Label[] {
  return [d.total, ...d.nodes.flatMap((b) => [b.category, b.count]), ...d.questions.map((q) => q.answer)];
}
export const hasHidden = (e: Envelope) => allLabels(e.document).some((l) => l.show === "hidden" && l.text.trim());

/* ---------- Counts ---------- */

/** Reads a whole-number count such as 48 or −3; anything else (such as x or 2x) is not numeric. */
export function readCount(text: string): number | null {
  const t = text.trim().replaceAll("−", "-").replaceAll(",", "");
  return /^-?\d{1,9}$/.test(t) ? Number(t) : null;
}
const formatCount = (v: number) => (v < 0 ? `−${-v}` : String(v));
/** The count printed for a group, or the total for null. */
const countOf = (d: TreeDocument, id: string | null) => (id === null ? d.total : d.nodes.find((b) => b.id === id)!.count);

/* ---------- Explicit teacher actions (never automatic) ---------- */

const clone = (e: Envelope) => structuredClone(e);
/** Edits a group name; with linked labels, the same position across the level follows. */
export function setCategory(e: Envelope, id: string, text: string): Envelope {
  const n = clone(e),
    d = n.document;
  const target = d.nodes.find((b) => b.id === id);
  if (!target) return e;
  if (!d.linkLabels) target.category.text = text;
  else {
    const depth = depthOf(d, id),
      index = siblingIndex(d, target);
    for (const b of d.nodes) if (depthOf(d, b.id) === depth && siblingIndex(d, b) === index) b.category.text = text;
  }
  return validate(n);
}
/** Splits a path end, copying the group names used at that level elsewhere. */
export function splitNode(e: Envelope, id: string, count?: number): Envelope {
  const n = clone(e),
    d = n.document;
  if (!isLeaf(d, id) || depthOf(d, id) >= MAX_DEPTH) return e;
  const depth = depthOf(d, id);
  const pattern = d.nodes.find((b) => depthOf(d, b.id) === depth && !isLeaf(d, b.id));
  const names = pattern ? childrenOf(d, pattern.id).map((b) => b.category.text) : [];
  const k = Math.min(MAX_CHILDREN, Math.max(2, count ?? (names.length || 2)));
  const at = d.nodes.findIndex((b) => b.id === id);
  const added: TreeNode[] = [];
  for (let i = 0; i < k; i++) added.push(newNode(nextId({ ...d, nodes: [...d.nodes, ...added] }), id, names[i] ?? ""));
  d.nodes.splice(at + 1, 0, ...added);
  return validate(n);
}
/** Ends a path here: removes the groups after this one. */
export function mergeNode(e: Envelope, id: string): Envelope {
  const n = clone(e),
    d = n.document;
  const gone = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of d.nodes)
      if ((b.parent === id || (b.parent && gone.has(b.parent))) && !gone.has(b.id)) {
        gone.add(b.id);
        changed = true;
      }
  }
  if (!gone.size) return e;
  d.nodes = d.nodes.filter((b) => !gone.has(b.id));
  for (const q of d.questions) {
    q.numerator = q.numerator.filter((x) => !gone.has(x));
    q.denominator = q.denominator.filter((x) => !gone.has(x));
  }
  return validate(n);
}
/** Adds one more branch beside a group's siblings. */
export function addSibling(e: Envelope, parent: string | null): Envelope {
  const n = clone(e),
    d = n.document;
  const group = childrenOf(d, parent);
  if (group.length >= MAX_CHILDREN) return e;
  const last = group[group.length - 1];
  const sub = new Set([last.id]);
  for (const b of d.nodes) if (b.parent && sub.has(b.parent)) sub.add(b.id);
  const at = Math.max(...[...sub].map((x) => d.nodes.findIndex((b) => b.id === x)));
  d.nodes.splice(at + 1, 0, newNode(nextId(d), parent));
  return validate(n);
}
export function removeLastSibling(e: Envelope, parent: string | null): Envelope {
  const group = childrenOf(e.document, parent);
  if (group.length <= 2) return e;
  const last = group[group.length - 1];
  const n = clone(mergeNode(e, last.id));
  n.document.nodes = n.document.nodes.filter((b) => b.id !== last.id);
  for (const q of n.document.questions) {
    q.numerator = q.numerator.filter((x) => x !== last.id);
    q.denominator = q.denominator.filter((x) => x !== last.id);
  }
  return validate(n);
}
/** Adds a second level after every first-level group. */
export function addLevel(e: Envelope): Envelope {
  if (maxDepth(e.document) >= MAX_DEPTH) return e;
  let n = e;
  for (const b of childrenOf(e.document, null)) n = splitNode(n, b.id);
  return n;
}
export function removeLevel(e: Envelope): Envelope {
  if (maxDepth(e.document) <= 1) return e;
  let n = e;
  for (const b of childrenOf(e.document, null)) n = mergeNode(n, b.id);
  return n;
}
/** Hides every count except the total, or shows every saved value. */
export function hideCounts(e: Envelope, keepTotal = true): Envelope {
  const n = clone(e);
  for (const b of n.document.nodes) b.count.show = "hidden";
  if (!keepTotal) n.document.total.show = "hidden";
  return n;
}
export function showAll(e: Envelope): Envelope {
  const n = clone(e);
  for (const l of allLabels(n.document)) l.show = "show";
  return n;
}

/** Fills empty counts that follow from the others: a group is the sum of its
 * branches, and one empty branch is its group minus the rest. Repeats until
 * nothing more follows. Filled counts keep their visibility, so a hidden
 * answer stays hidden. Returns how many were filled. */
export function fillCounts(e: Envelope): { envelope: Envelope; filled: number } {
  const n = clone(e),
    d = n.document;
  let filled = 0,
    changed = true;
  const parents: (string | null)[] = [null, ...d.nodes.filter((b) => !isLeaf(d, b.id)).map((b) => b.id)];
  while (changed) {
    changed = false;
    for (const p of parents) {
      const whole = countOf(d, p),
        parts = childrenOf(d, p).map((b) => b.count);
      const empty = parts.filter((l) => !l.text.trim());
      const known = parts.filter((l) => l.text.trim()).map((l) => readCount(l.text));
      if (known.some((v) => v === null)) continue;
      const sum = (known as number[]).reduce((a, b) => a + b, 0);
      if (!whole.text.trim() && !empty.length) {
        whole.text = formatCount(sum);
        filled++;
        changed = true;
      } else if (empty.length === 1 && readCount(whole.text) !== null) {
        empty[0].text = formatCount(readCount(whole.text)! - sum);
        filled++;
        changed = true;
      }
    }
  }
  return { envelope: filled ? validate(n) : e, filled };
}

const sumOf = (d: TreeDocument, ids: string[]) => {
  let total = 0;
  for (const id of ids) {
    const v = readCount(countOf(d, id).text);
    if (v === null) return null;
    total += v;
  }
  return total;
};
/** The fraction for a question as [top, bottom], or null if a chosen count is not a number. */
export function questionValue(d: TreeDocument, q: Question): [number, number] | null {
  if (!q.numerator.length) return null;
  const top = sumOf(d, q.numerator),
    bottom = q.denominator.length ? sumOf(d, q.denominator) : readCount(d.total.text);
  if (top === null || bottom === null || bottom <= 0) return null;
  return [top, bottom];
}
/** Writes the answer as an unsimplified fraction, as on mark schemes (37/61). */
export function calculateQuestion(e: Envelope, qid: string): Envelope | null {
  const n = clone(e),
    q = n.document.questions.find((x) => x.id === qid);
  if (!q) return null;
  const v = questionValue(n.document, q);
  if (!v) return null;
  q.answer.text = `${formatCount(v[0])}/${v[1]}`;
  return validate(n);
}
export function addQuestion(e: Envelope, text = ""): Envelope {
  const n = clone(e),
    qs = n.document.questions;
  if (qs.length >= MAX_QUESTIONS) return e;
  const used = new Set(qs.map((q) => q.id));
  let k = 1;
  while (used.has(`q${k}`)) k++;
  qs.push({ id: `q${k}`, text, answer: label("", "hidden"), numerator: [], denominator: [] });
  return validate(n);
}

/* ---------- Construction ---------- */

export type NestedNode = {
  category: string;
  count?: string;
  /** Saved answers left empty for pupils. */
  hidden?: ("category" | "count")[];
  children?: NestedNode[];
};
export function fromNested(total: string, nodes: NestedNode[], base?: Partial<TreeDocument> & { hideTotal?: boolean }): Envelope {
  const list: TreeNode[] = [];
  const walk = (items: NestedNode[], parent: string | null) => {
    for (const item of items) {
      const b = newNode(`n${list.length + 1}`, parent, item.category, item.count ?? "");
      for (const h of item.hidden ?? []) b[h].show = "hidden";
      list.push(b);
      if (item.children?.length) walk(item.children, b.id);
    }
  };
  walk(nodes, null);
  const e = empty();
  const { hideTotal, ...rest } = base ?? {};
  e.document = { ...e.document, ...rest, total: label(total, hideTotal ? "hidden" : "show"), nodes: list };
  return validate(e);
}

function empty(): Envelope {
  return {
    tool: "frequency-tree",
    schemaVersion: 1,
    rendererVersion: "frequency-tree-1",
    document: {
      total: label(),
      nodes: [newNode("n1", null), newNode("n2", null)],
      linkLabels: true,
      labelPlace: "branch",
      nodeShape: "oval",
      questions: [],
      branchMm: 34,
      gapMm: 18,
    },
  };
}
/** The starting tree: 80 people, men and women, who like coffee; every count but the total is a hidden answer. */
export function create(): Envelope {
  const split = (like: string, not: string): NestedNode[] => [
    { category: "like coffee", count: like, hidden: ["count"] },
    { category: "do not like coffee", count: not, hidden: ["count"] },
  ];
  return fromNested("80", [
    { category: "men", count: "32", hidden: ["count"], children: split("24", "8") },
    { category: "women", count: "48", hidden: ["count"], children: split("37", "11") },
  ]);
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72;
const LINE = FONT * 1.15;
const MARGIN = 2;
export const NODE_H = 11;
const ANSWER_LINE = 32;
export const textWidth = (text: string, font = FONT) => [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;
const typeset = (t: string) => t.trim().replace(/^-/, "−").replace(/(\s)-(\s)/g, "$1−$2");
export const isFractionText = (text: string) => /^\s*[−-]?\d{1,6}\s*\/\s*\d{1,6}\s*$/.test(text);

/** Breaks a group name into at most two lines no wider than `max`, at a space. */
export function wrapLabel(text: string, max: number): string[] {
  const t = text.trim();
  if (!t || textWidth(t) <= max || !t.includes(" ")) return [t];
  const words = t.split(/\s+/);
  let best: string[] = [t],
    bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const width = Math.max(...lines.map((l) => textWidth(l)));
    if (width < bestWidth) {
      best = lines;
      bestWidth = width;
    }
  }
  return best;
}
/** The node width shared by every oval: wide enough for the longest count. */
export function nodeWidth(d: TreeDocument) {
  return Math.max(20, ...allCounts(d).map((l) => textWidth(typeset(l.text)) + 7));
}
const allCounts = (d: TreeDocument) => [d.total, ...d.nodes.map((b) => b.count)];

export type Target = {
  kind: "total" | "count" | "category" | "answer";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type Box = { x1: number; x2: number; y1: number; y2: number };
export type PlacedText = { lines: string[]; hidden: boolean; revealed?: boolean; x: number; y: number; align: "start" | "middle"; width: number; height: number };
export type Layout = ReturnType<typeof layout>;

/** Size of a group name or of its pupil line. */
function categoryBlock(l: Label, max: number) {
  if (l.show === "hidden") return { lines: [] as string[], width: 16, height: LINE };
  const lines = l.text.trim() ? wrapLabel(l.text, max) : [];
  return { lines, width: Math.max(0, ...lines.map((x) => textWidth(x))), height: lines.length * LINE };
}
const overlaps = (a: Box, b: Box, slack = 0.3) =>
  a.x1 < b.x2 - slack && b.x1 < a.x2 - slack && a.y1 < b.y2 - slack && b.y1 < a.y2 - slack;

/** All positions and teacher-facing issues; issues block export, notes do not. */
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    notes: string[] = [];
  const W = nodeWidth(d),
    H = NODE_H,
    depthCount = maxDepth(d);
  const depth = new Map(d.nodes.map((b) => [b.id, depthOf(d, b.id)]));
  const all = leaves(d);
  // Columns: the total, then one column per level.
  const colX = (k: number) => W / 2 + k * (W + d.branchMm);
  // Path ends are evenly spaced, with a little more space between groups; a split sits midway between its branches.
  const nodeY = new Map<string, number>();
  let yy = 0;
  all.forEach((b, i) => {
    if (i > 0 && all[i - 1].parent !== b.parent) yy += Math.round(d.gapMm * 0.4);
    nodeY.set(b.id, yy);
    yy += d.gapMm;
  });
  for (let k = depthCount; k >= 1; k--)
    for (const b of d.nodes)
      if (depth.get(b.id) === k && !nodeY.has(b.id)) {
        const kids = childrenOf(d, b.id).map((c) => nodeY.get(c.id) ?? 0);
        nodeY.set(b.id, (Math.min(...kids) + Math.max(...kids)) / 2);
      }
  const first = childrenOf(d, null).map((b) => nodeY.get(b.id) ?? 0);
  const rootY = (Math.min(...first) + Math.max(...first)) / 2;

  type Shape = { id: string | null; cx: number; cy: number; count: Label };
  const shapes: Shape[] = [{ id: null, cx: colX(0), cy: rootY, count: d.total }];
  for (const b of d.nodes) shapes.push({ id: b.id, cx: colX(depth.get(b.id)!), cy: nodeY.get(b.id)!, count: b.count });
  // A branch runs between the two shapes' outlines.
  const clip = (dx: number, dy: number) => {
    const a = W / 2,
      h = H / 2;
    if (d.nodeShape === "box") return Math.min(dx ? a / Math.abs(dx) : Infinity, dy ? h / Math.abs(dy) : Infinity);
    return 1 / Math.sqrt((dx / a) ** 2 + (dy / h) ** 2);
  };
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const texts: PlacedText[] = [];
  const targets: Target[] = [];
  for (const b of d.nodes) {
    const k = depth.get(b.id)!;
    const px = colX(k - 1),
      py = b.parent ? nodeY.get(b.parent)! : rootY,
      cx = colX(k),
      cy = nodeY.get(b.id)!;
    const dx = cx - px,
      dy = cy - py,
      t = clip(dx, dy);
    const x1 = px + dx * t,
      y1 = py + dy * t,
      x2 = cx - dx * t,
      y2 = cy - dy * t;
    lines.push({ x1, y1, x2, y2 });
    // Group name: on the branch (above a rising or level branch, below a falling one), or beside the oval.
    const leaf = isLeaf(d, b.id);
    let block, x: number, y: number, align: "start" | "middle";
    if (d.labelPlace === "branch") {
      block = categoryBlock(b.category, Math.max(d.branchMm, 24));
      const w = Math.max(block.width, 8),
        h = Math.max(block.height, LINE);
      // Step out from the branch's midpoint along its normal (up and left of a rising branch,
      // down and left of a falling one) until the name's box clears the line.
      const len = Math.hypot(x2 - x1, y2 - y1),
        ux = (x2 - x1) / len,
        uy = (y2 - y1) / len;
      const [nx, ny] = uy > 0.001 ? [-uy, ux] : [uy, -ux];
      const reach = (w / 2) * Math.abs(nx) + (h / 2) * Math.abs(ny) + 1.2;
      x = (x1 + x2) / 2 + nx * reach;
      y = (y1 + y2) / 2 + ny * reach;
      align = "middle";
    } else if (leaf) {
      block = categoryBlock(b.category, 60);
      x = cx + W / 2 + 2;
      y = cy;
      align = "start";
    } else {
      block = categoryBlock(b.category, W + d.branchMm * 0.6);
      x = cx;
      y = cy + H / 2 + 1 + Math.max(block.height, LINE) / 2;
      align = "middle";
    }
    const w = Math.max(block.width, 8),
      h = Math.max(block.height, LINE);
    texts.push({ lines: block.lines, hidden: b.category.show === "hidden", revealed: REVEALED.has(b.category), x, y, align, width: block.width, height: block.height });
    const left = align === "start" ? x : x - w / 2;
    targets.push({ kind: "category", id: b.id, x: left - 0.5, y: y - h / 2 - 0.5, width: w + 1, height: h + 1 });
  }
  for (const s of shapes)
    targets.push({ kind: s.id === null ? "total" : "count", id: s.id ?? "total", x: s.cx - W / 2, y: s.cy - H / 2, width: W, height: H });

  const shapeBoxes: Box[] = shapes.map((s) => ({ x1: s.cx - W / 2, x2: s.cx + W / 2, y1: s.cy - H / 2, y2: s.cy + H / 2 }));
  const textBoxes: Box[] = texts
    .filter((t) => t.hidden || t.lines.length)
    .map((t) => {
      const x1 = t.align === "start" ? t.x : t.x - t.width / 2;
      return { x1, x2: x1 + t.width, y1: t.y - t.height / 2, y2: t.y + t.height / 2 };
    });
  const boxes = [...shapeBoxes, ...textBoxes];
  const top = Math.min(...boxes.map((b) => b.y1));
  let bottom = Math.max(...boxes.map((b) => b.y2));
  const treeRight = Math.max(...boxes.map((b) => b.x2));
  if (textBoxes.some((a, i) => textBoxes.slice(i + 1).some((b) => overlaps(a, b)) || shapeBoxes.some((s) => overlaps(a, s))))
    issues.push("Some group names overlap. Increase the spacing or branch length, shorten names, or put names beside the ovals.");

  // Questions below the tree, with an exam-style answer line at the right.
  const questionRows: { q: Question; letter: string; y: number; lineX: number }[] = [];
  const textEnd = Math.max(0, ...d.questions.map((q) => 8 + textWidth(q.text)));
  const lineX = Math.max(textEnd + 4, treeRight - ANSWER_LINE);
  let qy = bottom + 6;
  d.questions.forEach((q, i) => {
    const fraction = q.answer.show === "show" && isFractionText(q.answer.text);
    // At least 12 mm for a handwritten fraction above the line.
    const rowH = Math.max(12, fraction ? FONT * 2 + 4 : 0);
    const y = qy + rowH;
    questionRows.push({ q, letter: `(${String.fromCharCode(97 + i)})`, y, lineX });
    targets.push({ kind: "answer", id: q.id, x: lineX, y: y - rowH + 1, width: ANSWER_LINE, height: rowH });
    qy = y + 3;
  });
  if (d.questions.length) bottom = qy - 2;
  const left = Math.min(0, ...boxes.map((b) => b.x1));
  const right = Math.max(treeRight, d.questions.length ? lineX + ANSWER_LINE : 0);
  const dx = MARGIN - left,
    dy = MARGIN - top;

  // Teacher notes and issues about the counts themselves.
  const parents: (string | null)[] = [null, ...d.nodes.filter((b) => !isLeaf(d, b.id)).map((b) => b.id)];
  for (const p of parents) {
    const whole = readCount(countOf(d, p).text),
      parts = childrenOf(d, p).map((b) => readCount(b.count.text));
    if (whole !== null && parts.every((v) => v !== null)) {
      const sum = (parts as number[]).reduce((a, b) => a + b, 0);
      if (sum !== whole)
        notes.push(
          `The counts after ${p ? groupName(d, p) : "the total"} add up to ${formatCount(sum)}, not ${formatCount(whole)}. Keep this only if it is deliberate.`,
        );
    }
  }
  if (allCounts(d).some((l) => (readCount(l.text) ?? 0) < 0)) issues.push("A count is negative.");
  for (const q of d.questions)
    if (q.answer.show === "show" && !q.answer.text.trim() && q.text.trim())
      notes.push(`Question ${q.text.slice(0, 20)} has no answer. Hide its answer to keep the answer line for pupils.`);

  const width = Math.ceil((right - left + 2 * MARGIN) * 10) / 10,
    height = Math.ceil((bottom - top + 2 * MARGIN) * 10) / 10;
  if (width > 180) issues.push("The tree is wider than 18 cm. Use shorter branches, shorter names or fewer levels.");
  if (height > 250) issues.push("The tree is taller than 25 cm. Reduce the spacing.");
  const sx = (v: number) => v + dx,
    sy = (v: number) => v + dy;
  return {
    width,
    height,
    nodeWidth: W,
    nodeHeight: H,
    shapes: shapes.map((s) => ({ ...s, cx: sx(s.cx), cy: sy(s.cy) })),
    lines: lines.map((l) => ({ x1: sx(l.x1), x2: sx(l.x2), y1: sy(l.y1), y2: sy(l.y2) })),
    texts: texts.map((t) => ({ ...t, x: sx(t.x), y: sy(t.y) })),
    targets: targets.map((t) => ({ ...t, x: sx(t.x), y: sy(t.y) })),
    questions: questionRows.map((r) => ({ ...r, y: sy(r.y), lineX: sx(r.lineX), textX: sx(0) })),
    issues,
    notes,
  };
}
export const exportIssue = (e: Envelope) => layout(e).issues.join(" ") || null;
export function warnings(e: Envelope) {
  const g = layout(e);
  return [...g.issues, ...g.notes];
}

/* ---------- SVG ---------- */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (t: string, x: number, y: number, anchor = "middle", fill = "black") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="${fill}">${esc(t)}</text>`;
const ink = (l: Label) => (REVEALED.has(l) ? TREE_ANSWER_COLOUR : "black");
const dotted = (x1: number, x2: number, y: number) =>
  `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  for (const l of g.lines)
    out.push(`<line x1="${n(l.x1)}" y1="${n(l.y1)}" x2="${n(l.x2)}" y2="${n(l.y2)}" stroke="black" stroke-width="0.3" stroke-linecap="round"/>`);
  const W = g.nodeWidth,
    H = g.nodeHeight;
  for (const s of g.shapes) {
    out.push(
      d.nodeShape === "oval"
        ? `<ellipse cx="${n(s.cx)}" cy="${n(s.cy)}" rx="${n(W / 2)}" ry="${n(H / 2)}" fill="white" stroke="black" stroke-width="0.3"/>`
        : `<rect x="${n(s.cx - W / 2)}" y="${n(s.cy - H / 2)}" width="${n(W)}" height="${n(H)}" fill="white" stroke="black" stroke-width="0.3"/>`,
    );
    if (s.count.show === "show" && s.count.text.trim()) out.push(text(typeset(s.count.text), s.cx, s.cy + FONT * 0.33, "middle", ink(s.count)));
  }
  for (const t of g.texts) {
    const x1 = t.align === "start" ? t.x : t.x - 8;
    if (t.hidden) {
      out.push(dotted(x1, x1 + 16, t.y + FONT * 0.4));
      continue;
    }
    t.lines.forEach((line, i) => {
      const y = t.y - t.height / 2 + LINE * i + LINE * 0.5 + FONT * 0.33;
      out.push(text(line, t.x, y, t.align === "start" ? "start" : "middle", t.revealed ? TREE_ANSWER_COLOUR : "black"));
    });
  }
  for (const r of g.questions) {
    const baseline = r.y - 1;
    out.push(text(r.letter, r.textX, baseline, "start"));
    out.push(text(r.q.text, r.textX + 8, baseline, "start"));
    out.push(dotted(r.lineX, r.lineX + ANSWER_LINE, r.y));
    const a = r.q.answer;
    if (a.show === "show" && a.text.trim()) {
      const mid = r.lineX + ANSWER_LINE / 2;
      if (isFractionText(a.text)) {
        const [top, bottom] = a.text.split("/").map((s) => typeset(s));
        const bar = Math.max(textWidth(top), textWidth(bottom)) + 1.2;
        const by = r.y - 1.5 - FONT * 0.95;
        out.push(text(top, mid, by - 0.9, "middle", ink(a)));
        out.push(`<line x1="${n(mid - bar / 2)}" y1="${n(by)}" x2="${n(mid + bar / 2)}" y2="${n(by)}" stroke="${ink(a)}" stroke-width="0.25"/>`);
        out.push(text(bottom, mid, by + FONT * 0.72 + 0.9, "middle", ink(a)));
      } else out.push(text(typeset(a.text), mid, r.y - 1.5, "middle", ink(a)));
    }
  }
  const groups = d.nodes.length;
  const total = d.total.show === "show" && d.total.text.trim() ? ` with a total of ${typeset(d.total.text)}` : "";
  const label = `Frequency tree${total} and ${groups} groups over ${maxDepth(d)} level${maxDepth(d) === 1 ? "" : "s"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`;
}

/* ---------- Editor links ---------- */

export async function hash(e: Envelope) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(e)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#ftree=";
export function linkHash(e: Envelope): string {
  const bytes = new TextEncoder().encode(canonical(e));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return LINK_PREFIX + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/frequency-tree";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#ftree=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported frequency tree link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    const t = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return parseFile(t);
  } catch {
    throw Error("This frequency tree link could not be read. Open an editable file instead.");
  }
}
