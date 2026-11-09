import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Sparkles, Square } from "lucide-react";
import type { Resource } from "../../../packages/resource-core/src/index";
import { changeRequest, firstRequest, type Brief } from "./brief";
import { claudeModels } from "./models";
import { listModels, makeWorksheet } from "./run";
import { loadImportedScheme, loadSchoolScheme, parseScheme, saveImportedScheme, type Scheme } from "./scheme";
import { efforts, estimateCost, forgetKeys, loadKey, loadSettings, providers, saveKey, saveSettings, type AiSettings } from "./settings";
import type { RunResult, Stage } from "./types";

const MAX_SCHEME_FILE = 2_000_000;
const OWN = "own";

function stageText(s: Stage | null): string {
  if (!s) return "";
  if (s.kind === "thinking") return "Planning the progression…";
  if (s.kind === "writing") return `Writing the questions… (${Math.round(s.chars / 1000)}k characters)`;
  if (s.kind === "checking") return "Checking the layout…";
  return `The sheet needed changes to fit (try ${s.attempt + 1}). Fixing them…`;
}

export interface AiPanelProps {
  current: Resource;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  /** Applies the new worksheet as one undoable change. */
  onApply: (resource: Resource, message: string) => void;
}

/** Make a worksheet from an objective with the teacher's own AI key, then ask for changes. */
export function AiPanel({ current, disabled, onBusyChange, onApply }: AiPanelProps) {
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [key, setKey] = useState(() => loadKey(settings.provider));
  const [models, setModels] = useState<string[]>([]);
  const [keyMessage, setKeyMessage] = useState("");
  const [school, setSchool] = useState<Scheme | null>(null);
  const [imported, setImported] = useState<Scheme | null>(loadImportedScheme);
  const [source, setSource] = useState<string>(OWN);
  const [unitCode, setUnitCode] = useState("");
  const [brief, setBrief] = useState<Brief>({ code: "", objective: "", group: "", context: "" });
  const [change, setChange] = useState("");
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState<RunResult | null>(null);
  const abort = useRef<AbortController | null>(null);
  const schemeFile = useRef<HTMLInputElement>(null);
  const running = stage !== null;
  const provider = providers.find((p) => p.id === settings.provider)!;
  const model = settings.models[settings.provider];

  useEffect(() => saveSettings(settings), [settings]);
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

  const scheme = source === "school" ? school : source === "imported" ? imported : null;
  const unit = scheme?.units.find((u) => u.code === unitCode) ?? null;
  const modelChoices = useMemo(() => {
    const listed = settings.provider === "anthropic" ? [...claudeModels.map((m) => m.id), ...models.filter((m) => !claudeModels.some((c) => c.id === m))] : models;
    return model && !listed.includes(model) ? [model, ...listed] : listed;
  }, [settings.provider, models, model]);

  function update(next: Partial<AiSettings>) {
    setSettings((s) => ({ ...s, ...next }));
  }
  function switchProvider(p: AiSettings["provider"]) {
    update({ provider: p });
    setKey(loadKey(p));
    setModels([]);
    setKeyMessage("");
  }
  function commitKey(value: string) {
    setKey(value);
    saveKey(settings.provider, value, settings.remember);
  }
  async function checkKey() {
    setKeyMessage("Checking the key…");
    try {
      const ids = await listModels(settings.provider, key.trim());
      setModels(ids);
      if (settings.provider === "openai" && !model && ids[0]) update({ models: { ...settings.models, openai: ids[0] } });
      setKeyMessage(`Key works. ${ids.length} models available.`);
    } catch (e) {
      setKeyMessage(e instanceof Error ? e.message.replace(/^.*?(401|invalid x-api-key|Incorrect API key).*$/i, `${provider.label} did not accept this key.`) : String(e));
    }
  }

  async function run(request: string, success: (r: RunResult) => string) {
    if (running || disabled) return;
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    setStage({ kind: "thinking" });
    onBusyChange(true);
    try {
      const result = await makeWorksheet(settings.provider, { apiKey: key.trim(), model, effort: settings.effort, request, signal: controller.signal, onStage: setStage });
      setLast(result);
      onApply(result.resource, success(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setStage(null);
      onBusyChange(false);
    }
  }

  const ready = key.trim().length > 0 && model.length > 0;
  const canMake = ready && brief.objective.trim().length > 0 && !running && !disabled;
  const cost = last ? estimateCost(last.model, last.usage) : null;

  return (
    <section className="panel-card ws-ai" aria-label="Make with AI">
      <h2>
        <Sparkles size={17} aria-hidden="true" /> Make with AI
      </h2>
      <details className="ws-ai-settings" open={!ready}>
        <summary>AI settings{ready ? `: ${provider.label}, ${model}` : ""}</summary>
        <label className="ws-field">
          <span>AI provider</span>
          <select value={settings.provider} disabled={running} onChange={(e) => switchProvider(e.target.value as AiSettings["provider"])}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ws-field">
          <span>Your API key</span>
          <input type="password" autoComplete="off" spellCheck={false} value={key} disabled={running} onChange={(e) => commitKey(e.target.value)} placeholder={settings.provider === "anthropic" ? "sk-ant-…" : "sk-…"} />
        </label>
        <p className="ws-hint">{provider.keyHelp} The key goes only from this browser to {provider.label.replace(/ \(.*/, "")}; MathsDock never sees or stores it.</p>
        {key.trim() && !provider.keyPattern.test(key.trim()) && <p className="ws-hint problem">This does not look like a {provider.label} key.</p>}
        <label className="ws-check">
          <input
            type="checkbox"
            checked={settings.remember}
            disabled={running}
            onChange={(e) => {
              update({ remember: e.target.checked });
              saveKey(settings.provider, key, e.target.checked);
            }}
          />
          Remember my key on this device
        </label>
        <div className="ws-ai-row">
          <button className="tool-button" disabled={running || !key.trim()} onClick={() => void checkKey()}>
            Check key
          </button>
          <button
            className="tool-button"
            disabled={running}
            onClick={() => {
              forgetKeys();
              setKey("");
              setModels([]);
              setKeyMessage("Keys removed from this device.");
            }}
          >
            Forget keys
          </button>
        </div>
        {keyMessage && (
          <p className="ws-hint" role="status">
            {keyMessage}
          </p>
        )}
        <label className="ws-field">
          <span>Model</span>
          {modelChoices.length ? (
            <select value={model} disabled={running} onChange={(e) => update({ models: { ...settings.models, [settings.provider]: e.target.value } })}>
              {modelChoices.map((id) => (
                <option key={id} value={id}>
                  {claudeModels.find((c) => c.id === id)?.label ?? id}
                </option>
              ))}
            </select>
          ) : (
            <input value={model} disabled={running} placeholder="Check the key to list models" onChange={(e) => update({ models: { ...settings.models, [settings.provider]: e.target.value.trim() } })} />
          )}
        </label>
        <label className="ws-field">
          <span>Thinking level</span>
          <select value={settings.effort} disabled={running} onChange={(e) => update({ effort: e.target.value as AiSettings["effort"] })}>
            {efforts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      </details>

      <h3>Objective</h3>
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
          <option value={OWN}>Type my own objective</option>
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
      {scheme && (
        <>
          <label className="ws-field">
            <span>Unit</span>
            <select value={unitCode} disabled={running} onChange={(e) => setUnitCode(e.target.value)}>
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
            <label className="ws-field">
              <span>Objective</span>
              <select
                value={unit.objectives.find((o) => o.code === brief.code && o.text === brief.objective)?.code ?? ""}
                disabled={running}
                onChange={(e) => {
                  const o = unit.objectives.find((x) => x.code === e.target.value);
                  if (o) setBrief((b) => ({ ...b, code: o.code, objective: o.text, group: b.group || (unit.years?.length === 1 ? `Year ${unit.years[0]}` : b.group) }));
                }}
              >
                <option value="">Choose an objective</option>
                {unit.objectives.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.code} {o.text}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <label className="ws-field">
        <span>Objective code</span>
        <input value={brief.code} maxLength={16} disabled={running} placeholder="e.g. SP7.01" onChange={(e) => setBrief({ ...brief, code: e.target.value })} />
      </label>
      <label className="ws-field">
        <span>Learning objective</span>
        <textarea value={brief.objective} maxLength={200} rows={2} disabled={running} onChange={(e) => setBrief({ ...brief, objective: e.target.value.replace(/\s*\n\s*/g, " ") })} />
      </label>
      <label className="ws-field">
        <span>Year or tier</span>
        <input value={brief.group} maxLength={40} disabled={running} placeholder="e.g. Year 9" onChange={(e) => setBrief({ ...brief, group: e.target.value })} />
      </label>
      <label className="ws-field">
        <span>Notes for the AI (optional)</span>
        <textarea value={brief.context} maxLength={1500} rows={3} disabled={running} placeholder="Class, prior teaching, calculator or not, anything to include or avoid" onChange={(e) => setBrief({ ...brief, context: e.target.value })} />
      </label>
      <div className="ws-ai-row">
        <button className="copy-main" disabled={!canMake} onClick={() => void run(firstRequest(brief), (r) => `New worksheet made by ${r.model}. Undo brings back the previous one.`)}>
          {running ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
          Make worksheet
        </button>
        {running && (
          <button className="tool-button" onClick={() => abort.current?.abort()}>
            <Square size={15} aria-hidden="true" /> Stop
          </button>
        )}
      </div>
      {!ready && <p className="ws-hint">Add your API key and model in AI settings first.</p>}
      <p className="ws-hint" role="status" aria-live="polite">
        {stageText(stage)}
      </p>
      {error && <p className="ws-hint problem">{error}</p>}

      <h3>Ask for a change</h3>
      <label className="ws-field">
        <span>What should change?</span>
        <textarea value={change} maxLength={1500} rows={3} disabled={running} placeholder="e.g. Make question 3 use decimals, or add a spot-the-mistake question on side 2" onChange={(e) => setChange(e.target.value)} />
      </label>
      <button
        className="tool-button"
        disabled={!ready || !change.trim() || running || disabled}
        onClick={() =>
          void run(changeRequest(current, change), (r) => {
            setChange("");
            return `Change made by ${r.model}. Undo brings back the previous version.`;
          })
        }
      >
        Apply change
      </button>

      {last && (
        <details className="ws-ai-notes">
          <summary>Teacher notes from the AI</summary>
          {last.submission.flags.trim() && (
            <>
              <h4>Check these</h4>
              <p className="ws-pre">{last.submission.flags}</p>
            </>
          )}
          <h4>Plan</h4>
          <p className="ws-pre">{last.submission.plan}</p>
          <p className="ws-hint">
            {last.model}: {last.usage.input + last.usage.cacheRead + last.usage.cacheWrite} input and {last.usage.output} output tokens
            {last.attempts > 1 ? `, ${last.attempts} tries to fit the page` : ""}
            {cost !== null ? `, about $${cost.toFixed(2)}` : ""}. Check every question and answer before printing.
          </p>
        </details>
      )}
    </section>
  );
}
