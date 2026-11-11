import { useEffect, useMemo, useState, type ReactNode } from "react";
import { claudeModels } from "./models";
import { listModels } from "./run";
import { billingPages, estimateCost, PRICES_CHECKED } from "./prices";
import { addSpend, efforts, forgetKeys, loadKey, loadSettings, loadSpend, noSpend, providers, saveKey, saveSettings, saveSpend, type AiSettings, type Spend } from "./settings";
import type { Provider, Usage } from "./types";

const keyPlaceholder: Record<Provider, string> = { anthropic: "sk-ant-…", openai: "sk-…", gemini: "AIza…" };
const billingName: Record<Provider, string> = { anthropic: "Claude Console billing page", openai: "OpenAI billing page", gemini: "Google AI Studio usage page" };
const checkedDate = new Date(`${PRICES_CHECKED}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The teacher's AI provider, key, model, thinking level and running spend, shared by the worksheet
 * and booklet makers: one key set up once works on both pages.
 */
export function useAi(running: boolean) {
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [key, setKey] = useState(() => loadKey(settings.provider));
  const [models, setModels] = useState<string[]>([]);
  const [keyMessage, setKeyMessage] = useState("");
  const [spend, setSpend] = useState<Spend>(loadSpend);
  const provider = providers.find((p) => p.id === settings.provider)!;
  const model = settings.models[settings.provider];

  useEffect(() => saveSettings(settings), [settings]);
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
      if (settings.provider !== "anthropic" && !model && ids[0]) update({ models: { ...settings.models, [settings.provider]: ids[0] } });
      setKeyMessage(`Key works. ${ids.length} models available.`);
    } catch (e) {
      setKeyMessage(e instanceof Error ? e.message.replace(/^.*?(401|invalid x-api-key|Incorrect API key).*$/i, `${provider.label} did not accept this key.`) : String(e));
    }
  }
  /** Counts one reply's cost into the running total. */
  const count = (p: Provider) => (u: Usage, m: string) =>
    setSpend((s) => {
      const next = addSpend(s, estimateCost(p, m, u));
      saveSpend(next);
      return next;
    });

  const ready = key.trim().length > 0 && model.length > 0;
  const settingsUi: ReactNode = (
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
          <input type="password" autoComplete="off" spellCheck={false} value={key} disabled={running} onChange={(e) => commitKey(e.target.value)} placeholder={keyPlaceholder[settings.provider]} />
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
        {settings.provider === "gemini" && (settings.effort === "xhigh" || settings.effort === "max") && <p className="ws-hint">Gemini has three thinking levels, so Very high and Maximum both use its High level.</p>}
      </details>
  );
  const spendUi: ReactNode = (
      <p className="ws-hint ws-ai-spend">
        {spend.replies
          ? `Spent in this tab: about $${spend.dollars.toFixed(2)} over ${spend.replies} AI ${spend.replies === 1 ? "reply" : "replies"}${spend.unpriced ? `, plus ${spend.unpriced} from models with no listed price` : ""}. `
          : "The cost of each AI reply is estimated here. "}
        Prices checked {checkedDate}. No key can read your balance: see the{" "}
        <a href={billingPages[settings.provider]} target="_blank" rel="noreferrer">
          {billingName[settings.provider]}
        </a>
        .
        {spend.replies > 0 && (
          <>
            {" "}
            <button
              className="ws-link-button"
              aria-label="Reset spend estimate"
              disabled={running}
              onClick={() => {
                saveSpend(noSpend());
                setSpend(noSpend());
              }}
            >
              Reset
            </button>
          </>
        )}
      </p>
  );
  return { settings, key: key.trim(), model, provider, ready, count, settingsUi, spendUi };
}
