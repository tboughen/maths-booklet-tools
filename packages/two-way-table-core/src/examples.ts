import { forView, validate, type Envelope } from "./index";

/**
 * Builds a table from rows of cell text. "?24" is a hidden answer: the pupil copy leaves the box
 * empty and the worked version shows 24. "" is a blank with no saved answer. The last row and the
 * last column are the totals.
 */
function table(corner: string, columns: string[], rows: [string, ...string[]][], totals: string[]): Envelope {
  const cell = (t: string) => (t.startsWith("?") ? { text: t.slice(1), show: "hidden" as const } : { text: t, show: "show" as const });
  return validate({
    kind: "two-way-table",
    schemaVersion: 1,
    rendererVersion: "two-way-table-1",
    document: {
      corner,
      columns: columns.map((heading, i) => ({ id: `c${i + 1}`, heading })),
      rows: rows.map(([heading, ...cells], i) => ({ id: `r${i + 1}`, heading, cells: cells.map(cell) })),
      totalColumn: true,
      totalRow: totals.map(cell),
      cellMm: 22,
      intentionalError: false,
    },
  });
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);

/** Editable starting points with original numbers. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "complete",
    title: "Complete the table: travel to school",
    note: "Pupils complete five empty cells from the totals. Choose the worked version to see them.",
    make: (worked) =>
      finish(
        table("", ["Walk", "Bus", "Car"], [["Year 7", "?18", "25", "?9", "52"], ["Year 8", "21", "?17", "12", "?50"]], ["39", "42", "?21", "?102"]),
        worked,
      ),
  },
  {
    id: "totals",
    title: "Totals only: lunch choices",
    note: "Every category is given; pupils find the totals.",
    make: (worked) =>
      finish(
        table("", ["Hot meal", "Sandwich"], [["Boys", "34", "26", "?60"], ["Girls", "29", "31", "?60"]], ["?63", "?57", "?120"]),
        worked,
      ),
  },
  {
    id: "probability",
    title: "Probabilities as fractions",
    note: "A probability table with stacked fractions; the missing fractions are hidden answers.",
    make: (worked) =>
      finish(
        table("", ["Red", "Blue"], [["Spinner A", "3/20", "?7/20", "1/2"], ["Spinner B", "?1/5", "3/10", "?1/2"]], ["7/20", "?13/20", "1"]),
        worked,
      ),
  },
];
