// Property tests for Venn regions (improvement list L19): the regions partition the universe. Every
// point is in exactly one region the arrangement offers, every offered region can be reached and each
// region's anchor lies inside it, over seeded random diagrams of 1–3 sets in every arrangement.
import { describe, expect, it } from "vitest";
import { forAll, type Random } from "../../../src/testing/random";
import { activeMasks, arrangements, changeArrangement, createExtended, geometry, membership, validate, type Envelope } from "./index";

function diagram(r: Random): Envelope {
  const sets = r.pick([1, 2, 3] as const), e = structuredClone(sets === 2 ? changeArrangement(createExtended(2), r.pick(arrangements)) : createExtended(sets));
  e.document.shape = r.pick(["circles", "ovals"] as const);
  e.document.widthCm = r.int(8, 16);
  return validate(e);
}

describe("Venn regions partition the universe", () => {
  it("every point of the universe is in one offered region, and every offered region is reached", () => {
    forAll(40, (r) => {
      const e = diagram(r), g = geometry(e), b = g.box, seen = new Set<number>();
      for (let x = b.x; x <= b.x + b.width; x += 1) for (let y = b.y; y <= b.y + b.height; y += 1) seen.add(membership(g, x, y));
      expect([...seen].sort((p, q) => p - q)).toEqual(activeMasks(e));
    });
  });

  it("random points never fall outside the offered regions, and every outline stays inside the universe", () => {
    forAll(150, (r) => {
      const e = diagram(r), g = geometry(e), b = g.box, active = new Set(activeMasks(e)), outside: number[] = [];
      for (let i = 0; i < 100; i++) { const m = membership(g, b.x + r.next() * b.width, b.y + r.next() * b.height); if (!active.has(m)) outside.push(m); }
      expect(outside).toEqual([]);
      for (const c of g.circles) {
        expect(c.x - c.rx > b.x && c.x + c.rx < b.x + b.width).toBe(true);
        expect(c.y - c.ry > b.y && c.y + c.ry < b.y + b.height).toBe(true);
      }
    });
  });

  it("each region's anchor lies inside that region", () => {
    forAll(150, (r) => {
      const e = diagram(r), g = geometry(e);
      for (const mask of activeMasks(e)) expect(membership(g, g.anchors[mask].x, g.anchors[mask].y)).toBe(mask);
    });
  });
});
