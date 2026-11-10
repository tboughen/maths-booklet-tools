import type { Provider, Usage } from "./types";

/**
 * Published API prices, in US dollars per million tokens, standard tier. The providers offer no
 * prices API and a web page cannot read their pricing pages, so the table lives here and is
 * checked weekly against:
 *   Anthropic  https://platform.claude.com/docs/en/about-claude/pricing
 *   OpenAI     https://developers.openai.com/api/docs/pricing
 *   Google     https://ai.google.dev/gemini-api/docs/pricing
 * A worksheet prompt is far below every long-context threshold (200K to 272K tokens), so only the
 * short-context rates are listed. Thinking tokens are billed as output by all three providers.
 */
export const PRICES_CHECKED = "2026-11-10";

export interface Rate {
  /** First day (UTC, YYYY-MM-DD) this rate applies; absent means "until the next dated rate". */
  from?: string;
  input: number;
  output: number;
  cacheRead: number;
  /** Prompt-cache writes. Only Anthropic bills them (1.25 times input for the 5-minute cache). */
  cacheWrite?: number;
}

export interface Price {
  provider: Provider;
  /** The model id as the provider lists it, without a dated snapshot suffix. */
  id: string;
  /** Oldest first; dated entries record announced price changes. */
  rates: Rate[];
}

const claude = (id: string, input: number, output: number, cacheRead: number): Price => ({ provider: "anthropic", id, rates: [{ input, output, cacheRead, cacheWrite: input * 1.25 }] });
const gpt = (id: string, input: number, cacheRead: number, output: number): Price => ({ provider: "openai", id, rates: [{ input, output, cacheRead }] });
const gemini = (id: string, ...rates: Rate[]): Price => ({ provider: "gemini", id, rates });

export const prices: Price[] = [
  claude("claude-fable-5-2", 8, 40, 0.2),
  claude("claude-opus-5-5", 4, 20, 0.2),
  claude("claude-sonnet-5-5", 2, 10, 0.1),
  claude("claude-haiku-5-5", 0.1, 0.5, 0.01),

  gpt("gpt-6-astra", 10, 1, 50),
  gpt("gpt-6.1-sol", 2, 0.1, 10),
  gpt("gpt-6.1-terra", 1, 0.05, 5),
  gpt("gpt-6-sol", 2, 0.2, 10),
  gpt("gpt-6-luna", 0.1, 0.01, 0.5),
  gpt("gpt-5.6-sol", 4, 0.4, 20),
  gpt("gpt-5.6-terra", 2, 0.2, 12),
  gpt("gpt-5.6-luna", 0.2, 0.02, 1.2),
  gpt("gpt-5.5", 5, 0.5, 30),
  gpt("gpt-5.4", 2.5, 0.25, 15),
  gpt("gpt-5.4-mini", 0.75, 0.075, 4.5),
  gpt("gpt-5.4-nano", 0.2, 0.02, 1.25),
  gpt("gpt-5.2", 1.75, 0.175, 14),
  gpt("gpt-5.1", 1.25, 0.125, 10),
  gpt("gpt-5", 1.25, 0.125, 10),
  gpt("gpt-5-mini", 0.25, 0.025, 2),
  gpt("gpt-5-nano", 0.05, 0.005, 0.4),
  gpt("gpt-4.1", 2, 0.5, 8),
  gpt("gpt-4.1-mini", 0.4, 0.1, 1.6),
  gpt("gpt-4o", 2.5, 1.25, 10),
  gpt("gpt-4o-mini", 0.15, 0.075, 0.6),
  gpt("o3", 2, 0.5, 8),

  gemini("gemini-4-argon", { input: 2, output: 10, cacheRead: 0.1 }, { from: "2026-12-01", input: 4, output: 20, cacheRead: 0.2 }),
  gemini("gemini-4-carbon", { input: 2, output: 10, cacheRead: 0.1 }, { from: "2026-12-01", input: 4, output: 20, cacheRead: 0.2 }),
  gemini("gemini-3.8-flash", { input: 0.75, output: 3.75, cacheRead: 0.075 }, { from: "2027-01-01", input: 1.5, output: 7.5, cacheRead: 0.15 }),
  gemini("gemini-3.6-flash", { input: 0.75, output: 3.75, cacheRead: 0.075 }, { from: "2027-01-01", input: 1.5, output: 7.5, cacheRead: 0.15 }),
  gemini("gemini-3.5-flash-lite", { input: 0.3, output: 2.5, cacheRead: 0.03 }),
];

/** A listed id, or one followed by a dated or numbered snapshot (gpt-5.4-2026-08-01, gemini-3.8-flash-001). */
function matches(model: string, id: string): boolean {
  const m = model.replace(/^models\//, "");
  return m === id || (m.startsWith(id) && /^-(\d|latest$)/.test(m.slice(id.length)));
}

export function priceFor(provider: Provider, model: string): Price | null {
  return prices.filter((p) => p.provider === provider && matches(model, p.id)).sort((a, b) => b.id.length - a.id.length)[0] ?? null;
}

/** The rate that applies on a day (YYYY-MM-DD, UTC). */
export function rateOn(price: Price, day: string): Rate {
  return price.rates.filter((r) => !r.from || r.from <= day).at(-1) ?? price.rates[0];
}

/** Approximate cost in US dollars at today's published price; null when the model is not in the table. */
export function estimateCost(provider: Provider, model: string, u: Usage, now = new Date()): number | null {
  const price = priceFor(provider, model);
  if (!price) return null;
  const r = rateOn(price, now.toISOString().slice(0, 10));
  return (u.input * r.input + u.cacheWrite * (r.cacheWrite ?? r.input) + u.cacheRead * r.cacheRead + u.output * r.output) / 1e6;
}

/** Where the teacher sees their real balance and spend: no provider lets a key read it. */
export const billingPages: Record<Provider, string> = {
  anthropic: "https://platform.claude.com/settings/billing",
  openai: "https://platform.openai.com/settings/organization/billing/overview",
  gemini: "https://aistudio.google.com/usage",
};
