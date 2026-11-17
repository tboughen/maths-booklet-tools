import {
  blank,
  dim,
  label,
  validate,
  type Envelope,
  type SolidsDocument,
} from "./index";

/**
 * Editable starting points, each redrawn from a real Question Bank question (sourceId) in the same
 * layout. Worked versions add only answers copied from that question's mark scheme; nothing is
 * calculated. A worked version may add the working the mark scheme shows (a point, lines, the angle
 * asked for). The question's words stay in the question; the pupil drawing carries only what the
 * paper's diagram shows.
 */
type Build = (d: SolidsDocument) => void;
const make =
  (build: Build, answers?: Build) =>
  (worked = false) => {
    const e = blank();
    build(e.document);
    if (worked && answers) answers(e.document);
    return validate(e);
  };
const v = (text: string) => label(text, "value");
const names = (pairs: Record<string, string>) =>
  Object.entries(pairs).map(([id, text]) => ({ id, text }));
const at = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const examples: {
  id: string;
  title: string;
  note: string;
  sourceId: string;
  worked: boolean;
  make: (worked?: boolean) => Envelope;
}[] = [
  {
    id: "triangular-prism",
    title: "Triangular prism: angle with the base",
    note: "ABCD is a square base; E and F are above B and C, with angle EAB = 35° and a right angle at B.",
    sourceId: "1MA1_JUN_2019_2H_Q19",
    worked: true,
    make: make((d) => {
      d.view = { type: "oblique", angle: 22, scale: 0.85 };
      // The triangle DCF is the left end; the prism runs right to ABE.
      d.solids = [
        {
          id: "p",
          type: "prism",
          at: at(),
          section: [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 30, y: 21 },
          ],
          length: 48,
          axis: "x",
        },
      ];
      d.names = names({
        p1: "D",
        p2: "C",
        p3: "F",
        pb1: "A",
        pb2: "B",
        pb3: "E",
      });
      d.dims = [
        dim("da", "p1", "pb1", v("15 cm"), { side: "right" }),
        dim("ab", "pb1", "pb2", v("15 cm"), { side: "right" }),
      ];
      d.angles = [
        {
          id: "eab",
          at: "pb1",
          from: "pb3",
          to: "pb2",
          mark: "arc",
          label: v("35"),
        },
        {
          id: "abe",
          at: "pb2",
          from: "pb1",
          to: "pb3",
          mark: "right",
          label: label(),
        },
      ];
    }, (d) => {
      // The mark scheme's working: M on DA with DM : MA = 2 : 3, and the angle EMB of 31.0°. MB lies on the hidden base, so it is dashed.
      d.points.push({ id: "m", place: { type: "along", a: "p1", b: "pb1", t: 0.4 }, show: "none" });
      d.names.push({ id: "m", text: "M" });
      d.lines.push({ id: "me", a: "m", b: "pb3", style: "solid" }, { id: "mb", a: "m", b: "pb2", style: "dashed" });
      d.angles.push({ id: "emb", at: "m", from: "pb2", to: "pb3", mark: "arc", label: label("", "hidden", "31.0") });
    }),
  },
  {
    id: "cuboid-diagonal",
    title: "Cuboid ABCDEFGH",
    note: "A cuboid with its eight corners named, for the angle between a diagonal and a face.",
    sourceId: "1MA1_JUN_2018_2H_Q18",
    worked: false,
    make: make((d) => {
      d.view = { type: "oblique", angle: 158, scale: 0.55 };
      d.solids = [
        {
          id: "p",
          type: "prism",
          at: at(),
          section: [
            { x: 0, y: 0 },
            { x: 34, y: 0 },
            { x: 34, y: 35 },
            { x: 0, y: 35 },
          ],
          length: 40,
          axis: "z",
        },
      ];
      d.names = names({
        p1: "D",
        p2: "C",
        p3: "H",
        p4: "E",
        pb1: "A",
        pb2: "B",
        pb3: "G",
        pb4: "F",
      });
    }),
  },
  {
    id: "square-pyramid",
    title: "Square-based pyramid VABCD",
    note: "Height 4 cm dotted down the middle, slant height VM = 5 cm to the midpoint of BC, base 6 cm.",
    sourceId: "1MA1_JUN_2018_1H_Q5",
    worked: false,
    make: make((d) => {
      d.view = { type: "oblique", angle: 45, scale: 0.75 };
      d.solids = [
        {
          id: "p",
          type: "pyramid",
          at: at(),
          base: [
            { x: 0, y: 0 },
            { x: 48, y: 0 },
            { x: 48, y: 44 },
            { x: 0, y: 44 },
          ],
          apex: at(24, 50, -22),
          top: 0,
        },
      ];
      d.points = [
        {
          id: "o",
          place: { type: "along", a: "p1", b: "p3", t: 0.5 },
          show: "none",
        },
        {
          id: "m",
          place: { type: "along", a: "p2", b: "p3", t: 0.5 },
          show: "none",
        },
      ];
      d.lines = [
        { id: "vo", a: "pt", b: "o", style: "dotted" },
        { id: "vm", a: "pt", b: "m", style: "dotted" },
      ];
      d.names = names({ pt: "V", p1: "A", p2: "B", p3: "C", p4: "D", m: "M" });
      d.dims = [
        dim("h", "pt", "o", v("4 cm"), { side: "right" }),
        dim("s", "pt", "m", v("5 cm"), { side: "left" }),
        dim("ab", "p1", "p2", v("6 cm"), { side: "right" }),
      ];
    }),
  },
  {
    id: "cylinder-tank",
    title: "Cylinder tank",
    note: "A cylinder with its diameter and height on arrows, the labels in gaps in the arrows.",
    sourceId: "1MA1_JUN_2019_3H_Q6",
    worked: false,
    make: make((d) => {
      d.view = { type: "turned", turn: 0, tilt: 14 };
      d.solids = [
        { id: "c", type: "cylinder", at: at(), r: 16, h: 42, axis: "y" },
      ];
      d.points = [
        {
          id: "l",
          place: { type: "rim", solid: "c", end: "top", deg: 180 },
          show: "none",
        },
        {
          id: "r",
          place: { type: "rim", solid: "c", end: "top", deg: 0 },
          show: "none",
        },
        {
          id: "b",
          place: { type: "rim", solid: "c", end: "base", deg: 0 },
          show: "none",
        },
      ];
      d.dims = [
        dim("dia", "l", "r", v("1.6 m"), {
          kind: "arrow",
          offset: 7,
          gap: true,
          side: "left",
        }),
        dim("ht", "b", "r", v("1.8 m"), {
          kind: "arrow",
          offset: 5,
          gap: true,
          side: "right",
        }),
      ];
    }),
  },
  {
    id: "cone-hemisphere",
    title: "Cone on a hemisphere",
    note: "A cone on top of a hemisphere of the same diameter: the shared rim's back half is dashed.",
    sourceId: "1MA1_JUN_2019_1H_Q15",
    worked: false,
    make: make((d) => {
      d.view = { type: "turned", turn: 0, tilt: 10 };
      d.solids = [
        { id: "k", type: "cone", at: at(), r: 22, h: 44, top: 0, axis: "y" },
        { id: "h", type: "hemisphere", at: at(), r: 22, flat: "up" },
      ];
      d.points = [
        {
          id: "l",
          place: { type: "rim", solid: "k", end: "base", deg: 180 },
          show: "none",
        },
        {
          id: "r",
          place: { type: "rim", solid: "k", end: "base", deg: 0 },
          show: "none",
        },
        { id: "s", place: { type: "at", x: 22, y: 44, z: 0 }, show: "none" },
      ];
      d.dims = [
        dim("dia", "l", "r", v("6 cm"), { kind: "arrow", side: "left" }),
        dim("ht", "r", "s", v("10 cm"), {
          kind: "arrow",
          offset: 8,
          gap: true,
          side: "right",
        }),
      ];
    }),
  },
  {
    id: "cone-sculpture",
    title: "Cone standing on a hemisphere",
    note: "A narrow cone on the flat face of a wider hemisphere, with the slant height and both diameters.",
    sourceId: "1MA1_MOCK_SET_06_3H_Q18",
    worked: false,
    make: make((d) => {
      d.view = { type: "turned", turn: 0, tilt: 16 };
      d.solids = [
        { id: "k", type: "cone", at: at(), r: 12, h: 62, top: 0, axis: "y" },
        { id: "h", type: "hemisphere", at: at(), r: 34, flat: "up" },
      ];
      d.points = [
        {
          id: "l",
          place: { type: "rim", solid: "k", end: "base", deg: 180 },
          show: "none",
        },
        {
          id: "r",
          place: { type: "rim", solid: "k", end: "base", deg: 0 },
          show: "none",
        },
        {
          id: "hl",
          place: { type: "rim", solid: "h", end: "base", deg: 180 },
          show: "none",
        },
        {
          id: "hr",
          place: { type: "rim", solid: "h", end: "base", deg: 0 },
          show: "none",
        },
      ];
      d.dims = [
        dim("sl", "l", "kt", v("8 m"), {
          kind: "arrow",
          offset: 3,
          side: "left",
        }),
        dim("dk", "l", "r", v("2.2 m"), { kind: "arrow", gap: true }),
        dim("dh", "hl", "hr", v("6.4 m"), {
          kind: "arrow",
          offset: 40,
          side: "right",
        }),
      ];
    }),
  },
];
