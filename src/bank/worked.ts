// What a worked solution shows, and loading it. Light: the renderer (packages/worked-core) and the
// handwriting font are only fetched when a teacher first opens a worked solution.
import type { BankQuestion, BankView } from "./model";
import type { ServedParts } from "./cuts";
import type { SurfaceOverlay } from "../../packages/worked-core/src/index";

/** One cut (or question view, for an uncut question) the working is drawn over. */
export interface WorkedItem { pdf: string; view: BankView }
export interface WorkedPlan {
  items: WorkedItem[];
  /** The "Total for Question" line, added under a whole cut question (its cuts leave it out). */
  total?: { question: number; marks: number };
}
export interface WorkedShown { items: (WorkedItem & { overlay?: SurfaceOverlay })[]; steps: number; issues: string[] }

/**
 * The surfaces to draw: the served parts' cuts in part view (each part keeps only its own marks),
 * otherwise every cut of the question with its total underneath, or the question's own views.
 */
export function workedPlan(question: BankQuestion, served: ServedParts | undefined): WorkedPlan {
  if (served) return { items: served.cuts.flatMap(s => s.cut.views.map(view => ({ pdf: s.cut.pdf, view }))) };
  if (question.cuts?.length) return {
    items: question.cuts.flatMap(cut => cut.views.map(view => ({ pdf: cut.pdf, view }))),
    total: { question: question.number, marks: question.marks },
  };
  return { items: question.questionViews.map(view => ({ pdf: question.questionPdf, view })) };
}

/** Points the overlay adds to a surface: room inside the cut and the total line below it. */
export const addedHeight = (overlay: SurfaceOverlay | undefined) => overlay ? overlay.bands.reduce((n, b) => n + b.size, 0) + overlay.footer : 0;

export interface WorkedOptions { marks?: boolean; upTo?: number }

/** Fetches, checks and lays out a question's worked solution over the planned surfaces. */
export async function loadWorked(question: BankQuestion, plan: WorkedPlan, options: WorkedOptions = {}): Promise<WorkedShown> {
  const { layoutQuestionWorked } = await import("./workedRender");
  return layoutQuestionWorked(question, plan, options);
}
