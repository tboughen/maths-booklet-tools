import data from "./performance-data.json" with {type: "json"};
import type { BankCatalogue, BankQuestion } from "./model";

export interface QuestionPerformance { percentage: number; kind: "measured" | "estimated" }
interface SourceScore { percentage: number; marks: number }
const scores: Record<string, SourceScore> = data.scores;
const paperCounts: Record<string, number> = data.paperQuestionCounts;
export const originalPaperCount = (paperId: string): number | undefined => paperCounts[paperId];

export function estimatePercentage(position: number, curve: {position: number; percentage: number}[]): number | undefined {
  if (!Number.isFinite(position) || !curve.length) return undefined;
  if (position <= curve[0].position) return curve[0].percentage;
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i-1], right = curve[i];
    if (position <= right.position) return left.percentage + (right.percentage-left.percentage)*(position-left.position)/(right.position-left.position);
  }
  return curve[curve.length-1].percentage;
}

export function performanceFor(question: BankQuestion, count = paperCounts[question.paperId]): QuestionPerformance | undefined {
  const measured = scores[`${question.paperId}/${question.number}`];
  if (measured && measured.marks === question.marks) return {kind: "measured", percentage: measured.percentage};
  if (!Number.isInteger(count) || count < 1 || question.number < 1 || question.number > count) return undefined;
  const percentage = estimatePercentage(count === 1 ? .5 : (question.number-1)/(count-1), data.curves[question.tier]);
  return percentage === undefined ? undefined : {kind: "estimated", percentage};
}

/** Enrich in memory; published questions, mappings and assets remain untouched. */
export function withPerformance(catalogue: BankCatalogue): BankCatalogue {
  return {...catalogue, questions: catalogue.questions.map(question => ({...question, performance: performanceFor(question, catalogue.paperQuestionCounts?.[question.paperId] ?? paperCounts[question.paperId])}))};
}

export function compareAccessibility(a: BankQuestion, b: BankQuestion): number {
  if (a.tier !== b.tier) return a.tier === "F" ? -1 : 1;
  const first = a.performance?.percentage, second = b.performance?.percentage;
  if (first === undefined && second !== undefined) return 1;
  if (first !== undefined && second === undefined) return -1;
  return (first !== undefined && second !== undefined ? second-first : 0) || a.order-b.order || a.id.localeCompare(b.id);
}

const stops = [[250,218,221],[251,227,207],[255,240,194],[229,238,207],[211,238,219]];
export function percentageColour(percentage: number): string {
  const position = Math.max(0, Math.min(100, percentage))/25;
  const i = Math.min(3, Math.floor(position)), fraction = position-i;
  return `rgb(${stops[i].map((value,j) => Math.round(value+(stops[i+1][j]-value)*fraction)).join(", ")})`;
}
