import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { parseNumber } from "../../ratio-table-core/src/numbers";

export const visibility = ["show", "hidden", "line"] as const;
export const kinds = [
  "empty",
  "members",
  "frequency",
  "number",
  "algebra",
  "text",
] as const;
const labelSchema = z
  .object({ text: z.string().max(24), visibility: z.enum(visibility) })
  .strict();
const regionSchema = z
  .object({
    kind: z.enum(kinds),
    text: z.string().max(660),
    visibility: z.enum(visibility),
    shade: z.enum(["none", "grey", "hatch"]),
  })
  .strict();
const schema = z
  .object({
    tool: z.literal("venn"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("venn-1"),
    document: z
      .object({
        sets: z.union([z.literal(2), z.literal(3)]),
        shape: z.enum(["circles", "ovals"]),
        labels: z.array(labelSchema).length(4),
        regions: z.array(regionSchema).length(8),
        definitions: z.array(z.string().max(120)).length(4),
        showDefinitions: z.boolean(),
        widthCm: z.number().min(8).max(16),
        fontPt: z.number().min(9).max(14),
      })
      .strict(),
  })
  .strict();
export type Envelope = z.infer<typeof schema>;
export type Region = Envelope["document"]["regions"][number];
export type Label = Envelope["document"]["labels"][number];
export const emptyRegion = (): Region => ({
  kind: "empty",
  text: "",
  visibility: "show",
  shade: "none",
});
export function create(sets: 2 | 3 = 2): Envelope {
  return {
    tool: "venn",
    schemaVersion: 1,
    rendererVersion: "venn-1",
    document: {
      sets,
      shape: "circles",
      labels: ["ξ", "A", "B", "C"].map((text) => ({
        text,
        visibility: "show",
      })),
      regions: Array.from({ length: 8 }, emptyRegion),
      definitions: ["", "", "", ""],
      showDefinitions: false,
      widthCm: 12,
      fontPt: 11,
    },
  };
}
export function members(text: string) {
  return text
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
export function validate(input: unknown): Envelope {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path.includes("labels"))
      throw Error(
        "Use set labels of at most 24 characters and a supported pupil display choice.",
      );
    if (path.includes("definitions"))
      throw Error("Use definition lines of at most 120 characters.");
    if (path.includes("widthCm"))
      throw Error("Choose a print width from 8 to 16 cm.");
    if (path.includes("fontPt"))
      throw Error("Choose a text size from 9 to 14 pt.");
    if (path.includes("regions"))
      throw Error(
        "A region has unsupported content or display settings. Keep member lists within 660 characters.",
      );
    throw Error("This is not a supported version 1 Venn diagram file.");
  }
  const e = parsed.data;
  for (const value of [
    ...e.document.labels.map((l) => l.text),
    ...e.document.definitions,
  ]) {
    if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
      throw Error("Use one ordinary text line for each label or definition.");
  }
  let count = 0;
  for (const r of e.document.regions) {
    if (!["members", "empty"].includes(r.kind) && r.text.length > 32)
      throw Error("Use at most 32 characters per region label.");
    if (
      [...r.text].some(
        (c) =>
          (c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0))) ||
          c === "<" ||
          c === ">",
      )
    )
      throw Error(
        "Use ordinary text and mathematical symbols, without markup.",
      );
    if (r.kind === "members") {
      const tokens = members(r.text);
      count += tokens.length;
      if (tokens.length > 20 || tokens.some((x) => x.length > 32))
        throw Error(
          "Use at most 20 members per region and 32 characters per member.",
        );
      for (const token of tokens) if (token.includes("/")) parseNumber(token);
    }
    if (["frequency", "number"].includes(r.kind) && r.text.trim())
      parseNumber(r.text);
    if (
      r.kind === "algebra" &&
      r.text.trim() &&
      !/^[\d a-zA-Z+−\-().×²³]+$/.test(r.text)
    )
      throw Error("Use a simple algebraic label such as 3x + 2 or x - 1.");
  }
  if (count > 40) throw Error("Use at most 40 members across the diagram.");
  if (
    e.document.sets === 2 &&
    e.document.regions
      .slice(4)
      .some(
        (r) =>
          r.text ||
          r.kind !== "empty" ||
          r.visibility !== "show" ||
          r.shade !== "none",
      )
  )
    throw Error("A two-set document cannot contain third-set region data.");
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (text.length > 40000) throw Error("This editable file is too large.");
  return validate(JSON.parse(text));
}
export function regionName(mask: number, e: Envelope) {
  const names = e.document.labels
    .slice(1, e.document.sets + 1)
    .map((x, i) => x.text || ["A", "B", "C"][i]);
  const inside = names.filter((_, i) => mask & (1 << i)),
    outside = names.filter((_, i) => !(mask & (1 << i)));
  return mask === 0
    ? "Outside all sets"
    : `${inside.join(" and ")}${outside.length ? `, outside ${outside.join(" and ")}` : ""}`;
}
export function changeSets(e: Envelope, sets: 2 | 3) {
  const n = structuredClone(e);
  n.document.sets = sets;
  if (sets === 2)
    n.document.regions.splice(4, 4, ...Array.from({ length: 4 }, emptyRegion));
  return validate(n);
}
export function hasThirdData(e: Envelope) {
  return e.document.regions
    .slice(4)
    .some(
      (r) =>
        r.kind !== "empty" ||
        r.text ||
        r.visibility !== "show" ||
        r.shade !== "none",
    );
}

/** A bounded set-algebra parser; identifiers are stable A/B/C IDs, never labels. */
export function expressionMasks(input: string, sets: 2 | 3): number[] {
  if (input.length > 120)
    throw Error("Keep the shading expression within 120 characters.");
  const source = input
    .replaceAll("∪", "|")
    .replaceAll("∩", "&")
    .replaceAll("′", "'")
    .replaceAll("’", "'")
    .replace(/\s/g, "")
    .toUpperCase();
  let at = 0;
  type Predicate = (mask: number) => boolean;
  const atom = (): Predicate => {
    let result: Predicate;
    if (source[at] === "(") {
      at++;
      result = union();
      if (source[at++] !== ")")
        throw Error("Close each bracket in the shading expression.");
    } else {
      const id = source[at++];
      const index = "ABC".indexOf(id ?? "");
      if (!id || index < 0 || index >= sets)
        throw Error(
          `Choose a set ID from ${sets === 2 ? "A or B" : "A, B or C"}.`,
        );
      result = (mask) => !!(mask & (1 << index));
    }
    while (source[at] === "'") {
      at++;
      const prev = result;
      result = (mask) => !prev(mask);
    }
    return result;
  };
  const intersection = (): Predicate => {
    let result = atom();
    while (source[at] === "&") {
      at++;
      const left = result,
        right = atom();
      result = (m) => left(m) && right(m);
    }
    return result;
  };
  const union = (): Predicate => {
    let result = intersection();
    while (source[at] === "|") {
      at++;
      const left = result,
        right = intersection();
      result = (m) => left(m) || right(m);
    }
    return result;
  };
  const predicate = union();
  if (at !== source.length)
    throw Error(
      "Use set IDs, ∪, ∩, complement ' and brackets, for example (A ∪ B)'.",
    );
  return Array.from({ length: 1 << sets }, (_, i) => i).filter(predicate);
}
export function warnings(e: Envelope) {
  const result: string[] = [],
    seen = new Set<string>();
  for (const r of e.document.regions.slice(0, 1 << e.document.sets)) {
    if (r.kind === "frequency" && r.text.trim()) {
      const value = parseNumber(r.text);
      if (value.n < 0 || value.d !== 1n)
        result.push(
          "A frequency is negative or not a whole number. Retained for your teaching example.",
        );
    }
    if (r.kind === "members")
      for (const token of members(r.text)) {
        if (seen.has(token))
          result.push(
            `Repeated member ${token}. Retained for your teaching example.`,
          );
        seen.add(token);
      }
  }
  return [...new Set(result)];
}

type Ellipse = { x: number; y: number; rx: number; ry: number };
type Point = { x: number; y: number };
export function geometry(e: Envelope) {
  const d = e.document,
    scale = d.widthCm / 12;
  const definitions = d.showDefinitions
    ? d.definitions.slice(0, d.sets + 1).filter(Boolean)
    : [];
  const font = (d.fontPt * 25.4) / 72;
  const head = definitions.length ? definitions.length * (font + 2) + 4 : 0;
  const height = (d.sets === 2 ? 85 : 105) * scale + head;
  const points =
    d.sets === 2
      ? [
          [44, 43],
          [76, 43],
        ]
      : [
          [43, 40],
          [76, 40],
          [59.5, 65],
        ];
  const circles: Ellipse[] = points.map(([x, y]) => ({
    x: x * scale,
    y: y * scale + head,
    rx: (d.shape === "ovals" && d.sets === 2 ? 28 : 25) * scale,
    ry: (d.shape === "ovals" && d.sets === 2 ? 22 : 25) * scale,
  }));
  const anchors = (
    d.sets === 2
      ? [
          [60, 76],
          [33, 43],
          [87, 43],
          [60, 43],
        ]
      : [
          [60, 96],
          [30, 36],
          [89, 36],
          [59.5, 29],
          [59.5, 79],
          [43, 58],
          [76, 58],
          [59.5, 50],
        ]
  ).map(([x, y]) => ({ x: x * scale, y: y * scale + head }));
  const labelPoints = [
    { x: Math.max(7, 7 * scale), y: 9 * scale + head },
    ...circles.map((c, i) => {
      const angle = ((i === 0 ? -140 : i === 1 ? -40 : 65) * Math.PI) / 180;
      return {
        x: c.x + c.rx * Math.cos(angle),
        y: c.y + c.ry * Math.sin(angle),
      };
    }),
  ];
  return {
    width: d.widthCm * 10,
    height,
    head,
    font,
    circles,
    anchors,
    labelPoints,
    definitions,
    box: {
      x: 2,
      y: head + 2,
      width: d.widthCm * 10 - 4,
      height: height - head - 4,
    },
  };
}
export type Geometry = ReturnType<typeof geometry>;
function ellipseInside(p: Point, c: Ellipse, margin = 0) {
  return (
    ((p.x - c.x) / (c.rx + margin)) ** 2 +
      ((p.y - c.y) / (c.ry + margin)) ** 2 <=
    1
  );
}
export function membership(g: Geometry, x: number, y: number) {
  return g.circles.reduce(
    (mask, c, i) => mask | (ellipseInside({ x, y }, c) ? 1 << i : 0),
    0,
  );
}
function safe(g: Geometry, mask: number, x: number, y: number) {
  const b = g.box;
  if (
    x < b.x + 1.5 ||
    x > b.x + b.width - 1.5 ||
    y < b.y + 1.5 ||
    y > b.y + b.height - 1.5
  )
    return false;
  return g.circles.every((c, i) =>
    mask & (1 << i)
      ? ellipseInside({ x, y }, c, -1.3)
      : !ellipseInside({ x, y }, c, 1.3),
  );
}
export const textWidth = (text: string, font: number) =>
  [...text].reduce((n, c) => n + glyphAdvance(c), 0) * font;
function numberParts(text: string) {
  return /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(text.trim());
}
function tokenWidth(text: string, font: number) {
  const f = numberParts(text);
  return f
    ? Math.max(textWidth(f[1], font * 0.8), textWidth(f[2], font * 0.8)) + 1.5
    : textWidth(text, font);
}
const esc = (v: string) =>
  v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const textSvg = (
  text: string,
  x: number,
  y: number,
  font: number,
  italic = false,
  anchor = "middle",
) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="STIX Two Text,STIX Two Math,serif" font-size="${font}"${italic ? ' font-style="italic"' : ""} fill="black">${esc(text)}</text>`;
function tokenSvg(
  text: string,
  x: number,
  y: number,
  font: number,
  algebra: boolean,
) {
  const f = numberParts(text);
  if (!f) {
    if (!algebra) return textSvg(text, x, y + font * 0.3, font);
    const parts = [...text]
      .map((c) =>
        /[a-zA-Z]/.test(c)
          ? `<tspan font-style="italic">${esc(c)}</tspan>`
          : esc(c),
      )
      .join("");
    return textSvg("", x, y + font * 0.3, font).replace(
      "</text>",
      `${parts}</text>`,
    );
  }
  const w = tokenWidth(text, font);
  return (
    textSvg(f[1], x, y - 0.9, font * 0.8) +
    `<path d="M${x - w / 2},${y}h${w}" stroke="black" stroke-width=".2"/>` +
    textSvg(f[2], x, y + font * 0.85, font * 0.8)
  );
}
function content(
  e: Envelope,
  g: Geometry,
  mask: number,
): { svg: string; issue?: string } {
  const r = e.document.regions[mask],
    a = g.anchors[mask],
    f = g.font;
  if (
    r.visibility === "hidden" ||
    (r.visibility === "show" && (r.kind === "empty" || !r.text.trim()))
  )
    return { svg: "" };
  const line = r.visibility === "line";
  const tokens = line
    ? ["____"]
    : r.kind === "members"
      ? members(r.text)
      : [r.text];
  if (!tokens.length) return { svg: "" };
  const tall = tokens.some((t) => !!numberParts(t)),
    rowHeight = tall ? f * 2.15 : f * 1.45,
    half = tall ? f : f * 0.65;
  for (let rows = 1; rows <= 9; rows++) {
    let used = 0;
    const chunks: string[] = [];
    for (let row = 0; row < rows && used < tokens.length; row++) {
      const y = a.y + (row - (rows - 1) / 2) * rowHeight;
      let left = a.x,
        right = a.x;
      const fits = (x: number) =>
        safe(g, mask, x, y - half) &&
        safe(g, mask, x, y) &&
        safe(g, mask, x, y + half);
      if (!fits(a.x)) break;
      while (left > 0 && fits(left - 0.25)) left -= 0.25;
      while (right < g.width && fits(right + 0.25)) right += 0.25;
      const start = used;
      let width = 0;
      while (used < tokens.length) {
        const next = tokenWidth(tokens[used], f) + (used > start ? f * 0.6 : 0);
        if (width + next > right - left) break;
        width += next;
        used++;
      }
      if (start === used) break;
      let x = Math.max(left, Math.min(a.x - width / 2, right - width));
      for (let i = start; i < used; i++) {
        const w = tokenWidth(tokens[i], f);
        chunks.push(
          line
            ? `<path d="M${x},${y + f * 0.3}h${w}" stroke="black" stroke-width=".22"/>`
            : tokenSvg(tokens[i], x + w / 2, y, f, r.kind === "algebra"),
        );
        if (!line && r.kind === "members" && i < used - 1)
          chunks.push(
            textSvg(",", x + w + 0.25, y + f * 0.3, f, false, "start"),
          );
        x += w + f * 0.6;
      }
    }
    if (used === tokens.length) return { svg: chunks.join("") };
  }
  return {
    svg: "",
    issue: `${regionName(mask, e)} does not fit. Increase print width, reduce font size or shorten the contents.`,
  };
}
export function layout(e: Envelope) {
  validate(e);
  const g = geometry(e),
    issues: string[] = [],
    chunks: string[] = [];
  for (let mask = 0; mask < 1 << e.document.sets; mask++) {
    const c = content(e, g, mask);
    if (c.issue) issues.push(c.issue);
    chunks.push(`<g data-region="${mask}">${c.svg}</g>`);
  }
  for (let i = 0; i < g.labelPoints.length; i++) {
    const l = e.document.labels[i],
      p = g.labelPoints[i],
      w = l.visibility === "line" ? 9 : textWidth(l.text, g.font * 1.1) + 2;
    if (
      l.visibility !== "hidden" &&
      (p.x - w / 2 < 2 ||
        p.x + w / 2 > g.width - 2 ||
        p.y + g.font > g.height - 2)
    )
      issues.push(
        `Set label ${i === 0 ? "universe" : "ABC"[i - 1]} is too long for this layout. Shorten it or increase print width.`,
      );
  }
  for (const definition of g.definitions)
    if (textWidth(definition, g.font) > g.width - 8)
      issues.push(
        "A definition line is too long. Shorten it or increase print width.",
      );
  return { ...g, contents: chunks.join(""), issues };
}
export function exportIssue(e: Envelope) {
  return layout(e).issues.join(" ");
}
export function renderSvg(e: Envelope) {
  const d = e.document,
    g = layout(e),
    b = g.box;
  const ellipse = (c: Ellipse, fill: string, stroke = "none") =>
    `<ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="${c.ry}" fill="${fill}" stroke="${stroke}" stroke-width=".3"/>`;
  const rect = `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"`;
  let defs =
      '<pattern id="vn-hatch" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M-1,1L1,-1M0,2L2,0M1,3L3,1" stroke="#555" stroke-width=".18"/></pattern>',
    shading = "";
  for (let mask = 0; mask < 1 << d.sets; mask++) {
    const r = d.regions[mask];
    if (r.shade === "none") continue;
    // Intersect inside clips, then remove every outside set. Masks use physical
    // bounds, so the outside region and triple overlap share the same truth table.
    let art = `${rect} fill="white"/>`;
    g.circles.forEach((c, i) => {
      if (mask & (1 << i)) {
        const id = `vn-clip-${mask}-${i}`;
        defs += `<clipPath id="${id}">${ellipse(c, "white")}</clipPath>`;
        art = `<g clip-path="url(#${id})">${art}</g>`;
      }
    });
    art += g.circles
      .filter((_, i) => !(mask & (1 << i)))
      .map((c) => ellipse(c, "black"))
      .join("");
    defs += `<mask id="vn-mask-${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.width}" height="${g.height}">${art}</mask>`;
    shading += `${rect} fill="${r.shade === "grey" ? "#d8d8d8" : "url(#vn-hatch)"}" mask="url(#vn-mask-${mask})"/>`;
  }
  const labels = g.labelPoints
    .map((p, i) => {
      const l = d.labels[i];
      if (l.visibility === "hidden" || (!l.text && l.visibility !== "line"))
        return "";
      const font = g.font * 1.1,
        w = l.visibility === "line" ? 9 : textWidth(l.text, font) + 2;
      return (
        `<rect x="${p.x - w / 2}" y="${p.y - font * 0.7}" width="${w}" height="${font * 1.3}" fill="white"/>` +
        (l.visibility === "line"
          ? `<path d="M${p.x - 4.5},${p.y + font * 0.3}h9" stroke="black" stroke-width=".22"/>`
          : textSvg(l.text, p.x, p.y + font * 0.3, font, i > 0))
      );
    })
    .join("");
  const definitions = g.definitions
    .map((s, i) =>
      textSvg(s, 4, 4 + g.font + i * (g.font + 2), g.font, false, "start"),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width / 10}cm" height="${g.height / 10}cm" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="Venn diagram with ${d.sets} sets"><defs>${defs}</defs><rect width="${g.width}" height="${g.height}" fill="white"/>${definitions}${shading}${rect} fill="none" stroke="black" stroke-width=".3"/>${g.circles.map((c) => ellipse(c, "none", "black")).join("")}${g.contents}${labels}</svg>`;
}
