import { afterEach, describe, expect, it, vi } from "vitest";
import { treeDiagrams } from "../../../packages/resource-core/src/fixtures";
import type { Resource } from "../../../packages/resource-core/src/index";
import { changeRequest, firstRequest, systemPrompt, toolSchema, TOOL_NAME } from "./brief";
import { checkSubmission } from "./check";
import { makeWithClaude } from "./anthropic";
import { makeWithGemini } from "./gemini";
import { makeWithOpenAI } from "./openai";
import { estimateCost, priceFor, prices, PRICES_CHECKED } from "./prices";
import { loadSchoolScheme, parseScheme } from "./scheme";
import { addSpend, noSpend } from "./settings";
import { familiesFor, familyNotes } from "./families";

const fits = (): Resource => structuredClone(treeDiagrams);
function overflowing(): Resource {
  const r = fits();
  r.document.sides[0].columns[0].cards[0].items.push({ type: "space", kind: "working", heightMm: 200 });
  return r;
}
const submit = (resource: Resource) => ({ plan: "Plan for the teacher.", flags: "", resource });

describe("worksheet AI brief", () => {
  it("offers one tool whose schema is the resource schema, and keeps the system prompt stable", () => {
    expect(toolSchema.$schema).toBeUndefined();
    expect(Object.keys((toolSchema as { properties: object }).properties)).toEqual(["plan", "flags", "resource"]);
    expect(JSON.stringify(toolSchema).length).toBeLessThan(40_000);
    expect(systemPrompt).toContain("Maths Resource Design Guide");
    expect(systemPrompt).toContain(TOOL_NAME);
    expect(systemPrompt).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // nothing volatile that would break caching
    expect(firstRequest({ code: "SP7.01", objective: "List outcomes", group: "Year 9", context: "" })).toContain("Objective code: SP7.01");
    expect(changeRequest(fits(), "Use dice")).toContain('"kind":"worksheet-a3"');
  });

  it("accepts a sheet that fits and returns specific problems otherwise", () => {
    expect(checkSubmission(submit(fits())).ok).toBe(true);
    const schema = checkSubmission({ plan: "", flags: "", resource: { tool: "resource" } });
    expect(schema.ok).toBe(false);
    expect(!schema.ok && schema.feedback).toContain("does not match the schema");
    const layout = checkSubmission(submit(overflowing()));
    expect(layout.ok).toBe(false);
    expect(!layout.ok && layout.feedback).toMatch(/side 1, column 1: .*needs [\d.]+ mm more height/);
  });
});

describe("diagram families for a request", () => {
  it("sends only the families an objective needs, plus any already on the sheet", () => {
    expect(familiesFor("Solve problems using Pythagoras' theorem")).toEqual(["triangle"]);
    expect(familiesFor("Simplify fractions")).toEqual([]);
    expect(familiesFor("Simplify fractions", fits())).toContain("probability-tree");
    const notes = familyNotes(["venn"]);
    expect(notes).toContain('<family kind="venn"');
    expect(notes).not.toContain('kind="triangle"');
    expect(familyNotes([])).toMatch(/none suggested/);
    expect(firstRequest({ code: "N1.01", objective: "Draw a Venn diagram of sets", group: "", context: "" })).toContain('<family kind="venn"');
  });
});

describe("schemes of work", () => {
  it("reads a CSV of codes and objectives, grouped into units", () => {
    const s = parseScheme('code,objective,unit\nSP7.01,"List outcomes, using a tree diagram",Understanding risk\nSP7.02,Know the multiplication law,\nA4.02,Use algebraic notation,Tinkering', "Our scheme.csv");
    expect(s.name).toBe("Our scheme");
    expect(s.units.map((u) => [u.code, u.title, u.objectives.length])).toEqual([
      ["SP7", "Understanding risk", 2],
      ["A4", "Tinkering", 1],
    ]);
    expect(s.units[0].objectives[0].text).toBe("List outcomes, using a tree diagram");
  });
  it("reads MathsDock scheme JSON and refuses other files with a reason", () => {
    const json = JSON.stringify({ schemaVersion: 1, kind: "scheme-of-work", name: "S", units: [{ code: "NP1", title: "Number", objectives: [{ code: "NP1.01", text: "Order integers" }] }] });
    expect(parseScheme(json, "s.json").units[0].objectives[0].code).toBe("NP1.01");
    expect(() => parseScheme('{"a":1}', "x.json")).toThrow(/not a MathsDock scheme file/);
    expect(() => parseScheme("\n\n", "x.csv")).toThrow(/No objectives found/);
  });
});

describe("the department scheme", () => {
  afterEach(() => vi.unstubAllGlobals());
  const scheme = { schemaVersion: 1, kind: "scheme-of-work", name: "Department", units: [{ code: "SP7", title: "Risk", objectives: [{ code: "SP7.01", text: "List outcomes" }] }] };
  const object = `bank/assets/sha256/${"e".repeat(64)}.json`;
  it("follows the scheme index to the gated object", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url);
      return Response.json(url.endsWith("bank/schemes.json") ? { schemaVersion: 1, school: object } : scheme);
    }));
    expect((await loadSchoolScheme())?.units[0].objectives[0].code).toBe("SP7.01");
    expect(urls).toEqual(["/bank/schemes.json", `/${object}`]);
  });
  it("offers typed objectives when there is no scheme, or the site answers with its page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ schemaVersion: 1 })));
    expect(await loadSchoolScheme()).toBeNull();
    const cancel = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, headers: new Headers({ "content-type": "text/html" }), body: { cancel } })));
    expect(await loadSchoolScheme()).toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});

describe("cost estimate", () => {
  const million = { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 };
  it("prices Claude, ChatGPT and Gemini models and leaves unknown models blank", () => {
    expect(estimateCost("anthropic", "claude-opus-5-5", million)).toBeCloseTo(24);
    expect(estimateCost("anthropic", "claude-opus-5-5", { input: 0, output: 0, cacheRead: 1e6, cacheWrite: 1e6 })).toBeCloseTo(0.2 + 5);
    expect(estimateCost("openai", "gpt-6.1-sol", { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 0 })).toBeCloseTo(12.1);
    expect(estimateCost("gemini", "gemini-3.8-flash", million, new Date("2026-11-10T12:00:00Z"))).toBeCloseTo(4.5);
    expect(estimateCost("openai", "gpt-x", { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 })).toBeNull();
    // A Claude id under another provider is not priced as Claude.
    expect(estimateCost("openai", "claude-opus-5-5", million)).toBeNull();
  });
  it("matches dated snapshots but not a different model with a longer name", () => {
    expect(priceFor("openai", "gpt-5.4-2026-08-01")?.id).toBe("gpt-5.4");
    expect(priceFor("openai", "gpt-5.4-mini")?.id).toBe("gpt-5.4-mini");
    expect(priceFor("openai", "gpt-5-pro")).toBeNull();
    expect(priceFor("gemini", "models/gemini-3.8-flash-001")?.id).toBe("gemini-3.8-flash");
    expect(priceFor("gemini", "gemini-3.8-flash-lite")).toBeNull();
  });
  it("uses an announced price from its start date", () => {
    expect(estimateCost("gemini", "gemini-4-argon", million, new Date("2026-11-30T23:00:00Z"))).toBeCloseTo(12);
    expect(estimateCost("gemini", "gemini-4-argon", million, new Date("2026-12-01T00:00:00Z"))).toBeCloseTo(24);
  });
  it("keeps the table well formed", () => {
    expect(PRICES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const p of prices) {
      expect(p.rates.length, p.id).toBeGreaterThan(0);
      const dates = p.rates.map((r) => r.from ?? "");
      expect(dates, p.id).toEqual([...dates].sort());
      for (const r of p.rates) for (const n of [r.input, r.output, r.cacheRead]) expect(n, p.id).toBeGreaterThan(0);
    }
    expect(new Set(prices.map((p) => `${p.provider}:${p.id}`)).size).toBe(prices.length);
  });
  it("adds up spend in this tab and counts unpriced replies separately", () => {
    const s = addSpend(addSpend(noSpend(), 0.25), null);
    expect(s).toEqual({ replies: 2, dollars: 0.25, unpriced: 1 });
  });
});

// The provider SDKs are exercised against recorded-shape streams, so the fix loop is tested without a key.
const sse = (events: { event?: string; data: unknown }[]) =>
  new Response(events.map((e) => `${e.event ? `event: ${e.event}\n` : ""}data: ${JSON.stringify(e.data)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });

function claudeTurn(input: unknown, id: string) {
  const json = JSON.stringify(input);
  const ev = (type: string, data: object) => ({ event: type, data: { type, ...data } });
  return sse([
    ev("message_start", { message: { id: `msg_${id}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 50, cache_creation_input_tokens: 0 } } }),
    ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: `toolu_${id}`, name: TOOL_NAME, input: {} } }),
    ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: json.slice(0, 40) } }),
    ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: json.slice(40) } }),
    ev("content_block_stop", { index: 0 }),
    ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 900 } }),
    ev("message_stop", {}),
  ]);
}

function openaiTurn(input: unknown, id: string) {
  const args = JSON.stringify(input);
  const item = { type: "function_call", id: `fc_${id}`, call_id: `call_${id}`, name: TOOL_NAME, arguments: args, status: "completed" };
  const base = { id: `resp_${id}`, object: "response", created_at: 1, model: "gpt-test", output: [] as object[], status: "in_progress", parallel_tool_calls: true, tool_choice: "auto", tools: [], error: null, incomplete_details: null, instructions: null, metadata: {}, temperature: 1, top_p: 1 };
  let n = 0;
  const ev = (type: string, data: object) => ({ data: { type, sequence_number: n++, ...data } });
  return sse([
    ev("response.created", { response: base }),
    ev("response.output_item.added", { output_index: 0, item: { ...item, arguments: "", status: "in_progress" } }),
    ev("response.function_call_arguments.delta", { item_id: item.id, output_index: 0, delta: args }),
    ev("response.function_call_arguments.done", { item_id: item.id, output_index: 0, arguments: args, name: TOOL_NAME }),
    ev("response.output_item.done", { output_index: 0, item }),
    ev("response.completed", { response: { ...base, status: "completed", output: [item], usage: { input_tokens: 120, input_tokens_details: { cached_tokens: 20 }, output_tokens: 800, output_tokens_details: { reasoning_tokens: 300 }, total_tokens: 920 } } }),
  ]);
}

function geminiTurn(input: unknown, id: string) {
  const call = { functionCall: { id: `call_${id}`, name: TOOL_NAME, args: input }, thoughtSignature: `sig_${id}` };
  return sse([
    { data: { candidates: [{ content: { role: "model", parts: [{ text: "Planning", thought: true }] } }], modelVersion: "gemini-3.8-flash" } },
    { data: { candidates: [{ content: { role: "model", parts: [call] }, finishReason: "STOP" }], modelVersion: "gemini-3.8-flash", usageMetadata: { promptTokenCount: 150, cachedContentTokenCount: 50, candidatesTokenCount: 600, thoughtsTokenCount: 400, totalTokenCount: 1150 } } },
  ]);
}

describe("making a worksheet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("with Claude: returns layout problems to the model and keeps the sheet that fits", async () => {
    const bodies: Record<string, unknown>[] = [];
    const turns = [claudeTurn(submit(overflowing()), "1"), claudeTurn(submit(fits()), "2")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return turns.shift()!;
      }),
    );
    const stages: string[] = [];
    const result = await makeWithClaude({ apiKey: "sk-ant-test-0000000000000000000000", model: "claude-opus-5-5", effort: "high", request: "Make it", onStage: (s) => stages.push(s.kind) });
    expect(result.attempts).toBe(2);
    expect(result.resource.document.title).toBe(treeDiagrams.document.title);
    expect(result.usage).toEqual({ input: 200, output: 1800, cacheRead: 100, cacheWrite: 0 });
    expect(stages).toEqual(expect.arrayContaining(["thinking", "writing", "checking", "fixing"]));
    expect(bodies[0]).toMatchObject({ model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "high" }, cache_control: { type: "ephemeral" }, fallbacks: "default", stream: true });
    expect(bodies[0].tool_choice).toBeUndefined();
    const retry = (bodies[1].messages as { role: string; content: unknown }[]).at(-1)!;
    expect(retry.role).toBe("user");
    expect(retry.content).toEqual([expect.objectContaining({ type: "tool_result", tool_use_id: "toolu_1", is_error: true, content: expect.stringContaining("mm more height") })]);
  });

  it("with ChatGPT: stores nothing at OpenAI and sends the function result back", async () => {
    const bodies: Record<string, unknown>[] = [];
    const turns = [openaiTurn(submit(overflowing()), "1"), openaiTurn(submit(fits()), "2")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return turns.shift()!;
      }),
    );
    const result = await makeWithOpenAI({ apiKey: "sk-test-00000000000000000000000000", model: "gpt-test", effort: "medium", request: "Make it" });
    expect(result.attempts).toBe(2);
    expect(result.model).toBe("gpt-test");
    expect(result.usage).toEqual({ input: 200, output: 1600, cacheRead: 40, cacheWrite: 0 });
    expect(bodies[0]).toMatchObject({ store: false, include: ["reasoning.encrypted_content"], reasoning: { effort: "medium" }, instructions: systemPrompt });
    expect((bodies[1].input as object[]).at(-1)).toEqual(expect.objectContaining({ type: "function_call_output", call_id: "call_1", output: expect.stringContaining("mm more height") }));
  });

  it("with Gemini: requires the tool, keeps thought signatures and sends the function response back", async () => {
    const bodies: Record<string, unknown>[] = [];
    const urls: string[] = [];
    const turns = [geminiTurn(submit(overflowing()), "1"), geminiTurn(submit(fits()), "2")];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init: RequestInit) => {
        urls.push(String(url instanceof Request ? url.url : url));
        bodies.push(JSON.parse(String(init.body)));
        return turns.shift()!;
      }),
    );
    const seen: number[] = [];
    const result = await makeWithGemini({ apiKey: "AIzaTest000000000000000000000000000000", model: "gemini-3.8-flash", effort: "xhigh", request: "Make it", onUsage: (u) => seen.push(u.output) });
    expect(result.attempts).toBe(2);
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.usage).toEqual({ input: 200, output: 2000, cacheRead: 100, cacheWrite: 0 });
    expect(seen).toEqual([1000, 1000]);
    expect(urls[0]).toContain("generativelanguage.googleapis.com");
    expect(urls[0]).toContain("gemini-3.8-flash:streamGenerateContent");
    expect(bodies[0]).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingLevel: "HIGH" }, maxOutputTokens: 64000 },
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [TOOL_NAME] } },
    });
    const sent = bodies[1].contents as { role: string; parts: Record<string, unknown>[] }[];
    expect(sent[1].role).toBe("model");
    expect(sent[1].parts).toEqual(expect.arrayContaining([expect.objectContaining({ thoughtSignature: "sig_1" })]));
    expect(sent[2]).toEqual({ role: "user", parts: [{ functionResponse: { id: "call_1", name: TOOL_NAME, response: { error: expect.stringContaining("mm more height") } } }] });
  });

  it("stops after four failed tries with a clear message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => claudeTurn(submit(overflowing()), String(Math.random()).slice(2))),
    );
    await expect(makeWithClaude({ apiKey: "sk-ant-test-0000000000000000000000", model: "claude-haiku-5-5", effort: "low", request: "Make it" })).rejects.toThrow(/after 4 tries/);
  });
});
