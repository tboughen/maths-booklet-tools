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
  b.document.lessons.length < 12 ? withLessons(b, [...b.document.lessons.slice(0, li + 1), structuredClone(b.document.lessons[li]), ...b.document.lessons.slice(li + 1)]) : b;
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
