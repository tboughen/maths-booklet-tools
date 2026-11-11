/**
 * Short-lived storage for documents too large to travel inside a download link (whole unit
 * booklets). A link then carries only the document's sha256, which is checked on the way out.
 * Production uses Cloudflare Workers KV (the same namespace as the daily byte counter); without it
 * documents are kept in memory, so their links stop working when the service restarts.
 */
export interface DocumentStore {
  /** Saves text under id for ttlSeconds. */
  put(id: string, text: string, ttlSeconds: number): Promise<void>;
  /** The saved text, or null when it has expired or was never saved. */
  get(id: string): Promise<string | null>;
  /** True when documents survive a restart. */
  readonly durable: boolean;
}

export function memoryDocumentStore(maxEntries = 40): DocumentStore {
  const docs = new Map<string, { text: string; expires: number }>();
  return {
    durable: false,
    async put(id, text, ttlSeconds) {
      docs.delete(id);
      docs.set(id, { text, expires: Date.now() + ttlSeconds * 1000 });
      // Oldest first; bounded so a busy day cannot grow memory without limit.
      while (docs.size > maxEntries) docs.delete(docs.keys().next().value as string);
    },
    async get(id) {
      const d = docs.get(id);
      if (!d) return null;
      if (d.expires < Date.now()) {
        docs.delete(id);
        return null;
      }
      return d.text;
    },
  };
}

export function cloudflareKvDocumentStore(options: {
  accountId: string;
  namespaceId: string;
  apiToken: string;
  prefix?: string;
  fetch?: typeof fetch;
}): DocumentStore {
  const call = options.fetch ?? fetch;
  const prefix = options.prefix ?? "graph-mcp-document";
  const url = (id: string) =>
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}` +
    `/storage/kv/namespaces/${encodeURIComponent(options.namespaceId)}` +
    `/values/${encodeURIComponent(`${prefix}:${id}`)}`;
  const headers = { Authorization: `Bearer ${options.apiToken}` };
  return {
    durable: true,
    async put(id, text, ttlSeconds) {
      const response = await call(`${url(id)}?expiration_ttl=${Math.max(60, Math.round(ttlSeconds))}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: text,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw Error(`KV write failed with ${response.status}.`);
    },
    async get(id) {
      const response = await call(url(id), { headers, signal: AbortSignal.timeout(10_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw Error(`KV read failed with ${response.status}.`);
      return response.text();
    },
  };
}
