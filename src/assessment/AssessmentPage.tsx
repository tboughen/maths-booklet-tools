import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, RotateCcw, X } from "lucide-react";
import { PageHeading, Panel } from "../site/PageHeading";
import { verifyCatalogue, type BankCatalogue } from "../bank/model";
import { withPerformance } from "../bank/performance";
import { assetUrl, downloadBlob } from "../bank/pdf";
import { importMappings, importPupils, mappingsCsv, paperMappings, parseDelimited, readSpreadsheet, resultsCsv, type Detection, type ResultOptions } from "./import";
import { assessmentPresets } from "./presets";
import { defaults, type AssessmentItem, type ClassPlan, type Pupil, type Settings, type TableSheet } from "./types";
import { generateClass } from "./select";
import { exportClass } from "./export";
import { layoutPack } from "./layout";
import { Preview } from "./Preview";
import "./assessment.css";

interface TableInputProps { title: string; value: string; onChange: (value: string) => void; onRows: (rows: string[][]) => void; disabled: boolean; headersOptional?: boolean; template?: { download: () => void; disabled: boolean } }
function TableInput({ title, value, onChange, onRows, disabled, headersOptional, template }: TableInputProps) {
  const [sheets, setSheets] = useState<TableSheet[]>([]), [selected, setSelected] = useState(0), [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  async function upload(file?: File) {
    if (!file) return; const token = ++generation.current; setError(""); onRows([]);
    try { const incoming = await readSpreadsheet(file); if (token !== generation.current) return; setSheets(incoming); setSelected(0); onRows(incoming[0]?.rows || []); onChange(""); }
    catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "The file could not be read."); }
  }
  return <fieldset disabled={disabled}><legend className={headersOptional ? "sr-only" : undefined}>{title}</legend>
    <label><span className={headersOptional ? "sr-only" : undefined}>{headersOptional ? "Paste marks" : "Paste mapping, including headers"}</span><textarea aria-label={headersOptional ? "Paste marks" : "Paste mapping, including headers"} rows={5} value={value} onChange={e => { generation.current++; setSheets([]); onChange(e.target.value); try { onRows(parseDelimited(e.target.value)); setError(""); } catch (error) { onRows([]); setError(error instanceof Error ? error.message : "Check the pasted cells."); } }} /></label>
    {headersOptional && <p className="af-help">Marks in question order. Leave missing marks blank.</p>}
    <div className="af-input-alternatives"><details><summary>Upload spreadsheet</summary><label className="af-file">XLSX, CSV or TSV<input type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label></details>{template && <button type="button" disabled={template.disabled} onClick={template.download}>Download template</button>}</div>
    {sheets.length > 1 && <label>Workbook sheet<select value={selected} onChange={e => { const index = Number(e.target.value); setSelected(index); onRows(sheets[index].rows); }} >{sheets.map((sheet, index) => <option value={index} key={index}>{sheet.name}</option>)}</select></label>}
    {error && <p role="alert" className="af-error">{error}</p>}
  </fieldset>;
}

export default function AssessmentPage({ active = true }: { active?: boolean }) {
  const [catalogue, setCatalogue] = useState<BankCatalogue>(), [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState<Settings>(defaults), [mappingText, setMappingText] = useState(""), [resultText, setResultText] = useState("");
  const [mappingRows, setMappingRows] = useState<string[][]>([]), [resultRows, setResultRows] = useState<string[][]>([]), [resultOptions, setResultOptions] = useState<ResultOptions>({}), [paper, setPaper] = useState(""), [partScores, setPartScores] = useState(true), [needsRegeneration, setNeedsRegeneration] = useState(false);
  const [plan, setPlan] = useState<ClassPlan>(), [blob, setBlob] = useState<Blob>(), [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState(""), [previewPage, setPreviewPage] = useState(1), [resetKey, setResetKey] = useState(0);
  const controller = useRef<AbortController | null>(null), revision = useRef(0);
  useEffect(() => {
    const fetchController = new AbortController();
    fetch(assetUrl("bank/catalogue.json"), { signal: fetchController.signal }).then(response => { if (!response.ok) throw new Error("The question bank could not be loaded."); return response.json(); }).then(data => setCatalogue(withPerformance(verifyCatalogue(data)))).catch(() => { if (!fetchController.signal.aborted) setLoadError("The question bank could not be loaded. Reload to try again."); });
    return () => { fetchController.abort(); controller.current?.abort(); };
  }, []);
  const invalidate = () => { revision.current++; controller.current?.abort(); if (blob || plan) setNeedsRegeneration(true); setPlan(undefined); setBlob(undefined); setError(""); setStatus(""); setBusy(false); };
  const updateSettings = (change: Partial<Settings>) => { invalidate(); setSettings(old => ({ ...old, ...change })); };
  let items: AssessmentItem[] = [], pupils: Pupil[] = [], warnings: string[] = [], importError = "", detection: Detection | undefined;
  try {
    if (catalogue && mappingRows.length) { const imported = importMappings(mappingRows, catalogue); items = imported.rows; warnings = imported.warnings; }
    if (items.length && resultRows.length) { const imported = importPupils(resultRows, items, resultOptions); pupils = imported.rows; detection = imported.detection; warnings.push(...imported.warnings); }
  } catch (e) { importError = e instanceof Error ? e.message : "Check the imported data."; }
  const presets = catalogue ? assessmentPresets(catalogue) : [], selectedPreset = presets.find(p => p.id === paper);
  function choosePaper(id: string, parts = partScores) {
    invalidate(); setPaper(id); if (!id) { setMappingText(""); setMappingRows([]); return; } if (!catalogue) return;
    const preset = presets.find(p => p.id === id); if (!preset) return;
    const text = mappingsCsv(parts ? preset.parts : preset.items); setMappingText(text); setMappingRows(parseDelimited(text));
  }
  async function generate() {
    if (!catalogue) return;
    const token = ++revision.current, abort = new AbortController(); controller.current?.abort(); controller.current = abort;
    setBusy(true); setBlob(undefined); setPlan(undefined); setError(""); setStatus("Creating class pack…");
    // Yield for feedback before the bounded deterministic selection pass.
    await new Promise(resolve => window.setTimeout(resolve, 0));
    try {
      if (abort.signal.aborted) return;
      const next = generateClass(catalogue, items, pupils, settings); next.assessmentName = selectedPreset?.name || "Custom assessment"; setPlan(next);
      const pdf = await exportClass(next, settings, catalogue.version, message => { if (token === revision.current) setStatus(message); }, abort.signal);
      if (token !== revision.current) return;
      setBlob(pdf); setPreviewPage(1); setNeedsRegeneration(false); setStatus("Class PDF ready");
    } catch (e) { if (token === revision.current && !abort.signal.aborted) { setPlan(undefined); setError(e instanceof Error ? e.message : "Generation failed. Try again."); setStatus(""); } }
    finally { if (token === revision.current) setBusy(false); }
  }
  function reset() {
    invalidate(); setMappingText(""); setResultText(""); setMappingRows([]); setResultRows([]); setResultOptions({}); setPaper(""); setPartScores(true); setSettings(defaults); setNeedsRegeneration(false); setResetKey(k => k + 1);
  }
  function example() {
    if (!catalogue) return;
    invalidate(); const paperId = "1MA1_NOV_2019_1H", exampleItems = paperMappings(catalogue, paperId, true);
    const mapping = mappingsCsv(exampleItems);
    const results = [exampleItems.map((item, i) => i % 3 === 0 ? "0" : String(item.marks)),
      exampleItems.map((item, i) => i % 3 === 1 ? String(Math.max(0, item.marks - 1)) : String(item.marks)),
      exampleItems.map(() => "")].map(row => row.join("\t")).join("\n");
    setSettings(defaults); setPaper(paperId); setPartScores(true); setMappingText(mapping); setMappingRows(parseDelimited(mapping)); setResultText(results); setResultRows(parseDelimited(results)); setResultOptions({}); setResetKey(k => k + 1);
  }
  const pageCounts = plan?.packs.map(pack => layoutPack(pack.entries, settings.pageLimit).pages) || [], totalPages = pageCounts.reduce((n, pages) => n + pages, 0);
  const range = (values: number[], unit: string) => { const minimum = Math.min(...values), maximum = Math.max(...values); return `${minimum === maximum ? minimum : `${minimum}–${maximum}`} ${unit}${minimum === maximum && maximum === 1 ? "" : "s"}`; };
  const starts = pageCounts.map((_, i) => 1 + pageCounts.slice(0, i).reduce((n, p) => n + p, 0));
  let previewPupil = 0; starts.forEach((start, index) => { if (start <= previewPage) previewPupil = index; });
  const emptyPacks = plan?.packs.filter(pack => !pack.entries.length).length || 0;
  const invalidScores = warnings.filter(warning => warning.includes("invalid score for")).length;
  const resultWidth = Math.max(resultRows[0]?.length || 0, ...resultRows.map(row => row.length));
  const adjust = (change: ResultOptions) => { invalidate(); setResultOptions(old => ({ ...old, ...change })); };
  const mappingEditor = <><TableInput key={`mapping-${resetKey}`} title="Assessment questions" disabled={busy} value={mappingText} onChange={setMappingText} onRows={rows => { invalidate(); setMappingRows(rows); }} /><p className="af-help">Headers: Question, Max marks, Sparx codes. Optional Question ID excludes the original question.</p><p className="af-help">Multiple codes: U753 U751. Spaces, commas or semicolons work; practice questions appear once.</p><div className="af-actions"><button onClick={() => downloadText(mappingsCsv(items.length ? items : [{ label: "Q1", marks: 3, codes: ["U538"] }]), "assessment-mapping.csv")}>Mapping template</button><button disabled={!items.length} onClick={() => downloadText(mappingsCsv(items), "assessment-mapping.csv")}>Save mapping</button></div></>;
  const downloadText = (text: string, filename: string) => downloadBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), filename);
  return <main className="af-page" id={active ? "main-content" : undefined} tabIndex={-1}>
    <PageHeading title="Assessment follow-up" description="Turn question-level assessment results into personalised practice for each pupil." />
    <p className="af-intro">Paste marks only, one student per row. Students will be labelled S001, S002, etc.</p>
    <div className="af-toolbar"><button className={blob ? undefined : "af-primary"} disabled={busy || !pupils.length || !items.length || !!importError} onClick={() => void generate()}><FileSpreadsheet size={18} />Generate class pack</button><button className={blob ? "af-primary" : undefined} disabled={!blob || busy} onClick={() => blob && downloadBlob(blob, "mathsdock-assessment-follow-up.pdf")}><Download size={18} />Download class PDF</button><button disabled={!catalogue || busy} onClick={example}>Try example</button><button onClick={reset}><RotateCcw size={18} />Reset and clear data</button>{busy && <button onClick={() => { invalidate(); setStatus("Generation cancelled."); }}><X size={18} />Cancel</button>}</div>
    <div className="af-workspace"><div className="af-main">
      <Panel className="af-panel"><h2>1. Choose assessment</h2><label><span className="sr-only">Choose assessment</span><select aria-label="Choose assessment" disabled={!catalogue || busy} value={paper} onChange={e => choosePaper(e.target.value)}><option value="" disabled>Choose an assessment…</option><option value="custom">Custom assessment</option>{(["HPPs", "Mini mocks", "Exam papers", "Mock papers"] as const).flatMap(group => ([settings.tier, settings.tier === "H" ? "F" : "H"] as const).map(tier => <optgroup key={`${group}-${tier}`} label={`${group} — ${tier === "H" ? "Higher" : "Foundation"}`}>{presets.filter(p => p.group === group && p.tier === tier).map(p => <option key={p.id} value={p.id}>{p.name} — {p.marks} marks</option>)}</optgroup>))}</select></label>
        <label className="af-check"><input type="checkbox" checked={partScores} disabled={busy} onChange={e => { setPartScores(e.target.checked); if (paper) choosePaper(paper, e.target.checked); else invalidate(); }} />Separate scores for 1a, 1b, etc.</label>
        <p className="af-help">Untick for whole-question totals.</p>
        {items.length > 0 && <p className="af-assessment-summary">{items.length} score columns expected</p>}
        {selectedPreset && <details><summary>View or edit mapping</summary>{mappingEditor}<div className="af-table"><table><thead><tr><th>Question</th><th>Marks</th><th>Sparx</th></tr></thead><tbody>{items.map(item => <tr key={item.label}><td>{item.label}</td><td>{item.marks}</td><td>{item.codes.join(", ")}</td></tr>)}</tbody></table></div></details>}
        {paper === "custom" && mappingEditor}
      </Panel>
      <Panel className="af-panel"><h2>2. Paste marks</h2>
        <TableInput key={`results-${resetKey}`} title="Student marks" headersOptional disabled={busy} value={resultText} onChange={setResultText} onRows={rows => { invalidate(); setResultRows(rows); }} template={{ disabled: !items.length, download: () => downloadText(resultsCsv(items), "assessment-results-template.csv") }} />
        {detection && <div className="af-import-summary"><p>{range([pupils.length], "student")} · {detection.matchedQuestions}/{items.length} columns matched{detection.missingResults > 0 && <> · {range([detection.missingResults], "missing result")}</>}</p></div>}
        {detection && detection.matchedQuestions < items.length && <p className="af-error" role="alert">{items.length - detection.matchedQuestions} score columns missing. Check the assessment or Adjust import.</p>}
        {!!resultRows.length && <details><summary>Adjust import</summary>
          {detection && <p className="af-help">{detection.hasHeaders ? "Headers detected." : `Question order: ${items.slice(0, 3).map(i => i.label).join(", ")}${items.length > 3 ? ", …" : ""}.`} {detection.identifierColumn === null ? "Identifiers generated automatically." : `Identifiers from column ${detection.identifierColumn + 1}.`}</p>}
          <fieldset disabled={busy}><label>Header row<select value={resultOptions.headers || "auto"} onChange={e => adjust({ headers: e.target.value as ResultOptions["headers"] })}><option value="auto">Detect automatically</option><option value="yes">First row is a header</option><option value="no">No header — first row is a student</option></select></label><label>Student identifiers<select aria-label="Student identifiers" value={resultOptions.identifier ?? "auto"} onChange={e => adjust({ identifier: e.target.value === "auto" || e.target.value === "none" ? e.target.value : Number(e.target.value) })}><option value="auto">Detect automatically</option><option value="none">Generate identifiers</option>{Array.from({ length: resultWidth }, (_, index) => <option key={index} value={index}>Column {index + 1}{detection?.hasHeaders ? `: ${resultRows[0]?.[index] || ""}` : ""}</option>)}</select></label><label>Question columns<select aria-label="Question columns" value={resultOptions.firstQuestionColumn ?? "auto"} onChange={e => adjust({ firstQuestionColumn: e.target.value === "auto" ? undefined : Number(e.target.value) })}><option value="auto">Detect automatically</option>{Array.from({ length: resultWidth }, (_, index) => <option key={index} value={index}>Start at column {index + 1}</option>)}</select></label><p className="af-help">Headers and identifiers are optional. Student overrides use Year, Tier, Strength headers. Enter values, not formulas.</p></fieldset>
        </details>}
      </Panel>
      {(loadError || importError || error) && <p className="af-error" role="alert">{loadError || importError || error}</p>}
      {invalidScores > 0 && <p className="af-error" role="alert">{range([invalidScores], "invalid score")} treated as missing. Check import notices.</p>}
      {warnings.length > 0 && <details className="af-notices"><summary>{warnings.length} import notices — check details</summary><ul>{warnings.slice(0, 100).map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
      <p role="status" aria-live="polite">{status}</p>
      {needsRegeneration && !blob && !busy && <p className="af-import-summary" role="status">Changes made — generate again</p>}
      {blob && plan && <Panel className="af-panel"><h2>3. Class pack</h2><div className="af-pack-summary" aria-label="Class pack summary"><strong>{range([plan.packs.length], "student")}</strong><strong>{range(plan.packs.map(p => p.entries.length), "question")} each</strong><strong>{range(plan.packs.map(p => p.entries.reduce((n, e) => n + e.question.marks, 0)), "mark")} each</strong></div><p className="af-help">{range(pageCounts, "A4 page")} each · {totalPages} pages total · Answers included</p>{emptyPacks > 0 && <p className="af-error" role="alert">{range([emptyPacks], "student")} with no suitable questions. Check Student details.</p>}
        <details><summary>Student details</summary><div className="af-table"><table><thead><tr><th>Student</th><th>Questions</th><th>Marks</th><th>Pages</th><th>Selection</th></tr></thead><tbody>{plan.packs.map((pack, index) => <tr key={pack.pupil.key}><td><button onClick={() => setPreviewPage(starts[index])}>{pack.pupil.identifier}</button></td><td>{pack.entries.length}</td><td>{pack.entries.reduce((n, entry) => n + entry.question.marks, 0)}</td><td>{pageCounts[index]}</td><td>{settings.common ? "Common set" : pack.fallback ? "Class fallback" : "Individual"}{pack.warnings.length > 0 && <span> · {pack.warnings.join(" ")}</span>}</td></tr>)}</tbody></table></div></details>
        <label>Preview student<select aria-label="Preview student" value={previewPupil} onChange={e => setPreviewPage(starts[Number(e.target.value)])}>{plan.packs.map((pack, index) => <option key={pack.pupil.key} value={index}>{pack.pupil.identifier} — {pack.entries.length} questions, {pack.entries.reduce((n, entry) => n + entry.question.marks, 0)} marks</option>)}</select></label><div className="af-preview-controls"><button disabled={previewPage <= 1} onClick={() => setPreviewPage(p => p - 1)}>Previous page</button><span>Page {previewPage - starts[previewPupil] + 1} of {pageCounts[previewPupil]}</span><button disabled={previewPage >= totalPages} onClick={() => setPreviewPage(p => p + 1)}>Next page</button></div>
        <details><summary>Jump to class page</summary><label>Preview A4 page<input type="number" min={1} max={totalPages} value={previewPage} onChange={e => setPreviewPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))} /></label></details><Preview key={previewPage} blob={blob} page={previewPage} />
        <div className="af-preview-download"><button className="af-primary" disabled={busy} onClick={() => downloadBlob(blob, "mathsdock-assessment-follow-up.pdf")}><Download size={18} />Download class PDF</button></div>
        <details><summary>Printing help</summary><p>Answers are upside down at the end. Print at actual size; choose duplex or booklet settings in your PDF software.</p>{settings.pageLimit === 1 && <p>Use single-sided printing for one-page packs.</p>}</details>
        <details><summary>Why these questions?</summary>{plan.packs.map(pack => <div key={pack.pupil.key}><h3>{pack.pupil.identifier}</h3><ol>{pack.entries.map(entry => <li key={entry.question.id}>{entry.question.source} — follow-up to {entry.references.join(", ")} · {entry.reason}</li>)}</ol></div>)}</details>
      </Panel>}
    </div><aside className="af-inspector"><Panel className="af-panel"><h2>Class settings</h2><fieldset disabled={busy}>
      <label>Year<select value={settings.year} onChange={e => updateSettings({ year: Number(e.target.value) })}>{[7, 8, 9, 10, 11, 12, 13].map(year => <option key={year}>{year}</option>)}</select></label>
      <label>Tier<select value={settings.tier} onChange={e => updateSettings({ tier: e.target.value as Settings["tier"] })}><option value="H">Higher</option><option value="F">Foundation</option></select></label>
      <label>Class strength<select value={settings.strength} onChange={e => updateSettings({ strength: e.target.value as Settings["strength"] })}><option value="developing">Developing</option><option value="secure">Secure</option><option value="strong">Strong</option></select></label>
      {settings.pageLimit !== null ? <label>Pages per student<select aria-label="Pages per student" value={settings.pageLimit} onChange={e => updateSettings({ pageLimit: Number(e.target.value) as Settings["pageLimit"] })}>{[1, 2, 4, 8].map(n => <option key={n}>{n}</option>)}</select><span className="af-help">A4 · Answers included</span></label> : <p className="af-help">No page limit</p>}
      <label className="af-check"><input type="checkbox" checked={settings.common} onChange={e => updateSettings({ common: e.target.checked })} />Same questions for everyone</label>
      <details><summary>More options</summary>
        <label>Calculator<select value={settings.calculator} onChange={e => updateSettings({ calculator: e.target.value as Settings["calculator"] })}><option value="all">Either</option><option value="yes">Calculator</option><option value="no">Non-calculator</option></select></label>
        <label className="af-check"><input type="checkbox" checked={settings.pageLimit !== null} onChange={e => updateSettings({ pageLimit: e.target.checked ? 4 : null })} />Limit pages</label>
        <label className="af-check"><input type="checkbox" checked={settings.marksLimit !== null} onChange={e => updateSettings({ marksLimit: e.target.checked ? 20 : null })} />Limit marks</label>{settings.marksLimit !== null && <label>Maximum marks<input type="number" min={1} max={200} value={settings.marksLimit} onChange={e => updateSettings({ marksLimit: Number(e.target.value) })} /></label>}
        <p className="af-help">With both limits enabled, the pack stops at the first limit. Pages include working space and answers.</p>
        <p className="af-help">Shared packs use the class’s most commonly selected questions and class settings.</p>
        <details><summary>How questions are chosen</summary><p className="af-help">Earlier questions are preferred. Exam averages guide difficulty: developing 70–100%, secure 55–80%, strong 0–65%, adjusted for year and results. These are preferences, not exclusions.</p></details>
      </details>
    </fieldset></Panel><details className="af-data-help"><summary>How your data is handled</summary><p className="af-help">Marks stay on this device. They are never uploaded or saved, and reset or reload clears them. Paste marks only to generate student identifiers; existing identifier columns also work.</p></details></aside></div>
  </main>;
}

