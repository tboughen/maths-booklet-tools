import type { BankCut, BankQuestion } from "./model";

/** One cut as served: a stem shown as context, or a part pupils answer. */
export interface ServedCut { cut: BankCut; role: "context" | "part"; /** True for a part brought in because a chosen part needs it. */ added: boolean }

export interface ServedParts {
  cuts: ServedCut[];
  /** The catalogue part labels the served parts cover. */
  parts: string[];
  marks: number;
  /** "(b) and (c)": the printed labels of the served parts. */
  label: string;
  /** "Part (b)" or "Parts (b) and (c)". */
  title: string;
}

/**
 * The cuts that serve the given catalogue parts of a question on their own: each part cut covering
 * one of them, every part those need as context or for an earlier answer (so a part is never served
 * without them), and the stems they need, in paper order. Undefined when the question has no cuts,
 * none of the parts is cut separately, or the parts would make up the whole question anyway.
 */
export function servedParts(question: BankQuestion, wanted: string[]): ServedParts | undefined {
  const cuts = question.cuts;
  if (!cuts?.length) return undefined;
  const byId = new Map(cuts.map(c => [c.id, c]));
  const chosen = new Set(cuts.filter(c => c.kind === "part" && c.parts.some(p => wanted.includes(p))).map(c => c.id));
  if (!chosen.size) return undefined;
  const asked = new Set(chosen);
  const queue = [...chosen];
  while (queue.length) {
    const cut = byId.get(queue.shift()!);
    for (const id of [...(cut?.context ?? []), ...(cut?.requiresAnswerTo ?? [])]) {
      if (chosen.has(id)) continue;
      chosen.add(id);
      queue.push(id);
    }
  }
  const served = cuts.filter(c => chosen.has(c.id));
  const partCuts = served.filter(c => c.kind === "part");
  if (partCuts.length === cuts.filter(c => c.kind === "part").length) return undefined;
  const parts = partCuts.flatMap(c => c.parts);
  const marks = question.parts.filter(p => parts.includes(p.label)).reduce((n, p) => n + p.marks, 0);
  const labels = partCuts.map(c => c.label);
  const label = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
  return {
    cuts: served.map(cut => ({cut, role: cut.kind === "stem" ? "context" : "part", added: cut.kind === "part" && !asked.has(cut.id)})),
    parts,
    marks,
    label,
    title: `${labels.length === 1 ? "Part" : "Parts"} ${label}`,
  };
}

/** "Comes with (a)" for a part added because another part needs it. */
export const addedNote = (served: ServedParts) => {
  const added = served.cuts.filter(c => c.added).map(c => c.cut.label);
  return added.length ? `Comes with ${added.length === 1 ? added[0] : `${added.slice(0, -1).join(", ")} and ${added.at(-1)}`}.` : "";
};
