import { graphService } from "./server";
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
const service = graphService({
  buildId: manifest.buildId,
  publicUrl,
  editorUrl:
    process.env.GRAPH_EDITOR_URL ??
    "https://tboughen.github.io/maths-booklet-tools/",
  keys: { ...previous, [activeKey]: signingKey },
  activeKey,
  dailyBytes,
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
    service.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 20_000).unref();
  });
