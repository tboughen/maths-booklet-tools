import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Panel } from "../site/PageHeading";
import { downloadBlob } from "../bank/pdf";
import type { BankCatalogue } from "../bank/model";
import { analyseResults, analysisCsv, topicPattern } from "./analysis";
import type { AssessmentItem, Pupil } from "./types";

const percent = (n?: number) => n === undefined ? "–" : `${Math.round(n)}%`;
const signed = (n?: number) => n === undefined ? "–" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;
const tone = (gap?: number) => gap === undefined ? undefined : gap <= -10 ? "af-gap-low" : gap < -5 ? "af-gap-below" : gap >= 5 ? "af-gap-above" : undefined;

/** Class against national success rate by topic, and across classes when the sheet names them. */
export function AnalysisPanel({ catalogue, items, pupils }: { catalogue: BankCatalogue; items: AssessmentItem[]; pupils: Pupil[] }) {
  const analysis = useMemo(() => analyseResults(catalogue, items, pupils), [catalogue, items, pupils]);
  const [all, setAll] = useState(false);
  const hasNational = analysis.topics.some(t => t.national !== undefined);
  const shown = all ? analysis.topics : analysis.topics.filter(t => t.evidence === "enough");
  const title = (code: string) => analysis.topics.find(t => t.code === code)?.title || code;
  return <Panel className="af-panel"><h2>Class analysis</h2>
    <p className="af-help">Each topic compares the class's average mark with pupils nationally on the same questions. A gap of −10 means 10 points below national.{analysis.groups.length === 1 ? " Add a Class column to the marks to compare classes across the department." : ""}</p>
    {!hasNational && <p className="af-help">No national success rates exist for these questions, so only class averages are shown.</p>}
    <div className="af-themes">{analysis.groups.map(group => <div key={group}><h3>{group}</h3>{analysis.themes[group]?.length ? <ol>{analysis.themes[group].map(code => <li key={code}>{title(code)} <span className="af-help">({code}, {signed(analysis.topics.find(t => t.code === code)?.groups[group]?.gap)})</span></li>)}</ol> : <p className="af-help">No topic is more than 5 points below national with enough marks of evidence.</p>}</div>)}</div>
    <div className="af-table"><table><thead><tr><th>Strand</th><th>Marks</th><th>National</th>{analysis.groups.map(g => <th key={g}>{g}</th>)}</tr></thead><tbody>{analysis.strands.map(strand => <tr key={strand.code}><td>{strand.title}</td><td>{Math.round(strand.marks)}</td><td>{percent(strand.national)}</td>{analysis.groups.map(g => <td key={g} className={tone(strand.groups[g]?.gap)}>{percent(strand.groups[g]?.percentage)} <span className="af-help">{signed(strand.groups[g]?.gap)}</span></td>)}</tr>)}</tbody></table></div>
    <p className="af-help">One paper gives each topic only a few marks, so treat topic themes as pointers to check. Strands carry more evidence.</p>
    <details><summary>Topic grid</summary>
      <label className="af-check"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Include topics with fewer than 2 marks</label>
      <div className="af-table"><table><thead><tr><th>Topic</th><th>Marks</th><th>National</th>{analysis.groups.map(g => <th key={g}>{g}</th>)}{analysis.groups.length > 2 && <th>Pattern</th>}</tr></thead><tbody>{shown.map(topic => <tr key={topic.code}>
        <td>{topic.title} <span className="af-help">{topic.code}</span></td><td>{topic.marks % 1 ? topic.marks.toFixed(1) : topic.marks}</td><td>{percent(topic.national)}</td>
        {analysis.groups.map(g => <td key={g} className={tone(topic.groups[g]?.gap)}>{percent(topic.groups[g]?.percentage)} <span className="af-help">{signed(topic.groups[g]?.gap)}</span></td>)}
        {analysis.groups.length > 2 && <td>{topicPattern(topic, analysis.groups) === "department" ? "Every class" : topicPattern(topic, analysis.groups) === "some classes" ? "Some classes" : ""}</td>}
      </tr>)}</tbody></table></div>
    </details>
    <details><summary>Question by question</summary><div className="af-table"><table><thead><tr><th>Question</th><th>Marks</th><th>National</th>{analysis.groups.map(g => <th key={g}>{g}</th>)}</tr></thead><tbody>{analysis.questions.map(q => <tr key={q.label}><td>{q.label}</td><td>{q.marks}</td><td>{percent(q.national)}</td>{analysis.groups.map(g => <td key={g} className={tone(q.groups[g]?.gap)}>{percent(q.groups[g]?.percentage)} <span className="af-help">{signed(q.groups[g]?.gap)}</span></td>)}</tr>)}</tbody></table></div>
      <p className="af-help">National rates are for the whole question, so a part shows its question's rate.</p></details>
    <button onClick={() => downloadBlob(new Blob([analysisCsv(analysis)], { type: "text/csv;charset=utf-8" }), "mathsdock-class-analysis.csv")}><Download size={18} />Download analysis (CSV, no pupil names)</button>
  </Panel>;
}
