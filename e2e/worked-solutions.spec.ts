import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import type { BankCatalogue, BankQuestion } from "../src/bank/model";
import { routeCatalogue } from "./catalogue-route";

const prefix = "bank/assets/worked-fixture/";
const target = "SYNTHETIC_1F_Q1";
const stepsFile = "bank/assets/worked/SYNTHETIC_1F_Q1/synthetic-solution.json";

/** A synthetic question: one A4 page with a working space from y 120 to 300 points and an answer line. */
function steps(bottom = 300) {
  return JSON.stringify({ schemaVersion: 2, questionId: target, questionRevision: "synthetic-q1", parts: [{
    on: "q", parts: ["1"], method: "bubble-method",
    area: { x: 60, y: 120, width: 300, bottom }, notesX: 380, answers: [{ x: 400, y: 340, width: 140 }],
    steps: [
      { kind: "line", lhs: "4x + 3", rhs: "19" },
      { kind: "bubbles", lhs: "-3", rhs: "-3" },
      { kind: "line", lhs: "4x", rhs: "16", mark: { code: "M1", note: "subtracts 3 from both sides" } },
      { kind: "bubbles", lhs: "÷4", rhs: "÷4" },
      { kind: "line", lhs: "x", rhs: "4" },
      { kind: "answer", value: "4", mark: { code: "A1", note: "cao" } },
    ] }] });
}

async function seed(page: Page, body = steps()) {
  const catalogue = JSON.parse(await readFile("public/bank/catalogue.json", "utf8")) as BankCatalogue;
  const bodies = new Map<string, Buffer>();
  async function pdf(name: string) {
    const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica);
    const sheet = document.addPage([595.28, 420]);
    sheet.drawText("SYNTHETIC TEST RESOURCE", { x: 40, y: 380, size: 16, font });
    sheet.drawText("1  Solve 4x + 3 = 19", { x: 40, y: 330, size: 14, font });
    sheet.drawLine({ start: { x: 400, y: 80 }, end: { x: 540, y: 80 }, thickness: 0.5 });
    bodies.set(prefix + name, Buffer.from(await document.save()));
  }
  await pdf("question.pdf"); await pdf("scheme.pdf");
  bodies.set(stepsFile, Buffer.from(body));
  bodies.set(prefix + "preview.png", new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="595" height="420"><rect width="595" height="420" fill="white"/></svg>').render().asPng());
  const base = catalogue.questions[0];
  const view = { id: "q", label: "Question", page: 1, width: 595.28, height: 420, preview: prefix + "preview.png", description: "Synthetic printed question", sourcePages: [8] };
  const part = { label: "1", marks: 2, codes: base.parts[0].codes, sourceCodes: base.parts[0].codes, mappingStatus: "test", notes: [] };
  const question: BankQuestion = { ...base, id: target, source: "Synthetic target Q1", paperId: "SYNTHETIC_1F", tier: "F", number: 1, order: 1, marks: 2, parts: [part], codes: part.codes, revision: "synthetic-q1",
    questionPdf: prefix + "question.pdf", printPdf: prefix + "question.pdf", schemePdf: prefix + "scheme.pdf", questionViews: [view], schemeViews: [{ ...view, id: "scheme", description: "Synthetic marking example" }],
    printPages: [{ width: 595.28, height: 420 }], cuts: undefined, equivalentId: "SYNTHETIC_1H_Q1", equivalentSource: "Synthetic higher Q1",
    workedSolution: { schemaVersion: 2, revision: "synthetic-solution", basedOnQuestionRevision: "synthetic-q1", data: stepsFile, dataSha256: createHash("sha256").update(body).digest("hex") } };
  const other = { ...question, id: "SYNTHETIC_1F_Q2", source: "Synthetic next Q2", number: 2, order: 2, equivalentId: undefined, equivalentSource: undefined, workedSolution: undefined };
  const crossover = { ...question, id: "SYNTHETIC_1H_Q1", source: "Synthetic higher Q1", tier: "H" as const, paperId: "SYNTHETIC_1H", equivalentId: target, equivalentSource: question.source, workedSolution: undefined };
  catalogue.questions = [question, other, crossover];
  const requests: string[] = [];
  await routeCatalogue(page, catalogue);
  await page.route(/\/bank\/assets\/(worked-fixture|worked)\//, route => {
    const path = new URL(route.request().url()).pathname.slice(1); requests.push(path);
    const body = bodies.get(path);
    return route.fulfill({ status: body ? 200 : 404, contentType: path.endsWith(".png") ? "image/png" : path.endsWith(".json") ? "application/json" : "application/pdf", body });
  });
  await page.goto(`/question-bank?tier=F&question=${target}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Show worked solution", exact: true })).toBeEnabled();
  await expect(page.locator(".qb-canvas-host canvas")).toHaveCount(1);
  return { requests };
}

const ink = (page: Page) => page.locator(".qb-worked-ink svg");

test("worked solutions are drawn over the question, deliberately revealed and scoped to the selected question", async ({ page }) => {
  const { requests } = await seed(page);
  expect(requests.some(p => p.endsWith(".json"))).toBe(false);
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide worked solution", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".qb-view-info")).toContainText("Worked solution");
  await expect(ink(page)).toBeVisible();
  await expect(ink(page)).toContainText("4x + 3");
  await expect(ink(page).locator("ellipse")).toHaveCount(4);
  await expect(ink(page).locator(".wk-mark")).toHaveCount(2);
  // The question itself is underneath: the working is drawn over the printed page at true size.
  await expect(page.getByRole("img", { name: "Synthetic printed question", exact: true })).toBeVisible();
  const [surface, svg] = await Promise.all([page.locator(".qb-worked-surface").boundingBox(), ink(page).boundingBox()]);
  expect(Math.abs(surface!.width - svg!.width)).toBeLessThan(1);
  expect(await page.evaluate(() => document.fonts.check('12px "MathsDock Hand"'))).toBe(true);
  await page.getByRole("button", { name: "Show mark scheme", exact: true }).click();
  await expect(page.getByRole("button", { name: "Show worked solution", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(ink(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".qb-source-heading strong")).toHaveText("Synthetic next Q2");
  await expect(page.getByRole("button", { name: "Show worked solution", exact: true })).toBeDisabled();
  await expect(page.getByText("Not available yet", { exact: true })).toBeVisible();
  await expect(ink(page)).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Show worked solution", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("working longer than the printed space adds room instead of shrinking", async ({ page }) => {
  await seed(page, steps(170));
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  await expect(page.locator(".qb-worked-slice")).toHaveCount(2);
  await page.locator(".qb-worked-surface").screenshot({ path: test.info().outputPath("worked-room.png") });
  const [question, surface] = await Promise.all([page.locator(".qb-worked-slice").first().boundingBox(), page.locator(".qb-worked-surface").boundingBox()]);
  expect(surface!.height).toBeGreaterThan(question!.height);
  // Room is added rather than the cut being squeezed: the cut keeps its width.
  expect(Math.abs(surface!.width - question!.width)).toBeLessThan(1);
});

test("paper exports keep their two outputs and the old PDF link is gone", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  await page.getByLabel("Question options", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Worked solution PDF", exact: true })).toHaveCount(0);
  await page.getByLabel("Question options", { exact: true }).click();
  await page.getByRole("button", { name: "Select question", exact: true }).click();
  await page.getByRole("button", { name: "Review paper (1)", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Prepare both PDFs", exact: true }).click();
  const questions = page.waitForEvent("download"); await dialog.getByRole("button", { name: "Questions PDF", exact: true }).click();
  expect((await PDFDocument.load(await readFile((await (await questions).path())!))).getPageCount()).toBe(1);
});

test("a failed or changed steps file shows a clear message and can be retried", async ({ page }) => {
  await seed(page);
  let fail = true;
  await page.route(`**/${stepsFile}`, route => fail ? route.fulfill({ status: 503, body: "unavailable" }) : route.fallback());
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not load");
  await expect(ink(page)).toHaveCount(0);
  fail = false; await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(ink(page)).toBeVisible();
});

test("narrow screens and a crossover occurrence", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/question-bank?tier=H&question=SYNTHETIC_1H_Q1");
  await expect(page.locator(".qb-source-heading strong")).toHaveText("Synthetic higher Q1");
  await expect(page.getByRole("button", { name: "Show worked solution", exact: true })).toBeDisabled();
});

test("a part found by its topic code shows its working over its own cut, and the whole question on request", async ({ page }) => {
  const { matchingParts } = await import("../src/bank/model");
  const { servedParts } = await import("../src/bank/cuts");
  const catalogue = JSON.parse(await readFile("public/bank/catalogue.json", "utf8")) as BankCatalogue;
  let found: { question: BankQuestion; code: string; cut: NonNullable<BankQuestion["cuts"]>[number] } | undefined;
  for (const question of catalogue.questions) {
    if (!question.cuts?.length || question.tier !== "F") continue;
    for (const code of question.codes) {
      const served = servedParts(question, matchingParts(question, code).labels);
      const cut = served?.cuts.find(c => c.role === "part" && !c.added)?.cut;
      if (served && cut) { found = { question, code, cut }; break; }
    }
    if (found) break;
  }
  expect(found).toBeTruthy();
  const { question, code, cut } = found!;
  const view = cut.views[0];
  const body = JSON.stringify({ schemaVersion: 2, questionId: question.id, questionRevision: question.revision, parts: [{
    on: view.id, parts: cut.parts, area: { x: 40, y: 20, width: 200, bottom: Math.max(30, view.height - 10) }, notesX: Math.min(300, view.width - 120), answers: [],
    steps: [{ kind: "text", text: "Synthetic working 3 + 4 = 7" }] }] });
  const data = `bank/assets/worked/${question.id}/synthetic.json`;
  question.workedSolution = { schemaVersion: 2, revision: "synthetic", basedOnQuestionRevision: question.revision, data, dataSha256: createHash("sha256").update(body).digest("hex") };
  catalogue.questions = catalogue.questions.filter(q => q.id === question.id || !q.workedSolution);
  const document = await PDFDocument.create();
  for (let i = 0; i < 4; i++) document.addPage([600, 800]);
  const pdf = Buffer.from(await document.save());
  await routeCatalogue(page, catalogue);
  await page.route(/\/bank\/assets\//, route => {
    const path = new URL(route.request().url()).pathname.slice(1);
    if (path === data) return route.fulfill({ contentType: "application/json", body });
    if (path.endsWith(".pdf")) return route.fulfill({ contentType: "application/pdf", body: pdf });
    return route.fulfill({ contentType: "image/png", body: new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').render().asPng() });
  });
  await page.goto(`/question-bank?code=${encodeURIComponent(code)}&tier=F&question=${question.id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toContainText("Synthetic working");
  await expect(page.locator(".qb-view-info")).toContainText("Show whole question");
  await page.getByRole("button", { name: "Show whole question", exact: true }).click();
  await expect(ink(page).filter({ hasText: "Synthetic working" })).toHaveCount(1);
  await expect(page.locator(".qb-worked-ink svg").last()).toContainText(`Total for Question ${question.number}`);
});

test("step by step and the Mark notes switch hide parts of the working without moving anything", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  const visibleSteps = () => ink(page).locator("[data-step]").evaluateAll(groups => groups.filter(g => (g as SVGGElement).style.display !== "none").map(g => (g as SVGGElement).dataset.step));
  const box = () => ink(page).locator("text", { hasText: "4x + 3" }).first().boundingBox();
  const before = await box();
  await page.getByRole("button", { name: "Step by step", exact: true }).click();
  await expect(page.getByText("Step 0 of 6", { exact: true })).toBeVisible();
  expect(await visibleSteps()).toEqual([]);
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.getByText("Step 2 of 6", { exact: true })).toBeVisible();
  expect(new Set(await visibleSteps())).toEqual(new Set(["1", "2"]));
  expect(await box()).toEqual(before);
  await page.getByRole("button", { name: "Previous step", exact: true }).click();
  expect(new Set(await visibleSteps())).toEqual(new Set(["1"]));
  await page.getByRole("button", { name: "Step by step", exact: true }).click();
  expect((await visibleSteps()).length).toBeGreaterThan(5);
  await expect(ink(page).locator(".wk-mark").first()).toBeVisible();
  await page.getByRole("checkbox", { name: "Mark notes", exact: true }).uncheck();
  await expect(ink(page).locator(".wk-mark").first()).toBeHidden();
  await expect(ink(page).locator("text", { hasText: "subtracts 3 from both sides" })).toBeVisible();
  expect(await box()).toEqual(before);
  await page.reload();
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Mark notes", exact: true })).not.toBeChecked();
});

test("a worked solution exports as an image with its working drawn in", async ({ page }) => {
  await seed(page, steps(170));
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(ink(page)).toBeVisible();
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "PNG", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${target}-worked-solution-1.png`);
  const image = await (await PDFDocument.create()).embedPng(await readFile((await file.path())!));
  // 300 dpi of a 595-point cut, taller than the cut because room was added for the working.
  expect(image.width).toBe(Math.ceil(595.28 * 300 / 72));
  expect(image.height).toBeGreaterThan(420 * 300 / 72 + 104);
  // The working is drawn in: dark-pink guidance and handwriting ink. Counted in the browser's own canvas.
  const count = async (path: string) => page.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    let pink = 0, dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 140 && data[i + 1] < 60 && data[i + 2] > 60 && data[i + 2] < 130) pink++;
      if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) dark++;
    }
    return { pink, dark };
  }, `data:image/png;base64,${(await readFile(path)).toString("base64")}`);
  const teacher = await count((await file.path())!);
  expect(teacher.pink).toBeGreaterThan(500);
  expect(teacher.dark).toBeGreaterThan(5000);
  // A pupil copy leaves the mark codes out of the picture but keeps the guidance words.
  await page.getByRole("checkbox", { name: "Mark notes", exact: true }).uncheck();
  const pupilDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "PNG", exact: true }).click();
  const pupil = await count((await (await pupilDownload).path())!);
  expect(pupil.pink).toBeLessThan(teacher.pink);
  expect(pupil.pink).toBeGreaterThan(100);
});

test("step by step starts again on another question", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await page.getByRole("button", { name: "Step by step", exact: true }).click();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(page.getByText("Step 1 of 6", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("button", { name: "Show worked solution", exact: true }).click();
  await expect(page.getByText("Step 0 of 6", { exact: true })).toBeVisible();
});
