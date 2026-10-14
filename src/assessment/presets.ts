import data from "./presets-data.json";
import type { BankCatalogue } from "../bank/model";
import type { AssessmentItem } from "./types";

export interface AssessmentPreset {
  id: string; name: string; tier: "F" | "H"; group: "HPPs" | "Mini mocks" | "Exam papers" | "Mock papers";
  marks: number; sourcePaperId: string; items: AssessmentItem[]; parts: AssessmentItem[];
}
export const approvedPresets = data.presets as AssessmentPreset[];
// Full HPP papers reuse the approved complementary selections and source IDs.
// Spreadsheet columns follow the teaching sequence: odd HPP, then even HPP.
// Keep each selection's question and part order intact.
export const fullHppPresets: AssessmentPreset[] = [1, 3, 5].flatMap(first => (["F", "H"] as const).map(tier => {
  const left = approvedPresets.find(p => p.id === `HPP${first}_${tier}`)!;
  const right = approvedPresets.find(p => p.id === `HPP${first + 1}_${tier}`)!;
  const combine = (key: "items" | "parts") => [...left[key], ...right[key]];
  return { id: `HPP${first}-${first + 1}_${tier}`, name: `HPP${first}-${first + 1} — ${tier === "H" ? "Higher" : "Foundation"}`, tier, group: "HPPs", marks: left.marks + right.marks, sourcePaperId: left.sourcePaperId, items: combine("items"), parts: combine("parts") };
}));
export function assessmentPresets(catalogue: BankCatalogue): AssessmentPreset[] {
  const papers = [...new Set(catalogue.questions.map(q => q.paperId))].sort();
  const months: Record<string, string> = { JUN: "June", NOV: "November" };
  const standard = papers.map(id => {
    const questions = catalogue.questions.filter(q => q.paperId === id).sort((a, b) => a.number - b.number);
    const match = id.match(/^1MA1_(JUN|NOV)_(\d{4})_([123])([FH])$/), mock = id.match(/^1MA1_MOCK_SET_(\d+)_([123])([FH])$/);
    const tier = questions[0].tier, tierName = tier === "H" ? "Higher" : "Foundation";
    const name = match ? `${months[match[1]]} ${match[2]} — Paper ${match[3]} — ${tierName}` : mock ? `Mock set ${Number(mock[1])} — Paper ${mock[2]} — ${tierName}` : questions[0].source.replace(/ Q\d+.*$/, "");
    return { id, name, tier, group: mock ? "Mock papers" as const : "Exam papers" as const, marks: questions.reduce((n, q) => n + q.marks, 0), sourcePaperId: id,
      items: questions.map(q => ({ label: `Q${q.number}`, marks: q.marks, codes: q.codes, questionId: q.id })),
      parts: questions.flatMap(q => q.parts.map(p => ({ label: `Q${q.number}${p.label === "whole" || p.label === "" ? "" : p.label.replace(/^Q?\d+/, "")}`, marks: p.marks, codes: p.codes, questionId: q.id }))) };
  });
  return [...fullHppPresets, ...approvedPresets, ...standard];
}
export const presetSourceIds = new Set(approvedPresets.flatMap(p => p.items.map(i => i.questionId!)));
