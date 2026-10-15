import { defineConfig } from "@playwright/test";
import base from "./playwright.cuboid.config";
export default defineConfig({
  ...base,
  testMatch: [
    "homepage-consistency.spec.ts",
    "site-navigation.spec.ts",
    "assessment.spec.ts",
    "source-examples.spec.ts",
    "editor-layout.spec.ts",
  ],
});
