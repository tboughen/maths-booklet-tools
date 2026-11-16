import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";
import { LINE_WEIGHTS } from "../../envelope-core/src/house-style";

/** Connector adapter: the same schema, explicit actions and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const show = z.enum(["show", "hidden"]);
const text = z.string().max(core.MAX_TEXT);
const letter = z.string().regex(/^[a-km-np-z]$/);
const letters = z.object({ long: letter, short: letter }).strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);

/** A line under the tiles: text ("" is a pupil answer line) or {text, hidden}. */
const item = z.union([text, z.object({ text, hidden: z.boolean().optional() }).strict()]);
const termInput = z
  .object({
    /** The tile, such as "a²b", "ab", "b", "1". */
    term: z.string().max(12),
    /** How many tiles, negative for negative tiles; never 0. */
    count: z.number().int().min(-core.MAX_COUNT).max(core.MAX_COUNT),
    /** true: pupils see the space empty; the answers copy prints these tiles. */
    hidden: z.boolean().optional(),
  })
  .strict();
const explicit = z.union([z.boolean(), z.object({ hidden: z.boolean().optional() }).strict()]);
const settingsShape = {
  arrangement: core.documentSchema.shape.arrangement,
  zeroPairs: core.documentSchema.shape.zeroPairs,
  labels: z.boolean(),
  fill: core.documentSchema.shape.fill,
  frame: z.boolean(),
  intentionalError: z.boolean(),
  lines: z.enum(LINE_WEIGHTS),
};
export const specSchema = z
  .object({
    example: z.enum(exampleIds).optional(),
    worked: z.boolean().optional(),
    /** The tiles as an expression, as written: "3a + 2b − a + 4". Nothing is collected. */
    tiles: z.string().max(120).optional(),
    /** The tiles term by term, when some are hidden. */
    terms: z.array(termInput).min(1).max(core.MAX_TERMS).optional(),
    /** The letter of the long tiles and of the short tiles. Default from the expression, first alphabetically long. */
    letters: letters.optional(),
    /** true hides every tile: pupils draw them (use frame for room). */
    hideTiles: z.boolean().optional(),
    expression: item.optional(),
    answer: item.optional(),
    arrangement: settingsShape.arrangement.optional(),
    zeroPairs: settingsShape.zeroPairs.optional(),
    labels: z.boolean().optional(),
    fill: settingsShape.fill.optional(),
    frame: z.boolean().optional(),
    intentionalError: z.boolean().optional(),
    lines: settingsShape.lines.optional(),
    /** Explicitly write the expression the tiles show (hidden answer unless hidden:false). */
    writeExpression: explicit.optional(),
    /** Explicitly collect like terms into the answer line (hidden answer unless hidden:false). */
    collect: explicit.optional(),
  })
  .strict();
export const createSchema = z
  .object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() })
  .strict();
const termRef = z.string().max(24).describe('A term ID such as "t1", from the returned envelope.');
const itemRef = z.enum(["expression", "answer"]);
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_tiles"), tiles: z.string().max(120) }).strict(),
  z.object({ op: z.literal("set_term"), termId: termRef, term: z.string().max(12).optional(), count: termInput.shape.count.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("add_term"), term: z.string().max(12), count: termInput.shape.count, after: termRef.optional() }).strict(),
  z.object({ op: z.literal("remove_term"), termId: termRef }).strict(),
  z.object({ op: z.literal("move_term"), termId: termRef, by: z.number().int().min(-1).max(1).describe("-1 earlier, 1 later.") }).strict(),
  z.object({ op: z.literal("set_item"), item: itemRef, text: text.optional(), show: show.optional() }).strict(),
  z.object({ op: z.literal("remove_item"), item: itemRef }).strict(),
  z.object({ op: z.literal("set_letters"), letters }).strict(),
  z.object({ op: z.literal("write_expression"), hidden: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("collect"), hidden: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("set_settings"), settings: z.object(settingsShape).partial().strict() }).strict(),
]);
export const revisionSchema = z
  .object({
    envelope: core.envelopeSchema,
    baseHash: z.string().regex(/^[a-f0-9]{64}$/),
    operations: z.array(operationSchema).max(40),
    outputView: outputViewSchema.optional(),
  })
  .strict();

type Settings = Partial<{ [K in keyof typeof settingsShape]: z.infer<(typeof settingsShape)[K]> }>;
function settings(e: core.Envelope, s: Settings): core.Envelope {
  const n = structuredClone(e),
    d = n.document;
  if (s.arrangement !== undefined) d.arrangement = s.arrangement;
  if (s.zeroPairs !== undefined) d.zeroPairs = s.zeroPairs;
  if (s.labels !== undefined) d.labels = s.labels;
  if (s.fill !== undefined) d.fill = s.fill;
  if (s.frame !== undefined) d.frame = s.frame;
  if (s.intentionalError !== undefined) d.intentionalError = s.intentionalError;
  if (s.lines === "bold") d.lines = "bold";
  else if (s.lines === "normal") delete d.lines;
  return core.validate(n);
}
function setLine(e: core.Envelope, which: core.Item, input: z.infer<typeof item>): core.Envelope {
  const t = (typeof input === "string" ? input : input.text).trim(),
    hidden = typeof input === "object" && !!input.hidden;
  if (hidden && !t) throw Error("A blank cannot hold a hidden answer. Give its value, then hide it.");
  return core.setItem(e, which, { text: t, show: hidden ? "hidden" : "show" });
}
const hiddenOf = (x: z.infer<typeof explicit>) => (typeof x === "object" ? (x.hidden ?? true) : true);
/** The letters a list of terms uses, as one expression. */
const termsText = (terms: z.infer<typeof termInput>[]) => terms.map((t) => t.term).join("+");

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.tiles || s.terms || s.letters || s.expression !== undefined || s.answer !== undefined || s.writeExpression || s.collect || s.hideTiles))
    throw Error("Examples already contain their tiles; revise the result instead.");
  if (s.tiles && s.terms) throw Error("Give tiles (an expression) or terms, not both.");
  let e: core.Envelope;
  if (s.example) e = examples.find((x) => x.id === s.example)!.make(false);
  else {
    const fallback = s.letters ?? { long: "x", short: "y" };
    const source = s.tiles ?? (s.terms ? termsText(s.terms) : "3x + 2 − x");
    const letters = s.letters ? fallback : core.lettersFor(source, fallback);
    if (s.terms) {
      e = core.create("1", letters);
      const d = e.document;
      d.terms = s.terms.map((t, i) => ({ id: `t${i + 1}`, count: t.count, ...core.readKind(t.term, letters), show: t.hidden ? ("hidden" as const) : ("show" as const) }));
      e = core.validate(e);
    } else e = core.create(source, letters);
  }
  e = settings(e, s);
  if (s.hideTiles) {
    const n = structuredClone(e);
    n.document.terms.forEach((t) => (t.show = "hidden"));
    e = core.validate(n);
  }
  if (s.expression !== undefined) e = setLine(e, "expression", s.expression);
  if (s.answer !== undefined) e = setLine(e, "answer", s.answer);
  if (s.writeExpression) e = core.writeExpression(e, hiddenOf(s.writeExpression)).envelope;
  if (s.collect) e = core.collect(e, hiddenOf(s.collect)).envelope;
  if (s.worked) e = core.forView(e, "answer");
  return e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("stale_hash: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    switch (op.op) {
      case "set_tiles":
        e = core.setTiles(e, op.tiles);
        break;
      case "set_term":
        e = core.setTerm(e, op.termId, { term: op.term, count: op.count, show: op.show });
        break;
      case "add_term":
        e = core.addTerm(e, { count: op.count, ...core.readKind(op.term, e.document.letters) }, op.after);
        break;
      case "remove_term":
        e = core.removeTerm(e, op.termId);
        break;
      case "move_term":
        if (op.by !== 0) e = core.moveTerm(e, op.termId, op.by as -1 | 1);
        break;
      case "set_item":
        e = core.setItem(e, op.item, { text: op.text, show: op.show });
        break;
      case "remove_item":
        e = core.setItem(e, op.item, null);
        break;
      case "set_letters":
        e = core.setLetters(e, op.letters);
        break;
      case "write_expression":
        e = core.writeExpression(e, op.hidden ?? true).envelope;
        break;
      case "collect":
        e = core.collect(e, op.hidden ?? true).envelope;
        break;
      case "set_settings":
        e = settings(e, op.settings);
        break;
    }
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  const shown = core.forView(e, view),
    g = core.layout(shown);
  const blanks = g.line.filter((l) => !l.v.text || l.v.show === "hidden").map((l) => l.blank);
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(shown), 72 / 25.4),
    gridPitchMm: [],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [...new Set(blanks)],
  });
}
