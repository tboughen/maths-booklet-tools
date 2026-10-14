import GraphPage from "../App";
import RatioTablePage from "../ratio-table/RatioTablePage";
import ValueGraphPage from "../value-graph/ValueGraphPage";
import { Grid3X3, Table2 } from "lucide-react";
import graphPreview from "../assets/tool-previews/graph-tool.svg";
import ratioPreview from "../assets/tool-previews/ratio-tables.svg";
import valueGraphPreview from "../assets/tool-previews/table-of-values-and-graphs.svg";

/** Add booklet editors here; the overview, navigation and page host share this list. */
export const bookletTools = [
  { id: "graph", name: "Graph tool", description: "Draw points, segments and lines on a 1 cm coordinate grid.", icon: Grid3X3, component: GraphPage, preview: { src: graphPreview, alt: "Example coordinate grid with a straight line and three plotted points." } },
  { id: "ratio-table", name: "Ratio tables", description: "Build tables with values, answer spaces and scaling arrows.", icon: Table2, component: RatioTablePage, preview: { src: ratioPreview, alt: "Example ratio table with multiplication arrows and a blank answer space." } },
  { id: "value-table-graph", name: "Plotting quadratics", description: "Make exam-style tables, graph paper and quadratic plotting examples.", icon: Grid3X3, component: ValueGraphPage, preview: { src: valueGraphPreview, alt: "Example table of values with plotted points and a quadratic curve." } },
] as const;

export type ToolId = typeof bookletTools[number]["id"];
export type PageId = ToolId | "home" | "booklet-tools" | "question-bank";
export const pageHref = (id: PageId) => `?tool=${id}`;
export function readPage(search: string): PageId {
  const id = new URLSearchParams(search).get("tool");
  if (!id) return "home";
  if (id === "home" || id === "booklet-tools" || id === "question-bank") return id;
  return bookletTools.find(tool => tool.id === id)?.id ?? "graph";
}
export function pageName(id: PageId): string {
  if (id === "home") return "Home";
  if (id === "booklet-tools") return "Booklet tools";
  if (id === "question-bank") return "Question bank";
  return bookletTools.find(tool => tool.id === id)!.name;
}
