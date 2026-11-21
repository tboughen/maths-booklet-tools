/** Pearson success rates per question part (public/bank/performance-parts.json, fetched on demand). */
export interface PartRecord { label: string; marks: number; percentage: number; ao: number | null; common: boolean; grades: Record<string, number> }
export interface PartPerformanceData { version: string; grades: Record<"F" | "H", string[]>; questions: Record<string, Record<string, PartRecord>> }

/** 'Q3bii', '7(b)(ii)' and 'bii' all give 'bii'; a whole question gives ''. */
export const partKey = (label: string): string => label.trim().toLowerCase().replace(/^q?\s*\d+/, "").replace(/[^a-z]/g, "");

/** The part's record when its marks agree with the bank; undefined for a whole question or a mismatch. */
export function partRecord(data: PartPerformanceData | undefined, paperId: string, number: number, label: string, marks: number): PartRecord | undefined {
  const key = partKey(label); if (!key || !data) return undefined;
  const record = data.questions[`${paperId}/${number}`]?.[key];
  return record && record.marks === marks ? record : undefined;
}

export function verifyPartPerformance(value: unknown): PartPerformanceData {
  const data = value as PartPerformanceData;
  if (!data || typeof data.version !== "string" || typeof data.questions !== "object" || !data.grades) throw new Error("Part success rates are not in the expected format.");
  return data;
}
