import { z } from "zod";
import { cardSchema, resolveCard, text, type Card } from "./schema";
import { withFields } from "../../envelope-core/src/errors";

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

/**
 * How a section labels its questions (booklet standard N1, Tim 17 November 2026). Every question in
 * a lesson has a label no other has:
 * - continue (the default): numbers run on from the last numbered section of the lesson, so a
 *   lesson has one run 1, 2, 3… through every cycle, mini whiteboard questions included;
 * - restart: numbers start again at 1;
 * - letters: A, B, C…, running on from the last lettered section (check in A to F, From earlier G
 *   and H). Parts of a lettered question print i), ii) so a label never mixes a letter and a number.
 */
export const NUMBERING = ["continue", "restart", "letters"] as const;
export type Numbering = (typeof NUMBERING)[number];

/** Most NCETM links a lesson may carry (Tim, 25 November 2026: one to three, optional extras). */
export const NCETM_LINKS_PER_LESSON = 3;

/** A link to an NCETM page, PDF page or Checkpoints slide: what the chip says, and where it goes. Links only; NCETM content is never copied. */
export const ncetmSchema = z
  .object({
    /** A few words naming the activity and where to look, e.g. "Checkpoint 10: Staircases (slide 31)". */
    label: text(60),
    url: z
      .string()
      .max(300)
      .refine((u) => {
        try {
          const url = new URL(u);
          return url.protocol === "https:" && (url.hostname === "www.ncetm.org.uk" || url.hostname === "ncetm.org.uk") && url.href === u;
        } catch {
          return false;
        }
      }, "Use an https://www.ncetm.org.uk/ address, written in full."),
  })
  .strict();
export type NcetmLink = z.infer<typeof ncetmSchema>;

export const sectionSchema = z
  .object({
    kind: z.enum(SECTION_KINDS),
    /** Printed heading; empty uses the kind's default ("Check in", "Practice"…). */
    title: text(60).default(""),
    /** One short line under the heading, e.g. "Answer on your mini whiteboard." */
    instruction: text(160).default(""),
    /** Shaded banner printed above the heading, e.g. "Part 1": marks where a teaching cycle starts (START on the right). */
    startBanner: text(60).default(""),
    /** Shaded banner printed after the section's last card, e.g. "End of part 1": marks where pupils stop (STOP on the right). */
    endBanner: text(60).default(""),
    /** 2 puts cards side by side in rows (worked example | your turn, pairs of short questions). */
    columns: z.union([z.literal(1), z.literal(2)]).default(1),
    /** Question labels: continue the lesson's run of numbers (default), restart at 1, or letters A, B, C… */
    numbering: z.enum(NUMBERING).default("continue"),
    /** An optional NCETM link for teachers (Tim, 25 November 2026): a small clickable chip at the right-hand end of the heading line, printed in the ANSWERS copy only (PDF and Word), never in the pupil copy. Used on a stage's first section or the Challenge, one to three a lesson. */
    ncetm: ncetmSchema.optional(),
    cards: z.array(cardSchema).min(1).max(16),
  })
  .strict();

export const lessonSchema = z
  .object({
    title: text(80),
    /** Objective code such as A7.03; may be empty. */
    code: text(16).default(""),
    /** The objective in full, for the editor, plans and the AI. Not printed: the title line says it once (N2). */
    objective: text(200).default(""),
    /** The lesson's big idea: one or two sentences, printed in a two-cell key-idea box under the title. A line break starts a new line. */
    keyIdea: z
      .string()
      .max(500)
      .refine((s) => ![...s].some((c) => c.charCodeAt(0) < 32 && c !== "\n"), "Use ordinary text without control characters; a line break starts a new line.")
      .default(""),
    /** A one-line "Did you know?" fact on the lesson's first side (BOOKLET-STANDARD N12): where this maths is used, or a surprising fact. Printed in a small bubble under the key idea; empty prints nothing. */
    didYouKnow: text(160).default(""),
    sections: z.array(sectionSchema).min(1).max(20),
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
    keywords: z.array(keyword).max(24).default([]),
  })
  .strict();

const retrievalItem = z.object({ question: text(160), answer: text(80) }).strict();

/**
 * The fold-over retrieval page at the back of a full unit booklet (BOOKLET-STANDARD N12, Tim 18
 * November 2026): short questions from across the unit with an answer line each, and the answers
 * in a strip beyond a dashed fold line. Pupils fold the strip back, answer, then unfold to check,
 * so the answers print in BOTH copies: that is the page's purpose, not a reveal.
 */
export const retrievalSchema = z
  .object({
    title: text(60).default("Fold and test yourself"),
    instruction: text(160).default("Fold the answers back along the dashed line. Answer each question, then unfold the page and check."),
    items: z.array(retrievalItem).min(1).max(20),
  })
  .strict();
export type Retrieval = z.infer<typeof retrievalSchema>;

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
         * What one part of the booklet is called, e.g. "Mock revision": the end band then says
         * "End of mock revision 1" and the contents list "Mock revision 1". Empty means "Lesson".
         */
        lessonName: text(30).default(""),
        /** The one word on the start tile and the corner badge above the number, e.g. "Revision". Empty uses the last word of the name. */
        lessonBadge: text(12).default(""),
        /**
         * plain (saved booklets from before, and the default): text prints as typed. maths: {3/4}
         * prints as a stacked fraction, and as a native equation in Word, as on worksheets.
         * Typed maths also prints as a paper prints it (typeset.ts).
         */
        notation: z
          .enum(["plain", "maths"])
          .default("plain")
          .describe("maths (every new booklet): {3/4} prints as a stacked fraction, and typed maths prints as on a paper (x^2 as x², a true minus, <= as ≤, sqrt as √, pi as π, letters used as maths in italic). plain: text prints as typed."),
        /** The unit introduction page, or null for none. Its key words are the unit's glossary (N12). */
        intro: introSchema.nullable().default(null),
        /** The printed number of the first lesson: 0 when a unit opens with a "get ready" lesson 0 of earlier skills. */
        firstLessonNumber: z.number().int().min(0).max(1).default(1),
        lessons: z.array(lessonSchema).min(1).max(16),
        /** The fold-over retrieval page printed last, or null for none (N12, full unit booklets). */
        retrieval: retrievalSchema.nullable().default(null),
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

/** The printed words for a lesson (badge word, full name, end band phrase); "Lesson" unless the booklet names its parts. */
export interface LessonWords {
  /** The word above the number on the start tile and the corner badge. */
  badge: string;
  /** The name before the number in the contents and the teaching notes, e.g. "Mock revision". */
  name: string;
  /** The end band's words before the number, e.g. "End of mock revision". */
  end: string;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Lower-case the first letter only when the word is an ordinary word (so "SATs" stays as typed). */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export function lessonWords(doc: { lessonName?: string; lessonBadge?: string }): LessonWords {
  const name = (doc.lessonName ?? "").trim().replace(/\s+/g, " ") || "Lesson";
  const badge = (doc.lessonBadge ?? "").trim() || capital(name.split(" ").pop() ?? name);
  return { badge, name, end: `End of ${lowerFirst(name)}` };
}
/** What is added to a lesson's place (1, 2, 3...) to give its printed number. */
export const lessonShift = (doc: { firstLessonNumber?: number }): number => (doc.firstLessonNumber ?? 1) - 1;
export const LESSON_WORDS: LessonWords = lessonWords({});

/** Letters A to Z, then AA, AB and so on. */
export const questionLetter = (k: number): string => (k < 26 ? String.fromCharCode(65 + k) : questionLetter(Math.floor(k / 26) - 1) + String.fromCharCode(65 + (k % 26)));

/** A question's printed label: a number, a letter, or null for worked and notes cards. */
export type QuestionLabel = number | string | null;

/** The label of every card in a lesson, section by section (N1): one run of numbers, one run of letters. */
export function lessonLabels(lesson: Pick<Lesson, "sections">): QuestionLabel[][] {
  let number = 0,
    letter = 0;
  return lesson.sections.map((s) => {
    if (UNNUMBERED.has(s.kind)) return s.cards.map(() => null);
    if (s.numbering === "letters") return s.cards.map(() => questionLetter(letter++));
    if (s.numbering === "restart") number = 0;
    return s.cards.map(() => ++number);
  });
}

export const sectionTitle = (s: Pick<Section, "kind" | "title">) => s.title.trim() || SECTION_TITLES[s.kind];

export function isBooklet(input: unknown): boolean {
  return (input as { document?: { kind?: unknown } } | null)?.document?.kind === "booklet-a4";
}

/** Parses a booklet and builds any diagram specs into envelopes. Throws with the first problem's path. */
export function validateBooklet(input: unknown): Booklet {
  const r = bookletSchema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw withFields(Error(`${issue.path.join(".") || "booklet"}: ${issue.message}`), r.error);
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
