import { describe, expect, it } from "vitest";
import * as galleries from "./galleryCatalogue";

/** U23: example captions use a proper minus sign (−), never a hyphen, for negatives and subtraction. */
const cards = Object.entries(galleries).flatMap(([name, value]) =>
  Array.isArray(value)
    ? (value as { id: string; title: string; description: string }[]).map((card) => ({ gallery: name, ...card }))
    : [],
);
const hyphenMinus = /(^|[\s(=,:])-\s?[\d.(a-zA-Z]|[\w²³)]\s-\s[\w(]/;

describe("example gallery captions (U23)", () => {
  it("covers every gallery", () => {
    expect(cards.length).toBeGreaterThan(40);
  });
  it("never uses a hyphen as a minus sign", () => {
    const bad = cards.flatMap((card) =>
      [card.title, card.description].filter((text) => hyphenMinus.test(text)).map((text) => `${card.id}: ${text}`),
    );
    expect(bad).toEqual([]);
  });
});
