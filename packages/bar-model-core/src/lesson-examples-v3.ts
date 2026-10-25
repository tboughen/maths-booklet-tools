import * as old from "./lesson-examples";
import * as v3 from "./v3";
export const lessonExampleNames = old.lessonExampleNames;
export function lessonExample(
  name: (typeof lessonExampleNames)[number],
  worked = false,
): v3.Envelope {
  return v3.upgrade(old.lessonExample(name, worked));
}
