import { graphService } from "./server";
import { cloudflareKvQuotaStore } from "./limits";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(readFileSync("service-dist/manifest.json", "utf8"));
for (const name of [
  "STIXTwoText-Regular.otf",
  "STIXTwoText-Italic.otf",
  "STIXTwoMath-Regular.otf",
]) {
  const path = "assets/graph-fonts/" + name;
  if (
    createHash("sha256").update(readFileSync(path)).digest("hex") !==
    manifest.files[path]
  )
    throw Error("Bundled graph font integrity check failed.");
}
const publicUrl =
  process.env.GRAPH_PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://127.0.0.1:8787";
const signingKey = process.env.DOWNLOAD_SIGNING_KEY;
if (!signingKey || signingKey.length < 32)
  throw Error(
    "Set DOWNLOAD_SIGNING_KEY to a random secret of at least 32 characters. Never put it in website code.",
  );
const previous = process.env.DOWNLOAD_PREVIOUS_KEYS
  ? JSON.parse(process.env.DOWNLOAD_PREVIOUS_KEYS)
  : {};
const activeKey = process.env.DOWNLOAD_KEY_ID ?? "initial";
const dailyBytes = Number(
  process.env.MAX_DAILY_OUTPUT_BYTES ?? 200 * 1024 * 1024,
);
if (!Number.isSafeInteger(dailyBytes) || dailyBytes < 1)
  throw Error("MAX_DAILY_OUTPUT_BYTES must be a positive integer.");
if (
  previous === null ||
  typeof previous !== "object" ||
  Array.isArray(previous) ||
  Object.hasOwn(previous, activeKey)
)
  throw Error("Previous keys must be an object with different key IDs.");
const kv = {
  accountId: process.env.QUOTA_KV_ACCOUNT_ID,
  namespaceId: process.env.QUOTA_KV_NAMESPACE_ID,
  apiToken: process.env.QUOTA_KV_API_TOKEN,
};
const kvSet = Object.values(kv).filter(Boolean).length;
if (kvSet !== 0 && kvSet !== 3)
  throw Error(
    "Set all of QUOTA_KV_ACCOUNT_ID, QUOTA_KV_NAMESPACE_ID and QUOTA_KV_API_TOKEN, or none.",
  );
const quotaStore =
  kvSet === 3
    ? cloudflareKvQuotaStore(kv as { accountId: string; namespaceId: string; apiToken: string })
    : undefined;
if (!quotaStore)
  process.stdout.write(
    "Daily download allowance is per process; it resets when the service sleeps or restarts.\n",
  );
// Render sets RENDER=true; its proxy is the socket peer, so key limits on its forwarded address.
const trustForwardedFor = process.env.TRUST_FORWARDED_FOR
  ? process.env.TRUST_FORWARDED_FOR === "1"
  : process.env.RENDER === "true";
const service = graphService({
  buildId: manifest.buildId,
  publicUrl,
  editorUrl:
    process.env.GRAPH_EDITOR_URL ??
    "https://mathsdock.co.uk/",
  keys: { ...previous, [activeKey]: signingKey },
  activeKey,
  dailyBytes,
  quotaStore,
  trustForwardedFor,
  onQuotaStoreError: (message) => process.stderr.write(message + "\n"),
  log: (entry) => process.stdout.write(JSON.stringify(entry) + "\n"),
});
service.requestTimeout = 20_000;
service.headersTimeout = 10_000;
service.keepAliveTimeout = 5_000;
service.listen(
  Number(process.env.PORT ?? 8787),
  process.env.BIND_HOST ?? "127.0.0.1",
  () => process.stdout.write("Graph MCP service ready.\n"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    // Save today's download total, then exit once connections finish or time runs out.
    const closed = new Promise<void>((done) => service.close(() => done()));
    void Promise.allSettled([closed, service.flushQuota()]).then(() =>
      process.exit(0),
    );
    setTimeout(() => process.exit(0), 20_000).unref();
  });
