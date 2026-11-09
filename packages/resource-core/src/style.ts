/**
 * The MathsDock worksheet style: the website's Inter type, navy and soft-blue tiles on white
 * framed cards, adapted for print. docs/content/WORKSHEET-RENDERER.md gives the evidence behind
 * each layout rule. Sizes are millimetres (1 pt = 0.3528 mm).
 */
export type StyleId = "mathsdock";

export interface HouseStyle {
  id: StyleId;
  name: string;
  /** Body text: the website's ink. */
  ink: string;
  muted: string;
  /** Titles, headings and number tiles: the logo navy. */
  navy: string;
  /** Number and stage tiles, info cards: the website's soft blue. */
  tint: string;
  /** Table header rows. */
  tableHead: string;
  /** Card frames and table rules: dark enough to survive black-and-white printing. */
  rule: string;
  /** Saved answers, answers view only. */
  answer: string;
}

export const styles: Record<StyleId, HouseStyle> = {
  mathsdock: {
    id: "mathsdock",
    name: "MathsDock",
    ink: "#262720",
    muted: "#5d6470",
    navy: "#173c65",
    tint: "#dde7f3",
    tableHead: "#e4e9ef",
    rule: "#7f8a98",
    answer: "#b0125b",
  },
};

const pt = 0.3528;
export const SIZE = {
  page: { width: 420, height: 297 },
  margin: 8,
  gutter: 5,
  headerHeight: 20,
  title: 20 * pt,
  objective: 10 * pt,
  columnHeading: 12 * pt,
  columnHeadingBand: 7,
  cardTitle: 11 * pt,
  body: 11 * pt,
  lineHeight: 1.4,
  cardPad: 3,
  cardGap: 3.5,
  itemGap: 2,
  tile: 6.2,
  partIndent: 6,
  /** Answer rows leave room to write above the line. */
  answerRow: 9,
  tableRow: 5.8,
  tableAnswerRow: 8.5,
  tickBox: 4.2,
};
