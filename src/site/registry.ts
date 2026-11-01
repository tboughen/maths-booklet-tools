import { lazyPage } from "./lazyPage";
import { pageHref, readPage, type PageId, type ToolId } from "./routes";
import barPreview from "../assets/tool-previews/bar-model.svg";
import algebraPreview from "../assets/tool-previews/expanding-factorising.svg";
import trianglePreview from "../assets/tool-previews/triangles.svg";
import vennPreview from "../assets/tool-previews/venn.svg";
import numberLinePreview from "../assets/tool-previews/number-lines.svg";
import { BookOpen, ChartSpline, Columns3, FileSpreadsheet, Grid2x2, Grid3X3, ListChecks, Shapes, Table2, Box, MoveHorizontal, Triangle } from "lucide-react";
import cuboidPreview from "../assets/tool-previews/cuboids.svg";
import graphPreview from "../assets/tool-previews/graph-tool.svg";
import ratioPreview from "../assets/tool-previews/ratio-tables.svg";
import valueGraphPreview from "../assets/tool-previews/table-of-values-and-graphs.svg";

/** Add booklet editors here; the overview, navigation and page host share this list.
 * Each editor is lazy-loaded so it ships as its own bundle and downloads on first visit. */
export const bookletTools = [
  { id:"bar-model",name:"Bar modelling",description:"Create linked bars with equal units, sharing and anchored braces.",icon:Columns3,component:lazyPage(() => import("../bar-model/BarModelRoute")),preview:{src:barPreview,alt:"Two unequal parts labelled b and c, a whole labelled a, and two manually entered equations."}},
  { id: "expanding-factorising", name: "Expanding and factorising", description: "Make multiplication grids with blank writing cells for expanding and factorising.", icon: Grid2x2, component: lazyPage(() => import("../algebra-grid/AlgebraGridPage")), preview: { src: algebraPreview, alt: "Multiplication grid with x and signed number headings and blank product cells for pupil working." } },
  { id: "triangle", name: "Triangles", description: "Create triangle diagrams for Pythagoras, trigonometry, sine rule, cosine rule and area.", icon: Triangle, component: lazyPage(() => import("../triangle/TrianglePage")), preview: { src: trianglePreview, alt: "Right-angled triangle with 6 cm and 8 cm sides and an unknown hypotenuse labelled x." } },
  { id: "venn", name: "Venn diagrams", description: "Build blank, populated and shaded diagrams with one, two or three sets.", icon: Shapes, component: lazyPage(() => import("../venn/VennPage")), preview: { src: vennPreview, alt: "Two overlapping sets with member lists, an intersection and a pupil answer line." } },
  { id: "graph", name: "Graph tool", description: "Draw points, segments and lines on a 1 cm coordinate grid.", icon: Grid3X3, component: lazyPage(() => import("../App")), preview: { src: graphPreview, alt: "Example coordinate grid with a straight line and three plotted points." } },
  { id: "ratio-table", name: "Ratio tables", description: "Build tables with values, answer spaces and scaling arrows.", icon: Table2, component: lazyPage(() => import("../ratio-table/RatioTablePage")), preview: { src: ratioPreview, alt: "Example ratio table with multiplication arrows and a blank answer space." } },
  { id: "value-table-graph", name: "Plotting quadratics", description: "Make exam-style tables, graph paper and quadratic plotting examples.", icon: ChartSpline, component: lazyPage(() => import("../value-graph/ValueGraphPage")), preview: { src: valueGraphPreview, alt: "Example table of values with plotted points and a quadratic curve." } },
  { id: "cuboids", name: "Cuboids", description: "Draw and label cuboids, show their cubes, and reveal each layer.", icon: Box, component: lazyPage(() => import("../cuboid/CuboidPage")), preview: { src: cuboidPreview, alt: "Cuboid divided into equal cubes, with two dimensions labelled and one answer space." } },
  { id: "number-line", name: "Number lines", description: "Make exam-style number lines, intervals and inequality scaffolds.", icon: MoveHorizontal, component: lazyPage(() => import("../number-line/NumberLinePage")), preview: { src: numberLinePreview, alt: "Number line with a filled endpoint at minus three, open endpoint at one and a blank response line." } },
] as const;

/** Site pages outside the booklet tools, loaded the same way. */
export const QuestionBank = lazyPage(() => import("../bank/QuestionBank"));
export const AssessmentPage = lazyPage(() => import("../assessment/AssessmentPage"));
export { pageHref, readPage, type LinkPageId, type PageId, type ToolId } from "./routes";
// Each tool needs a path; this fails to compile if the two lists drift apart.
type RegistryTool = typeof bookletTools[number]["id"];
const _toolsHavePaths: [RegistryTool] extends [ToolId] ? ([ToolId] extends [RegistryTool] ? true : never) : never = true;
void _toolsHavePaths;
/** Home and the main navigation describe the same teacher destinations. */
export const siteSections = [
  { id: "question-bank", name: "Question bank", href: pageHref("question-bank"), icon: BookOpen, description: "Find reviewed exam questions by topic, display them in class and export question papers with mark schemes.", action: "Open Question bank" },
  { id: "paper-builder", name: "Paper builder", href: `${pageHref("question-bank")}?bankView=topics`, icon: ListChecks, description: "Tick Sparx codes, review your questions and download a paper with its mark scheme.", action: "Build a paper" },
  { id: "assessment-follow-up", name: "Assessment follow-up", href: pageHref("assessment-follow-up"), icon: FileSpreadsheet, description: "Turn question-level assessment results into personalised practice for each pupil.", action: "Create class practice" },
  { id: "booklet-tools", name: "Booklet tools", href: pageHref("booklet-tools"), icon: Shapes, description: "Create graphs, ratio tables and diagrams for your teaching resources.", action: "Explore booklet tools" },
] as const;
export type SectionId = PageId | "paper-builder";
export function readSection(where: { pathname: string; search: string } = location): SectionId {
  const page = readPage(where);
  return page === "question-bank" && new URLSearchParams(where.search).get("bankView") === "topics" ? "paper-builder" : page;
}
export function sectionName(section: SectionId): string {
  return section === "paper-builder" ? "Paper builder" : pageName(section);
}
export function pageName(id: PageId): string {
  if (id === "home") return "Home";
  if (id === "booklet-tools") return "Booklet tools";
  if (id === "question-bank") return "Question bank";
  if (id === "assessment-follow-up") return "Assessment follow-up";
  if (id === "not-found") return "Page not found";
  return bookletTools.find(tool => tool.id === id)!.name;
}
/** Starts downloading a page's code; the first page is loaded before the site renders. */
export function preloadPage(id: PageId) {
  if (id === "question-bank") return QuestionBank.preload();
  if (id === "assessment-follow-up") return AssessmentPage.preload();
  return bookletTools.find((tool) => tool.id === id)?.component.preload();
}
