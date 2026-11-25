import { blank, dim, label, validate, type Envelope, type SolidsDocument } from "./index";

/**
 * Plain shapes: the common solids as a teacher would first draw them, ready to change. They come
 * before the exam-style examples in the gallery. Lengths are given values a teacher edits or turns
 * into pupil spaces; nothing is calculated.
 */
const v = (text: string) => label(text, "value");
const at = { x: 0, y: 0, z: 0 };
const make = (build: (d: SolidsDocument) => void) => (): Envelope => {
  const e = blank();
  build(e.document);
  return validate(e);
};
const turned = (d: SolidsDocument) => void (d.view = { type: "turned", turn: 0, tilt: 14 });

export const plainShapes: { id: string; title: string; note: string; make: () => Envelope }[] = [
  {
    id: "cuboid",
    title: "Cuboid",
    note: "A cuboid with its length, width and height given.",
    make: make((d) => {
      d.solids = [{ id: "p", type: "prism", at, section: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 25 }, { x: 0, y: 25 }], length: 30, axis: "z" }];
      d.dims = [dim("w", "p1", "p2", v("8 cm")), dim("h", "p1", "p4", v("5 cm")), dim("dp", "p2", "pb2", v("6 cm"))];
    }),
  },
  {
    id: "triangular-prism",
    title: "Triangular prism",
    note: "A prism with a right-angled triangle cross-section and its three lengths given.",
    make: make((d) => {
      d.solids = [{ id: "p", type: "prism", at, section: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 30 }], length: 50, axis: "z" }];
      d.dims = [dim("b", "p1", "p2", v("8 cm")), dim("h", "p1", "p3", v("6 cm")), dim("l", "p2", "pb2", v("12 cm"))];
    }),
  },
  {
    id: "roof-prism",
    title: "Triangular prism, roof shape",
    note: "A prism with an isosceles triangle cross-section, like a tent or a roof.",
    make: make((d) => {
      d.solids = [{ id: "p", type: "prism", at, section: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 28 }], length: 50, axis: "z" }];
      d.dims = [dim("b", "p1", "p2", v("10 cm")), dim("l", "p2", "pb2", v("15 cm"))];
    }),
  },
  {
    id: "cylinder",
    title: "Cylinder",
    note: "An upright cylinder with the back of its base dashed.",
    make: make((d) => {
      turned(d);
      d.solids = [{ id: "c", type: "cylinder", at, r: 14, h: 36, axis: "y" }];
    }),
  },
  {
    id: "cone",
    title: "Cone",
    note: "An upright cone with the back of its base dashed.",
    make: make((d) => {
      turned(d);
      d.solids = [{ id: "k", type: "cone", at, r: 16, h: 36, top: 0, axis: "y" }];
    }),
  },
  {
    id: "square-pyramid",
    title: "Square-based pyramid",
    note: "A square-based pyramid with its apex above the centre of the base.",
    make: make((d) => {
      d.solids = [{ id: "v", type: "pyramid", at, base: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }], apex: { x: 15, y: 35, z: -15 }, top: 0 }];
    }),
  },
  {
    id: "sphere",
    title: "Sphere",
    note: "A sphere with its equator, the back half dashed.",
    make: make((d) => {
      turned(d);
      d.solids = [{ id: "s", type: "sphere", at, r: 18, equator: true }];
    }),
  },
  {
    id: "hemisphere",
    title: "Hemisphere",
    note: "A hemisphere with its flat face up.",
    make: make((d) => {
      turned(d);
      d.solids = [{ id: "h", type: "hemisphere", at, r: 18, flat: "up" }];
    }),
  },
];
