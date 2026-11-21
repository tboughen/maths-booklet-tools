import type { BankCatalogue } from "../bank/model";
import { questionLabel } from "./import";
import { sourceRate } from "./select";
import type { AssessmentItem, Pupil } from "./types";

/** Results for one class (or the whole sheet) on one question or topic. */
export interface GroupResult { pupils: number; percentage: number; gap?: number }
export interface QuestionAnalysis { label: string; marks: number; codes: string[]; national?: number; groups: Record<string, GroupResult> }
export interface TopicAnalysis { code: string; title: string; strand: string; marks: number; national?: number; groups: Record<string, GroupResult>; evidence: "enough" | "little" }
export interface ResultsAnalysis { groups: string[]; questions: QuestionAnalysis[]; topics: TopicAnalysis[]; strands: TopicAnalysis[]; themes: Record<string, string[]> }

export const ALL_GROUPS = "All pupils";
/**
 * Marks of evidence per pupil below which a topic is shown but not called a
 * theme. One paper gives most Sparx codes only 1 to 3 marks, so themes are
 * pointers to check, and the strand rows carry the firmer evidence.
 */
export const MIN_TOPIC_MARKS = 2;

/**
 * Compare each class with the national success rate, question by question, then
 * pool the gaps by Sparx code weighted by marks. Class-level figures only: no
 * pupil identifier appears in the result.
 */
export function analyseResults(catalogue: BankCatalogue, items: AssessmentItem[], pupils: Pupil[]): ResultsAnalysis {
  const named = [...new Set(pupils.map(p => p.group).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const groups = named.length > 1 ? [ALL_GROUPS, ...named] : [ALL_GROUPS];
  const members = (group: string) => group === ALL_GROUPS ? pupils : pupils.filter(p => p.group === group);
  const questions: QuestionAnalysis[] = items.map(item => {
    const national = sourceRate(item, catalogue), key = questionLabel(item.label), result: Record<string, GroupResult> = {};
    for (const group of groups) {
      const scores = members(group).map(p => p.scores[key]).filter((s): s is number => s !== null && s !== undefined);
      if (!scores.length) continue;
      const percentage = 100 * scores.reduce((a, b) => a + b, 0) / (scores.length * item.marks);
      result[group] = { pupils: scores.length, percentage, ...(national !== undefined ? { gap: percentage - national } : {}) };
    }
    return { label: item.label, marks: item.marks, codes: item.codes, ...(national !== undefined ? { national } : {}), groups: result };
  });
  const titles = new Map(catalogue.topics.map(t => [t.code, t]));
  const strandOf = (code: string) => titles.get(code)?.strand || "Other";
  const aggregate = (keys: string[], keyOf: (code: string) => string, label: (key: string) => { title: string; strand: string }): TopicAnalysis[] => keys.map((code): TopicAnalysis => {
    // An item with two codes gives half its marks to each, as follow-up priorities do.
    const share = questions.flatMap(q => q.codes.filter(c => keyOf(c) === code).map(() => ({ q, weight: q.marks / q.codes.length })));
    const marks = share.reduce((sum, s) => sum + s.weight, 0);
    const rated = share.filter(s => s.q.national !== undefined), ratedMarks = rated.reduce((sum, s) => sum + s.weight, 0);
    const national = ratedMarks ? rated.reduce((sum, s) => sum + s.weight * s.q.national!, 0) / ratedMarks : undefined;
    const result: Record<string, GroupResult> = {};
    for (const group of groups) {
      const sat = share.filter(s => s.q.groups[group]); if (!sat.length) continue;
      const satMarks = sat.reduce((sum, s) => sum + s.weight, 0);
      const percentage = sat.reduce((sum, s) => sum + s.weight * s.q.groups[group].percentage, 0) / satMarks;
      const gapped = sat.filter(s => s.q.groups[group].gap !== undefined), gapMarks = gapped.reduce((sum, s) => sum + s.weight, 0);
      const gap = gapMarks ? gapped.reduce((sum, s) => sum + s.weight * s.q.groups[group].gap!, 0) / gapMarks : undefined;
      result[group] = { pupils: Math.max(...sat.map(s => s.q.groups[group].pupils)), percentage, ...(gap !== undefined ? { gap } : {}) };
    }
    return { code, ...label(code), marks, ...(national !== undefined ? { national } : {}), groups: result, evidence: marks >= MIN_TOPIC_MARKS ? "enough" : "little" };
  }).sort((a, b) => (a.groups[ALL_GROUPS]?.gap ?? 0) - (b.groups[ALL_GROUPS]?.gap ?? 0) || a.code.localeCompare(b.code));
  const codes = [...new Set(items.flatMap(i => i.codes))];
  const topics = aggregate(codes, code => code, code => ({ title: titles.get(code)?.title || code, strand: titles.get(code)?.strand || "" }));
  const strands = aggregate([...new Set(codes.map(strandOf))], strandOf, strand => ({ title: strand, strand }));
  const themes: Record<string, string[]> = {};
  for (const group of groups) themes[group] = topics.filter(t => t.evidence === "enough" && (t.groups[group]?.gap ?? 0) < -5).sort((a, b) => a.groups[group].gap! - b.groups[group].gap!).slice(0, 5).map(t => t.code);
  return { groups, questions, topics, strands, themes };
}

/** Department-wide when a topic is below national in every class, else a class issue. */
export function topicPattern(topic: TopicAnalysis, groups: string[]): "department" | "some classes" | "none" {
  const classes = groups.filter(g => g !== ALL_GROUPS && topic.groups[g]?.gap !== undefined);
  if (classes.length < 2) return (topic.groups[ALL_GROUPS]?.gap ?? 0) < -5 ? "department" : "none";
  const below = classes.filter(g => topic.groups[g].gap! < -5).length;
  return below === classes.length ? "department" : below ? "some classes" : "none";
}

const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
const fixed = (n?: number) => n === undefined ? "" : n.toFixed(0);
export function analysisCsv(analysis: ResultsAnalysis): string {
  const head = ["Sparx code", "Topic", "Strand", "Marks", "National %", ...analysis.groups.flatMap(g => [`${g} %`, `${g} gap`]), "Pattern"];
  const rows = analysis.topics.map(t => [t.code, t.title, t.strand, t.marks.toFixed(1), fixed(t.national), ...analysis.groups.flatMap(g => [fixed(t.groups[g]?.percentage), fixed(t.groups[g]?.gap)]), topicPattern(t, analysis.groups)]);
  return [head, ...rows].map(r => r.map(cell).join(",")).join("\n");
}
