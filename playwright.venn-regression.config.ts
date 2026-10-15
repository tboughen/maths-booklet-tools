import { defineConfig } from "@playwright/test";
import venn from "./playwright.venn.config";
export default defineConfig({
  ...venn,
  testMatch: "*.spec.ts",
  testIgnore: ["venn.spec.ts", "venn-layouts.spec.ts", "mcp-output.spec.ts"],
  outputDir: "test-results/venn-regression",
});
