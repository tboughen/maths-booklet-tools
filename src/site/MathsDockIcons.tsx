import type { ReactNode, SVGProps } from "react";

/** The MathsDock icon bank (docs/tools/APP-HOUSE-STYLE.md).
 * 24 x 24 grid, 2 px line, round ends and joins, so the icons sit beside Lucide's general ones.
 * Each icon draws its diagram in the text colour, and one part, the maths idea, in the accent
 * colour (--md-icon-accent). Always show an icon with its label. */
export type MathsDockIconProps = SVGProps<SVGSVGElement> & { size?: number | string };
export type MathsDockIcon = (props: MathsDockIconProps) => ReactNode;

function icon(drawing: ReactNode): MathsDockIcon {
  return function MathsDockIcon({ size = 24, className, ...rest }: MathsDockIconProps) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className ? `md-icon ${className}` : "md-icon"} {...rest}>{drawing}</svg>;
  };
}

// The six pages
/** Question bank */
export const QuestionBankIcon = icon(<><rect x="3" y="7" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /><path className="md-icon-part" d="M8 11.7a2.1 2.1 0 1 1 3.2 1.8c-.7.45-1.2.9-1.2 1.7" /><path className="md-icon-part" d="M10 17.6h.01" /></>);
/** Paper builder */
export const PaperBuilderIcon = icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M13.5 8.5H16M13.5 14.5H16" /><path className="md-icon-part" d="m8 8.6 1.2 1.2 2.1-2.3M8 14.6l1.2 1.2 2.1-2.3" /></>);
/** Assessment follow-up */
export const AssessmentIcon = icon(<><rect x="3" y="4" width="11" height="16" rx="2" /><path d="M6 8.5h5M6 12h5M6 15.5h3" /><path className="md-icon-part" d="M17 12h4.5M19 9.5l2.5 2.5-2.5 2.5" /></>);
/** Diagram builder */
export const DiagramBuilderIcon = icon(<><path d="M3 20V8l12 12z" /><circle className="md-icon-part md-icon-wash" cx="16.5" cy="8" r="4.5" /></>);
/** Worksheet builder */
export const WorksheetBuilderIcon = icon(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M12 5v14M5 9h4M5 12h4M15 9h4" /><path className="md-icon-part" d="M15 15h4" /></>);
/** Booklet builder */
export const BookletBuilderIcon = icon(<><rect x="8" y="3" width="12" height="15" rx="2" /><path d="M4 7v12a2 2 0 0 0 2 2h10" /><path className="md-icon-part" d="M11.5 8h5M11.5 11.5h3" /></>);

// The diagram tools
/** Bar modelling */
export const BarModelIcon = icon(<><rect x="3" y="11" width="18" height="8" rx="1" /><path d="M9 11v8M15 11v8" /><path className="md-icon-part" d="M3 7.5V5h18v2.5" /></>);
/** Expanding and factorising */
export const ExpandingFactorisingIcon = icon(<><rect x="8" y="8" width="13" height="13" rx="1" /><path d="M14.5 8v13M8 14.5h13" /><path className="md-icon-part" d="m2.5 2.5 3.5 3.5M6 2.5 2.5 6" /></>);
/** Ratio tables */
export const RatioTableIcon = icon(<><rect x="3" y="4" width="12" height="16" rx="1" /><path d="M9 4v16M3 9.3h12M3 14.7h12" /><path className="md-icon-part" d="M18 7.5c2.6 2 2.6 6 0 8" /><path className="md-icon-part" d="M17.6 12.4v3.5h3.5" /></>);
/** Number lines */
export const NumberLineIcon = icon(<><path d="M2 16h20M5 14v4M12 14v4M19 14v4" /><circle className="md-icon-part" cx="7" cy="7.5" r="2" /><path className="md-icon-part" d="M9 7.5h10M16.5 5 19 7.5 16.5 10" /></>);
/** Factor trees */
export const FactorTreeIcon = icon(<><path d="M12 3 7.8 7.9M12 3l5 6M17 9l-2.7 7.6M17 9l1.9 7.6" /><circle cx="13.5" cy="19" r="2.5" /><circle cx="19.5" cy="19" r="2.5" /><circle className="md-icon-part md-icon-wash" cx="6" cy="10" r="2.8" /></>);
/** Graph tool */
export const GraphIcon = icon(<><path d="M3 15h18M9 3v18" /><path className="md-icon-part" d="M4.5 19.5 19 5" /></>);
/** Plotting quadratics */
export const ValueTableGraphIcon = icon(<><path d="M3 15h18M12 3v18" /><path className="md-icon-part" d="M5.5 4C7 14 9.5 19 12 19s5-5 6.5-15" /></>);
/** Triangles */
export const TriangleIcon = icon(<><path d="M4 20V5l16 15z" /><path className="md-icon-part" d="M4 16h4v4" /></>);
/** Cuboids */
export const CuboidsIcon = icon(<><path d="M3 9h12v11H3zM15 9l5-5v11l-5 5" /><path className="md-icon-part md-icon-wash" d="M3 9l5-5h12l-5 5z" /></>);
/** Constructions and loci */
export const ConstructionIcon = icon(<><circle cx="12" cy="4.5" r="1.5" /><path d="M11.3 5.9 6 19M12.7 5.9 18 19" /><path className="md-icon-part" d="M3.5 15.5c4.5 4.5 12.5 4.5 17 0" /></>);
/** Plans and elevations */
export const ElevationsIcon = icon(<><path d="M3 20V8h6v6h6v6zM3 14h6M9 14v6" /><rect className="md-icon-part md-icon-wash" x="15" y="3" width="6" height="6" rx=".5" /></>);
/** Angle diagrams */
export const AnglesIcon = icon(<><path d="M3 19h18M3 19 15 5" /><path className="md-icon-part" d="M10.5 19a7.5 7.5 0 0 0-2.6-5.7" /></>);
/** Area and perimeter */
export const AreaIcon = icon(<><path className="md-icon-wash" d="M4 4h9v7h7v9H4z" /></>);
/** Geometry figures */
export const FiguresIcon = icon(<><circle cx="12" cy="11" r="7" /><path d="M3 18h18" /><path className="md-icon-part" d="M6.5 15.5 12 18l5.5-2.5" /></>);
/** Venn diagrams */
export const VennIcon = icon(<><path className="md-icon-wash md-icon-no-line" d="M12 6.8a6 6 0 0 1 0 10.4 6 6 0 0 1 0-10.4z" /><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>);
/** Statistical charts */
export const ChartsIcon = icon(<><path d="M4 3v17h17M8.5 16v-3M17.5 16v-5" /><path className="md-icon-part" d="M13 16V8" /></>);
/** Probability trees */
export const ProbabilityTreeIcon = icon(<><path d="M3 12l7-6M3 12l7 6M10 6l10-3M10 6l10 3" /><path className="md-icon-part" d="M10 18l10-3M10 18l10 3" /></>);
/** Frequency trees */
export const FrequencyTreeIcon = icon(<><rect x="2" y="9" width="6" height="6" rx="1" /><path d="M8 12l6-5.5M8 12l6 5.5" /><rect x="14" y="15" width="7" height="6" rx="1" /><rect className="md-icon-part md-icon-wash" x="14" y="3" width="7" height="6" rx="1" /></>);
/** Two-way tables */
export const TwoWayTableIcon = icon(<><path className="md-icon-wash md-icon-no-line" d="M15 14.7h6V19a1 1 0 0 1-1 1h-5z" /><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9.3h18M3 14.7h18M9 4v16M15 4v16" /></>);
/** Sample space diagrams */
export const SampleSpaceIcon = icon(<><path d="M6 3v18M3 6h18" /><path d="M10 10h.01M14.5 10h.01M19 10h.01M10 14.5h.01M14.5 14.5h.01M19 14.5h.01M10 19h.01M14.5 19h.01M19 19h.01" /><circle className="md-icon-part" cx="14.5" cy="14.5" r="2.6" /></>);

// Maths actions that general icon sets do not have
/** Answer line */
export const AnswerLineIcon = icon(<><path d="M4 7h8M4 11h5" /><path className="md-icon-part" d="M4 18h16" /></>);
/** Stacked fraction */
export const FractionIcon = icon(<><rect x="9" y="3" width="6" height="6" rx="1" /><rect x="9" y="15" width="6" height="6" rx="1" /><path className="md-icon-part" d="M6 12h12" /></>);
/** Copy for Word */
export const CopyWordIcon = icon(<><rect x="4" y="3" width="16" height="18" rx="2" /><path className="md-icon-part" d="m8 9 1.6 6L12 10.5l2.4 4.5L16 9" /></>);
/** Mark scheme */
export const MarkSchemeIcon = icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 8h7M8.5 11.5h3" /><path className="md-icon-part" d="m9 16 1.8 1.8 4-4.4" /></>);
/** Worked solution */
export const WorkedSolutionIcon = icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8.5 8h7" /><path className="md-icon-part" d="M8.5 12h5M8.5 16h3" /></>);
/** Hidden answers */
export const HiddenAnswersIcon = icon(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle className="md-icon-part md-icon-wash" cx="12" cy="12" r="2.8" /></>);
/** Print size */
export const PrintSizeIcon = icon(<><rect x="2" y="8" width="20" height="8" rx="1.5" /><path d="M6 8v3M14 8v3" /><path className="md-icon-part" d="M10 8v4M18 8v4" /></>);
/** Show to class */
export const DisplayIcon = icon(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 21l4-5 4 5" /><path className="md-icon-part" d="M8 10h8" /></>);
/** Sparx code */
export const SparxCodeIcon = icon(<><path d="M3 5a2 2 0 0 1 2-2h6l10 10-8 8L3 11z" /><path className="md-icon-part" d="M8 8h.01" /></>);
