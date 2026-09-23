import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { catalogueAssetPaths } from "./bankAssets";

export default defineConfig(({ command, mode }) => ({
  publicDir: command === "serve" ? "public" : false,
  plugins: [react(), {
    name: "reviewed-question-bank-assets",
    apply: "build",
    generateBundle() {
      const catalogue = JSON.parse(readFileSync("public/bank/catalogue.json", "utf8"));
      const add = (relative: string) => this.emitFile({type: "asset", fileName: relative, source: readFileSync(join("public", relative))});
      const tree = (relative: string) => {
        for (const item of readdirSync(join("public", relative), {withFileTypes: true})) {
          const child = `${relative}/${item.name}`;
          if (item.isDirectory()) tree(child); else if (item.isFile()) add(child);
        }
      };
      add("favicon.svg"); add("bank/catalogue.json");
      for (const asset of catalogueAssetPaths(catalogue)) add(asset);
      tree("bank/pdfjs");
    },
  }],
  // Keep GitHub Pages links and PDF worker/font requests under the repository path.
  base: process.env.SITE_BASE || (mode === "production" ? "/maths-booklet-tools/" : "/"),
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
}));
