import { BlockList, isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { GraphError } from "../../packages/graph-core/src/interchange";

/** Durable home for the served-byte counter, so a sleep or restart keeps today's total. */
export interface QuotaStore {
  load(day: string): Promise<number>;
  save(day: string, bytes: number): Promise<void>;
}

export interface TrafficLimitOptions {
  /** Persist today's served bytes here. Without one, the counter is per process. */
  store?: QuotaStore;
  /** Most frequent store write, in milliseconds. Keeps a free KV write quota safe. */
  flushMs?: number;
  /** Reports store failures. Never receives request content or addresses. */
  onStoreError?: (message: string) => void;
  now?: () => number;
}

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export class TrafficLimits {
  private window = 0;
  private calls = 0;
  private clients = new Map<string, number>();
  private day: string;
  private bytes = 0;
  private dirty = false;
  private loaded: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly store?: QuotaStore;
  private readonly flushMs: number;
  private readonly onStoreError: (message: string) => void;
  constructor(
    private maximumDailyBytes = 200 * 1024 * 1024,
    options: TrafficLimitOptions = {},
  ) {
    this.store = options.store;
    this.flushMs = options.flushMs ?? 120_000;
    this.onStoreError = options.onStoreError ?? (() => {});
    this.day = utcDay((options.now ?? Date.now)());
    this.loaded = this.load(this.day);
  }
  /** Resolves once the stored total for today has been read (or failed). */
  ready(): Promise<void> {
    return this.loaded;
  }
  private async load(day: string): Promise<void> {
    if (!this.store) return;
    try {
      const stored = await this.store.load(day);
      // Bytes served while the read was in flight are added to the stored total.
      if (this.day === day && Number.isSafeInteger(stored) && stored > 0)
        this.bytes += stored;
    } catch {
      this.onStoreError("The daily download counter could not be read; counting from zero.");
    }
  }
  request(client: string, now = Date.now()): void {
    const window = Math.floor(now / 60_000);
    if (window !== this.window) {
      this.window = window;
      this.calls = 0;
      this.clients.clear();
    }
    const count = this.clients.get(client) ?? 0;
    if (this.calls >= 120 || count >= 40)
      throw new GraphError(
        "rate_limited",
        "Too many requests. Try again in a minute.",
      );
    this.calls++;
    this.clients.set(client, count + 1);
  }
  output(size: number, now = Date.now()): void {
    const day = utcDay(now);
    if (day !== this.day) {
      this.day = day;
      this.bytes = 0;
      this.dirty = false;
      this.loaded = Promise.resolve();
    }
    if (this.bytes + size > this.maximumDailyBytes)
      throw new GraphError(
        "rate_limited",
        "Today's download allowance has been reached.",
      );
    this.bytes += size;
    if (this.store) {
      this.dirty = true;
      this.timer ??= setTimeout(() => {
        this.timer = undefined;
        void this.flush();
      }, this.flushMs);
      this.timer.unref?.();
    }
  }
  /** Writes today's total to the store if it changed. Safe to call at shutdown. */
  async flush(): Promise<void> {
    if (!this.store) return;
    // Never write before the stored total is known, or a restart could lower it.
    await this.loaded;
    if (!this.dirty) return;
    const day = this.day,
      bytes = this.bytes;
    this.dirty = false;
    try {
      await this.store.save(day, bytes);
    } catch {
      if (this.day === day) this.dirty = true;
      this.onStoreError("The daily download counter could not be saved; will retry.");
    }
  }
}

/** Cloudflare Workers KV over its HTTPS API. One key per UTC day, kept for two days. */
export function cloudflareKvQuotaStore(options: {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  key?: string;
  fetch?: typeof fetch;
}): QuotaStore {
  const call = options.fetch ?? fetch;
  const prefix = options.key ?? "graph-mcp-served-bytes";
  const url = (day: string) =>
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}` +
    `/storage/kv/namespaces/${encodeURIComponent(options.namespaceId)}` +
    `/values/${encodeURIComponent(`${prefix}:${day}`)}`;
  const headers = { Authorization: `Bearer ${options.apiToken}` };
  return {
    async load(day) {
      const response = await call(url(day), {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404) return 0;
      if (!response.ok) throw Error(`KV read failed with ${response.status}.`);
      const value = Number((await response.text()).trim());
      if (!Number.isSafeInteger(value) || value < 0)
        throw Error("KV held an unreadable counter.");
      return value;
    },
    async save(day, bytes) {
      const response = await call(url(day) + "?expiration_ttl=172800", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "text/plain" },
        body: String(bytes),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error(`KV write failed with ${response.status}.`);
    },
  };
}

const internal = new BlockList();
for (const [address, prefix] of [
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["0.0.0.0", 8],
] as const)
  internal.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["::", 128],
] as const)
  internal.addSubnet(address, prefix, "ipv6");

function normalise(entry: string): string | undefined {
  let address = entry.trim();
  if (address.startsWith("[")) address = address.slice(1, address.indexOf("]"));
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(address)) address = address.split(":")[0];
  if (address.toLowerCase().startsWith("::ffff:") && isIP(address.slice(7)) === 4)
    address = address.slice(7);
  return isIP(address) ? address : undefined;
}
function isInternal(address: string) {
  return internal.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/**
 * The address the rate limiter keys on. Behind a hosting proxy the socket is the
 * proxy, so every caller would share one bucket. With trustForwardedFor, use the
 * rightmost public X-Forwarded-For entry: the address the host's own edge saw.
 * Entries to its left are client-supplied and ignored, so they cannot be spoofed.
 */
export function clientAddress(req: IncomingMessage, trustForwardedFor: boolean): string {
  const socket = req.socket.remoteAddress ?? "unknown";
  if (!trustForwardedFor) return socket;
  const header = req.headers["x-forwarded-for"];
  const entries = (Array.isArray(header) ? header.join(",") : header ?? "").split(",");
  for (let i = entries.length - 1; i >= 0; i--) {
    const address = normalise(entries[i]);
    if (!address) break;
    if (!isInternal(address)) return address;
  }
  return socket;
}
