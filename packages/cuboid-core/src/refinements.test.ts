import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import fixtures from "./fixtures/v1.json";
import {
  create,
  upgrade,
  validate,
  parseFile,
  canonical,
  renderSvg,
  layout,
  appearance,
  faceNames,
  faceArea,
  faceAreaLabel,
  setUnit,
  encode,
  decode,
} from "./index";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const fresh = () => upgrade(create());
describe("Cuboid refinements", () => {
  it("retains canonical bytes and artwork of all 20 production resources", () => {
    for (const fixture of fixtures) {
      const e = validate(fixture.envelope);
      expect(sha(canonical(e))).toBe(fixture.canonicalSha256);
      expect(sha(renderSvg(e))).toBe(fixture.svgSha256);
    }
  });
  it("rejects silently mixing old and new version fields", () => {
    const e = fresh();
    expect(() => validate({ ...e, rendererVersion: "cuboids-1" })).toThrow();
    expect(() =>
      validate({ ...e, schemaVersion: 1, rendererVersion: "cuboids-1" }),
    ).toThrow();
  });
  it("gives every pair of opposite faces the correct exact area", () => {
    const s = fresh().document.shapes[0];
    expect(faceNames.map((f) => faceArea(s, f).value)).toEqual([
      "12",
      "12",
      "8",
      "8",
      "6",
      "6",
    ]);
    expect(faceArea(setUnit(s, "mm"), "bottom").value).toBe("1200");
    expect(faceArea(setUnit(s, "m"), "bottom").value).toBe("3/2500");
    s.dimensions.width = "3/2";
    s.dimensions.depth = "4/3";
    expect(faceArea(s, "bottom").value).toBe("2");
  });
  it("uses neutral tones, with no implicitly calculated answers", () => {
    const e = fresh(),
      s = e.document.shapes[0];
    s.appearance = { ...appearance(s), mode: "faces" };
    const svg = renderSvg(e);
    for (const tone of ["#f2f2f2", "#dedede", "#bfbfbf"])
      expect(svg).toContain(`fill="${tone}"`);
    expect(svg).not.toContain("Base area");
    expect(svg).not.toContain("Volume =");
  });
  it("draws only the selected face and makes hidden boundaries visible", () => {
    for (const face of faceNames) {
      const e = fresh(),
        s = e.document.shapes[0];
      s.appearance = { ...appearance(s), mode: "one", face };
      const svg = renderSvg(e);
      expect(svg.match(/<polygon /g)).toHaveLength(1);
      expect(svg).toContain(`data-face="${face}"`);
      expect(svg.match(/stroke-dasharray=/g)).toHaveLength(3);
      expect(faceAreaLabel(s)).toBe("");
    }
  });
  it("preserves area blanks and custom text and uses dimensions rather than schematic size", () => {
    const e = fresh(),
      s = e.document.shapes[0];
    s.schematic = true;
    s.proportions = { width: "20", depth: "20", height: "20" };
    s.labels.height.mode = "blank";
    s.appearance = {
      ...appearance(s),
      mode: "one",
      area: { mode: "value", heading: "Base area", expression: true, text: "" },
    };
    expect(faceAreaLabel(s)).toBe("Base area = 4 × 3 = 12 cm²");
    s.appearance.area.mode = "blank";
    expect(renderSvg(e)).not.toContain("= 12");
    s.appearance.area.mode = "text";
    s.appearance.area.text = "<A> cm²";
    expect(renderSvg(e)).toContain("&lt;A&gt;");
    expect(renderSvg(e)).not.toContain("<A>");
    const back = decode(encode(parseFile(canonical(e))));
    expect(back.document.shapes[0].labels.height.mode).toBe("blank");
    expect(canonical(back)).toBe(canonical(e));
  });
  it("puts the height arrow outside the rear vertical, mirrored correctly", () => {
    for (const direction of ["right", "left"] as const) {
      const e = fresh(),
        s = e.document.shapes[0];
      s.arrows = true;
      s.direction = direction;
      s.dimensions = { width: "8", depth: "2", height: "6" };
      const m = layout(e),
        doc = new DOMParser().parseFromString(m.svg, "image/svg+xml");
      const coords = doc
        .querySelector('[data-dimension="height"]')!
        .getAttribute("d")!
        .match(/-?[\d.]+/g)!
        .map(Number);
      const pts = [...doc.querySelectorAll("polygon")].flatMap((p) =>
        p
          .getAttribute("points")!
          .split(" ")
          .map((point) => point.split(",").map(Number)),
      );
      const xs = pts.map((p) => p[0]);
      expect(
        direction === "right"
          ? coords[0] > Math.max(...xs)
          : coords[0] < Math.min(...xs),
      ).toBe(true);
      const h = Number(
        doc.querySelector("[data-shape]")!.getAttribute("data-height-mm"),
      );
      expect(coords[1] - coords[3]).toBeCloseTo(h);
      const target = m.targets.find((t) => t.key === "height")!;
      expect(
        direction === "right" ? target.x > coords[0] : target.x < coords[0],
      ).toBe(true);
    }
  });
  it("keeps unarrowed height labels on the front-left and rejects one face across layer gaps", () => {
    const e = fresh();
    const m = layout(e);
    expect(m.targets.find((t) => t.key === "height")!.x).toBeLessThan(
      m.targets.find((t) => t.key === "width")!.x,
    );
    const s = e.document.shapes[0];
    s.view = "layers";
    s.appearance = { ...appearance(s), mode: "one" };
    expect(() => validate(e)).toThrow(/assembled/);
    s.appearance.mode = "faces";
    expect(renderSvg(e).match(/data-layer=/g)).toHaveLength(2);
  });
});
