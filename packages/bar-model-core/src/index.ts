import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { guidance } from "../../graph-core/src/print-guidance";

export const LIMITS = {
  bars: 6,
  partsPerBar: 24,
  parts: 96,
  spans: 18,
  operations: 30,
  labelCharacters: 80,
  requestBytes: 32768,
  widthMm: 280,
  heightMm: 260,
} as const;
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,31}$/);
export const labelSchema = z
  .object({
    text: z
      .string()
      .max(80)
      .regex(
        // Reject XML-invalid controls rather than emitting a corrupt SVG.
        // eslint-disable-next-line no-control-regex
        /^[^\u0000-\u001f\u007f]*$/,
        "Labels cannot contain control characters.",
      ),
    state: z.enum(["value", "blank", "question", "line", "hidden"]),
  })
  .strict();
export type Label = z.infer<typeof labelSchema>;
export const label = (
  text = "",
  state: Label["state"] = text ? "value" : "blank",
): Label => ({ text, state });
const rational = z.string().max(24);
export const partSchema = z
  .object({ id, weight: rational, label: labelSchema, shade: z.boolean() })
  .strict();
export const barSchema = z
  .object({
    id,
    name: labelSchema,
    offset: rational,
    parts: z.array(partSchema).min(1).max(LIMITS.partsPerBar),
  })
  .strict();
export const anchorSchema = z
  .object({ barId: id, partId: id, edge: z.enum(["start", "end"]) })
  .strict();
export const spanSchema = z
  .object({
    id,
    from: anchorSchema,
    to: anchorSchema,
    label: labelSchema,
    side: z.enum(["above", "below"]),
    style: z.enum(["brace", "dimension"]),
  })
  .strict();
export const presentationSchema = z
  .object({
    unitMm: z.number().min(4).max(16),
    barHeightMm: z.number().min(8).max(16),
    fontPt: z.number().min(10).max(14),
    nameWidthMm: z.number().min(20).max(60),
  })
  .strict();
export const schema = z
  .object({
    kind: z.literal("bar-model"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("bar-model-1"),
    styleProfile: z.literal("lesson-v1"),
    document: z
      .object({
        bars: z.array(barSchema).min(1).max(LIMITS.bars),
        spans: z.array(spanSchema).max(LIMITS.spans),
        presentation: presentationSchema,
        sourceId: z.string().max(100).optional(),
      })
      .strict(),
  })
  .strict();
export type Envelope = z.infer<typeof schema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type Span = z.infer<typeof spanSchema>;
export type Bar = z.infer<typeof barSchema>;
export type Part = z.infer<typeof partSchema>;
type Q = { n: bigint; d: bigint };
function gcd(a: bigint, b: bigint): bigint {
  return b ? gcd(b, a % b) : a < 0n ? -a : a;
}
function q(n: bigint, d: bigint): Q {
  if (d === 0n) throw Error("A denominator cannot be zero.");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (n > 1000000n || n < -1000000n || d > 10000n)
    throw Error(
      "Use a rational with numerator at most 1000000 and denominator at most 10000.",
    );
  return { n, d };
}
export function exact(s: string): Q {
  if (!/^-?\d{1,7}(?:\/\d{1,5}|\.\d{1,4})?$/.test(s))
    throw Error(
      "Use an exact integer, decimal (up to four places) or fraction for geometry.",
    );
  if (s.includes("/")) {
    const [n, d] = s.split("/");
    return q(BigInt(n), BigInt(d));
  }
  const [n, f] = s.split(".");
  return f ? q(BigInt(n + f), 10n ** BigInt(f.length)) : q(BigInt(n), 1n);
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const num = (a: Q) => Number(a.n) / Number(a.d);
const fmt = (a: Q) => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
export function boundary(e: Envelope, a: Anchor) {
  const b = e.document.bars.find((b) => b.id === a.barId);
  if (!b) throw Error(`Unknown bar ${a.barId}.`);
  const i = b.parts.findIndex((p) => p.id === a.partId);
  if (i < 0) throw Error(`Unknown part ${a.partId} in ${a.barId}.`);
  return b.parts
    .slice(0, i + (a.edge === "end" ? 1 : 0))
    .reduce((v, p) => add(v, exact(p.weight)), exact(b.offset));
}
export function validate(raw: unknown): Envelope {
  const e = schema.parse(raw),
    ids = new Set<string>();
  function unique(s: string) {
    if (ids.has(s)) throw Error(`Duplicate ID ${s}.`);
    ids.add(s);
  }
  let count = 0;
  for (const b of e.document.bars) {
    unique(b.id);
    const offset = exact(b.offset);
    if (offset.n < 0n) throw Error("Bar offsets must be nonnegative.");
    b.offset = fmt(offset);
    for (const p of b.parts) {
      unique(p.id);
      const weight = exact(p.weight);
      if (weight.n <= 0n)
        throw Error(
          "Part weights must be positive; labels do not determine geometry.",
        );
      p.weight = fmt(weight);
      count++;
    }
  }
  if (count > LIMITS.parts)
    throw Error(`Use at most ${LIMITS.parts} parts overall.`);
  for (const s of e.document.spans) {
    unique(s.id);
    if (num(boundary(e, s.to)) <= num(boundary(e, s.from)))
      throw Error(
        `Span ${s.id} must run left to right between distinct boundaries.`,
      );
  }
  return e;
}
function normalise(e: Envelope) {
  const n = validate(e);
  for (const b of n.document.bars) {
    b.offset = fmt(exact(b.offset));
    b.parts.forEach((p) => (p.weight = fmt(exact(p.weight))));
  }
  return n;
}
export const canonical = (e: Envelope) => JSON.stringify(normalise(e));
export function parseFile(raw: string) {
  if (new TextEncoder().encode(raw).length > LIMITS.requestBytes)
    throw Error("Use an editable file up to 32 KiB.");
  return normalise(JSON.parse(raw));
}
export async function hash(e: Envelope) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical(e)),
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function fresh(): Envelope {
  return example("BM01");
}
export const visible = (l: Label) =>
  l.state === "value" ? l.text : l.state === "question" ? "?" : "";
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function textWidth(s: string, mm: number): number {
  const f = s.match(/^(-?\d+|[A-Za-z]|\d+[A-Za-z])\/(\d+)$/);
  if (f)
    return Math.max(textWidth(f[1], mm * 0.8), textWidth(f[2], mm * 0.8)) + 1;
  return Array.from(s).reduce((n, c) => n + glyphAdvance(c, false), 0) * mm;
}
function wrapped(s: string, width: number, mm: number) {
  const lines: string[] = [];
  let current = "";
  for (const c of s) {
    if (current && textWidth(current + c, mm) > width) {
      lines.push(current);
      current = "";
    }
    current += c;
  }
  if (current) lines.push(current);
  return lines;
}
export function layout(e: Envelope) {
  const d = e.document,
    p = d.presentation,
    font = (p.fontPt * 25.4) / 72,
    left = p.nameWidthMm + 6,
    pad = 4,
    lane = font * 1.5 + 6;
  const rows: {
    bar: Bar;
    x: number;
    y: number;
    width: number;
    height: number;
    names: string[];
    parts: { part: Part; x: number; width: number }[];
  }[] = [];
  const spans: {
    span: Span;
    x1: number;
    x2: number;
    y: number;
    row: number;
  }[] = [];
  const issues: string[] = [];
  let y = pad;
  for (const [i, b] of d.bars.entries()) {
    const own = d.spans.filter(
      (s) =>
        Math.max(
          d.bars.findIndex((b) => b.id === s.from.barId),
          d.bars.findIndex((b) => b.id === s.to.barId),
        ) === i,
    );
    const above = own.filter((s) => s.side === "above"),
      below = own.filter((s) => s.side === "below");
    y += above.length * lane;
    const names = wrapped(visible(b.name), p.nameWidthMm - 2, font);
    const height = Math.max(p.barHeightMm, names.length * font * 1.2 + 2);
    let x = left + num(exact(b.offset)) * p.unitMm;
    const parts = b.parts.map((part) => {
      const width = num(exact(part.weight)) * p.unitMm,
        start = x;
      x += width;
      if (width < 4)
        issues.push(
          `Part ${part.id} is narrower than 4 mm. Increase unit width or weight.`,
        );
      if (
        (part.label.state === "line"
          ? 8
          : textWidth(visible(part.label), font)) >
        width - 2
      )
        issues.push(
          `Label in ${part.id} does not fit. Use a span label or a wider part.`,
        );
      if (
        /^(-?\d+|[A-Za-z]|\d+[A-Za-z])\/(\d+)$/.test(visible(part.label)) &&
        p.barHeightMm < font * 1.8 + 2
      )
        issues.push(
          `Fraction in ${part.id} needs a taller bar. Increase bar height or reduce font size.`,
        );
      return { part, x: start, width };
    });
    rows.push({
      bar: b,
      x: left + num(exact(b.offset)) * p.unitMm,
      y,
      width: parts.reduce((a, b) => a + b.width, 0),
      height,
      names,
      parts,
    });
    for (const s of own) {
      const list = s.side === "above" ? above : below,
        index = list.indexOf(s);
      spans.push({
        span: s,
        x1: left + num(boundary(e, s.from)) * p.unitMm,
        x2: left + num(boundary(e, s.to)) * p.unitMm,
        y:
          s.side === "above"
            ? y - 4 - index * lane
            : y + height + 4 + index * lane,
        row: i,
      });
    }
    y += height + below.length * lane + 8;
  }
  let width = Math.max(...rows.map((r) => r.x + r.width)) + pad;
  for (const s of spans) {
    const w = textWidth(visible(s.span.label), font),
      mid = (s.x1 + s.x2) / 2;
    width = Math.max(width, mid + w / 2 + pad);
    if (mid - w / 2 < pad)
      issues.push(
        `Span ${s.span.id}'s label extends beyond the left edge. Shorten its label.`,
      );
  }
  const height = y - 8 + pad;
  if (width > LIMITS.widthMm || height > LIMITS.heightMm)
    issues.push(
      `Artwork exceeds ${LIMITS.widthMm} × ${LIMITS.heightMm} mm. Reduce unit width, labels, bars or braces; no scaling has been applied.`,
    );
  if (
    Math.round((width / 25.4) * 600) * Math.round((height / 25.4) * 600) >
    32000000
  )
    issues.push(
      "Artwork exceeds 32 million print pixels. Reduce its dimensions.",
    );
  return { width, height, rows, spans, font, lane, issues };
}
export function exportIssue(e: Envelope) {
  return layout(validate(e)).issues[0] ?? "";
}
export function warnings(e: Envelope) {
  return [
    ...e.document.bars.flatMap((b) => [b.name, ...b.parts.map((p) => p.label)]),
    ...e.document.spans.map((s) => s.label),
  ].some((l) => l.state === "hidden")
    ? [
        "Editable files and links contain hidden saved answers. Pupil artwork hides them.",
      ]
    : [];
}
function textSvg(
  l: Label,
  x: number,
  y: number,
  font: number,
  anchor = "middle",
) {
  if (l.state === "line")
    return `<path d="M${x - 4} ${y}h8" fill="none" stroke="#000" stroke-width="0.25"/>`;
  const s = visible(l);
  if (!s) return "";
  const fraction = s.match(/^(-?\d+|[A-Za-z]|\d+[A-Za-z])\/(\d+)$/);
  if (fraction && anchor === "middle") {
    const w =
      Math.max(
        textWidth(fraction[1], font * 0.8),
        textWidth(fraction[2], font * 0.8),
      ) + 1;
    return `<g fill="#000" font-family="STIX Two Text" font-size="${font * 0.8}" text-anchor="middle"><text x="${x}" y="${y - font * 0.35}">${esc(fraction[1])}</text><path d="M${x - w / 2} ${y - font * 0.15}h${w}" stroke="#000" stroke-width="0.2"/><text x="${x}" y="${y + font * 0.6}">${esc(fraction[2])}</text></g>`;
  }
  return `<text x="${x}" y="${y}" font-family="STIX Two Text" font-size="${font}" text-anchor="${anchor}" fill="#000">${esc(s)}</text>`;
}
export function renderSvg(e: Envelope) {
  validate(e);
  const g = layout(e),
    p = e.document.presentation;
  const bars = g.rows
    .map(
      (r) =>
        `<g>${r.parts.map((a) => `<rect x="${a.x}" y="${r.y}" width="${a.width}" height="${p.barHeightMm}" fill="${a.part.shade ? "#dedede" : "#fff"}" stroke="#000" stroke-width="0.3"/>${textSvg(a.part.label, a.x + a.width / 2, r.y + p.barHeightMm / 2 + g.font * 0.28, g.font)}`).join("")}${r.names.map((s, i) => textSvg(label(s), 4, r.y + g.font + i * g.font * 1.2, g.font, "start")).join("")}${r.bar.name.state === "line" ? textSvg(r.bar.name, e.document.presentation.nameWidthMm / 2, r.y + g.font, g.font) : ""}</g>`,
    )
    .join("");
  const spans = g.spans
    .map((a) => {
      const { x1, x2, y, span: s } = a,
        mid = (x1 + x2) / 2,
        dir = s.side === "above" ? -1 : 1,
        inset = Math.min(2, (x2 - x1) / 4);
      const curve =
        s.style === "brace"
          ? `M${x1} ${y}Q${x1} ${y + dir * 2} ${x1 + inset} ${y + dir * 2}H${mid - inset}Q${mid} ${y + dir * 2} ${mid} ${y + dir * 4}Q${mid} ${y + dir * 2} ${mid + inset} ${y + dir * 2}H${x2 - inset}Q${x2} ${y + dir * 2} ${x2} ${y}`
          : `M${x1} ${y - 1}v2M${x1} ${y}H${x2}M${x2} ${y - 1}v2`;
      const links =
        s.from.barId === s.to.barId
          ? ""
          : [s.from, s.to]
              .map((end, i) => {
                const r = g.rows.find((r) => r.bar.id === end.barId)!;
                return `<path d="M${i ? x2 : x1} ${r.y + p.barHeightMm}L${i ? x2 : x1} ${y}" stroke-dasharray="1 1"/>`;
              })
              .join("");
      return `<g fill="none" stroke="#000" stroke-width="0.25">${links}<path d="${curve}"/></g>${textSvg(s.label, mid, y + dir * (5 + g.font * 0.5) + g.font * 0.25, g.font)}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}mm" height="${g.height}mm" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="Bar model"><rect width="${g.width}" height="${g.height}" fill="#fff"/>${bars}${spans}</svg>`;
}
export function printFacts(e: Envelope) {
  const g = layout(e);
  const labels = [
    ...g.rows.flatMap((r) => [r.bar.name, ...r.parts.map((p) => p.part.label)]),
    ...g.spans.map((s) => s.span.label),
  ];
  const sizes = labels
    .filter((l) => visible(l))
    .map(
      (l) =>
        e.document.presentation.fontPt *
        (/^(-?\d+|[A-Za-z]|\d+[A-Za-z])\/(\d+)$/.test(visible(l)) ? 0.8 : 1),
    );
  return guidance({
    textSizesPt: sizes,
    gridPitchMm: [e.document.presentation.unitMm],
    tableRowHeightsMm: [e.document.presentation.barHeightMm],
    answerLineLengthsMm: labels.some((l) => l.state === "line") ? [8] : [],
  });
}

const a = (barId: string, partId: string, edge: Anchor["edge"]): Anchor => ({
  barId,
  partId,
  edge,
});
export const exampleNames = [
  "BM01",
  "BM02",
  "BM03",
  "BM04",
  "BM05",
  "BM06",
  "BM07",
  "BM08",
  "BM09",
  "H07",
  "H18",
  "source-sharing",
] as const;
export function example(name: string, worked = false): Envelope {
  if (!(exampleNames as readonly string[]).includes(name))
    throw Error("Unknown bar-model example.");
  const e: Envelope = {
    kind: "bar-model",
    schemaVersion: 1,
    rendererVersion: "bar-model-1",
    styleProfile: "lesson-v1",
    document: {
      bars: [],
      spans: [],
      presentation: {
        unitMm: 10,
        barHeightMm: 10,
        fontPt: 12,
        nameWidthMm: 28,
      },
    },
  };
  const d = e.document;
  function bar(id: string, n: number, title: string) {
    const b: Bar = {
      id,
      name: label(title),
      offset: "0",
      parts: Array.from({ length: n }, (_, i) => ({
        id: `${id}p${i + 1}`,
        weight: "1",
        label: label(),
        shade: false,
      })),
    };
    d.bars.push(b);
    return b;
  }
  function span(
    id: string,
    b: Bar,
    start: number,
    end: number,
    text: string,
    known = false,
    side: Span["side"] = "below",
  ) {
    d.spans.push({
      id,
      from: a(b.id, b.parts[start].id, "start"),
      to: a(b.id, b.parts[end - 1].id, "end"),
      label: label(text, known || worked ? "value" : "hidden"),
      side,
      style: "brace",
    });
  }
  if (name === "source-sharing") {
    const b = bar("b1", 10, "Tim : Jason : Peter");
    b.parts.forEach((p, i) => (p.shade = i >= 3 && i < 5));
    span("whole", b, 0, 10, "£60", true, "above");
    span("tim", b, 0, 3, "£18");
    span("jason", b, 3, 5, "£12");
    span("peter", b, 5, 10, "£30");
    d.sourceId = "1MA1_MOCK_SET_07_1H_Q1";
  } else if (["BM01", "BM02", "BM04", "BM07", "H18"].includes(name)) {
    const three = name === "BM04",
      b = bar("b1", three ? 9 : 8, three ? "2 : 3 : 4" : "3 : 5");
    b.parts.forEach((p, i) => (p.shade = i < (three ? 2 : 3)));
    const algebra = name === "BM07" || name === "H18";
    span(
      "whole",
      b,
      0,
      b.parts.length,
      algebra ? "8x/3" : three ? "72" : "64",
      name === "BM01" || three,
      "above",
    );
    span(
      "first",
      b,
      0,
      three ? 2 : 3,
      algebra ? "x" : three ? "16" : "24",
      name === "BM02" || algebra,
    );
    span(
      "second",
      b,
      three ? 2 : 3,
      three ? 5 : 8,
      algebra ? "5x/3" : three ? "24" : "40",
    );
    if (three) span("third", b, 5, 9, "32");
    if (name === "H18") d.sourceId = "1MA1_JUN_2024_3H_Q10";
  } else if (["BM03", "BM06"].includes(name)) {
    const b = bar("b1", 5, "Longer share"),
      c = bar("b2", 3, "Shorter share");
    d.spans.push({
      id: "difference",
      from: a(c.id, c.parts[2].id, "end"),
      to: a(b.id, b.parts[4].id, "end"),
      label: label(name === "BM03" ? "16" : "2 units"),
      side: "below",
      style: "brace",
    });
    if (name === "BM03") {
      span("larger", b, 0, 5, "40", false, "above");
      span("smaller", c, 0, 3, "24", false, "above");
    }
  } else if (name === "BM05" || name === "H07") {
    const b = bar("b1", 8, "Jars");
    b.parts.forEach((p, i) => (p.shade = i < 3));
    span("whole", b, 0, 8, "400", true, "above");
    span("selected", b, 0, 3, "150");
    if (name === "H07") {
      d.bars = [];
      d.spans = [];
      const c = bar("b2", 15, "Empty jars");
      d.presentation.unitMm = 8;
      span("empty", c, 0, 15, "150", true, "above");
      span("small", c, 0, 3, "30");
      span("medium", c, 3, 7, "40");
      span("large", c, 7, 15, "80");
      d.sourceId = "1MA1_JUN_2024_1H_Q7";
    }
  } else if (name === "BM08") {
    const b = bar("b1", 6, "A deliberately long quantity name");
    d.presentation.unitMm = 16;
    b.parts[0].label = label("0");
    b.parts[1].label = label("1/2");
    b.parts[2].label = label("0.75");
    b.parts[3].label = label("18", "hidden");
    b.parts[4].label = label("", "line");
    span("unknown", b, 0, 6, "?");
    d.spans[0].label = label("", "question");
  } else {
    d.presentation.unitMm = 8;
    d.presentation.nameWidthMm = 60;
    for (let i = 1; i <= 4; i++) {
      const b = bar(`b${i}`, 24, `Quantity ${i}`);
      span(`s${i}`, b, 0, 24, "Whole quantity", true, "above");
    }
  }
  if (worked) {
    for (const b of d.bars)
      for (const p of b.parts)
        if (p.label.state === "hidden") p.label.state = "value";
    const units: Record<string, string> = {
      BM01: "8",
      BM02: "8",
      BM03: "8",
      BM04: "8",
      BM05: "50",
      BM07: "x/3",
      H07: "10",
      H18: "x/3",
      "source-sharing": "£6",
    };
    if (units[name]) d.bars[0].parts[0].label = label(units[name]);
  }
  return validate(e);
}
