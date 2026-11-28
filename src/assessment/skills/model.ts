// Skill sheets: personalised A3 follow-up sheets built from a bank of levelled questions for one assessment
// (first used for Year 8 Summative 1, Nov 2026). The bank is school material, so it lives in the private
// question bank (bank/assets/schemes/skill-sheets.json, named by bank/schemes.json) and is fetched only by
// signed-in staff. Marks never leave the browser. See docs/tools/ASSESSMENT-FOLLOW-UP.md "Skill sheets".

export type Level = 1 | 2 | 3 | 4 | "P" | "S";
export const LEVELS: readonly Level[] = [1, 2, 3, 4, "P", "S"];
/** The start levels a teacher can choose; "P" (back to the paper) is only ever a next step. */
export const START_LEVELS: readonly Level[] = [1, 2, 3, 4, "S"];
export const LEVEL_NAMES: Record<string, string> = { 1: "Level 1", 2: "Level 2", 3: "Level 3", 4: "Paper level", P: "Back to the paper", S: "Stretch" };

/** A test on one paper part: marks below `below`. */
export type Test = [part: string, below: number];
/** The first rule that passes gives the start level; no rule passing means full marks, so stretch. */
export interface StartRule { level: Level; all?: Test[]; any?: Test[] }
export interface SkillCard { level: Level; /** A worksheet card (packages/resource-core card schema). */ card: Record<string, unknown> }
export interface Skill {
  code: string;
  title: string;
  /** Codes printed for pupils (Sparx Key Stage 3, e.g. "M365, M227"). */
  pupilCodes: string;
  /** Sparx GCSE codes, used for the marks import and Question Bank links. */
  sparx: string[];
  /** The paper parts that test this skill. */
  paper: string[];
  start: StartRule[];
  cards: SkillCard[];
}
export interface SkillSet {
  id: string;
  name: string;
  year: number;
  title: string;
  parts: { label: string; max: number; codes: string[] }[];
  instructions: [string, string];
  skills: Skill[];
}
export interface SkillSetFile { schema: "mathsdock-skill-sheets"; version: 1; sets: SkillSet[] }

const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level);
const fail = (message: string): never => { throw new Error(`The skill sheet bank is not valid: ${message}`); };

/** Reads the bank file; throws a specific error so a bad file never reaches a class. */
export function parseSkillSets(value: unknown): SkillSet[] {
  const file = value as Partial<SkillSetFile> | null;
  if (!file || file.schema !== "mathsdock-skill-sheets" || file.version !== 1 || !Array.isArray(file.sets)) fail("unknown file type.");
  const sets = file!.sets!;
  for (const set of sets) {
    if (!set || typeof set.id !== "string" || !/^[a-z0-9-]+$/.test(set.id) || typeof set.name !== "string") fail("a set has no id or name.");
    const parts = new Map<string, number>();
    for (const p of set.parts ?? []) {
      if (typeof p.label !== "string" || !Number.isInteger(p.max) || p.max < 1 || !Array.isArray(p.codes)) fail(`${set.name}: a paper part is incomplete.`);
      parts.set(p.label, p.max);
    }
    if (!parts.size) fail(`${set.name} has no paper parts.`);
    if (!Array.isArray(set.instructions) || set.instructions.length !== 2) fail(`${set.name} needs two side instructions.`);
    if (!Array.isArray(set.skills) || set.skills.length < 1) fail(`${set.name} has no skills.`);
    for (const s of set.skills) {
      if (typeof s.code !== "string" || typeof s.title !== "string" || !Array.isArray(s.paper) || !s.paper.length) fail(`${set.name}: a skill is incomplete.`);
      for (const p of s.paper) if (!parts.has(p)) fail(`${s.title} names ${p}, which is not a paper part.`);
      for (const r of s.start ?? []) {
        if (!isLevel(r.level) || r.level === "P") fail(`${s.title}: a start rule has an unknown level.`);
        for (const [p, n] of [...(r.all ?? []), ...(r.any ?? [])]) if (!parts.has(p) || typeof n !== "number") fail(`${s.title}: a start rule tests ${p}.`);
      }
      if (!Array.isArray(s.cards) || s.cards.some((c) => !isLevel(c.level) || !c.card || typeof c.card !== "object")) fail(`${s.title}: a card has no level.`);
    }
  }
  return sets;
}
