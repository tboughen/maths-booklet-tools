import { claudeModels } from "./models";
import type { Effort, Provider, Usage } from "./types";

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

export const defaultSettings = (): AiSettings => ({ provider: "anthropic", models: { anthropic: claudeModels[0].id, openai: "" }, effort: "medium", remember: false });

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
      provider: raw.provider === "openai" ? "openai" : "anthropic",
      models: { anthropic: typeof raw.models?.anthropic === "string" && raw.models.anthropic ? raw.models.anthropic : base.models.anthropic, openai: typeof raw.models?.openai === "string" ? raw.models.openai : "" },
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
  for (const p of ["anthropic", "openai"] as const) {
    write(() => sessionStorage, KEY(p), null);
    write(() => localStorage, KEY(p), null);
  }
}

/** Approximate cost in US dollars, for Claude models with a known price; null when unknown. */
export function estimateCost(model: string, u: Usage): number | null {
  const m = claudeModels.find((c) => model.startsWith(c.id));
  if (!m) return null;
  const [inP, outP, readP] = m.price;
  return (u.input * inP + u.cacheWrite * inP * 1.25 + u.cacheRead * readP + u.output * outP) / 1e6;
}
