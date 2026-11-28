import type { Booklet, Card, Lesson, Section } from "../../packages/resource-core/src/index";

/** Pure, structural edits for the booklet editor. Each returns a new booklet; nothing is calculated. */

export function moveIn<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const withLessons = (b: Booklet, lessons: Lesson[]): Booklet => ({ ...b, document: { ...b.document, lessons } });
const mapLesson = (b: Booklet, li: number, f: (l: Lesson) => Lesson) => withLessons(b, b.document.lessons.map((l, i) => (i === li ? f(l) : l)));
const mapSection = (b: Booklet, li: number, si: number, f: (s: Section) => Section) =>
  mapLesson(b, li, (l) => ({ ...l, sections: l.sections.map((s, i) => (i === si ? f(s) : s)) }));

export const moveLesson = (b: Booklet, li: number, to: number) => withLessons(b, moveIn(b.document.lessons, li, to));
export const removeLesson = (b: Booklet, li: number) => (b.document.lessons.length > 1 ? withLessons(b, b.document.lessons.filter((_, i) => i !== li)) : b);
export const duplicateLesson = (b: Booklet, li: number) =>
  b.document.lessons.length < 16 ? withLessons(b, [...b.document.lessons.slice(0, li + 1), structuredClone(b.document.lessons[li]), ...b.document.lessons.slice(li + 1)]) : b;
export const replaceLesson = (b: Booklet, li: number, lesson: Lesson) => mapLesson(b, li, () => lesson);

export const moveSection = (b: Booklet, li: number, si: number, to: number) => mapLesson(b, li, (l) => ({ ...l, sections: moveIn(l.sections, si, to) }));
export const removeSection = (b: Booklet, li: number, si: number) => mapLesson(b, li, (l) => (l.sections.length > 1 ? { ...l, sections: l.sections.filter((_, i) => i !== si) } : l));

export const moveCardIn = (b: Booklet, li: number, si: number, ci: number, to: number) => mapSection(b, li, si, (s) => ({ ...s, cards: moveIn(s.cards, ci, to) }));
export const removeCard = (b: Booklet, li: number, si: number, ci: number) => mapSection(b, li, si, (s) => (s.cards.length > 1 ? { ...s, cards: s.cards.filter((_, i) => i !== ci) } : s));
export const duplicateCard = (b: Booklet, li: number, si: number, ci: number) =>
  mapSection(b, li, si, (s) => (s.cards.length < 16 ? { ...s, cards: [...s.cards.slice(0, ci + 1), structuredClone(s.cards[ci]), ...s.cards.slice(ci + 1)] } : s));
export const addCard = (b: Booklet, li: number, si: number, card: Card) => mapSection(b, li, si, (s) => (s.cards.length < 16 ? { ...s, cards: [...s.cards, card] } : s));

/** A card moved to the neighbouring section of the same lesson (keeps it in reading order). */
export function moveCardAcross(b: Booklet, li: number, si: number, ci: number, dir: -1 | 1): Booklet {
  const l = b.document.lessons[li];
  const target = si + dir;
  if (target < 0 || target >= l.sections.length || l.sections[si].cards.length < 2 || l.sections[target].cards.length >= 16) return b;
  const card = l.sections[si].cards[ci];
  const sections = l.sections.map((s, i) => {
    if (i === si) return { ...s, cards: s.cards.filter((_, k) => k !== ci) };
    if (i === target) return { ...s, cards: dir === 1 ? [card, ...s.cards] : [...s.cards, card] };
    return s;
  });
  return mapLesson(b, li, (x) => ({ ...x, sections }));
}

/** A new question card: words to replace and working space (stage 5, full editing on the page). */
export const newCard = (): Card => ({ title: "New question", items: [{ type: "text", text: "Write the question here." }, { type: "space", kind: "working", heightMm: 20 }] }) as Card;

/** A card added straight after another, so it lands where the teacher is working. */
export const insertCardAfter = (b: Booklet, li: number, si: number, ci: number, card: Card) =>
  mapSection(b, li, si, (s) => (s.cards.length < 16 ? { ...s, cards: [...s.cards.slice(0, ci + 1), card, ...s.cards.slice(ci + 1)] } : s));

/** A new section of the given kind after another, holding one new card (a section needs at least one). */
export const addSectionAfter = (b: Booklet, li: number, si: number, kind: Section["kind"]) =>
  mapLesson(b, li, (l) =>
    l.sections.length < 20
      ? { ...l, sections: [...l.sections.slice(0, si + 1), { kind, title: "", instruction: "", startBanner: "", endBanner: "", columns: 1, numbering: "continue", cards: [newCard()] } as Section, ...l.sections.slice(si + 1)] }
      : l,
  );

type Items = Card["items"];
const mapCard = (b: Booklet, li: number, si: number, ci: number, f: (c: Card) => Card) => mapSection(b, li, si, (s) => ({ ...s, cards: s.cards.map((c, i) => (i === ci ? f(c) : c)) }));
/** An item added at the end of a card (or after one item), for the card's own Add menu. */
export const addItem = (b: Booklet, li: number, si: number, ci: number, item: Items[number], after?: number) =>
  mapCard(b, li, si, ci, (c) => {
    const at = after === undefined ? c.items.length : after + 1;
    return { ...c, items: [...c.items.slice(0, at), item, ...c.items.slice(at)] as Items };
  });
/** Items keep at least one in a card. An item that sat beside the removed one keeps its place on its own. */
export const removeItem = (b: Booklet, li: number, si: number, ci: number, i: number) =>
  mapCard(b, li, si, ci, (c) => {
    if (c.items.length < 2) return c;
    const items = c.items.filter((_, k) => k !== i).map((it, k) => (k === 0 && "beside" in it && it.beside ? withoutBeside(it) : it));
    return { ...c, items: items as Items };
  });
export const moveItem = (b: Booklet, li: number, si: number, ci: number, i: number, to: number) =>
  mapCard(b, li, si, ci, (c) => {
    const items = moveIn(c.items, i, to);
    if (items === c.items) return c;
    // The first item has nothing to sit beside.
    return { ...c, items: items.map((it, k) => (k === 0 && "beside" in it && it.beside ? withoutBeside(it) : it)) as Items };
  });
function withoutBeside<T extends object>(it: T): T {
  const copy = { ...it } as T & { beside?: true };
  delete copy.beside;
  return copy;
}
