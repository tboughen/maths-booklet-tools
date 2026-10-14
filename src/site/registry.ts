import GraphPage from "../App";
import RatioTablePage from "../ratio-table/RatioTablePage";
import ValueGraphPage from "../value-graph/ValueGraphPage";
import { BookOpen, FileSpreadsheet, Grid3X3, ListChecks, Shapes, Table2 } from "lucide-react";

/** Add booklet editors here; the overview, navigation and page host share this list. */
export const bookletTools = [
  { id: "graph", name: "Graph tool", description: "Draw points, segments and lines on a 1 cm coordinate grid.", icon: Grid3X3, component: GraphPage },
  { id: "ratio-table", name: "Ratio tables", description: "Build tables with values, answer spaces and scaling arrows.", icon: Table2, component: RatioTablePage },
  { id: "value-table-graph", name: "Plotting quadratics", description: "Make exam-style tables, graph paper and quadratic plotting examples.", icon: Grid3X3, component: ValueGraphPage },
] as const;

export type ToolId = typeof bookletTools[number]["id"];
export type PageId = ToolId | "home" | "booklet-tools" | "question-bank" | "assessment-follow-up";
export const pageHref = (id: PageId) => `?tool=${id}`;
/** Home and the main navigation describe the same teacher destinations. */
export const siteSections = [
  { id: "question-bank", name: "Question bank", href: pageHref("question-bank"), icon: BookOpen, description: "Find reviewed exam questions by topic, display them in class and export question papers with mark schemes.", action: "Open Question bank" },
  { id: "paper-builder", name: "Paper builder", href: `${pageHref("question-bank")}&bankView=topics`, icon: ListChecks, description: "Tick Sparx codes, review your questions and download a paper with its mark scheme.", action: "Build a paper" },
  { id: "assessment-follow-up", name: "Assessment follow-up", href: pageHref("assessment-follow-up"), icon: FileSpreadsheet, description: "Turn question-level assessment results into personalised practice for each pupil.", action: "Create class practice" },
  { id: "booklet-tools", name: "Booklet tools", href: pageHref("booklet-tools"), icon: Shapes, description: "Create graphs, ratio tables and diagrams for your teaching resources.", action: "Explore booklet tools" },
] as const;
export type SectionId = PageId | "paper-builder";
export function readSection(search: string): SectionId {
  const page = readPage(search);
  return page === "question-bank" && new URLSearchParams(search).get("bankView") === "topics" ? "paper-builder" : page;
}
export function sectionName(section: SectionId): string {
  return section === "paper-builder" ? "Paper builder" : pageName(section);
}
export function readPage(search: string): PageId {
  const id = new URLSearchParams(search).get("tool");
  if (id === "home" || id === "booklet-tools" || id === "question-bank" || id === "assessment-follow-up") return id;
  return bookletTools.find(tool => tool.id === id)?.id ?? "graph";
}
export function pageName(id: PageId): string {
  if (id === "home") return "Home";
  if (id === "booklet-tools") return "Booklet tools";
  if (id === "question-bank") return "Question bank";
  if (id === "assessment-follow-up") return "Assessment follow-up";
  return bookletTools.find(tool => tool.id === id)!.name;
}
