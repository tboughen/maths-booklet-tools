import { get } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function healthOrigin(environment: NodeJS.ProcessEnv) {
  return (
    environment.GRAPH_PUBLIC_URL ||
    environment.RENDER_EXTERNAL_URL ||
    "http://127.0.0.1:8787"
  );
}
/** Probe loopback only, preserving the service's public Host validation. Fetch
 * rewrites Host in Node 24, so use the HTTP client that supports this header.
 */
export function checkHealth(publicUrl: string, port: number): Promise<boolean> {
  const host = new URL(publicUrl).host;
  return new Promise((resolveResult) => {
    const request = get(
      { hostname: "127.0.0.1", port, path: "/healthz", headers: { host } },
      (response) => {
        response.resume();
        resolveResult(response.statusCode === 200);
      },
    );
    request.setTimeout(4000, () => request.destroy());
    request.once("error", () => resolveResult(false));
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = (await checkHealth(
      healthOrigin(process.env),
      Number(process.env.PORT ?? 8787),
    ))
      ? 0
      : 1;
  } catch {
    process.exitCode = 1;
  }
}
