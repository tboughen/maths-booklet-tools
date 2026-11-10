import { claudeModels } from "./models";
import type { Effort, Provider } from "./types";

/**
 * AI settings live on this device only. API keys are kept for this browser tab by default
 * (sessionStorage) and on the device only when the teacher ticks "Remember". They are never
 * written into worksheet files, links or exports, and they go only to the chosen provider.
 */
export interface AiSettings {
  provider: Provider;
  models: Record<Provider, string>;
  effort: Effort;
  remember: boolean;
}

const SETTINGS = "maths-booklet-tools:worksheet-ai:v1";
const KEY = (p: Provider) => `maths-booklet-tools:worksheet-ai-key:${p}`;

export const defaultSettings = (): AiSettings => ({ provider: "anthropic", models: { anthropic: claudeModels[0].id, openai: "", gemini: "" }, effort: "medium", remember: false });

export const efforts: { id: Effort; label: string }[] = [
  { id: "low", label: "Low (quickest)" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Very high" },
  { id: "max", label: "Maximum (slowest)" },
];

export const providers: { id: Provider; label: string; keyHelp: string; keyPattern: RegExp }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", keyHelp: "Create a key at console.anthropic.com under API keys. A claude.ai plan does not include API use.", keyPattern: /^sk-ant-[\w-]{20,}$/ },
  { id: "openai", label: "ChatGPT (OpenAI)", keyHelp: "Create a key at platform.openai.com under API keys, with pay-as-you-go credit. A ChatGPT subscription does not include API use.", keyPattern: /^sk-[\w-]{20,}$/ },
  { id: "gemini", label: "Gemini (Google)", keyHelp: "Create a key at aistudio.google.com under Get API key, on a project with billing turned on. A Gemini app subscription does not include API use.", keyPattern: /^AIza[\w-]{30,}$/ },
];

function read(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function write(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    /* storage blocked: settings last for this page only */
  }
}

export function loadSettings(): AiSettings {
  const base = defaultSettings();
  try {
    const raw = JSON.parse(read(() => localStorage, SETTINGS) ?? "null");
    if (!raw || typeof raw !== "object") return base;
    return {
      provider: raw.provider === "openai" || raw.provider === "gemini" ? raw.provider : "anthropic",
      models: {
        anthropic: typeof raw.models?.anthropic === "string" && raw.models.anthropic ? raw.models.anthropic : base.models.anthropic,
        openai: typeof raw.models?.openai === "string" ? raw.models.openai : "",
        gemini: typeof raw.models?.gemini === "string" ? raw.models.gemini : "",
      },
      effort: efforts.some((e) => e.id === raw.effort) ? raw.effort : base.effort,
      remember: raw.remember === true,
    };
  } catch {
    return base;
  }
}
export const saveSettings = (s: AiSettings) => write(() => localStorage, SETTINGS, JSON.stringify(s));

export const loadKey = (p: Provider) => read(() => sessionStorage, KEY(p)) ?? read(() => localStorage, KEY(p)) ?? "";
export function saveKey(p: Provider, key: string, remember: boolean) {
  const k = key.trim() || null;
  write(() => sessionStorage, KEY(p), k);
  write(() => localStorage, KEY(p), remember ? k : null);
}
export function forgetKeys() {
  for (const p of providers.map((x) => x.id)) {
    write(() => sessionStorage, KEY(p), null);
    write(() => localStorage, KEY(p), null);
  }
}

/** Running estimate of AI spend in this browser tab, counted per reply so failed and stopped runs count too. */
export interface Spend {
  replies: number;
  dollars: number;
  /** Replies from models without a listed price: their tokens are not in `dollars`. */
  unpriced: number;
}
const SPEND = "maths-booklet-tools:worksheet-ai-spend:v1";
export const noSpend = (): Spend => ({ replies: 0, dollars: 0, unpriced: 0 });
export function loadSpend(): Spend {
  try {
    const raw = JSON.parse(read(() => sessionStorage, SPEND) ?? "null");
    if (raw && [raw.replies, raw.dollars, raw.unpriced].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) return { replies: raw.replies, dollars: raw.dollars, unpriced: raw.unpriced };
  } catch {
    /* fall through */
  }
  return noSpend();
}
export const saveSpend = (s: Spend) => write(() => sessionStorage, SPEND, JSON.stringify(s));
export const addSpend = (s: Spend, cost: number | null): Spend => (cost === null ? { ...s, replies: s.replies + 1, unpriced: s.unpriced + 1 } : { ...s, replies: s.replies + 1, dollars: s.dollars + cost });
