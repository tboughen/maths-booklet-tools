import { z } from "zod";
import guide from "../../../docs/content/MATHS-RESOURCE-DESIGN-GUIDE.md?raw";
import {
  BOOKLET_WIDTHS,
  introSchema,
  issuePlace,
  lessonSchema,
  renderBooklet,
  resolveLesson,
  text,
  type Booklet,
  type Lesson,
} from "../../../packages/resource-core/src/index";
import { exampleLessonSource } from "../../../packages/resource-core/src/booklet-fixtures";
import { familiesFor, familyNotes } from "../../worksheet/ai/families";
import type { DiagramKind } from "../../../packages/diagram-core/src/registry";
import type { Job } from "../../worksheet/ai/types";

/**
 * The booklet maker works in two kinds of request, so each stays small and cheap:
 *
 * 1. PLAN the unit once: the cover, the unit introduction and, for each lesson, its title, key
 *    idea and a teacher-facing lesson plan. No questions yet.
 * 2. Make each LESSON from its plan (FINALISE and PRODUCE in one turn). Lessons share one cached
 *    system prompt, run in parallel after the first, and a change to one lesson resends only it.
 *
 * The page checks every submission against the schema and the A4 layout and sends specific
 * problems back, exactly as the worksheet maker does.
 */

export interface BookletBrief {
  /** Unit code, e.g. A7. */
  code: string;
  title: string;
  group: string;
  /** The objectives to teach, one lesson each unless the plan merges or splits them. */
  objectives: { code: string; text: string }[];
  /** Class, prior teaching, lesson length, anything to include or avoid. */
  context: string;
  /** Whether to open with a check-in lesson on prerequisites, as the department's booklets do. */
  checkInLesson: boolean;
}

/* ---------------------------------------------------------------- shared house rules */

const HALF = Math.floor(BOOKLET_WIDTHS.half - 6);
const FULL = Math.floor(BOOKLET_WIDTHS.full - 6);

const STANDARD = `
# The standard every lesson meets
The department's best lesson booklet pages share one shape. Follow it unless the lesson plan gives a reason not to:

1. **Key idea**: one or two sentences that state the big idea and name the new vocabulary in **bold** ("The **gradient** tells us how far up a line goes for every 1 unit it goes right.").
2. **check-in** (columns 2): 3 to 5 short retrieval questions on exactly the prerequisites this lesson needs, plus a fill-in-the-blanks sentence using the key idea's vocabulary. Not new content.
3. **discover** (optional, when the insight is best noticed): a small set where only one thing changes ("Draw y = x + 1, y = 2x + 1, y = 3x + 1. What do you notice?") followed by an info item stating the generalisation.
4. **worked** (columns 2): a "Worked example" card beside an "Our turn" card. Same method, same representation, different numbers. The worked card shows every step with a steps item and the finished representation; the Our turn card keeps the same step labels with shortened text ("Perfect points.", "Triangle.") and leaves the work blank. Use two pairs (4 cards) when the method has a second case (for example a negative gradient).
5. **practice** titled "Your turn" (columns 2): 4 to 6 cards that mirror the worked example exactly: the same diagram family and size, the same blank table, the same answer line. The first card may carry a checklist item of the method's steps for pupils to tick.
6. **diagnostic** (columns 2, instruction "Answer on your mini whiteboard."): 4 hinge questions, each a choice item with mode "letters" and 3 or 4 options. Every wrong option comes from a named misconception in the plan. Save the correct answer.
7. **practice** titled "Practice": 6 to 10 cards that fade support: first with part of the structure given, then bare, then a changed presentation (a different scale, no grid, two points only, a context), then a reasoning item.
8. **mistake**: one or two cards. A named pupil (vary names) shows plausible wrong working as a claim item, then parts "Explain …'s mistake." with working space and "Find the correct …" with an answer line.
9. **challenge** (columns 1): one open or rich task that rewards noticing, with room to work.

Number of cards: about 20 to 30 per lesson, which prints as 4 to 7 A4 pages. Fewer, well-chosen questions beat many similar ones.

# Layout facts (A4 portrait, nothing ever shrinks)
- A card in a 2-column section is ${HALF} mm wide inside; a 1-column card is ${FULL} mm. Diagrams keep their real size: a coordinate grid is about 10.3 mm per square plus 12 mm for its axes, so a grid in a 2-column card is at most 7 squares across (for example negativeSquares 1, positiveSquares 5), and up to 15 squares across in a 1-column card. Grids are about as tall as they are wide; keep Your turn grids to 7 or 8 squares tall so two rows fit a page.
- Body text is 11 pt. A card taller than about 240 mm cannot fit a page: split it.
- Keep a question's diagram, table, working space and answer lines in its card. Pages, page numbers, numbering, contents and the cover are automatic.
- Spare height on a page goes to working and drawing spaces, so size them for the work itself (12 to 30 mm for a short calculation, 40 to 70 mm for drawing).

# Items
Cards hold items: "text"; "info" (a pale key-fact or generalisation card); "claim" (a pupil's statement others check); "bullets"; "steps" (a worked method, one step per line; empty labels print Step 1, Step 2…); "checklist" (boxes pupils tick as they work; never answers); "table" (cells "supplied", "blank" or "hidden"); "choice" (mode "letters" for hinge questions, "circle" or "tick"); "answerLine" (prefix, suffix, saved answer, inline for several on a row); "space" (kind "working" or "drawing", heightMm); "diagram"; "part" (lettered parts a, b, c holding further items).
- Movement and value tables are table items, so answers can be hidden: headings "*x* →" and "*y* ↑" for gradient movements, "*x*" then the values for a table of values with "*y*" as the first cell of the row below.
- Text is plain Unicode with **bold** and *italic* only. Variables are italic (*x*, *y*, *m*, *c*); use the true minus sign −, ×, ÷, ², √, ½, ⅓, ¾, ≤, ≥. No LaTeX or HTML.
- UK spelling and exam wording. Short sentences. No decorative text, no generic instructions repeated on every card.

# Answers and blanks
- Supplied, blank and hidden are different states. Put the correct answer in hidden cells, answerLine.answer and choice.answer whenever it is one definite value, so the teacher's answers copy is complete. Solve every question and check every answer, distractor and claim.
- Only worked examples and deliberate scaffolds show answers to pupils. Pupil diagrams never use worked, calculate or answerVisible settings.
- Diagrams are written {"type":"diagram","diagram":{"tool":"<kind>","spec":{...}}} using only the families listed in the request; the page builds and checks them. A blank grid for pupils to draw on is a diagram with no objects.
`.trim();

/* ---------------------------------------------------------------- lesson job */

export const LESSON_TOOL = "submit_lesson";
const lessonSubmission = z
  .object({
    flags: z.string().max(2000).describe("Anything the teacher must check or decide. Empty when there is nothing."),
    lesson: lessonSchema,
  })
  .strict();
export type LessonSubmission = { flags: string; lesson: Lesson };

const schemaOf = (s: z.ZodType) => {
  const json = z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
};
const lessonToolSchema = schemaOf(lessonSubmission);

export const lessonSystem = `
You write lessons for unit booklets on MathsDock, a staff-only website for a secondary school maths department in England. The page renders an A4 portrait booklet from your JSON; you never lay anything out yourself.

Each request gives one lesson's plan (from the unit plan) or an existing lesson to change. Write the complete lesson: decide the exact pupil wording, numbers, table entries, blanks and diagrams, check every question, then call ${LESSON_TOOL} once with the whole lesson. Put the lesson plan you were given, improved if you found problems, in teacherNotes. Do not stop to ask; state assumptions in flags.

${STANDARD}

# Choosing the questions
Apply the guide: start with the mathematics, choose numbers for a reason, use short chains where comparison reveals something, plan difficulty and fading separately, and make the relationship visible. Within a set, change one thing at a time on purpose. Avoid a disguised ladder of the same question with bigger numbers.

When asked to change a lesson, change only what the request needs and keep everything else exactly as it is, including saved answers, blank states and existing diagram envelopes ({"tool","envelope"} kept unchanged). Then submit the whole lesson.

# The Maths Resource Design Guide
<guide>
${guide}
</guide>

# Example of a lesson at the standard (another objective; do not copy its content)
${JSON.stringify(exampleLessonSource)}
`.trim();

/** One lesson as a booklet of its own, so it can be laid out and checked alone. */
function soloBooklet(lesson: Lesson): Booklet {
  return { tool: "resource", schemaVersion: 1, document: { kind: "booklet-a4", title: "Check", code: "", group: "", coverNote: "", nameLine: false, intro: null, lessons: [lesson] } };
}

const REVEALING = /^(worked[A-Za-z]*|calculate|answerVisible)$/;
function revealing(lesson: Lesson): string[] {
  const found: string[] = [];
  const scan = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => scan(v, `${path}.${i}`));
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (REVEALING.test(k) && v !== false && v !== undefined && v !== null) found.push(`${path}.${k}`);
        else scan(v, `${path}.${k}`);
      }
  };
  const visit = (item: { type: string; items?: unknown[]; diagram?: { spec?: unknown } }, path: string) => {
    if (item.type === "diagram" && item.diagram?.spec !== undefined) scan(item.diagram.spec, `${path}.diagram.spec`);
    if (item.type === "part") (item.items ?? []).forEach((c, i) => visit(c as never, `${path}.items.${i}`));
  };
  lesson.sections.forEach((s, si) =>
    s.cards.forEach((c, ci) => {
      // A worked example may show its answer; only pupil cards are checked.
      if (s.kind === "worked" && ci % 2 === 0) return;
      c.items.forEach((it, ii) => visit(it as never, `lesson.sections.${si}.cards.${ci}.items.${ii}`));
    }),
  );
  return found;
}

export function checkLesson(input: unknown): { ok: true; value: LessonSubmission } | { ok: false; feedback: string } {
  const r = lessonSubmission.safeParse(input);
  if (!r.success) {
    const lines = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
    return { ok: false, feedback: `The lesson does not match the schema. Fix these and submit the whole lesson again:\n${lines.join("\n")}` };
  }
  const shown = revealing(r.data.lesson);
  if (shown.length) return { ok: false, feedback: `${shown.slice(0, 4).join("; ")}: pupil diagrams must not show worked answers. Remove these settings and keep the answers blank or hidden, then submit again.` };
  let lesson: Lesson;
  try {
    lesson = resolveLesson(r.data.lesson);
  } catch (e) {
    return { ok: false, feedback: `A diagram could not be built: ${e instanceof Error ? e.message : String(e)}. Fix it and submit the whole lesson again.` };
  }
  const { issues } = renderBooklet(soloBooklet(lesson));
  if (issues.length) {
    const list = issues.map((i) => `- ${issuePlace({ ...i, page: undefined, lesson: 0 }) || "lesson"}: ${i.message}`).join("\n");
    return { ok: false, feedback: `The lesson does not fit the A4 pages yet. Text never shrinks. Narrow a diagram, move a card to a 1-column section, split a tall card or trim working space, keeping every planned question, then submit again:\n${list}` };
  }
  return { ok: true, value: { flags: r.data.flags, lesson } };
}

export const lessonJob: Job<LessonSubmission> = {
  system: lessonSystem,
  toolName: LESSON_TOOL,
  toolDescription:
    "Submit one complete lesson for the A4 booklet. The page checks the schema and the layout; if anything is wrong it replies with the exact problems: fix them and submit the whole lesson again.",
  toolSchema: lessonToolSchema,
  noun: "lesson",
  check: checkLesson,
};

/* ---------------------------------------------------------------- plan job */

export const PLAN_TOOL = "submit_booklet_plan";
const lessonPlan = z
  .object({
    title: text(80).describe("Short pupil-facing lesson title, e.g. 'Find the gradient of a line (positive)'."),
    code: text(16).describe("The objective code this lesson teaches, exactly as given; empty for a check-in lesson."),
    objective: text(200).describe("The full objective, exactly as given."),
    keyIdea: text(500).describe("One or two sentences stating the big idea, new vocabulary in **bold**."),
    plan: z
      .string()
      .max(3000)
      .describe(
        "Teacher-facing lesson PLAN: prerequisites the check-in retrieves; the insight; 2 to 4 named misconceptions (they become hinge distractors and the spot-the-mistake); the worked example and our-turn numbers; diagram families and sizes; how support fades through Your turn and Practice; the challenge.",
      ),
  })
  .strict();
const planSubmission = z
  .object({
    plan: z.string().max(4000).describe("Teacher-facing unit PLAN: the sequence and why, prior knowledge, where the unit leads."),
    flags: z.string().max(2000).describe("Assumptions or decisions for the teacher; empty when there is nothing."),
    title: text(80).describe("The unit title for the cover."),
    coverNote: text(240).describe("One or two short lines for the cover: equipment and how to use the booklet."),
    intro: introSchema,
    lessons: z.array(lessonPlan).min(1).max(12),
  })
  .strict();
export type BookletPlan = z.infer<typeof planSubmission>;
export type LessonPlan = BookletPlan["lessons"][number];

export const planSystem = `
You plan unit booklets for MathsDock, a staff-only website for a secondary school maths department in England. A booklet is A4 portrait: a cover with contents, a unit introduction page, then one lesson per objective. This request is the PLAN step only: no pupil questions yet. Each lesson will be written afterwards from your lesson plan, by a writer who sees only that plan, so make each plan specific and self-contained.

- Usually one lesson per objective, in a sensible teaching order. Merge two objectives only when they are one idea, and split one only when it is two; say so in flags.
- When asked for a check-in lesson, put it first: title "Check-in", empty code, the objective "Check the skills needed for this unit", and a plan covering each prerequisite with a short check-in and a short exercise.
- Unit introduction: "remember" lists prerequisite topics, "learn" what the unit teaches, "next" where it leads; 5 to 10 key words with short pupil-friendly meanings (italic variables, **bold** never needed there).
- Lesson plans follow the guide and the lesson standard below, so name the specific numbers, misconceptions and representations.
- Plain Unicode with **bold** and *italic* only. Use objective codes exactly as given.

Call ${PLAN_TOOL} once with the whole plan. Do not stop to ask.

${STANDARD}

# The Maths Resource Design Guide
<guide>
${guide}
</guide>
`.trim();

export const planJob: Job<BookletPlan> = {
  system: planSystem,
  toolName: PLAN_TOOL,
  toolDescription: "Submit the unit plan: cover fields, the unit introduction and a plan for every lesson. No pupil questions.",
  toolSchema: schemaOf(planSubmission),
  noun: "booklet plan",
  check(input) {
    const r = planSubmission.safeParse(input);
    if (!r.success) {
      const lines = r.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
      return { ok: false, feedback: `The plan does not match the schema. Fix these and submit again:\n${lines.join("\n")}` };
    }
    return { ok: true, value: r.data };
  },
};

/* ---------------------------------------------------------------- requests */

export function planRequest(b: BookletBrief): string {
  const lines = [
    "Plan the booklet.",
    "",
    `Unit: ${[b.code.trim(), b.title.trim()].filter(Boolean).join(" ") || "(not given)"}`,
    `Year or tier: ${b.group.trim() || "(not given)"}`,
    `Check-in lesson first: ${b.checkInLesson ? "yes" : "no"}`,
    "Objectives, in scheme order:",
    ...b.objectives.map((o) => `- ${o.code ? `${o.code}: ` : ""}${o.text}`),
  ];
  if (b.context.trim()) lines.push("", `Teacher's notes: ${b.context.trim()}`);
  return lines.join("\n");
}

const kindsFor = (text: string, lesson?: Lesson): DiagramKind[] => {
  const used = new Set<DiagramKind>();
  lesson?.sections.forEach((s) => s.cards.forEach((c) => JSON.stringify(c.items).replace(/"tool":"([a-z-]+)"/g, (_, k) => (used.add(k as DiagramKind), ""))));
  return [...new Set([...familiesFor(text), ...used])];
};

/** A request for one lesson, with just enough of the unit around it for consistent style. */
export function lessonRequest(plan: BookletPlan, index: number, brief: Pick<BookletBrief, "group" | "context">): string {
  const l = plan.lessons[index];
  const lines = [
    `Write lesson ${index + 1} of ${plan.lessons.length} of the booklet "${plan.title}".`,
    `Year or tier: ${brief.group.trim() || "(not given)"}`,
    `Unit sequence: ${plan.lessons.map((x, i) => `${i + 1}. ${x.title}`).join("; ")}`,
    `Key words in this unit: ${plan.intro.keywords.map((k) => k.word).join(", ") || "(none)"}`,
    "",
    `Title: ${l.title}`,
    `Objective code: ${l.code || "(none)"}`,
    `Objective: ${l.objective}`,
    `Key idea: ${l.keyIdea}`,
    `Lesson plan: ${l.plan}`,
  ];
  if (brief.context.trim()) lines.push(`Teacher's notes for the unit: ${brief.context.trim()}`);
  lines.push("", familyNotes(kindsFor(`${l.title} ${l.objective} ${l.plan}`)));
  return lines.join("\n");
}

export function lessonChangeRequest(lesson: Lesson, index: number, request: string): string {
  return [
    `Here is lesson ${index + 1} of the booklet. Revise it as the teacher asks, then submit the whole revised lesson.`,
    "",
    "<current_lesson>",
    JSON.stringify(lesson),
    "</current_lesson>",
    "",
    `Teacher's request: ${request.trim()}`,
    "",
    familyNotes(kindsFor(`${lesson.title} ${lesson.objective} ${request}`, lesson)),
  ].join("\n");
}

/** A rough cost guide before running: the plan plus each lesson, in tokens. */
export function estimateTokens(lessons: number): { input: number; output: number; cacheRead: number; cacheWrite: number } {
  const system = Math.round(lessonSystem.length / 3.6);
  const planSys = Math.round(planSystem.length / 3.6);
  return {
    input: planSys + lessons * 1200,
    // Thinking plus a lesson's JSON; the plan is smaller.
    output: 6000 + lessons * 14000,
    cacheRead: Math.max(0, lessons - 1) * system,
    cacheWrite: system,
  };
}
