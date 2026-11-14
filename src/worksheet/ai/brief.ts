import { z } from "zod";
import guide from "../../../docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md?raw";
import { resolveDiagrams, resourceSchema, type Resource } from "../../../packages/resource-core/src/index";
import { familiesFor, familyNotes } from "./families";
import { treeDiagrams } from "../../../packages/resource-core/src/fixtures";

/** What the teacher asks for. Only the objective is required. */
export interface Brief {
  code: string;
  objective: string;
  /** Year group or tier, printed top right. */
  group: string;
  /** Class context, prior teaching, calculator use, anything else. */
  context: string;
}

export const TOOL_NAME = "submit_worksheet";

const submission = z
  .object({
    plan: z
      .string()
      .max(6000)
      .describe(
        "Teacher-facing PLAN, written first: prerequisites, the insight pupils should notice, likely misconceptions, and for each strand column what changes, what support is kept or removed, and the independent check. Never printed.",
      ),
    flags: z
      .string()
      .max(2000)
      .describe("Anything the teacher must decide or check: assumptions made, ambiguities, content that would not fit. Empty when there is nothing."),
    resource: resourceSchema,
  })
  .strict();
export type Submission = z.infer<typeof submission>;

export function parseSubmission(input: unknown): Submission {
  const r = submission.safeParse(input);
  if (!r.success) {
    const lines = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
    throw new SubmissionError(lines.join("\n"));
  }
  const revealing = revealingSettings(r.data.resource);
  if (revealing.length)
    throw new SubmissionError(
      `${revealing.slice(0, 4).join("; ")}: pupil diagrams must not show worked answers. Remove these settings and keep the answers blank or hidden.`,
    );
  // Diagrams written as specs are built into envelopes now, so the page only ever holds envelopes.
  try {
    const resource = resolveDiagrams(r.data.resource);
    // New worksheets share a column's spare height between its cards as working room.
    resource.document.spareSpace ??= "share";
    return { ...r.data, resource };
  } catch (e) {
    throw new SubmissionError(e instanceof Error ? e.message : String(e));
  }
}
export class SubmissionError extends Error {}

/** Spec settings that would print a worked answer on the pupil copy. Saved envelopes are left alone. */
const REVEALING = /^(worked[A-Za-z]*|calculate|answerVisible)$/;
function revealingSettings(resource: Resource): string[] {
  const found: string[] = [];
  const scan = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}.${i}`));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (REVEALING.test(k) && v !== false && v !== undefined && v !== null) found.push(`${path}.${k}`);
        else scan(v, `${path}.${k}`);
      }
  };
  resource.document.sides.forEach((side, s) => side.columns.forEach((column, c) => column.cards.forEach((card, k) => {
    const visit = (item: { type: string; items?: unknown[]; diagram?: { tool: string; spec?: unknown } }, path: string) => {
      if (item.type === "diagram" && item.diagram?.spec !== undefined) scan(item.diagram.spec, `${path}.diagram.spec`);
      if (item.type === "part") (item.items ?? []).forEach((child, i) => visit(child as never, `${path}.items.${i}`));
    };
    card.items.forEach((item, i) => visit(item as never, `sides.${s}.columns.${c}.cards.${k}.items.${i}`));
  })));
  return found;
}

/** JSON Schema for the one tool the model calls. Built once; identical bytes on every request keep the prompt cache warm. */
export const toolSchema: Record<string, unknown> = (() => {
  const s = z.toJSONSchema(submission, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete s.$schema;
  return s;
})();

export const toolDescription =
  "Submit the finished two-sided A3 worksheet (the PRODUCE step) with its teacher-facing plan. " +
  "The page checks the schema and the layout. If anything is wrong it replies with the exact problems; fix them and submit the whole worksheet again.";

const HOUSE = `
You make maths worksheets for MathsDock, a staff-only website for a secondary school maths department in England.

# What you produce
One two-sided A3 landscape worksheet in the MathsDock house style. The page renders it; you supply its content as JSON through the ${TOOL_NAME} tool. You never draw, format or lay out anything yourself.

- Exactly two sides. Each side has exactly three strand columns. Each column heading names a stage of the progression (for example "Read and compare", "Complete paired bars", "Organise and interpret"), so a teacher can see the fading at a glance.
- About 10 to 12 numbered question cards in total. Numbering is automatic and continues across both sides. Each card has a short title (a few words).
- Fade support within the sheet: partly completed structures first, then fewer givens, then none; checking a claim or another pupil's work; an open extension last.
- Body text is 11 pt and never shrinks. A column that is too full is reported to you with the millimetres needed: then move a card to another column, trim wording, or reduce working space. Never cut a question the plan needs just to make it fit; say so in flags instead.
- Leave real room for working: "space" items with kind "working" for calculations and "drawing" for sketches and charts, sized for the work pupils actually do (typically 20 to 60 mm).
- Use "info" items for shared information and key facts (a pale card), "claim" for a statement a pupil made that others check, "choice" for circle-one or tick-one, "answerLine" for a final answer with prefix and unit, "table" for data tables, "part" for lettered parts a, b, c.
- Diagrams: "diagram" items are MathsDock diagrams, written as {"tool": kind, "spec": {...}} and built by the page. Each request lists the diagram families suited to it with their spec schemas; use only those, following the schema exactly. To keep an existing diagram unchanged, keep its {"tool", "envelope"} exactly as it is. Prefer a pre-drawn diagram with blanks over describing a diagram in words. A blank set of axes for pupils to draw on is a "space" item of kind "drawing". Pupil diagrams never use worked, calculate or answerVisible settings: leave answers blank or hidden so they print only in the answers copy.
- Plain Unicode text only, with **bold** and *italic* as the only marks. Write maths with Unicode (×, ÷, −, ², √, ≤). No HTML, no LaTeX.
- Fractions always print stacked: on a new worksheet set document.notation to "maths" (keep a sheet's existing notation when changing it) and write every fraction as {3/4} (a mixed number as 2{1/2}, algebra as {x/2}) in question text, options, steps, bullets, claims and parts. Never write 1/2 or ½ there. With notation "maths" an answer line's prefix, suffix and saved answer stack too: 1/3, 2 1/2 and 2½ there print stacked. Table cells, circle-one options and headings cannot stack: an exact fractional value there stays a fraction typed as 3/4, never a decimal, and where it reads as well, put the fraction in the question text instead.

# Answers and blanks
- Pupil blanks, answer lines and hidden answers are different states. A table cell is "supplied" (printed), "blank" (an empty box) or "hidden" (an empty box whose saved answer prints only on the teacher's answers copy).
- Put the correct answer in hidden cells, answerLine.answer and choice.answer wherever the answer is a single definite value, so the teacher's answers copy is useful. Check each answer carefully. Leave them empty for open questions.
- Never put an answer where pupils will see it, except deliberately supplied worked examples or scaffold entries.

# How to work
Follow the guide's three stages, all inside this one turn, without stopping to ask:
1. PLAN: work out prerequisites, the insight, misconceptions and the progression across the six columns. Write this teacher-facing plan into the "plan" field.
2. FINALISE: decide the exact pupil wording, numbers, which entries are supplied or blank, and every diagram's content. Check every question mathematically, including distractors and claims.
3. PRODUCE: call ${TOOL_NAME} once with the plan, any flags, and the complete worksheet.
Use the teacher's objective code exactly; it names the file. If the teacher gave no code, leave code empty. State minor assumptions in flags rather than asking.

When you are asked to change an existing worksheet, change only what the request needs and keep everything else exactly as it is, including saved answers and blank states. Then submit the whole revised worksheet.

# The Maths Resource Design Guide
Apply the relevant sections of this guide. Where it mentions PDFs, file links or ChatGPT steps, the page handles production for you.

<guide>
${guide}
</guide>

# Example of a finished worksheet (another objective; do not copy its content)
${JSON.stringify(treeDiagrams)}
`.trim();

/** Stable instructions: identical on every request so providers can cache them. */
export const systemPrompt = HOUSE;

export function firstRequest(b: Brief): string {
  const lines = [
    `Make the worksheet.`,
    ``,
    `Objective code: ${b.code.trim() || "(none)"}`,
    `Learning objective: ${b.objective.trim()}`,
    `Year or tier: ${b.group.trim() || "(not given)"}`,
  ];
  if (b.context.trim()) lines.push(`Teacher's notes: ${b.context.trim()}`);
  lines.push("", familyNotes(familiesFor(`${b.objective} ${b.context}`)));
  return lines.join("\n");
}

export function changeRequest(current: Resource, request: string): string {
  return [
    `Here is the current worksheet. Revise it as the teacher asks, then submit the whole revised worksheet.`,
    ``,
    `<current_worksheet>`,
    JSON.stringify(current),
    `</current_worksheet>`,
    ``,
    `Teacher's request: ${request.trim()}`,
    ``,
    familyNotes(familiesFor(`${current.document.objective} ${request}`, current)),
  ].join("\n");
}
