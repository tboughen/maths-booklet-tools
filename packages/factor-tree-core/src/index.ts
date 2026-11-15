/**
 * Factor trees (N-5): a number split into two factors, again and again, down to circled primes,
 * with an optional "= 2³ × 3² × 5" answer line beneath. Up to three trees for the same or different
 * numbers sit side by side ("different trees, the same primes").
 *
 * Every number is {text, show}. Empty text is a pupil blank (dots or a box). A hidden number keeps
 * its saved answer: the pupil copy shows the blank and the answers copy prints it in the answer
 * colour. Circles are part of the drawing; a hidden number's circle prints only on the answers copy.
 * Nothing is split, filled or circled unless the teacher asks (completeTree). Children that do not
 * multiply to their parent raise a teacher warning, never a correction, so error-spotting works.
 */
import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { sha256Hex, toBase64Url } from "../../envelope-core/src/index";
import { aboutShape } from "../../envelope-core/src/about";
import { boldLines, LINE_WEIGHTS } from "../../envelope-core/src/house-style";

export const MAX_TREES = 3;
export const MAX_DEPTH = 8;
export const MAX_NODES = 31;
export const MAX_DIGITS = 7;
export const MAX_PRODUCT = 48;
export const ANSWER_COLOUR = "#b0125b";

const show = z.enum(["show", "hidden"]);
export const valueSchema = z.object({ text: z.string().max(MAX_DIGITS + 4), show }).strict();
export const productSchema = z.object({ text: z.string().max(MAX_PRODUCT + 12), show }).strict();
const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/);
export const nodeSchema = z
  .object({
    id,
    /** The node this one splits from; null for the tree's number at the top. */
    parent: id.nullable(),
    value: valueSchema,
    /** Circled, as primes are: true prints for pupils, "hidden" only on the answers copy. Never saved as false. */
    circled: z.union([z.literal(true), z.literal("hidden")]).optional(),
  })
  .strict();
export const treeSchema = z
  .object({
    id,
    /** The number first, then its splits; every number has no branches or exactly two. */
    nodes: z.array(nodeSchema).min(1).max(MAX_NODES),
    /** The "360 = 2³ × 3² × 5" line beneath the tree, or null for none. Empty text is a pupil answer line. */
    product: productSchema.nullable(),
  })
  .strict();
export const documentSchema = z
  .object({
    trees: z.array(treeSchema).min(1).max(MAX_TREES),
    /** How a blank number prints for pupils. */
    blankStyle: z.enum(["dots", "box"]),
    /** Height of each level of branches at print size. */
    levelMm: z.number().int().min(10).max(24),
    /** An error-spotting task: wrong splits, circles and answers raise no warning. */
    intentionalError: z.boolean(),
    /** Bold lines (U111). Normal lines are the default and are never saved. */
    lines: z
      .enum(LINE_WEIGHTS)
      .transform((v) => (v === "bold" ? v : undefined))
      .optional(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    kind: z.literal("factor-tree"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("factor-tree-1"),
    document: documentSchema,
    ...aboutShape,
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type FactorDocument = Envelope["document"];
export type Tree = FactorDocument["trees"][number];
export type TreeNode = Tree["nodes"][number];
export type Value = TreeNode["value"];

export const value = (text = "", visibility: Value["show"] = "show"): Value => ({ text, show: visibility });
export const childrenOf = (t: Tree, parent: string) => t.nodes.filter((n) => n.parent === parent);
export const isLeaf = (t: Tree, nodeId: string) => !t.nodes.some((n) => n.parent === nodeId);
export function depthOf(t: Tree, nodeId: string): number {
  let depth = 0,
    node = t.nodes.find((n) => n.id === nodeId);
  while (node?.parent) {
    depth++;
    node = t.nodes.find((n) => n.id === node!.parent);
  }
  return depth;
}
export const treeDepth = (t: Tree) => Math.max(...t.nodes.map((n) => depthOf(t, n.id)));
export const numberOf = (v: Value): number | null => (v.text ? Number(v.text) : null);
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return false;
  return true;
}
function smallestPrime(n: number): number {
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return p;
  return n;
}

/* ---------- Index form ---------- */

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** A product of powers as typed ("2^3 x 3² * 5") in its saved form ("2^3 × 3^2 × 5"). */
export function canonicalProduct(input: string): string {
  const t = input
    .trim()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS.indexOf(c)).join(""))
    .replace(/\s*\^\s*/g, "^")
    .replace(/\s*[x×X*·]\s*/g, " × ")
    .replace(/\s+/g, " ");
  if (!t) return "";
  if (!/^\d{1,7}(\^\d{1,2})?( × \d{1,7}(\^\d{1,2})?)*$/.test(t) || t.length > MAX_PRODUCT)
    throw Error(`Write the answer as a product of powers of at most ${MAX_PRODUCT} characters, such as 2^3 × 3^2 × 5.`);
  return t;
}
/** The factors of a saved product, such as [{base: 2, power: 3}, {base: 5, power: 1}]. */
export function productFactors(text: string): { base: number; power: number }[] {
  if (!text) return [];
  return text.split(" × ").map((f) => {
    const [base, power] = f.split("^");
    return { base: Number(base), power: power === undefined ? 1 : Number(power) };
  });
}
/** A number's prime factorisation in index form, primes in increasing order. */
export function indexForm(n: number): string {
  const parts: string[] = [];
  for (let p = 2, rest = n; rest > 1; p++) {
    if (p * p > rest) {
      parts.push(String(rest));
      break;
    }
    let k = 0;
    while (rest % p === 0) {
      rest /= p;
      k++;
    }
    if (k) parts.push(k === 1 ? String(p) : `${p}^${k}`);
  }
  return parts.join(" × ");
}

/* ---------- Validation ---------- */

export function validate(input: unknown): Envelope {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("product")) throw Error(`Write the answer as a product of powers of at most ${MAX_PRODUCT} characters, such as 2^3 × 3^2 × 5.`);
    if (path.includes("value")) throw Error(`Use whole numbers of at most ${MAX_DIGITS} digits.`);
    if (path.includes("trees") && (path.length <= 3 || path.at(-1) === "nodes")) throw Error(`Use 1 to ${MAX_TREES} trees, each with at most ${MAX_NODES} numbers.`);
    if (path.includes("levelMm")) throw Error("Choose a level height from 10 to 24 mm.");
    throw Error("This is not a supported factor tree file (version 1 is supported).");
  }
  const e = parsed.data;
  const treeIds = new Set<string>();
  for (const t of e.document.trees) {
    if (treeIds.has(t.id)) throw Error(`The tree ID ${t.id} appears twice.`);
    treeIds.add(t.id);
    const ids = new Set<string>();
    t.nodes.forEach((n, i) => {
      if (ids.has(n.id)) throw Error(`The number ID ${n.id} appears twice in a tree.`);
      if (i === 0 ? n.parent !== null : n.parent === null || !ids.has(n.parent)) throw Error("Each tree starts with its number, and every split comes after the number it splits.");
      ids.add(n.id);
      const text = n.value.text.trim().replace(/[\s,]/g, "");
      if (text && !new RegExp(`^[1-9]\\d{0,${MAX_DIGITS - 1}}$`).test(text)) throw Error(`"${n.value.text}": use a whole number from 1 to ${"9".repeat(MAX_DIGITS)}.`);
      n.value.text = text;
      if (!text && n.value.show === "hidden") throw Error("A blank number cannot hold a hidden answer. Enter the answer, then hide it.");
      if (n.circled !== true && n.circled !== "hidden") delete n.circled;
      if (n.circled === "hidden" && !text) throw Error("A blank number cannot be circled only on the answers copy. Enter the number, then choose that circle.");
    });
    for (const n of t.nodes) {
      const k = childrenOf(t, n.id).length;
      if (k !== 0 && k !== 2) throw Error("Every number splits into exactly two branches, or none.");
    }
    if (treeDepth(t) > MAX_DEPTH) throw Error(`A factor tree can have at most ${MAX_DEPTH} levels of branches.`);
    if (t.product) {
      t.product.text = canonicalProduct(t.product.text);
      if (!t.product.text && t.product.show === "hidden") throw Error("A blank answer line cannot hold a hidden answer. Enter the answer, then hide it.");
    }
  }
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export async function hash(e: Envelope) {
  return sha256Hex(canonical(e));
}
export const hasHidden = (e: Envelope) =>
  e.document.trees.some((t) => t.nodes.some((n) => n.value.show === "hidden" && n.value.text) || (t.product?.show === "hidden" && !!t.product.text));

/* ---------- Building ---------- */

export function newTree(treeId: string, root = "", product: Value | null = null): Tree {
  return { id: treeId, nodes: [{ id: "n1", parent: null, value: value(root) }], product };
}
/** One tree; the default is an empty number with an answer line. */
export function create(root = ""): Envelope {
  return validate({
    kind: "factor-tree",
    schemaVersion: 1,
    rendererVersion: "factor-tree-1",
    document: { trees: [newTree("t1", root, value())], blankStyle: "dots", levelMm: 13, intentionalError: false },
  });
}
const clone = (e: Envelope) => structuredClone(e);
export function treeOf(d: FactorDocument, treeId: string): Tree {
  const t = d.trees.find((x) => x.id === treeId);
  if (!t) throw Error(`There is no tree ${treeId}.`);
  return t;
}
export function nodeOf(t: Tree, nodeId: string): TreeNode {
  const n = t.nodes.find((x) => x.id === nodeId);
  if (!n) throw Error(`There is no number ${nodeId} in this tree.`);
  return n;
}
function freshNodeId(t: Tree) {
  let i = 1;
  while (t.nodes.some((n) => n.id === `n${i}`)) i++;
  return `n${i}`;
}
export function setNode(e: Envelope, treeId: string, nodeId: string, change: { text?: string; show?: Value["show"]; circled?: boolean | "hidden" }): Envelope {
  const n = clone(e),
    node = nodeOf(treeOf(n.document, treeId), nodeId);
  if (change.text !== undefined) node.value.text = change.text.trim();
  if (!node.value.text && change.show === "hidden") throw Error("A blank number cannot hold a hidden answer. Enter the answer, then hide it.");
  node.value.show = node.value.text ? (change.show ?? node.value.show) : "show";
  if (change.circled !== undefined) {
    if (change.circled) node.circled = change.circled;
    else delete node.circled;
  }
  // Clearing a number clears an answers-only circle, which needs its number.
  else if (!node.value.text && node.circled === "hidden") delete node.circled;
  return validate(n);
}
/** Gives a number two branches, with the factors given (blank by default). */
export function split(e: Envelope, treeId: string, nodeId: string, factors: [string, string] = ["", ""]): Envelope {
  const n = clone(e),
    t = treeOf(n.document, treeId);
  nodeOf(t, nodeId);
  if (!isLeaf(t, nodeId)) throw Error("This number already splits into two.");
  if (depthOf(t, nodeId) >= MAX_DEPTH) throw Error(`A factor tree can have at most ${MAX_DEPTH} levels of branches.`);
  if (t.nodes.length + 2 > MAX_NODES) throw Error(`A factor tree can hold at most ${MAX_NODES} numbers.`);
  for (const f of factors) t.nodes.push({ id: freshNodeId(t), parent: nodeId, value: value(f) });
  return validate(n);
}
/** Removes a number's branches and everything beneath them (Undo restores them). */
export function unsplit(e: Envelope, treeId: string, nodeId: string): Envelope {
  const n = clone(e),
    t = treeOf(n.document, treeId);
  nodeOf(t, nodeId);
  const gone = new Set<string>();
  const visit = (p: string) =>
    childrenOf(t, p).forEach((c) => {
      gone.add(c.id);
      visit(c.id);
    });
  visit(nodeId);
  t.nodes = t.nodes.filter((x) => !gone.has(x.id));
  return validate(n);
}
/** Adds a tree, starting from the first tree's number when none is given, for "a different tree for the same number". */
export function addTree(e: Envelope, root?: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.trees.length >= MAX_TREES) throw Error(`Use at most ${MAX_TREES} trees.`);
  let i = 1;
  while (d.trees.some((t) => t.id === `t${i}`)) i++;
  const first = d.trees[0];
  const tree = newTree(`t${i}`, root ?? "", first.product ? value() : null);
  // The same number keeps its saved visibility: a hidden number stays a pupil blank.
  if (root === undefined) tree.nodes[0].value = structuredClone(first.nodes[0].value);
  d.trees.push(tree);
  return validate(n);
}
export function removeTree(e: Envelope, treeId: string): Envelope {
  const n = clone(e),
    d = n.document;
  if (d.trees.length <= 1) throw Error("A factor tree diagram needs at least one tree.");
  treeOf(d, treeId);
  d.trees = d.trees.filter((t) => t.id !== treeId);
  return validate(n);
}
/** Sets the answer line: null removes it; empty text is a pupil answer line. */
export function setProduct(e: Envelope, treeId: string, product: { text?: string; show?: Value["show"] } | null): Envelope {
  const n = clone(e),
    t = treeOf(n.document, treeId);
  if (product === null) t.product = null;
  else {
    const next = t.product ?? value();
    if (product.text !== undefined) next.text = canonicalProduct(product.text);
    if (!next.text && product.show === "hidden") throw Error("A blank answer line cannot hold a hidden answer. Enter the answer, then hide it.");
    next.show = next.text ? (product.show ?? next.show) : "show";
    t.product = next;
  }
  return validate(n);
}

/* ---------- Explicit completion ---------- */

/**
 * Completes trees when the teacher asks: fills a blank number from its parent and the other branch
 * (or from its two branches), splits every composite end by its smallest prime, circles every prime
 * end, and fills a blank answer line with the index form. Numbers already entered never change.
 * Filled numbers and answers are hidden when `hidden` is true.
 */
export function completeTree(e: Envelope, treeId?: string, hidden = false): { envelope: Envelope; filled: number } {
  const n = clone(e);
  if (treeId !== undefined) treeOf(n.document, treeId);
  let filled = 0;
  const visibility = hidden ? "hidden" : "show";
  for (const t of n.document.trees) {
    if (treeId !== undefined && t.id !== treeId) continue;
    let progress = true;
    while (progress) {
      progress = false;
      for (const p of [...t.nodes]) {
        const kids = childrenOf(t, p.id);
        if (kids.length === 2) {
          const [a, b] = kids,
            pv = numberOf(p.value),
            av = numberOf(a.value),
            bv = numberOf(b.value);
          if (pv === null && av !== null && bv !== null && av * bv < 10 ** MAX_DIGITS) {
            p.value = value(String(av * bv), visibility);
            filled++;
            progress = true;
          }
          for (const [x, other] of [[a, bv], [b, av]] as const)
            if (pv !== null && numberOf(x.value) === null && other && pv % other === 0) {
              x.value = value(String(pv / other), visibility);
              filled++;
              progress = true;
            }
        } else {
          const v = numberOf(p.value);
          if (v === null || v < 4 || isPrime(v)) continue;
          if (depthOf(t, p.id) >= MAX_DEPTH || t.nodes.length + 2 > MAX_NODES)
            throw Error(`${v} needs more splits than a tree can hold (${MAX_DEPTH} levels, ${MAX_NODES} numbers). Split it by hand into larger factors.`);
          const q = smallestPrime(v);
          for (const f of [q, v / q]) t.nodes.push({ id: freshNodeId(t), parent: p.id, value: value(String(f), visibility) });
          filled += 2;
          progress = true;
        }
      }
    }
    for (const x of t.nodes) {
      const v = numberOf(x.value);
      if (v !== null && isLeaf(t, x.id) && isPrime(v) && !x.circled) {
        // A circle is an answer too: hidden circles print only on the answers copy.
        x.circled = hidden ? "hidden" : true;
        filled++;
      }
    }
    const root = numberOf(t.nodes[0].value);
    if (t.product && !t.product.text && root !== null && root > 1) {
      t.product = value(indexForm(root), visibility);
      filled++;
    }
  }
  return { envelope: validate(n), filled };
}

/* ---------- Teacher warnings ---------- */

export function warnings(e: Envelope): string[] {
  const d = e.document;
  if (d.intentionalError) return [];
  const out: string[] = [];
  d.trees.forEach((t, i) => {
    const where = d.trees.length > 1 ? `In tree ${i + 1}, ` : "";
    const say = (s: string) => out.push(where ? where + s[0].toLowerCase() + s.slice(1) : s);
    for (const p of t.nodes) {
      const kids = childrenOf(t, p.id);
      const pv = numberOf(p.value),
        [av, bv] = kids.map((k) => numberOf(k.value));
      if (kids.length === 2 && pv !== null && av != null && bv != null && av * bv !== pv) say(`${av} × ${bv} is ${av * bv}, not ${pv}.`);
      if (p.circled && pv !== null && !isPrime(pv)) say(`${pv} is circled but is not prime.`);
    }
    const root = numberOf(t.nodes[0].value);
    if (t.product?.text) {
      const factors = productFactors(t.product.text);
      for (const f of factors) if (!isPrime(f.base)) say(`${f.base} in the answer is not prime.`);
      const total = factors.reduce((a, f) => a * f.base ** f.power, 1);
      if (root !== null && total !== root) say(`The answer ${t.product.text} makes ${total}, not ${root}.`);
    }
  });
  return [...new Set(out)];
}

/* ---------- Views ---------- */

const REVEALED = new WeakSet<Value>();
const REVEALED_RING = new WeakSet<TreeNode>();
/** The answers copy prints hidden answers; with `mark` they print in the answer colour. */
export function forView(e: Envelope, view: "pupil" | "answer", mark = false): Envelope {
  if (view === "pupil") return e;
  const n = clone(e);
  for (const t of n.document.trees) {
    for (const x of t.nodes)
      if (x.circled === "hidden") {
        x.circled = true;
        if (mark) REVEALED_RING.add(x);
      }
    for (const v of [...t.nodes.map((x) => x.value), ...(t.product ? [t.product] : [])]) {
      if (mark && v.show === "hidden" && v.text) REVEALED.add(v);
      v.show = "show";
    }
  }
  return n;
}

/* ---------- Layout ---------- */

export const FONT = (11 * 25.4) / 72;
const SUP = 0.72;
const GAP = 4;
const TREE_GAP = 12;
const ANSWER_MM = 40;
const LINE_GAP = 9;
const MARGIN = 1;
const BLANK_MM = 10;
/** A number's own circle: round its text, never smaller than a single digit's. */
export const circleRadius = (t: string) => Math.max(FONT * 0.8, textWidth(t) / 2 + 1.4);
const MAX_WIDTH_MM = 180;
/** STIX Two Text advances for signs that the shared metrics table leaves out. */
const EXTRA: Record<string, number> = { "=": 0.72 };
export const textWidth = (t: string, font = FONT) => [...t].reduce((a, c) => a + (EXTRA[c] ?? glyphAdvance(c)), 0) * font;
/** Width of a saved product with its powers printed as superscripts. */
export function productWidth(text: string) {
  return productFactors(text).reduce(
    (w, f, i) => w + (i ? textWidth(" × ") : 0) + textWidth(String(f.base)) + (f.power === 1 ? 0 : textWidth(String(f.power)) * SUP),
    0,
  );
}

export type PlacedNode = { treeId: string; id: string; x: number; y: number; node: TreeNode; leaf: boolean };
export function layout(e: Envelope) {
  const d = e.document,
    issues: string[] = [];
  // Only printed numbers set sizes, so the pupil copy gives no hint of a hidden number. Every number that
  // is not printed (blank or hidden alike) gets room for as many digits as its nearest printed number above
  // it, since a factor is never longer than the number it splits, or for the most digits a number can have.
  const shown = (v: Value) => (v.show === "show" ? v.text : "");
  const room = (t: Tree, n: TreeNode): string => {
    for (let p: TreeNode | undefined = n; p; p = p.parent ? t.nodes.find((x) => x.id === p!.parent) : undefined)
      if (shown(p.value)) return "0".repeat(shown(p.value).length);
    return "0".repeat(MAX_DIGITS);
  };
  const widest = Math.max(textWidth("00"), ...d.trees.flatMap((t) => t.nodes.map((n) => textWidth(shown(n.value) || room(t, n)))));
  // Every number gets the same slot, wide enough for the widest number and a 10 mm pupil blank.
  const r = Math.max(BLANK_MM / 2 + 0.8, widest / 2 + 1.6);
  const slot = 2 * r + GAP;
  const placed: PlacedNode[] = [];
  const branches: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const answers: { treeId: string; prefix: string; product: Value; x: number; y: number; width: number }[] = [];
  const depthMax = Math.max(...d.trees.map(treeDepth));
  const answerY = MARGIN + 2 * r + depthMax * d.levelMm + LINE_GAP;
  let left = MARGIN;
  for (const t of d.trees) {
    // Ends take one slot each, left to right; a number sits midway above its two branches.
    const x = new Map<string, number>();
    let next = 0;
    const visit = (nodeId: string): number => {
      const kids = childrenOf(t, nodeId);
      const at = kids.length ? (visit(kids[0].id) + visit(kids[1].id)) / 2 : slot * next++ + slot / 2;
      x.set(nodeId, at);
      return at;
    };
    visit(t.nodes[0].id);
    const treeWidth = next * slot;
    const root = t.nodes[0].value;
    const prefix = root.text && root.show === "show" ? `${root.text} = ` : "";
    // A hidden answer never widens the pupil line, so its length gives nothing away.
    const answerWidth = t.product ? textWidth(prefix) + Math.max(ANSWER_MM, t.product.text && t.product.show === "show" ? productWidth(t.product.text) : 0) : 0;
    const column = Math.max(treeWidth, answerWidth);
    const shift = left + (column - treeWidth) / 2;
    for (const n of t.nodes) placed.push({ treeId: t.id, id: n.id, x: shift + x.get(n.id)!, y: MARGIN + r + depthOf(t, n.id) * d.levelMm, node: n, leaf: isLeaf(t, n.id) });
    for (const n of t.nodes)
      if (n.parent) {
        const a = placed.find((p) => p.treeId === t.id && p.id === n.parent)!,
          b = placed.find((p) => p.treeId === t.id && p.id === n.id)!;
        const dx = b.x - a.x,
          dy = b.y - a.y,
          len = Math.hypot(dx, dy);
        // Branches stop just short of each number's circle (or where its circle would be).
        const from = Math.min((circleRadius(shown(a.node.value)) + 0.5) / len, 0.45),
          to = Math.min((circleRadius(shown(b.node.value)) + 0.5) / len, 0.45);
        branches.push({ x1: a.x + dx * from, y1: a.y + dy * from, x2: b.x - dx * to, y2: b.y - dy * to });
      }
    if (t.product) answers.push({ treeId: t.id, prefix, product: t.product, x: left + (column - answerWidth) / 2, y: answerY, width: answerWidth });
    left += column + TREE_GAP;
  }
  const width = left - TREE_GAP + MARGIN;
  const height = (answers.length ? answerY + 2 : MARGIN + 2 * r + depthMax * d.levelMm) + MARGIN;
  if (width > MAX_WIDTH_MM) issues.push(`The trees are ${Math.round(width)} mm wide, over the ${MAX_WIDTH_MM} mm print width. Use fewer trees or split larger numbers first.`);
  return { width, height, r, nodes: placed, branches, answers, issues };
}
export const exportIssue = (e: Envelope) => layout(e).issues[0] ?? null;

/* ---------- SVG ---------- */

const num = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FAMILY = "STIX Two Text,STIX Two Math,serif";
const text = (t: string, x: number, y: number, fill: string, anchor = "middle") =>
  `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-family="${FAMILY}" font-size="${num(FONT)}" fill="${fill}">${esc(t)}</text>`;
const dotted = (x1: number, x2: number, y: number) =>
  `<line x1="${num(x1)}" y1="${num(y)}" x2="${num(x2)}" y2="${num(y)}" stroke="black" stroke-width="0.3" stroke-dasharray="0.3 0.9" stroke-linecap="round"/>`;
/** A product in index form starting at x, its powers raised. */
function productMarkup(textValue: string, x: number, y: number, fill: string): string {
  const spans = productFactors(textValue)
    .map((f, i) => `${i ? esc(" × ") : ""}${f.base}${f.power === 1 ? "" : `<tspan baseline-shift="super" font-size="${Math.round(SUP * 100)}%">${f.power}</tspan>`}`)
    .join("");
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="start" font-family="${FAMILY}" font-size="${num(FONT)}" fill="${fill}">${spans}</text>`;
}

export function renderSvg(e: Envelope): string {
  const d = e.document,
    g = layout(e),
    r = g.r,
    out: string[] = [`<rect width="${num(g.width)}" height="${num(g.height)}" fill="white"/>`];
  for (const b of g.branches)
    out.push(`<line x1="${num(b.x1)}" y1="${num(b.y1)}" x2="${num(b.x2)}" y2="${num(b.y2)}" stroke="black" stroke-width="0.3" stroke-linecap="round"/>`);
  for (const p of g.nodes) {
    const v = p.node.value,
      fill = REVEALED.has(v) ? ANSWER_COLOUR : "black";
    const showing = !!v.text && v.show === "show";
    if (showing) out.push(text(v.text, p.x, p.y + FONT * 0.33, fill));
    else if (d.blankStyle === "box") out.push(`<rect x="${num(p.x - r + 0.6)}" y="${num(p.y - FONT * 0.8)}" width="${num(2 * r - 1.2)}" height="${num(FONT * 1.6)}" fill="none" stroke="black" stroke-width="0.25"/>`);
    else if (!(p.node.circled === true && !v.text)) out.push(dotted(p.x - r + 0.8, p.x + r - 0.8, p.y + FONT * 0.45));
    // A circle is part of the answer when its number is hidden; an empty circle is a scaffold.
    if (p.node.circled === true && (showing || !v.text))
      out.push(`<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(showing ? circleRadius(v.text) : r - 0.3)}" fill="none" stroke="${REVEALED_RING.has(p.node) ? ANSWER_COLOUR : fill}" stroke-width="0.3"/>`);
  }
  for (const a of g.answers) {
    const fill = REVEALED.has(a.product) ? ANSWER_COLOUR : "black";
    const start = a.x + textWidth(a.prefix);
    if (a.prefix) out.push(text(a.prefix.trim(), a.x, a.y, "black", "start"));
    if (!a.product.text || a.product.show === "hidden" || REVEALED.has(a.product)) out.push(dotted(start, a.x + a.width, a.y + 0.6));
    if (a.product.text && a.product.show === "show") out.push(productMarkup(a.product.text, start + (REVEALED.has(a.product) ? 1 : 0), a.y, fill));
  }
  const roots = d.trees.map((t) => (t.nodes[0].value.show === "show" && t.nodes[0].value.text) || "a number");
  const label = `Factor tree${d.trees.length > 1 ? "s" : ""} for ${roots.join(", ")}`;
  return boldLines(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(g.width)}mm" height="${num(g.height)}mm" viewBox="0 0 ${num(g.width)} ${num(g.height)}" role="img" aria-label="${esc(label)}">${out.join("")}</svg>`,
    d.lines,
  );
}

/* ---------- Editor links ---------- */

export const MAX_LINK_LENGTH = 16_000;
export const LINK_PREFIX = "#factor-tree=";
export const linkHash = (e: Envelope) => LINK_PREFIX + toBase64Url(canonical(e));
export function editorLink(e: Envelope, base: string): string | null {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/(\/tools(\/[^/]*)?)?\/?$/, "/") + "tools/factor-tree";
  url.search = "";
  url.hash = linkHash(e);
  return url.href.length <= MAX_LINK_LENGTH ? url.href : null;
}
export function decodeLinkHash(hashText: string): Envelope {
  if (!hashText.startsWith(LINK_PREFIX) || !/^[A-Za-z0-9_-]+$/.test(hashText.slice(LINK_PREFIX.length)) || hashText.length > MAX_LINK_LENGTH)
    throw Error("This is not a supported factor tree link. Open an editable file instead.");
  try {
    const binary = atob(hashText.slice(LINK_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"));
    return parseFile(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    throw Error("This factor tree link could not be read. Open an editable file instead.");
  }
}
