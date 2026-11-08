import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * The MCP round-trip tests start the built service (`service-dist/cli.js`). `npm test` builds it
 * first, but a plain `npx playwright test` does not, so build it here when it is missing rather than
 * timing out on a server that never starts.
 */
export function ensureServiceBuild(): void {
  if (existsSync("service-dist/cli.js")) return;
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:service"], { stdio: "inherit", shell: process.platform === "win32" });
}
