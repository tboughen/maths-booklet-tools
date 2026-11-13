import { describe, expect, it } from "vitest";
import { renderResource, stageLetters, validate, type Resource } from "../../packages/resource-core/src/index";
import { treeDiagrams } from "../../packages/resource-core/src/fixtures";
import { layoutSample } from "../../packages/resource-core/src/layout-sample";
import { answerSpaces, moveCard, setLayout } from "./edit";

const ok = (r: Resource | string): Resource => {
  if (typeof r === "string") throw Error(r);
  return validate(r);
};
const titles = (r: Resource, s: number) => r.document.sides[s].columns.map((c) => c.cards.map((k) => k.title));

describe("setLayout", () => {
  it("merges removed columns into stage bands and keeps every question in reading order", () => {
    const before = treeDiagrams;
    const two = ok(setLayout(before, 0, "two"));
    expect(two.document.sides[0].layout).toBe("two");
    expect(two.document.sides[0].columns).toHaveLength(2);
    expect(titles(two, 0).flat()).toEqual(titles(before, 0).flat());
    const col3 = before.document.sides[0].columns[2];
    const moved = two.document.sides[0].columns[1].cards[before.document.sides[0].columns[1].cards.length];
    expect(moved.stage).toBe(col3.heading);
    // Stage letters read as before: A, B, then C as a band.
    expect(stageLetters(two).columns[0]).toEqual(["A", "B"]);
    expect(stageLetters(two).cards[0][1].filter(Boolean)).toEqual(["C"]);
    expect(stageLetters(two).columns[1]).toEqual(stageLetters(before).columns[1]);
  });

  it("three → one → three gives back the same side", () => {
    const one = ok(setLayout(treeDiagrams, 1, "one"));
    expect(one.document.sides[1].columns).toHaveLength(1);
    const back = ok(setLayout(one, 1, "three"));
    expect(back.document.sides[1]).toEqual({
      ...treeDiagrams.document.sides[1],
      layout: "three",
    });
  });

  it("adds an empty column when there is no stage band to split off", () => {
    const r = ok(setLayout(treeDiagrams, 0, "two"));
    const plain = structuredClone(r);
    plain.document.sides[0].columns[1].cards.forEach((c) => delete c.stage);
    const three = ok(setLayout(plain, 0, "three"));
    expect(three.document.sides[0].columns[2]).toEqual({
      heading: "",
      cards: [],
    });
    expect(renderResource(three).pages).toHaveLength(2);
  });

  it("refuses a change that would put more than six questions in a column", () => {
    const r = structuredClone(treeDiagrams);
    const cols = r.document.sides[0].columns;
    while (cols[0].cards.length + cols[1].cards.length + cols[2].cards.length < 7) cols[2].cards.push(structuredClone(cols[2].cards[0]));
    const result = setLayout(r, 0, "one");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/the most is 6/);
  });

  it("does not change the original sheet", () => {
    const copy = structuredClone(treeDiagrams);
    setLayout(treeDiagrams, 0, "one");
    expect(treeDiagrams).toEqual(copy);
  });
});

describe("answerSpaces", () => {
  it("counts answer lines, choices and blank or hidden cells", () => {
    const side = structuredClone(treeDiagrams.document.sides[0]);
    side.columns = [
      {
        heading: "A",
        cards: [
          {
            title: "Q",
            items: [
              {
                type: "answerLine",
                prefix: "",
                suffix: "",
                answer: "",
                inline: false,
              },
              {
                type: "choice",
                mode: "circle",
                options: ["a", "b"],
                answer: null,
              },
              {
                type: "table",
                columns: ["x", "y"],
                rows: [
                  [
                    { text: "1", state: "supplied" },
                    { text: "", state: "blank" },
                  ],
                  [
                    { text: "2", state: "supplied" },
                    { text: "4", state: "hidden" },
                  ],
                ],
              },
              {
                type: "part",
                text: "b",
                items: [
                  {
                    type: "answerLine",
                    prefix: "",
                    suffix: "",
                    answer: "",
                    inline: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    expect(answerSpaces(side)).toBe(5);
  });
});

// Kept beside the website code: the service build type-checks packages/resource-core alone, so
// tests there must not import from src/.
describe("worksheet editor moves", () => {
  it("moves cards across columns on sides with fewer columns", () => {
    const moved = moveCard(layoutSample, 1, 0, 0, "next");
    expect(moved?.document.sides[1].columns[1].cards[0].title).toBe("Draw y = 3x − 2");
    const back = moveCard(layoutSample, 1, 0, 0, "previous");
    expect(back?.document.sides[0].columns[2].cards.at(-1)?.title).toBe("Draw y = 3x − 2");
    expect(moveCard(layoutSample, 1, 1, 0, "next")).toBeNull();
  });
});
