import type { BankCatalogue, BankListQuestion, Tier } from "./model";
import { percentageColour, performanceSource } from "./performance";

/** "chip" is one compact line for lists; "box" is the score box beside Select question. */
export function PerformanceBadge({question, catalogue, tier = "all", variant = "chip"}: {question: BankListQuestion; catalogue?: BankCatalogue<BankListQuestion>; tier?: Tier; variant?: "chip" | "box"}) {
  const other = tier === "all" && question.equivalentId ? catalogue?.questions.find(q=>q.id===question.equivalentId) : undefined;
  const appearances = other ? [question, other].sort((a,b)=>a.tier.localeCompare(b.tier)) : [question];
  const sources = appearances.map(performanceSource), prefix = (q: BankListQuestion) => other ? `${q.tier}: ` : "";
  const percent = (q: BankListQuestion) => q.performance ? `${q.performance.kind === "estimated" ? "≈" : ""}${Math.round(q.performance.percentage)}%` : "";
  if (variant === "box") {
    // A question on both tiers comes from one sitting, so one box carries both figures when their source matches.
    const groups = sources.every(s => s.label === sources[0].label && s.source === sources[0].source) ? [appearances] : appearances.map(q => [q]);
    return <span className="qb-performance-group qb-performance-boxes">{groups.map(group => {
      const source = performanceSource(group[0]), score = group[0].performance, estimated = !score || score.kind === "estimated";
      return <span key={group[0].id} className={`qb-performance qb-performance-box${estimated?" qb-performance-estimated":""}`} style={estimated||!score?undefined:{backgroundColor:percentageColour(score.percentage)}}>
        <span className="qb-performance-figure">{score ? <b>{group.map(q => `${prefix(q)}${percent(q)}`).join(" · ")}</b> : null} {score && source.kind !== "mock-sample" ? source.label.toLowerCase() : source.label}</span>
        <span className="qb-performance-source">{source.source}</span>
      </span>;
    })}</span>;
  }
  return <span className="qb-performance-group">{appearances.map((q, i) => {
    const score = q.performance, source = sources[i];
    if (!score) return <span key={q.id} className="qb-performance qb-performance-estimated">{prefix(q)}No data</span>;
    const estimated = score.kind === "estimated";
    return <span key={q.id} className={`qb-performance${estimated?" qb-performance-estimated":""}`} style={estimated?undefined:{backgroundColor:percentageColour(score.percentage)}} title={source.source}>{prefix(q)}{source.label} {Math.round(score.percentage)}%</span>;
  })}</span>;
}
