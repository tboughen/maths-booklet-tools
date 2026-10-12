import type { BankCatalogue, BankQuestion, Tier } from "./model";
import { percentageColour } from "./performance";

export function PerformanceBadge({question, catalogue, tier = "all"}: {question: BankQuestion; catalogue?: BankCatalogue; tier?: Tier}) {
  const other = tier === "all" && question.equivalentId ? catalogue?.questions.find(q=>q.id===question.equivalentId) : undefined;
  const appearances = other ? [question, other].sort((a,b)=>a.tier.localeCompare(b.tier)) : [question];
  return <span className="qb-performance-group">{appearances.map(q => {
    const score = q.performance;
    if (!score) return <span key={q.id} className="qb-performance qb-performance-estimated">{other?`${q.tier}: `:""}No data</span>;
    const estimated = score.kind === "estimated", label = `${other?`${q.tier}: `:""}${estimated?"Estimated ":""}${Math.round(score.percentage)}%`;
    return <span key={q.id} className={`qb-performance${estimated?" qb-performance-estimated":""}`} style={estimated?undefined:{backgroundColor:percentageColour(score.percentage)}} aria-label={`${estimated?"Estimated average":"Average"} marks achieved: ${Math.round(score.percentage)} percent, ${q.tier === "F"?"Foundation":"Higher"} tier`} title={estimated?"Estimated from original question position":"Average percentage of available marks achieved in the original exam"}>{label}</span>;
  })}</span>;
}
