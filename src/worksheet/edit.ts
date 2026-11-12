import { LAYOUTS, type Item, type Layout, type Resource } from "../../packages/resource-core/src/index";

type Leaf = Exclude<Item, { type: "part" }>;

export type Move = "up" | "down" | "previous" | "next";
const MAX_CARDS = 6;

/**
 * Moves one question card within its column or to the end/start of the neighbouring column
 * (columns run in reading order across both sides). Returns null when the move is not possible.
 * Nothing else changes; question numbers follow the new order.
 */
export function moveCard(r: Resource, side: number, column: number, card: number, how: Move): Resource | null {
  const next = structuredClone(r);
  const columns = next.document.sides.flatMap((s) => s.columns);
  const from = next.document.sides.slice(0, side).reduce((k, s) => k + s.columns.length, 0) + column;
  const cards = columns[from]?.cards;
  if (!cards?.[card]) return null;
  if (how === "up" || how === "down") {
    const to = how === "up" ? card - 1 : card + 1;
    if (to < 0 || to >= cards.length) return null;
    [cards[card], cards[to]] = [cards[to], cards[card]];
    return next;
  }
  const target = columns[how === "previous" ? from - 1 : from + 1];
  if (!target || target.cards.length >= MAX_CARDS) return null;
  const [moved] = cards.splice(card, 1);
  if (how === "previous") target.cards.push(moved);
  else target.cards.unshift(moved);
  return next;
}

export const LAYOUT_NAMES: Record<Layout, string> = {
  three: "Three columns",
  two: "Two wide columns",
  "wide-narrow": "Wide then narrow",
  "narrow-wide": "Narrow then wide",
  one: "One full-width column",
};

/**
 * Changes one side's layout without losing a question. Fewer columns: the cards of each removed
 * column join the end of the column before it, and the first of them starts a stage band named by
 * the removed heading, so the stage letters read as before. More columns: the last stage band of
 * the side becomes a new column again (its label the heading), or the new column starts empty.
 * So three → one → three gives back the same sheet. Returns an error when a column would hold
 * more than six questions.
 */
export function setLayout(r: Resource, side: number, layout: Layout): Resource | string {
  const next = structuredClone(r);
  const s = next.document.sides[side];
  const want = LAYOUTS[layout].length;
  s.layout = layout;
  while (s.columns.length > want) {
    const gone = s.columns.pop()!;
    const into = s.columns[s.columns.length - 1];
    const cards = gone.cards.map((c, i) => (i === 0 ? { ...c, stage: c.stage || gone.heading || "Next stage" } : c));
    // A column with no cards keeps its heading only through undo; there is nothing to move.
    into.cards.push(...cards);
    if (into.cards.length > MAX_CARDS) return `${LAYOUT_NAMES[layout]} would put ${into.cards.length} questions in one column; the most is ${MAX_CARDS}. Move some questions to the other side first.`;
  }
  while (s.columns.length < want) {
    // The latest stage band (not a column's first card) splits off into the new column.
    let at: { c: number; k: number } | null = null;
    s.columns.forEach((col, c) => col.cards.forEach((card, k) => void (k > 0 && card.stage ? (at = { c, k }) : null)));
    const found = at as { c: number; k: number } | null;
    if (!found) {
      s.columns.push({ heading: "", cards: [] });
      continue;
    }
    const from = s.columns[found.c];
    const moved = from.cards.splice(found.k);
    const { stage, ...first } = moved[0];
    s.columns.splice(found.c + 1, 0, {
      heading: stage ?? "",
      cards: [first, ...moved.slice(1)],
    });
  }
  return next;
}

/** One mark per answer space on a side: a starting value for the score box, which the teacher can change. */
export function answerSpaces(side: Resource["document"]["sides"][number]): number {
  let n = 0;
  const leaf = (i: Leaf) => {
    if (i.type === "answerLine" || i.type === "choice") n++;
    else if (i.type === "table") n += i.rows.flat().filter((c) => c.state !== "supplied").length;
  };
  for (const col of side.columns)
    for (const card of col.cards)
      for (const item of card.items) {
        if (item.type === "part") item.items.forEach(leaf);
        else leaf(item);
      }
  return n;
}

type Card = Resource["document"]["sides"][number]["columns"][number]["cards"][number];
/** Card padding each side, as the renderer draws it. */
const CARD_PAD = 3;
/**
 * Adds blank squared paper to a card, as wide as the card's content in whole centimetres and
 * 60 mm tall, before any answer lines at the end of the card. Changes the card in place.
 */
export function addPaper(card: Card, columnWidth: number): void {
  const widthMm = Math.max(20, Math.floor((columnWidth - CARD_PAD * 2) / 10) * 10);
  let at = card.items.length;
  while (at > 0 && card.items[at - 1].type === "answerLine") at--;
  card.items.splice(at, 0, {
    type: "paper",
    style: "squared",
    widthMm,
    heightMm: 60,
  });
}
