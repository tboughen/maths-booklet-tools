import { RENDERER_VERSION, forView, newNet, text, validate, type Envelope, type Net } from "./index";
import { DEFAULT_PRESETS, squaresNet, type Preset } from "./presets";

/** "?F" is a hidden answer. */
const t = (s: string) => (s.startsWith("?") ? text(s.slice(1), "hidden") : text(s));
function doc(nets: Net[], grid: Envelope["document"]["grid"] = "squares"): Envelope {
  return validate({ kind: "nets", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { nets, grid, unitCm: 1 } });
}
function net(preset: Preset, change: (n: Net) => void = () => {}, netId = "n1", caption = ""): Net {
  const n = newNet(netId, preset);
  n.caption = t(caption);
  change(n);
  return n;
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
const cube = (index: number, side = 2): Preset => ({ type: "cube", net: index, side });

/** Editable starting points. Hidden answers stay blank for pupils. */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "dot-opposite",
    title: "Where does the dot end up?",
    note: "A cube net with a dot on one face. The dot on the opposite face is a hidden answer: pupils mark it.",
    make: (worked) =>
      finish(
        doc([
          net(cube(5), (n) => {
            n.faces[0].mark = { kind: "dot", show: "show" };
            n.faces[5].mark = { kind: "dot", show: "hidden" };
          }),
        ]),
        worked,
      ),
  },
  {
    id: "opposite-letters",
    title: "Which face is opposite A?",
    note: "A cube net with a letter on every face, for questions about opposite faces.",
    make: (worked) =>
      finish(
        doc([
          net(cube(2), (n) => {
            "ABCDEF".split("").forEach((c, i) => (n.faces[i].label = t(c)));
          }),
        ]),
        worked,
      ),
  },
  {
    id: "which-are-nets",
    title: "Which are nets of a cube?",
    note: "Three arrangements of six squares, A, B and C. C has a block of four squares, so it does not fold into a cube.",
    make: (worked) =>
      finish(
        doc([
          net(cube(10, 1), () => {}, "n1", "A"),
          net(cube(7, 1), () => {}, "n2", "B"),
          {
            ...net(cube(1, 1), () => {}, "n3", "C"),
            faces: squaresNet(
              [
                [1, 1],
                [2, 1],
                [1, 2],
                [2, 2],
                [3, 2],
                [4, 2],
              ],
              1,
            ).map((points, i) => ({ id: `f${i + 1}`, points, show: "show" as const, label: text(), mark: { kind: "none" as const, show: "show" as const } })),
          },
        ]),
        worked,
      ),
  },
  {
    id: "corners-meet",
    title: "Which corner meets P?",
    note: "A cube net with letters at four corners: P meets Q and R meets S when it is folded.",
    make: (worked) =>
      finish(
        doc([
          net(cube(1), (n) => {
            n.vertices = [
              { at: [1, 1], label: t("P") },
              { at: [7, 3], label: t("Q") },
              { at: [1, 5], label: t("R") },
              { at: [9, 5], label: t("S") },
            ];
          }),
        ]),
        worked,
      ),
  },
  {
    id: "cuboid-lengths",
    title: "Net of a cuboid with lengths",
    note: "A 4 cm by 2 cm by 3 cm cuboid's net on centimetre squares, with its three lengths labelled.",
    make: (worked) =>
      finish(
        doc([
          net({ type: "cuboid", length: 4, width: 2, height: 3 }, (n) => {
            n.edges = [
              { from: [1, 1], to: [5, 1], label: t("4 cm") },
              { from: [1, 1], to: [1, 3], label: t("2 cm") },
              { from: [1, 3], to: [1, 6], label: t("3 cm") },
            ];
          }),
        ]),
        worked,
      ),
  },
  {
    id: "draw-cuboid-net",
    title: "Draw the net of a cuboid",
    note: "An empty grid for pupils. The net of a 3 cm by 2 cm by 1 cm cuboid is the hidden answer.",
    make: (worked) =>
      finish(
        doc([
          net({ type: "cuboid", length: 3, width: 2, height: 1 }, (n) => {
            n.faces.forEach((f) => (f.show = "hidden"));
            n.size = { across: 14, down: 8 };
          }),
        ]),
        worked,
      ),
  },
  {
    id: "complete-cube-net",
    title: "Complete the net of a cube",
    note: "Four faces of a cube net; the last two squares are hidden answers.",
    make: (worked) =>
      finish(
        doc([
          net(cube(4), (n) => {
            n.faces[0].show = "hidden";
            n.faces[5].show = "hidden";
          }),
        ]),
        worked,
      ),
  },
  {
    id: "name-the-shape",
    title: "Name the 3D shape",
    note: "Nets of a triangular prism and a square-based pyramid. The names are hidden answers under each net.",
    make: (worked) =>
      finish(
        doc([
          net({ type: "triangular-prism", a: 3, b: 4, length: 4 }, () => {}, "n1", "?triangular prism"),
          net({ type: "square-pyramid", base: 3, slant: 3 }, () => {}, "n2", "?square-based pyramid"),
        ]),
        worked,
      ),
  },
];

/** Plain shapes: the net of each solid the tool draws, on centimetre squares. */
export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  { id: "cube", title: "Cube net", note: "One of the eleven nets of a cube.", make: () => doc([net(DEFAULT_PRESETS.cube)]) },
  { id: "cuboid", title: "Cuboid net", note: "The net of a 4 by 2 by 3 cuboid.", make: () => doc([net(DEFAULT_PRESETS.cuboid)]) },
  { id: "triangular-prism", title: "Triangular prism net", note: "The net of a triangular prism.", make: () => doc([net(DEFAULT_PRESETS["triangular-prism"])]) },
  { id: "square-pyramid", title: "Square-based pyramid net", note: "The net of a square-based pyramid.", make: () => doc([net(DEFAULT_PRESETS["square-pyramid"])]) },
  { id: "cylinder", title: "Cylinder net", note: "A rectangle as wide as the circumference, with a circle on each long side.", make: () => doc([net(DEFAULT_PRESETS.cylinder)]) },
  { id: "cone", title: "Cone net", note: "A sector for the curved surface, with the circular base touching its arc.", make: () => doc([net(DEFAULT_PRESETS.cone)]) },
  { id: "tetrahedron", title: "Tetrahedron net", note: "The net of a regular tetrahedron.", make: () => doc([net(DEFAULT_PRESETS.tetrahedron)]) },
];
