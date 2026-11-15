import { RENDERER_VERSION, completeTree, forView, validate, value, type Envelope, type Tree, type TreeNode } from "./index";

/** A nested tree: [number, left, right]. "?12" is a hidden answer, "(5)" is circled. */
type Nested = string | [string, Nested, Nested];
function tree(treeId: string, shape: Nested, product: string | null): Tree {
  const nodes: TreeNode[] = [];
  const add = (n: Nested, parent: string | null) => {
    const raw = typeof n === "string" ? n : n[0],
      nodeId = `n${nodes.length + 1}`;
    const circled = /^\??\(.*\)$/.test(raw);
    const bare = raw.replace(/[()]/g, "");
    const hidden = bare.startsWith("?");
    nodes.push({ id: nodeId, parent, value: value(hidden ? bare.slice(1) : bare, hidden ? "hidden" : "show"), ...(circled ? { circled: true as const } : {}) });
    if (typeof n !== "string") {
      add(n[1], nodeId);
      add(n[2], nodeId);
    }
  };
  add(shape, null);
  const answer = product === null ? null : product.startsWith("?") ? value(product.slice(1), "hidden") : value(product);
  return { id: treeId, nodes, product: answer };
}
function doc(trees: Tree[], intentionalError = false): Envelope {
  return validate({ kind: "factor-tree", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { trees, blankStyle: "dots", levelMm: 13, intentionalError } });
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);

/** Editable starting points with original numbers. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "complete-360",
    title: "Complete the factor tree: 360",
    note: "The first split is given. Pupils finish the tree, circle the primes and write 360 in index form.",
    make: (worked) =>
      finish(doc([tree("t1", ["360", ["36", ["?6", "?(2)", "?(3)"], ["?6", "?(2)", "?(3)"]], ["10", "(2)", "(5)"]], "?2^3 × 3^2 × 5")]), worked),
  },
  {
    id: "two-ways-84",
    title: "Two different trees for 84",
    note: "84 split two ways gives the same primes. Every prime and both answers are hidden.",
    make: (worked) =>
      finish(
        doc([
          tree("t1", ["84", "?(2)", ["?42", "?(2)", ["?21", "?(3)", "?(7)"]]], "?2^2 × 3 × 7"),
          tree("t2", ["84", ["?4", "?(2)", "?(2)"], ["?21", "?(3)", "?(7)"]], "?2^2 × 3 × 7"),
        ]),
        worked,
      ),
  },
  {
    id: "product-of-primes",
    title: "Write 600 as a product of primes",
    note: "An empty first split and answer line for pupils. The worked version completes the tree.",
    make: (worked) => {
      const blank = doc([tree("t1", ["600", "", ""], "")]);
      const done = completeTree(doc([tree("t1", ["600", "?6", "?100"], "")]), "t1", true).envelope;
      return worked ? forView(done, "answer") : blank;
    },
  },
  {
    id: "spot-the-mistake",
    title: "Spot the mistake: 72",
    note: "A pupil's factor tree with a deliberate error: 4 is circled as if it were prime. No warning shows.",
    make: () => doc([tree("t1", ["72", ["8", "(2)", "(4)"], ["9", "(3)", "(3)"]], "2 × 4 × 3^2")], true),
  },
];
