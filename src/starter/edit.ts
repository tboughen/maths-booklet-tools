import { defaultSlots, RUN_LENGTH, SLOT_COUNT, type Card, type StarterRun, type StarterTemplate } from "../../packages/resource-core/src/index";

/** Run editing steps for the Starter builder. Each returns a new run (or a message when it cannot apply); the page validates and records one undo step. */
export const TEMPLATE_NAMES: Record<StarterTemplate, string> = {
  four: "Four questions (Years 7 and 8)",
  six: "Six questions",
  "core-extension": "Four core and two extension (Year 9)",
};

/** A new question: an empty instruction and a working space, for the teacher to fill in. */
export const emptyCard = (): Card => ({ title: "", items: [{ type: "space", kind: "working", heightMm: 8 }] });

/**
 * Changes the template. Slots keep their questions in order; a template with more slots adds empty
 * ones, and one with fewer drops the last slots from every starter (Undo brings them back).
 */
export function setTemplate(run: StarterRun, template: StarterTemplate): StarterRun {
  const next = structuredClone(run);
  const d = next.document;
  const want = SLOT_COUNT[template];
  const fresh = defaultSlots(template);
  d.template = template;
  d.slots = Array.from({ length: want }, (_, i) => d.slots[i] ?? fresh[i]);
  // The four-question template has its icons; keep a slot's own icon when it has one.
  if (template === "four") d.slots = d.slots.map((s, i) => (s.icon === "none" ? { ...s, icon: fresh[i].icon } : s));
  d.starters = d.starters.map((s) => ({ cards: Array.from({ length: want }, (_, i) => s.cards[i] ?? emptyCard()) }));
  return next;
}

/** Copies one starter's question in a slot to every other starter in the run, so the teacher only changes the numbers. */
export function copySlotToAll(run: StarterRun, starter: number, slot: number): StarterRun {
  const next = structuredClone(run);
  const card = next.document.starters[starter].cards[slot];
  next.document.starters.forEach((s, i) => {
    if (i !== starter) s.cards[slot] = structuredClone(card);
  });
  return next;
}

/** Copies the previous starter's question in this slot into this starter. */
export function copySlotFromPrevious(run: StarterRun, starter: number, slot: number): StarterRun | string {
  if (starter === 0) return "Starter 1 has no starter before it.";
  const next = structuredClone(run);
  next.document.starters[starter].cards[slot] = structuredClone(next.document.starters[starter - 1].cards[slot]);
  return next;
}

/** Adds a starter after `after`, a copy of it, ready for its numbers to change. */
export function addStarter(run: StarterRun, after: number): StarterRun | string {
  if (run.document.starters.length >= RUN_LENGTH) return `A run holds ${RUN_LENGTH} starters.`;
  const next = structuredClone(run);
  next.document.starters.splice(after + 1, 0, structuredClone(next.document.starters[after]));
  return next;
}

export function removeStarter(run: StarterRun, starter: number): StarterRun | string {
  if (run.document.starters.length <= 1) return "A run needs at least one starter.";
  const next = structuredClone(run);
  next.document.starters.splice(starter, 1);
  return next;
}

/** Moves a starter one place earlier (-1) or later (+1) in the run. */
export function moveStarter(run: StarterRun, starter: number, by: -1 | 1): StarterRun | string {
  const to = starter + by;
  if (to < 0 || to >= run.document.starters.length) return "The starter is already at that end of the run.";
  const next = structuredClone(run);
  const s = next.document.starters;
  [s[starter], s[to]] = [s[to], s[starter]];
  return next;
}

/** A logo file as a data URL, or a message saying why it cannot be used. */
export async function readLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw Error("Use a PNG or JPEG image for the logo.");
  if (file.size > 290_000) throw Error("The logo is too large. Use an image under 280 kB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:${file.type};base64,${btoa(bin)}`;
}
