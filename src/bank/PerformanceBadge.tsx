import type { BankCatalogue, BankListQuestion, Tier } from "./model";
import { percentageColour, performanceSource } from "./performance";

/** "chip" is one compact line for lists; "box" is the score box beside Select question. */
export function PerformanceBadge({question, catalogue, tier = "all", variant = "chip"}: {question: BankListQuestion; catalogue?: BankCatalogue<BankListQuestion>; tier?: Tier; variant?: "chip" | "box"}) {
  const other = tier === "all" && question.equivalentId ? catalogue?.questions.find(q=>q.id===question.equivalentId) : undefined;
  const appearances = other ? [question, other].sort((a,b)=>a.tier.localeCompare(b.tier)) : [question];
  return <span className={`qb-performance-group${variant==="box"?" qb-performance-boxes":""}`}>{appearances.map(q => {
    const score = q.performance, source = performanceSource(q), prefix = other ? `${q.tier}: ` : "";
    const tierName = q.tier === "F" ? "Foundation" : "Higher";
    if (!score) return <span key={q.id} className="qb-performance qb-performance-estimated">{prefix}No data</span>;
    const estimated = score.kind === "estimated", percent = `${Math.round(score.percentage)}%`;
    const className = `qb-performance${estimated?" qb-performance-estimated":""}${variant==="box"?" qb-performance-box":""}`;
    const style = estimated ? undefined : {backgroundColor: percentageColour(score.percentage)};
    const aria = `${source.label}: ${Math.round(score.percentage)} percent of marks, ${tierName} tier. ${source.source}.`;
    if (variant === "box") return <span key={q.id} className={className} style={style} role="group" aria-label={aria}>
      <span className="qb-performance-figure" aria-hidden="true"><b>{prefix}{estimated?"≈":""}{percent}</b> {source.label.toLowerCase()}</span>
      <span className="qb-performance-source" aria-hidden="true">{source.source}</span>
    </span>;
    return <span key={q.id} className={className} style={style} aria-label={aria} title={source.source}>{prefix}{source.label} {percent}</span>;
  })}</span>;
}
