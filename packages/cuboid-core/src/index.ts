import { z } from "zod";
import * as legacy from "./legacy";
import {
  parseNumber,
  canonicalNumber,
  fractionString,
  type Rational,
} from "../../ratio-table-core/src/numbers";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

export const axes = ["width", "depth", "height"] as const;
export const faces = ["front", "top", "side"] as const;
export const keys = [...axes, ...faces] as const;
export type Axis = (typeof axes)[number];
export type LabelKey = (typeof keys)[number];
const labelSchema = z
  .object({
    mode: z.enum(["hidden", "value", "blank", "text", "area"]),
    text: z.string().max(48),
    x: z.number().min(-8).max(8),
    y: z.number().min(-8).max(8),
  })
  .strict();
const baseShapeSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9-]{1,48}$/),
    title: z.string().max(40),
    dimensions: z
      .object({ width: z.string(), depth: z.string(), height: z.string() })
      .strict(),
    unit: z.enum(["cm", "mm", "m"]),
    cube: z.boolean(),
    labels: z
      .object({
        width: labelSchema,
        depth: labelSchema,
        height: labelSchema,
        front: labelSchema,
        top: labelSchema,
        side: labelSchema,
      })
      .strict(),
    view: z.enum(["plain", "cubes", "layers"]),
    cubeSideCm: z.string(),
    direction: z.enum(["right", "left"]),
    projection: z.enum(["compact", "standard", "deep"]),
    schematic: z.boolean(),
    proportions: z
      .object({ width: z.string(), depth: z.string(), height: z.string() })
      .strict(),
    hiddenEdges: z.boolean(),
    arrows: z.boolean(),
    workedVolume: z.boolean(),
    workedArea: z.boolean(),
    counts: z.boolean(),
    layerNumbers: z.boolean(),
    caption: z.string().max(100),
  })
  .strict();
export const faceNames = [
  "top",
  "bottom",
  "front",
  "back",
  "left",
  "right",
] as const;
const appearanceSchema = z
  .object({
    mode: z.enum(["outline", "faces", "one"]),
    tone: z.enum(["light", "strong"]),
    face: z.enum(faceNames),
    area: z
      .object({
        mode: z.enum(["hidden", "blank", "value", "text"]),
        heading: z.enum(["Base area", "Cross-sectional area", "Face area"]),
        text: z.string().max(80),
        expression: z.boolean(),
      })
      .strict(),
  })
  .strict();
const shapeSchema = baseShapeSchema.extend({
  appearance: appearanceSchema.optional(),
});
const envelopeSchema = z
  .object({
    tool: z.literal("cuboids"),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    rendererVersion: z.enum(["cuboids-1", "cuboids-2"]),
    document: z
      .object({
        widthCm: z.number().min(4).max(18),
        shapes: z.array(shapeSchema).min(1).max(3),
      })
      .strict(),
  })
  .strict();
export type Shape = z.infer<typeof shapeSchema>;
export type Label = z.infer<typeof labelSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type FaceName = (typeof faceNames)[number];
export function appearance(s: Shape): Appearance {
  return (
    s.appearance ?? {
      mode: "outline",
      tone: "light",
      face: "bottom",
      area: {
        mode: "hidden",
        heading: "Base area",
        text: "",
        expression: false,
      },
    }
  );
}
export function upgrade(e: Envelope): Envelope {
  return validate({
    ...e,
    schemaVersion: 2,
    rendererVersion: "cuboids-2",
    document: {
      ...e.document,
      shapes: e.document.shapes.map((s) => ({
        ...s,
        appearance: appearance(s),
      })),
    },
  });
}
export function faceArea(s: Shape, face: FaceName) {
  const a =
    face === "top" || face === "bottom"
      ? ["width", "depth"]
      : face === "front" || face === "back"
        ? ["width", "height"]
        : ["depth", "height"];
  return {
    value: fractionString(
      times(
        parseNumber(s.dimensions[a[0] as Axis]),
        parseNumber(s.dimensions[a[1] as Axis]),
      ),
    ),
    factors: a.map((k) => s.dimensions[k as Axis]),
  };
}
export function faceAreaLabel(s: Shape) {
  const a = appearance(s);
  if (a.mode !== "one" || a.area.mode === "hidden") return "";
  if (a.area.mode === "text") return a.area.text;
  const result = faceArea(s, a.face);
  return `${a.area.heading} = ${a.area.mode === "blank" ? "…………" : `${a.area.expression ? result.factors.join(" × ") + " = " : ""}${result.value}`} ${s.unit}²`;
}
const factor = { cm: 1n, mm: 10n, m: 100n };
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}
function exact(n: bigint, d = 1n): Rational {
  if (!d) throw Error("A denominator cannot be zero.");
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
function times(a: Rational, b: Rational) {
  return exact(a.n * b.n, a.d * b.d);
}
function sum(a: Rational, b: Rational) {
  return exact(a.n * b.d + b.n * a.d, a.d * b.d);
}
const val = (a: Rational) => Number(a.n) / Number(a.d);
export function dimension(input: string): string {
  const r = parseNumber(input),
    v = val(r);
  if (v < 0.000001 || v > 1000000)
    throw Error(
      "Use a positive number with at most six decimal places, within the supported exact-number range.",
    );
  return canonicalNumber(input);
}
export function inCm(s: Shape, a: Axis): Rational {
  const r = parseNumber(s.dimensions[a]);
  return s.unit === "mm"
    ? exact(r.n, r.d * factor.mm)
    : s.unit === "m"
      ? exact(r.n * factor.m, r.d)
      : r;
}
export function fromCm(r: Rational, unit: Shape["unit"]) {
  return fractionString(
    unit === "mm"
      ? exact(r.n * 10n, r.d)
      : unit === "m"
        ? exact(r.n, r.d * 100n)
        : r,
  );
}
export function cubeSideInUnit(s: Shape) {
  return fromCm(parseNumber(s.cubeSideCm), s.unit);
}
export function setUnit(s: Shape, unit: Shape["unit"]): Shape {
  return {
    ...s,
    unit,
    dimensions: Object.fromEntries(
      axes.map((a) => [a, fromCm(inCm(s, a), unit)]),
    ) as Shape["dimensions"],
  };
}
export function setDimension(s: Shape, a: Axis, v: string): Shape {
  const d = dimension(v);
  return {
    ...s,
    dimensions: s.cube
      ? { width: d, depth: d, height: d }
      : { ...s.dimensions, [a]: d },
  };
}
export function setCubeSide(s: Shape, input: string): Shape {
  const d = dimension(input);
  const r = parseNumber(d);
  return {
    ...s,
    cubeSideCm: fractionString(
      s.unit === "mm"
        ? exact(r.n, r.d * 10n)
        : s.unit === "m"
          ? exact(r.n * 100n, r.d)
          : r,
    ),
  };
}
export function grow(s: Shape, a: Axis, sign: number): Shape {
  const base = inCm(s, a),
    step = parseNumber(s.cubeSideCm);
  const r = sum(base, exact(step.n * BigInt(sign), step.d));
  return setDimension(s, a, fromCm(r, s.unit));
}
export function decomposition(s: Shape) {
  const side = parseNumber(s.cubeSideCm);
  if (side.n <= 0n) throw Error("The cube side must be positive.");
  const counts = axes.map((a) => {
    const edge = inCm(s, a),
      n = edge.n * side.d,
      d = edge.d * side.n;
    if (n % d)
      throw Error(
        `The ${a} is not a whole number of these cubes. Choose a dividing cube size or use Exam diagram.`,
      );
    return Number(n / d);
  });
  if (counts.some((n) => n > 40) || counts.reduce((a, b) => a * b, 1) > 10000)
    throw Error(
      "Cube view supports up to 40 cubes along each edge and 10,000 cubes per cuboid. Choose larger cubes or use Exam diagram.",
    );
  return {
    width: counts[0],
    depth: counts[1],
    height: counts[2],
    total: counts.reduce((a, b) => a * b, 1),
    sideCm: val(side),
  };
}
export function calculations(s: Shape) {
  const [w, d, h] = axes.map((a) => parseNumber(s.dimensions[a]));
  return {
    volume: fractionString(times(times(w, d), h)),
    area: fractionString(
      times(exact(2n), sum(sum(times(w, d), times(w, h)), times(d, h))),
    ),
  };
}
export function newShape(id = "cuboid-1"): Shape {
  const label = (mode: Label["mode"]): Label => ({
    mode,
    text: "",
    x: 0,
    y: 0,
  });
  return {
    id,
    title: "",
    dimensions: { width: "4", depth: "3", height: "2" },
    unit: "cm",
    cube: false,
    labels: {
      width: label("value"),
      depth: label("value"),
      height: label("value"),
      front: label("hidden"),
      top: label("hidden"),
      side: label("hidden"),
    },
    view: "plain",
    cubeSideCm: "1",
    direction: "right",
    projection: "standard",
    schematic: false,
    proportions: { width: "4", depth: "3", height: "2" },
    hiddenEdges: false,
    arrows: false,
    workedVolume: false,
    workedArea: false,
    counts: false,
    layerNumbers: false,
    caption: "",
  };
}
export function create(): Envelope {
  return {
    tool: "cuboids",
    schemaVersion: 1,
    rendererVersion: "cuboids-1",
    document: { widthCm: 10, shapes: [newShape()] },
  };
}
export function validate(value: unknown): Envelope {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1
  )
    return legacy.validate(value);
  const e = envelopeSchema.parse(value),
    ids = new Set<string>();
  if (e.schemaVersion !== 2 || e.rendererVersion !== "cuboids-2")
    throw Error("Unsupported cuboid version.");
  for (const s of e.document.shapes) {
    if (s.view === "layers" && appearance(s).mode === "one")
      throw Error(
        "One face uses an assembled cuboid. Choose Outline or Grey faces before separating layers.",
      );
    if (ids.has(s.id)) throw Error("Cuboid IDs must be distinct.");
    ids.add(s.id);
    for (const a of axes) {
      s.dimensions[a] = dimension(s.dimensions[a]);
      s.proportions[a] = dimension(s.proportions[a]);
    }
    s.cubeSideCm = dimension(s.cubeSideCm);
    if (
      val(parseNumber(s.cubeSideCm)) < 0.01 ||
      val(parseNumber(s.cubeSideCm)) > 10000
    )
      throw Error("Cube side must be between 0.01 and 10,000 cm.");
    if (axes.some((a) => val(inCm(s, a)) < 0.01 || val(inCm(s, a)) > 10000))
      throw Error(
        "Dimensions must be between 0.01 and 10,000 cm after unit conversion.",
      );
    if (
      s.cube &&
      axes.some((a) => {
        const r = parseNumber(s.dimensions[a]),
          b = parseNumber(s.dimensions.width);
        return r.n * b.d !== b.n * r.d;
      })
    )
      throw Error("A cube must have three equal dimensions.");
    for (const k of keys) {
      if (axes.includes(k as Axis) && s.labels[k].mode === "area")
        throw Error("An edge cannot have a face-area label.");
      if (
        faces.includes(k as (typeof faces)[number]) &&
        s.labels[k].mode === "value"
      )
        throw Error("Use an area or text label on a face.");
    }
    if (s.view !== "plain") {
      const c = decomposition(s);
      if (s.view === "layers" && c.height > 20)
        throw Error(
          "Separate layers supports up to 20 layers. Use the complete cube grid, or larger cubes.",
        );
    }
  }
  return e;
}
export function canonical(e: Envelope) {
  return JSON.stringify(validate(e));
}
export function parseFile(raw: string) {
  if (raw.length > 50000) throw Error("This editable file is too large.");
  return validate(JSON.parse(raw));
}
export function encode(e: Envelope) {
  const bytes = new TextEncoder().encode(canonical(e));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decode(s: string) {
  if (s.length > 66000) throw Error("This editor link is too large.");
  return parseFile(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
        c.charCodeAt(0),
      ),
    ),
  );
}
export function editorLink(e: Envelope, base: string) {
  const u = new URL(base);
  u.search = "?tool=cuboids";
  u.hash = `cuboids=${encode(e)}`;
  return u.href;
}
export const escapeXml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const font = 3.88;
export function textWidth(s: string) {
  return [...s].reduce((n, c) => n + glyphAdvance(c), 0) * font;
}
export function labelText(s: Shape, k: LabelKey) {
  const l = s.labels[k];
  if (l.mode === "hidden") return "";
  if (l.mode === "blank") return "…………";
  if (l.mode === "text") return l.text;
  if (l.mode === "value") return `${s.dimensions[k as Axis]} ${s.unit}`;
  const a =
    k === "front"
      ? ["width", "height"]
      : k === "top"
        ? ["width", "depth"]
        : ["depth", "height"];
  return `${fractionString(times(parseNumber(s.dimensions[a[0] as Axis]), parseNumber(s.dimensions[a[1] as Axis])))} ${s.unit}²`;
}
type Point = [number, number];
export type Target = {
  shapeId: string;
  key: LabelKey | "area";
  x: number;
  y: number;
  width: number;
  height?: number;
};
export type Layout = {
  width: number;
  height: number;
  svg: string;
  targets: Target[];
  shapeBoxes: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  minCell: number;
};
function wrap(s: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const c of [...s]) {
    if (textWidth(line + c) > width && line) {
      lines.push(line);
      line = "";
    }
    line += c;
  }
  if (line) lines.push(line);
  return lines;
}
export function layout(envelope: Envelope): Layout {
  if (envelope.schemaVersion === 1)
    return legacy.layout(envelope as legacy.Envelope);
  const e = validate(envelope),
    width = e.document.widthCm * 10,
    shapes = e.document.shapes;
  const cols =
      shapes.length > 1 && width / shapes.length >= 70 ? shapes.length : 1,
    slot = width / cols;
  function measure(s: Shape) {
    const dims = axes.map((a) =>
      s.view === "plain" && s.schematic
        ? val(parseNumber(s.proportions[a]))
        : val(inCm(s, a)),
    );
    const [rw, rd, rh] = dims,
      p =
        s.projection === "compact" ? 0.34 : s.projection === "deep" ? 0.7 : 0.5;
    const arrowMode = s.arrows && s.view !== "layers";
    const heightWidth = textWidth(labelText(s, "height")),
      depthWidth = textWidth(labelText(s, "depth"));
    const left = Math.max(
      7,
      arrowMode && s.direction === "left"
        ? Math.max(heightWidth, depthWidth) + 8
        : (s.direction === "right"
            ? arrowMode
              ? 0
              : heightWidth
            : depthWidth) + 5,
    );
    const right = Math.max(
      7,
      arrowMode && s.direction === "right"
        ? Math.max(heightWidth, depthWidth) + 8
        : (s.direction === "right" ? depthWidth : arrowMode ? 0 : heightWidth) +
            5,
    );
    const available = slot - left - right - 8;
    if (available < 14 || textWidth(labelText(s, "width")) > slot - 10)
      throw Error(
        "Labels need more print width. Increase Print width or shorten the labels.",
      );
    return {
      dims,
      p,
      left,
      right,
      u: Math.min(available / (rw + rd * p), 65 / Math.max(rh, rd * p * 0.7)),
    };
  }
  const sharedScale = Math.min(
    ...shapes
      .filter((s) => !s.schematic || s.view !== "plain")
      .map((s) => measure(s).u),
  );
  const body: string[] = [],
    targets: Target[] = [],
    shapeBoxes: Layout["shapeBoxes"] = [];
  let yOffset = 4,
    rowHeight = 0,
    minCell = Infinity;
  const text = (x: number, y: number, s: string, anchor = "middle") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="STIX Two Text,serif" font-size="${font}" fill="black">${escapeXml(s)}</text>`;
  const path = (a: Point, b: Point, stroke = 0.25, dash = false, extra = "") =>
    `<path d="M${a.join(",")}L${b.join(",")}" fill="none" stroke="black" stroke-width="${stroke}" ${dash ? 'stroke-dasharray="1.5 1"' : ""} ${extra}/>`;
  shapes.forEach((s, index) => {
    const style = appearance(s);
    let areaAt: Point | null = null;
    let areaRoom = [0, 0];
    const col = index % cols;
    if (col === 0 && index > 0) {
      yOffset += rowHeight + 8;
      rowHeight = 0;
    }
    const origin = col * slot,
      c = s.view === "plain" ? null : decomposition(s);
    const measured = measure(s),
      [rw, rd, rh] = measured.dims,
      p = measured.p;
    const heightLabel = labelText(s, "height");
    const left = measured.left;
    const u = s.view === "plain" && s.schematic ? measured.u : sharedScale;
    const w = rw * u,
      d = rd * u * p,
      v = -rd * u * p * 0.7,
      h = rh * u,
      layers = s.view === "layers" ? c!.height : 1,
      layerH = c ? c.sideCm * u : h;
    const cell = c ? c.sideCm * u : Infinity;
    if (c) minCell = Math.min(minCell, cell);
    const titleLines = wrap(s.title, slot - 8),
      titleH = titleLines.length * 5;
    titleLines.forEach((line, i) =>
      body.push(text(origin + slot / 2, yOffset + 4 + i * 5, line)),
    );
    const top = yOffset + titleH + 4,
      baseX =
        origin +
        left +
        4 +
        Math.max(0, slot - left - measured.right - 8 - w - d) / 2 +
        (s.direction === "left" ? d : 0),
      height =
        s.view === "layers" ? layers * (layerH - v) + (layers - 1) * 8 : h - v;
    const dx = s.direction === "right" ? d : -d;
    const shapeY = top + height;
    const localTargets: Partial<Record<LabelKey, Point>> = {};
    body.push(
      `<g data-shape="${s.id}" data-view="${s.view}" data-width-mm="${w}" data-height-mm="${h}"${c ? ` data-cube-count="${c.total}" data-layers="${c.height}"` : ""}>`,
    );
    for (let l = 0; l < layers; l++) {
      const bottom =
          s.view === "layers"
            ? top - v + layerH + l * (layerH - v + 8)
            : shapeY,
        hh = s.view === "layers" ? layerH : h;
      const A: Point = [baseX, bottom],
        B: Point = [baseX + w, bottom],
        C: Point = [baseX + w, bottom - hh],
        D: Point = [baseX, bottom - hh];
      const F: Point = [baseX + dx, bottom - hh + v],
        G: Point = [baseX + w + dx, bottom - hh + v],
        J: Point = [baseX + (dx > 0 ? w + dx : dx), bottom + v];
      const sideFront = dx > 0 ? B : A,
        sideTop = dx > 0 ? C : D;
      const poly = (ps: Point[], fill = "white", face = "") =>
        `<polygon points="${ps.map((p) => p.join(",")).join(" ")}" fill="${fill}"${face ? ` data-face="${face}"` : ""}/>`;
      const E: Point = [baseX + dx, bottom + v],
        H: Point = [baseX + w + dx, bottom + v];
      const allFaces: Record<FaceName, Point[]> = {
        top: [D, C, G, F],
        bottom: [A, B, H, E],
        front: [A, B, C, D],
        back: [E, H, G, F],
        left: [A, E, F, D],
        right: [B, H, G, C],
      };
      const tones =
        style.tone === "light"
          ? ["#f2f2f2", "#dedede", "#bfbfbf"]
          : ["#e6e6e6", "#c6c6c6", "#999999"];
      body.push(
        `<g data-layer="${l + 1}">`,
        ...(style.mode === "one"
          ? [
              poly(
                allFaces[style.face],
                style.tone === "light" ? "#dedede" : "#bfbfbf",
                style.face,
              ),
            ]
          : [
              poly(
                [D, C, G, F],
                style.mode === "faces" ? tones[0] : "white",
                "top",
              ),
              poly(
                [sideFront, J, dx > 0 ? G : F, sideTop],
                style.mode === "faces" ? tones[2] : "white",
                dx > 0 ? "right" : "left",
              ),
              poly(
                [A, B, C, D],
                style.mode === "faces" ? tones[1] : "white",
                "front",
              ),
            ]),
      );
      if (style.mode === "one") {
        const ps = allFaces[style.face];
        areaAt = [
          ps.reduce((n, p) => n + p[0], 0) / 4,
          ps.reduce((n, p) => n + p[1], 0) / 4 + 1.2,
        ];
        areaRoom =
          style.face === "top" || style.face === "bottom"
            ? [w - 4, Math.abs(v) - 4]
            : style.face === "front" || style.face === "back"
              ? [w - 4, h - 4]
              : [Math.abs(dx) * 0.65 - 4, h * 0.5 - 4];
      }
      if (c) {
        const gridH = s.view === "layers" ? 1 : c.height;
        for (let n = 1; n < c.width; n++) {
          const xx = baseX + (w * n) / c.width;
          body.push(
            path([xx, bottom], [xx, bottom - hh], 0.15),
            path([xx, bottom - hh], [xx + dx, bottom - hh + v], 0.15),
          );
        }
        for (let n = 1; n < gridH; n++) {
          const yy = bottom - (hh * n) / gridH;
          body.push(
            path([baseX, yy], [baseX + w, yy], 0.15),
            path([sideFront[0], yy], [sideFront[0] + dx, yy + v], 0.15),
          );
        }
        for (let n = 1; n < c.depth; n++) {
          const dd = (dx * n) / c.depth,
            vv = (v * n) / c.depth;
          body.push(
            path(
              [baseX + dd, bottom - hh + vv],
              [baseX + w + dd, bottom - hh + vv],
              0.15,
            ),
            path(
              [sideFront[0] + dd, bottom + vv],
              [sideTop[0] + dd, bottom - hh + vv],
              0.15,
            ),
          );
        }
      }
      if ((s.view === "plain" && s.hiddenEdges) || style.mode === "one") {
        const rear: Point = [baseX + (dx > 0 ? dx : w + dx), bottom + v];
        body.push(
          path(dx > 0 ? A : B, rear, 0.15, true),
          path(rear, dx > 0 ? F : G, 0.15, true),
          path(rear, J, 0.15, true),
        );
      }
      for (const [a, b] of [
        [A, B],
        [B, C],
        [C, D],
        [D, A],
        [D, F],
        [F, G],
        [G, C],
        [sideFront, J],
        [J, dx > 0 ? G : F],
      ] as [Point, Point][])
        body.push(path(a, b));
      if (s.layerNumbers && s.view === "layers")
        body.push(
          text(origin + slot / 2, bottom - hh + v - 1, `Layer ${l + 1}`),
        );
      if (l === 0) {
        localTargets.front = [baseX + w / 2, bottom - hh / 2 + 1];
        localTargets.top = [baseX + w / 2 + dx / 2, bottom - hh + v / 2 + 1];
        localTargets.side = [
          sideFront[0] + dx / 2,
          bottom - hh / 2 + v / 2 + 1,
        ];
      }
      if (l === layers - 1) {
        localTargets.width = [baseX + w / 2, bottom + 8];
        localTargets.depth = [
          sideFront[0] + dx + (dx > 0 ? 3 : -3),
          bottom + v / 2 + 4,
        ];
        localTargets.height = [
          s.arrows && s.view !== "layers"
            ? baseX + (dx > 0 ? w + dx + 6 : dx - 6)
            : baseX + (dx > 0 ? -4 : w + 4),
          s.view === "layers"
            ? top + height / 2
            : bottom - h / 2 + 1 + (s.arrows ? v : 0),
        ];
      }
      body.push("</g>");
    }
    for (const k of keys) {
      const l = s.labels[k],
        raw = s.view === "layers" && k === "height" ? "" : labelText(s, k),
        at = localTargets[k]!;
      let [x, y] = at;
      x += l.x;
      y += l.y;
      let anchor =
        k === "height"
          ? (s.arrows && s.view !== "layers" ? dx < 0 : dx > 0)
            ? "end"
            : "start"
          : k === "depth"
            ? dx > 0
              ? "start"
              : "end"
            : "middle";
      if (s.view === "layers" && k === "height")
        anchor = dx > 0 ? "end" : "start";
      const tw = textWidth(raw),
        min = origin + 2,
        max = origin + slot - 2;
      if (tw > slot - 8)
        throw Error(
          "This face label needs more print width. Increase Print width or shorten the label.",
        );
      if (anchor === "middle")
        x = Math.max(min + tw / 2, Math.min(max - tw / 2, x));
      else if (anchor === "start") x = Math.max(min, Math.min(max - tw, x));
      else x = Math.max(min + tw, Math.min(max, x));
      y = Math.max(top + font, Math.min(shapeY + 8, y));
      const tx =
        anchor === "start" ? x + tw / 2 : anchor === "end" ? x - tw / 2 : x;
      targets.push({
        shapeId: s.id,
        key: k,
        x: raw ? tx : at[0],
        y: raw ? y - 1.4 : at[1] - 1.4,
        width: Math.max(8, tw + 2),
      });
      if (raw) {
        if (faces.includes(k as (typeof faces)[number]))
          body.push(
            `<rect x="${tx - tw / 2 - 0.8}" y="${y - font + 0.3}" width="${tw + 1.6}" height="${font + 1}" fill="white"/>`,
          );
        body.push(text(x, y, raw, anchor));
      }
    }
    if (s.arrows && s.view !== "layers") {
      body.push(
        path(
          [baseX, shapeY + 4],
          [baseX + w, shapeY + 4],
          0.18,
          false,
          'marker-start="url(#arrow)" marker-end="url(#arrow)"',
        ),
      );
      const sideX = baseX + (dx > 0 ? w + dx + 2 : dx - 2);
      body.push(
        path(
          [sideX, shapeY + v],
          [sideX, shapeY - h + v],
          0.18,
          false,
          'data-dimension="height" marker-start="url(#arrow)" marker-end="url(#arrow)"',
        ),
        path(
          [baseX + (dx > 0 ? w : 0) + 2 * Math.sign(dx), shapeY + 2],
          [baseX + (dx > 0 ? w : 0) + dx + 2 * Math.sign(dx), shapeY + v + 2],
          0.18,
          false,
          'marker-start="url(#arrow)" marker-end="url(#arrow)"',
        ),
      );
    }
    body.push("</g>");
    const captions: string[] = [];
    const areaText = faceAreaLabel(s);
    if (areaText && areaAt) {
      const onFace =
        textWidth(areaText) <= areaRoom[0] &&
        font + 2 <= areaRoom[1] &&
        faces.every((k) => !labelText(s, k));
      if (onFace) {
        body.push(
          `<rect data-area-label="background" x="${areaAt[0] - textWidth(areaText) / 2 - 0.8}" y="${areaAt[1] - font + 0.3}" width="${textWidth(areaText) + 1.6}" height="${font + 1}" fill="white"/>`,
          text(areaAt[0], areaAt[1], areaText),
        );
        targets.push({
          shapeId: s.id,
          key: "area",
          x: areaAt[0],
          y: areaAt[1] - 1.4,
          width: Math.max(8, textWidth(areaText) + 2),
        });
      } else {
        const lines = wrap(areaText, slot - 8);
        lines.forEach((line) => captions.push(line));
        targets.push({
          shapeId: s.id,
          key: "area",
          x: origin + slot / 2,
          y: shapeY + 16 - 1.4 + (lines.length - 1) * 2.5,
          width: Math.min(slot - 4, textWidth(lines[0]) + 2),
          height: lines.length * 5 + 1,
        });
      }
    }
    if (s.view === "layers" && heightLabel)
      captions.push(`Full height: ${heightLabel}`);
    if (s.caption) captions.push(s.caption);
    const results = calculations(s);
    if (s.workedVolume)
      captions.push(
        `Volume = ${s.dimensions.width} × ${s.dimensions.depth} × ${s.dimensions.height} = ${results.volume} ${s.unit}³`,
      );
    if (s.workedArea)
      captions.push(`Surface area = ${results.area} ${s.unit}²`);
    if (c && s.counts)
      captions.push(
        `${c.width * c.depth} cubes per layer × ${c.height} layers = ${c.total} cubes`,
      );
    const lines = captions.flatMap((v) => wrap(v, slot - 8));
    if (s.view === "layers" && heightLabel) {
      const target = targets.find(
        (t) => t.shapeId === s.id && t.key === "height",
      )!;
      target.x = origin + slot / 2;
      target.y = shapeY + 16 - 1.4;
      target.width = Math.min(slot - 4, textWidth(lines[0]) + 2);
    }
    lines.forEach((s, i) =>
      body.push(text(origin + slot / 2, shapeY + 16 + i * 5, s)),
    );
    const used = titleH + height + 18 + lines.length * 5;
    rowHeight = Math.max(rowHeight, used);
    shapeBoxes.push({
      id: s.id,
      x: origin,
      y: yOffset,
      width: slot,
      height: used,
    });
  });
  const height = yOffset + rowHeight + 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width / 10}cm" height="${height / 10}cm" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cuboid diagrams"><defs><marker id="arrow" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="1.6" markerHeight="1.6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L6 3 L0 6 Z" fill="black"/></marker></defs><rect width="${width}" height="${height}" fill="white"/>${body.join("")}</svg>`;
  return { width, height, svg, targets, shapeBoxes, minCell };
}
export function exportIssue(e: Envelope): string | null {
  try {
    const m = layout(e);
    if (m.minCell < 2)
      return "The printed cube cells would be smaller than 2 mm. Increase Print width, use larger cubes, or choose Exam diagram.";
    const pixels = (m.width / 25.4) * 600 * ((m.height / 25.4) * 600);
    if (pixels > 64000000 || m.height > 1500)
      return "This resource is too tall for a dependable image export. Reduce the layers or print width.";
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
export function renderSvg(e: Envelope) {
  const issue = exportIssue(e);
  if (issue) throw Error(issue);
  return layout(e).svg;
}
export function warnings(s: Shape) {
  const result: string[] = [];
  if (s.schematic && s.view !== "plain")
    result.push(
      "Cube view uses exact proportions. Your exam-diagram proportions are retained.",
    );
  if (s.view === "layers")
    result.push(
      "Layer gaps are teaching spaces; they are not part of the cuboid's height.",
    );
  if (s.caption) {
    const m = s.caption.match(/^Volume\s*=\s*([\d./]+)\s*(cm|mm|m)³$/i);
    if (m && m[2] === s.unit) {
      try {
        const a = parseNumber(m[1]),
          b = parseNumber(calculations(s).volume);
        if (a.n * b.d !== b.n * a.d)
          result.push(
            "The custom volume caption differs from the dimensions. It is retained for your teaching task.",
          );
      } catch {
        /*Free text is allowed.*/
      }
    }
  }
  return result;
}
