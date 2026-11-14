import {
  angleBisector,
  blank,
  forView,
  label,
  locusFromPoint,
  locusFromSegment,
  measureBearing,
  newPoint,
  perpendicularAtPoint,
  perpendicularBisector,
  perpendicularFromPoint,
  pointByBearing,
  segment,
  validate,
  type Envelope,
} from "./index";

const finish = (e: Envelope, worked: boolean) => validate(worked ? forView(e, "answer") : e);

/** Editable starting points. Source examples name the question they adapt; the rest are lesson steps. */
export const examples: {
  id: string;
  title: string;
  note: string;
  sourceId?: string;
  worked: boolean;
  make: (worked: boolean) => Envelope;
}[] = [
  {
    id: "perpendicular-bisector",
    title: "Perpendicular bisector of AB",
    note: "AB is 8 cm. Pupils construct the perpendicular bisector with compasses; the arcs and line are the saved answer.",
    worked: true,
    make: (worked) => {
      const e = blank(13, 9);
      e.document.points.push(newPoint("A", 2.5, 4.5), newPoint("B", 10.5, 4.5));
      e.document.objects.push(segment("AB", "A", "B"));
      return finish(perpendicularBisector(e, { a: "A", b: "B", radius: 5.5 }), worked);
    },
  },
  {
    id: "angle-bisector",
    title: "Bisect angle PQR",
    note: "Angle PQR is 64° with 8 cm arms. Pupils bisect it with compasses; the arcs and bisector are the saved answer.",
    worked: true,
    make: (worked) => {
      const e = blank(12, 8);
      const q = { x: 1.5, y: 1.5 };
      e.document.points.push(
        newPoint("Q", q.x, q.y, "Q", { mark: "none" }),
        newPoint("R", q.x + 9, q.y, "R", { mark: "none" }),
        newPoint("P", q.x + 7 * Math.cos((64 * Math.PI) / 180), q.y + 7 * Math.sin((64 * Math.PI) / 180), "P", { mark: "none" }),
      );
      e.document.objects.push(segment("QR", "Q", "R"), segment("QP", "Q", "P"));
      return finish(angleBisector(e, { at: "Q", from: "R", to: "P", radius: 3 }), worked);
    },
  },
  {
    id: "perpendicular-from-point",
    title: "Perpendicular from P to the line",
    note: "Pupils construct the perpendicular from P to the line AB. The arcs and the perpendicular are the saved answer.",
    worked: true,
    make: (worked) => {
      const e = blank(13, 9);
      e.document.points.push(newPoint("A", 1, 4, "A", { mark: "none" }), newPoint("B", 12, 4, "B", { mark: "none" }), newPoint("P", 5.5, 7.3));
      e.document.objects.push(segment("AB", "A", "B"));
      return finish(perpendicularFromPoint(e, { point: "P", a: "A", b: "B", radius: 5 }), worked);
    },
  },
  {
    id: "perpendicular-at-point",
    title: "Perpendicular at P on the line",
    note: "P is on the line AB. Pupils construct the perpendicular to AB at P; the arcs and line are the saved answer.",
    worked: true,
    make: (worked) => {
      const e = blank(13, 7);
      e.document.points.push(newPoint("A", 1, 1.5, "A", { mark: "none" }), newPoint("B", 12, 1.5, "B", { mark: "none" }), newPoint("P", 6, 1.5));
      e.document.objects.push(segment("AB", "A", "B"));
      return finish(perpendicularAtPoint(e, { point: "P", a: "A", b: "B", radius: 2.5 }), worked);
    },
  },
  {
    id: "locus-segment",
    title: "Points 2 cm from a line segment",
    note: "AB is 7 cm. Pupils draw the locus of points 2 cm from AB: two parallel lines joined by semicircles.",
    worked: true,
    make: (worked) => {
      const e = blank(13, 7);
      e.document.points.push(newPoint("A", 3, 3.5), newPoint("B", 10, 3.5));
      e.document.objects.push(segment("AB", "A", "B"));
      return finish(locusFromSegment(e, { a: "A", b: "B", distance: 2 }), worked);
    },
  },
  {
    id: "map-equidistant",
    title: "June 2017 2F Q16: a point on a map",
    note: "1 cm represents 100 metres. T is 250 m from A and equidistant from B and C. The answer shows the 2.5 cm circle about A and the perpendicular bisector of BC.",
    sourceId: "1MA1_JUN_2017_2F_Q16",
    worked: true,
    make: (worked) => {
      const e = blank(12, 10);
      e.document.points.push(newPoint("A", 2.5, 5.5), newPoint("B", 10.3, 8.1, "B", { labelAt: "n" }), newPoint("C", 7.8, 1.8, "C", { labelAt: "s" }));
      e.document.caption = label("1 cm represents 100 metres.");
      let n = locusFromPoint(e, { point: "A", distance: 2.5 });
      n = perpendicularBisector(n, { a: "B", b: "C", radius: 4.5, extend: 2.5 });
      return finish(n, worked);
    },
  },
  {
    id: "bearings-port",
    title: "November 2019 1H Q8: bearings scale drawing",
    note: "Scale 1 cm represents 4 km. Aleena sails 18 km on a bearing of 070° from P to Q. The answer marks Q 4.5 cm from P with the bearing of Q from L.",
    sourceId: "1MA1_NOV_2019_1H_Q8",
    worked: true,
    make: (worked) => {
      const e = blank(12, 10.5);
      const d = e.document;
      d.points.push(newPoint("P", 2, 5, "P", { labelAt: "s" }), newPoint("L", 9.2, 2.4, "L", { labelAt: "s" }));
      d.objects.push({ id: "northP", type: "north", at: "P", length: 4.4, role: "given" }, { id: "northL", type: "north", at: "L", length: 4.4, role: "given" });
      d.caption = label("Scale: 1 cm represents 4 km.");
      let n = pointByBearing(e, { id: "Q", from: "P", bearing: 70, distance: 4.5, role: "answer" });
      n.document.objects.push(
        { id: "bearingPQ", type: "bearing", from: "P", to: "Q", northLine: false, label: label("070°"), role: "answer" },
        segment("PQ", "P", "Q", { role: "answer" }),
        segment("LQ", "L", "Q", { role: "answer", dash: true }),
        { id: "bearingLQ", type: "bearing", from: "L", to: "Q", northLine: false, label: label(""), role: "answer" },
      );
      n = measureBearing(n, "bearingLQ");
      return finish(n, worked);
    },
  },
  {
    id: "loci-garden",
    title: "Where can the tree go?",
    note: "A 10 m by 6 m garden at 1 cm to 1 m. The tree is within 3 m of the pond P and closer to AB than to AD. The circle, angle bisector and shaded region are the saved answer.",
    worked: true,
    make: (worked) => {
      const e = blank(12, 8);
      const d = e.document;
      d.points.push(
        newPoint("A", 1, 1, "A", { mark: "none" }),
        newPoint("B", 11, 1, "B", { mark: "none" }),
        newPoint("C", 11, 7, "C", { mark: "none" }),
        newPoint("D", 1, 7, "D", { mark: "none" }),
        newPoint("P", 7, 4.5),
      );
      d.objects.push({ id: "garden", type: "polygon", points: ["A", "B", "C", "D"], dash: false, role: "given" }, segment("AB", "A", "B"), segment("AD", "A", "D"));
      d.caption = label("Scale: 1 cm represents 1 m");
      let n = locusFromPoint(e, { point: "P", distance: 3 });
      n = angleBisector(n, { at: "A", from: "B", to: "D", radius: 2, extend: 4.5 });
      n.document.objects.push({
        id: "region",
        type: "region",
        rules: [
          { kind: "distance", from: "P", distance: 3, side: "within" },
          { kind: "closer", to: "AB", than: "AD" },
          { kind: "inside", shape: "garden", side: "within" },
        ],
        pattern: "hatch",
        role: "answer",
      });
      return finish(n, worked);
    },
  },
];
