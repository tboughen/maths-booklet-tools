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

test("shows a starter big on the board with a timer, changes starter and shows answers", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Show this starter on the board" }).click();
  const board = page.getByRole("dialog", { name: "Silent starter 1 on the board" });
  await expect(board).toBeVisible();
  await expect(board.getByRole("timer")).toHaveText("5:00");
  await board.getByRole("button", { name: "One minute less" }).click();
  await expect(board.getByRole("timer")).toHaveText("4:00");
  await board.getByRole("button", { name: "Start the timer" }).click();
  await expect(board.getByRole("timer")).not.toHaveText("4:00", { timeout: 3000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Silent starter 2 on the board" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Starter 2 of 6")).toBeVisible();
  // The card is as big as the screen allows beside the strip: it nearly fills the height or the width left.
  const box = await page.getByTestId("starter-board-card").locator(".st-board-art > svg").boundingBox();
  const view = page.viewportSize()!;
  expect(box!.height > view.height * 0.9 || box!.width > view.width * 0.75).toBe(true);
  await page.keyboard.press("a");
  await expect(page.getByRole("button", { name: "Hide answers" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show this starter on the board" })).toBeFocused();
  await expect(page.getByTestId("starter-card").locator("figcaption")).toHaveText("Starter 2 of 6");
});
