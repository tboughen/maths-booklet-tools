/**
 * Bar-model examples, saved as schema-3 files: the past-paper set (BM01–BM09, H07, H18,
 * source-sharing) and the lesson set (R1–R5). Each has a pupil copy and a worked copy.
 */
import * as v3 from "./v3";
import data from "./examples.json" with { type: "json" };

export const exampleNames = ["BM01", "BM02", "BM03", "BM04", "BM05", "BM06", "BM07", "BM08", "BM09", "H07", "H18", "source-sharing"] as const;
export type ExampleName = (typeof exampleNames)[number];
export const lessonExampleNames = ["R1", "R2-P", "R2-C", "R3a", "R3b", "R3c", "R3d", "R4", "R5"] as const;
export type LessonExampleName = (typeof lessonExampleNames)[number];

type Examples = Record<string, { pupil: unknown; worked: unknown }>;
const pick = (set: Examples, name: string, worked: boolean) => {
  const e = set[name];
  if (!e) throw Error(`Unknown bar-model example ${name}.`);
  return v3.validate(structuredClone(worked ? e.worked : e.pupil));
};
export const example = (name: ExampleName, worked = false): v3.Envelope => pick(data.pastPaper as Examples, name, worked);
export const lessonExample = (name: LessonExampleName, worked = false): v3.Envelope => pick(data.lesson as Examples, name, worked);
