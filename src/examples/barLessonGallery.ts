import type { GalleryExample } from "./galleryCatalogue";
import { barGallery } from "./galleryCatalogue";
import * as core from "../../packages/bar-model-core/src/versioned";
import {
  lessonExample,
  lessonExampleNames,
} from "../../packages/bar-model-core/src/lesson-examples";
export const lessonTitles = {
  R1: "Part-whole: two unequal parts",
  "R2-P": "Mia and Jack: comparison in equal units",
  "R2-C": "Mia and Jack: continuous comparison",
  R3a: "Four fifths of 45",
  R3b: "Three eighths of 48",
  R3c: "Six sevenths of 56",
  R3d: "Five ninths of 81",
  R4: "Fractions with two labels per section",
  R5: "Eve and Fred: inline ratio 3:5",
};
export const barLessonGallery: GalleryExample<core.Envelope>[] = [
  ...lessonExampleNames.map((name) => ({
    id: `bar-lesson-${name}`,
    title: lessonTitles[name],
    description:
      "New lesson layout based on the supplied mathematical structures. Pupil models retain saved answers without printing them; worked versions are explicit. Calculation lines are entered manually, with no automatic solver.",
    make: (worked: boolean) => lessonExample(name, worked),
    render: core.renderSvg,
  })),
  ...barGallery.map((example) => ({ ...example, render: core.renderSvg })),
];
