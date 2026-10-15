import type { BankQuestion } from "../bank/model";

export type Strength = "developing" | "secure" | "strong";
export interface Profile { year: number; tier: "F" | "H"; strength: Strength }
export interface Settings extends Profile {
  pageLimit: 1 | 2 | 4 | 8 | null;
  marksLimit: number | null;
  calculator: "all" | "yes" | "no";
  common: boolean;
  /** Whole assessment labels (e.g. Q17); their mapped topics are excluded. */
  excludedQuestions?: string[];
}
export const defaults: Settings = { year: 10, tier: "H", strength: "secure", pageLimit: 4, marksLimit: null, calculator: "all", common: false };
export interface AssessmentItem { label: string; marks: number; codes: string[]; questionId?: string }
export interface Pupil { key: string; identifier: string; scores: Record<string, number | null>; profile: Partial<Profile> }
export interface ImportResult<T> { rows: T[]; warnings: string[] }
export interface TableSheet { name: string; rows: string[][] }
export interface Priority { code: string; weight: number; achieved: number; references: string[] }
export interface Practice { question: BankQuestion; references: string[]; codes: string[]; reason: string }
export interface Pack { pupil: Pupil; profile: Profile; entries: Practice[]; fallback: boolean; warnings: string[] }
export interface ClassPlan { packs: Pack[]; commonEntries: Practice[]; warnings: string[]; assessmentName?: string }
export function validateSettings(settings: Settings): void {
  if (!Number.isInteger(settings.year) || settings.year < 7 || settings.year > 13 || !["F", "H"].includes(settings.tier) || !["developing", "secure", "strong"].includes(settings.strength)) throw new Error("Choose a year from 7 to 13, examination tier and strength.");
  if (settings.pageLimit !== null && ![1, 2, 4, 8].includes(settings.pageLimit)) throw new Error("Choose 1, 2, 4 or 8 pages.");
  if (settings.marksLimit !== null && (!Number.isInteger(settings.marksLimit) || settings.marksLimit < 1 || settings.marksLimit > 200)) throw new Error("Enter a marks limit from 1 to 200.");
  if (settings.pageLimit === null && settings.marksLimit === null) throw new Error("Enable a page limit or a marks limit.");
}
