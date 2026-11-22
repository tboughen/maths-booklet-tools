import { describe, expect, it } from "vitest";
import { growLastSpace } from "./render";
import type { Card } from "./schema";

// Tim, 22 Nov 2026 (N18): a card's spare height goes into its last working space, so the answer line
// and "Check yourself" sit at the bottom of the card.
describe("spare card height goes to the last working space", () => {
  const challenge = {
    title: "Challenge B",
    items: [
      { type: "part", text: "Work out the density.", items: [{ type: "space", kind: "working", heightMm: 52 }, { type: "answerLine", prefix: "", suffix: "g/cm³", answer: "1.08", inline: true }] },
      { type: "text", text: "**Check yourself.**" },
    ],
  } as unknown as Card;

  it("grows the last space inside a part and leaves everything after it in order", () => {
    const grown = growLastSpace(challenge, 30)!;
    const part = grown.items[0] as { items: { type: string; heightMm?: number }[] };
    expect(part.items[0].heightMm).toBe(82);
    expect(part.items[1].type).toBe("answerLine");
    expect(grown.items[1]).toEqual(challenge.items[1]);
    expect((challenge.items[0] as { items: { heightMm?: number }[] }).items[0].heightMm).toBe(52);
  });

  it("does nothing without spare height or a working space", () => {
    expect(growLastSpace(challenge, 0)).toBeNull();
    expect(growLastSpace({ title: "", items: [{ type: "text", text: "Key facts" }] } as unknown as Card, 20)).toBeNull();
  });
});
