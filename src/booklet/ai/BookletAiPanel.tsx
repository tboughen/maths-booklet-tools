import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, LoaderCircle, Sparkles, Square } from "lucide-react";
import type { Booklet } from "../../../packages/resource-core/src/index";
import { useAi } from "../../worksheet/ai/useAi";
import { loadImportedScheme, loadSchoolScheme, parseScheme, saveImportedScheme, type Scheme } from "../../worksheet/ai/scheme";
import { estimateCost } from "../../worksheet/ai/prices";
import type { Stage } from "../../worksheet/ai/types";
import { estimateTokens, type BookletBrief } from "./brief";
import { isPlaceholder, makeBooklet, remakeLesson, type Made, type Progress } from "./make";

const MAX_SCHEME_FILE = 2_000_000;
const OWN = "own";

export interface BookletAiPanelProps {
  current: Booklet;
  /** The lesson the editor has open, offered first for changes. */
  focusLesson: number;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  /** Applies a new booklet as one undoable change. */
  onApply: (booklet: Booklet, message: string) => void;
}

/** "A7.01 Plot graphs…" or "Plot graphs…", one per line. */
function parseObjectives(text: string) {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => {
      const m = /^([A-Z]{1,4}\d+(?:\.\d+)?)\s*[:.\-–]?\s+(.+)$/.exec(l);
      return m ? { code: m[1], text: m[2].slice(0, 200) } : { code: "", text: l.slice(0, 200) };
    });
}

/** Provider prices are in US dollars, as on their billing pages. */
const dollars = (d: number) => `$${d.toFixed(2)}`;

function stageLine(s: Stage | null) {
  if (!s) return "";
  if (s.kind === "thinking") return "Thinking about the lesson…";
  if (s.kind === "writing") return `Writing the lesson… (${Math.round(s.chars / 1000)}k characters)`;
  if (s.kind === "checking") return "Checking the pages…";
  return `Fixing the layout (try ${s.attempt + 1})…`;
}

export function BookletAiPanel({ current, focusLesson, disabled, onBusyChange, onApply }: BookletAiPanelProps) {
  const [busy, setBusy] = useState<"booklet" | "lesson" | null>(null);
  const running = busy !== null;
  const ai = useAi(running);
  const [school, setSchool] = useState<Scheme | null>(null);
  const [imported, setImported] = useState<Scheme | null>(loadImportedScheme);
  const [source, setSource] = useState<string>(OWN);
  const [unitCode, setUnitCode] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [own, setOwn] = useState({ code: "", title: "", objectives: "" });
  const [group, setGroup] = useState("");
  const [context, setContext] = useState("");
  const [checkIn, setCheckIn] = useState(true);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lessonStage, setLessonStage] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [target, setTarget] = useState(focusLesson);
  const [change, setChange] = useState("");
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const schemeFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = new AbortController();
    void loadSchoolScheme(c.signal).then((s) => {
      if (!s) return;
      setSchool(s);
      setSource((v) => (v === OWN ? "school" : v));
    });
    return () => c.abort();
  }, []);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => setTarget(Math.min(focusLesson, current.document.lessons.length - 1)), [focusLesson, current.document.lessons.length]);

  const scheme = source === "school" ? school : source === "imported" ? imported : null;
  const unit = scheme?.units.find((u) => u.code === unitCode) ?? null;
  function chooseUnit(code: string) {
    setUnitCode(code);
    const u = scheme?.units.find((x) => x.code === code);
    // Every objective starts ticked; "Review" rows in the scheme have no code and are left out.
    setTicked(new Set(u?.objectives.filter((o) => o.code).map((o) => o.code) ?? []));
    if (u?.years?.length === 1) setGroup((g) => g || `Year ${u.years![0]}`);
  }

  const brief: BookletBrief | null = useMemo(() => {
    if (unit) {
      const objectives = unit.objectives.filter((o) => o.code && ticked.has(o.code)).map((o) => ({ code: o.code, text: o.text }));
      return objectives.length ? { code: unit.code, title: unit.title, group, objectives, context, checkInLesson: checkIn } : null;
    }
    if (scheme) return null;
    const objectives = parseObjectives(own.objectives);
    return objectives.length && own.title.trim() ? { code: own.code.trim(), title: own.title.trim(), group, objectives, context, checkInLesson: checkIn } : null;
  }, [unit, ticked, scheme, own, group, context, checkIn]);

  const lessonCount = brief ? brief.objectives.length + (brief.checkInLesson ? 1 : 0) : 0;
  const tooMany = lessonCount > 12;
  const estimate = brief ? estimateCost(ai.settings.provider, ai.model, estimateTokens(lessonCount)) : null;
  const minutes = brief ? Math.round(1.5 + 3 + Math.ceil(Math.max(0, lessonCount - 1) / 3) * 3.5) : 0;

  const options = (signal: AbortSignal) => ({ provider: ai.settings.provider, apiKey: ai.key, model: ai.model, effort: ai.settings.effort, signal, onUsage: ai.count(ai.settings.provider) });

  async function makeAll() {
    if (!brief || running || disabled || tooMany) return;
    setError("");
    const c = new AbortController();
    abort.current = c;
    setBusy("booklet");
    onBusyChange(true);
    try {
      const result = await makeBooklet(options(c.signal), brief, setProgress);
      setMade(result);
      onApply(
        result.booklet,
        result.failed
          ? `Booklet made by ${result.model}, but ${result.failed} lesson${result.failed > 1 ? "s" : ""} still need${result.failed > 1 ? "" : "s"} making: rebuild ${result.failed > 1 ? "them" : "it"} under Change a lesson. Undo brings back the previous booklet.`
          : `Booklet made by ${result.model}: ${result.booklet.document.lessons.length} lessons. Check every question and answer before printing. Undo brings back the previous booklet.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setBusy(null);
      onBusyChange(false);
    }
  }

  async function changeLesson(rebuild: boolean) {
    if (running || disabled) return;
    setError("");
    setConfirmRebuild(false);
    const c = new AbortController();
    abort.current = c;
    setBusy("lesson");
    onBusyChange(true);
    try {
      const r = await remakeLesson({ ...options(c.signal), onStage: setLessonStage }, current, target, rebuild ? null : change, context);
      const lessons = current.document.lessons.map((l, i) => (i === target ? r.lesson : l));
      onApply({ ...current, document: { ...current.document, lessons } }, `Lesson ${target + 1} ${rebuild ? "rebuilt" : "changed"} by ${r.model}.${r.flags.trim() ? ` Check: ${r.flags.trim()}` : ""} Undo brings back the previous version.`);
      if (!rebuild) setChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setBusy(null);
      setLessonStage(null);
      onBusyChange(false);
    }
  }

  const lessons = current.document.lessons;
  const placeholder = lessons[target] && isPlaceholder(lessons[target]);

  return (
    <section className="panel-card ws-ai bk-ai" aria-label="Make with AI">
      <h2>
        <Sparkles size={17} aria-hidden="true" /> Make with AI
      </h2>
      {ai.settingsUi}

      <h3>Unit</h3>
      <label className="ws-field">
        <span>Choose from</span>
        <select
          value={source}
          disabled={running}
          onChange={(e) => {
            setSource(e.target.value);
            setUnitCode("");
          }}
        >
          {school && <option value="school">{school.name}</option>}
          {imported && <option value="imported">{imported.name} (imported)</option>}
          <option value={OWN}>Type my own unit</option>
        </select>
      </label>
      <div className="ws-ai-row">
        <button className="tool-button" disabled={running} onClick={() => schemeFile.current?.click()}>
          Import a scheme…
        </button>
        {imported && (
          <button
            className="tool-button"
            disabled={running}
            onClick={() => {
              saveImportedScheme(null);
              setImported(null);
              if (source === "imported") setSource(school ? "school" : OWN);
            }}
          >
            Remove imported scheme
          </button>
        )}
      </div>
      <input
        ref={schemeFile}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > MAX_SCHEME_FILE) throw Error("This scheme file is too large.");
            const s = parseScheme(await f.text(), f.name);
            saveImportedScheme(s);
            setImported(s);
            setSource("imported");
            setUnitCode("");
            setError("");
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      {scheme ? (
        <>
          <label className="ws-field">
            <span>Unit</span>
            <select value={unitCode} disabled={running} onChange={(e) => chooseUnit(e.target.value)}>
              <option value="">Choose a unit</option>
              {scheme.units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} {u.title}
                  {u.years?.length ? ` (Year ${u.years.join(", ")})` : ""}
                </option>
              ))}
            </select>
          </label>
          {unit && (
            <fieldset className="bk-objectives" disabled={running}>
              <legend>Lessons: one for each ticked objective</legend>
              <div className="ws-ai-row">
                <button className="ws-link-button" onClick={() => setTicked(new Set(unit.objectives.filter((o) => o.code).map((o) => o.code)))}>
                  Tick all
                </button>
                <button className="ws-link-button" onClick={() => setTicked(new Set())}>
                  Untick all
                </button>
              </div>
              {unit.objectives
                .filter((o) => o.code)
                .map((o) => (
                  <label key={o.code} className="ws-check bk-objective">
                    <input
                      type="checkbox"
                      checked={ticked.has(o.code)}
                      onChange={(e) =>
                        setTicked((t) => {
                          const next = new Set(t);
                          if (e.target.checked) next.add(o.code);
                          else next.delete(o.code);
                          return next;
                        })
                      }
                    />
                    <span>
                      <b>{o.code}</b> {o.text}
                    </span>
                  </label>
                ))}
            </fieldset>
          )}
        </>
      ) : (
        <>
          <label className="ws-field">
            <span>Unit code</span>
            <input value={own.code} maxLength={16} disabled={running} placeholder="e.g. A7" onChange={(e) => setOwn({ ...own, code: e.target.value })} />
          </label>
          <label className="ws-field">
            <span>Unit title</span>
            <input value={own.title} maxLength={80} disabled={running} placeholder="e.g. Straight-line graphs" onChange={(e) => setOwn({ ...own, title: e.target.value })} />
          </label>
          <label className="ws-field">
            <span>Objectives, one lesson each (one per line)</span>
            <textarea value={own.objectives} rows={5} disabled={running} placeholder={"A7.01 Plot graphs of y = mx + c\nA7.03 Find the gradient of a straight line"} onChange={(e) => setOwn({ ...own, objectives: e.target.value })} />
          </label>
        </>
      )}
      <label className="ws-field">
        <span>Year or tier</span>
        <input value={group} maxLength={40} disabled={running} placeholder="e.g. Year 9" onChange={(e) => setGroup(e.target.value)} />
      </label>
      <label className="ws-check">
        <input type="checkbox" checked={checkIn} disabled={running} onChange={(e) => setCheckIn(e.target.checked)} />
        Start with a check-in lesson on the skills the unit needs
      </label>
      <label className="ws-field">
        <span>Notes for the AI (optional)</span>
        <textarea value={context} maxLength={1500} rows={3} disabled={running} placeholder="Class, what they found hard last time, calculator or not, anything to include or avoid" onChange={(e) => setContext(e.target.value)} />
      </label>
      {brief && (
        <p className="ws-hint bk-estimate">
          {tooMany
            ? `That is ${lessonCount} lessons; a booklet holds 12. Untick some objectives.`
            : `${lessonCount} lesson${lessonCount > 1 ? "s" : ""}, about ${minutes} minutes${estimate !== null ? `, roughly ${dollars(estimate)} with ${ai.model}` : ""}. Changing one lesson afterwards costs about a tenth of that.`}
        </p>
      )}
      <div className="ws-ai-row">
        <button className="copy-main" disabled={!ai.ready || !brief || tooMany || running || disabled} onClick={() => void makeAll()}>
          {busy === "booklet" ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
          Make booklet
        </button>
        {running && (
          <button className="tool-button" onClick={() => abort.current?.abort()}>
            <Square size={15} aria-hidden="true" /> Stop
          </button>
        )}
      </div>
      {!ai.ready && <p className="ws-hint">Add your API key and model in AI settings first. The same key works for worksheets.</p>}
      {progress && busy === "booklet" && (
        <ol className="bk-progress" aria-live="polite" aria-label="Progress">
          <li className={progress.phase === "planning" ? "doing" : "done"}>
            {progress.phase === "planning" ? <LoaderCircle className="spin" size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Planning the unit and every lesson
          </li>
          {progress.lessons.map((l, i) => (
            <li key={i} className={l.state === "done" ? "done" : l.state === "failed" ? "problem" : l.state === "waiting" ? "waiting" : "doing"}>
              {l.state === "done" ? <Check size={14} aria-hidden="true" /> : l.state === "failed" ? <CircleAlert size={14} aria-hidden="true" /> : l.state === "waiting" ? <span className="bk-dot" aria-hidden="true" /> : <LoaderCircle className="spin" size={14} aria-hidden="true" />}{" "}
              Lesson {i + 1}: {l.title}
              {l.state === "writing" && l.chars ? ` (${Math.round(l.chars / 1000)}k)` : l.state === "checking" ? " (checking)" : l.state === "fixing" ? " (fixing the layout)" : ""}
            </li>
          ))}
        </ol>
      )}
      {error && <p className="ws-hint problem">{error}</p>}

      <h3>Change a lesson</h3>
      <label className="ws-field">
        <span>Lesson</span>
        <select value={target} disabled={running} onChange={(e) => setTarget(Number(e.target.value))}>
          {lessons.map((l, i) => (
            <option key={i} value={i}>
              {i + 1}. {l.title}
              {isPlaceholder(l) ? " (not made yet)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="ws-field">
        <span>What should change?</span>
        <textarea value={change} maxLength={1500} rows={3} disabled={running} placeholder="e.g. Add two negative-gradient questions to Practice, or make the check-in about substitution" onChange={(e) => setChange(e.target.value)} />
      </label>
      <div className="ws-ai-row">
        <button className="tool-button" disabled={!ai.ready || !change.trim() || running || disabled || placeholder} onClick={() => void changeLesson(false)}>
          {busy === "lesson" && change.trim() ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : null}
          Apply change
        </button>
        {confirmRebuild ? (
          <>
            <button className="tool-button" disabled={running || disabled} onClick={() => void changeLesson(true)}>
              Rebuild lesson {target + 1}
            </button>
            <button className="tool-button" onClick={() => setConfirmRebuild(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="tool-button" disabled={!ai.ready || running || disabled} title="Write this lesson again from its plan in Teacher notes" onClick={() => (placeholder ? void changeLesson(true) : setConfirmRebuild(true))}>
            Rebuild lesson
          </button>
        )}
      </div>
      {confirmRebuild && <p className="ws-hint">Rebuilding writes lesson {target + 1} again from its plan and replaces your edits to it. You can undo it.</p>}
      <p className="ws-hint" role="status" aria-live="polite">
        {stageLine(lessonStage)}
      </p>
      {ai.spendUi}

      {made && (
        <details className="ws-ai-notes">
          <summary>Teacher notes from the AI</summary>
          {made.flags.length > 0 && (
            <>
              <h4>Check these</h4>
              <ul className="bk-flags">
                {made.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          )}
          <h4>Unit plan</h4>
          <p className="ws-pre">{made.plan.plan}</p>
          <p className="ws-hint">
            {made.model}: {made.usage.input + made.usage.cacheRead + made.usage.cacheWrite} input and {made.usage.output} output tokens
            {(() => {
              const c = estimateCost(ai.settings.provider, made.model, made.usage);
              return c !== null ? `, about ${dollars(c)}` : "";
            })()}
            . Each lesson's plan is in its Teacher notes.
          </p>
        </details>
      )}
    </section>
  );
}
