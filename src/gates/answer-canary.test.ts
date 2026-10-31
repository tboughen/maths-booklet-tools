// Answer canary (docs/AUTONOMOUS-LOOP-POLICY.md, gate 7): a hidden answer must never reach pupil
// artwork. For every example of every tool that saves hidden answers, plant a sentinel in one
// hidden-answer slot at a time and render the pupil SVG. A positive control renders the same slot
// made visible, so a slot only counts when the renderer would have shown the sentinel as text.
import { describe, expect, it } from "vitest";
import * as algebraGrid from "../../packages/algebra-grid-core/src/index";
import { exampleNames as algebraGridExamples } from "../../packages/algebra-grid-core/src/interchange";
import * as barModel from "../../packages/bar-model-core/src/index";
import * as barModelV3 from "../../packages/bar-model-core/src/v3";
import { lessonExample, lessonExampleNames } from "../../packages/bar-model-core/src/lesson-examples-v3";
import * as cuboid from "../../packages/cuboid-core/src/index";
import { examples as cuboidExamples } from "../../packages/cuboid-core/src/examples";
import * as numberLine from "../../packages/number-line-core/src/index";
import { examples as numberLineExamples, example as numberLineExample } from "../../packages/number-line-core/src/examples";
import * as triangle from "../../packages/triangle-core/src/index";
import { examples as triangleExamples } from "../../packages/triangle-core/src/examples";
import * as venn from "../../packages/venn-core/src/index";
import { examples as vennExamples, teachingExamples as vennTeaching } from "../../packages/venn-core/src/examples";

// Free text where a slot allows it, else an unusual integer term (algebra cells accept only terms).
const SENTINELS = [{ value: "Qzx7canary", find: "Qzx7canary" }, { value: "+917", find: "917" }, { value: "917", find: "917" }];
type Json = Record<string, unknown>;
type Plant = (o: Json, s: string) => void;
type Slot = { path: (string | number)[]; hide: Plant; show: Plant };
// Text drawn in the SVG (between tags), so attribute values and path data never match.
const drawnText = (svg: string) => [...svg.matchAll(/>([^<]*)</g)].map(m => m[1]).join(" ");

// The saved shapes that hold text a pupil must not see. Each rule plants the sentinel and either
// hides it (the case under test) or shows it (the control).
const rules: { match: (o: Json) => boolean; hide: Plant; show: Plant }[] = [
  { match: o => typeof o.hidden === "boolean" && "value" in o, hide: (o, s) => { o.value = s; o.hidden = true; }, show: (o, s) => { o.value = s; o.hidden = false; } },
  { match: o => typeof o.answerVisible === "boolean" && typeof o.answer === "string", hide: (o, s) => { o.answer = s; o.answerVisible = false; }, show: (o, s) => { o.answer = s; o.answerVisible = true; } },
  { match: o => typeof o.state === "string" && typeof o.text === "string", hide: (o, s) => { o.text = s; o.state = "hidden"; }, show: (o, s) => { o.text = s; o.state = "value"; } },
  { match: o => typeof o.visibility === "string" && typeof o.text === "string", hide: (o, s) => { o.text = s; o.visibility = "hidden"; }, show: (o, s) => { o.text = s; o.visibility = "show"; } },
  { match: o => typeof o.mode === "string" && typeof o.text === "string" && typeof o.x === "number", hide: (o, s) => { o.text = s; o.mode = "hidden"; }, show: (o, s) => { o.text = s; o.mode = "text"; } },
];

function slots(value: unknown, path: (string | number)[] = []): Slot[] {
  if (!value || typeof value !== "object") return [];
  const found: Slot[] = [];
  if (!Array.isArray(value)) for (const r of rules) if (r.match(value as Json)) found.push({ path, hide: r.hide, show: r.show });
  for (const [k, v] of Object.entries(value)) found.push(...slots(v, [...path, Array.isArray(value) ? Number(k) : k]));
  return found;
}

function plant(envelope: unknown, slot: Slot, how: "hide" | "show", sentinel: string) {
  const copy = structuredClone(envelope) as Json;
  let node: unknown = copy;
  for (const key of slot.path) node = (node as Json)[key as string];
  slot[how](node as Json, sentinel);
  return copy;
}

interface Tool { name: string; envelopes: () => unknown[]; validate: (raw: unknown) => unknown; pupilSvg: (e: never) => string }

const tools: Tool[] = [
  { name: "algebra grid", envelopes: () => algebraGridExamples.flatMap(n => [algebraGrid.example(n), algebraGrid.example(n, true)]), validate: algebraGrid.validate, pupilSvg: e => algebraGrid.renderSvg(e, false) },
  { name: "bar model v1", envelopes: () => barModel.exampleNames.flatMap(n => [barModel.example(n), barModel.example(n, true)]), validate: barModel.validate, pupilSvg: barModel.renderSvg },
  { name: "bar model v3", envelopes: () => lessonExampleNames.flatMap(n => [lessonExample(n), lessonExample(n, true)]), validate: barModelV3.validate, pupilSvg: barModelV3.renderSvg },
  { name: "cuboids", envelopes: () => cuboidExamples.flatMap(x => [x.create(false), x.create(true)]), validate: cuboid.validate, pupilSvg: cuboid.renderSvg },
  { name: "number line", envelopes: () => numberLineExamples.flatMap((_, i) => [numberLineExample(i), numberLineExample(i, true)]), validate: numberLine.validate, pupilSvg: numberLine.renderSvg },
  { name: "triangles", envelopes: () => triangleExamples.map(x => x.build()), validate: triangle.validate, pupilSvg: triangle.renderSvg },
  { name: "venn", envelopes: () => [...vennExamples, ...vennTeaching].flatMap(x => [x.make(false), x.make(true)]), validate: venn.validate, pupilSvg: venn.renderSvg },
];

describe("answer canary: hidden answers never reach pupil artwork", () => {
  for (const tool of tools) {
    it(`${tool.name}`, () => {
      let checked = 0;
      const leaks: string[] = [];
      for (const [i, envelope] of tool.envelopes().entries()) {
        for (const slot of slots(envelope)) {
          for (const sentinel of SENTINELS) {
            let shown: unknown, hidden: unknown, control: string;
            try {
              shown = tool.validate(plant(envelope, slot, "show", sentinel.value));
              hidden = tool.validate(plant(envelope, slot, "hide", sentinel.value));
              control = tool.pupilSvg(shown as never);
            } catch { continue; } // the slot rejects this sentinel, or the export is blocked
            if (drawnText(tool.pupilSvg(envelope as never)).includes(sentinel.find)) continue; // already on the page
            if (!drawnText(control).includes(sentinel.find)) continue; // not drawn as text: no signal
            checked++;
            if (drawnText(tool.pupilSvg(hidden as never)).includes(sentinel.find)) leaks.push(`example ${i} at ${slot.path.join(".")}`);
            break;
          }
        }
      }
      expect(leaks, `hidden answers visible in pupil SVG`).toEqual([]);
      // The gate must test something: each tool listed here has at least one checkable slot.
      expect(checked).toBeGreaterThan(0);
    });
  }
});
