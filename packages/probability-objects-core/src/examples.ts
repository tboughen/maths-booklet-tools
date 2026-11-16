import { RENDERER_VERSION, forView, newBag, newDice, newSpinner, validate, value, type Envelope, type ProbabilityObject, type Value } from "./index";

/** "?B" is a hidden answer; "" is a pupil blank. */
const v = (t: string): Value => (t.startsWith("?") ? value(t.slice(1), "hidden") : value(t));
function doc(objects: ProbabilityObject[]): Envelope {
  return validate({ kind: "probability-objects", schemaVersion: 1, rendererVersion: RENDERER_VERSION, document: { objects } });
}
const finish = (e: Envelope, worked: boolean) => (worked ? forView(e, "answer") : e);
function spinner(id: string, texts: string[], extra: Partial<ProbabilityObject> = {}): ProbabilityObject {
  const s = newSpinner(id, []);
  s.sectors = texts.map((t) => ({ label: v(t), fill: "none", angle: null }));
  return { ...s, ...extra } as ProbabilityObject;
}

/**
 * Editable starting points drawn the way Edexcel papers draw these objects (the papers named in
 * each note are in the Question Bank). Numbers and labels are our own. Hidden answers stay blank
 * for pupils.
 */
export const examples: { id: string; title: string; note: string; make: (worked: boolean) => Envelope }[] = [
  {
    id: "four-sided",
    title: "Fair 4-sided spinner",
    note: "A square spinner on its stick, sectors A, B, B and C, as in June 2017 1F Q6 and June 2023 3F Q7.",
    make: (worked) => finish(doc([spinner("o1", ["A", "B", "C", "B"], { shape: "polygon", rotation: 0, pointer: "stick", pointerAngle: 25 })]), worked),
  },
  {
    id: "six-sectors",
    title: "Six equal sectors with an arrow",
    note: "A circular spinner with an arrow, numbers repeated, as in Mock Set 5 1F Q5.",
    make: (worked) => finish(doc([spinner("o1", ["1", "2", "3", "2", "4", "2"], { rotation: 330, pointerAngle: 45 })]), worked),
  },
  {
    id: "unequal-sectors",
    title: "Sectors of different sizes",
    note: "A 90° sector marked with a right angle beside two equal sectors, as in June 2024 2F Q11 (\"the spinner has three sections\").",
    make: (worked) => {
      const s = spinner("o1", ["2", "3", "1"], { rightAngles: true, pointerAngle: 140 }) as ReturnType<typeof newSpinner>;
      s.sectors[0].angle = 90;
      return finish(doc([s]), worked);
    },
  },
  {
    id: "dice-and-spinner",
    title: "A dice and an 8-sided spinner",
    note: "An ordinary dice beside a fair octagonal spinner numbered 1 to 8, as in June 2023 2F Q15.",
    make: (worked) => {
      const dice = newDice("o1");
      return finish(doc([dice, spinner("o2", ["1", "8", "7", "6", "5", "4", "3", "2"], { shape: "polygon", rotation: 22.5, pointer: "stick", pointerAngle: 35 })]), worked);
    },
  },
  {
    id: "bag-of-counters",
    title: "A bag of counters",
    note: "Four red, three blue and two green counters, labelled R, B and G and shaded so the colours read in black and white.",
    make: (worked) => {
      const bag = newBag("o1");
      bag.groups = [
        { label: v("R"), fill: "none", count: 4 },
        { label: v("B"), fill: "grey", count: 3 },
        { label: v("G"), fill: "hatched", count: 2 },
      ];
      return finish(doc([bag]), worked);
    },
  },
  {
    id: "complete-the-spinner",
    title: "Label the spinner",
    note: "Eight equal sectors, three labelled. Pupils label the rest so that P(red) is 1/2 and P(blue) is 1/4: the answers copy shows one way.",
    make: (worked) => finish(doc([spinner("o1", ["Red", "?Red", "Blue", "?Red", "?Blue", "Red", "?Green", "?Green"], { sizeMm: 46, pointer: "none" })]), worked),
  },
  {
    id: "two-spinners",
    title: "Two spinners, A and B",
    note: "Two fair spinners side by side, captioned A and B, for two-event questions.",
    make: (worked) =>
      finish(
        doc([
          spinner("o1", ["1", "2", "3"], { sizeMm: 32, caption: "Spinner A", pointerAngle: 60 }),
          spinner("o2", ["1", "2", "3", "4"], { sizeMm: 32, caption: "Spinner B", pointerAngle: 60 }),
        ]),
        worked,
      ),
  },
  {
    id: "biased-dice",
    title: "Faces of a dice",
    note: "The six faces of a dice numbered 1, 1, 2, 3, 3, 3, in a row. The last face is a hidden answer.",
    make: (worked) => {
      const d = newDice("o1", "faces");
      d.marks = "numbers";
      d.faces = ["1", "1", "2", "3", "3", "?3"].map(v);
      return finish(doc([d]), worked);
    },
  },
];
