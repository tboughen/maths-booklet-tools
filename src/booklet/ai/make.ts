import type { Booklet, Lesson } from "../../../packages/resource-core/src/index";
import { runJob } from "../../worksheet/ai/run";
import { MakerError, addUsage, noUsage, type Effort, type Provider, type Stage, type Usage } from "../../worksheet/ai/types";
import type { SchoolMethod } from "../../worksheet/ai/scheme";
import { lessonChangeRequest, lessonJob, lessonRequest, planJob, planRequest, type BookletBrief, type BookletPlan } from "./brief";

export type LessonStatus = { title: string; state: "waiting" | "writing" | "checking" | "fixing" | "done" | "failed"; chars?: number; error?: string };
export interface Progress {
  phase: "planning" | "lessons" | "done";
  lessons: LessonStatus[];
}

export interface MakeOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  effort: Effort;
  signal?: AbortSignal;
  onUsage?: (usage: Usage, model: string) => void;
}

/** Lessons written at once after the first. The first runs alone so the rest read its cached prompt. */
const PARALLEL = 3;

function statusFrom(stage: Stage, s: LessonStatus): LessonStatus {
  if (stage.kind === "writing") return { ...s, state: "writing", chars: stage.chars };
  if (stage.kind === "checking") return { ...s, state: "checking" };
  if (stage.kind === "fixing") return { ...s, state: "fixing" };
  return { ...s, state: "writing" };
}

/** A lesson that could not be made keeps its place, its plan and the reason, so it can be rebuilt. */
export function placeholderLesson(p: { title: string; code: string; objective: string; keyIdea: string; plan: string }, reason: string): Lesson {
  return {
    title: p.title,
    code: p.code,
    objective: p.objective,
    keyIdea: p.keyIdea,
    teacherNotes: p.plan,
    sections: [{ kind: "notes", title: "Not made yet", instruction: "", columns: 1, cards: [{ title: "This lesson still needs making", items: [{ type: "text", text: `${reason} Choose this lesson under Ask for a change and press Rebuild lesson.` }] }] }],
  };
}
export const isPlaceholder = (l: Lesson) => l.sections.length === 1 && l.sections[0].kind === "notes" && l.sections[0].title === "Not made yet";

export interface Made {
  booklet: Booklet;
  plan: BookletPlan;
  flags: string[];
  usage: Usage;
  failed: number;
  model: string;
}

/** Plans the unit, then writes every lesson. Progress is reported after each step. */
export async function makeBooklet(o: MakeOptions, brief: BookletBrief, onProgress: (p: Progress) => void): Promise<Made> {
  const usage = noUsage();
  const progress: Progress = { phase: "planning", lessons: [] };
  const report = () => onProgress(structuredClone(progress));
  report();
  const planned = await runJob(o.provider, planJob, { ...o, request: planRequest(brief), onUsage: (u, m) => (addUsage(usage, u), o.onUsage?.(u, m)) });
  const plan = planned.value;
  let model = planned.model;
  progress.phase = "lessons";
  progress.lessons = plan.lessons.map((l) => ({ title: l.title, state: "waiting" }));
  report();

  const lessons: Lesson[] = new Array(plan.lessons.length);
  const flags: string[] = plan.flags.trim() ? [`Plan: ${plan.flags.trim()}`] : [];
  let failed = 0;
  const one = async (i: number) => {
    const p = plan.lessons[i];
    try {
      const r = await runJob(o.provider, lessonJob, {
        ...o,
        request: lessonRequest(plan, i, brief),
        onStage: (s) => {
          progress.lessons[i] = statusFrom(s, progress.lessons[i]);
          report();
        },
        onUsage: (u, m) => (addUsage(usage, u), o.onUsage?.(u, m)),
      });
      model = r.model;
      lessons[i] = { ...r.value.lesson, teacherNotes: r.value.lesson.teacherNotes.trim() || p.plan };
      if (r.value.flags.trim()) flags.push(`Lesson ${i + 1}: ${r.value.flags.trim()}`);
      progress.lessons[i] = { ...progress.lessons[i], state: "done" };
    } catch (e) {
      if (o.signal?.aborted) throw e;
      failed++;
      const reason = e instanceof Error ? e.message : String(e);
      lessons[i] = placeholderLesson(p, reason);
      progress.lessons[i] = { ...progress.lessons[i], state: "failed", error: reason };
    }
    report();
  };
  await one(0);
  let next = 1;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, plan.lessons.length - 1) }, async () => {
      while (next < plan.lessons.length) await one(next++);
    }),
  );
  if (failed === plan.lessons.length) throw new MakerError(`No lesson could be made. ${progress.lessons[0].error ?? ""}`.trim());
  progress.phase = "done";
  report();
  const booklet: Booklet = {
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "booklet-a4",
      title: plan.title || brief.title,
      code: brief.code,
      group: brief.group,
      coverNote: plan.coverNote,
      nameLine: true,
      notation: "maths",
      intro: plan.intro,
      lessons,
    },
  };
  return { booklet, plan, flags, usage, failed, model };
}

/** The unit plan as the booklet now holds it: lesson plans live in each lesson's teacher notes. */
export function planFromBooklet(b: Booklet): BookletPlan {
  const d = b.document;
  return {
    plan: "",
    flags: "",
    title: d.title,
    coverNote: d.coverNote,
    intro: d.intro ?? { remember: [], learn: [], next: [], keywords: [] },
    lessons: d.lessons.map((l) => ({ title: l.title, code: l.code, objective: l.objective, keyIdea: l.keyIdea, plan: l.teacherNotes || `Teach ${l.objective || l.title}.` })),
  };
}

/** Rewrites one lesson from its plan (a fresh start) or changes it as asked. */
export async function remakeLesson(
  o: MakeOptions & { onStage?: (s: Stage) => void },
  booklet: Booklet,
  index: number,
  change: string | null,
  context: string,
  methods?: SchoolMethod[],
) {
  const lesson = booklet.document.lessons[index];
  const request = change === null ? lessonRequest(planFromBooklet(booklet), index, { group: booklet.document.group, context, methods }) : lessonChangeRequest(lesson, index, change);
  const r = await runJob(o.provider, lessonJob, { ...o, request });
  return { lesson: { ...r.value.lesson, teacherNotes: r.value.lesson.teacherNotes.trim() || lesson.teacherNotes }, flags: r.value.flags, usage: r.usage, model: r.model, attempts: r.attempts };
}
