import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { renderResource } from "../../../packages/resource-core/src/index";
import { Panel } from "../../site/PageHeading";
import { downloadBlob } from "../../bank/pdf";
import { pagesPdf } from "../../worksheet/export";
import { Preview } from "../Preview";
import { LEVEL_NAMES, START_LEVELS, type Level, type SkillSet } from "./model";
import { defaultPlan, fitSheet, isAbsent, startLevel, withExclusions, type PlanEntry, type SkillPupil } from "./compose";


const levelValue = (v: string): Level => (/^\d$/.test(v) ? (Number(v) as Level) : (v as Level));

/**
 * Skill sheets for one assessment: each student's three weakest skills at their start level, one A3 sheet each.
 * The teacher can leave skills out (taught to the whole class) and change any student's skills or levels.
 * The page remounts this panel (by key) when the assessment or the marks change, which clears every edit.
 */
export function SkillSheets({ set, pupils, disabled }: { set: SkillSet; pupils: SkillPupil[]; disabled: boolean }) {
  const [excluded, setExcluded] = useState<string[]>([]), [overrides, setOverrides] = useState<Record<string, PlanEntry[]>>({});
  const [result, setResult] = useState<{ pupil: Blob; answers: Blob; pages: number }>(), [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState(""), [problems, setProblems] = useState<string[]>([]);
  const [view, setView] = useState<"pupil" | "answers">("pupil"), [page, setPage] = useState(1);
  const run = useRef(0);
  const max = useMemo(() => set.parts.reduce((n, p) => n + p.max, 0), [set]);
  const rows = pupils.map(({ pupil, label, scores }) => {
    const absent = isAbsent(set, scores);
    const plan = absent ? [] : withExclusions(overrides[pupil.key], defaultPlan(set, scores, excluded), excluded);
    const recorded = set.parts.filter((p) => scores[p.label] !== null && scores[p.label] !== undefined);
    const total = recorded.reduce((n, p) => n + scores[p.label]!, 0), blank = set.parts.length - recorded.length;
    return { pupil, label, scores, absent, plan, total, blank, edited: !!overrides[pupil.key] };
  });
  const invalidate = () => { run.current++; setResult(undefined); setBusy(false); setStatus(""); setError(""); setProblems([]); };
  const classScore = (code: string) => {
    const skill = set.skills.find((s) => s.code === code)!, present = rows.filter((r) => !r.absent);
    const maxOf = (p: string) => set.parts.find((x) => x.label === p)!.max;
    // Blank marks are left out of both the marks and the maximum: blank is not zero.
    const marked = present.flatMap((r) => skill.paper.filter((p) => r.scores[p] !== null && r.scores[p] !== undefined).map((p) => [r.scores[p]!, maxOf(p)]));
    const got = marked.reduce((n, [m]) => n + m, 0), out = marked.reduce((n, [, m]) => n + m, 0);
    return out ? Math.round((100 * got) / out) : 0;
  };
  const edit = (key: string, plan: PlanEntry[], index: number, change: Partial<PlanEntry>) => {
    invalidate();
    // A new skill starts at that skill's own start level from the pupil's marks, never the old skill's level.
    const scores = pupils.find((p) => p.pupil.key === key)!.scores;
    const level = (code: string) => startLevel(set.skills.find((s) => s.code === code)!, scores);
    const next = plan.map((e, i) => (i === index ? (change.code ? { code: change.code, level: level(change.code) } : { ...e, ...change }) : e));
    setOverrides((o) => ({ ...o, [key]: next }));
  };
  async function generate() {
    const token = ++run.current;
    setBusy(true); setResult(undefined); setError(""); setProblems([]);
    const pages: Record<"pupil" | "answers", string[]> = { pupil: [], answers: [] }, found: string[] = [];
    try {
      const present = rows.filter((r) => !r.absent && r.plan.length);
      for (const [i, r] of present.entries()) {
        setStatus(`Laying out ${r.label} (${i + 1} of ${present.length})…`);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        if (token !== run.current) return;
        const { resource, problems: left } = fitSheet(set, r.label, r.plan);
        found.push(...left.map((m) => `${r.label}: ${m}`));
        for (const v of ["pupil", "answers"] as const) pages[v].push(...renderResource(resource, { view: v }).pages);
      }
      if (found.length) { setProblems(found); throw new Error("Some sheets do not fit two sides. Change those students' skills or levels, then generate again."); }
      setStatus("Writing the class PDFs…");
      const [pupilPdf, answersPdf] = [await pagesPdf(pages.pupil, set.title, "Side"), await pagesPdf(pages.answers, set.title, "Side")];
      if (token !== run.current) return;
      setResult({ pupil: pupilPdf, answers: answersPdf, pages: pages.pupil.length }); setPage(1); setView("pupil"); setStatus("Class PDFs ready");
    } catch (e) {
      if (token === run.current) { setError(e instanceof Error ? e.message : "Generation failed. Try again."); setStatus(""); }
    } finally {
      if (token === run.current) setBusy(false);
    }
  }
  const sheets = rows.filter((r) => !r.absent && r.plan.length).length, file = (v: string) => `${set.id}-skill-sheets_${v}.pdf`;
  return <>
    <Panel className="af-panel"><h2>3. Skill sheets</h2>
      <p className="af-help">Each student gets one A3 sheet: their three weakest skills, side 1 at their level and side 2 the next step up. Levels come from their marks on each part.</p>
      <details><summary>Teach to the whole class{excluded.length ? ` · ${excluded.length} left out` : ""}</summary>
        <p className="af-help">Tick a skill to leave it off every sheet, for example when you will reteach it to everyone.</p>
        <div className="af-topic-exclusions">{set.skills.map((s) => <label className="af-check" key={s.code}><input type="checkbox" disabled={disabled || busy} checked={excluded.includes(s.code)} onChange={(e) => { invalidate(); setExcluded((x) => (e.target.checked ? [...x, s.code] : x.filter((c) => c !== s.code))); }} />{s.title} ({s.pupilCodes}) · class {classScore(s.code)}%</label>)}</div>
      </details>
      <details open><summary>Plan · {sheets} sheets{Object.keys(overrides).length ? ` · ${Object.keys(overrides).length} changed` : ""}</summary>
        <p className="af-help">Change any skill or level. Changes stay until you change the marks. Skills taught to the whole class are left out of every sheet.</p>
        <div className="af-table"><table aria-label="Skill sheet plan"><thead><tr><th>Student</th><th>Marks</th>{[1, 2, 3].map((n) => <th key={n}>Skill {n}</th>)}</tr></thead><tbody>
          {rows.map((r) => <tr key={r.pupil.key}><td>{r.label}{r.edited && <> <button type="button" className="af-link" disabled={disabled || busy} onClick={() => { invalidate(); setOverrides((o) => { const n = { ...o }; delete n[r.pupil.key]; return n; }); }}>Undo changes</button></>}</td><td>{r.absent ? "Absent" : `${r.total}/${max}${r.blank ? ` · ${r.blank} blank` : ""}`}</td>
            {r.absent || !r.plan.length ? <td colSpan={3}>{r.absent ? "Absent" : "No skills left"}</td> : r.plan.map((entry, i) => <td key={i}><div className="af-skill-cell">
              <select aria-label={`${r.label} skill ${i + 1}`} disabled={disabled || busy} value={entry.code} onChange={(e) => edit(r.pupil.key, r.plan, i, { code: e.target.value })}>{set.skills.map((s) => <option key={s.code} value={s.code} disabled={s.code !== entry.code && (excluded.includes(s.code) || r.plan.some((p) => p.code === s.code))}>{s.title}</option>)}</select>
              <select aria-label={`${r.label} skill ${i + 1} level`} disabled={disabled || busy} value={String(entry.level)} onChange={(e) => edit(r.pupil.key, r.plan, i, { level: levelValue(e.target.value) })}>{START_LEVELS.map((l) => <option key={l} value={String(l)}>{LEVEL_NAMES[l]}</option>)}</select>
            </div></td>)}
          </tr>)}
        </tbody></table></div>
      </details>
      <div className="af-actions"><button className={result ? undefined : "af-primary"} disabled={disabled || busy || !sheets} onClick={() => void generate()}><FileSpreadsheet size={18} />Generate skill sheets</button>{busy && <button onClick={() => { invalidate(); setStatus("Generation cancelled."); }}><X size={18} />Cancel</button>}</div>
      <p role="status" aria-live="polite">{status}</p>
      {error && <p className="af-error" role="alert">{error}</p>}
      {problems.length > 0 && <ul className="af-help">{problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}</ul>}
    </Panel>
    {result && <Panel className="af-panel"><h2>4. Class sheets</h2>
      <p className="af-help">{sheets} A3 sheets · {result.pages} sides · print double-sided on A3, flip on the long edge.</p>
      <div className="af-actions"><button className="af-primary" onClick={() => downloadBlob(result.pupil, file("pupil"))}><Download size={18} />Download pupil sheets</button><button onClick={() => downloadBlob(result.answers, file("answers"))}><Download size={18} />Download answers</button></div>
      <div className="af-preview-controls"><label>Show<select aria-label="Preview copy" value={view} onChange={(e) => setView(e.target.value as "pupil" | "answers")}><option value="pupil">Pupil sheets</option><option value="answers">Answers</option></select></label><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous side</button><span>Side {page} of {result.pages}</span><button disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}>Next side</button></div>
      <Preview key={`${view}-${page}`} blob={view === "pupil" ? result.pupil : result.answers} page={page} />
    </Panel>}
  </>;
}
