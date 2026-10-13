import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { assetFile, type ReleaseManifest } from "./release";
const manifest = JSON.parse(await readFile("cloudflare-release/manifest.json", "utf8")) as ReleaseManifest;
const downloads: {preset: string; name: string; path: string; pages: number}[] = [];
test.beforeEach(async ({page, baseURL}) => {
  if (baseURL?.startsWith("http://127.0.0.1:")) {
    // Local transport rehearsal only. Live preview uses real R2, without interception.
    const byKey = new Map(manifest.assets.map(asset => [asset.key, asset]));
    await page.route(`${manifest.assetOrigin}/**`, async route => {
      const key = new URL(route.request().url()).pathname.slice(1);
      const asset = byKey.get(key);
      if (!asset) return route.fulfill({status: 404});
      await route.fulfill({status: 200, contentType: asset.contentType,
        headers: {"Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes"},
        body: await readFile(assetFile("public", asset.sources[0]))});
    });
  }
});
test("split hosting displays question/scheme canvases, PNG previews and both real export layouts", async ({page}, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?tool=question-bank&code=U945&question=1MA1_JUN_2018_3H_Q3");
  await expect(page.locator(".site-page:not([hidden]) .qb-canvas-host canvas").first()).toBeVisible();
  await expect(page.locator(".qb-view-error")).toHaveCount(0);
  await page.getByRole("button", {name: "Show mark scheme", exact: true}).click();
  await expect(page.getByRole("button", {name: "Hide mark scheme", exact: true})).toBeVisible();
  await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();
  await expect(page.locator(".qb-view-error")).toHaveCount(0);
  await page.getByRole("button", {name: "Select question", exact: true}).click();
  await page.getByRole("combobox", {name: "Sparx code or topic"}).fill("U350");
  await page.getByRole("button", {name: "Find", exact: true}).click();
  await page.getByRole("button", {name: "Select question", exact: true}).click();
  await page.getByRole("button", {name: "Build by topic", exact: true}).click();
  await page.getByRole("searchbox", {name: "Search codes or topics"}).fill("U538");
  await page.getByRole("checkbox", {name: "Include questions for U538", exact: true}).check();
  await page.getByRole("region", {name: "Your paper", exact: true}).getByRole("button", {name: "Review paper", exact: true}).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("3 complete questions · 11 marks");
  await dialog.getByRole("button", {name: "Move question 3 up", exact: true}).click();
  await dialog.locator(".qb-paper-preview > summary").first().click();
  await expect.poll(() => dialog.locator(".qb-paper-preview img").first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  expect(await dialog.locator(".qb-paper-preview img").first().getAttribute("src")).toContain(manifest.assetOrigin + "/bank/assets/sha256/");
  for (const preset of ["Compact practice", "Writing space"]) {
    await dialog.getByRole("radio", {name: preset, exact: true}).check();
    await dialog.getByRole("button", {name: "Prepare both PDFs", exact: true}).click();
    await expect(dialog.getByText("Both PDFs are ready")).toBeVisible({timeout: 60000});
    for (const name of ["Questions PDF", "Mark schemes PDF"]) {
      const pending = page.waitForEvent("download");
      await dialog.getByRole("button", {name, exact: true}).click();
      const download = await pending;
      const filename = `${preset.startsWith("Compact") ? "compact" : "writing"}-${name.startsWith("Questions") ? "questions" : "schemes"}.pdf`;
      const path = info.outputPath(filename);
      expect(download.suggestedFilename()).toBe(name.startsWith("Questions") ? "practice-questions.pdf" : "practice-mark-schemes.pdf");
      const blobUrl = download.url();
      expect(blobUrl).toMatch(/^blob:/);
      // Read the exact browser-generated download blob. Managed Windows browser
      // policies can pause multiple saveAs downloads awaiting a native prompt.
      const bytes = await page.evaluate(async url => {
        const response = await fetch(url);
        return Array.from(new Uint8Array(await response.arrayBuffer()));
      }, blobUrl);
      await writeFile(path, Buffer.from(bytes));
      await download.cancel();
      const pdf = await PDFDocument.load(await readFile(path));
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      for (const p of pdf.getPages()) {
        const [short, long] = [p.getWidth(), p.getHeight()].sort((a, b) => a - b);
        expect(short).toBeCloseTo(595.28, 0); expect(long).toBeCloseTo(841.89, 0);
      }
      downloads.push({preset, name, path, pages: pdf.getPageCount()});
    }
  }
  await page.screenshot({path: info.outputPath("paper-review.png")});
  expect(errors).toEqual([]);
  await writeFile(info.outputPath("proof.json"), JSON.stringify({site: info.project.use.baseURL,
    transport: process.env.CLOUDFLARE_SITE_URL ? "real R2" : "local intercepted R2 rehearsal",
    exportCapture: "exact clicked browser download blobs; native save-dialog policy not tested", downloads, errors}, null, 2));
});
test("graph and ratio tools work under the root base URL", async ({page}) => {
  await page.goto("/?tool=graph");
  await expect(page.getByRole("heading", {name: "Graph tool", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Line by equation"}).click();
  await page.getByRole("button", {name: "Add line", exact: true}).click();
  await expect(page.getByRole("button", {name: /Objects 1/})).toBeVisible();
  await page.getByRole("navigation", {name: "Booklet tools", exact: true}).getByRole("link", {name: "Ratio tables"}).click();
  await expect(page.getByRole("heading", {name: "Ratio tables", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Add row", exact: true}).click();
  await expect(page.getByLabel("Row 3 x value", {exact: true})).toBeFocused();
  await expect(page.getByLabel("Row 3 x value", {exact: true})).toHaveValue("");
});
