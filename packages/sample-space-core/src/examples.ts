import { create, fillCells, forView, setCell, validate, type Envelope } from "./index";

const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
/** Hides every filled cell except the ones given, which stay printed as a start for pupils. */
function keep(e: Envelope, shown: [number, number][]): Envelope {
  const n = structuredClone(e);
  n.document.rows.forEach((r, i) => r.cells.forEach((c, j) => (c.show = shown.some(([a, b]) => a === i && b === j) ? "show" : "hidden")));
  return validate(n);
}

/** Editable starting points. Hidden answers stay blank for pupils; the worked version shows them. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "dice-sum",
    title: "Two dice: complete the totals",
    note: "Two fair dice with a few totals given. Pupils complete the rest; the worked version shows every total.",
    make: (worked) => {
      const all = fillCells(create(undefined, undefined, "+", { row: "Dice A", column: "Dice B" }), "sum").envelope;
      return finish(keep(all, [[0, 0], [0, 1], [1, 0], [2, 3]]), worked);
    },
  },
  {
    id: "spinner-product",
    title: "Spinner and dice: products",
    note: "A four-sided spinner and a dice, multiplied. Every product is a hidden answer.",
    make: (worked) => finish(fillCells(create(["1", "2", "3", "4"], ["1", "2", "3", "4", "5", "6"], "", { row: "Spinner", column: "Dice" }), "product", true).envelope, worked),
  },
  {
    id: "coin-dice",
    title: "Coin and dice: list the outcomes",
    note: "Every outcome of a coin and a dice as a pair. Pupils list them; the worked version shows them all.",
    make: (worked) => {
      const e = create(["H", "T"], ["1", "2", "3", "4", "5", "6"], "", { row: "Coin", column: "Dice" });
      e.document.cellMm = 17;
      return finish(fillCells(e, "pair", true).envelope, worked);
    },
  },
  {
    id: "circle-outcomes",
    title: "Circle the outcomes",
    note: "Differences between two dice, all printed. The worked version circles the differences of 2.",
    make: (worked) => {
      let e = fillCells(create(undefined, undefined, "−", { row: "Dice A", column: "Dice B" }), "difference").envelope;
      if (worked)
        for (const r of e.document.rows)
          for (const [j, c] of r.cells.entries()) if (c.text === "2") e = setCell(e, r.id, e.document.columns[j].id, { ring: true });
      return e;
    },
  },
];
