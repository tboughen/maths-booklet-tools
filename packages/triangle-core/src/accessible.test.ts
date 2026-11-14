// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accessibleLabel as describeTriangle, renderSvg } from "./render";
import { validate } from "./model";

const fixture = () => validate(JSON.parse(readFileSync(join(__dirname, "../../envelope-core/fixtures/corpus/triangle/file-fixtures-triangle-area-v2.json"), "utf8")));

describe("triangle accessible label (U36)", () => {
  it("labels the artwork as an image with what it prints", () => {
    const svg = renderSvg(fixture());
    expect(svg).toMatch(/^<svg[^>]* role="img" aria-label="Triangle with vertices A, B and C; sides 9 cm and 8 cm; Area = \(answer line\) cm²; 1 answer line">/);
    expect(svg).toContain("<title>Triangle with vertices A, B and C; sides 9 cm and 8 cm; Area = (answer line) cm²; 1 answer line</title>");
  });
  it("never names a saved answer on the pupil copy", () => {
    const e = fixture();
    expect(describeTriangle(e)).not.toContain("36");
    expect(describeTriangle(e, true)).toContain("36");
  });
  it("counts a split triangle once and never prints raw markup", () => {
    const load = (name: string) => validate(JSON.parse(readFileSync(join(__dirname, `../../envelope-core/fixtures/corpus/triangle/${name}.json`), "utf8")));
    expect(describeTriangle(load("example-bisector"))).toMatch(/^Triangle with vertices/);
    expect(describeTriangle(load("file-fixtures-triangle-split"))).toMatch(/^Triangle with vertices/);
    for (const name of ["example-bisector", "example-fractions", "example-right-trig", "file-fixtures-triangle-scaffold"])
      expect(describeTriangle(load(name))).not.toMatch(/\^|____|\n/);
  });
});
