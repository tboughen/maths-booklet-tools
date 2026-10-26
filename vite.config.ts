import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { catalogueAssetPaths } from "./bankAssets";
import { prepareRelease, assetOrigin, sourceFingerprint } from "./scripts/cloudflare/release";
import { verifyReusableCatalogue } from "./scripts/cloudflare/package.mjs";
import { verifyCatalogueSolutionFiles } from "./scripts/bank/solution-files";

export default defineConfig(({ command, mode }) => ({
  define: mode === "cloudflare" ? { "import.meta.env.VITE_BANK_ASSET_ORIGIN": JSON.stringify(assetOrigin) } : {},
  build: mode === "cloudflare" ? { outDir: "dist-cloudflare" } : {},
  publicDir: command === "serve" ? "public" : false,
  plugins: [react(), {
    name: "reviewed-question-bank-assets",
    apply: "build",
    async generateBundle() {
      const catalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8"));
      await verifyCatalogueSolutionFiles("public", catalogue);
      const add = (relative: string) => this.emitFile({type: "asset", fileName: relative, source: readFileSync(join("public", relative))});
      const tree = (relative: string) => {
        for (const item of readdirSync(join("public", relative), {withFileTypes: true})) {
          const child = `${relative}/${item.name}`;
          if (item.isDirectory()) tree(child); else if (item.isFile()) add(child);
        }
      };
      add("favicon.svg");
      tree("brand");
      if (mode === "cloudflare") {
        const commit = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
        let cached;
        let cacheReason = 'No verified reusable package supplied';
        if (process.env.MATHSDOCK_REUSE_PACKAGE) {
          try { cached = verifyReusableCatalogue(".", process.env.MATHSDOCK_REUSE_PACKAGE); cacheReason = 'Matching package, bank tree and transformation identity'; }
          catch { cacheReason = 'Supplied package failed identity or integrity checks'; console.log('Cached bank inventory is inapplicable; recomputing from the source assets.'); }
        }
        const release = cached ? { ...cached, manifest: { ...cached.manifest, sourceFingerprint: sourceFingerprint(".") } } : prepareRelease("public", commit, sourceFingerprint("."));
        this.emitFile({type: "asset", fileName: "bank/catalogue.json", source: release.catalogueJson});
        this.emitFile({type: "asset", fileName: "_headers", source: "/bank/catalogue.json\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n"});
        mkdirSync("cloudflare-release", {recursive: true});
        writeFileSync("cloudflare-release/manifest.json", JSON.stringify(release.manifest, null, 2));
        mkdirSync("cloudflare-release/evidence", {recursive: true});
        writeFileSync("cloudflare-release/evidence/catalogue-build.json", JSON.stringify({ status: cached ? 'reused' : 'cold', reason: cacheReason }));
      } else {
        add("bank/catalogue.json");
        for (const asset of catalogueAssetPaths(catalogue)) add(asset);
      }
      tree("bank/pdfjs");
    },
  }],
  // Keep GitHub Pages links and PDF worker/font requests under the repository path.
  base: mode === "cloudflare" ? "/" : process.env.SITE_BASE || (mode === "production" ? "/maths-booklet-tools/" : "/"),
  test: {
    exclude: ["node_modules/**", "dist/**", "dist-cloudflare/**", "service-dist/**", "e2e/**", "scripts/cloudflare/*.test.mjs", "scripts/cloudflare/browser.spec.ts"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
}));
