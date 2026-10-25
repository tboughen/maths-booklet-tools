import { z } from "zod";
import * as legacy from "./index";
import fontMetrics from "./v2-font-metrics.json" with { type: "json" };
import { guidance } from "../../graph-core/src/print-guidance";

// Version 1 is deliberately a separate, unchanged renderer and canonicalizer.
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
  })
  .strict();
export const presentationSchema = z
  .object({
    unitMm: z.number().min(4).max(16),
    barHeightMm: z.number().min(8).max(16),
    fontPt: z.number().min(10).max(14),
    titlePt: z.number().min(12).max(18),
    nameWidthMm: z.number().min(8).max(60).optional(),
    output: z.enum(["grey", "colour"]),
  })
  .strict();
export const schema = z
  .object({
    kind: z.literal("bar-model"),
    schemaVersion: z.literal(2),
    rendererVersion: z.literal("bar-model-2"),
    styleProfile: z.literal("lesson-v2"),
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
export function upgrade(e: legacy.Envelope): Envelope {
  const old = legacy.validate(e),
    d = old.document;
  return validate({
    kind: "bar-model",
    schemaVersion: 2,
    rendererVersion: "bar-model-2",
    styleProfile: "lesson-v2",
    document: {
      bars: d.bars.map((b) => ({
        id: b.id,
        name: b.name,
        offset: b.offset,
        parts: b.parts.map((p) => ({
          id: p.id,
          weight: p.weight,
          labels: { inside: p.label },
          fill: p.shade ? "neutral" : "none",
        })),
      })),
      annotations: d.spans.map((s) => ({
        id: s.id,
        scope: { kind: "range", from: s.from, to: s.to },
        label: s.label,
        placement: s.side,
        decoration: s.style,
      })),
      presentation: {
        unitMm: d.presentation.unitMm,
        barHeightMm: d.presentation.barHeightMm,
        fontPt: d.presentation.fontPt,
        nameWidthMm: d.presentation.nameWidthMm,
        titlePt: 14,
        output: "grey",
      },
      captions: [],
      ...(d.sourceId === undefined ? {} : { sourceId: d.sourceId }),
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
    schemaVersion: 2,
    rendererVersion: "bar-model-2",
    styleProfile: "lesson-v2",
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

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function measure(l: Label, font: number, linear = false) {
  const text = visible(l),
    f = !linear && fraction(text);
  return {
    width:
      l.state === "line"
        ? 8
        : f
          ? Math.max(
              plainMeasure(f[1], font * 0.8).width,
              plainMeasure(f[2], font * 0.8).width,
            ) + 1
          : plainMeasure(text, font).width,
    height:
      l.state === "line"
        ? 1
        : text
          ? f
            ? font * 1.8
            : plainMeasure(text, font).height
          : 0,
  };
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
        textOffset: Math.max(0, decoration - 1),
        height: textHeight + decoration + 1.5,
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
        if (slot === "inside" && m.height > p.barHeightMm - 2)
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
    const height = Math.max(p.barHeightMm, nameLines.length * font * 1.2);
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
    a.y = r.y + p.barHeightMm / 2;
    a.textY = a.y;
    const m = measure(a.annotation.label, font),
      l = (a.x1 + a.x2 - m.width) / 2,
      rr = l + m.width;
    if (
      m.height > 0 &&
      (m.height > p.barHeightMm - 2 ||
        l < a.x1 + 1 ||
        rr > a.x2 - 1 ||
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
    const m = measure(c.label, font, true),
      row = {
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
  anchor = "middle",
  linear = false,
) {
  if (l.state === "line")
    return `<path d="M${x - 4} ${centre}h8" fill="none" stroke="#000" stroke-width="0.25"/>`;
  const s = visible(l);
  if (!s) return "";
  const f = !linear && fraction(s);
  if (f) {
    const w =
      Math.max(
        plainMeasure(f[1], font * 0.8).width,
        plainMeasure(f[2], font * 0.8).width,
      ) + 1;
    return `<g fill="#000" font-family="STIX Two Text,STIX Two Math" font-size="${font * 0.8}" text-anchor="middle"><text x="${x}" y="${centre - font * 0.25}">${esc(f[1])}</text><path d="M${x - w / 2} ${centre}h${w}" stroke="#000" stroke-width="0.2"/><text x="${x}" y="${centre + font * 0.75}">${esc(f[2])}</text></g>`;
  }
  return `<text x="${x}" y="${centre + font * 0.32}" font-family="STIX Two Text,STIX Two Math" font-size="${font}" text-anchor="${anchor}" fill="#000">${esc(s)}</text>`;
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
  font: number,
  alignment: "left" | "centre" | "right",
  width: number,
) {
  if (alignment === "centre") return width / 2;
  if (l.state === "line") return alignment === "left" ? 8.2 : width - 8.2;
  const ink = plainMeasure(visible(l), font);
  return alignment === "left"
    ? 4.2 - Math.min(0, ink.left)
    : width - 4.2 - Math.max(0, ink.right - ink.advance);
}
export function renderSvg(e: Envelope) {
  validate(e);
  const g = layout(e),
    p = e.document.presentation;
  const bars = g.rows
    .map(
      (r) =>
        `<g>${r.parts.map((a) => `<rect x="${a.x}" y="${r.y}" width="${a.width}" height="${p.barHeightMm}" fill="${(p.output === "colour" ? colour : grey)[a.part.fill]}" stroke="#000" stroke-width="0.3"/>${text(a.part.labels.inside, a.x + a.width / 2, r.y + p.barHeightMm / 2, g.font)}${a.part.labels.above ? text(a.part.labels.above, a.x + a.width / 2, r.y - 1 - r.aboveSection / 2, g.font) : ""}${a.part.labels.below ? text(a.part.labels.below, a.x + a.width / 2, r.y + r.height + 1 + r.belowSection / 2, g.font) : ""}`).join("")}${r.nameLines.map((s, i) => text(label(s), alignedX(label(s), g.font, "left", g.width), r.y + g.font * 0.6 + i * g.font * 1.2, g.font, "start", true)).join("")}${r.bar.name.state === "line" ? text(r.bar.name, 8.2, r.y + g.font * 0.6, g.font) : ""}</g>`,
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
                  const edge = a.y < r.y ? r.y : r.y + p.barHeightMm;
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
      ...bodyLabels
        .filter((l) => visible(l))
        .map((l) => p.fontPt * (fraction(visible(l)) ? 0.8 : 1)),
      ...e.document.captions
        .filter((c) => visible(c.label))
        .map(() => p.fontPt),
      ...(e.document.title && visible(e.document.title) ? [p.titlePt] : []),
    ],
    gridPitchMm: [p.unitMm],
    tableRowHeightsMm: [p.barHeightMm],
    answerLineLengthsMm: allLabels(e).some((l) => l.state === "line")
      ? [8]
      : [],
  });
}
