import {
  create,
  newShape,
  validate,
  upgrade,
  appearance,
  type Envelope,
  type Shape,
} from "./index";
export interface Example {
  id: string;
  title: string;
  source?: string;
  description: string;
  create: (worked: boolean) => Envelope;
}
const dims = (w: string, d: string, h: string): Shape["dimensions"] => ({
  width: w,
  depth: d,
  height: h,
});
const shape = (
  id: string,
  d: Shape["dimensions"],
  other: Partial<Shape> = {},
): Shape => ({ ...newShape(id), dimensions: d, ...other });
function resource(shapes: Shape[], widthCm = 10) {
  return validate({ ...create(), document: { widthCm, shapes } });
}
export const examples: Example[] = [
  ...(["grey-faces", "base-area", "cross-section-face"] as const).map((id) => ({
    id,
    title:
      id === "grey-faces"
        ? "Greyscale faces"
        : id === "base-area"
          ? "Shaded base area"
          : "Cross-sectional face area",
    description:
      id === "grey-faces"
        ? "Three neutral face tones with black outlines. Calculations are only in the worked choice."
        : "One existing face is shaded. The scaffold retains an area answer line; the worked choice supplies the exact area.",
    create: (worked: boolean) => {
      const e = upgrade(create()),
        s = e.document.shapes[0];
      s.appearance = {
        ...appearance(s),
        mode: id === "grey-faces" ? "faces" : "one",
        face: id === "cross-section-face" ? "right" : "bottom",
        area: {
          ...appearance(s).area,
          mode: id === "grey-faces" ? "hidden" : worked ? "value" : "blank",
          heading:
            id === "cross-section-face" ? "Cross-sectional area" : "Base area",
          expression: worked,
        },
      };
      if (id === "grey-faces") s.workedVolume = worked;
      return e;
    },
  })),
  ...[1, 2, 3].map((h) => ({
    id: `layers-${h}`,
    title: `${h === 1 ? "One" : h === 2 ? "Two" : "Three"} ${h === 1 ? "layer" : "layers"}`,
    description:
      "The attached-image progression, drawn in black. Each small cube has side 1 cm.",
    create: (worked: boolean) =>
      resource([
        shape("cuboid-1", dims("4", "3", String(h)), {
          view: "cubes",
          workedVolume: worked,
          counts: worked,
        }),
      ]),
  })),
  {
    id: "missing-height",
    title: "Missing height",
    description:
      "One dimension is left for pupils. Cube and layer views preserve the answer space.",
    create: (worked) => {
      const s = shape("cuboid-1", dims("5", "3", "2"));
      s.labels.height.mode = worked ? "value" : "blank";
      s.workedVolume = worked;
      return resource([s]);
    },
  },
  {
    id: "1MA1_NOV_2020_2F_Q11",
    title: "Volume of a cuboid",
    source: "November 2020 · Foundation 2 · Q11",
    description: "10 × 15 × 4 cm. The scaffold keeps the volume undisclosed.",
    create: (worked) =>
      resource([
        shape("cuboid-1", dims("10", "15", "4"), { workedVolume: worked }),
      ]),
  },
  {
    id: "1MA1_MOCK_SET_06_3F_Q15",
    title: "Twelve 2 cm cubes",
    source: "Mock set 06 · Foundation 3 · Q15",
    description:
      "A cube and cuboid, with dimension arrows. The worked cuboid shows 2 cm cubes, each of volume 8 cm³.",
    create: (worked) =>
      resource(
        [
          shape("cube", dims("2", "2", "2"), {
            cube: true,
            title: "Cube",
            arrows: true,
          }),
          shape("cuboid", dims("8", "2", "6"), {
            title: "Cuboid",
            arrows: true,
            cubeSideCm: "2",
            view: worked ? "cubes" : "plain",
            counts: worked,
          }),
        ],
        16,
      ),
  },
  {
    id: "1MA1_MOCK_SET_08_3F_Q13",
    title: "Box and 4 cm brick",
    source: "Mock set 08 · Foundation 3 · Q13",
    description:
      "32 × 20 × 8 cm box and a 4 cm cube. Cube-grid capacity is worked output; the original question asks about 75 bricks.",
    create: (worked) =>
      resource(
        [
          shape("box", dims("32", "20", "8"), {
            title: "Box",
            cubeSideCm: "4",
            view: worked ? "cubes" : "plain",
            counts: worked,
          }),
          shape("brick", dims("4", "4", "4"), { title: "Brick", cube: true }),
        ],
        16,
      ),
  },
  {
    id: "1MA1_JUN_2017_3F_Q12",
    title: "Six cubes make a cuboid",
    source: "June 2017 · Foundation 3 · Q12",
    description:
      "One valid 6 × 4 × 2 cm arrangement of six 2 cm cubes. Other arrangements are possible. Dimensions are blank in the scaffold.",
    create: (worked) => {
      const s = shape("cuboid-1", dims("6", "4", "2"), {
        cubeSideCm: "2",
        view: "cubes",
        workedArea: worked,
        workedVolume: worked,
      });
      if (!worked)
        for (const k of ["width", "depth", "height"] as const)
          s.labels[k].mode = "blank";
      return resource([s]);
    },
  },
  {
    id: "1MA1_NOV_2019_2H_Q9",
    title: "Equal surface areas",
    source: "November 2019 · Higher 2 · Q9",
    description:
      "Cube and cuboid with hidden edges. The unknown cube size remains unlabelled; the worked option gives only the known cuboid's measurements.",
    create: (worked) => {
      const s = shape("cube", dims("10", "10", "10"), {
        cube: true,
        hiddenEdges: true,
        title: "Cube",
        schematic: true,
        proportions: dims("3", "3", "3"),
      });
      for (const k of ["width", "depth", "height"] as const)
        s.labels[k].mode = "hidden";
      return resource(
        [
          s,
          shape("cuboid", dims("8", "18", "6"), {
            title: "Cuboid",
            hiddenEdges: true,
            workedArea: worked,
            workedVolume: worked,
          }),
        ],
        16,
      );
    },
  },
  {
    id: "1MA1_NOV_2018_3H_Q8",
    title: "Three face areas",
    source: "November 2018 · Higher 3 · Q8",
    description:
      "Areas 27, 45 and 15 cm². Unknown edge lengths remain hidden. The scaffold supports the first step of the original melting question.",
    create: (worked) => {
      const s = shape("cuboid-1", dims("9", "3", "5"), {
        schematic: true,
        proportions: dims("5", "3", "2"),
      });
      for (const k of ["width", "depth", "height"] as const)
        s.labels[k].mode = worked ? "value" : "hidden";
      for (const k of ["front", "top", "side"] as const)
        s.labels[k].mode = "area";
      s.workedVolume = worked;
      return resource([s]);
    },
  },
];
