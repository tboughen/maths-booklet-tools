import { renderResource, validate, type Resource } from "../../../packages/resource-core/src/index";
import type { Pupil } from "../types";
import { LEVEL_NAMES, LEVELS, type Level, type Skill, type SkillCard, type SkillSet } from "./model";

export type Scores = Record<string, number | null>;
export interface PlanEntry { code: string; level: Level }
export interface SkillScore { skill: Skill; lost: number; recorded: boolean }

const mark = (scores: Scores, part: string) => scores[part] ?? 0;

/** The marks keyed by the bank's own part labels. The marks import writes labels in capitals (Q7A), the bank as printed (Q7a). */
export function scoresFor(set: SkillSet, scores: Scores): Scores {
  const byKey = new Map(Object.entries(scores).map(([k, v]) => [k.toUpperCase(), v]));
  return Object.fromEntries(set.parts.map((p) => [p.label, scores[p.label] ?? byKey.get(p.label.toUpperCase()) ?? null]));
}

/** True when the pupil has no mark recorded for any paper part (absent, not zero). */
export const isAbsent = (set: SkillSet, scores: Scores) => set.parts.every((p) => scores[p.label] === null || scores[p.label] === undefined);

/** The start level from the skill's rules. A missing mark counts as no marks, so the level is never too high. */
export function startLevel(skill: Skill, scores: Scores): Level {
  for (const rule of skill.start) {
    const tests = (rule.all ?? rule.any ?? []).map(([part, below]) => mark(scores, part) < below);
    if (rule.all ? tests.every(Boolean) : tests.some(Boolean)) return rule.level;
  }
  return "S";
}

/** Each skill's proportion of marks lost on the parts that have a mark. Skills with no recorded mark are left out. */
export function skillScores(set: SkillSet, scores: Scores, excluded: readonly string[] = []): SkillScore[] {
  const max = new Map(set.parts.map((p) => [p.label, p.max]));
  return set.skills
    .filter((s) => !excluded.includes(s.code))
    .map((skill) => {
      const parts = skill.paper.filter((p) => scores[p] !== null && scores[p] !== undefined);
      const total = parts.reduce((n, p) => n + max.get(p)!, 0), got = parts.reduce((n, p) => n + mark(scores, p), 0);
      return { skill, lost: total ? (total - got) / total : 0, recorded: parts.length > 0 };
    })
    .filter((s) => s.recorded);
}

/** The three skills with the most marks lost (ties by skill code), each at its start level. */
export function defaultPlan(set: SkillSet, scores: Scores, excluded: readonly string[] = [], n = 3): PlanEntry[] {
  return skillScores(set, scores, excluded)
    .sort((a, b) => b.lost - a.lost || a.skill.code.localeCompare(b.skill.code))
    .slice(0, n)
    .map(({ skill }) => ({ code: skill.code, level: startLevel(skill, scores) }));
}

/**
 * The two-level window. Side 1: the start level. Side 2: the next level up, then onward to back to the paper
 * if room is left (1 → 2, 2 → 3, 3 → paper level, paper level → back to the paper then stretch, full marks → stretch).
 */
export function pick(skill: Skill, level: Level, side1: number, side2: number): [SkillCard[], SkillCard[]] {
  const by = (l: Level) => skill.cards.filter((c) => c.level === l);
  if (level === "S") return [by("S").slice(0, 1), by("S").slice(1, 1 + side2)];
  const i = LEVELS.indexOf(level), p = LEVELS.indexOf("P");
  const rest = LEVELS.slice(i + 1, p + 1).flatMap(by);
  if (level === 4) rest.push(...by("S"));
  return [by(level).slice(0, side1), rest.slice(0, side2)];
}

const NEXT: Record<string, Level> = { 1: 2, 2: 3, 3: 4, 4: "P", S: "S" };

/** One pupil's sheet: a two-sided A3 worksheet with a column per skill. Budgets are cards per column on each side. */
export function sheetResource(set: SkillSet, label: string, plan: PlanEntry[], budgets: [number[], number[]]): Resource {
  const skills = plan.map((e) => set.skills.find((s) => s.code === e.code)!);
  const sides = [[], []] as { heading: string; cards: unknown[] }[][];
  plan.forEach((entry, i) => {
    const skill = skills[i], [one, two] = pick(skill, entry.level, budgets[0][i], budgets[1][i]);
    [one, two].forEach((cards, side) => {
      const name = LEVEL_NAMES[side === 0 ? entry.level : NEXT[entry.level]];
      const heading = `${skill.title}: ${name}`;
      sides[side].push({ heading: heading.length <= 40 ? heading : skill.title.slice(0, 40), cards: cards.map((c) => c.card) });
    });
  });
  const objective = `${set.title}. Your Sparx codes: ${skills.map((s) => `${s.title} ${s.pupilCodes}`).join("; ")}`;
  return validate({
    tool: "resource",
    schemaVersion: 1,
    document: {
      kind: "worksheet-a3",
      title: label.slice(0, 80),
      code: label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16),
      objective: objective.length <= 200 ? objective : objective.slice(0, 199) + "…",
      group: `Year ${set.year}`,
      nameLine: true,
      notation: "maths",
      spareSpace: "share",
      sides: sides.map((columns, s) => ({ instruction: set.instructions[s], columns })),
    },
  });
}

export interface FittedSheet { resource: Resource; problems: string[] }

/**
 * Starts at six cards a column and, wherever a column runs out of room, takes one card off that skill on that
 * side and tries again. Text and working space are never shrunk. Problems that remain are reported.
 */
export function fitSheet(set: SkillSet, label: string, plan: PlanEntry[]): FittedSheet {
  const budgets: [number[], number[]] = [plan.map(() => 6), plan.map(() => 6)];
  let resource = sheetResource(set, label, plan, budgets), problems: string[] = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const { issues } = renderResource(resource, { view: "pupil" });
    problems = issues.map((i) => i.message);
    const over = issues.filter((i) => /more height/.test(i.message) && i.side >= 1 && i.column >= 1);
    if (!over.length) break;
    let changed = false;
    for (const i of over) {
      const b = budgets[i.side - 1];
      if (b[i.column - 1] > 1) { b[i.column - 1]--; changed = true; }
    }
    if (!changed) break;
    resource = sheetResource(set, label, plan, budgets);
  }
  return { resource, problems };
}

export interface SkillPupil { pupil: Pupil; label: string; scores: Scores }
/** "Student 01" from the row order when the marks had no identifiers; the mark book's identifier otherwise. */
export const skillLabels = (set: SkillSet, pupils: Pupil[], generated: boolean): SkillPupil[] =>
  pupils.map((pupil, i) => ({ pupil, label: generated ? `Student ${String(i + 1).padStart(2, "0")}` : pupil.identifier, scores: scoresFor(set, pupil.scores) }));
