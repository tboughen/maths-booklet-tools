import { it, expect, describe } from "vitest";
import type { IncomingMessage } from "node:http";
import { TrafficLimits, clientAddress, cloudflareKvQuotaStore, type QuotaStore } from "./limits";

const DAY = Date.UTC(2026, 9, 31, 12);
function memoryStore(initial: Record<string, number> = {}) {
  const values = { ...initial };
  const saves: Array<[string, number]> = [];
  const store: QuotaStore = {
    load: async (day) => values[day] ?? 0,
    save: async (day, bytes) => {
      values[day] = bytes;
      saves.push([day, bytes]);
    },
  };
  return { store, values, saves };
}

describe("daily download allowance across restarts (M61)", () => {
  it("carries today's total into a fresh process", async () => {
    const { store } = memoryStore();
    const first = new TrafficLimits(100, { store, now: () => DAY });
    await first.ready();
    first.output(70, DAY);
    await first.flush();
    // A sleep or restart builds a new limiter; it must remember the 70 bytes.
    const second = new TrafficLimits(100, { store, now: () => DAY });
    await second.ready();
    second.output(30, DAY);
    expect(() => second.output(1, DAY)).toThrow("allowance");
  });
  it("adds bytes served while the stored total was still loading", async () => {
    let release!: (n: number) => void;
    const store: QuotaStore = {
      load: () => new Promise((resolve) => (release = resolve)),
      save: async () => {},
    };
    const limits = new TrafficLimits(100, { store, now: () => DAY });
    limits.output(20, DAY);
    release(75);
    await limits.ready();
    expect(() => limits.output(6, DAY)).toThrow("allowance");
    expect(() => limits.output(5, DAY)).not.toThrow();
  });
  it("never writes before the stored total is known", async () => {
    let release!: (n: number) => void;
    const saves: number[] = [];
    const store: QuotaStore = {
      load: () => new Promise((resolve) => (release = resolve)),
      save: async (_day, bytes) => void saves.push(bytes),
    };
    const limits = new TrafficLimits(1000, { store, now: () => DAY });
    limits.output(10, DAY);
    const flushing = limits.flush();
    release(500);
    await flushing;
    expect(saves).toEqual([510]);
  });
  it("starts a new UTC day from zero and keys the store by day", async () => {
    const { store, saves } = memoryStore({ "2026-10-31": 100 });
    const limits = new TrafficLimits(100, { store, now: () => DAY });
    await limits.ready();
    expect(() => limits.output(1, DAY)).toThrow("allowance");
    const tomorrow = DAY + 24 * 60 * 60 * 1000;
    limits.output(40, tomorrow);
    await limits.flush();
    expect(saves).toEqual([["2026-11-01", 40]]);
  });
  it("keeps serving and retries if the store fails", async () => {
    const errors: string[] = [];
    let fail = true;
    const saves: number[] = [];
    const store: QuotaStore = {
      load: async () => {
        throw Error("down");
      },
      save: async (_day, bytes) => {
        if (fail) throw Error("down");
        saves.push(bytes);
      },
    };
    const limits = new TrafficLimits(100, { store, now: () => DAY, onStoreError: (m) => errors.push(m) });
    await limits.ready();
    limits.output(10, DAY);
    await limits.flush();
    fail = false;
    await limits.flush();
    expect(saves).toEqual([10]);
    expect(errors).toHaveLength(2);
  });
  it("skips writes when nothing changed", async () => {
    const { store, saves } = memoryStore();
    const limits = new TrafficLimits(100, { store, now: () => DAY });
    await limits.flush();
    limits.output(5, DAY);
    await limits.flush();
    await limits.flush();
    expect(saves).toEqual([["2026-10-31", 5]]);
  });
  it("talks to Cloudflare KV with one expiring key per day", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [new Response("not found", { status: 404 }), new Response("{}"), new Response("1234")];
    const store = cloudflareKvQuotaStore({
      accountId: "acct",
      namespaceId: "ns",
      apiToken: "token",
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return responses.shift()!;
      }) as typeof fetch,
    });
    expect(await store.load("2026-10-31")).toBe(0);
    await store.save("2026-10-31", 99);
    expect(await store.load("2026-10-31")).toBe(1234);
    expect(calls[0].url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct/storage/kv/namespaces/ns/values/graph-mcp-served-bytes%3A2026-10-31",
    );
    expect(calls[1].url).toMatch(/\?expiration_ttl=172800$/);
    expect(calls[1].init?.method).toBe("PUT");
    expect(calls[1].init?.body).toBe("99");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });
  it("rejects a corrupt stored counter", async () => {
    const store = cloudflareKvQuotaStore({
      accountId: "a", namespaceId: "n", apiToken: "t",
      fetch: (async () => new Response("lots")) as typeof fetch,
    });
    await expect(store.load("2026-10-31")).rejects.toThrow("unreadable");
  });
});

describe("rate-limit key behind a proxy (M59)", () => {
  const req = (socket: string, forwarded?: string | string[]) =>
    ({ socket: { remoteAddress: socket }, headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded } }) as unknown as IncomingMessage;
  it("uses the socket address unless forwarding is trusted", () => {
    expect(clientAddress(req("10.0.0.5", "203.0.113.9"), false)).toBe("10.0.0.5");
  });
  it("uses the rightmost public forwarded address and ignores spoofed entries", () => {
    expect(clientAddress(req("10.0.0.5", "203.0.113.9"), true)).toBe("203.0.113.9");
    expect(clientAddress(req("10.0.0.5", "1.1.1.1, 203.0.113.9"), true)).toBe("203.0.113.9");
    expect(clientAddress(req("10.0.0.5", "1.1.1.1, 203.0.113.9, 10.1.2.3"), true)).toBe("203.0.113.9");
    expect(clientAddress(req("10.0.0.5", ["1.1.1.1", "198.51.100.4"]), true)).toBe("198.51.100.4");
  });
  it("gives different callers different buckets", () => {
    const limits = new TrafficLimits();
    const a = clientAddress(req("10.0.0.5", "203.0.113.9"), true);
    const b = clientAddress(req("10.0.0.5", "198.51.100.4"), true);
    for (let i = 0; i < 40; i++) limits.request(a, 1000);
    expect(() => limits.request(a, 1000)).toThrow("Too many");
    expect(() => limits.request(b, 1000)).not.toThrow();
  });
  it("normalises IPv6 and mapped IPv4 forms", () => {
    expect(clientAddress(req("10.0.0.5", "::ffff:203.0.113.9"), true)).toBe("203.0.113.9");
    expect(clientAddress(req("10.0.0.5", "[2001:db8::1]:443"), true)).toBe("2001:db8::1");
    expect(clientAddress(req("10.0.0.5", "203.0.113.9:5000"), true)).toBe("203.0.113.9");
  });
  it("falls back to the socket when the header is missing, internal or malformed", () => {
    expect(clientAddress(req("10.0.0.5"), true)).toBe("10.0.0.5");
    expect(clientAddress(req("10.0.0.5", "10.9.9.9, 192.168.1.1"), true)).toBe("10.0.0.5");
    expect(clientAddress(req("10.0.0.5", "1.1.1.1, nonsense"), true)).toBe("10.0.0.5");
  });
});
