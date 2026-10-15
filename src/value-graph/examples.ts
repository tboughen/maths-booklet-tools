import {
  apply,
  preset,
  tableDomain,
} from "../../packages/value-graph-core/src/interchange";

/** Verified against the published question images and complete official scheme rows. */
export const quadraticSources = [
  {
    name: "June 2018",
    id: "1MA1_JUN_2018_2H_Q5",
    source: "June 2018 · Higher 2 · Q5(a–b)",
    description:
      "Complete and plot y = x² − x − 6. The scaffold retains the two supplied values and all pupil blanks.",
  },
  {
    name: "November 2018",
    id: "1MA1_NOV_2018_3H_Q3",
    source: "November 2018 · Higher 3 · Q3(a–b)",
    description:
      "Complete and plot y = x² + x − 4 with different x/y grid scales. Supplied values and pupil blanks are retained.",
  },
  {
    name: "November 2021",
    id: "1MA1_NOV_2021_2H_Q4",
    source: "November 2021 · Higher 2 · Q4(a–b)",
    description:
      "Complete and plot y = x² − 2x + 2. The source's given values remain; calculation and plotting are explicit choices.",
  },
  {
    name: "November 2017 error",
    id: "1MA1_NOV_2017_1H_Q7",
    source: "November 2017 · Higher 1 · Q7",
    description:
      "Intentional teaching error: correct points for y = x² + 1 are joined with straight segments. The corrected copy uses a smooth curve.",
    intentional: true,
  },
  {
    name: "Mock set 08",
    id: "1MA1_MOCK_SET_08_1H_Q13",
    source: "Mock set 08 · Higher 1 · Q13(a–b)",
    description:
      "Complete and plot y = 2x² + 4x + 1 for −3 ≤ x ≤ 2. The source's supplied values and blanks are retained.",
  },
] as const;

export function workedQuadraticExample(name: string) {
  const e = preset(name),
    ids = e.document.columns.map((c) => c.id);
  return apply(e, [
    { op: "calculate_cells", columnIds: ids, overwrite: true },
    {
      op: "plot_series",
      id: "points",
      source: "table",
      columnIds: ids,
      connection: "none",
    },
    {
      op: "set_curve",
      curve: {
        id: "quadratic",
        equation: e.document.equation,
        ...tableDomain(e.document.columns),
      },
    },
  ]);
}
