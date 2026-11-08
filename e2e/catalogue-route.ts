import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { splitCatalogue } from "../bankCatalogueSplit";

/** Serves a test catalogue to the question bank as the split index and paper files (bankCatalogueSplit.ts). */
export async function routeCatalogue(page: Page, catalogue: object) {
  const split = splitCatalogue(structuredClone(catalogue) as Parameters<typeof splitCatalogue>[0], text => createHash("sha256").update(text).digest("hex"));
  const papers = new Map(split.files.map(file => [file.path, file.json]));
  await page.route("**/bank/catalogue.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(catalogue) }));
  await page.route("**/bank/catalogue-index.json", route => route.fulfill({ contentType: "application/json", body: split.index }));
  await page.route("**/bank/catalogue-papers/**", route => {
    const body = papers.get(new URL(route.request().url()).pathname.slice(1));
    return route.fulfill(body ? { contentType: "application/json", body } : { status: 404, body: "" });
  });
}
