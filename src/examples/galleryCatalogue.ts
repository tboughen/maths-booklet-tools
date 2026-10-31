import * as bar from "../../packages/bar-model-core/src";
import {
  graphExamples,
  ratioExamples,
  sourceQuestionHref,
} from "./sourceExamples";
import { renderDiagramSvg } from "../../packages/graph-core/src/svg";
import {
  renderRatioSvg,
  createRatioTable,
} from "../../packages/ratio-table-core/src/interchange";
import {
  preset,
  renderSvg as quadraticSvg,
} from "../../packages/value-graph-core/src/interchange";
import {
  quadraticSources,
  workedQuadraticExample,
} from "../value-graph/examples";
import { examples as cuboids } from "../../packages/cuboid-core/src/examples";
import {
  layout as cuboidLayout,
  upgrade as upgradeCuboid,
} from "../../packages/cuboid-core/src";
import {
  examples as lines,
  example as lineExample,
} from "../../packages/number-line-core/src/examples";
import { renderSvg as lineSvg } from "../../packages/number-line-core/src";
import {
  examples as venn,
  teachingExamples as vennTeaching,
} from "../../packages/venn-core/src/examples";
import { renderSvg as vennSvg } from "../../packages/venn-core/src";
import {
  sourceExamples as triangles,
  teachingExamples as triangleTeaching,
} from "../../packages/triangle-core/src/examples";
import {
  renderSvg as triangleSvg,
  workedCopy as triangleWorked,
  allLabels,
} from "../../packages/triangle-core/src";
import {
  example as algebraExample,
  renderSvg as algebraSvg,
} from "../../packages/algebra-grid-core/src";

export interface GalleryExample<T> {
  id: string;
  title: string;
  description: string;
  alt?: string;
  sourceHref?: string;
  make: (worked: boolean) => T;
  render: (resource: T) => string;
  worked?: boolean;
  workedReason?: string;
  workedLabel?: string;
  openLabel?: string;
}
const source = (id: string) =>
  `https://mathsdock.co.uk/question-bank?question=${id}`;
export const graphGallery = graphExamples.map((example) => ({
  id: `graph-${example.id}`,
  title: example.title,
  description: example.description,
  sourceHref: sourceQuestionHref(example.id),
  make: example.create,
  render: renderDiagramSvg,
  openLabel: "Open blank grid",
}));
export const ratioGallery = ratioExamples.map((example) => ({
  id: `ratio-${example.id}`,
  title: example.title,
  description: example.description,
  sourceHref: sourceQuestionHref(example.id),
  make: example.create,
  render: (resource: ReturnType<typeof example.create>) =>
    renderRatioSvg(resource.document),
}));
// Retain the three original generic examples as well as the verified source cards.
export function ratioTeachingExample(kind: "simple" | "worked" | "fraction") {
  const values =
    kind === "simple"
      ? [
          ["4", "8"],
          ["1", null],
        ]
      : kind === "worked"
        ? [
            ["2", "4"],
            ["1", "2"],
          ]
        : [
            ["3", "2"],
            ["1", null],
          ];
  return createRatioTable({
    schemaVersion: 1,
    rows: values.map((pair, i) => ({
      id: `row-${i + 1}`,
      cells: pair.map((value) =>
        value === null
          ? { kind: "answer-line" as const }
          : { kind: "number" as const, value },
      ),
    })),
    mode: kind === "simple" ? "simple" : "annotated",
    transitions:
      kind === "simple"
        ? []
        : [
            {
              from: "row-1",
              to: "row-2",
              operation: "divide",
              factor: kind === "worked" ? "2" : "3",
            },
          ],
  });
}
export const ratioTeachingGallery = (
  ["simple", "worked", "fraction"] as const
).map((kind) => ({
  id: `ratio-${kind}`,
  title:
    kind === "simple"
      ? "Simple table"
      : kind === "worked"
        ? "Worked scaling step"
        : "Fraction scaffold",
  description:
    "Editable lesson table. Change values and scaling annotations independently.",
  make: () => ratioTeachingExample(kind),
  render: (resource: ReturnType<typeof ratioTeachingExample>) =>
    renderRatioSvg(resource.document),
  worked: kind === "worked",
  openLabel: kind === "worked" ? "Open diagram" : "Open scaffold",
}));
export const quadraticGallery = [
  ...quadraticSources.map((example) => ({
    id: `quadratic-${example.id}`,
    title: example.source,
    description: example.description,
    sourceHref: source(example.id),
    make: (worked: boolean) =>
      worked ? workedQuadraticExample(example.name) : preset(example.name),
    render: quadraticSvg,
  })),
  {
    id: "quadratic-fractions",
    title: "Fractions",
    description:
      "Exact-fraction teaching example. The supplied value stays visible and other cells remain blank.",
    make: (worked: boolean) =>
      worked ? workedQuadraticExample("Fractions") : preset("Fractions"),
    render: quadraticSvg,
  },
];
export const cuboidGallery = cuboids.map((example) => ({
  id: `cuboid-${example.id}`,
  title: example.title,
  description: example.description,
  sourceHref: example.source ? source(example.id) : undefined,
  make: (worked: boolean) => upgradeCuboid(example.create(worked)),
  render: (resource: ReturnType<typeof example.create>) =>
    cuboidLayout(resource).svg,
}));
export const numberLineGallery = lines.map((example, i) => ({
  id: `number-line-${i}`,
  title: example.title,
  description:
    `${i === 8 ? "Intentional teaching error: " : ""}${example.prompt} ${example.adaptation ?? ""}`.trim(),
  sourceHref: source(example.id),
  make: (worked: boolean) => lineExample(i, worked),
  render: lineSvg,
}));
export const vennGallery = [
  ...vennTeaching.filter((example) => example.id !== "reverse-nested"),
  ...venn,
].map((example) => ({
  id: `venn-${example.id}`,
  title: example.title,
  description: example.note,
  sourceHref: example.url,
  make: example.make,
  render: vennSvg,
}));
export const triangleGallery = [...triangleTeaching, ...triangles].map(
  (example) => {
    const worked = allLabels(example.build()).some((item) => item.label.answer);
    return {
      id: `triangle-${example.key}`,
      title: example.title,
      description: example.description,
      sourceHref: example.sourceId ? source(example.sourceId) : undefined,
      make: (show: boolean) =>
        show ? triangleWorked(example.build()) : example.build(),
      render: triangleSvg,
      worked,
    };
  },
);
const algebraNames = [
  ["single", "Single bracket"],
  ["double", "Double brackets"],
  ["signed", "Negative terms"],
  ["cubic", "Three terms × two terms"],
  ["factor", "Factorise x²+5x+6"],
  ["negative", "Factorise x²+3x−10"],
  ["common", "Common factor"],
  ["source-expand", "Q26(a): expand"],
  ["source-factor", "Q26(b): factorise"],
];
export const algebraGallery = algebraNames.map(([name, title]) => ({
  id: `algebra-${name}`,
  title,
  description: name.startsWith("source-")
    ? "Adapted grid step from November 2018 2F Q26. The original question has no grid."
    : "Pupil writing cells stay blank until an explicit calculation. Choose a worked version to reveal the completed resource.",
  sourceHref: name.startsWith("source-")
    ? source("1MA1_NOV_2018_2F_Q26")
    : undefined,
  make: (worked: boolean) => algebraExample(name, worked),
  render: algebraSvg,
}));

export const barGallery: GalleryExample<bar.Envelope>[] = bar.exampleNames.map(id=>({id:'bar-'+id,title:id+' '+({BM01:'Known total 64, ratio3:5',BM02:'Known share24, ratio3:5',BM03:'Known difference16',BM04:'Three shares2:3:4',BM05:'Three eighths of400',BM06:'Five units and three units',BM07:'Algebra: three units are x',BM08:'Fractions, zero and hidden answers',BM09:'Maximum parts and useful print size',H07:'Summer2024 1H Q7: jars',H18:'Summer2024 3H Q10: algebra shares','source-sharing':'Mock set7 1H Q1: £60 in3:2:5'}[id]),description:id==='H07'?'Adapted sharing stage only: fifteen units represent150 empty jars, in ratio3:4:8. Use BM05 for the preceding fraction stage. The final percentage uses a ratio table. This2024 source is retained locally and is not in the published bank.':id==='H18'?'Adapted bag A only: red x represents the entire three-unit share. The eight-unit bag is8x/3. This2024 source is retained locally and is not in the published bank.':'Editable teaching fixture. Saved answers remain hidden in the scaffold.',sourceHref:id==='source-sharing'?source('1MA1_MOCK_SET_07_1H_Q1'):undefined,make:(worked)=>bar.example(id,worked),render:bar.renderSvg,worked:!['BM06','BM08','BM09'].includes(id)}));
