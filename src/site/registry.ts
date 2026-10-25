import BarModelPage from "../bar-model/BarModelRoute";
import barPreview from "../assets/tool-previews/bar-model.svg";
import VennPage from "../venn/VennPage";
import TrianglePage from "../triangle/TrianglePage";
import AlgebraGridPage from "../algebra-grid/AlgebraGridPage";
import algebraPreview from "../assets/tool-previews/expanding-factorising.svg";
import trianglePreview from "../assets/tool-previews/triangles.svg";
import vennPreview from "../assets/tool-previews/venn.svg";
import NumberLinePage from "../number-line/NumberLinePage";
import numberLinePreview from "../assets/tool-previews/number-lines.svg";
import GraphPage from "../App";
import RatioTablePage from "../ratio-table/RatioTablePage";
import ValueGraphPage from "../value-graph/ValueGraphPage";
import CuboidPage from "../cuboid/CuboidPage";
import { BookOpen, FileSpreadsheet, Grid3X3, ListChecks, Shapes, Table2, Box, MoveHorizontal, Triangle } from "lucide-react";
import cuboidPreview from "../assets/tool-previews/cuboids.svg";
import graphPreview from "../assets/tool-previews/graph-tool.svg";
import ratioPreview from "../assets/tool-previews/ratio-tables.svg";
import valueGraphPreview from "../assets/tool-previews/table-of-values-and-graphs.svg";

/** Add booklet editors here; the overview, navigation and page host share this list. */
export const bookletTools = [
  { id:"bar-model",name:"Bar modelling",description:"Create linked bars with equal units, sharing and anchored braces.",icon:Table2,component:BarModelPage,preview:{src:barPreview,alt:"Two unequal parts labelled b and c, a whole labelled a, and two manually entered equations."}},
  { id: "expanding-factorising", name: "Expanding and factorising", description: "Make multiplication grids with blank writing cells for expanding and factorising.", icon: Table2, component: AlgebraGridPage, preview: { src: algebraPreview, alt: "Multiplication grid with x and signed number headings and blank product cells for pupil working." } },
  { id: "triangle", name: "Triangles", description: "Create triangle diagrams for Pythagoras, trigonometry, sine rule, cosine rule and area.", icon: Triangle, component: TrianglePage, preview: { src: trianglePreview, alt: "Right-angled triangle with 6 cm and 8 cm sides and an unknown hypotenuse labelled x." } },
  { id: "venn", name: "Venn diagrams", description: "Build blank, populated and shaded diagrams with one, two or three sets.", icon: Shapes, component: VennPage, preview: { src: vennPreview, alt: "Two overlapping sets with member lists, an intersection and a pupil answer line." } },
  { id: "graph", name: "Graph tool", description: "Draw points, segments and lines on a 1 cm coordinate grid.", icon: Grid3X3, component: GraphPage, preview: { src: graphPreview, alt: "Example coordinate grid with a straight line and three plotted points." } },
  { id: "ratio-table", name: "Ratio tables", description: "Build tables with values, answer spaces and scaling arrows.", icon: Table2, component: RatioTablePage, preview: { src: ratioPreview, alt: "Example ratio table with multiplication arrows and a blank answer space." } },
  { id: "value-table-graph", name: "Plotting quadratics", description: "Make exam-style tables, graph paper and quadratic plotting examples.", icon: Grid3X3, component: ValueGraphPage, preview: { src: valueGraphPreview, alt: "Example table of values with plotted points and a quadratic curve." } },
  { id: "cuboids", name: "Cuboids", description: "Draw and label cuboids, show their cubes, and reveal each layer.", icon: Box, component: CuboidPage, preview: { src: cuboidPreview, alt: "Cuboid divided into equal cubes, with two dimensions labelled and one answer space." } },
  { id: "number-line", name: "Number lines", description: "Make exam-style number lines, intervals and inequality scaffolds.", icon: MoveHorizontal, component: NumberLinePage, preview: { src: numberLinePreview, alt: "Number line with a filled endpoint at minus three, open endpoint at one and a blank response line." } },
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
  if (!id) return "home";
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
