import { z } from "zod";
import { DIAGRAM_KINDS, FAMILIES, type DiagramKind } from "../../../packages/diagram-core/src/registry";
import type { Resource } from "../../../packages/resource-core/src/index";

/**
 * Which diagram families a worksheet request is likely to need. Only those families' spec schemas
 * are sent, in the user turn, so the cached system prompt and tool schema stay byte-identical and
 * a worksheet about fractions never pays for the triangle and bar-model schemas.
 */
const CUES: Record<DiagramKind, RegExp> = {
  graph: /coordinat|straight[- ]line|linear graph|gradient|y ?= ?m?x|plot(ting)? (the )?points|axes/,
  "ratio-table": /ratio|proportion|scal(e|ing)|recipe|best buy|unitary|conversion|gradient|\brates?\b/,
  "value-graph": /quadratic|table of values|parabola|curve|plot(ting)? (a |the )?graph/,
  cuboids: /cuboid|\bcubes?\b|volume|surface area|prism|3d|isometric/,
  "number-line": /number line|inequalit|interval|negative number|integers?|ordering|order(ing)? (decimals|numbers)|round(ing)?/,
  venn: /venn|\bsets?\b|set notation|union|intersection/,
  "algebra-grid": /expand|factori[sz]|brackets?|grid method|multiply(ing)? out/,
  "bar-model": /bar model|fraction of|percentage of|\bshar(e|ing)\b|part[- ]whole|ratio problem/,
  charts: /bar chart|line chart|vertical line|dual bar|comparative bar|composite bar|frequency|\bdata\b|statistic|pictogram|tally/,
  "probability-tree": /tree diagram|probabilit|combined event|independent|dependent|conditional/,
  "frequency-tree": /frequency tree/,
  "two-way-table": /two-way|two way/,
  triangle: /triangle|pythagoras|trigonometr|\bsine\b|cosine|tangent|soh ?cah|angle|hypotenuse/,
};

export function familiesFor(text: string, current?: Resource): DiagramKind[] {
  const t = text.toLowerCase();
  const used = new Set<DiagramKind>(current ? diagramsIn(current) : []);
  return DIAGRAM_KINDS.filter((k) => used.has(k) || CUES[k].test(t));
}

function diagramsIn(r: Resource): DiagramKind[] {
  const kinds: DiagramKind[] = [];
  const visit = (item: { type: string; items?: unknown[]; diagram?: { tool: DiagramKind } }) => {
    if (item.type === "diagram" && item.diagram) kinds.push(item.diagram.tool);
    if (item.type === "part") for (const child of item.items ?? []) visit(child as never);
  };
  for (const side of r.document.sides) for (const column of side.columns) for (const card of column.cards) for (const item of card.items) visit(item as never);
  return kinds;
}

const specCache = new Map<DiagramKind, string>();
function specSchema(kind: DiagramKind): string {
  let s = specCache.get(kind);
  if (!s) {
    const json = z.toJSONSchema(FAMILIES[kind].createSchema, { io: "input", unrepresentable: "any" }) as { properties?: { spec?: unknown } };
    s = JSON.stringify(json.properties?.spec ?? {});
    specCache.set(kind, s);
  }
  return s;
}

/** The request's diagram section: the chosen families' spec schemas, or a note that none apply. */
export function familyNotes(kinds: DiagramKind[]): string {
  if (!kinds.length)
    return "Diagram families for this request: none suggested. Use space items of kind drawing for pupils' own diagrams; if a pre-drawn diagram is essential, say which in flags.";
  const lines = [
    `Diagram families for this request. Write each diagram item as {"type":"diagram","diagram":{"tool":"<kind>","spec":{...}}}; the page builds and checks it. Leave a setting out to take its default. Pupil blanks, answer lines and hidden values follow each spec's own fields.`,
  ];
  for (const k of kinds) lines.push(`<family kind="${k}" summary="${FAMILIES[k].summary}">${specSchema(k)}</family>`);
  return lines.join("\n");
}
