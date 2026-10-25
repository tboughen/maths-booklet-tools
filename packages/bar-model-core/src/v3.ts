import { z } from "zod";
import * as legacy from "./index";
import fontMetrics from "./v2-font-metrics.json" with { type: "json" };
import { mathematicalLine, WRITING } from "./math-text";
import * as v2 from "./v2";
import { guidance } from "../../graph-core/src/print-guidance";

// Frozen v1/v2 renderers remain separate; this profile reserves actual handwriting space.
export const idSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);
export const slots = ["inside", "above", "below"] as const;
export const fills = ["none", "neutral", "blue", "green", "amber"] as const;
export const partSchema = z
  .object({
    id: idSchema,
    weight: z.string().max(24),
    labels: z
      .object({
        inside: legacy.labelSchema,
        above: legacy.labelSchema.optional(),
        below: legacy.labelSchema.optional(),
      })
      .strict(),
    fill: z.enum(fills),
  })
  .strict();
export const barSchema = z
  .object({
    id: idSchema,
    name: legacy.labelSchema,
    offset: z.string().max(24),
    parts: z.array(partSchema).min(1).max(24),
  })
  .strict();
export const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("whole"), barId: idSchema }).strict(),
  z
    .object({
      kind: z.literal("range"),
      from: legacy.anchorSchema,
      to: legacy.anchorSchema,
    })
    .strict(),
]);
export const annotationSchema = z
  .object({
    id: idSchema,
    scope: scopeSchema,
    label: legacy.labelSchema,
    decoration: z.enum(["none", "brace", "dimension"]),
    placement: z.enum(["above", "below", "inside", "between"]),
  })
  .strict();
export const captionSchema = z
  .object({
    id: idSchema,
    label: legacy.labelSchema,
    alignment: z.enum(["left", "centre", "right"]),
    format: z.enum(["maths", "plain"]).default("maths"),
  })
  .strict();
export const presentationSchema = z
  .object({
    unitMm: z.number().min(4).max(16),
    barHeightMm: z.number().min(8).max(24),
    fontPt: z.number().min(10).max(14),
    titlePt: z.number().min(12).max(18),
    nameWidthMm: z.number().min(8).max(60).optional(),
    output: z.enum(["grey", "colour"]),
  })
  .strict();
export const schema = z
  .object({
    kind: z.literal("bar-model"),
    schemaVersion: z.literal(3),
    rendererVersion: z.literal("bar-model-3"),
    styleProfile: z.literal("lesson-v3"),
    document: z
      .object({
        bars: z.array(barSchema).min(1).max(6),
        annotations: z.array(annotationSchema).max(18),
        presentation: presentationSchema,
        title: legacy.labelSchema.optional(),
        captions: z.array(captionSchema).max(3),
        sourceId: z.string().max(100).optional(),
      })
      .strict(),
  })
  .strict();
export type Envelope = z.infer<typeof schema>;
export type Bar = z.infer<typeof barSchema>;
export type Part = z.infer<typeof partSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Slot = (typeof slots)[number];
export type Label = legacy.Label;
export const label = legacy.label;
export const visible = legacy.visible;
const glyphs: Record<string, number[]> = fontMetrics.entries;
export function plainMeasure(s: string, font: number) {
  if (!s.trim()) return { width: 0, height: 0, left: 0, right: 0, advance: 0 };
  let advance = 0,
    left = Infinity,
    right = -Infinity,
    low = 0,
    high = 0;
  for (const char of s) {
    const [width, x1, y1, x2, y2] = glyphs[char] ?? [1, 0, -0.25, 1, 1];
    left = Math.min(left, advance + x1);
    right = Math.max(right, advance + x2);
    low = Math.min(low, y1);
    high = Math.max(high, y2);
    advance += width;
  }
  return {
    left: left * font,
    right: right * font,
    advance: advance * font,
    width: Math.max(advance, advance - 2 * left, 2 * right - advance) * font,
    height:
      Math.max(1.2, 2 * Math.abs(0.32 - high), 2 * Math.abs(0.32 - low)) * font,
  };
}
export const fraction = (s: string) =>
  s.match(/^(-?\d+|[A-Za-z]|\d+[A-Za-z])\/(\d+)$/);
type Q = ReturnType<typeof legacy.exact>;
const number = (a: Q) => Number(a.n) / Number(a.d);
function rational(n: bigint, d: bigint): string {
  function gcd(a: bigint, b: bigint): bigint {
    return b ? gcd(b, a % b) : a < 0n ? -a : a;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  const s = d === 1n ? String(n) : `${n}/${d}`;
  legacy.exact(s);
  return s;
}
export function sum(weights: string[]) {
  let n = 0n,
    d = 1n;
  for (const s of weights) {
    const a = legacy.exact(s);
    n = n * a.d + a.n * d;
    d *= a.d;
    const v = legacy.exact(rational(n, d));
    n = v.n;
    d = v.d;
  }
  return rational(n, d);
}
export function divided(total: string, count: number) {
  const a = legacy.exact(total);
  return rational(a.n, a.d * BigInt(count));
}
export function boundary(e: Envelope, a: legacy.Anchor): Q {
  const b = e.document.bars.find((b) => b.id === a.barId);
  if (!b) throw Error(`Unknown bar ${a.barId}.`);
  const i = b.parts.findIndex((p) => p.id === a.partId);
  if (i < 0) throw Error(`Unknown section ${a.partId}.`);
  return legacy.exact(
    sum([
      b.offset,
      ...b.parts.slice(0, i + (a.edge === "end" ? 1 : 0)).map((p) => p.weight),
    ]),
  );
}
export function endpoints(e: Envelope, a: Annotation) {
  if (a.scope.kind === "range") return { from: a.scope.from, to: a.scope.to };
  const b = e.document.bars.find(
    (b) => b.id === (a.scope as { barId: string }).barId,
  );
  if (!b) throw Error("Unknown whole bar.");
  return {
    from: { barId: b.id, partId: b.parts[0].id, edge: "start" as const },
    to: { barId: b.id, partId: b.parts.at(-1)!.id, edge: "end" as const },
  };
}
export function validate(raw: unknown): Envelope {
  const e = schema.parse(raw),
    ids = new Set<string>();
  let count = 0;
  const unique = (s: string) => {
    if (ids.has(s)) throw Error(`Duplicate ID ${s}.`);
    ids.add(s);
  };
  for (const b of e.document.bars) {
    unique(b.id);
    const offset = legacy.exact(b.offset);
    if (offset.n < 0n) throw Error("Bar offsets must be nonnegative.");
    b.offset = rational(offset.n, offset.d);
    for (const p of b.parts) {
      unique(p.id);
      const w = legacy.exact(p.weight);
      if (w.n <= 0n) throw Error("Section lengths must be positive.");
      p.weight = rational(w.n, w.d);
      count++;
    }
  }
  if (count > 96) throw Error("Use at most 96 sections overall.");
  for (const a of e.document.annotations) {
    unique(a.id);
    const ends = endpoints(e, a),
      x1 = boundary(e, ends.from),
      x2 = boundary(e, ends.to);
    if (x2.n * x1.d <= x1.n * x2.d)
      throw Error(`Annotation ${a.id} must run left to right.`);
    const i = e.document.bars.findIndex((b) => b.id === ends.from.barId),
      j = e.document.bars.findIndex((b) => b.id === ends.to.barId);
    if (a.placement === "between" && (i === j || Math.abs(i - j) !== 1))
      throw Error(
        `Between-bar annotation ${a.id} needs adjacent endpoint bars. Choose outside placement, remove it, or cancel.`,
      );
    if (a.placement === "inside" && (i !== j || a.decoration !== "none"))
      throw Error("Inside labels require one bar and no decoration.");
  }
  e.document.captions.forEach((c) => unique(c.id));
  if (new TextEncoder().encode(JSON.stringify(e)).length > 32768)
    throw Error(
      "Use an editable definition up to 32 KiB; reduce saved text or structure.",
    );
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function upgrade(source: legacy.Envelope | v2.Envelope): Envelope {
  const e =
    source.schemaVersion === 1 ? v2.upgrade(source) : v2.validate(source);
  return validate({
    ...e,
    schemaVersion: 3,
    rendererVersion: "bar-model-3",
    styleProfile: "lesson-v3",
    document: {
      ...e.document,
      captions: e.document.captions.map((c) => ({ ...c, format: "maths" })),
    },
  });
}
export const starters = [
  "part-whole",
  "comparison",
  "equal-sections",
  "inline-ratio",
] as const;
export function fresh(
  starter: (typeof starters)[number] = "part-whole",
  count = 5,
  ratio = [3, 5],
  partitioned = true,
  comparisonLengths = [5, 3],
): Envelope {
  const bars: Bar[] = [];
  const make = (id: string, weights: number[]) => {
    const b: Bar = {
      id,
      name: label(),
      offset: "0",
      parts: weights.map((w, i) => ({
        id: `${id}p${i + 1}`,
        weight: String(w),
        labels: { inside: label() },
        fill: "none",
      })),
    };
    bars.push(b);
    return b;
  };
  if (
    starter === "equal-sections" &&
    (!Number.isInteger(count) || count < 1 || count > 24)
  )
    throw Error("Choose 1 to 24 equal sections.");
  let annotations: Annotation[] = [];
  if (starter === "comparison") {
    if (
      comparisonLengths.length !== 2 ||
      comparisonLengths.some((n) => !Number.isInteger(n) || n < 1 || n > 24) ||
      comparisonLengths[0] <= comparisonLengths[1]
    )
      throw Error(
        "Choose two whole-number comparison lengths from 1 to 24, longer bar first.",
      );
    const b = make(
        "b1",
        partitioned
          ? Array(comparisonLengths[0]).fill(1)
          : [comparisonLengths[0]],
      ),
      c = make(
        "b2",
        partitioned
          ? Array(comparisonLengths[1]).fill(1)
          : [comparisonLengths[1]],
      );
    annotations = [
      {
        id: "difference",
        scope: {
          kind: "range",
          from: { barId: c.id, partId: c.parts.at(-1)!.id, edge: "end" },
          to: { barId: b.id, partId: b.parts.at(-1)!.id, edge: "end" },
        },
        label: label(),
        decoration: "dimension",
        placement: "between",
      },
    ];
  } else {
    if (
      starter === "inline-ratio" &&
      (ratio.length < 2 ||
        ratio.length > 6 ||
        ratio.some((n) => !Number.isInteger(n) || n < 1) ||
        ratio.reduce((a, b) => a + b, 0) > 24)
    )
      throw Error(
        "Use 2 to 6 positive integer groups with at most 24 sections.",
      );
    const n =
      starter === "part-whole"
        ? 2
        : starter === "inline-ratio"
          ? ratio.reduce((a, b) => a + b, 0)
          : count;
    const b = make("b1", Array(n).fill(1));
    if (starter === "inline-ratio") {
      let start = 0;
      annotations = ratio.map((n, i) => {
        const from = start;
        start += n;
        return {
          id: `group${i + 1}`,
          scope: {
            kind: "range",
            from: { barId: b.id, partId: b.parts[from].id, edge: "start" },
            to: { barId: b.id, partId: b.parts[start - 1].id, edge: "end" },
          },
          label: label(),
          decoration: "brace",
          placement: "above",
        };
      });
    } else
      annotations = [
        {
          id: "whole",
          scope: { kind: "whole", barId: b.id },
          label: label(),
          decoration: "brace",
          placement: "above",
        },
      ];
  }
  return validate({
    kind: "bar-model",
    schemaVersion: 3,
    rendererVersion: "bar-model-3",
    styleProfile: "lesson-v3",
    document: {
      bars,
      annotations,
      captions: [],
      presentation: {
        unitMm: 10,
        barHeightMm: 12,
        fontPt: 12,
        titlePt: 14,
        output: "grey",
      },
    },
  });
}

export function measure(l: Label, font: number, linear = false) {
  if (l.state === "line")
    return { width: WRITING.lengthMm, height: WRITING.heightMm };
  const s = visible(l);
  // Standalone section fractions use the same measured typesetter as working.
  return mathematicalLine(s, font, !linear && !!fraction(s));
}
function captionMeasure(
  c: Envelope["document"]["captions"][number],
  font: number,
) {
  if (c.label.state === "line") return measure(c.label, font);
  return mathematicalLine(visible(c.label), font, c.format === "maths");
}
export function effectiveBarHeight(e: Envelope) {
  const insideLine =
    e.document.bars.some((b) =>
      b.parts.some((p) => p.labels.inside.state === "line"),
    ) ||
    e.document.annotations.some(
      (a) => a.placement === "inside" && a.label.state === "line",
    );
  return Math.max(e.document.presentation.barHeightMm, insideLine ? 20 : 0);
}
export function allLabels(e: Envelope): Label[] {
  const d = e.document;
  return [
    ...d.bars.flatMap((b) => [
      b.name,
      ...b.parts.flatMap((p) => Object.values(p.labels)),
    ]),
    ...d.annotations.map((a) => a.label),
    ...(d.title ? [d.title] : []),
    ...d.captions.map((c) => c.label),
  ];
}
export function warnings(e: Envelope) {
  return allLabels(e).some((l) => l.text && visible(l) !== l.text)
    ? [
        "Editable files and links retain saved text that is not visible in pupil artwork, including answers.",
      ]
    : [];
}
type Candidate = {
  annotation: Annotation;
  x1: number;
  x2: number;
  key1: string;
  key2: string;
  textLeft: number;
  textRight: number;
  labelHeight: number;
  height: number;
  lane: number;
  y: number;
  textY: number;
};
export function layout(e: Envelope) {
  const d = e.document,
    p = d.presentation,
    font = (p.fontPt * 25.4) / 72,
    pad = 4.2,
    issues: string[] = [];
  const unsupported = [
    ...new Set(
      allLabels(e).flatMap((l) =>
        Array.from(visible(l)).filter((char) => !glyphs[char]),
      ),
    ),
  ];
  if (unsupported.length)
    issues.push(
      `The bundled print fonts do not support ${unsupported.map((char) => `U+${char.codePointAt(0)!.toString(16).toUpperCase()}`).join(", ")}. Change that visible text or hide the saved label; no glyph has been silently substituted.`,
    );
  for (const c of d.captions) {
    try {
      captionMeasure(c, font);
    } catch (err) {
      issues.push(
        `Calculation ${c.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  const barHeightMm = effectiveBarHeight(e);
  const names = d.bars.map((b) => measure(b.name, font, true));
  const gutter = names.some((n) => n.width > 0)
    ? (p.nameWidthMm ?? Math.min(40, Math.max(...names.map((n) => n.width)))) +
      3
    : 0;
  const left = pad + gutter;
  const candidates = d.annotations.map((annotation) => {
    const ends = endpoints(e, annotation),
      a = boundary(e, ends.from),
      b = boundary(e, ends.to),
      x1 = left + number(a) * p.unitMm,
      x2 = left + number(b) * p.unitMm,
      m = measure(annotation.label, font);
    return {
      annotation,
      x1,
      x2,
      key1: rational(a.n, a.d),
      key2: rational(b.n, b.d),
      textLeft: (x1 + x2 - m.width) / 2 - 0.7,
      textRight: (x1 + x2 + m.width) / 2 + 0.7,
      labelHeight: m.height,
      height:
        m.height +
        (annotation.decoration === "none"
          ? 0
          : annotation.decoration === "brace"
            ? 5
            : 3) +
        1.5,
      lane: 0,
      y: 0,
      textY: 0,
    };
  });
  for (const a of candidates) {
    if (
      a.annotation.placement === "between" &&
      a.labelHeight &&
      a.textRight - a.textLeft > a.x2 - a.x1 - 1
    )
      issues.push(
        `Between label ${a.annotation.id} needs wider shared units or outside placement to clear its endpoint guides.`,
      );
  }
  function pack(items: Candidate[]) {
    const lanes: Candidate[][] = [];
    const sorted = [...items].sort(
      (a, b) =>
        Number(a.annotation.scope.kind === "whole") -
          Number(b.annotation.scope.kind === "whole") ||
        a.x1 - b.x1 ||
        a.x2 - a.x1 - (b.x2 - b.x1) ||
        (a.annotation.id < b.annotation.id
          ? -1
          : a.annotation.id > b.annotation.id
            ? 1
            : 0),
    );
    for (const a of sorted) {
      let i = 0;
      for (; i < lanes.length; i++)
        if (
          lanes[i].every((b) => {
            const strokes =
              a.annotation.decoration !== "none" &&
              b.annotation.decoration !== "none";
            const strokeOverlap =
              strokes && Math.max(a.x1, b.x1) < Math.min(a.x2, b.x2);
            const textOverlap =
              a.labelHeight > 0 &&
              b.labelHeight > 0 &&
              Math.max(a.textLeft, b.textLeft) <
                Math.min(a.textRight, b.textRight);
            const disjoint =
              a.x2 < b.x1 ||
              b.x2 < a.x1 ||
              a.key2 === b.key1 ||
              b.key2 === a.key1;
            return !textOverlap && !strokeOverlap && (!strokes || disjoint);
          })
        )
          break;
      a.lane = i;
      (lanes[i] ??= []).push(a);
    }
    return lanes.map((items) => {
      const textHeight = Math.max(...items.map((a) => a.labelHeight)),
        decoration = Math.max(
          ...items.map((a) =>
            a.annotation.decoration === "brace"
              ? 5
              : a.annotation.decoration === "dimension"
                ? 3
                : 0,
          ),
        );
      return {
        items,
        textHeight,
        textOffset: decoration + 0.6,
        height: textHeight + decoration + 2.6,
      };
    });
  }
  const titleHeight = d.title
    ? measure(d.title, (p.titlePt * 25.4) / 72, true).height
    : 0;
  let y = pad + (titleHeight ? titleHeight + 2 : 0);
  const rows = d.bars.map((bar, index) => {
    let x = left + number(legacy.exact(bar.offset)) * p.unitMm;
    const parts = bar.parts.map((part) => {
      const width = number(legacy.exact(part.weight)) * p.unitMm,
        start = x;
      x += width;
      if (width < 4)
        issues.push(
          `Section ${part.id} is narrower than 4 mm. Increase relative length or shared unit width.`,
        );
      for (const slot of slots) {
        const l = part.labels[slot];
        if (!l) continue;
        const m = measure(l, font);
        if (m.width > width - 2)
          issues.push(
            `${slot} label in ${part.id} does not fit. Increase its width or use an outside range annotation.`,
          );
        if (slot === "inside" && m.height > barHeightMm - 2)
          issues.push(`Fraction in ${part.id} needs a taller bar.`);
      }
      return { part, x: start, width };
    });
    const sectionHeight = (slot: "above" | "below") =>
      Math.max(
        0,
        ...bar.parts.map((part) =>
          part.labels[slot] ? measure(part.labels[slot]!, font).height : 0,
        ),
      );
    const aboveSection = sectionHeight("above"),
      belowSection = sectionHeight("below");
    const own = candidates.filter((a) => {
      const ends = endpoints(e, a.annotation);
      return (
        Math.max(
          d.bars.findIndex((b) => b.id === ends.from.barId),
          d.bars.findIndex((b) => b.id === ends.to.barId),
        ) === index
      );
    });
    const above = pack(own.filter((a) => a.annotation.placement === "above")),
      below = pack(own.filter((a) => a.annotation.placement === "below"));
    const aboveHeight =
      above.reduce((n, l) => n + l.height, 0) +
      (aboveSection ? aboveSection + 1 : 0);
    const belowHeight =
      below.reduce((n, l) => n + l.height, 0) +
      (belowSection ? belowSection + 1 : 0);
    y += aboveHeight;
    const nameText = visible(bar.name),
      nameWidth = p.nameWidthMm ?? 40,
      nameLines: string[] = [];
    let line = "";
    for (const char of nameText) {
      if (line && plainMeasure(line + char, font).width > nameWidth) {
        nameLines.push(line);
        line = "";
      }
      line += char;
    }
    if (line) nameLines.push(line);
    const height = Math.max(
      barHeightMm,
      bar.name.state === "line" ? WRITING.heightMm : 0,
      nameLines.length * font * 1.2,
    );
    const row = {
      bar,
      x: left + number(legacy.exact(bar.offset)) * p.unitMm,
      y,
      width: x - left - number(legacy.exact(bar.offset)) * p.unitMm,
      height,
      parts,
      nameLines,
      aboveSection,
      belowSection,
      aboveHeight,
      belowHeight,
    };
    let distance = aboveSection ? aboveSection + 1 : 0;
    for (const l of above) {
      for (const a of l.items) {
        a.y = y - distance - 1;
        a.textY = a.y - l.textOffset - l.textHeight / 2;
      }
      distance += l.height;
    }
    distance = belowSection ? belowSection + 1 : 0;
    for (const l of below) {
      for (const a of l.items) {
        a.y = y + height + distance + 1;
        a.textY = a.y + l.textOffset + l.textHeight / 2;
      }
      distance += l.height;
    }
    y += height + belowHeight;
    const between = pack(
      candidates.filter((a) => {
        if (a.annotation.placement !== "between") return false;
        const ends = endpoints(e, a.annotation);
        return (
          Math.min(
            d.bars.findIndex((b) => b.id === ends.from.barId),
            d.bars.findIndex((b) => b.id === ends.to.barId),
          ) === index
        );
      }),
    );
    for (const l of between) {
      for (const a of l.items) {
        a.y = y + 2;
        a.textY = a.y + l.textOffset + l.textHeight / 2;
      }
      y += l.height;
    }
    if (index < d.bars.length - 1) y += 2.7;
    return row;
  });
  for (const a of candidates.filter(
    (a) => a.annotation.placement === "inside",
  )) {
    const ends = endpoints(e, a.annotation),
      r = rows.find((r) => r.bar.id === ends.from.barId)!;
    a.y = r.y + barHeightMm / 2;
    a.textY = a.y;
    const m = measure(a.annotation.label, font),
      l = (a.x1 + a.x2 - m.width) / 2,
      rr = l + m.width;
    if (
      m.height > 0 &&
      (m.height > barHeightMm - 2 ||
        l < a.x1 + 1 - 1e-8 ||
        rr > a.x2 - 1 + 1e-8 ||
        r.parts.slice(1).some((p) => p.x >= l - 0.7 && p.x <= rr + 0.7) ||
        r.parts.some((p) => {
          const z = measure(p.part.labels.inside, font),
            mid = p.x + p.width / 2;
          return (
            z.width > 0 &&
            l < mid + z.width / 2 + 0.7 &&
            rr > mid - z.width / 2 - 0.7
          );
        }) ||
        candidates.some((other) => {
          if (other === a || other.annotation.placement !== "inside")
            return false;
          const ends = endpoints(e, other.annotation);
          if (ends.from.barId !== r.bar.id) return false;
          const size = measure(other.annotation.label, font),
            mid = (other.x1 + other.x2) / 2;
          return (
            size.height > 0 &&
            l < mid + size.width / 2 + 0.7 &&
            rr > mid - size.width / 2 - 0.7
          );
        }))
    )
      issues.push(
        `Inside whole label ${a.annotation.id} meets a divider or another label. Move it outside or explicitly use a continuous bar.`,
      );
  }
  const bodyBottom = y;
  const captionRows = d.captions.map((c) => {
    let m;
    try {
      m = captionMeasure(c, font);
    } catch {
      m = { width: 0, height: 0 };
    }
    const row = {
      caption: c,
      y: y + 2 + m.height / 2,
      width: m.width,
      height: m.height,
    };
    if (m.height) y += m.height + 2;
    return row;
  });
  let width = Math.max(...rows.map((r) => r.x + r.width)) + pad;
  for (const a of candidates) {
    const m = measure(a.annotation.label, font),
      mid = (a.x1 + a.x2) / 2;
    width = Math.max(width, mid + m.width / 2 + pad);
    if (mid - m.width / 2 < pad)
      issues.push(
        `Annotation ${a.annotation.id} extends beyond the left margin. Shorten it or increase the range width.`,
      );
  }
  width = Math.max(
    width,
    ...captionRows.map((c) => c.width + pad * 2),
    d.title
      ? measure(d.title, (p.titlePt * 25.4) / 72, true).width + pad * 2
      : 0,
  );
  const height = y + pad;
  const writingBoxes: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    baseline: number;
  }[] = [];
  function writing(
    id: string,
    l: Label | undefined,
    x: number,
    centre: number,
  ) {
    if (l?.state !== "line") return;
    writingBoxes.push({
      id,
      x: x - 4,
      y: centre - WRITING.heightMm / 2,
      width: 8,
      height: WRITING.heightMm,
      baseline: centre + WRITING.baselineOffsetMm,
    });
  }
  for (const r of rows) {
    for (const a of r.parts) {
      const x = a.x + a.width / 2;
      writing(
        `${a.part.id}:inside`,
        a.part.labels.inside,
        x,
        r.y + barHeightMm / 2,
      );
      writing(
        `${a.part.id}:above`,
        a.part.labels.above,
        x,
        r.y - 1 - r.aboveSection / 2,
      );
      writing(
        `${a.part.id}:below`,
        a.part.labels.below,
        x,
        r.y + r.height + 1 + r.belowSection / 2,
      );
    }
    writing(`${r.bar.id}:name`, r.bar.name, 8.2, r.y + r.height / 2);
  }
  for (const a of candidates)
    writing(a.annotation.id, a.annotation.label, (a.x1 + a.x2) / 2, a.textY);
  for (const c of captionRows)
    writing(
      c.caption.id,
      c.caption.label,
      c.caption.alignment === "left"
        ? 8.2
        : c.caption.alignment === "right"
          ? width - 8.2
          : width / 2,
      c.y,
    );
  writing("title", d.title, width / 2, 4.2 + titleHeight / 2);
  // The writing rectangles are invisible, but their clearance is a layout constraint.
  // Include guide strokes from other anchored annotations, not just lane neighbours.
  const inkBoxes: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];
  function box(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    if (width > 0 && height > 0) inkBoxes.push({ id, x, y, width, height });
  }
  function printed(
    id: string,
    l: Label | undefined,
    x: number,
    cy: number,
    size = font,
    linear = false,
  ) {
    if (!l || l.state === "line") return;
    const m = measure(l, size, linear);
    box(id, x - m.width / 2, cy - m.height / 2, m.width, m.height);
  }
  for (const r of rows) {
    box(r.bar.id, r.x - 0.15, r.y - 0.15, r.width + 0.3, 0.3);
    box(r.bar.id, r.x - 0.15, r.y + barHeightMm - 0.15, r.width + 0.3, 0.3);
    for (const x of [...r.parts.map((p) => p.x), r.x + r.width])
      box(r.bar.id, x - 0.15, r.y, 0.3, barHeightMm);
    for (const a of r.parts) {
      const x = a.x + a.width / 2;
      printed(a.part.id, a.part.labels.inside, x, r.y + barHeightMm / 2);
      printed(a.part.id, a.part.labels.above, x, r.y - 1 - r.aboveSection / 2);
      printed(
        a.part.id,
        a.part.labels.below,
        x,
        r.y + r.height + 1 + r.belowSection / 2,
      );
    }
    r.nameLines.forEach((s, i) => {
      const m = measure(label(s), font, true),
        cy = r.y + font * 0.6 + i * font * 1.2;
      box(`${r.bar.id}:name`, pad, cy - m.height / 2, m.width, m.height);
    });
  }
  for (const a of candidates) {
    const s = a.annotation,
      mid = (a.x1 + a.x2) / 2,
      ends = endpoints(e, s);
    printed(s.id, s.label, mid, a.textY);
    if (s.decoration !== "none")
      box(
        s.id,
        a.x1 - 0.125,
        a.y -
          (s.decoration === "dimension"
            ? 1.125
            : s.placement === "above"
              ? 4.125
              : 0.125),
        a.x2 - a.x1 + 0.25,
        s.decoration === "dimension" ? 2.25 : 4.25,
      );
    if (ends.from.barId !== ends.to.barId)
      [ends.from, ends.to].forEach((end, i) => {
        const r = rows.find((r) => r.bar.id === end.barId)!;
        const edge = a.y < r.y ? r.y : r.y + barHeightMm;
        box(
          s.id,
          (i ? a.x2 : a.x1) - 0.125,
          Math.min(edge, a.y),
          0.25,
          Math.abs(edge - a.y),
        );
      });
  }
  for (const r of captionRows)
    if (r.caption.label.state !== "line") {
      const x =
        r.caption.alignment === "left"
          ? pad
          : r.caption.alignment === "right"
            ? width - pad - r.width
            : (width - r.width) / 2;
      box(r.caption.id, x, r.y - r.height / 2, r.width, r.height);
    }
  printed(
    "title",
    d.title,
    width / 2,
    pad + titleHeight / 2,
    (p.titlePt * 25.4) / 72,
    true,
  );
  const intersects = (
    a: (typeof inkBoxes)[number],
    b: (typeof inkBoxes)[number],
  ) =>
    Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) - 1e-8 &&
    Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height) - 1e-8;
  for (const [i, b] of writingBoxes.entries()) {
    const obstruction =
      inkBoxes.find((a) => intersects(a, b)) ??
      writingBoxes.slice(0, i).find((a) => intersects(a, b));
    if (obstruction)
      issues.push(
        `Answer space ${b.id} meets ${obstruction.id}. Move the label outside, increase shared unit width or change the annotation placement; the 12/3 mm handwriting space has not been reduced.`,
      );
  }
  if (width > 280 || height > 260)
    issues.push(
      "Artwork exceeds 280 × 260 mm. Reduce content or structure; no scaling has been applied.",
    );
  if (
    Math.round((width / 25.4) * 600) * Math.round((height / 25.4) * 600) >
    32000000
  )
    issues.push("Artwork exceeds 32 million print pixels.");
  return {
    width,
    height,
    barHeightMm,
    writingBoxes,
    rows,
    annotations: candidates,
    font,
    gutter,
    titleHeight,
    captionRows,
    bodyHeight: bodyBottom + pad,
    captionHeight: y - bodyBottom,
    issues,
  };
}
export function exportIssue(e: Envelope) {
  return layout(validate(e)).issues[0] ?? "";
}
function text(
  l: Label,
  x: number,
  centre: number,
  font: number,
  anchor: "middle" | "start" | "end" = "middle",
  linear = false,
  maths = false,
) {
  if (l.state === "line")
    return `<path data-answer-line="true" d="M${x - 4} ${centre + WRITING.baselineOffsetMm}h8" stroke="#000" stroke-width="0.25" fill="none"/>`;
  const s = visible(l);
  if (!s) return "";
  let m;
  try {
    m = mathematicalLine(s, font, maths || (!linear && !!fraction(s)));
  } catch {
    return "";
  }
  const left =
    anchor === "start" ? x : anchor === "end" ? x - m.width : x - m.width / 2;
  return `<g transform="translate(${left} ${centre})" fill="#000" font-family="STIX Two Text,STIX Two Math" font-size="${font}" xml:space="preserve">${m.svg}</g>`;
}
const colour = {
  none: "#fff",
  neutral: "#dedede",
  blue: "#cfe4f5",
  green: "#d7ebd0",
  amber: "#f6e3b5",
};
const grey = {
  none: "#fff",
  neutral: "#dedede",
  blue: "#dedede",
  green: "#ebebeb",
  amber: "#d2d2d2",
};
function alignedX(
  l: Label,
  _font: number,
  alignment: "left" | "centre" | "right",
  width: number,
) {
  if (alignment === "centre") return width / 2;
  if (l.state === "line") return alignment === "left" ? 8.2 : width - 8.2;
  return alignment === "left" ? 4.2 : width - 4.2;
}
export function renderSvg(e: Envelope) {
  validate(e);
  const g = layout(e),
    p = e.document.presentation;
  const bars = g.rows
    .map(
      (r) =>
        `<g>${r.parts.map((a) => `<rect x="${a.x}" y="${r.y}" width="${a.width}" height="${g.barHeightMm}" fill="${(p.output === "colour" ? colour : grey)[a.part.fill]}" stroke="#000" stroke-width="0.3"/>${text(a.part.labels.inside, a.x + a.width / 2, r.y + g.barHeightMm / 2, g.font)}${a.part.labels.above ? text(a.part.labels.above, a.x + a.width / 2, r.y - 1 - r.aboveSection / 2, g.font) : ""}${a.part.labels.below ? text(a.part.labels.below, a.x + a.width / 2, r.y + r.height + 1 + r.belowSection / 2, g.font) : ""}`).join("")}${r.nameLines.map((s, i) => text(label(s), alignedX(label(s), g.font, "left", g.width), r.y + g.font * 0.6 + i * g.font * 1.2, g.font, "start", true)).join("")}${r.bar.name.state === "line" ? text(r.bar.name, 8.2, r.y + r.height / 2, g.font) : ""}</g>`,
    )
    .join("");
  const annotations = g.annotations
    .map((a) => {
      const s = a.annotation,
        mid = (a.x1 + a.x2) / 2,
        dir = s.placement === "above" ? -1 : 1,
        inset = Math.min(2, (a.x2 - a.x1) / 4);
      const path =
        s.decoration === "none"
          ? ""
          : s.decoration === "dimension"
            ? `M${a.x1} ${a.y - 1}v2M${a.x1} ${a.y}H${a.x2}M${a.x2} ${a.y - 1}v2`
            : `M${a.x1} ${a.y}Q${a.x1} ${a.y + dir * 2} ${a.x1 + inset} ${a.y + dir * 2}H${mid - inset}Q${mid} ${a.y + dir * 2} ${mid} ${a.y + dir * 4}Q${mid} ${a.y + dir * 2} ${mid + inset} ${a.y + dir * 2}H${a.x2 - inset}Q${a.x2} ${a.y + dir * 2} ${a.x2} ${a.y}`;
      const ends = endpoints(e, s),
        links =
          ends.from.barId === ends.to.barId
            ? ""
            : [ends.from, ends.to]
                .map((end, i) => {
                  const r = g.rows.find((r) => r.bar.id === end.barId)!;
                  const edge = a.y < r.y ? r.y : r.y + g.barHeightMm;
                  return `<path d="M${i ? a.x2 : a.x1} ${edge}V${a.y}" stroke-dasharray="1 1"/>`;
                })
                .join("");
      return `<g fill="none" stroke="#000" stroke-width="0.25">${links}${path ? `<path d="${path}"/>` : ""}</g>${text(s.label, mid, a.textY, g.font)}`;
    })
    .join("");
  const captions = g.captionRows
    .map((c) =>
      text(
        c.caption.label,
        alignedX(c.caption.label, g.font, c.caption.alignment, g.width),
        c.y,
        g.font,
        c.caption.alignment === "left"
          ? "start"
          : c.caption.alignment === "right"
            ? "end"
            : "middle",
        true,
        c.caption.format === "maths",
      ),
    )
    .join("");
  const title = e.document.title
    ? text(
        e.document.title,
        g.width / 2,
        4.2 + g.titleHeight / 2,
        (p.titlePt * 25.4) / 72,
        "middle",
        true,
      )
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}mm" height="${g.height}mm" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="Bar model" style="font-kerning:none;font-variant-ligatures:none"><rect width="${g.width}" height="${g.height}" fill="#fff"/>${title}${bars}${annotations}${captions}</svg>`;
}
export function printFacts(e: Envelope) {
  const p = e.document.presentation;
  const bodyLabels = [
    ...e.document.bars.flatMap((b) => [
      ...b.parts.flatMap((p) => Object.values(p.labels)),
    ]),
    ...e.document.annotations.map((a) => a.label),
  ];
  return guidance({
    textSizesPt: [
      ...e.document.bars.filter((b) => visible(b.name)).map(() => p.fontPt),
      ...bodyLabels.filter((l) => visible(l)).map(() => p.fontPt),
      ...e.document.captions
        .filter((c) => visible(c.label))
        .map(() => p.fontPt),
      ...(e.document.title && visible(e.document.title) ? [p.titlePt] : []),
    ],
    gridPitchMm: [p.unitMm],
    tableRowHeightsMm: [effectiveBarHeight(e)],
    answerLineLengthsMm: allLabels(e).some((l) => l.state === "line")
      ? [8]
      : [],
  });
}
