/**
 * Test and script helper: many acceptance tests were written against the old per-family tool
 * names (create_bar_model, revise_venn, triangle_capabilities...). This translates such a call to
 * the generic diagram tools so the tests keep checking the same behaviour. The service itself
 * has no per-family tools any more.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { DiagramKind } from "../../packages/diagram-core/src/registry";

export const FAMILY_NAMES: Record<string, DiagramKind> = {
  graph: "graph",
  ratio_table: "ratio-table",
  value_graph: "value-graph",
  cuboid: "cuboids",
  number_line: "number-line",
  venn: "venn",
  algebra_grid: "algebra-grid",
  bar_model: "bar-model",
  chart: "charts",
  probability_tree: "probability-tree",
  triangle: "triangle",
};
/** Families whose old create tool took the spec fields at the top level. */
const FLAT = new Set<DiagramKind>(["graph", "ratio-table"]);

export function genericCall(name: string, args: Record<string, unknown> = {}): { name: string; arguments: Record<string, unknown> } {
  let m = name.match(/^(create|revise)_(.+)$/);
  if (m && FAMILY_NAMES[m[2]]) {
    const kind = FAMILY_NAMES[m[2]];
    if (m[1] === "revise") return { name: "revise_diagram", arguments: { kind, ...args } };
    if (FLAT.has(kind)) {
      const { envelope, ...spec } = args;
      return { name: "create_diagram", arguments: { kind, ...(envelope !== undefined ? { envelope } : {}), ...(Object.keys(spec).length ? { spec } : {}) } };
    }
    return { name: "create_diagram", arguments: { kind, ...args } };
  }
  m = name.match(/^(.+)_capabilities$/);
  if (m && FAMILY_NAMES[m[1]]) return { name: "diagram_capabilities", arguments: { kind: FAMILY_NAMES[m[1]] } };
  return { name, arguments: args };
}

/** Makes client.callTool accept the old family tool names. */
export function withFamilyNames<C extends Client>(client: C): C {
  const call = client.callTool.bind(client);
  client.callTool = ((params: { name: string; arguments?: Record<string, unknown> }, ...rest: unknown[]) =>
    call({ ...params, ...genericCall(params.name, params.arguments) }, ...(rest as []))) as C["callTool"];
  return client;
}
