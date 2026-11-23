import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as galleries from "./galleryCatalogue";
import { barLessonGallery } from "./barLessonGallery";

/**
 * Every gallery card shows a picture of the example, so teachers see the thing they want rather than
 * a name. A new example needs its preview: run `node scripts/generate-example-previews.mjs`.
 */
const ids = [
  ...Object.values(galleries).flatMap((value) => (Array.isArray(value) ? (value as { id: string }[]).map((card) => card.id) : [])),
  ...barLessonGallery.map((card) => card.id),
];

describe("example gallery previews", () => {
  it("covers every gallery", () => {
    expect(ids.length).toBeGreaterThan(200);
  });
  it("has a preview picture for every example", () => {
    const missing = [...new Set(ids)].filter((id) => !existsSync(resolve(__dirname, "../assets/example-previews", `${id}.svg`)));
    expect(missing).toEqual([]);
  });
});
