import { z } from "zod";
import * as core from "./index";
import { examples } from "./examples";
import { guidance, renderedTextSizesPt } from "../../graph-core/src/print-guidance";

/** Connector adapter: the same schema and renderer as the browser editor. */
export const exampleIds = examples.map((x) => x.id) as [string, ...string[]];
const heights = core.documentSchema.shape.heights;
const panelInput = z
  .object({
    view: z.enum(core.VIEWS),
    /** drawn (both copies), blank (empty grid only) or answer (empty grid for pupils, drawn on the answer copy). */
    state: z.enum(["drawn", "blank", "answer"]).optional(),
    /** Defaults to Plan, Front elevation, Side elevation (no label for the isometric drawing). */
    label: z.string().max(40).optional(),
    labelHidden: z.boolean().optional(),
    across: z.number().int().min(0).max(20).optional(),
    up: z.number().int().min(0).max(20).optional(),
  })
  .strict();
const settings = z
  .object({ unitCm: core.documentSchema.shape.unitCm, arrows: z.boolean(), isoDots: z.boolean(), maxWidthCm: core.documentSchema.shape.maxWidthCm })
  .partial()
  .strict();
export const outputViewSchema = z.enum(["pupil", "answer"]);
export const specSchema = z
  .object({ example: z.enum(exampleIds).optional(), worked: z.boolean().optional(), heights: heights.optional(), panels: z.array(panelInput).min(1).max(core.MAX_PANELS).optional(), settings: settings.optional() })
  .strict();
export const createSchema = z.object({ envelope: core.envelopeSchema.optional(), spec: specSchema.optional(), outputView: outputViewSchema.optional() }).strict();
export const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_heights"), heights }).strict(),
  z.object({ op: z.literal("set_height"), row: z.number().int().min(0), column: z.number().int().min(0), height: z.number().int().min(0).max(core.MAX_HEIGHT) }).strict(),
  z.object({ op: z.literal("set_panels"), panels: z.array(panelInput).min(1).max(core.MAX_PANELS) }).strict(),
  z.object({ op: z.literal("set_panel"), index: z.number().int().min(0), panel: panelInput.partial() }).strict(),
  z.object({ op: z.literal("set_settings"), settings }).strict(),
  z.object({ op: z.literal("show_all") }).strict(),
]);
export const revisionSchema = z
  .object({ envelope: core.envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(30), outputView: outputViewSchema.optional() })
  .strict();

type PanelInput = z.infer<typeof panelInput>;
function toPanel(p: PanelInput, base?: core.Panel): core.Panel {
  const view = p.view ?? base!.view;
  const out = base ? structuredClone(base) : core.panel(view);
  out.view = view;
  if (!base && p.label === undefined) out.label.text = core.DEFAULT_LABELS[view];
  if (p.state) out.state = p.state;
  if (p.label !== undefined) out.label.text = p.label;
  if (p.labelHidden !== undefined) out.label.show = p.labelHidden ? "hidden" : "show";
  if (p.across !== undefined) out.squares.across = p.across;
  if (p.up !== undefined) out.squares.up = p.up;
  return out;
}
const withDoc = (e: core.Envelope, f: (d: core.ElevationDocument) => void) => {
  const n = structuredClone(e);
  f(n.document);
  return core.validate(n);
};

export function create(input: unknown): core.Envelope {
  const v = createSchema.parse(input);
  if (v.envelope && v.spec) throw Error("Supply spec or envelope, not both.");
  if (v.envelope) return core.validate(v.envelope);
  const s = v.spec;
  if (!s) return core.create();
  if (s.example && (s.heights || s.panels)) throw Error("Examples already contain their solid and views; revise the result instead.");
  let e = s.example ? examples.find((x) => x.id === s.example)!.make(false) : core.create();
  e = withDoc(e, (d) => {
    if (s.heights) d.heights = s.heights;
    if (s.panels) d.panels = s.panels.map((p) => toPanel(p));
    Object.assign(d, s.settings ?? {});
  });
  return s.worked ? core.forView(e, "answer") : e;
}

export async function revise(input: unknown): Promise<core.Envelope> {
  const v = revisionSchema.parse(input);
  if ((await core.hash(v.envelope)) !== v.baseHash) throw Error("base_hash_mismatch: Use the exact returned envelope and contentHash.");
  let e = core.validate(structuredClone(v.envelope));
  for (const op of v.operations) {
    if (op.op === "show_all") e = core.forView(e, "answer");
    else
      e = withDoc(e, (d) => {
        if (op.op === "set_heights") d.heights = op.heights;
        if (op.op === "set_height") {
          if (op.row >= d.heights.length || op.column >= d.heights[0].length) throw Error(`The grid has ${d.heights.length} rows and ${d.heights[0].length} columns (counted from 0, row 0 at the front).`);
          d.heights[op.row][op.column] = op.height;
        }
        if (op.op === "set_panels") d.panels = op.panels.map((p) => toPanel(p));
        if (op.op === "set_panel") {
          const p = d.panels[op.index];
          if (!p) throw Error(`There is no panel ${op.index}; panels are counted from 0.`);
          d.panels[op.index] = toPanel({ view: p.view, ...op.panel } as PanelInput, p);
        }
        if (op.op === "set_settings") Object.assign(d, op.settings);
      });
  }
  return e;
}

export function printFacts(e: core.Envelope, view: "pupil" | "answer" = "pupil") {
  return guidance({
    textSizesPt: renderedTextSizesPt(core.renderSvg(core.forView(e, view)), 72 / 25.4),
    gridPitchMm: [e.document.unitCm * 10],
    tableRowHeightsMm: [],
    answerLineLengthsMm: [],
  });
}
