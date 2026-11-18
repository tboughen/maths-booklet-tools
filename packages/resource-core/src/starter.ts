import { z } from "zod";
import { cardSchema, resolveCard, text } from "./schema";
import { withFields } from "../../envelope-core/src/errors";

/**
 * A run of silent starters: up to six short starter sheets that pupils do as they come in, printed
 * as an A5 landscape card, two to a sheet of A4, cut in half and stuck in their books
 * (docs/tools/SILENT-STARTER-TOOL.md). Every starter in a run has the same slots: question 3 is
 * the same type of question in each one, and only its numbers or difficulty move a little from
 * starter to starter. Questions use the same cards as worksheets and booklets, so every item type,
 * diagram family and answer state means what it means there.
 */

/**
 * four: four questions, two by two (the Year 7 and 8 template).
 * six: six questions in three columns (Key Stage 4).
 * core-extension: six questions in three columns, the third column (questions 5 and 6) marked
 * as extension with a thick bar, a label band and a grey tint (Tim's choice C, 18 Nov 2026).
 */
export const STARTER_TEMPLATES = ["four", "six", "core-extension"] as const;
export type StarterTemplate = (typeof STARTER_TEMPLATES)[number];
export const SLOT_COUNT: Record<StarterTemplate, number> = { four: 4, six: 6, "core-extension": 6 };
/** Slots that print as extension questions: the third column of the core-extension template. */
export const isExtensionSlot = (template: StarterTemplate, slot: number) => template === "core-extension" && slot >= 4;

/** The small question-type icons printed in a slot's corner, as on Tim's Year 8 starters. */
export const STARTER_ICONS = ["none", "pencil", "talk", "book", "puzzle"] as const;
export type StarterIcon = (typeof STARTER_ICONS)[number];

/** Runs of starters are six long (Tim, 18 Nov 2026). */
export const RUN_LENGTH = 6;

export const slotSchema = z
  .object({
    /** The question type, for the editor and the AI, e.g. "Multiply fractions". Not printed. */
    name: text(40).default(""),
    /** The icon printed in the slot's bottom-right corner, or none. */
    icon: z.enum(STARTER_ICONS).default("none"),
  })
  .strict();

export const starterSchema = z
  .object({
    /** One question card per slot, in slot order. The card title is the question's instruction. */
    cards: z.array(cardSchema).min(4).max(6),
  })
  .strict();

/** The logo's bytes start and end as a whole PNG (signature, IEND) or JPEG (FFD8FF, FFD9) does, so a damaged upload is caught when saved, not at export. */
function imageIsWhole(url: string): boolean {
  const m = url.match(/^data:image\/(png|jpeg);base64,(.*)$/);
  if (!m) return true; // the format message above covers it
  let bin: string;
  try {
    bin = atob(m[2]);
  } catch {
    return false;
  }
  const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const head = bytes(bin.slice(0, 8)),
    tail = bytes(bin.slice(-12));
  if (m[1] === "png") return head.join() === "137,80,78,71,13,10,26,10" && bin.slice(-8, -4) === "IEND";
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff && tail[10] === 0xff && tail[11] === 0xd9;
}

/** A logo the teacher adds: a small PNG or JPEG kept inside the saved file, never in the repository. */
const logoSchema = z
  .string()
  .max(400_000)
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Use a PNG or JPEG image.")
  .refine(imageIsWhole, "The logo image is damaged or not the type it says. Add it again as a PNG or JPEG file.")
  .describe("A small PNG or JPEG data URL printed in the header's right corner.");

export const starterRunSchema = z
  .object({
    tool: z.literal("resource"),
    schemaVersion: z.literal(1),
    document: z
      .object({
        kind: z.literal("starter-run"),
        /** The run's name, for the editor and file names. The card itself always says "Silent starter". */
        title: text(80),
        /** Year group or class, for the editor and file names. Not printed. */
        group: text(40).default(""),
        /** Printed on the right of every starter's header, e.g. "Fractions and expanding". */
        topic: text(60).default(""),
        template: z.enum(STARTER_TEMPLATES),
        /** {3/4} prints as a stacked fraction and typed maths prints as on a paper. */
        notation: z.enum(["plain", "maths"]).default("maths"),
        slots: z.array(slotSchema).min(4).max(6),
        starters: z.array(starterSchema).min(1).max(RUN_LENGTH),
        logo: logoSchema.nullable().default(null),
      })
      .strict()
      .superRefine((d, ctx) => {
        const want = SLOT_COUNT[d.template];
        if (d.slots.length !== want) ctx.addIssue({ code: "custom", path: ["slots"], message: `The ${d.template} template has ${want} slots, not ${d.slots.length}.` });
        d.starters.forEach((s, i) => {
          if (s.cards.length !== d.slots.length) ctx.addIssue({ code: "custom", path: ["starters", i, "cards"], message: `Starter ${i + 1} has ${s.cards.length} questions; every starter in the run has one per slot (${d.slots.length}).` });
        });
      }),
  })
  .strict();

export type StarterRun = z.infer<typeof starterRunSchema>;
export type StarterRunDocument = StarterRun["document"];
export type Starter = z.infer<typeof starterSchema>;
export type StarterSlot = z.infer<typeof slotSchema>;

/**
 * The Year 7 and 8 slots: four question types, each with its icon. Tim will name the four types
 * later (18 Nov 2026); they match these icons in this order. Fill in the names here when he does.
 */
export const YEAR_7_8_SLOTS: readonly StarterSlot[] = [
  { name: "", icon: "pencil" },
  { name: "", icon: "talk" },
  { name: "", icon: "book" },
  { name: "", icon: "puzzle" },
];

/** The slots a new run of each template starts with. */
export function defaultSlots(template: StarterTemplate): StarterSlot[] {
  if (template === "four") return YEAR_7_8_SLOTS.map((s) => ({ ...s }));
  return Array.from({ length: SLOT_COUNT[template] }, () => ({ name: "", icon: "none" as const }));
}

export function isStarterRun(input: unknown): boolean {
  return (input as { document?: { kind?: unknown } } | null)?.document?.kind === "starter-run";
}

/** Parses a run of starters and builds any diagram specs into envelopes. Throws with the first problem's path. */
export function validateStarterRun(input: unknown): StarterRun {
  const r = starterRunSchema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw withFields(Error(`${issue.path.join(".") || "starter run"}: ${issue.message}`), r.error);
  }
  const d = r.data.document;
  return { ...r.data, document: { ...d, starters: d.starters.map((s) => ({ cards: s.cards.map(resolveCard) })) } };
}
