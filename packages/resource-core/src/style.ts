/**
 * House styles. Both use the same physical sizes, fonts and spacing, so a document lays out
 * identically in either; only the decoration differs. Tim picks one at checkpoint 1.
 * Sizes are millimetres (1 pt = 0.3528 mm).
 */
export type StyleId = "cards" | "lines";

export interface HouseStyle {
  id: StyleId;
  name: string;
  ink: string;
  muted: string;
  accent: string;
  /** Pale tint for info cards and table headers; must survive greyscale printing. */
  tint: string;
  rule: string;
  answer: string;
}

export const styles: Record<StyleId, HouseStyle> = {
  cards: {
    id: "cards",
    name: "Cards",
    ink: "#1a1a1a",
    muted: "#4a5560",
    accent: "#13697a",
    tint: "#e8f2f4",
    rule: "#9fbfc6",
    answer: "#b0125b",
  },
  lines: {
    id: "lines",
    name: "Lines",
    ink: "#1a1a1a",
    muted: "#4a5560",
    accent: "#1d4f7c",
    tint: "#eef1f4",
    rule: "#b9c2cb",
    answer: "#b0125b",
  },
};

const pt = 0.3528;
export const SIZE = {
  page: { width: 420, height: 297 },
  margin: 8,
  gutter: 5,
  headerHeight: 22,
  title: 20 * pt,
  objective: 9.5 * pt,
  columnHeading: 11 * pt,
  columnHeadingBand: 8,
  cardTitle: 10.5 * pt,
  body: 9 * pt,
  small: 8 * pt,
  lineHeight: 1.35,
  cardPad: 2.8,
  cardGap: 3.5,
  itemGap: 2,
  badge: 6,
  partIndent: 6,
  /** Answer rows leave room to write above the line. */
  answerRow: 9,
  tableRow: 5.5,
  tableAnswerRow: 8,
  tickBox: 4,
};
