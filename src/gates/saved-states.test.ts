// Teaching-state gate (docs/AUTONOMOUS-LOOP-POLICY.md, gate 5): blank, zero, hidden-answer and
// answer-line states must survive save and reload exactly, and stay distinct from one another.
// Every example of every tool is saved as its editable file (and as its link where the tool has a
// link codec), reloaded through the real parser and compared. Then each teaching slot is set to
// each state in turn (blank, zero, hidden answer, answer line, value) and round-tripped the same way.
import { describe, expect, it } from "vitest";
import { forAll } from "../testing/random";
import { tools } from "./saved-files";

type Json = Record<string, unknown>;
// The ways a teaching slot can be set. Each tool accepts only some; the validator decides.
const TEXTS = ["Qzx7canary", "+917", "0"];
const REPLACE = "__replace__"; // the variant replaces the whole slot instead of merging into it
const states: { match: (o: Json) => boolean; variants: (o: Json) => Json[] }[] = [
  { match: o => typeof o.hidden === "boolean" && "value" in o, variants: () => [{ value: null, hidden: false }, ...TEXTS.flatMap(t => [{ value: t, hidden: false }, { value: t, hidden: true }])] },
  { match: o => typeof o.answerVisible === "boolean" && typeof o.answer === "string", variants: () => [{ answer: "", answerVisible: false }, ...TEXTS.flatMap(t => [{ answer: t, answerVisible: false }, { answer: t, answerVisible: true }])] },
  { match: o => typeof o.state === "string" && typeof o.text === "string", variants: () => ["blank", "hidden", "line", "answer-line", "question", "symbol", "value"].flatMap(state => ["", ...TEXTS].map(text => ({ state, text }))) },
  { match: o => typeof o.show === "string" && typeof o.value === "string", variants: () => ["show", "hidden"].flatMap(show => ["", ...TEXTS].map(value => ({ show, value }))) },
  { match: o => typeof o.show === "string" && typeof o.text === "string", variants: () => ["show", "hidden"].flatMap(show => ["", ...TEXTS].map(text => ({ show, text }))) },
  { match: o => typeof o.visibility === "string" && typeof o.text === "string", variants: () => ["show", "hidden", "line"].flatMap(visibility => ["", ...TEXTS].map(text => ({ visibility, text }))) },
  { match: o => typeof o.mode === "string" && typeof o.text === "string" && typeof o.x === "number", variants: () => ["hidden", "blank", "value", "text"].flatMap(mode => ["", ...TEXTS].map(text => ({ mode, text }))) },
  // Table cells that are a value, a pupil blank or an answer line (plotting quadratics).
  { match: o => o.kind === "value" || o.kind === "blank" || o.kind === "answer-line", variants: () => [{ [REPLACE]: true, kind: "blank" }, { [REPLACE]: true, kind: "answer-line" }, { [REPLACE]: true, kind: "value", value: "0" }, { [REPLACE]: true, kind: "value", value: "917" }] },
];

function slots(value: unknown, path: (string | number)[] = []): { path: (string | number)[]; variants: Json[] }[] {
  if (!value || typeof value !== "object") return [];
  const found: { path: (string | number)[]; variants: Json[] }[] = [];
  if (!Array.isArray(value)) for (const s of states) if (s.match(value as Json)) found.push({ path, variants: s.variants(value as Json) });
  for (const [k, v] of Object.entries(value)) found.push(...slots(v, [...path, Array.isArray(value) ? Number(k) : k]));
  return found;
}
function withVariant(envelope: unknown, path: (string | number)[], variant: Json) {
  const copy = structuredClone(envelope) as Json;
  let node: unknown = copy;
  for (const key of path) node = (node as Json)[key as string];
  const target = node as Json, { [REPLACE]: replace, ...fields } = variant;
  if (replace) for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, fields);
  return copy;
}
const canonical = (v: unknown) => JSON.stringify(v);

describe("teaching states survive save and reload", () => {
  for (const tool of tools) {
    it(tool.name, () => {
      const lost: string[] = [];
      let examples = 0, variants = 0;
      const roundTrip = (e: unknown, where: string) => {
        if (canonical(tool.parseFile(JSON.stringify(e))) !== canonical(e)) lost.push(`${where}: editable file`);
        if (tool.link && canonical(tool.link.decode(tool.link.encode(e as never))) !== canonical(e)) lost.push(`${where}: link`);
      };
      for (const [i, raw] of tool.envelopes().entries()) {
        const envelope = tool.validate(raw);
        examples++;
        roundTrip(envelope, `example ${i}`);
        for (const slot of slots(envelope)) {
          const seen = new Map<string, string>();
          for (const variant of slot.variants) {
            let e: unknown;
            try { e = tool.validate(withVariant(envelope, slot.path, variant)); } catch { continue; }
            variants++;
            roundTrip(e, `example ${i} at ${slot.path.join(".")} = ${JSON.stringify(variant)}`);
            // Two different saved states must never collapse into the same saved file.
            const saved = canonical(e), key = JSON.stringify(variant);
            for (const [other, otherSaved] of seen) if (otherSaved === saved) lost.push(`example ${i} at ${slot.path.join(".")}: ${key} saves the same as ${other}`);
            seen.set(key, saved);
          }
        }
      }
      expect(lost).toEqual([]);
      expect(examples).toBeGreaterThan(0);
      if (tool.teachingSlots === false) expect(variants).toBe(0);
      else expect(variants).toBeGreaterThan(0);
    }, 60000);
  }
});

// Property (L18): teachers set many slots in one file, not one at a time. Set every slot of a
// random example to a random state at once; whatever the validator accepts must save and reload
// exactly, as a file and through its link.
describe("random mixes of teaching states survive save and reload", () => {
  for (const tool of tools.filter((t) => t.teachingSlots !== false)) {
    it(tool.name, () => {
      const envelopes = tool.envelopes().map((raw) => tool.validate(raw));
      let changed = 0;
      forAll(150, (r) => {
        let e: unknown = r.pick(envelopes);
        for (const slot of slots(e)) {
          if (r.bool(0.3)) continue;
          try {
            e = tool.validate(withVariant(e, slot.path, r.pick(slot.variants)));
            changed++;
          } catch {
            /* the validator refuses this state for this slot; leave the slot as it was */
          }
        }
        expect(canonical(tool.parseFile(JSON.stringify(e)))).toBe(canonical(e));
        if (tool.link) expect(canonical(tool.link.decode(tool.link.encode(e as never)))).toBe(canonical(e));
      });
      // The mixes really vary the teaching states, not only the untouched examples.
      expect(changed).toBeGreaterThan(0);
    }, 60000);
  }
});
