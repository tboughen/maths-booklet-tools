import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

/**
 * Probability tree diagrams, drawn left to right.
 *
 * The tree is a flat list of branches; `parent: null` marks a first-stage
 * branch and sibling order is list order. A branch without children ends its
 * path, so unequal trees ("stop when you get a red") need no special case.
 * Every printed value is a label with its own visibility: "show" prints it,
 * "hidden" keeps it as a saved answer and leaves a pupil space. An empty shown
 * label prints nothing. Nothing is calculated except by the explicit fill and
 * calculate actions below. Lengths are millimetres.
 */
export const MAX_DEPTH = 4;
export const MAX_CHILDREN = 4;
export const MAX_BRANCHES = 60;
export const MAX_LEAVES = 24;
export const MAX_QUESTIONS = 8;

const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">"),
      "Use ordinary text without markup.",
    );
export const labelSchema = z
  .object({ text: plain(24), show: z.enum(["show", "hidden"]) })
  .strict();
export const branchSchema = z
  .object({
    id: z.string().regex(/^b[0-9]{1,3}$/),
    parent: z
      .string()
      .regex(/^b[0-9]{1,3}$/)
      .nullable(),
    outcome: labelSchema,
    probability: labelSchema,
    bold: z.boolean(),
    /** End-column entries, used only while the branch ends a path. */
    endOutcome: labelSchema,
    endProbability: labelSchema,
  })
  .strict();
export const questionSchema = z
  .object({
    id: z.string().regex(/^q[0-9]{1,2}$/),
    text: plain(60),
    answer: labelSchema,
    /** Paths (end branch IDs) for the explicit Calculate action only. */
    event: z.array(z.string().regex(/^b[0-9]{1,3}$/)).max(MAX_LEAVES),
    given: z.array(z.string().regex(/^b[0-9]{1,3}$/)).max(MAX_LEAVES),
  })
  .strict();
export const documentSchema = z
  .object({
    branches: z.array(branchSchema).min(2).max(MAX_BRANCHES),
    stageTitles: z.array(plain(24)).max(MAX_DEPTH),
    linkLabels: z.boolean(),
    endColumn: z.enum(["none", "outcome", "both"]),
    endHeadings: z.array(plain(24)).length(2),
    questions: z.array(questionSchema).max(MAX_QUESTIONS),
    blankStyle: z.enum(["dots", "box"]),
    branchMm: z.number().int().min(20).max(50),
    gapMm: z.number().int().min(10).max(24),
  })
  .strict();
export const envelopeSchema = z
  .object({
    tool: z.literal("probability-tree"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("probability-tree-1"),
    document: documentSchema,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type TreeDocument = Envelope["document"];
export type Branch = z.infer<typeof branchSchema>;
export type Label = z.infer<typeof labelSchema>;
export type Question = z.infer<typeof questionSchema>;

export const label = (text = "", show: Label["show"] = "show"): Label => ({ text, show });

/* ---------- Tree structure helpers ---------- */

export const childrenOf = (d: TreeDocument, parent: string | null) =>
  d.branches.filter((b) => b.parent === parent);
export const isLeaf = (d: TreeDocument, id: string) => !d.branches.some((b) => b.parent === id);
export function depthOf(d: TreeDocument, id: string): number {
  let depth = 0,
    current: string | null = id;
  const byId = new Map(d.branches.map((b) => [b.id, b]));
  while (current !== null && depth <= MAX_DEPTH + 1) {
    depth++;
    current = byId.get(current)?.parent ?? null;
  }
  return depth;
}
/** Branches from the first stage to this one. */
export function pathTo(d: TreeDocument, id: string): Branch[] {
  const byId = new Map(d.branches.map((b) => [b.id, b]));
  const path: Branch[] = [];
  let current = byId.get(id);
  while (current && path.length <= MAX_DEPTH) {
    path.unshift(current);
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return path;
}
/** Paths in reading order (depth first, top to bottom). */
export function leaves(d: TreeDocument): Branch[] {
  const out: Branch[] = [];
  const walk = (parent: string | null) => {
    for (const b of childrenOf(d, parent)) {
      if (isLeaf(d, b.id)) out.push(b);
      else walk(b.id);
    }
  };
  walk(null);
  return out;
}
export const maxDepth = (d: TreeDocument) =>
  Math.max(1, ...d.branches.map((b) => depthOf(d, b.id)));
export const siblingIndex = (d: TreeDocument, b: Branch) =>
  childrenOf(d, b.parent).findIndex((x) => x.id === b.id);
function nextId(d: TreeDocument): string {
  const used = d.branches.map((b) => Number(b.id.slice(1)));
  return `b${Math.max(0, ...used) + 1}`;
}
export function newBranch(id: string, parent: string | null, outcome = "", probability = ""): Branch {
  return {
    id,
    parent,
    outcome: label(outcome),
    probability: label(probability),
    bold: false,
    endOutcome: label(),
    endProbability: label(),
  };
}

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("text"))
      throw Error("Use labels of at most 24 characters (questions 60), without markup.");
    if (path.includes("branches"))
      throw Error(`Use 2 to ${MAX_BRANCHES} branches with IDs such as b1.`);
    if (path.includes("questions"))
      throw Error(`Use at most ${MAX_QUESTIONS} questions with IDs such as q1.`);
    if (path.includes("branchMm")) throw Error("Choose a branch length from 20 to 50 mm.");
    if (path.includes("gapMm")) throw Error("Choose a path spacing from 10 to 24 mm.");
    throw Error("This is not a supported probability tree file (version 1 is supported).");
  }
  const e = parsed.data,
    d = e.document;
  const ids = new Set<string>();
  for (const b of d.branches) {
    if (ids.has(b.id)) throw Error(`Branch ${b.id} appears twice.`);
    if (b.parent !== null && !ids.has(b.parent))
      throw Error("List each branch after the branch it follows.");
    ids.add(b.id);
  }
  const groups = new Map<string | null, number>();
  for (const b of d.branches) groups.set(b.parent, (groups.get(b.parent) ?? 0) + 1);
  // A later point may have one branch, for "draw the missing branches" questions.
  for (const [parent, count] of groups)
    if (count < (parent === null ? 2 : 1) || count > MAX_CHILDREN)
      throw Error(`The first stage needs 2 to ${MAX_CHILDREN} branches; each later point 1 to ${MAX_CHILDREN}.`);
  if (maxDepth(d) > MAX_DEPTH) throw Error(`Use at most ${MAX_DEPTH} stages.`);
  if (leaves(d).length > MAX_LEAVES) throw Error(`Use at most ${MAX_LEAVES} paths through the tree.`);
  const qids = new Set<string>();
  for (const q of d.questions) {
    if (qids.has(q.id)) throw Error(`Question ${q.id} appears twice.`);
    qids.add(q.id);
    if ([...q.event, ...q.given].some((id) => !ids.has(id)))
      throw Error("Question paths must name existing branches.");
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 60000) throw Error("This editable file is too large.");
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
  const reveal = (l: Label) => {
    if (mark && l.show === "hidden" && l.text.trim()) REVEALED.add(l);
    l.show = "show";
  };
  for (const b of n.document.branches) for (const l of [b.outcome, b.probability, b.endOutcome, b.endProbability]) reveal(l);
  for (const q of n.document.questions) reveal(q.answer);
  return n;
}
/** Labels a teacher copy shows only because they were saved hidden: drawn in the answer colour. */
const REVEALED = new WeakSet<Label>();
/** The house answer colour, as on ratio tables, graphs and worksheet answer lines. */
export const TREE_ANSWER_COLOUR = "#b0125b";
export function allLabels(d: TreeDocument): Label[] {
  return [
    ...d.branches.flatMap((b) => [b.outcome, b.probability, b.endOutcome, b.endProbability]),
    ...d.questions.map((q) => q.answer),
  ];
}
export const hasHidden = (e: Envelope) =>
  allLabels(e.document).some((l) => l.show === "hidden" && l.text.trim());

/* ---------- Exact arithmetic ---------- */

export type Fraction = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
export function reduce(f: Fraction): Fraction {
  const g = gcd(f.n, f.d);
  const sign = f.d < 0n ? -1n : 1n;
  return { n: (sign * f.n) / g, d: (sign * f.d) / g };
}
const add = (a: Fraction, b: Fraction) => reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const mul = (a: Fraction, b: Fraction) => reduce({ n: a.n * b.n, d: a.d * b.d });
const div = (a: Fraction, b: Fraction) => reduce({ n: a.n * b.d, d: a.d * b.n });

/** Reads 3/8, 0.25, 1 or 40%; anything else (such as x or 1 − x) is not numeric. */
export function readProbability(text: string): Fraction | null {
  const t = text.trim().replaceAll("−", "-").replaceAll(" ", "");
  let m = /^(-?\d{1,6})\/(\d{1,6})$/.exec(t);
  if (m) return Number(m[2]) === 0 ? null : reduce({ n: BigInt(m[1]), d: BigInt(m[2]) });
  m = /^(-?)(\d{0,6})(?:\.(\d{1,6}))?(%?)$/.exec(t);
  if (!m || (!m[2] && !m[3])) return null;
  const decimals = m[3] ?? "";
  let f = { n: BigInt((m[2] || "0") + decimals), d: 10n ** BigInt(decimals.length) };
  if (m[4]) f = { n: f.n, d: f.d * 100n };
  if (m[1]) f = { n: -f.n, d: f.d };
  return reduce(f);
}
export const isFractionText = (text: string) => /^\s*-?\d{1,6}\s*\/\s*\d{1,6}\s*$/.test(text.replaceAll("−", "-"));
function terminates(f: Fraction) {
  let d = reduce(f).d;
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  return d === 1n;
}
/** Formats an exact result: fractions stay fractions; decimals only when exact. */
export function formatFraction(f: Fraction, style: "fraction" | "decimal"): string {
  const r = reduce(f);
  if (style === "decimal" && terminates(r)) {
    let scale = 0;
    while (((r.n * 10n ** BigInt(scale)) % r.d !== 0n) && scale < 12) scale++;
    const whole = (r.n * 10n ** BigInt(scale)) / r.d;
    const sign = whole < 0n ? "−" : "";
    const digits = (whole < 0n ? -whole : whole).toString().padStart(scale + 1, "0");
    return sign + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
  }
  if (r.d === 1n) return (r.n < 0n ? "−" : "") + (r.n < 0n ? -r.n : r.n).toString();
  return `${r.n < 0n ? "−" : ""}${(r.n < 0n ? -r.n : r.n).toString()}/${r.d.toString()}`;
}
/** Decimal when every input on the tree is a decimal; otherwise fractions. */
function styleOf(d: TreeDocument): "fraction" | "decimal" {
  const texts = d.branches.map((b) => b.probability.text.trim()).filter(Boolean);
  return texts.length && texts.every((t) => !isFractionText(t) && readProbability(t)) ? "decimal" : "fraction";
}

/* ---------- Explicit teacher actions (never automatic) ---------- */

function clone(e: Envelope) {
  return structuredClone(e);
}
/** Edits an outcome name; with linked labels, the same position across the stage follows. */
export function setOutcome(e: Envelope, id: string, text: string): Envelope {
  const n = clone(e),
    d = n.document;
  const target = d.branches.find((b) => b.id === id);
  if (!target) return e;
  if (!d.linkLabels) target.outcome.text = text;
  else {
    const depth = depthOf(d, id),
      index = siblingIndex(d, target);
    for (const b of d.branches)
      if (depthOf(d, b.id) === depth && siblingIndex(d, b) === index) b.outcome.text = text;
  }
  return validate(n);
}
/** Adds branches after one path end, copying the outcome names of the first stage. */
export function extendBranch(e: Envelope, id: string, count?: number): Envelope {
  const n = clone(e),
    d = n.document;
  if (!isLeaf(d, id) || depthOf(d, id) >= MAX_DEPTH) return e;
  const first = childrenOf(d, null);
  const k = Math.min(MAX_CHILDREN, Math.max(1, count ?? first.length));
  const at = d.branches.findIndex((b) => b.id === id);
  const added: Branch[] = [];
  for (let i = 0; i < k; i++) {
    const b = newBranch(nextId({ ...d, branches: [...d.branches, ...added] }), id, first[i]?.outcome.text ?? "");
    added.push(b);
  }
  // Keep the list ordered after its parent so every parent precedes its children.
  d.branches.splice(at + 1, 0, ...added);
  return validate(n);
}
/** Ends a path here: removes everything after this branch. */
export function pruneBranch(e: Envelope, id: string): Envelope {
  const n = clone(e),
    d = n.document;
  const gone = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of d.branches)
      if ((b.parent === id || (b.parent && gone.has(b.parent))) && !gone.has(b.id)) {
        gone.add(b.id);
        changed = true;
      }
  }
  if (!gone.size) return e;
  d.branches = d.branches.filter((b) => !gone.has(b.id));
  for (const q of d.questions) {
    q.event = q.event.filter((x) => !gone.has(x));
    q.given = q.given.filter((x) => !gone.has(x));
  }
  return validate(n);
}
/** Adds one more branch beside a branch's siblings. */
export function addSibling(e: Envelope, parent: string | null): Envelope {
  const n = clone(e),
    d = n.document;
  const group = childrenOf(d, parent);
  if (group.length >= MAX_CHILDREN) return e;
  // Insert after the last sibling's whole subtree.
  const last = group[group.length - 1];
  const sub = new Set([last.id]);
  for (const b of d.branches) if (b.parent && sub.has(b.parent)) sub.add(b.id);
  const at = Math.max(...[...sub].map((x) => d.branches.findIndex((b) => b.id === x)));
  d.branches.splice(at + 1, 0, newBranch(nextId(d), parent));
  return validate(n);
}
/** The first stage keeps two branches; a later point may keep one. */
export const minimumBranches = (parent: string | null) => (parent === null ? 2 : 1);
export function removeLastSibling(e: Envelope, parent: string | null): Envelope {
  const group = childrenOf(e.document, parent);
  if (group.length <= minimumBranches(parent)) return e;
  const last = group[group.length - 1];
  const n = clone(pruneBranch(e, last.id));
  n.document.branches = n.document.branches.filter((b) => b.id !== last.id);
  for (const q of n.document.questions) {
    q.event = q.event.filter((x) => x !== last.id);
    q.given = q.given.filter((x) => x !== last.id);
  }
  return validate(n);
}
/** Adds a stage after every path that reaches the last stage. */
export function addStage(e: Envelope): Envelope {
  const deepest = maxDepth(e.document);
  if (deepest >= MAX_DEPTH) return e;
  let n = e;
  for (const b of leaves(e.document)) if (depthOf(e.document, b.id) === deepest) n = extendBranch(n, b.id);
  return n;
}
export function removeStage(e: Envelope): Envelope {
  const deepest = maxDepth(e.document);
  if (deepest <= 1) return e;
  let n = e;
  for (const b of e.document.branches) if (depthOf(e.document, b.id) === deepest - 1) n = pruneBranch(n, b.id);
  return n;
}
export function setAllShown(e: Envelope, part: "probabilities" | "end" | "all", show: Label["show"]): Envelope {
  const n = clone(e);
  for (const b of n.document.branches) {
    if (part !== "end") b.probability.show = show;
    if (part !== "probabilities") {
      b.endOutcome.show = show;
      b.endProbability.show = show;
    }
  }
  return n;
}

/** Fills every probability from the contents of a bag, with or without
 * replacement. Each branch takes the colour at its position among its
 * siblings. Fractions are written unsimplified, as in examination trees.
 * Returns null when the tree's shape does not match the bag. */
export function fillFromBag(e: Envelope, counts: number[], replacement: boolean): Envelope | null {
  const n = clone(e),
    d = n.document;
  if (counts.some((c) => !Number.isInteger(c) || c < 0) || counts.reduce((a, b) => a + b, 0) < 1) return null;
  for (const [, count] of groupSizes(d)) if (count !== counts.length) return null;
  for (const b of d.branches) {
    const path = pathTo(d, b.id);
    const left = [...counts];
    for (const step of path.slice(0, -1)) if (!replacement) left[siblingIndex(d, step)]--;
    const total = left.reduce((a, c) => a + c, 0),
      mine = left[siblingIndex(d, b)];
    if (total <= 0 || mine < 0) return null;
    b.probability.text = `${mine}/${total}`;
  }
  return validate(n);
}
function groupSizes(d: TreeDocument) {
  const sizes = new Map<string | null, number>();
  for (const b of d.branches) sizes.set(b.parent, (sizes.get(b.parent) ?? 0) + 1);
  return sizes;
}
/** Where exactly one probability in a group is empty and the rest are numbers,
 * writes 1 minus their total. Returns how many were filled. */
export function fillComplements(e: Envelope): { envelope: Envelope; filled: number } {
  const n = clone(e),
    d = n.document;
  let filled = 0;
  for (const [parent] of groupSizes(d)) {
    const group = childrenOf(d, parent);
    const empty = group.filter((b) => !b.probability.text.trim());
    // A lone branch is a part-drawn tree, not a certain event: never write 1 there.
    if (empty.length !== 1 || group.length < 2) continue;
    const known = group.filter((b) => b !== empty[0]).map((b) => readProbability(b.probability.text));
    if (known.some((f) => f === null)) continue;
    const total = (known as Fraction[]).reduce(add, { n: 0n, d: 1n });
    const rest = add({ n: 1n, d: 1n }, { n: -total.n, d: total.d });
    if (rest.n < 0n) continue;
    const decimal = group.every((b) => b === empty[0] || !isFractionText(b.probability.text));
    empty[0].probability.text = formatFraction(rest, decimal ? "decimal" : "fraction");
    filled++;
  }
  return { envelope: filled ? validate(n) : e, filled };
}
/** Product of the probabilities along a path, or null if any is not numeric. */
export function pathProbability(d: TreeDocument, id: string): Fraction | null {
  let p: Fraction = { n: 1n, d: 1n };
  for (const b of pathTo(d, id)) {
    const f = readProbability(b.probability.text);
    if (!f) return null;
    p = mul(p, f);
  }
  return p;
}
/** Writes the end-column outcome names (joined path names) and/or path probabilities. */
export function fillEnd(e: Envelope, part: "outcome" | "probability"): Envelope {
  const n = clone(e),
    d = n.document,
    style = styleOf(d);
  for (const leaf of leaves(d)) {
    if (part === "outcome")
      leaf.endOutcome.text = pathTo(d, leaf.id)
        .map((b) => b.outcome.text.trim())
        .join(", ")
        .slice(0, 24);
    else {
      const p = pathProbability(d, leaf.id);
      if (p) leaf.endProbability.text = formatFraction(p, style);
    }
  }
  return validate(n);
}
/** P(event) or P(event | given) from the chosen paths; null if not numeric. */
export function questionValue(d: TreeDocument, q: Question): Fraction | null {
  const sum = (ids: string[]) => {
    let total: Fraction = { n: 0n, d: 1n };
    for (const id of ids) {
      if (!isLeaf(d, id)) return null;
      const p = pathProbability(d, id);
      if (!p) return null;
      total = add(total, p);
    }
    return total;
  };
  if (!q.event.length) return null;
  if (!q.given.length) return sum(q.event);
  const both = sum(q.event.filter((x) => q.given.includes(x))),
    given = sum(q.given);
  if (!both || !given || given.n === 0n) return null;
  return div(both, given);
}
export function calculateQuestion(e: Envelope, qid: string): Envelope | null {
  const n = clone(e),
    q = n.document.questions.find((x) => x.id === qid);
  if (!q) return null;
  const v = questionValue(n.document, q);
  if (!v) return null;
  q.answer.text = formatFraction(v, styleOf(n.document));
  return validate(n);
}
export function addQuestion(e: Envelope, text = ""): Envelope {
  const n = clone(e),
    qs = n.document.questions;
  if (qs.length >= MAX_QUESTIONS) return e;
  const id = `q${Math.max(0, ...qs.map((q) => Number(q.id.slice(1)))) + 1}`;
  qs.push({ id, text, answer: label("", "hidden"), event: [], given: [] });
  return validate(n);
}
/** Plain-language name of a path, such as "Red, Blue". */
export const pathName = (d: TreeDocument, id: string) =>
  pathTo(d, id)
    .map((b) => b.outcome.text.trim() || "?")
    .join(", ");

/* ---------- Construction ---------- */

export type NestedBranch = {
  outcome: string;
  probability?: string;
  hidden?: ("outcome" | "probability" | "endOutcome" | "endProbability")[];
  bold?: boolean;
  endOutcome?: string;
  endProbability?: string;
  children?: NestedBranch[];
};
export function fromNested(nodes: NestedBranch[], base?: Partial<TreeDocument>): Envelope {
  const branches: Branch[] = [];
  const walk = (list: NestedBranch[], parent: string | null) => {
    for (const node of list) {
      const b = newBranch(`b${branches.length + 1}`, parent, node.outcome, node.probability ?? "");
      b.bold = node.bold ?? false;
      b.endOutcome.text = node.endOutcome ?? "";
      b.endProbability.text = node.endProbability ?? "";
      for (const h of node.hidden ?? []) b[h].show = "hidden";
      branches.push(b);
      if (node.children?.length) walk(node.children, b.id);
    }
  };
  walk(nodes, null);
  const e = create();
  e.document = { ...e.document, ...base, branches };
  return validate(e);
}
/** An equal tree: every stage repeats the same outcomes and probabilities. */
export function uniform(stages: { outcomes: string[]; probabilities?: string[] }[], base?: Partial<TreeDocument>): Envelope {
  const build = (k: number): NestedBranch[] =>
    k >= stages.length
      ? []
      : stages[k].outcomes.map((outcome, i) => ({
          outcome,
          probability: stages[k].probabilities?.[i] ?? "",
          children: build(k + 1),
        }));
  return fromNested(build(0), base);
}

export function create(): Envelope {
  const branches = [
    newBranch("b1", null, "Red", "3/8"),
    newBranch("b2", "b1", "Red", "3/8"),
    newBranch("b3", "b1", "Blue", "5/8"),
    newBranch("b4", null, "Blue", "5/8"),
    newBranch("b5", "b4", "Red", "3/8"),
    newBranch("b6", "b4", "Blue", "5/8"),
  ];
  return {
    tool: "probability-tree",
    schemaVersion: 1,
    rendererVersion: "probability-tree-1",
    document: {
      branches,
      stageTitles: ["First counter", "Second counter"],
      linkLabels: true,
      endColumn: "none",
      endHeadings: ["Outcome", "Probability"],
      questions: [],
      blankStyle: "dots",
      branchMm: 32,
      gapMm: 14,
    },
  };
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72;
const MARGIN = 2;
export const textWidth = (text: string, font = FONT) =>
  [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;
/** Size of a printed label or of its pupil space. */
export function labelBox(l: Label, blank: TreeDocument["blankStyle"], kind: "probability" | "text") {
  const text = l.text.trim();
  if (l.show === "hidden")
    return kind === "probability"
      ? { width: blank === "box" ? 10 : 11, height: blank === "box" ? 9 : FONT * 2 + 1.5 }
      : { width: blank === "box" ? 14 : 16, height: blank === "box" ? 6.5 : FONT * 1.2 };
  if (!text) return { width: 0, height: 0 };
  if (isFractionText(text)) {
    const [a, b] = text.split("/").map((s) => s.trim());
    return { width: Math.max(textWidth(a), textWidth(b)) + 1.2, height: FONT * 2 + 1.5 };
  }
  return { width: textWidth(text), height: FONT * 1.2 };
}

export type Target = {
  kind: "outcome" | "probability" | "endOutcome" | "endProbability" | "answer";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Placed = { label: Label; kind: "probability" | "text"; cx: number; cy: number; align: "middle" | "start" };
export type Layout = ReturnType<typeof layout>;

type Box = { x1: number; x2: number; y1: number; y2: number };
/** Places along a branch (0 start, 1 end) tried for its probability, the middle first. */
const PROBABILITY_POSITIONS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.45, 0.4, 0.35, 0.3];
/** A label prints something: text, or a pupil space for a hidden answer. */
const drawnLabel = (l: Label) => l.show === "hidden" || !!l.text.trim();
function boxOf(p: Placed, blank: TreeDocument["blankStyle"]): Box {
  const b = labelBox(p.label, blank, p.kind);
  const x1 = p.align === "start" ? p.cx : p.cx - b.width / 2;
  return { x1, x2: x1 + b.width, y1: p.cy - b.height / 2, y2: p.cy + b.height / 2 };
}
/** Labels may touch but not overlap by more than 0.3 mm. */
const boxesOverlap = (a: Box, b: Box) =>
  a.x1 < b.x2 - 0.3 && b.x1 < a.x2 - 0.3 && a.y1 < b.y2 - 0.3 && b.y1 < a.y2 - 0.3;
/** Whether a branch line passes through a label (shrunk by 0.3 mm), by Liang-Barsky clipping. */
export function lineCrossesBox(l: { x1: number; y1: number; x2: number; y2: number }, box: Box): boolean {
  const xMin = box.x1 + 0.3,
    xMax = box.x2 - 0.3,
    yMin = box.y1 + 0.3,
    yMax = box.y2 - 0.3;
  if (xMin >= xMax || yMin >= yMax) return false;
  const dx = l.x2 - l.x1,
    dy = l.y2 - l.y1;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-dx, l.x1 - xMin],
    [dx, xMax - l.x1],
    [-dy, l.y1 - yMin],
    [dy, yMax - l.y1],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** All positions and teacher-facing issues; issues block export, notes do not. */
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [],
    notes: string[] = [];
  const depthCount = maxDepth(d);
  const all = leaves(d);
  const depth = new Map(d.branches.map((b) => [b.id, depthOf(d, b.id)]));
  // Stage columns: each stage's branches start after the widest outcome label of the stage before.
  const outcomeWidth = Array.from({ length: depthCount }, (_, k) =>
    Math.max(4, ...d.branches.filter((b) => depth.get(b.id) === k + 1).map((b) => labelBox(b.outcome, d.blankStyle, "text").width)),
  );
  const startX: number[] = [];
  let x = 0;
  for (let k = 0; k < depthCount; k++) {
    startX.push(x);
    x += d.branchMm + 1.5 + outcomeWidth[k] + 3;
  }
  // Node heights: path ends are evenly spaced; a branch point sits midway between its first and last branch.
  const nodeY = new Map<string, number>();
  // Separate neighbouring groups a little more than paths within a group, as on examination trees.
  let yy = 0;
  all.forEach((b, i) => {
    if (i > 0 && all[i - 1].parent !== b.parent) yy += Math.round(d.gapMm * 0.5);
    nodeY.set(b.id, yy);
    yy += d.gapMm;
  });
  for (let k = depthCount; k >= 1; k--)
    for (const b of d.branches)
      if (depth.get(b.id) === k && !nodeY.has(b.id)) {
        const kids = childrenOf(d, b.id).map((c) => nodeY.get(c.id) ?? 0);
        nodeY.set(b.id, (Math.min(...kids) + Math.max(...kids)) / 2);
      }
  const first = childrenOf(d, null).map((b) => nodeY.get(b.id) ?? 0);
  const rootY = (Math.min(...first) + Math.max(...first)) / 2;

  const lines: { x1: number; y1: number; x2: number; y2: number; bold: boolean }[] = [];
  const placed: Placed[] = [];
  const targets: Target[] = [];
  // Lines and outcome names first, so probabilities can be placed clear of all of them.
  const geometry = d.branches.map((b) => {
    const k = depth.get(b.id)! - 1;
    const parentY = b.parent ? nodeY.get(b.parent)! : rootY;
    const line = { x1: k === 0 ? 0 : startX[k], x2: startX[k] + d.branchMm, y1: parentY, y2: nodeY.get(b.id)!, bold: b.bold };
    lines.push(line);
    // Outcome name just after the branch end.
    const ob = labelBox(b.outcome, d.blankStyle, "text");
    const outcome: Placed = { label: b.outcome, kind: "text", cx: line.x2 + 1.5, cy: line.y2, align: "start" };
    placed.push(outcome);
    return { b, line, outcome, outcomeTarget: { kind: "outcome", id: b.id, x: line.x2 + 1, y: line.y2 - 3, width: Math.max(ob.width, 8) + 1, height: 6 } as Target };
  });
  const branchPlaced: Placed[] = [];
  const branchTargets: Target[] = [];
  for (const { b, line, outcome, outcomeTarget } of geometry) {
    const { x1, x2, y1, y2 } = line;
    // Probability above an upward or level branch, below a downward one, clear of the line.
    const pb = labelBox(b.probability, d.blankStyle, "probability");
    const w = Math.max(pb.width, 6),
      h = Math.max(pb.height, FONT * 1.2);
    const slope = (y2 - y1) / (x2 - x1);
    const at = (t: number, below: boolean) => {
      const mx = x1 + t * (x2 - x1),
        my = y1 + t * (y2 - y1);
      return { mx, cy: below ? my + Math.abs(slope) * (w / 2) + 1 + h / 2 : my - Math.abs(slope) * (w / 2) - 1 - h / 2 };
    };
    const preferBelow = y2 > y1 + 0.01;
    // The usual place is the middle of the branch. Where that would touch another branch or
    // label (the middle branch of a three-way split), slide along the branch, then try the other side.
    let spot = at(0.5, preferBelow);
    const probability: Placed = { label: b.probability, kind: "probability", cx: spot.mx, cy: spot.cy, align: "middle" };
    if (drawnLabel(probability.label)) {
      const others = placed.filter((p) => drawnLabel(p.label)).map((p) => boxOf(p, d.blankStyle));
      const clear = (c: { mx: number; cy: number }) => {
        const box = boxOf({ ...probability, cx: c.mx, cy: c.cy }, d.blankStyle);
        return (
          box.x1 >= x1 - 0.01 &&
          box.x2 <= x2 + 0.01 &&
          !others.some((o) => boxesOverlap(box, o)) &&
          !lines.some((l) => lineCrossesBox(l, box))
        );
      };
      const found = [false, true]
        .flatMap((other) => PROBABILITY_POSITIONS.map((t) => at(t, other ? !preferBelow : preferBelow)))
        .find(clear);
      if (found) spot = found;
    }
    probability.cx = spot.mx;
    probability.cy = spot.cy;
    placed.push(probability);
    // Printed and tab order stays outcome, then probability, branch by branch.
    branchPlaced.push(outcome, probability);
    branchTargets.push(outcomeTarget, { kind: "probability", id: b.id, x: spot.mx - w / 2 - 0.5, y: spot.cy - h / 2 - 0.5, width: w + 1, height: h + 1 });
  }
  placed.splice(0, placed.length, ...branchPlaced);
  targets.push(...branchTargets);
  // End columns line up at the right for every path, whatever its length.
  const endX = x + 3;
  let right = Math.max(...d.branches.map((b) => startX[depth.get(b.id)! - 1] + d.branchMm + 1.5 + labelBox(b.outcome, d.blankStyle, "text").width));
  const headings: { text: string; x: number; y: number }[] = [];
  if (d.endColumn !== "none") {
    const ow = Math.max(textWidth(d.endHeadings[0]), ...all.map((b) => labelBox(b.endOutcome, d.blankStyle, "text").width), 12);
    const pX = endX + ow + 8;
    const pw = Math.max(textWidth(d.endHeadings[1]), ...all.map((b) => labelBox(b.endProbability, d.blankStyle, "probability").width), 8);
    for (const b of all) {
      const y = nodeY.get(b.id)!;
      placed.push({ label: b.endOutcome, kind: "text", cx: endX, cy: y, align: "start" });
      targets.push({ kind: "endOutcome", id: b.id, x: endX - 0.5, y: y - 3, width: ow + 1, height: 6 });
      if (d.endColumn === "both") {
        placed.push({ label: b.endProbability, kind: "probability", cx: pX + pw / 2, cy: y, align: "middle" });
        targets.push({ kind: "endProbability", id: b.id, x: pX - 0.5, y: y - 4.5, width: pw + 1, height: 9 });
      }
    }
    const headY = Math.min(...all.map((b) => nodeY.get(b.id)!)) - d.gapMm / 2 - 2;
    headings.push({ text: d.endHeadings[0], x: endX, y: headY });
    if (d.endColumn === "both") headings.push({ text: d.endHeadings[1], x: pX + pw / 2, y: headY });
    right = d.endColumn === "both" ? pX + pw : endX + ow;
    // Only a drawn probability column can crowd: with endColumn "outcome" its saved text is not printed.
    const tight = d.endColumn === "both" && all.some((b) => labelBox(b.endProbability, d.blankStyle, "probability").height > d.gapMm - 1);
    if (tight) issues.push("End-column fractions overlap. Increase the path spacing.");
  }
  // Bounding box of the tree.
  const boxes = placed
    .map((p) => {
      const b = labelBox(p.label, d.blankStyle, p.kind);
      return p.align === "start"
        ? { x1: p.cx, x2: p.cx + b.width, y1: p.cy - b.height / 2, y2: p.cy + b.height / 2 }
        : { x1: p.cx - b.width / 2, x2: p.cx + b.width / 2, y1: p.cy - b.height / 2, y2: p.cy + b.height / 2 };
    })
    .concat(lines.map((l) => ({ x1: l.x1, x2: l.x2, y1: Math.min(l.y1, l.y2), y2: Math.max(l.y1, l.y2) })));
  let top = Math.min(...boxes.map((b) => b.y1)),
    bottom = Math.max(...boxes.map((b) => b.y2));
  if (headings.length) top = Math.min(top, headings[0].y - FONT);
  const titles: { text: string; x: number; y: number }[] = [];
  if (d.stageTitles.some((t) => t.trim())) {
    const ty = top - 2;
    d.stageTitles.slice(0, depthCount).forEach((t, k) => {
      if (t.trim()) titles.push({ text: t, x: startX[k] + d.branchMm + 1.5 + outcomeWidth[k] / 2, y: ty });
    });
    top = ty - FONT;
  }
  // Questions below the tree.
  const questionRows: { q: Question; letter: string; y: number; answerX: number }[] = [];
  let qy = bottom + 6;
  d.questions.forEach((q, i) => {
    const letter = `(${String.fromCharCode(97 + i)})`;
    const answerBox = labelBox(q.answer, d.blankStyle, "probability");
    const rowH = Math.max(FONT * 1.6, answerBox.height + 2);
    const y = qy + rowH / 2;
    const answerX = 8 + textWidth(q.text) + 3;
    questionRows.push({ q, letter, y, answerX });
    placed.push({ label: q.answer, kind: "probability", cx: answerX + Math.max(answerBox.width, 8) / 2, cy: y, align: "middle" });
    targets.push({ kind: "answer", id: q.id, x: answerX - 0.5, y: y - rowH / 2, width: Math.max(answerBox.width, 8) + 1, height: rowH });
    right = Math.max(right, answerX + Math.max(answerBox.width, 8));
    qy += rowH + 2;
  });
  if (d.questions.length) bottom = qy - 2;
  const left = Math.min(0, ...boxes.map((b) => b.x1), ...titles.map((t) => t.x - textWidth(t.text) / 2));
  right = Math.max(right, ...boxes.map((b) => b.x2), ...titles.map((t) => t.x + textWidth(t.text) / 2));
  const dx = MARGIN - left,
    dy = MARGIN - top;
  const shiftX = (v: number) => v + dx,
    shiftY = (v: number) => v + dy;

  // Printed labels must not overlap one another.
  const drawn = placed.filter((p) => drawnLabel(p.label)).map((p) => boxOf(p, d.blankStyle));
  const clash = drawn.some((a, i) => drawn.slice(i + 1).some((b) => boxesOverlap(a, b)));
  if (clash) issues.push("Some labels overlap. Increase the path spacing or branch length, or shorten labels.");
  // ... nor cross a branch line. A note rather than an issue, so saved trees still export as before.
  else if (drawn.some((box) => lines.some((l) => lineCrossesBox(l, box))))
    notes.push("A label or pupil space crosses a branch. Increase the path spacing or branch length, or shorten labels.");
  // Teacher notes: sibling probabilities that are all numbers but do not total 1.
  for (const [parent] of groupSizes(d)) {
    const group = childrenOf(d, parent);
    const values = group.map((b) => readProbability(b.probability.text));
    if (group.length > 1 && values.every((v) => v)) {
      const total = (values as Fraction[]).reduce(add, { n: 0n, d: 1n });
      if (total.n !== total.d)
        notes.push(
          `The probabilities after ${parent ? pathName(d, parent) : "the start"} add up to ${formatFraction(total, "fraction")}, not 1. Keep this only if it is deliberate.`,
        );
    }
    if (values.some((v) => v && (v.n < 0n || v.n > v.d)))
      issues.push(`A probability after ${parent ? pathName(d, parent) : "the start"} is below 0 or above 1.`);
  }
  for (const q of d.questions)
    if (q.answer.show === "show" && !q.answer.text.trim() && q.text.trim())
      notes.push(`Question ${q.text.slice(0, 20)} has no answer and no pupil space. Hide its answer to leave a space.`);
  if (d.gapMm < 12 && d.branches.some((b) => isFractionText(b.probability.text) || b.probability.show === "hidden"))
    notes.push("Fractions may crowd at this path spacing. Check the preview or increase the spacing.");

  const width = Math.ceil((right - left + 2 * MARGIN) * 10) / 10,
    height = Math.ceil((bottom - top + 2 * MARGIN) * 10) / 10;
  if (width > 180) issues.push("The tree is wider than 18 cm. Use shorter branches, shorter labels or fewer stages.");
  if (height > 250) issues.push("The tree is taller than 25 cm. Reduce the path spacing or the number of paths.");
  return {
    width,
    height,
    lines: lines.map((l) => ({ ...l, x1: shiftX(l.x1), x2: shiftX(l.x2), y1: shiftY(l.y1), y2: shiftY(l.y2) })),
    placed: placed.map((p) => ({ ...p, cx: shiftX(p.cx), cy: shiftY(p.cy) })),
    targets: targets.map((t) => ({ ...t, x: shiftX(t.x), y: shiftY(t.y) })),
    headings: headings.map((h) => ({ ...h, x: shiftX(h.x), y: shiftY(h.y) })),
    titles: titles.map((t) => ({ ...t, x: shiftX(t.x), y: shiftY(t.y) })),
    questions: questionRows.map((r) => ({ ...r, y: shiftY(r.y), answerX: shiftX(r.answerX), textX: shiftX(0) })),
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
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (t: string, x: number, y: number, anchor = "middle", fill = "black") =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${n(FONT)}" fill="${fill}">${esc(t)}</text>`;
const typeset = (t: string) => t.trim().replace(/^-/, "−").replace(/(\s)-(\s)/g, "$1−$2");
function drawLabel(p: Placed, blank: TreeDocument["blankStyle"]): string {
  const l = p.label,
    b = labelBox(l, blank, p.kind);
  const left = p.align === "start" ? p.cx : p.cx - b.width / 2;
  if (l.show === "hidden") {
    if (blank === "box")
      return `<rect x="${n(left)}" y="${n(p.cy - b.height / 2)}" width="${n(b.width)}" height="${n(b.height)}" fill="none" stroke="black" stroke-width="0.25"/>`;
    const y = p.kind === "probability" ? p.cy + 1 : p.cy + FONT * 0.4;
    return `<line x1="${n(left)}" y1="${n(y)}" x2="${n(left + b.width)}" y2="${n(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;
  }
  const t = l.text.trim();
  if (!t) return "";
  const ink = REVEALED.has(l) ? TREE_ANSWER_COLOUR : "black";
  if (isFractionText(t)) {
    const [a, c] = t.split("/").map((s) => typeset(s));
    const mid = left + b.width / 2;
    return (
      text(a, mid, p.cy - 0.9, "middle", ink) +
      `<line x1="${n(left + 0.2)}" y1="${n(p.cy)}" x2="${n(left + b.width - 0.2)}" y2="${n(p.cy)}" stroke="${ink}" stroke-width="0.25"/>` +
      text(c, mid, p.cy + FONT * 0.72 + 0.9, "middle", ink)
    );
  }
  return text(typeset(t), p.align === "start" ? left : p.cx, p.cy + FONT * 0.33, p.align === "start" ? "start" : "middle", ink);
}
export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    out: string[] = [];
  out.push(`<rect width="${n(g.width)}" height="${n(g.height)}" fill="white"/>`);
  for (const l of g.lines)
    out.push(
      `<line x1="${n(l.x1)}" y1="${n(l.y1)}" x2="${n(l.x2)}" y2="${n(l.y2)}" stroke="black" stroke-width="${l.bold ? "0.7" : "0.3"}" stroke-linecap="round"/>`,
    );
  for (const p of g.placed) out.push(drawLabel(p, d.blankStyle));
  for (const h of g.headings) out.push(text(h.text, h.x, h.y, h.x === g.headings[0].x ? "start" : "middle"));
  for (const t of g.titles) out.push(text(t.text, t.x, t.y).replace("<text ", '<text font-weight="bold" '));
  for (const r of g.questions) {
    out.push(text(r.letter, r.textX, r.y + FONT * 0.33, "start"));
    out.push(text(r.q.text, r.textX + 8, r.y + FONT * 0.33, "start"));
  }
  const label = `Probability tree diagram with ${maxDepth(d)} stage${maxDepth(d) === 1 ? "" : "s"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(g.width)}mm" height="${n(g.height)}mm" viewBox="0 0 ${n(g.width)} ${n(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`;
}

/* ---------- Editor links ---------- */

export async function hash(e: Envelope) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(e)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const MAX_LINK_LENGTH = 16_000;
export function editorLink(e: Envelope, base: string): string | null {
  const bytes = new TextEncoder().encode(canonical(e));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/probability-tree";
  url.search = "";
  url.hash = "tree=" + btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!/^#tree=[A-Za-z0-9_-]+$/.test(hashText) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported probability tree link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(6).replaceAll("-", "+").replaceAll("_", "/"));
    const t = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return parseFile(t);
  } catch {
    throw Error("This probability tree link could not be read. Open an editable file instead.");
  }
}
