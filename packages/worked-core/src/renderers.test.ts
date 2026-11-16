import { describe, expect, it } from "vitest";
import { DIAGRAM_FAMILIES, diagramSvg, type DiagramFamily } from "./index";
import { examples as angles } from "../../angle-core/src/examples";
import { examples as area } from "../../area-core/src/examples";
import { examples as venn } from "../../venn-core/src/examples";
import { examples as probabilityTree } from "../../probability-tree-core/src/examples";
import { examples as frequencyTree } from "../../frequency-tree-core/src/examples";
import { examples as twoWay } from "../../two-way-table-core/src/examples";
import { examples as sampleSpace } from "../../sample-space-core/src/examples";
import { examples as chart } from "../../chart-core/src/examples";
import { examples as construction } from "../../construction-core/src/examples";
import { examples as cuboid } from "../../cuboid-core/src/examples";
import { examples as elevations } from "../../elevation-core/src/examples";
import { examples as triangle } from "../../triangle-core/src/examples";
import { example as barModel, exampleNames } from "../../bar-model-core/src/examples";
import { examples as functionMachine } from "../../function-machine-core/src/examples";
import { examples as bubbleMethod } from "../../bubble-method-core/src/examples";
import { examples as writtenMethod } from "../../written-method-core/src/examples";
import { create as valueGraph } from "../../value-graph-core/src/interchange";
import { createGraph } from "../../graph-core/src/interchange";
import { create as algebraGrid } from "../../algebra-grid-core/src/index";
import { create as numberLine } from "../../number-line-core/src/index";
import { create as factorTree } from "../../factor-tree-core/src/index";
import { createRatioTable } from "../../ratio-table-core/src/interchange";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const first = (list: any[]) => { const e = list[0]; for (const f of ["make", "create", "build"]) if (typeof e[f] === "function") return e[f](false); return e.envelope ?? e; };

const samples: Partial<Record<DiagramFamily, () => unknown>> = {
  "angles": () => first(angles), "area": () => first(area), "venn": () => first(venn),
  "probability-tree": () => first(probabilityTree), "frequency-tree": () => first(frequencyTree),
  "two-way-table": () => first(twoWay), "sample-space": () => first(sampleSpace), "chart": () => first(chart),
  "construction": () => first(construction), "cuboid": () => first(cuboid), "elevations": () => first(elevations),
  "triangle": () => first(triangle), "bar-model": () => barModel(exampleNames[0]),
  "value-graph": () => valueGraph(),
  "function-machine": () => functionMachine[0].make(true), "bubble-method": () => bubbleMethod[0].make(true), "written-method": () => first(writtenMethod), "graph": () => createGraph({ objects: [{ kind: "point", position: { x: 1, y: 2 } }] }),
};

describe("every MathsDock renderer draws inside worked solutions", () => {
  for (const family of DIAGRAM_FAMILIES) it(family, () => {
    const make = samples[family];
    if (!make) return; // covered by the pilot tests
    const d = diagramSvg(family, make());
    expect(d.width).toBeGreaterThan(20);
    expect(d.height).toBeGreaterThan(10);
    expect(d.svg).toMatch(/^<svg viewBox="[^"]+" overflow="visible">/);
  });
});
void algebraGrid; void numberLine; void factorTree; void createRatioTable;
