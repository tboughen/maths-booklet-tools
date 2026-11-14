// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holdsAnswer } from "../../envelope-core/src/answer-state";
import { answerSlots } from "./answer-slots";
import { printedText } from "./answer-leaks";
import { FAMILIES } from "./registry";
import { describeAlgebraGrid, describeCuboids, describeValueGraph } from "./summaries";

const corpus = "packages/envelope-core/fixtures/corpus";
const cases = [
  { kind: "value-graph", folder: "value-graph", describe: describeValueGraph },
  { kind: "cuboids", folder: "cuboids", describe: describeCuboids },
  { kind: "algebra-grid", folder: "algebra-grid", describe: describeAlgebraGrid },
] as const;

describe("content summaries (M15)", () => {
  for (const c of cases)
    it(`${c.kind}: says what prints and never names a hidden answer`, () => {
      const files = readdirSync(join(corpus, c.folder)).filter((f) => f.endsWith(".json"));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const e = FAMILIES[c.kind].validate(JSON.parse(readFileSync(join(corpus, c.folder, file), "utf8")), "pupil");
        const text = (c.describe as (e: unknown) => string)(e);
        expect(text.length, file).toBeGreaterThan(20);
        expect(text, file).not.toMatch(/undefined|NaN|\[object/);
        const printed = printedText(FAMILIES[c.kind].svg(e, "pupil")).join(" ");
        for (const slot of answerSlots(c.kind, e).filter(holdsAnswer))
          if (slot.text.trim().length > 1 && !printed.includes(slot.text.trim())) expect(text, `${file} ${slot.path}`).not.toContain(slot.text.trim());
      }
    });
});
