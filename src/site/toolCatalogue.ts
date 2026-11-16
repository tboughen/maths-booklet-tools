/**
 * How the Diagram builder page groups, describes and searches the diagram tools. Every tool in
 * the registry needs a strand, its GCSE topics and search words; this fails to compile otherwise.
 */
import type { ToolId } from "./routes";

/** The four strands of the school's scheme of learning. Graphs are algebra. */
export const strands = [
  { id: "number", name: "Number and proportion" },
  { id: "algebra", name: "Algebra" },
  { id: "geometry", name: "Geometry and measure" },
  { id: "statistics", name: "Statistics and probability" },
] as const;
export type StrandId = (typeof strands)[number]["id"];

type Entry = {
  strand: StrandId;
  /** GCSE topics the tool covers, shown in the Topics view; clicking one searches for it. */
  topics: readonly string[];
  /** Extra teaching words that should find the tool. */
  keywords: string;
  /** The day the tool first went on the site; it shows a New badge for 30 days. */
  added?: string;
};

export const catalogue: Record<ToolId, Entry> = {
  "bar-model": { strand: "number", topics: ["Sharing in a ratio", "Fractions of amounts", "Percentages", "Part-whole", "Comparison", "Forming equations"], keywords: "ratio sharing fractions amount comparison part whole" },
  "expanding-factorising": { strand: "algebra", topics: ["Expanding single brackets", "Expanding double brackets", "Factorising", "Factorising quadratics", "Grid method"], keywords: "algebra brackets multiplication factorise factorize" },
  "ratio-table": { strand: "number", topics: ["Ratio", "Direct proportion", "Unitary method", "Recipes", "Scaling", "Best buys"], keywords: "proportion scaling unitary fractions" },
  "number-line": { strand: "number", topics: ["Inequalities", "Integer solutions", "Negative numbers", "Ordering numbers", "Error intervals"], keywords: "inequality inequalities interval ray" },
  graph: { strand: "algebra", topics: ["Plotting coordinates", "Straight-line graphs", "Gradient", "y = mx + c", "Simultaneous equations"], keywords: "coordinate straight line points axes grid" },
  "value-table-graph": { strand: "algebra", topics: ["Tables of values", "Quadratic graphs", "Roots and turning points", "Graph paper"], keywords: "table values quadratic parabola plotting" },
  triangle: { strand: "geometry", topics: ["Pythagoras", "SOHCAHTOA", "Sine rule", "Cosine rule", "Area ½ab sin C"], keywords: "pythagoras trigonometry sine cosine area angles hypotenuse" },
  angles: { strand: "geometry", topics: ["Angles on a straight line", "Angles round a point", "Vertically opposite angles", "Parallel lines", "Interior and exterior angles"], keywords: "angles straight line point vertically opposite parallel transversal alternate corresponding co-interior polygon interior exterior geometry G3", added: "2026-11-15" },
  area: { strand: "geometry", topics: ["Area of rectangles", "Triangles and trapeziums", "Compound shapes", "Circles", "Sectors and arcs", "Perimeter"], keywords: "area perimeter compound shape rectilinear rectangle triangle parallelogram trapezium circle circumference semicircle quarter sector arc radius diameter pi shaded frame counting squares G16 G17 G18", added: "2026-11-15" },
  "factor-tree": { strand: "number", topics: ["Prime factors", "Product of primes", "Index form", "HCF and LCM"], keywords: "factor tree prime factors product of primes index form HCF LCM decomposition number", added: "2026-11-15" },
  "written-method": { strand: "number", topics: ["Column addition", "Column subtraction", "Long multiplication", "Short division", "Long division"], keywords: "written method column addition subtraction long multiplication short division bus stop long division decimals non-calculator carry exchange", added: "2026-11-16" },
  "function-machine": { strand: "algebra", topics: ["Function machines", "Inputs and outputs", "Inverse operations", "Expressions"], keywords: "function machine number machine input output inverse operation expression", added: "2026-11-16" },
  "bubble-method": { strand: "algebra", topics: ["Solving equations", "Inequalities", "Changing the subject", "Balancing"], keywords: "bubble method balancing balance solve solving linear equation inequality change the subject rearrange formula inverse operation", added: "2026-11-16" },
  nets: { strand: "geometry", topics: ["Nets of cubes", "Nets of cuboids", "Prisms and pyramids", "Where does the dot end up", "Opposite faces"], keywords: "nets net cube cuboid prism pyramid tetrahedron fold folded 3D shapes faces opposite dot GM2", added: "2026-11-16" },
  cuboids: { strand: "geometry", topics: ["Volume", "Surface area", "Counting cubes", "Layers"], keywords: "volume surface area cubes layers" },
  construction: { strand: "geometry", topics: ["Perpendicular bisector", "Angle bisector", "Loci", "Scale drawings", "Bearings"], keywords: "constructions loci locus perpendicular bisector angle bisector compasses ruler scale drawing map bearings north GM8", added: "2026-11-14" },
  elevations: { strand: "geometry", topics: ["Plans", "Front elevation", "Side elevation", "Isometric drawing", "3D solids"], keywords: "plans elevations plan front side isometric cubes 3D solids views GM8", added: "2026-11-14" },
  charts: { strand: "statistics", topics: ["Bar charts", "Dual bar charts", "Pie charts", "Pictograms", "Line charts", "Scatter graphs"], keywords: "statistics bar chart dual comparative composite stacked vertical line chart frequency data pie pictogram scatter correlation" },
  venn: { strand: "statistics", topics: ["Sets", "Intersection and union", "Shading regions", "Venn probability"], keywords: "sets probability shading intersection union" },
  "probability-tree": { strand: "statistics", topics: ["Tree diagrams", "Independent events", "With and without replacement", "Conditional probability"], keywords: "probability tree diagram branches replacement independent dependent conditional given that" },
  "frequency-tree": { strand: "statistics", topics: ["Frequency trees", "Counts to probability"], keywords: "frequency tree probability counts groups statistics" },
  "two-way-table": { strand: "statistics", topics: ["Two-way tables", "Totals", "Probability from tables"], keywords: "two-way two way table totals frequency probability statistics fractions" },
  "sample-space": { strand: "statistics", topics: ["Sample space diagrams", "Listing outcomes", "Two dice", "Probability of combined events"], keywords: "sample space diagram two dice spinner coin outcomes sum product difference probability listing", added: "2026-11-15" },
};

export type ToolText = { id: ToolId; name: string; description: string };

/** Whether a tool matches every search word, and which topic or word to name when the match
 * is not in the tool's own name. */
export function searchTool(tool: ToolText, query: string): { found: boolean; matched: string } {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { found: true, matched: "" };
  const entry = catalogue[tool.id];
  // The strand's own name finds its tools too: "algebra" finds the graph tools.
  const strand = strands.find((s) => s.id === entry.strand)!.name;
  const text = `${tool.name} ${tool.description} ${entry.keywords} ${entry.topics.join(" ")} ${strand}`.toLocaleLowerCase();
  if (!words.every((word) => text.includes(word))) return { found: false, matched: "" };
  const name = tool.name.toLocaleLowerCase();
  if (words.every((word) => name.includes(word))) return { found: true, matched: "" };
  const topic = entry.topics.find((t) => words.some((word) => t.toLocaleLowerCase().includes(word)));
  const keyword = entry.keywords.split(" ").find((k) => words.some((word) => k.toLocaleLowerCase().includes(word)));
  return { found: true, matched: topic ?? keyword ?? "" };
}

export function isNew(id: ToolId, today = new Date()): boolean {
  const added = catalogue[id].added;
  return !!added && today.getTime() - Date.parse(added) < 30 * 86_400_000;
}
