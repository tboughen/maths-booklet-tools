// Every tool whose editable file the gates load: its examples, validator and file parser, and
// its link codec where it has one. Shared by the teaching-state gate and the saved-file corpus.
import * as graph from "../../packages/graph-core/src/interchange";
import * as ratio from "../../packages/ratio-table-core/src/interchange";
import { graphGallery, ratioGallery, ratioTeachingGallery } from "../examples/galleryCatalogue";
import * as algebraGrid from "../../packages/algebra-grid-core/src/index";
import { exampleNames as algebraGridExamples } from "../../packages/algebra-grid-core/src/interchange";
import * as barModel from "../../packages/bar-model-core/src/index";
import * as barModelVersioned from "../../packages/bar-model-core/src/versioned";
import { lessonExample, lessonExampleNames } from "../../packages/bar-model-core/src/lesson-examples-v3";
import * as cuboid from "../../packages/cuboid-core/src/index";
import { examples as cuboidExamples } from "../../packages/cuboid-core/src/examples";
import * as numberLine from "../../packages/number-line-core/src/index";
import { examples as numberLineExamples, example as numberLineExample } from "../../packages/number-line-core/src/examples";
import * as triangle from "../../packages/triangle-core/src/index";
import { examples as triangleExamples } from "../../packages/triangle-core/src/examples";
import * as venn from "../../packages/venn-core/src/index";
import { examples as vennExamples, teachingExamples as vennTeaching } from "../../packages/venn-core/src/examples";
import * as valueGraph from "../../packages/value-graph-core/src/interchange";
import { quadraticSources, workedQuadraticExample } from "../value-graph/examples";

import * as chart from "../../packages/chart-core/src/index";
import { examples as chartExamples } from "../../packages/chart-core/src/examples";
import * as tree from "../../packages/probability-tree-core/src/index";
import { examples as treeExamples } from "../../packages/probability-tree-core/src/examples";
import * as frequencyTree from "../../packages/frequency-tree-core/src/index";
import { examples as frequencyTreeExamples } from "../../packages/frequency-tree-core/src/examples";
import * as twoWayTable from "../../packages/two-way-table-core/src/index";
import { examples as twoWayTableExamples } from "../../packages/two-way-table-core/src/examples";

export type Tool = {
  name: string;
  envelopes: () => unknown[];
  validate: (raw: unknown) => unknown;
  parseFile: (text: string) => unknown;
  link?: { encode: (e: never) => string; decode: (s: string) => unknown };
  /** False for a tool whose saved files hold no teaching slots (blanks, hidden answers, lines). */
  teachingSlots?: false;
};

export const tools: Tool[] = [
  { name: "graph", envelopes: () => graphGallery.flatMap(x => [x.make(false), x.make(true)]).map(d => graph.createEnvelope(d as never)), validate: (raw: unknown) => graph.validateEnvelope(raw), parseFile: graph.parseGraphFile, link: { encode: graph.encodeEnvelope, decode: graph.decodeEnvelope }, teachingSlots: false },
  { name: "ratio table", envelopes: () => [...ratioGallery, ...ratioTeachingGallery].flatMap(x => [x.make(false), x.make(true)]), validate: ratio.validateRatioEnvelope, parseFile: ratio.parseRatioFile, link: { encode: ratio.encodeRatio, decode: ratio.decodeRatio } },
  { name: "algebra grid", envelopes: () => algebraGridExamples.flatMap(n => [algebraGrid.example(n), algebraGrid.example(n, true)]), validate: algebraGrid.validate, parseFile: algebraGrid.parseFile },
  { name: "bar model v1", envelopes: () => barModel.exampleNames.flatMap(n => [barModel.example(n), barModel.example(n, true)]), validate: barModel.validate, parseFile: barModel.parseFile },
  { name: "bar model v3", envelopes: () => lessonExampleNames.flatMap(n => [lessonExample(n), lessonExample(n, true)]), validate: (raw: unknown) => barModelVersioned.parseFile(JSON.stringify(raw)), parseFile: barModelVersioned.parseFile },
  { name: "charts", envelopes: () => chartExamples.flatMap(x => [x.make(false), x.make(true)]), validate: chart.validate, parseFile: chart.parseFile },
  { name: "cuboids", envelopes: () => cuboidExamples.flatMap(x => [x.create(false), x.create(true)]), validate: cuboid.validate, parseFile: cuboid.parseFile, link: { encode: cuboid.encode, decode: cuboid.decode } },
  { name: "number line", envelopes: () => numberLineExamples.flatMap((_, i) => [numberLineExample(i), numberLineExample(i, true)]), validate: numberLine.validate, parseFile: numberLine.parseFile, link: { encode: numberLine.encode, decode: numberLine.decode } },
  { name: "probability trees", envelopes: () => treeExamples.flatMap(x => [x.make(false), x.make(true)]), validate: tree.validate, parseFile: tree.parseFile },
  { name: "frequency trees", envelopes: () => frequencyTreeExamples.flatMap(x => [x.make(false), x.make(true)]), validate: frequencyTree.validate, parseFile: frequencyTree.parseFile, link: { encode: frequencyTree.linkHash, decode: frequencyTree.decodeLinkHash } },
  { name: "two-way tables", envelopes: () => twoWayTableExamples.flatMap(x => [x.make(false), x.make(true)]), validate: twoWayTable.validate, parseFile: twoWayTable.parseFile, link: { encode: twoWayTable.linkHash, decode: twoWayTable.decodeLinkHash } },
  { name: "triangles", envelopes: () => triangleExamples.map(x => x.build()), validate: triangle.validate, parseFile: triangle.parseFile },
  { name: "venn", envelopes: () => [...vennExamples, ...vennTeaching].flatMap(x => [x.make(false), x.make(true)]), validate: venn.validate, parseFile: venn.parseFile },
  { name: "plotting quadratics", envelopes: () => quadraticSources.flatMap(x => [valueGraph.preset(x.name), workedQuadraticExample(x.name)]), validate: (raw: unknown) => valueGraph.parseFile(JSON.stringify(raw)), parseFile: valueGraph.parseFile, link: { encode: valueGraph.encode, decode: valueGraph.decode } },
];
