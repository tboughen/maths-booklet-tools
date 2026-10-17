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

export type LabelDraft = {
  ref: string;
  value: Label;
  text: string;
  mark: Envelope["document"]["angles"][number]["mark"];
  ticks: number;
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
    dashed: kind === "e" ? edge!.dashed : false,
    footName:
      kind === "h" ? e.document.heights.find((h) => h.id === id)!.footName : "",
  };
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
    source.schemaVersion = 2;
    source.rendererVersion = "triangle-2";
  }
  const n = editLabel(source, draft.ref, { ...draft.value, text: draft.text }),
    [kind, id] = draft.ref.split(":");
  if (kind === "a")
    n.document.angles.find((a) => a.id === id)!.mark = draft.mark;
  if (kind === "e") {
    const edge = n.document.edges.find((a) => a.id === id)!;
    edge.ticks = draft.ticks;
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
