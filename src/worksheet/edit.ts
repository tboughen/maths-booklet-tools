import type { Resource } from "../../packages/resource-core/src/index";

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
