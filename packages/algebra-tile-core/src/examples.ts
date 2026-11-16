import { collect, create, forView, setItem, validate, writeExpression, type Envelope, type TilesDocument } from "./index";

const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
function tiles(expression: string, letters: TilesDocument["letters"], change: Partial<TilesDocument> = {}): Envelope {
  const e = create(expression, letters);
  return validate({ ...e, document: { ...e.document, ...change } });
}
/** The expression printed, the simplified answer a hidden answer: "Simplify". */
const simplify = (e: Envelope) => collect(setItem(e, "expression", { text: writeExpression(e).envelope.document.expression!.text }), true).envelope;

/** Editable starting points with original expressions. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "collect-two-letters",
    title: "Collect like terms: 3a + 2b + a − b",
    note: "Strips for a and b, as written. The expression is printed; the simplified answer 4a + b is a hidden answer.",
    make: (worked) => finish(simplify(tiles("3a + 2b + a − b", { long: "a", short: "b" })), worked),
  },
  {
    id: "zero-pairs",
    title: "Zero pairs: 2x + 3 − x − 1",
    note: "The same tiles grouped, positive tiles above negative ones. The zero-pair rings and the answer x + 2 are hidden answers.",
    make: (worked) =>
      finish(simplify(tiles("2x + 3 − x − 1", { long: "x", short: "y" }, { arrangement: "grouped", zeroPairs: "hidden" })), worked),
  },
  {
    id: "squares-and-products",
    title: "Squares and products: 2a² + ab − a² + 3ab",
    note: "a² and ab tiles have different shapes, so they are not like terms. The answer a² + 4ab is a hidden answer.",
    make: (worked) => finish(simplify(tiles("2a² + ab − a² + 3ab", { long: "a", short: "b" })), worked),
  },
  {
    id: "a2b-ab2",
    title: "a²b and ab²: 2a²b + ab² − a²b + 2ab²",
    note: "a²b is an a by a by b block and ab² an a by b by b block, so they never collect together. The answer a²b + 3ab² is hidden.",
    make: (worked) => finish(simplify(tiles("2a²b + ab² − a²b + 2ab²", { long: "a", short: "b" })), worked),
  },
  {
    id: "draw-the-tiles",
    title: "Draw the tiles for 2x + 3",
    note: "The tiles are a hidden answer: pupils see the expression and a dashed frame to draw them in.",
    make: (worked) => {
      const e = tiles("2x + 3", { long: "x", short: "y" }, { frame: true });
      e.document.terms.forEach((t) => (t.show = "hidden"));
      return finish(setItem(validate(e), "expression", { text: "2x + 3" }), worked);
    },
  },
];
