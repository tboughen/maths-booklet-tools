/**
 * The answer slots of a worksheet or booklet in the shared answer-state vocabulary (W3): answer
 * lines, table cells, choice answers and every slot of each embedded diagram. Read-only.
 */
import { slot, suppliedState, type AnswerSlot } from "../../envelope-core/src/answer-state";
import { answerSlots } from "../../diagram-core/src/answer-slots";
import { DIAGRAM_KINDS, type DiagramKind } from "../../diagram-core/src/registry";
import { diagramEnvelope } from "./schema";

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function item(node: Node, path: string, out: AnswerSlot[]) {
  if (node.type === "answerLine") {
    out.push(slot(path, "answerLine", str(node.answer)));
    return true;
  }
  if (node.type === "table" && Array.isArray(node.rows)) {
    (node.rows as unknown[][]).forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!isNode(cell)) return;
        const at = `${path}.rows.${r}.${c}`, text = str(cell.text);
        if (cell.state === "hidden") out.push(slot(at, "hidden", text));
        else if (cell.state === "blank") out.push(slot(at, "blank"));
        else out.push({ path: at, state: suppliedState(text), text });
      }),
    );
    return true;
  }
  if (node.type === "choice" && Array.isArray(node.options)) {
    // The pupil circles or ticks: the saved choice prints only on the answers copy.
    const i = typeof node.answer === "number" ? node.answer : -1;
    out.push(i >= 0 ? slot(`${path}.answer`, "hidden", str(node.options[i])) : slot(`${path}.answer`, "blank"));
    return true;
  }
  if (node.type === "diagram" && isNode(node.diagram)) {
    const d = node.diagram;
    if (!(DIAGRAM_KINDS as readonly string[]).includes(str(d.tool))) return true;
    const kind = d.tool as DiagramKind;
    let envelope: unknown = d.envelope;
    if (envelope === undefined)
      try {
        envelope = diagramEnvelope({ tool: kind, spec: d.spec });
      } catch {
        return true; // An invalid draft has its own specific error elsewhere.
      }
    for (const s of answerSlots(kind, envelope)) out.push({ ...s, path: `${path}.diagram.envelope.${s.path}` });
    return true;
  }
  return false;
}

/** Every answer slot of a saved worksheet or booklet, in document order. */
export function resourceAnswerSlots(resource: unknown): AnswerSlot[] {
  const out: AnswerSlot[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}.${i}`));
    else if (isNode(value)) {
      if (typeof value.type === "string" && item(value, path, out)) return;
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    }
  };
  walk(isNode(resource) ? resource.document : undefined, "document");
  return out;
}
