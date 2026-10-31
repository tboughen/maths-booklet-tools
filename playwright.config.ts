import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * One config for every browser suite. Each suite is a named project:
 *
 *   npx playwright test                         # e2e: every spec against the dev server
 *   npx playwright test --project=venn          # one suite (`=` keeps file filters separate)
 *   npx playwright test --project=release       # sealed package (MATHSDOCK_RELEASE_PACKAGE)
 *
 * Suites overlap (several run every spec), so a bare run selects only `e2e`
 * and a server starts only for the suites that were asked for.
 * Set a suite's URL variable to test an already-running site instead.
 */
const env = process.env;
const devPort = Number(env.MATHSDOCK_DEV_PORT || 5179);
const devURL = `http://127.0.0.1:${devPort}`;
const packagePort = Number(env.MATHSDOCK_TEST_PORT || 5230);
const cloudflarePort = Number(env.MATHSDOCK_TEST_PORT || 5186);
const channel =
  env.PLAYWRIGHT_CHANNEL === "chromium"
    ? undefined
    : env.PLAYWRIGHT_CHANNEL || "chrome";
// Chrome's native download staging must stay outside long OneDrive report paths.
const downloads = (name: string) => ({
  downloadsPath: env.MATHSDOCK_DOWNLOAD_PATH || join(tmpdir(), `mathsdock-${name}-downloads`),
});

type Server = "dev" | "package" | "cloudflare";
type Suite = NonNullable<PlaywrightTestConfig["projects"]>[number] & {
  name: string;
  /** Server started for this suite unless `external` points at a running site. */
  server: Server;
  external?: string;
};

const suites: Suite[] = [
  { name: "e2e", server: "dev" },
  { name: "accessibility", server: "dev", testMatch: "accessibility.spec.ts", timeout: 60000 },
  {
    name: "algebra", server: "dev", external: env.MATHSDOCK_ALGEBRA_URL,
    testMatch: /algebra-grid\.spec\.ts|site-navigation\.spec\.ts/,
    outputDir: env.MATHSDOCK_ALGEBRA_TEST_OUTPUT,
    use: { launchOptions: downloads("algebra"), screenshot: "only-on-failure", trace: "retain-on-failure" },
  },
  { name: "assessment", server: "dev", external: env.ASSESSMENT_SITE_URL, testMatch: "assessment.spec.ts", timeout: 90000 },
  { name: "consistency", server: "dev", external: env.MATHSDOCK_CONSISTENCY_URL, use: { launchOptions: downloads("consistency") } },
  { name: "refinement", server: "dev", use: { launchOptions: downloads("refinement") } },
  {
    name: "triangle", server: "dev", external: env.MATHSDOCK_TRIANGLE_URL, testMatch: "triangle.spec.ts",
    outputDir: env.MATHSDOCK_TRIANGLE_TEST_OUTPUT,
    use: { launchOptions: downloads("triangle"), screenshot: "only-on-failure", trace: "retain-on-failure" },
  },
  {
    name: "usability", server: "dev", external: env.USABILITY_SITE, testMatch: "usability.spec.ts", timeout: 45000,
    use: { viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
  },
  { name: "venn", server: "dev", external: env.MATHSDOCK_VENN_URL, testMatch: ["venn.spec.ts", "venn-layouts.spec.ts"] },
  {
    name: "venn-regression", server: "dev", external: env.MATHSDOCK_VENN_URL,
    testIgnore: ["venn.spec.ts", "venn-layouts.spec.ts", "mcp-output.spec.ts"],
  },
  { name: "release", server: "package" },
  {
    name: "cloudflare", server: "cloudflare", external: env.CLOUDFLARE_SITE_URL,
    testDir: "./scripts/cloudflare", testMatch: "browser.spec.ts", timeout: 120000,
    outputDir: env.MATHSDOCK_TEST_OUTPUT || "cloudflare-release/browser",
    // The packaged-site checks use Playwright's own Chromium unless a channel is named.
    use: { channel: channel === "chrome" && !env.PLAYWRIGHT_CHANNEL ? undefined : channel },
  },
];

const baseURL = (suite: Suite) =>
  suite.external ||
  (suite.server === "dev" ? devURL : `http://127.0.0.1:${suite.server === "package" ? packagePort : cloudflarePort}`);

const servers: Record<Server, NonNullable<PlaywrightTestConfig["webServer"]>> = {
  dev: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${devPort} --strictPort`, url: devURL, reuseExistingServer: false, timeout: 30000 },
  package: { command: `node scripts/cloudflare/serve-package.mjs --port=${packagePort}`, url: `http://127.0.0.1:${packagePort}`, reuseExistingServer: false, timeout: 30000 },
  cloudflare: {
    command: env.MATHSDOCK_PACKAGE_REHEARSAL
      ? `node scripts/cloudflare/serve-package.mjs --port=${cloudflarePort}`
      : `node node_modules/vite/bin/vite.js preview --mode cloudflare --outDir dist-cloudflare --host 127.0.0.1 --port ${cloudflarePort} --strictPort`,
    url: `http://127.0.0.1:${cloudflarePort}`, reuseExistingServer: false,
  },
};

/**
 * Names passed with --project. Workers re-load this file with their own argv,
 * so the main process hands its choice on through the environment.
 */
function requestedProjects() {
  if (env.MATHSDOCK_PLAYWRIGHT_PROJECTS !== undefined) return env.MATHSDOCK_PLAYWRIGHT_PROJECTS.split(",").filter(Boolean);
  const names: string[] = [];
  // Like Playwright, `--project a b` takes every value up to the next option.
  let listing = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--project=")) names.push(arg.slice("--project=".length));
    else if (arg === "--project") listing = true;
    else if (arg.startsWith("-")) listing = false;
    else if (listing) names.push(arg);
  }
  env.MATHSDOCK_PLAYWRIGHT_PROJECTS = names.join(",");
  return names;
}

const requested = requestedProjects();
// Playwright filters to the requested projects itself and rejects unknown names.
const listed = requested.length ? suites : suites.filter((suite) => suite.name === "e2e");
const selected = listed.filter((suite) => !requested.length || requested.includes(suite.name));
const needed = new Set(selected.filter((suite) => !suite.external).map((suite) => suite.server));

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: requested.includes("usability")
    ? [["list"], ["json", { outputFile: "test-results/usability.json" }]]
    : [["list"]],
  use: { headless: true, channel, viewport: { width: 1440, height: 1000 } },
  projects: listed.map(({ server: _server, external: _external, ...project }) => ({
    ...project,
    outputDir: project.outputDir || env.MATHSDOCK_TEST_OUTPUT || `test-results/${project.name}`,
    use: { ...project.use, baseURL: baseURL({ server: _server, external: _external, ...project }) },
  })),
  webServer: [...needed].map((server) => servers[server]),
});
