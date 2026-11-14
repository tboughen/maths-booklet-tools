// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describe as describeTriangle, renderSvg } from "./render";
import { validate } from "./model";

const fixture = () => validate(JSON.parse(readFileSync(join(__dirname, "../../envelope-core/fixtures/corpus/triangle/file-fixtures-triangle-area-v2.json"), "utf8")));

describe("triangle accessible label (U36)", () => {
  it("labels the artwork as an image with what it prints", () => {
    const svg = renderSvg(fixture());
    expect(svg).toMatch(/^<svg[^>]* role="img" aria-label="Triangle with vertices A, B and C; sides 9 cm and 8 cm; 1 answer line">/);
    expect(svg).toContain("<title>Triangle with vertices A, B and C; sides 9 cm and 8 cm; 1 answer line</title>");
  });
  it("never names a saved answer on the pupil copy", () => {
    const e = fixture();
    expect(describeTriangle(e)).not.toContain("36");
    expect(describeTriangle(e, true)).toContain("36");
  });
});
