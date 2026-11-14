import { z } from "zod";
import { cardSchema, resolveCard, text, type Card } from "./schema";

/**
 * An A4 portrait unit booklet in reading order, the shape of the department's lesson booklets
 * (A07 and its siblings): a cover with contents, an optional unit introduction, then one lesson
 * per objective. Each lesson opens on a new page with its key idea, then runs through sections:
 * check-in, worked example beside "your turn", practice, mini-whiteboard diagnostics, spot the
 * mistake and a challenge. Sections hold the same question cards as worksheets, so every item
 * type, diagram family and answer state means exactly what it means on an A3 sheet.
 *
 * Pages are computed: the renderer paginates, never splits a card and never shrinks text.
 */

export const SECTION_KINDS = ["check-in", "worked", "practice", "diagnostic", "mistake", "challenge", "discover", "notes"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Default headings, so a section needs only its kind. */
export const SECTION_TITLES: Record<SectionKind, string> = {
  "check-in": "Check in",
  worked: "Worked example",
  practice: "Practice",
  diagnostic: "Diagnostic questions",
  mistake: "Spot the mistake",
  challenge: "Challenge",
  discover: "What do you notice?",
  notes: "Notes",
};
/** Sections whose cards are not numbered questions: worked pairs and notes. */
export const UNNUMBERED: ReadonlySet<SectionKind> = new Set(["worked", "notes"]);

export const sectionSchema = z
  .object({
    kind: z.enum(SECTION_KINDS),
    /** Printed heading; empty uses the kind's default ("Check in", "Practice"…). */
    title: text(60).default(""),
    /** One short line under the heading, e.g. "Answer on your mini whiteboard." */
    instruction: text(160).default(""),
    /** 2 puts cards side by side in rows (worked example | your turn, pairs of short questions). */
    columns: z.union([z.literal(1), z.literal(2)]).default(1),
    cards: z.array(cardSchema).min(1).max(16),
  })
  .strict();

export const lessonSchema = z
  .object({
    title: text(80),
    /** Objective code such as A7.03; may be empty. */
    code: text(16).default(""),
    objective: text(200).default(""),
    /** The lesson's one or two sentence big idea, printed in a key-idea card under the title. */
    keyIdea: text(500).default(""),
    sections: z.array(sectionSchema).min(1).max(12),
    /** Teacher-facing plan: purpose, misconceptions, how support fades. Never printed. */
    teacherNotes: z.string().max(6000).default(""),
  })
  .strict();

const keyword = z.object({ word: text(40), meaning: text(160) }).strict();

export const introSchema = z
  .object({
    /** Prior learning pupils should recall. */
    remember: z.array(text(120)).max(8).default([]),
    /** What the unit teaches. */
    learn: z.array(text(120)).max(8).default([]),
    /** Where it leads next. */
    next: z.array(text(120)).max(8).default([]),
    keywords: z.array(keyword).max(16).default([]),
  })
  .strict();

export const bookletSchema = z
  .object({
    tool: z.literal("resource"),
    schemaVersion: z.literal(1),
    document: z
      .object({
        kind: z.literal("booklet-a4"),
        title: text(80),
        /** Unit code such as A7; may be empty. */
        code: text(16).default(""),
        /** Year group or tier, printed on the cover. */
        group: text(40).default(""),
        /** One or two lines on the cover: equipment and how to use the booklet. */
        coverNote: text(240).default(""),
        nameLine: z.boolean().default(true),
        /**
         * plain (saved booklets from before, and the default): text prints as typed. maths: {3/4}
         * prints as a stacked fraction, and as a native equation in Word, as on worksheets.
         * Typed maths also prints as a paper prints it (typeset.ts).
         */
        notation: z
          .enum(["plain", "maths"])
          .default("plain")
          .describe("maths (every new booklet): {3/4} prints as a stacked fraction, and typed maths prints as on a paper (x^2 as x², a true minus, <= as ≤, sqrt as √, pi as π, letters used as maths in italic). plain: text prints as typed."),
        /** The unit introduction page, or null for none. */
        intro: introSchema.nullable().default(null),
        lessons: z.array(lessonSchema).min(1).max(12),
      })
      .strict()
      .describe("The booklet: cover fields, an optional unit introduction and the lessons in order."),
  })
  .strict();

export type Booklet = z.infer<typeof bookletSchema>;
export type BookletDocument = Booklet["document"];
export type Lesson = z.infer<typeof lessonSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Intro = z.infer<typeof introSchema>;

export const sectionTitle = (s: Pick<Section, "kind" | "title">) => s.title.trim() || SECTION_TITLES[s.kind];

export function isBooklet(input: unknown): boolean {
  return (input as { document?: { kind?: unknown } } | null)?.document?.kind === "booklet-a4";
}

/** Parses a booklet and builds any diagram specs into envelopes. Throws with the first problem's path. */
export function validateBooklet(input: unknown): Booklet {
  const r = bookletSchema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw Error(`${issue.path.join(".") || "booklet"}: ${issue.message}`);
  }
  return resolveBookletDiagrams(r.data);
}

export const resolveLesson = (lesson: Lesson): Lesson => ({ ...lesson, sections: lesson.sections.map((s) => ({ ...s, cards: s.cards.map(resolveCard) })) });

export function resolveBookletDiagrams(b: Booklet): Booklet {
  return { ...b, document: { ...b.document, lessons: b.document.lessons.map(resolveLesson) } };
}

/** Every card of a lesson with its section, for editors and checks. */
export function lessonCards(lesson: Lesson): { section: number; card: number; value: Card }[] {
  return lesson.sections.flatMap((s, si) => s.cards.map((c, ci) => ({ section: si, card: ci, value: c })));
}
