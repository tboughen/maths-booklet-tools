import {
  editLabel,
  label,
  getLabel,
  textOf,
  validate,
  point,
  dot,
  sub,
  unit,
  type Envelope,
  type Label,
} from "../../packages/triangle-core/src";
import type { Visibility } from "../editor-kit/visibility";

export type LabelDraft = {
  ref: string;
  value: Label;
  text: string;
  mark: Envelope["document"]["angles"][number]["mark"];
  ticks: number;
  arrows: number;
  dashed: boolean;
  footName: string;
};

export function labelDraft(e: Envelope, ref: string): LabelDraft {
  const l = ref.startsWith("r:")
      ? (e.document.triangles.find((t) => `r:${t.id}` === ref)!.area ??
        label("", "blank", "cm²"))
      : getLabel(e, ref),
    [kind, id] = ref.split(":"),
    angle = e.document.angles.find((a) => a.id === id),
    edge = e.document.edges.find((a) => a.id === id);
  return {
    ref,
    value: structuredClone(l),
    text: textOf(e, l),
    mark: kind === "a" ? angle!.mark : "none",
    ticks: kind === "e" ? edge!.ticks : 0,
    arrows: kind === "e" ? (edge!.arrows ?? 0) : 0,
    dashed: kind === "e" ? edge!.dashed : false,
    footName:
      kind === "h" ? e.document.heights.find((h) => h.id === id)!.footName : "",
  };
}

/** What pupils see of a triangle label (the usability pilot's three words): a given or an unknown shows; a blank
 * or an answer line is a pupil space; a hidden label is left out. */
export const seesOfLabel = (l: Label): Visibility =>
  l.state === "hidden" ? "omit" : l.state === "blank" || l.state === "answer-line" ? "hidden" : "show";
// This session's last state of each kind for a label, so Show after a pupil space brings back an unknown x, and a
// pupil space after Show brings back its answer line.
const lastState = new Map<string, Label["state"]>();
/** A new diagram starts with no memory of the last one's labels. */
const away = new Set<string>();
export const forgetLabelStates = () => {
  lastState.clear();
  away.clear();
};
/** The teacher made this label a pupil space (or left it out) this session: typing then never makes it print. */
export const chosenAway = (ref: string) => away.has(ref);
/** The saved state for a new choice of what pupils see. */
export function stateFor(ref: string, l: Label, v: Visibility): Label["state"] {
  const now = seesOfLabel(l);
  if (v === "show") away.delete(ref);
  else away.add(ref);
  if (now === v) return l.state;
  lastState.set(`${ref}:${now}`, l.state);
  return v === "omit" ? "hidden" : (lastState.get(`${ref}:${v}`) ?? (v === "show" ? "value" : "blank"));
}

export function labelState(
  draft: LabelDraft,
  state: Label["state"],
): Partial<LabelDraft> {
  return {
    value: { ...draft.value, state },
    text:
      state === "symbol" && !draft.text && !draft.value.shared
        ? "x"
        : draft.text,
  };
}

export function applyLabelDraft(e: Envelope, draft: LabelDraft) {
  let source = e;
  if (
    draft.ref.startsWith("r:") &&
    !e.document.triangles.find((t) => `r:${t.id}` === draft.ref)?.area
  ) {
    source = structuredClone(e);
    const t = source.document.triangles.find((t) => `r:${t.id}` === draft.ref);
    if (!t) throw Error("Choose an existing triangle for this area.");
    t.area = label("", "blank", "cm²");
  }
  const n = editLabel(source, draft.ref, { ...draft.value, text: draft.text }),
    [kind, id] = draft.ref.split(":");
  if (kind === "a")
    n.document.angles.find((a) => a.id === id)!.mark = draft.mark;
  if (kind === "e") {
    const edge = n.document.edges.find((a) => a.id === id)!;
    edge.ticks = draft.ticks;
    // No arrows leaves the field out, so the saved file is unchanged.
    if (draft.arrows) edge.arrows = draft.arrows;
    else delete edge.arrows;
    edge.dashed = draft.dashed;
  }
  if (kind === "h")
    n.document.heights.find((h) => h.id === id)!.footName = draft.footName;
  return validate(n);
}

export function canMarkRight(e: Envelope, ref: string) {
  const a = e.document.angles.find((a) => `a:${a.id}` === ref);
  return (
    !!a &&
    Math.abs(
      dot(
        unit(sub(point(e, a.from), point(e, a.vertex))),
        unit(sub(point(e, a.to), point(e, a.vertex))),
      ),
    ) <= 1e-5
  );
}
