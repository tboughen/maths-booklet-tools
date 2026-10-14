import { questionIdentity, type BankCatalogue, type BankQuestion } from "../bank/model";
import { originalPaperCount, performanceFor } from "../bank/performance";
import { layoutPack } from "./layout";
import { questionLabel } from "./import";
import { validateSettings, type AssessmentItem, type ClassPlan, type Pack, type Practice, type Priority, type Profile, type Pupil, type Settings } from "./types";

export function prioritiesFor(items: AssessmentItem[], pupil?: Pupil): Priority[] {
  const byCode = new Map<string, Priority>();
  for (const item of items) {
    const score = pupil ? pupil.scores[questionLabel(item.label)] : 0;
    if (score === null || score === undefined || score >= item.marks) continue;
    const achieved = score / item.marks, weight = (1 - achieved) * (1 + Math.min(item.marks, 6) / 6) / Math.max(1, item.codes.length);
    for (const code of item.codes) {
      const old = byCode.get(code);
      byCode.set(code, { code, weight: weight + (old?.weight ?? 0), achieved: old ? Math.min(old.achieved, achieved) : achieved, references: [...new Set([...(old?.references ?? []), item.label])] });
    }
  }
  return [...byCode.values()].sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code)).slice(0, 3);
}
export const preferredRange = (profile: Profile, achieved: number): [number, number] => {
  const ranges = { developing: [70, 100], secure: [55, 80], strong: [0, 65] } as const;
  const base = ranges[profile.strength], yearShift = Math.max(-6, Math.min(12, (10 - profile.year) * 4));
  const support = achieved === 0 ? 10 : achieved < .5 ? 5 : 0;
  return [Math.min(100, Math.max(0, base[0] + yearShift + support)), Math.min(100, base[1] + yearShift + support)];
};
export function accessibility(q: BankQuestion, catalogue: BankCatalogue, profile: Profile, achieved: number): number {
  const count = catalogue.paperQuestionCounts?.[q.paperId] ?? originalPaperCount(q.paperId);
  const position = count && count > 1 ? Math.max(0, Math.min(1, (q.number - 1) / (count - 1))) : .5;
  const performance = q.performance ?? performanceFor(q, count);
  const early = 1 - position;
  if (!performance || performance.kind === "estimated") return .35 + early * .65;
  const [low, high] = preferredRange(profile, achieved), percentage = performance.percentage;
  const distance = percentage < low ? low - percentage : percentage > high ? percentage - high : 0;
  // Within the preferred band favour its accessible end, then original position.
  const fit = Math.max(0, 1 - distance / 55), progression = .12 * percentage / 100;
  return .55 * fit + .33 * early + progression;
}
interface Candidate { practice: Practice; score: number }
function candidates(catalogue: BankCatalogue, items: AssessmentItem[], priorities: Priority[], profile: Profile, settings: Settings): Candidate[] {
  const source = new Set(items.flatMap(item => {
    const q = catalogue.questions.find(q => q.id === item.questionId);
    return [...(item.questionId ? [item.questionId] : []), ...(q ? [questionIdentity(q)] : [])];
  }));
  const groups = new Map<string, BankQuestion>();
  for (const q of catalogue.questions) {
    if (q.review !== "reviewed" || q.tier !== profile.tier || source.has(q.id) || source.has(q.equivalentId || "") || source.has(questionIdentity(q)) || (settings.calculator !== "all" && q.calculator !== (settings.calculator === "yes"))) continue;
    if (!priorities.some(p => q.codes.includes(p.code))) continue;
    groups.set(questionIdentity(q), q);
  }
  return [...groups.values()].map(q => {
    const matching = priorities.filter(p => q.codes.includes(p.code));
    const targetedMarks = q.parts.filter(p => p.codes.some(code => matching.some(priority => priority.code === code))).reduce((sum, p) => sum + p.marks, 0);
    const relevance = Math.min(1, targetedMarks / Math.max(1, q.marks));
    const score = matching.reduce((sum, p) => sum + p.weight * accessibility(q, catalogue, profile, p.achieved), 0) * (.35 + .65 * relevance);
    return { score, practice: { question: q, codes: matching.map(p => p.code), references: [...new Set(matching.flatMap(p => p.references))], reason: `${Math.round(relevance * 100)}% of marks match priorities; ${q.performance?.kind === "measured" ? `${Math.round(q.performance.percentage)}% exam average` : "original paper position"}` } };
  }).sort((a, b) => b.score - a.score || a.practice.question.order - b.practice.question.order || a.practice.question.id.localeCompare(b.practice.question.id));
}
function fits(entries: Practice[], settings: Settings): boolean {
  return (settings.marksLimit === null || entries.reduce((sum, entry) => sum + entry.question.marks, 0) <= settings.marksLimit) && layoutPack(entries, settings.pageLimit).valid;
}
function fill(ranked: Candidate[], settings: Settings, initial: Practice[] = [], diversify = true): Practice[] {
  const result = [...initial], identities = new Set(result.map(p => questionIdentity(p.question))), coverage = new Map<string, number>();
  for (const entry of result) for (const code of entry.codes) coverage.set(code, (coverage.get(code) || 0) + 1);
  const remaining = ranked.filter(c => !identities.has(questionIdentity(c.practice.question)));
  while (remaining.length && result.length < 60) {
    remaining.sort((a, b) => {
      const adjusted = (c: Candidate) => c.score / (1 + (diversify ? Math.min(...c.practice.codes.map(code => coverage.get(code) || 0)) * .8 : 0));
      return adjusted(b) - adjusted(a) || a.practice.question.order - b.practice.question.order || a.practice.question.id.localeCompare(b.practice.question.id);
    });
    const next = remaining.shift()!;
    if (!fits([...result, next.practice], settings)) continue;
    result.push(next.practice); identities.add(questionIdentity(next.practice.question));
    for (const code of next.practice.codes) coverage.set(code, (coverage.get(code) || 0) + 1);
  }
  // Keep each topic together and its accessible starting question first.
  return result;
}
export function generateClass(catalogue: BankCatalogue, items: AssessmentItem[], pupils: Pupil[], settings: Settings): ClassPlan {
  validateSettings(settings);
  if (!items.length || !pupils.length) throw new Error("Import assessment mappings and at least one pupil first.");
  const allPriorities = prioritiesFor(items), classProfile: Profile = { year: settings.year, tier: settings.tier, strength: settings.strength };
  const packs: Pack[] = pupils.map(pupil => {
    const profile = { ...classProfile, ...pupil.profile }, hasScores = items.some(item => pupil.scores[questionLabel(item.label)] !== null && pupil.scores[questionLabel(item.label)] !== undefined);
    const priorities = prioritiesFor(items, pupil);
    return { pupil, profile, fallback: !hasScores, warnings: [], entries: hasScores ? fill(candidates(catalogue, items, priorities.length ? priorities : allPriorities, profile, settings), settings) : [] };
  });
  const frequency = new Map<string, number>();
  for (const pack of packs.filter(p => !p.fallback)) for (const entry of pack.entries) frequency.set(questionIdentity(entry.question), (frequency.get(questionIdentity(entry.question)) || 0) + 1);
  // Common candidates use class defaults. Frequency outranks difficulty; ties keep
  // deterministic accessible ordering. All topics remain available as a fallback.
  const classCandidates = candidates(catalogue, items, allPriorities, classProfile, settings);
  // Missing pupils should see common selections even from topics outside the
  // three default priorities, provided they match the assessment and class tier.
  const allCodes = [...new Set(items.flatMap(item => item.codes))];
  const fullPriorities = allCodes.map(code => ({ code, weight: 1, achieved: 0, references: items.filter(i => i.codes.includes(code)).map(i => i.label) }));
  const fullCandidates = candidates(catalogue, items, fullPriorities, classProfile, settings);
  const commonRanked = fullCandidates.map(c => ({ ...c, score: (frequency.get(questionIdentity(c.practice.question)) || 0) * 1000 + c.score }));
  const commonEntries = fill(frequency.size ? commonRanked.filter(c => frequency.has(questionIdentity(c.practice.question))) : classCandidates, settings, [], false);
  for (const pack of packs) {
    if (settings.common) { pack.entries = commonEntries; pack.profile = classProfile; }
    else if (pack.fallback) {
      if (JSON.stringify(pack.profile) === JSON.stringify(classProfile)) { pack.entries = commonEntries; }
      else {
      const eligible = candidates(catalogue, items, fullPriorities, pack.profile, settings);
      pack.entries = fill(eligible.map(c => ({ ...c, score: (frequency.get(questionIdentity(c.practice.question)) || 0) * 1000 + c.score })), settings, [], false);
      }
    } else if (items.some(item => pack.pupil.scores[questionLabel(item.label)] == null)) {
      const eligible = candidates(catalogue, items, fullPriorities, pack.profile, settings).filter(c => frequency.has(questionIdentity(c.practice.question)));
      pack.entries = fill(eligible.map(c => ({ ...c, score: frequency.get(questionIdentity(c.practice.question))! * 1000 + c.score })), settings, pack.entries);
    }
    if (!pack.entries.length) pack.warnings.push("No suitable complete question and scheme fit these limits.");
    const marks = pack.entries.reduce((sum, entry) => sum + entry.question.marks, 0);
    if (settings.marksLimit !== null && marks < settings.marksLimit) pack.warnings.push(`Selected ${marks} of at most ${settings.marksLimit} marks.`);
  }
  return { packs, commonEntries, warnings: [] };
}
