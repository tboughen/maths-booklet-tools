import { RENDERER_VERSION, complete, forView, validate, value, type Envelope, type Method } from "./index";

function doc(method: Method, numbers: string[], extend = ""): Envelope {
  return validate({
    kind: "written-method",
    schemaVersion: 1,
    rendererVersion: RENDERER_VERSION,
    document: {
      method,
      numbers: numbers.map((t, i) => ({ id: `n${i + 1}`, value: value(t) })),
      working: [],
      answer: value(),
      remainder: null,
      extend: value(extend, extend ? "hidden" : "show"),
      marks: [],
      cellMm: 7,
      intentionalError: false,
    },
  });
}
/** The pupil copy keeps the numbers and empty space; the worked version is the completed method. */
const both = (e: Envelope, decimals = false) => (worked: boolean) => (worked ? forView(complete(e, true, decimals).envelope, "answer") : e);

/** Editable starting points with original numbers. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "column-add",
    title: "Column addition: 4758 + 2696",
    note: "Two four-digit numbers with carries into every column. The worked version shows the carries above the line.",
    make: both(doc("add", ["4758", "2696"])),
  },
  {
    id: "add-decimals",
    title: "Adding decimals: 37.25 + 8.6",
    note: "Decimals with different numbers of places, lined up on the point.",
    make: both(doc("add", ["37.25", "8.6"])),
  },
  {
    id: "column-subtract",
    title: "Column subtraction: 6003 − 2478",
    note: "Exchanging across zeros: the worked version crosses out digits and writes their new values above.",
    make: both(doc("subtract", ["6003", "2478"])),
  },
  {
    id: "long-multiplication",
    title: "Long multiplication: 546 × 43",
    note: "Two partial products and their sum, as for 54.6 × 4.3 before the point is placed. Working rows are pupil space.",
    make: (worked) => {
      const e = doc("multiply", ["546", "43"]);
      return worked ? forView(complete(e).envelope, "answer") : addBlankRows(e, 2);
    },
  },
  {
    id: "short-division",
    title: "Short division: 2172 ÷ 6",
    note: "The bus stop, with the remainder of each step carried small before the next digit.",
    make: both(doc("short-division", ["2172", "6"])),
  },
  {
    id: "division-remainder",
    title: "Short division with a remainder: 145 ÷ 6",
    note: "A division that does not come out: the answer is 24 r 1.",
    make: (worked) => {
      const e = doc("short-division", ["145", "6"]);
      e.document.remainder = value();
      return both(e)(worked);
    },
  },
  {
    id: "long-division-decimal",
    title: "Long division: 846 ÷ 15",
    note: "As for 8.46 ÷ 0.15 after multiplying both by 100. A zero is written after the point to keep dividing: 56.4.",
    make: both(doc("long-division", ["846", "15"]), true),
  },
];
function addBlankRows(e: Envelope, n: number): Envelope {
  const c = structuredClone(e);
  for (let i = 1; i <= n; i++) c.document.working.push({ id: `w${i}`, value: value(), place: 0, kind: "product" });
  return validate(c);
}

/** Plain shapes: each written method with its numbers set out and the working left as pupil space. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "column-add", title: "Column addition", note: "A three-digit number add a three-digit number, set out in columns: 365 + 278.", make: () => doc("add", ["365", "278"]) },
  { id: "add-decimals", title: "Column addition with decimals", note: "Decimals lined up on the point: 12.5 + 3.75.", make: () => doc("add", ["12.5", "3.75"]) },
  { id: "column-subtract", title: "Column subtraction with exchanging", note: "A subtraction that needs exchanging: 523 − 187.", make: () => doc("subtract", ["523", "187"]) },
  { id: "long-multiplication", title: "Long multiplication", note: "A three-digit number times a two-digit number, with rows for the working: 324 × 26.", make: () => addBlankRows(doc("multiply", ["324", "26"]), 2) },
  { id: "short-division", title: "Short division", note: "The bus stop: 936 ÷ 4.", make: () => doc("short-division", ["936", "4"]) },
  { id: "long-division", title: "Long division", note: "Long division by a two-digit number: 864 ÷ 16.", make: () => doc("long-division", ["864", "16"]) },
];
