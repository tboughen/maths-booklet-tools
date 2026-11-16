import { lazyPage } from "./lazyPage";
import { toolPage } from "./toolPage";
import { pageHref, readPage, type PageId, type ToolId } from "./routes";
import barPreview from "../assets/tool-previews/bar-model.svg";
import algebraPreview from "../assets/tool-previews/expanding-factorising.svg";
import trianglePreview from "../assets/tool-previews/triangles.svg";
import vennPreview from "../assets/tool-previews/venn.svg";
import numberLinePreview from "../assets/tool-previews/number-lines.svg";
import { AnglesIcon, AreaIcon, AssessmentIcon, BarModelIcon, BookletBuilderIcon, ChartsIcon, ConstructionIcon, CuboidsIcon, DiagramBuilderIcon, ElevationsIcon, ExpandingFactorisingIcon, FactorTreeIcon, FiguresIcon, WrittenMethodIcon, FunctionMachineIcon, BubbleMethodIcon, AlgebraTilesIcon, FrequencyTreeIcon, NetsIcon, GraphIcon, NumberLineIcon, PaperBuilderIcon, ProbabilityTreeIcon, QuestionBankIcon, RatioTableIcon, ProbabilityObjectsIcon, SampleSpaceIcon, TriangleIcon, TwoWayTableIcon, ValueTableGraphIcon, VennIcon, WorksheetBuilderIcon } from "./MathsDockIcons";
import cuboidPreview from "../assets/tool-previews/cuboids.svg";
import graphPreview from "../assets/tool-previews/graph-tool.svg";
import ratioPreview from "../assets/tool-previews/ratio-tables.svg";
import probabilityTreePreview from "../assets/tool-previews/probability-trees.svg";
import frequencyTreePreview from "../assets/tool-previews/frequency-trees.svg";
import twoWayTablePreview from "../assets/tool-previews/two-way-tables.svg";
import anglesPreview from "../assets/tool-previews/angle-diagrams.svg";
import areaPreview from "../assets/tool-previews/area-and-perimeter.svg";
import figuresPreview from "../assets/tool-previews/geometry-figures.svg";
import factorTreePreview from "../assets/tool-previews/factor-trees.svg";
import writtenMethodPreview from "../assets/tool-previews/written-methods.svg";
import functionMachinePreview from "../assets/tool-previews/function-machines.svg?no-inline";
import bubbleMethodPreview from "../assets/tool-previews/bubble-method.svg?no-inline";
import netsPreview from "../assets/tool-previews/nets.svg?no-inline";
import probabilityObjectsPreview from "../assets/tool-previews/spinners-dice-bags.svg?no-inline";
import algebraTilesPreview from "../assets/tool-previews/algebra-tiles.svg?no-inline";
import sampleSpacePreview from "../assets/tool-previews/sample-space-diagrams.svg";
import valueGraphPreview from "../assets/tool-previews/table-of-values-and-graphs.svg";
import chartsPreview from "../assets/tool-previews/charts.svg";
import constructionPreview from "../assets/tool-previews/constructions.svg?no-inline";
import elevationsPreview from "../assets/tool-previews/plans-and-elevations.svg";

/** Add booklet editors here; the overview, navigation and page host share this list.
 * Each editor is lazy-loaded so it ships as its own bundle and downloads on first visit. */
export const bookletTools = [
  { id:"bar-model",name:"Bar modelling",description:"Create linked bars with equal units, sharing and anchored braces.",icon: BarModelIcon,component:toolPage(() => import("../bar-model/BarModelRoute")),preview:{src:barPreview,alt:"Two unequal parts labelled b and c, a whole labelled a, and two manually entered equations."}},
  { id: "expanding-factorising", name: "Expanding and factorising", description: "Make multiplication grids with blank writing cells for expanding and factorising.", icon: ExpandingFactorisingIcon, component: toolPage(() => import("../algebra-grid/AlgebraGridPage")), preview: { src: algebraPreview, alt: "Multiplication grid with x and signed number headings and blank product cells for pupil working." } },
  { id: "triangle", name: "Triangles", description: "Create triangle diagrams for Pythagoras, trigonometry, sine rule, cosine rule and area.", icon: TriangleIcon, component: toolPage(() => import("../triangle/TrianglePage")), preview: { src: trianglePreview, alt: "Right-angled triangle with 6 cm and 8 cm sides and an unknown hypotenuse labelled x." } },
  { id: "venn", name: "Venn diagrams", description: "Build blank, populated and shaded diagrams with one, two or three sets.", icon: VennIcon, component: toolPage(() => import("../venn/VennPage")), preview: { src: vennPreview, alt: "Two overlapping sets with member lists, an intersection and a pupil answer line." } },
  { id: "graph", name: "Graph tool", description: "Draw points, segments and lines on a 1 cm coordinate grid.", icon: GraphIcon, component: toolPage(() => import("../App")), preview: { src: graphPreview, alt: "Example coordinate grid with a straight line and three plotted points." } },
  { id: "ratio-table", name: "Ratio tables", description: "Build tables with values, answer spaces and scaling arrows.", icon: RatioTableIcon, component: toolPage(() => import("../ratio-table/RatioTablePage")), preview: { src: ratioPreview, alt: "Example ratio table with multiplication arrows and a blank answer space." } },
  { id: "value-table-graph", name: "Plotting quadratics", description: "Make exam-style tables, graph paper and quadratic plotting examples.", icon: ValueTableGraphIcon, component: toolPage(() => import("../value-graph/ValueGraphPage")), preview: { src: valueGraphPreview, alt: "Example table of values with plotted points and a quadratic curve." } },
  { id: "cuboids", name: "Cuboids", description: "Draw and label cuboids, show their cubes, and reveal each layer.", icon: CuboidsIcon, component: toolPage(() => import("../cuboid/CuboidPage")), preview: { src: cuboidPreview, alt: "Cuboid divided into equal cubes, with two dimensions labelled and one answer space." } },
  { id: "number-line", name: "Number lines", description: "Make exam-style number lines, intervals and inequality scaffolds.", icon: NumberLineIcon, component: toolPage(() => import("../number-line/NumberLinePage")), preview: { src: numberLinePreview, alt: "Number line with a filled endpoint at minus three, open endpoint at one and a blank response line." } },
  { id: "charts", name: "Statistical charts", description: "Make bar, dual, composite and vertical line charts on exam-style axes, pie charts at true size, pictograms and scatter graphs.", icon: ChartsIcon, component: toolPage(() => import("../charts/ChartsPage")), preview: { src: chartsPreview, alt: "Dual bar chart of transport to school for boys and girls, with a key and one bar left for pupils to draw." } },
  { id: "probability-tree", name: "Probability trees", description: "Draw exam-style probability tree diagrams, including unequal trees and given-that questions.", icon: ProbabilityTreeIcon, component: toolPage(() => import("../probability-tree/ProbabilityTreePage")), preview: { src: probabilityTreePreview, alt: "Two-stage probability tree for two bags of red and green balls, with three probabilities left for pupils." } },
  { id: "frequency-tree", name: "Frequency trees", description: "Draw exam-style frequency trees with a total, groups and counts left for pupils.", icon: FrequencyTreeIcon, component: toolPage(() => import("../frequency-tree/FrequencyTreePage")), preview: { src: frequencyTreePreview, alt: "Frequency tree of 80 people split into men and women and whether they like coffee, with the women's counts left for pupils." } },
  { id: "construction", name: "Constructions and loci", description: "Draw true-size constructions, loci, scale drawings and bearings, with compass arcs saved as answers.", icon: ConstructionIcon, component: toolPage(() => import("../construction/ConstructionPage")), preview: { src: constructionPreview, alt: "Line AB with two pairs of compass arcs and its perpendicular bisector." } },
  { id: "elevations", name: "Plans and elevations", description: "Draw solids made of cubes on isometric paper with their plan, front and side elevations.", icon: ElevationsIcon, component: toolPage(() => import("../elevations/ElevationsPage")), preview: { src: elevationsPreview, alt: "Isometric drawing of a solid made of cubes, with empty grids for its plan, front elevation and side elevation." } },
  { id: "two-way-table", name: "Two-way tables", description: "Make exam-style two-way tables with totals, and cells left blank or hidden for pupils.", icon: TwoWayTableIcon, component: toolPage(() => import("../two-way-table/TwoWayTablePage")), preview: { src: twoWayTablePreview, alt: "Two-way table of how Year 7 and Year 8 travel to school, with five cells left for pupils." } },
  { id: "angles", name: "Angle diagrams", description: "Draw angles on straight lines, round a point, on parallel lines and in polygons, with sizes given or left for pupils.", icon: AnglesIcon, component: toolPage(() => import("../angles/AnglesPage")), preview: { src: anglesPreview, alt: "Two parallel lines with arrow marks cut by a transversal: one angle is 58° and two angles marked x and y are left for pupils." } },
  { id: "area", name: "Area and perimeter", description: "Draw compound shapes, triangles, trapeziums, circles, semicircles and sectors, with lengths given or left for pupils.", icon: AreaIcon, component: toolPage(() => import("../area/AreaPage")), preview: { src: areaPreview, alt: "An L-shaped compound shape with sides of 12 cm, 5 cm, 5 cm and 10 cm and two sides left for pupils." } },
  { id: "figures", name: "Geometry figures", description: "Draw circles with chords and tangents, similar and congruent shapes and figures for proofs, with lengths and angles given or left for pupils.", icon: FiguresIcon, component: toolPage(() => import("../figures/FiguresPage")), preview: { src: figuresPreview, alt: "A cyclic quadrilateral ABCD in a circle with the tangent SBT at B and angle ABD of 20°." } },
  { id: "factor-tree", name: "Factor trees", description: "Draw factor trees down to circled primes, with an index-form answer line and numbers left blank or hidden.", icon: FactorTreeIcon, FunctionMachineIcon, component: toolPage(() => import("../factor-tree/FactorTreePage")), preview: { src: factorTreePreview, alt: "Factor tree for 360 with the first split given and the rest left for pupils, above an answer line." } },
  { id: "written-method", name: "Written methods", description: "Set out column addition and subtraction, long multiplication and short or long division, with digits left blank or hidden.", icon: WrittenMethodIcon, component: toolPage(() => import("../written-method/WrittenMethodPage")), preview: { src: writtenMethodPreview, alt: "Long multiplication of 546 by 43 with the working left for pupils." } },
  { id: "function-machine", name: "Function machines", description: "Draw function machines with operations and values left blank or hidden for pupils, and their inverse machines.", icon: FunctionMachineIcon, component: toolPage(() => import("../function-machine/FunctionMachinePage")), preview: { src: functionMachinePreview, alt: "A number machine: 7 goes in, then multiply by 4 and add 3, with the value between the boxes and the output left for pupils." } },
  { id: "bubble-method", name: "Bubble method", description: "Set out equations, inequalities and changing the subject with the bubble method, with lines and bubbles left blank or hidden for pupils.", icon: BubbleMethodIcon, component: toolPage(() => import("../bubble-method/BubbleMethodPage")), preview: { src: bubbleMethodPreview, alt: "Bubble method working for y = 3x + 2: the bubbles take away 2 from both sides, then the next lines and bubbles are left for pupils." } },
  { id: "nets", name: "Nets of 3D shapes", description: "Draw nets of cubes, cuboids, prisms and pyramids on centimetre squares, with letters, dots and faces hidden for pupils.", icon: NetsIcon, component: toolPage(() => import("../nets/NetsPage")), preview: { src: netsPreview, alt: "The cross-shaped net of a cube on centimetre squares, with a dot on the top face." } },
  { id: "algebra-tiles", name: "Algebra tiles", description: "Draw algebra tiles for collecting like terms, including a²b and ab² blocks and negative tiles, with the answer left blank or hidden.", icon: AlgebraTilesIcon, component: toolPage(() => import("../algebra-tiles/AlgebraTilesPage")), preview: { src: algebraTilesPreview, alt: "Algebra tiles for 2a²b + ab² − a²b + 2ab²: a by a by b blocks and a by b by b blocks, one negative, above an answer line." } },
  { id: "sample-space", name: "Sample space diagrams", description: "Make sample space diagrams for two dice, spinners and coins, with outcomes left blank, hidden or circled.", icon: SampleSpaceIcon, component: toolPage(() => import("../sample-space/SampleSpacePage")), preview: { src: sampleSpacePreview, alt: "Sample space diagram for the totals of two dice, with four totals given and the rest left for pupils." } },
  { id: "probability-objects", name: "Spinners, dice and bags", description: "Draw spinners with equal or unequal sectors, dice and bags of counters, with labels left blank or hidden for pupils.", icon: ProbabilityObjectsIcon, component: toolPage(() => import("../probability-objects/ProbabilityObjectsPage")), preview: { src: probabilityObjectsPreview, alt: "An ordinary dice showing 3 beside a fair 8-sided spinner numbered 1 to 8 on its stick." } },
] as const;

/** Site pages outside the booklet tools, loaded the same way. */
export const QuestionBank = lazyPage(() => import("../bank/QuestionBank"));
export const AssessmentPage = lazyPage(() => import("../assessment/AssessmentPage"));
export const WorksheetPage = lazyPage(() => import("../worksheet/WorksheetPage"));
export const BookletPage = lazyPage(() => import("../booklet/BookletPage"));
/** Home is a page like the rest: its code loads when it is the page opened, not with every tool. */
export const HomePage = lazyPage(() => import("./Home"));
/** The Diagram builder page loads on first visit, so Home stays light. */
export const DiagramBuilderPage = lazyPage(() => import("./DiagramBuilder").then((m) => ({ default: m.DiagramBuilder })));
export { pageHref, readPage, type LinkPageId, type PageId, type ToolId } from "./routes";
// Each tool needs a path; this fails to compile if the two lists drift apart.
type RegistryTool = typeof bookletTools[number]["id"];
const _toolsHavePaths: [RegistryTool] extends [ToolId] ? ([ToolId] extends [RegistryTool] ? true : never) : never = true;
void _toolsHavePaths;
// Each tool's page comes from toolPage(), which loads the tool switcher with it; a plain lazyPage() fails to compile here.
const _toolsHaveSwitcher: readonly { component: { withToolSwitcher: true } }[] = bookletTools;
void _toolsHaveSwitcher;
/** Home and the main navigation describe the same teacher destinations. */
export const siteSections = [
  { id: "question-bank", name: "Question bank", href: pageHref("question-bank"), icon: QuestionBankIcon, description: "Find reviewed exam questions by topic, display them in class and export question papers with mark schemes." },
  { id: "paper-builder", name: "Paper builder", href: `${pageHref("question-bank")}?bankView=topics`, icon: PaperBuilderIcon, description: "Tick Sparx codes, review your questions and download a paper with its mark scheme." },
  { id: "assessment-follow-up", name: "Assessment follow-up", href: pageHref("assessment-follow-up"), icon: AssessmentIcon, description: "Turn question-level assessment results into personalised practice for each pupil." },
  { id: "booklet-tools", name: "Diagram builder", href: pageHref("booklet-tools"), icon: DiagramBuilderIcon, description: "Create graphs, ratio tables and diagrams for your teaching resources." },
  { id: "worksheets", name: "Worksheet builder", href: pageHref("worksheets"), icon: WorksheetBuilderIcon, description: "Make a two-sided A3 worksheet from a scheme of work objective with AI, edit it, and download the pupil and answers PDFs." },
  { id: "booklets", name: "Booklet builder", href: pageHref("booklets"), icon: BookletBuilderIcon, description: "Make an A4 unit booklet from a scheme of work unit with AI: a check-in, worked examples, practice and diagnostics for every lesson." },
] as const;
export type SectionId = PageId | "paper-builder";
export function readSection(where: { pathname: string; search: string } = location): SectionId {
  const page = readPage(where);
  return page === "question-bank" && new URLSearchParams(where.search).get("bankView") === "topics" ? "paper-builder" : page;
}
/** One of the six pages, by id. */
export const siteSection = (id: (typeof siteSections)[number]["id"]) => siteSections.find((s) => s.id === id)!;
export function sectionName(section: SectionId): string {
  return section === "paper-builder" ? "Paper builder" : pageName(section);
}
export function pageName(id: PageId): string {
  if (id === "home") return "Home";
  if (id === "booklet-tools") return "Diagram builder";
  if (id === "question-bank") return "Question bank";
  if (id === "assessment-follow-up") return "Assessment follow-up";
  if (id === "worksheets") return "Worksheet builder";
  if (id === "booklets") return "Booklet builder";
  if (id === "not-found") return "Page not found";
  return bookletTools.find(tool => tool.id === id)!.name;
}
/** Starts downloading a page's code; the first page is loaded before the site renders. */
export function preloadPage(id: PageId) {
  if (id === "home") return HomePage.preload();
  if (id === "question-bank") return QuestionBank.preload();
  if (id === "assessment-follow-up") return AssessmentPage.preload();
  if (id === "worksheets") return WorksheetPage.preload();
  if (id === "booklets") return BookletPage.preload();
  if (id === "booklet-tools") return DiagramBuilderPage.preload();
  return bookletTools.find((tool) => tool.id === id)?.component.preload();
}
