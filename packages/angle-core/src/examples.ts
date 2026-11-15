import { angle, blank, label, validate, type Angle, type Envelope, type Figure } from "./index";

type Extra = Partial<Omit<Envelope["document"], "figure" | "angles">>;
/** An example as pupils see it; the worked version keeps the same file with its answers saved. */
const make = (figure: Figure, angles: Angle[], extra: Extra = {}) => (worked: boolean) => {
  const e = blank(figure);
  e.document = { ...e.document, ...extra, figure, angles };
  const v = validate(e);
  if (!worked) for (const a of v.document.angles) a.label.answer = "";
  return v;
};
const given = (id: string, text: string, mark: Angle["mark"] = "arc") => angle(id, label(text, "value"), mark);
const find = (id: string, letter: string, answer: string, mark: Angle["mark"] = "arc") => angle(id, label(letter, "symbol", answer), mark);

/**
 * Editable starting points. Pupil versions carry no saved answers; worked versions save them, so the
 * answers copy prints them in the answer colour. Sizes are as typed: nothing is calculated.
 */
export const examples: { id: string; title: string; note: string; worked: boolean; make: (worked: boolean) => Envelope }[] = [
  {
    id: "straight-line",
    title: "Angles on a straight line",
    note: "Two rays from a point on a straight line. Two angles are given; pupils work out x.",
    worked: true,
    make: make({ type: "straight-line", rays: [48, 115] }, [given("s1", "48"), find("s2", "x", "67"), given("s3", "65")], { names: [{ id: "left", text: "A" }, { id: "o", text: "B" }, { id: "right", text: "C" }] }),
  },
  {
    id: "point",
    title: "Angles round a point",
    note: "Four angles round a point, one in algebra. Pupils find y.",
    worked: true,
    make: make({ type: "point", rays: [10, 105, 200, 285] }, [given("s1", "95"), given("s2", "95"), given("s3", "85"), find("s4", "y", "85")], { sizeMm: 60 }),
  },
  {
    id: "vertically-opposite",
    title: "Vertically opposite angles",
    note: "Two straight lines cross. One angle is given; pupils find a, b and c.",
    worked: true,
    make: make({ type: "crossing", lines: [20, 75] }, [given("s1", "55"), find("s2", "a", "125"), find("s3", "b", "55"), find("s4", "c", "125")]),
  },
  {
    id: "algebra-line",
    title: "Form and solve an equation",
    note: "Angles on a straight line given in algebra. The answer x = 25 belongs in the question's answer space.",
    worked: false,
    make: make({ type: "straight-line", rays: [70] }, [given("s1", "3x + 5"), given("s2", "4x")], { sizeMm: 70 }),
  },
  {
    id: "parallel",
    title: "Parallel lines: alternate and corresponding angles",
    note: "Two parallel lines cut by a transversal. One angle is given; pupils find x and y and give reasons.",
    worked: true,
    make: make({ type: "parallel", count: 2, gapMm: 24, crossDeg: 58, arrows: 1 }, [given("p1-ur", "58"), find("p2-ul", "x", "122"), find("p2-ll", "y", "58")], { sizeMm: 80 }),
  },
  {
    id: "co-interior",
    title: "Parallel lines: co-interior angles",
    note: "The co-interior pair is shaded for teaching. Pupils find the missing angle.",
    worked: true,
    make: make({ type: "parallel", count: 2, gapMm: 26, crossDeg: 65, arrows: 2 }, [{ ...given("p1-lr", "115"), shade: true }, { ...find("p2-ur", "p", "65"), shade: true }], { sizeMm: 80 }),
  },
  {
    id: "regular-polygon",
    title: "Interior angle of a regular polygon",
    note: "A regular hexagon with equal-side ticks. Pupils work out the interior angle x.",
    worked: true,
    make: make({ type: "polygon", sides: 6, corners: null, exterior: [], diagonals: false, ticks: [1, 1, 1, 1, 1, 1] }, [find("i2", "x", "120")], { sizeMm: 50 }),
  },
  {
    id: "exterior-angle",
    title: "Exterior angle of a regular polygon",
    note: "A regular pentagon with one side extended. Pupils work out the exterior angle e.",
    worked: true,
    make: make({ type: "polygon", sides: 5, corners: null, exterior: [2], diagonals: false, ticks: [1, 1, 1, 1, 1] }, [find("e2", "e", "72")], { sizeMm: 50 }),
  },
  {
    id: "polygon-sum",
    title: "Angles in an irregular pentagon",
    note: "Diagonals from one corner split the pentagon into three triangles. Four angles are given; pupils find x.",
    worked: true,
    make: make(
      { type: "polygon", sides: 5, corners: [{ x: -26, y: -20 }, { x: 24, y: -22 }, { x: 32, y: 8 }, { x: 2, y: 28 }, { x: -30, y: 10 }], exterior: [], diagonals: true, ticks: [0, 0, 0, 0, 0] },
      [given("i1", "102"), given("i2", "100"), given("i3", "115"), find("i4", "x", "110"), given("i5", "113")],
    ),
  },
];
