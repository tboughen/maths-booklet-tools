/**
 * Every fillable or answer-bearing slot of a saved diagram, in the shared answer-state vocabulary
 * (packages/envelope-core/src/answer-state.ts, improvement item W3). Each family keeps its own
 * saved fields; this module only READS them, so the answers copy, the answer-leak check, the
 * connector and the editors agree on what a slot is. It never derives, fills or changes anything.
 */
import { slot, type AnswerSlot, type AnswerState } from "../../envelope-core/src/answer-state";
import type { DiagramKind } from "./registry";

type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Calls visit on every object in the tree with its dotted path ("document.rows.0.cells.1"). */
function walk(value: unknown, path: string, visit: (node: Node, path: string) => boolean | void) {
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}.${i}`, visit));
  else if (isNode(value)) {
    // A visitor that returns true has read the node in full: its children are not slots.
    if (visit(value, path)) return;
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, visit);
  }
}

/** A {text, show} label (probability trees, frequency trees, two-way tables) or a {value, show} chart cell. */
function shown(node: Node, path: string, out: AnswerSlot[]) {
  if (node.show !== "show" && node.show !== "hidden") return false;
  const text = typeof node.text === "string" ? node.text : str(node.value);
  out.push(node.show === "hidden" ? slot(path, "hidden", text) : slot(path, "supplied", text));
  return true;
}

const visitors: Record<DiagramKind, (doc: Node, out: AnswerSlot[]) => void> = {
  graph(doc, out) {
    const objects = Array.isArray(doc.objects) ? (doc.objects as Node[]) : [];
    objects.forEach((o, i) => {
      if (o.answerOnly !== true) return;
      const labels = Array.isArray(o.labels) ? (o.labels as Node[]).map((l) => str(l.text)).filter(Boolean) : [];
      const text = str(o.name) || labels.join(", ") || `${str(o.kind)} ${str(o.id)}`;
      out.push(slot(`document.objects.${i}`, "hidden", text));
    });
  },
  "ratio-table"(doc, out) {
    walk(doc.rows, "document.rows", (c, path) => {
      if (!/\.cells\.\d+$/.test(path)) return;
      const states: Record<string, AnswerState> = { number: "supplied", empty: "blank", "answer-line": "answerLine" };
      if (c.kind === "hidden") out.push(slot(path, c.line === true ? "answerLine" : "hidden", str(c.value)));
      else if (states[str(c.kind)]) out.push(slot(path, states[str(c.kind)], str(c.value)));
      return true;
    });
    walk(doc.transitions, "document.transitions", (t, path) => {
      if (typeof t.factor !== "string") return;
      // A hidden operation prints an answer line for the pupil and the label on the answers copy.
      out.push(slot(path, t.hidden === true ? "answerLine" : "supplied", t.factor));
      return true;
    });
  },
  "value-graph"(doc, out) {
    walk(doc.columns, "document.columns", (c, path) => {
      if (!isNode(c.y)) return;
      const y = c.y, at = `${path}.y`;
      if (y.kind === "value") out.push(slot(at, "supplied", str(y.value)));
      else if (y.kind === "blank") out.push(slot(at, "blank"));
      else if (y.kind === "answer-line") out.push(slot(at, "answerLine"));
      return true;
    });
  },
  cuboids(doc, out) {
    walk(doc.shapes, "document.shapes", (l, path) => {
      if (typeof l.mode !== "string" || typeof l.text !== "string" || !/\.(labels\.\w+|appearance\.area)$/.test(path)) return;
      // "hidden" here means no label at all: cuboids store no answers, so it is not a slot.
      if (l.mode === "blank") out.push(slot(path, "blank"));
      else if (l.mode !== "hidden") out.push({ path, state: "supplied", text: l.text || l.mode });
      return true;
    });
  },
  "number-line"(doc, out) {
    const t = isNode(doc.teaching) ? doc.teaching : {};
    const labels = isNode(t.labels) ? t.labels : {};
    for (const [value, state] of Object.entries(labels)) {
      const at = `document.teaching.labels.${value}`;
      // A hidden or answer-line tick's saved answer is its own number, not a derived one.
      if (state === "hidden") out.push(slot(at, "hidden", value));
      else if (state === "answer-line") out.push(slot(at, "answerLine", value));
      else out.push(slot(at, "supplied", value));
    }
    // A second scale's hidden and answer-line labels are answers too (U109).
    const secondary = isNode(doc.secondary) && isNode(doc.secondary.labels) ? doc.secondary.labels : {};
    for (const [value, state] of Object.entries(secondary)) {
      const at = `document.secondary.labels.${value}`;
      if (state === "hidden") out.push(slot(at, "hidden", value));
      else if (state === "answer-line") out.push(slot(at, "answerLine", value));
      else out.push(slot(at, "supplied", value));
    }
    if (doc.solution) out.push({ path: "document.solution", state: t.solutionVisible === false ? "hidden" : "supplied", text: str((doc.solution as Node).kind) });
    const answer = str(t.answer);
    if (answer && t.answerVisible === true) out.push(slot("document.teaching.answer", "supplied", answer));
    else if (answer) out.push(slot("document.teaching.answer", "hidden", answer));
    else if (Number(t.responseLines) > 0) out.push(slot("document.teaching.answer", "answerLine"));
  },
  venn(doc, out) {
    walk(doc, "document", (n, path) => {
      if (n.visibility !== "show" && n.visibility !== "hidden" && n.visibility !== "line") return;
      const text = n.kind === "empty" ? "" : str(n.text);
      out.push(slot(path, n.visibility === "hidden" ? "hidden" : n.visibility === "line" ? "answerLine" : "supplied", text));
      return true;
    });
  },
  "algebra-grid"(doc, out) {
    walk(doc.rows, "document.rows", (c, path) => {
      if (typeof c.hidden !== "boolean" || !("value" in c)) return;
      out.push(c.hidden ? slot(path, "hidden", str(c.value)) : slot(path, "supplied", str(c.value)));
      return true;
    });
    // The final answer prints on both copies when shown; a hidden one prints on neither (it may
    // belong to earlier entries), so it is not an answer slot.
    const answer = str(doc.answer);
    if (answer && doc.answerVisible === true) out.push(slot("document.answer", "supplied", answer));
  },
  "bar-model"(doc, out) {
    walk(doc, "document", (l, path) => {
      const states: Record<string, AnswerState> = { value: "supplied", blank: "blank", line: "answerLine", hidden: "hidden" };
      if (typeof l.text !== "string" || typeof l.state !== "string") return;
      // "question" prints a "?" for the pupil: that mark is supplied.
      if (l.state === "question") out.push(slot(path, "supplied", "?"));
      else if (states[l.state]) out.push(slot(path, states[l.state], l.state === "blank" ? "" : l.text));
      return true;
    });
  },
  charts(doc, out) {
    walk(doc.series, "document.series", (c, path) => (/\.values\.\d+$/.test(path) ? shown(c, path, out) : undefined));
  },
  "probability-tree"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  "frequency-tree"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  construction(doc, out) {
    // Answer points and objects (constructions, loci, bearings) print only on the answers copy;
    // a hidden {text, show} label prints a gap for the pupil and its text on the answers copy.
    for (const list of ["points", "objects"] as const) {
      const items = Array.isArray(doc[list]) ? (doc[list] as Node[]) : [];
      items.forEach((o, i) => {
        const path = `document.${list}.${i}`;
        // An answer with a label (a length, an angle, a bearing) holds that label as its saved answer.
        if (o.role === "answer" && isNode(o.label) && str(o.label.text)) out.push(slot(`${path}.label`, "hidden", str(o.label.text)));
        else if (o.role === "answer") out.push(slot(path, "hidden", str(o.id) || str(o.type)));
        else if (isNode(o.label) && str(o.label.text)) shown(o.label, `${path}.label`, out);
      });
    }
    if (isNode(doc.caption) && str(doc.caption.text)) shown(doc.caption, "document.caption", out);
  },
  elevations(doc, out) {
    // An answer panel is an empty grid for the pupil and the drawn view on the answers copy.
    const panels = Array.isArray(doc.panels) ? (doc.panels as Node[]) : [];
    panels.forEach((p, i) => {
      const path = `document.panels.${i}`;
      if (p.state === "answer") out.push(slot(path, "hidden", str(p.view)));
      else if (p.state === "blank") out.push(slot(path, "blank"));
      else out.push(slot(path, "supplied", str(p.view)));
      if (isNode(p.label) && p.label.show === "hidden" && str(p.label.text)) out.push(slot(`${path}.label`, "hidden", str(p.label.text)));
    });
  },
  angles(doc, out) {
    // A given size (value) is supplied; any other label with a saved answer prints that answer on
    // the answers copy, so it is hidden (or an answer line); a letter alone is supplied text.
    const angles = Array.isArray(doc.angles) ? (doc.angles as Node[]) : [];
    angles.forEach((a, i) => {
      const path = `document.angles.${i}.label`,
        l = isNode(a.label) ? a.label : {};
      const text = str(l.text),
        answer = str(l.answer);
      if (l.state === "value") out.push(slot(path, "supplied", text));
      else if (l.state === "answer-line") out.push(slot(path, "answerLine", answer));
      else if (answer) out.push(slot(path, "hidden", answer));
      else if (l.state === "symbol") out.push(slot(path, "supplied", text));
      else out.push(slot(path, "blank"));
    });
  },
  area(doc, out) {
    // As angles: a given length is supplied; any other label with a saved answer is hidden (or an answer line).
    const labels = Array.isArray(doc.labels) ? (doc.labels as Node[]) : [];
    labels.forEach((l, i) => {
      const path = `document.labels.${i}`,
        text = str(l.text),
        answer = str(l.answer);
      if (l.state === "value") out.push(slot(path, "supplied", text));
      else if (l.state === "answer-line") out.push(slot(path, "answerLine", answer));
      else if (answer) out.push(slot(path, "hidden", answer));
      else if (l.state === "symbol") out.push(slot(path, "supplied", text));
      else out.push(slot(path, "blank"));
    });
  },
  "sample-space"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  "factor-tree"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  "function-machine"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  nets(doc, out) {
    const nets = Array.isArray(doc.nets) ? (doc.nets as Node[]) : [];
    nets.forEach((n, i) => {
      const base = `document.nets.${i}`;
      const label = (l: unknown, path: string, onHidden = false) => {
        if (!isNode(l) || !str(l.text)) return;
        out.push(slot(path, onHidden || l.show === "hidden" ? "hidden" : "supplied", str(l.text)));
      };
      label(n.caption, `${base}.caption`);
      (Array.isArray(n.faces) ? (n.faces as Node[]) : []).forEach((f, j) => {
        const path = `${base}.faces.${j}`,
          hidden = f.show === "hidden";
        // A hidden face is itself an answer: pupils draw it.
        out.push(slot(path, hidden ? "hidden" : "supplied", `face ${str(f.id)}`));
        label(f.label, `${path}.label`, hidden);
        const m = isNode(f.mark) ? f.mark : {};
        if (str(m.kind) && m.kind !== "none") out.push(slot(`${path}.mark`, hidden || m.show === "hidden" ? "hidden" : "supplied", str(m.kind)));
      });
      for (const key of ["vertices", "edges"] as const)
        (Array.isArray(n[key]) ? (n[key] as Node[]) : []).forEach((v, j) => label(v.label, `${base}.${key}.${j}.label`));
    });
  },
  "two-way-table"(doc, out) {
    walk(doc, "document", (n, path) => shown(n, path, out));
  },
  triangle(doc, out) {
    walk(doc, "document", (l, path) => {
      if (typeof l.state !== "string" || typeof l.answerVisible !== "boolean") return;
      const answer = str(l.answer);
      if (answer && l.answerVisible) out.push(slot(path, "supplied", answer));
      else if (l.state === "value" || l.state === "symbol") out.push(slot(path, "supplied", str(l.text)));
      else if (l.state === "answer-line") out.push(slot(path, "answerLine", answer));
      // A blank label with a saved answer prints that answer on the answers copy: it is hidden.
      else if (l.state === "hidden" || answer) out.push(slot(path, "hidden", answer));
      else out.push(slot(path, "blank"));
      return true;
    });
  },
};

/** The answer slots of one saved diagram envelope, in document order. */
export function answerSlots(kind: DiagramKind, envelope: unknown): AnswerSlot[] {
  const doc = isNode(envelope) && isNode(envelope.document) ? envelope.document : {};
  const out: AnswerSlot[] = [];
  visitors[kind](doc, out);
  return out;
}
