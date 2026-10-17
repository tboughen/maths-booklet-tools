import { z } from "zod";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";

export const MAX_TERMS = 6;
export const FONT = (12 * 25.4) / 72;
const LIMIT = 999_999_999_999n;
export type Term = { coefficient: bigint; power: number };
export function term(raw: string): Term {
  const s = raw
    .replaceAll(/\s/g, "")
    .replaceAll("−", "-")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3");
  const match = s.match(/^([+-]?)(\d*)(x(?:\^([0-6]))?)?$/);
  if (!match || (!match[2] && !match[3]))
    throw Error(
      "Enter an integer term such as x^2, -12x or +24 (powers 0–6). Leave empty for a blank cell.",
    );
  const coefficient = BigInt((match[1] === "-" ? "-" : "") + (match[2] || "1"));
  if (coefficient > LIMIT || coefficient < -LIMIT)
    throw Error("Use a coefficient between −999999999999 and 999999999999.");
  return {
    coefficient,
    power: coefficient === 0n ? 0 : match[3] ? Number(match[4] ?? 1) : 0,
  };
}
export function termText(t: Term, positiveSign = false): string {
  if (!t.coefficient) return "0";
  const n = t.coefficient < 0n ? -t.coefficient : t.coefficient;
  return (
    (t.coefficient < 0n ? "-" : positiveSign ? "+" : "") +
    (n === 1n && t.power ? "" : String(n)) +
    (t.power ? "x" + (t.power === 1 ? "" : `^${t.power}`) : "")
  );
}
export function normalTerm(s: string) {
  return termText(term(s), s.trim().startsWith("+"));
}
export function polynomial(s: string): bigint[] {
  const text = s
    .replaceAll(/\s/g, "")
    .replaceAll("−", "-")
    .replaceAll("²", "^2")
    .replaceAll("³", "^3");
  if (!text || text.length > 160)
    throw Error(
      "Enter an expression in x with integer coefficients, for example x^2+5x+6.",
    );
  const parts = text.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join("") !== text)
    throw Error("Check the signs in the expression.");
  const p = Array<bigint>(7).fill(0n);
  for (const part of parts) {
    const t = term(part);
    p[t.power] += t.coefficient;
  }
  for (const n of p)
    if (n > LIMIT || n < -LIMIT)
      throw Error("The collected coefficient is too large.");
  return p;
}
export function polynomialText(p: bigint[]) {
  return (
    p
      .map((coefficient, power) => ({ coefficient, power }))
      .reverse()
      .filter((t) => t.coefficient !== 0n)
      .map((t, i) => termText(t, i > 0))
      .join("") || "0"
  );
}
export function expandedExpression(raw: string): bigint[] {
  const s = raw.replaceAll(/\s/g, "").replaceAll("−", "-");
  if (!s.includes("(")) return polynomial(s);
  const first = s.indexOf("("),
    prefix = s.slice(0, first),
    groups = s.slice(first).match(/\([^()]+\)/g);
  if (!groups || groups.join("") !== s.slice(first) || groups.length > 3)
    throw Error(
      "Use up to three brackets in x, for example 3(x+4) or (x+2)(x-3).",
    );
  let p = prefix ? polynomial(prefix) : polynomial("1");
  for (const group of groups) {
    const q = polynomial(group.slice(1, -1)),
      product = Array<bigint>(13).fill(0n);
    p.forEach((a, i) =>
      q.forEach((b, j) => {
        product[i + j] += a * b;
      }),
    );
    if (product.slice(7).some((v) => v !== 0n))
      throw Error("Use an expression of degree at most six.");
    p = polynomial(polynomialText(product.slice(0, 7)));
  }
  return p;
}
const cellSchema = z
  .object({ value: z.string().max(32).nullable(), hidden: z.boolean() })
  .strict();
const id = z.string().regex(/^[a-z0-9-]{1,48}$/);
const columnSchema = z
  .object({
    id,
    widthMm: z.number().min(12).max(45),
    fixed: z.boolean().default(false),
  })
  .strict();
const rowSchema = z
  .object({
    id,
    cells: z
      .array(cellSchema)
      .min(2)
      .max(MAX_TERMS + 1),
  })
  .strict();
export const documentSchema = z
  .object({
    mode: z.enum(["expand", "factorise"]),
    columns: z
      .array(columnSchema)
      .min(2)
      .max(MAX_TERMS + 1),
    rows: z
      .array(rowSchema)
      .min(2)
      .max(MAX_TERMS + 1),
    cellMm: z.number().min(12).max(18),
    // Absent fields retain the first draft's physical layout when imported.
    compactHeadings: z.boolean().default(false),
    gridLineMm: z
      .union([
        z.literal(0.2),
        z.literal(0.35),
        z.literal(0.5),
        z.literal(0.79375),
      ])
      .default(0.2),
    paper: z.enum(["A4", "A3"]),
    orientation: z.enum(["portrait", "landscape"]),
    expression: z.string().max(160),
    questionVisible: z.boolean(),
    gridVisible: z.boolean(),
    answerLines: z.number().int().min(0).max(3),
    answer: z.string().max(500),
    answerVisible: z.boolean(),
    answerBasis: z.string().max(8192).nullable(),
    intentionalError: z.boolean(),
    sourceId: z.string().max(100).nullable(),
  })
  .strict();
export const schema = z
  .object({
    kind: z.literal("algebra-grid"),
    schemaVersion: z.literal(1),
    rendererVersion: z.literal("algebra-grid-1"),
    styleProfile: z.literal("departmental-v1"),
    document: documentSchema,
  })
  .strict();
export type Envelope = z.infer<typeof schema>;
export type Cell = z.infer<typeof cellSchema>;
export function validate(raw: unknown): Envelope {
  const e = schema.parse(raw),
    d = e.document;
  if (
    new Set(d.rows.map((r) => r.id)).size !== d.rows.length ||
    new Set(d.columns.map((c) => c.id)).size !== d.columns.length
  )
    throw Error("Rows and columns need unique IDs.");
  for (let r = 0; r < d.rows.length; r++) {
    if (d.rows[r].cells.length !== d.columns.length)
      throw Error("Every row must have one cell per column.");
    for (let c = 0; c < d.columns.length; c++) {
      const cell = d.rows[r].cells[c];
      if (!r && !c) {
        if (cell.value !== "×" && cell.value !== null)
          throw Error("Use × or a blank in the top-left cell.");
      } else if (cell.value !== null) cell.value = normalTerm(cell.value);
      if (cell.value === null && cell.hidden)
        throw Error("A blank cell cannot contain a hidden answer.");
    }
  }
  if (d.expression)
    (d.mode === "factorise" ? polynomial : expandedExpression)(d.expression);
  if (!/^[\w\s()+\-−^²³×=]*$/.test(d.expression + d.answer))
    throw Error("Use mathematical expressions without markup.");
  return e;
}
export const canonical = (e: Envelope) => JSON.stringify(validate(e));
export function parseFile(text: string) {
  if (new TextEncoder().encode(text).length > 64_000)
    throw Error("Use an algebra-grid file smaller than 64 KiB.");
  return validate(JSON.parse(text));
}
export const blank = (): Cell => ({ value: null, hidden: false });
export function create(rows = 3, columns = 3): Envelope {
  return validate({
    kind: "algebra-grid",
    schemaVersion: 1,
    rendererVersion: "algebra-grid-1",
    styleProfile: "departmental-v1",
    document: {
      mode: "expand",
      cellMm: 15,
      compactHeadings: true,
      gridLineMm: 0.5,
      paper: "A4",
      orientation: "portrait",
      columns: Array.from({ length: columns }, (_, c) => ({
        id: `c${c}`,
        widthMm: 15,
      })),
      rows: Array.from({ length: rows }, (_, r) => ({
        id: `r${r}`,
        cells: Array.from({ length: columns }, (_, c) =>
          !r && !c ? { value: "×", hidden: false } : blank(),
        ),
      })),
      expression: "",
      questionVisible: false,
      gridVisible: true,
      answerLines: 0,
      answer: "",
      answerVisible: false,
      answerBasis: null,
      intentionalError: false,
      sourceId: null,
    },
  });
}
export function setCell(
  e: Envelope,
  r: number,
  c: number,
  value: string | null,
  hidden = false,
) {
  const n = structuredClone(e);
  n.document.rows[r].cells[c] = {
    value: value === "" ? null : value,
    hidden: !!value && hidden,
  };
  n.document.sourceId = null;
  return validate(n);
}
export function resize(
  e: Envelope,
  axis: "row" | "column",
  add: boolean,
): Envelope {
  const n = structuredClone(e),
    d = n.document,
    length = axis === "row" ? d.rows.length : d.columns.length;
  if ((add && length >= MAX_TERMS + 1) || (!add && length <= 2))
    throw Error(
      "Use 1–6 terms along each edge (2–7 total cells including headings).",
    );
  if (axis === "row") {
    if (add)
      d.rows.push({
        id: `r-${crypto.randomUUID()}`,
        cells: d.columns.map(blank),
      });
    else d.rows.pop();
  } else if (add) {
    d.columns.push({
      id: `c-${crypto.randomUUID()}`,
      widthMm: d.cellMm,
      fixed: false,
    });
    d.rows.forEach((r) => r.cells.push(blank()));
  } else {
    d.columns.pop();
    d.rows.forEach((r) => r.cells.pop());
  }
  d.sourceId = null;
  return validate(n);
}
export function setSize(e: Envelope, size: number) {
  const n = structuredClone(e);
  n.document.cellMm = size;
  n.document.columns.forEach((c) => {
    c.widthMm = size;
    c.fixed = false;
  });
  return validate(n);
}
function multiply(a: string, b: string, plus = false) {
  const x = term(a),
    y = term(b),
    t = {
      coefficient: x.coefficient * y.coefficient,
      power: x.power + y.power,
    };
  if (t.power > 6 && t.coefficient)
    throw Error(
      "This product needs a power above x^6; use headings with a smaller combined power.",
    );
  return normalTerm(termText(t, plus));
}
export function fillProducts(e: Envelope) {
  const n = structuredClone(e),
    d = n.document;
  for (let r = 1; r < d.rows.length; r++)
    for (let c = 1; c < d.columns.length; c++) {
      const a = d.rows[r].cells[0].value,
        b = d.rows[0].cells[c].value;
      if (a === null || b === null)
        throw Error(
          "Enter all row and column headings before filling products. Blank headings are preserved.",
        );
      d.rows[r].cells[c] = {
        value: multiply(a, b, r !== 1 || c !== 1),
        hidden: false,
      };
    }
  return validate(n);
}
export function collected(e: Envelope) {
  const p = Array<bigint>(7).fill(0n);
  for (const row of e.document.rows.slice(1))
    for (const cell of row.cells.slice(1)) {
      if (cell.value === null)
        throw Error("Complete every product before collecting like terms.");
      const t = term(cell.value);
      p[t.power] += t.coefficient;
    }
  return polynomialText(polynomial(polynomialText(p)));
}
export function factors(e: Envelope) {
  const d = e.document;
  const sum = (values: (string | null)[]) => {
    if (values.some((v) => v === null))
      throw Error("Complete all headings to read the factors.");
    return values
      .map((v, i) => {
        const t = term(v!);
        return t.coefficient === 0n && i > 0 ? "+0" : termText(t, i > 0);
      })
      .join("");
  };
  const left = sum(d.rows.slice(1).map((r) => r.cells[0].value)),
    top = sum(d.rows[0].cells.slice(1).map((c) => c.value));
  return d.rows.length === 2 ? `${left}(${top})` : `(${left})(${top})`;
}
export function warnings(e: Envelope): string[] {
  const d = e.document,
    out: string[] = [];
  for (let r = 1; r < d.rows.length; r++)
    for (let c = 1; c < d.columns.length; c++) {
      const a = d.rows[r].cells[0].value,
        b = d.rows[0].cells[c].value,
        v = d.rows[r].cells[c].value;
      if (a !== null && b !== null && v !== null) {
        try {
          if (
            normalTerm(multiply(a, b)).replace(/^\+/, "") !==
            normalTerm(v).replace(/^\+/, "")
          )
            out.push(
              `Row ${r + 1}, column ${c + 1} does not equal its headings' product.`,
            );
        } catch (error) {
          out.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
  if (d.mode === "factorise" && d.expression) {
    try {
      const actual = collected(fillProducts(e));
      if (actual !== polynomialText(polynomial(d.expression)))
        out.push(
          "These headings do not reproduce the whole target expression.",
        );
    } catch {
      /* Incomplete headings are intentional pupil scaffolds. */
    }
    try {
      const actual = collected(e);
      if (actual !== polynomialText(polynomial(d.expression)))
        out.push(
          "The entered products do not collect to the whole target expression.",
        );
    } catch {
      /* Incomplete products are intentional pupil scaffolds. */
    }
  }
  if (d.mode === "expand" && d.questionVisible && d.expression) {
    try {
      if (
        collected(fillProducts(e)) !==
        polynomialText(expandedExpression(d.expression))
      )
        out.push(
          "These headings do not match the printed question expression.",
        );
    } catch {
      /* An incomplete scaffold remains valid. */
    }
  }
  if (d.answerVisible && d.answer && d.answerBasis !== answerBasis(e))
    out.push(
      "The saved final answer belongs to earlier entries. Hide it or calculate a new answer.",
    );
  return [...new Set(out)];
}
function answerBasis(e: Envelope) {
  const d = e.document;
  return JSON.stringify([
    d.mode,
    d.expression,
    d.rows.map((r) => r.cells.map((c) => c.value)),
  ]);
}
export function collectAnswer(e: Envelope) {
  const n = structuredClone(e);
  n.document.answerVisible = false;
  if (warnings(n).length)
    throw Error("Correct the grid before calculating its answer.");
  n.document.answer =
    n.document.mode === "expand" ? collected(n) : factors(fillProducts(n));
  n.document.answerVisible = true;
  n.document.answerBasis = answerBasis(n);
  return validate(n);
}
function squareRoot(n: bigint) {
  if (n < 0n) return -1n;
  if (n < 2n) return n;
  let x = n,
    y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
export function workedCopy(e: Envelope) {
  let n = structuredClone(e);
  const d = n.document;
  if (d.mode === "factorise") {
    const p = polynomial(d.expression);
    if (
      d.rows.length === 3 &&
      d.columns.length === 3 &&
      p[2] === 1n &&
      p.slice(3).every((v) => v === 0n)
    ) {
      const disc = p[1] * p[1] - 4n * p[0],
        root = squareRoot(disc);
      if (root < 0n || root * root !== disc || (p[1] + root) % 2n)
        throw Error(
          "This quadratic does not factor into integer monic brackets.",
        );
      const a = (p[1] + root) / 2n,
        b = (p[1] - root) / 2n;
      d.rows[0].cells[1] = { value: "x", hidden: false };
      d.rows[0].cells[2] = {
        value: termText({ coefficient: a, power: 0 }, true),
        hidden: false,
      };
      d.rows[1].cells[0] = { value: "x", hidden: false };
      d.rows[2].cells[0] = {
        value: termText({ coefficient: b, power: 0 }, true),
        hidden: false,
      };
    } else if (d.rows.length === 2) {
      const entries = p
        .map((coefficient, power) => ({ coefficient, power }))
        .reverse()
        .filter((t) => t.coefficient !== 0n);
      if (!entries.length || entries.length !== d.columns.length - 1)
        throw Error(
          "Use one product column per non-zero term for a common-factor worked copy.",
        );
      const common = entries.reduce((a, t) => gcd(a, t.coefficient), 0n),
        power = Math.min(...entries.map((t) => t.power));
      d.rows[1].cells[0] = {
        value: termText({ coefficient: common, power }),
        hidden: false,
      };
      entries.forEach((t, i) => {
        d.rows[0].cells[i + 1] = {
          value: termText(
            { coefficient: t.coefficient / common, power: t.power - power },
            i > 0,
          ),
          hidden: false,
        };
      });
    } else {
      const actual = collected(fillProducts(n));
      if (actual !== polynomialText(p))
        throw Error(
          "Supply correct headings, or use a 3 × 3 monic quadratic / single-row common-factor scaffold for an automatic worked copy.",
        );
    }
  }
  d.rows.forEach((row) =>
    row.cells.forEach((cell) => {
      cell.hidden = false;
    }),
  );
  d.intentionalError = false;
  n = fillProducts(n);
  n = collectAnswer(n);
  return n;
}
export function answerBelow(e: Envelope) {
  const n = structuredClone(e);
  n.document.answerVisible = false;
  if (warnings(n).length)
    throw Error("Correct the grid before calculating its answer.");
  const worked = workedCopy(n);
  n.document.answer = worked.document.answer;
  n.document.answerVisible = true;
  n.document.answerBasis = answerBasis(n);
  return validate(n);
}
export function example(name = "double", worked = false): Envelope {
  const data: Record<
    string,
    { top: string[]; left: string[]; expression: string; factor?: boolean }
  > = {
    single: { top: ["x", "+4"], left: ["3"], expression: "3(x+4)" },
    double: { top: ["x", "+3"], left: ["x", "+2"], expression: "(x+2)(x+3)" },
    signed: { top: ["x", "-3"], left: ["x", "+2"], expression: "(x+2)(x-3)" },
    cubic: {
      top: ["x^2", "+2x", "+3"],
      left: ["x", "+4"],
      expression: "(x^2+2x+3)(x+4)",
    },
    factor: {
      top: ["x", "+3"],
      left: ["x", "+2"],
      expression: "x^2+5x+6",
      factor: true,
    },
    negative: {
      top: ["x", "-2"],
      left: ["x", "+5"],
      expression: "x^2+3x-10",
      factor: true,
    },
    common: {
      top: ["x", "+4"],
      left: ["x"],
      expression: "x^2+4x",
      factor: true,
    },
    "source-expand": {
      top: ["2x", "-3"],
      left: ["5x", "+2"],
      expression: "(5x+2)(2x-3)",
    },
    "source-factor": {
      top: ["x", "+3"],
      left: ["x", "+1"],
      expression: "x^2+4x+3",
      factor: true,
    },
  };
  const info = data[name];
  if (!info) throw Error("Unknown example.");
  let e = create(info.left.length + 1, info.top.length + 1);
  const d = e.document;
  d.mode = info.factor ? "factorise" : "expand";
  d.expression = info.expression;
  d.questionVisible = false;
  d.answerLines = 0;
  info.top.forEach((v, i) => {
    d.rows[0].cells[i + 1].value = v;
  });
  info.left.forEach((v, i) => {
    d.rows[i + 1].cells[0].value = v;
  });
  if (info.factor && !worked) {
    const complete = fillProducts(e);
    if (d.rows.length === 3) {
      d.rows[0].cells[2] = blank();
      d.rows[2].cells[0] = blank();
      d.rows[1].cells[1] = complete.document.rows[1].cells[1];
      d.rows[2].cells[2] = complete.document.rows[2].cells[2];
    } else {
      d.rows[1].cells[0] = blank();
      d.rows[0].cells.forEach((_, c) => {
        if (c) {
          d.rows[0].cells[c] = blank();
          d.rows[1].cells[c] = complete.document.rows[1].cells[c];
        }
      });
    }
  }
  if (worked) e = workedCopy(e);
  if (name.startsWith("source-")) e.document.sourceId = "1MA1_NOV_2018_2F_Q26";
  return validate(e);
}
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function display(s: string) {
  return s.replaceAll("-", "−").replaceAll("^2", "²").replaceAll("^3", "³");
}
function mathParts(
  s: string,
): { text: string; super: boolean; italic: boolean }[] {
  return (s.replaceAll("-", "−").match(/\^[0-6]|x|[^x^]+/g) ?? []).map((t) => ({
    text: t.startsWith("^") ? t.slice(1) : t,
    super: t.startsWith("^"),
    italic: t === "x",
  }));
}
const textSize = (s: string) => (s === "×" ? FONT * 1.5 : FONT);
export const textWidth = (s: string) =>
  mathParts(s).reduce(
    (a, p) =>
      a +
      Array.from(p.text).reduce((b, c) => b + glyphAdvance(c, p.italic), 0) *
        textSize(s) *
        (p.super ? 0.7 : 1),
    0,
  );
function textSvg(s: string, x: number, y: number, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="STIX Two Text" font-size="${textSize(s)}" fill="#000">${mathParts(
    s,
  )
    .map(
      (p) =>
        `<tspan${p.super ? ' baseline-shift="super" font-size="70%"' : ' baseline-shift="baseline" font-size="100%"'}${p.italic ? ' font-style="italic"' : ' font-style="normal"'}>${esc(p.text)}</tspan>`,
    )
    .join("")}</text>`;
}
export function layout(e: Envelope) {
  const d = e.document;
  const filled = (cell: Cell) => cell.value !== null && !cell.hidden;
  const compactRow = d.compactHeadings && d.rows[0].cells.every(filled);
  const compactColumn =
    d.compactHeadings && d.rows.every((row) => filled(row.cells[0]));
  const ceilHalf = (value: number) => Math.ceil(value * 2) / 2;
  const headingHeight = compactRow
    ? Math.min(d.cellMm, ceilHalf(Math.max(9, FONT * 1.5 + 2.5)))
    : d.cellMm;
  // An explicit first-column width overrides automatic compaction. The stored
  // widths never change when a heading is filled, cleared or hidden.
  const firstWidth = d.columns[0].widthMm;
  const headingWidth =
    compactColumn && !d.columns[0].fixed && firstWidth === d.cellMm
      ? Math.min(
          firstWidth,
          ceilHalf(
            Math.max(
              9,
              ...d.rows.map((row) => textWidth(row.cells[0].value!) + 2.5),
            ),
          ),
        )
      : firstWidth;
  const columnWidths = d.columns.map((c, i) => (i ? c.widthMm : headingWidth));
  const rowHeights = d.rows.map((_, i) => (i ? d.cellMm : headingHeight));
  const gridWidth = columnWidths.reduce((a, width) => a + width, 0),
    gridHeight = rowHeights.reduce((a, height) => a + height, 0);
  const question =
    d.questionVisible && d.expression
      ? `${d.mode === "factorise" ? "Factorise " : "Expand "}${d.expression}`
      : "";
  const width = Math.max(
    gridWidth,
    question ? textWidth(question) + 6 : 0,
    d.answerVisible && d.answer ? textWidth(d.answer) + 6 : 0,
  );
  const gridX = (width - gridWidth) / 2,
    gridY = question ? 11 : 0;
  const answerY = gridY + gridHeight + 9;
  const height =
    gridY +
    gridHeight +
    (d.answerVisible && d.answer ? 11 : 0) +
    d.answerLines * 9;
  const x = [gridX];
  columnWidths.forEach((width) => x.push(x[x.length - 1] + width));
  const y = [gridY];
  rowHeights.forEach((height) => y.push(y[y.length - 1] + height));
  const cells = d.rows.flatMap((row, r) =>
    row.cells.map((cell, c) => ({
      r,
      c,
      cell,
      x: x[c],
      y: y[r],
      w: columnWidths[c],
      h: rowHeights[r],
    })),
  );
  const issues = cells
    .filter(
      (a) =>
        a.cell.value && !a.cell.hidden && textWidth(a.cell.value) > a.w - 2.5,
    )
    .map(
      (a) =>
        `Row ${a.r + 1}, column ${a.c + 1} is crowded. Increase column ${a.c + 1}'s width.`,
    );
  const page = d.paper === "A4" ? [210, 297] : [297, 420];
  if (d.orientation === "landscape") page.reverse();
  if (width > page[0] - 20 || height > page[1] - 20)
    issues.push(
      "The resource exceeds this paper's 10 mm placement margins. Adjust the paper, orientation or dimensions; it has not been scaled.",
    );
  return {
    width,
    height,
    gridWidth,
    gridHeight,
    gridX,
    gridY,
    x,
    y,
    headingWidth,
    headingHeight,
    columnWidths,
    rowHeights,
    cells,
    issues,
    question,
    answerY,
  };
}
export function exportIssue(e: Envelope) {
  const notes = [
    ...layout(e).issues,
    ...(!e.document.intentionalError ? warnings(e) : []),
  ];
  return notes[0] ?? "";
}
export function renderSvg(e: Envelope, showAnswers = false) {
  validate(e);
  const d = e.document,
    g = layout(e);
  const lines: string[] = [];
  if (d.gridVisible) {
    for (let c = 1; c < d.columns.length; c++)
      lines.push(
        `<line x1="${g.x[c]}" x2="${g.x[c]}" y1="${g.gridY}" y2="${g.gridY + g.gridHeight}"/>`,
      );
    for (let r = 1; r < d.rows.length; r++)
      lines.push(
        `<line x1="${g.gridX}" x2="${g.gridX + g.gridWidth}" y1="${g.y[r]}" y2="${g.y[r]}"/>`,
      );
  }
  const values = d.gridVisible
    ? g.cells
        .filter((a) => a.cell.value !== null && (!a.cell.hidden || showAnswers))
        .map((a) =>
          textSvg(
            a.cell.value!,
            a.x + a.w / 2,
            a.y + a.h / 2 + textSize(a.cell.value!) * 0.28,
          ),
        )
        .join("")
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}mm" height="${g.height}mm" viewBox="0 0 ${g.width} ${g.height}" role="img" aria-label="Algebra multiplication grid"><rect width="${g.width}" height="${g.height}" fill="#fff"/><g stroke="#000" stroke-width="${d.gridLineMm ?? 0.2}" stroke-linecap="butt">${lines.join("")}</g>${values}${g.question ? textSvg(g.question, 3, 6, "start") : ""}${d.answerVisible && d.answer ? textSvg(d.answer, 3, g.answerY, "start") : ""}<g stroke="#000" stroke-width="0.2">${Array.from(
    { length: d.answerLines },
    (_, i) => {
      const y = g.answerY + (d.answerVisible && d.answer ? 11 : 0) + i * 9 - 2;
      return `<line x1="3" x2="${g.width - 3}" y1="${y}" y2="${y}"/>`;
    },
  ).join("")}</g></svg>`;
}
