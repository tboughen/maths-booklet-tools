import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import type { StarterRun } from "../packages/resource-core/src/index";

const key = "maths-booklet-tools:starters:v1";
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key) as Promise<StarterRun>;

async function boot(page: Page) {
  await page.goto("/starters");
  await expect(page.getByTestId("starter-card").locator(".ws-art > svg")).toBeVisible();
}

test("shows the example run, copies a question along the run, and undoes it", async ({ page }) => {
  await boot(page);
  await expect(page.getByRole("button", { name: "Starter 6" })).toBeVisible();
  await page.getByRole("button", { name: "Starter 3", exact: true }).click();
  await expect(page.getByTestId("starter-card").locator("figcaption")).toHaveText("Starter 3 of 6");
  await page.getByRole("button", { name: "Copy to every starter" }).first().click();
  await expect(page.getByRole("status")).toHaveText("Question 1 copied to every starter.");
  await expect.poll(async () => new Set((await saved(page)).document.starters.map((s) => JSON.stringify(s.cards[0]))).size).toBe(1);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => new Set((await saved(page)).document.starters.map((s) => JSON.stringify(s.cards[0]))).size).toBe(6);
});

test("edits an instruction, refuses a run longer than six, and downloads Word and PDF", async ({ page }) => {
  await boot(page);
  const instruction = page.getByRole("textbox", { name: "Question 1 instruction" });
  await instruction.fill("Work out:");
  await instruction.press("Enter");
  await expect.poll(async () => (await saved(page)).document.starters[0].cards[0].title).toBe("Work out:");
  await expect(page.getByRole("button", { name: "Add a copy" })).toBeDisabled();

  const word = page.waitForEvent("download");
  await page.getByRole("button", { name: "Word", exact: true }).click();
  const w = await word;
  expect(w.suggestedFilename()).toBe("Year-9-fractions-perimeter-and-expanding_Silent-starters.docx");
  const document = strFromU8(unzipSync(new Uint8Array(readFileSync(await w.path())))["word/document.xml"]);
  expect(document.split("<w:pageBreakBefore/>").length - 1).toBe(5);
  expect(document).toContain("Work out:");

  await page.getByRole("button", { name: "File" }).click();
  const pdf = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download PDF, starter 1 only" }).click();
  const p = await pdf;
  expect(p.suggestedFilename()).toBe("Year-9-fractions-perimeter-and-expanding_Silent-starters_1.pdf");
  const doc = await PDFDocument.load(readFileSync(await p.path()));
  expect(doc.getPageCount()).toBe(1);
  const { width, height } = doc.getPage(0).getSize();
  expect([Math.round((width / 72) * 25.4), Math.round((height / 72) * 25.4)]).toEqual([210, 297]);
});
