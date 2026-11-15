import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, explicit completion and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const numberText = z.string().max(core.MAX_DIGITS + 4);
const productText = z.string().max(core.MAX_PRODUCT + 12);
export const outputViewSchema = z.enum(["pupil", "answer"]);

type NodeInput = { value?: string; hidden?: boolean; circled?: boolean | "hidden"; children?: NodeInput[] };
/** true circles for pupils; "hidden" circles only on the answers copy. */
const circle = z.union([z.boolean(), z.literal("hidden")]);
const nodeInput: z.ZodType<NodeInput> = z.lazy(() =>
  z
    .object({
      /** The number; "" or omitted is a pupil blank. */
      value: numberText.optional(),
      /** Keep the number as a saved answer: a blank for pupils. */
      hidden: z.boolean().optional(),
      circled: circle.optional(),
      /** Exactly two branches, or none. */
      children: z.array(nodeInput).length(2).optional(),
    })
    .strict(),
);
/** The answer line: true for a pupil answer line, a product such as "2^3 × 3^2 × 5", or { text, hidden }. */
const productInput = z.union([z.boolean(), productText, z.object({ text: productText, hidden: z.boolean().optional() }).strict()]);
const treeInput = z.object({ root: nodeInput, product: productInput.optional() }).strict();
const completeInput = z.union([z.boolean(), z.object({ hidden: z.boolean().optional() }).strict()]);
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    /** Shorthand for one tree: its number. */
    root: numberText.optional(),
    /** Shorthand for one tree: its answer line (default true, a pupil answer line). */
    product: productInput.optional(),
    trees: z.array(treeInput).min(1).max(core.MAX_TREES).optional(),
    blankStyle: core.documentSchema.shape.blankStyle.optional(),
    levelMm: core.documentSchema.shape.levelMm.optional(),
    intentionalError: z.boolean().optional(),
    lines: z.enum(LINE_WEIGHTS).optional(),
    /** Explicitly complete every tree (splits by smallest primes, circles primes, fills the answer line); hidden answers unless hidden is false. */
    complete: completeInput.optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const treeRef = z.string().max(24).describe('A tree ID such as "t1".');
const nodeRef = z.string().max(24).describe('A number ID such as "n1" (the top number) within the tree.');
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_node"), treeId: treeRef, nodeId: nodeRef, text: numberText.optional(), show: show.optional(), circled: circle.optional() }).strict(),
  z.object({ op: z.literal("split_node"), treeId: treeRef, nodeId: nodeRef, factors: z.array(numberText).length(2).optional() }).strict(),
  z.object({ op: z.literal("remove_split"), treeId: treeRef, nodeId: nodeRef }).strict(),
  z.object({ op: z.literal("add_tree"), root: numberText.optional() }).strict(),
  z.object({ op: z.literal("remove_tree"), treeId: treeRef }).strict(),
  z.object({ op: z.literal("set_product"), treeId: treeRef, product: z.object({ text: productText.optional(), show: show.optional() }).strict().nullable() }).strict(),
  z.object({ op: z.literal("complete_tree"), treeId: treeRef.optional(), hidden: z.boolean().optional() }).strict(),
  z
    .object({
      op: z.literal("set_settings"),
      settings: z
        .object({ blankStyle: core.documentSchema.shape.blankStyle, levelMm: core.documentSchema.shape.levelMm, intentionalError: z.boolean(), lines: z.enum(LINE_WEIGHTS) })
        .partial()
        .strict(),
    })
    .strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
    outputView: outputViewSchema.optional(),
  })
  .strict();

function buildTree(treeId: string, input: z.infer<typeof treeInput>): core.Tree {
  const nodes: core.TreeNode[] = [];
  const add = (n: NodeInput, parent: string | null) => {
    const nodeId = `n${nodes.length + 1}`,
      text = (n.value ?? "").trim();
    if (n.hidden && !text) throw Error("A blank number cannot hold a hidden answer. Give its value, then hide it.");
    nodes.push({ id: nodeId, parent, value: core.value(text, n.hidden ? "hidden" : "show"), ...(n.circled ? { circled: n.circled } : {}) });
    if (n.children) for (const c of n.children) add(c, nodeId);
  };
  add(input.root, null);
  const p = input.product ?? true;
  const product =
    p === false ? null : p === true ? core.value() : typeof p === "string" ? core.value(p) : core.value(p.text, p.hidden ? "hidden" : "show");
  if (product?.show === "hidden" && !product.text.trim()) throw Error("A blank answer line cannot hold a hidden answer. Give the answer, then hide it.");
  return { id: treeId, nodes, product };
}
function settings(e: core.Envelope, s: { blankStyle?: "dots" | "box"; levelMm?: number; intentionalError?: boolean; lines?: "normal" | "bold" }): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.blankStyle !== undefined) d.blankStyle = s.blankStyle;
  if (s.levelMm !== undefined) d.levelMm = s.levelMm;
  if (s.intentionalError !== undefined) d.intentionalError = s.intentionalError;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  return core.validate(n);
}

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.root !== undefined || s.trees || s.product !== undefined || s.complete)) throw Error("Examples already contain their trees; revise the result instead.");
  if (s.trees && (s.root !== undefined || s.product !== undefined)) throw Error("Give trees, or root and product for one tree, not both.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const trees = s.trees ?? [{ root: { value: s.root ?? "" }, product: s.product }];
    e = core.validate({ ...core.create(), document: { ...core.create().document, trees: trees.map((t, i) => buildTree(`t${i + 1}`, t)) } });
  }
  e = settings(e, s);
  if (s.complete) e = core.completeTree(e, undefined, typeof s.complete === "object" ? (s.complete.hidden ?? true) : true).envelope;
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_node":
        e = core.setNode(e, op.treeId, op.nodeId, { text: op.text, show: op.show, circled: op.circled });
        break;
      case "split_node":
        e = core.split(e, op.treeId, op.nodeId, op.factors as [string, string] | undefined);
        break;
      case "remove_split":
        e = core.unsplit(e, op.treeId, op.nodeId);
        break;
      case "add_tree":
        e = core.addTree(e, op.root);
        break;
      case "remove_tree":
        e = core.removeTree(e, op.treeId);
        break;
      case "set_product":
        e = core.setProduct(e, op.treeId, op.product);
        break;
      case "complete_tree":
        e = core.completeTree(e, op.treeId, op.hidden ?? true).envelope;
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const g = core.layout(core.forView(e, view));
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(core.forView(e, view)), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [...new Set(g.answers.map((a) => Math.round((a.width - core.textWidth(a.prefix)) * 10) / 10))],
  });
}
