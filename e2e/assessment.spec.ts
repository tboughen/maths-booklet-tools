import { test, expect } from "./release-fixtures";
import { readFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
test.describe.configure({ timeout: 90000 });

for (const pair of ["1-2", "3-4", "5-6"]) for (const tier of ["H", "F"]) {
  test(`HPP${pair}_${tier} uses spreadsheet order for mappings, templates and marks`, async ({ page }) => {
    const data = JSON.parse(await readFile("src/assessment/presets-data.json", "utf8"));
    const selections = data.presets.filter((p: { id: string }) => pair.split("-").some(n => p.id === `HPP${n}_${tier}`));
    await page.goto("/?tool=assessment-follow-up");
    await page.getByLabel("Choose assessment", { exact: true }).selectOption(`HPP${pair}_${tier}`);
    const parts = page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true });
    const summary = page.getByText("View or edit mapping", { exact: true });
    for (const partScores of [true, false]) {
      await parts.setChecked(partScores);
      const number = (item: { label: string }) => Number(item.label.match(/\d+/)![0]);
      const items: { label: string; marks: number }[] = selections.flatMap((p: Record<string, { label: string; marks: number }[]>) => p[partScores ? "parts" : "items"]);
      items.sort((a, b) => number(b) % 2 - number(a) % 2 || number(a) - number(b));
      await summary.click();
      const tableLabels = await page.locator(".af-table").first().locator("tbody tr td:first-child").allTextContents();
      expect(tableLabels).toEqual(items.map(item => item.label));
      await summary.click();
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download template", exact: true }).click();
      const downloaded = await pending;
      const csv = await readFile((await downloaded.path())!, "utf8");
      expect(csv.split("\n")[0].split('","').slice(4).map(cell => cell.replace(/"$/g, ""))).toEqual(items.map(item => item.label));
      await page.getByLabel("Paste marks", { exact: true }).fill(items.map(item => number(item) % 2 ? "0" : String(item.marks)).join("\t"));
      await expect(page.locator(".af-import-summary")).toContainText(`${items.length}/${items.length} columns matched`);
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeEnabled({ timeout: 60000 });
    await page.getByText("Why these questions?", { exact: true }).click();
    const reasons = await page.getByText("Why these questions?", { exact: true }).locator("..").locator("li").allTextContents();
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      const references = reason.match(/follow-up to (.*?) ·/)![1].match(/Q\d+/g)!;
      expect(references.length).toBeGreaterThan(0);
      expect(references.every(label => Number(label.slice(1)) % 2 === 1)).toBe(true);
    }
    if (pair === "1-2" && tier === "H") {
      await summary.click();
      await page.screenshot({ path: "coverage/assessment/hpp-odd-first.png", fullPage: true });
    }
  });
}

async function enterClass(page: import("@playwright/test").Page) {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("1MA1_NOV_2019_1H");
  await page.getByText("View or edit mapping", { exact: true }).click();
  const mapping = await page.getByRole("group", { name: "Assessment questions", exact: true }).getByRole("textbox").inputValue();
  const rows = mapping.split("\n").slice(1).map(row => row.split('","').map(cell => cell.replace(/^"|"$/g, "")));
  const labels = rows.map(row => row[0]);
  await page.getByText("View or edit mapping", { exact: true }).click();
  const results = ["Student identifier,Year,Tier,Strength," + labels.join(","), "ANON-01,,,," + labels.map(() => "0").join(","), "ANON-02,9,H,developing," + labels.map(row => row ? "1" : "").join(","), "ANON-03,,,," + labels.map(() => "").join(",")].join("\n");
  await page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox").fill(results);
  await expect(page.getByText("3 students", { exact: false })).toBeVisible();
}
test("generates and downloads one real class PDF, preserves navigation, and clears pupil data", async ({ page }) => {
  const requests: { url: string; method: string; body: string | null }[] = [], errors: string[] = [];
  page.on("request", r => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
  page.on("pageerror", e => errors.push(e.message));
  await enterClass(page);
  await expect(page.getByRole("button", { name: "Generate class pack", exact: true })).toHaveClass(/af-primary/);
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).not.toHaveClass(/af-primary/);
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeEnabled({ timeout: 60000 });
  await expect(page.getByRole("button", { name: "Generate class pack", exact: true })).not.toHaveClass(/af-primary/);
  for (const button of await page.getByRole("button", { name: "Download class PDF" }).all()) await expect(button).toHaveClass(/af-primary/);
  await expect(page.locator(".af-pack-summary")).toContainText("3 students");
  await expect(page.getByText("12 pages total", { exact: false })).toBeVisible();
  await expect(page.locator(".af-preview canvas")).toBeVisible();
  await page.waitForTimeout(1000);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download class PDF" }).first().click();
  const downloaded = await download; await mkdir("coverage/assessment", { recursive: true });
  await downloaded.saveAs("coverage/assessment/browser-class.pdf");
  const pdf = await PDFDocument.load(await readFile("coverage/assessment/browser-class.pdf")); expect(pdf.getPageCount()).toBe(12);
  await page.screenshot({ path: "coverage/assessment/desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Question bank", exact: true }).first().click();
  await page.getByRole("link", { name: "Assessment follow-up", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: "Generate class pack", exact: true })).not.toHaveClass(/af-primary/);
  expect(requests.every(r => !r.url.includes("ANON-") && !r.body?.includes("ANON-"))).toBe(true);
  expect(requests.every(r => r.method === "GET")).toBe(true);
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].every(value => !value.includes("ANON-")))).toBe(true);
  await page.getByRole("button", { name: "Reset and clear data" }).click();
  await expect(page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Generate class pack", exact: true })).toHaveClass(/af-primary/);
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).not.toHaveClass(/af-primary/);
  await expect(page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true })).toBeChecked();
  await expect(page.getByText("ANON-01", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("common mode gives everyone the absent pupil pack and works at 320px", async ({ page }) => {
  await enterClass(page);
  await page.getByLabel("Same questions for everyone").check();
  await page.getByLabel("Pages per student").selectOption("2");
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeEnabled({ timeout: 60000 });
  await expect(page.getByText("Student details", { exact: true }).locator("..").locator("table")).not.toBeVisible();
  await page.getByText("Student details", { exact: true }).click();
  await expect(page.getByRole("cell", { name: "Common set", exact: true })).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "coverage/assessment/mobile.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox")).toHaveValue("");
});
test("imports an actual XLSX workbook without network submission and supports sheet selection", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).uncheck();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("1MA1_NOV_2019_1H");
  await page.getByRole("group", { name: "Student marks", exact: true }).locator('input[type=file]').setInputFiles("e2e/fixtures/assessment-results.xlsx");
  await expect(page.getByText("3 students", { exact: false })).toBeVisible();
  await page.getByRole("group", { name: "Student marks", exact: true }).getByLabel("Workbook sheet").selectOption({ label: "One pupil" });
  await expect(page.getByText("1 student", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeEnabled({ timeout: 60000 });
});
test("HPP/MM presets accept headerless scores and preserve the first pupil", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).uncheck();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("HPP1_H");
  await expect(page.locator(".af-assessment-summary")).toHaveText("11 score columns expected");
  await expect(page.getByRole("group", { name: "Assessment questions", exact: true })).not.toBeVisible();
  const results = Array(11).fill("0").join("\t") + "\n" + Array(11).fill("1").join("\t");
  await page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox").fill(results);
  await expect(page.locator(".af-import-summary")).toContainText("2 students");
  await expect(page.locator(".af-import-summary")).toContainText("11/11 columns matched");
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).last()).toBeEnabled({ timeout: 60000 });
  await page.getByText("Student details", { exact: true }).click();
  await expect(page.getByRole("button", { name: "S001", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "S002", exact: true })).toBeVisible();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("MM1_H");
  await expect(page.locator(".af-assessment-summary")).toHaveText("12 score columns expected");
  await expect(page.getByText("Changes made — generate again")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeDisabled();
});
test("numeric identifiers, pack ranges, page navigation and both downloads work together", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).uncheck();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("MM1_H");
  await page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox").fill(["1001\t" + Array(12).fill("0").join("\t"), "1002\t" + Array(12).fill("1").join("\t")].join("\n"));
  await page.getByText("Adjust import", { exact: true }).click();
  await expect(page.getByText("Adjust import", { exact: true }).locator("..")).toContainText("Identifiers from column 1.");
  await page.getByText("Adjust import", { exact: true }).click();
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).last()).toBeEnabled({ timeout: 60000 });
  await page.getByText("Student details", { exact: true }).click();
  const rows = page.locator(".af-table").last().locator("tbody tr");
  const counts = [], marks = [];
  for (const row of await rows.all()) { counts.push(Number(await row.locator("td").nth(1).innerText())); marks.push(Number(await row.locator("td").nth(2).innerText())); }
  const expected = (values: number[]) => Math.min(...values) === Math.max(...values) ? String(values[0]) : `${Math.min(...values)}–${Math.max(...values)}`;
  await expect(page.locator(".af-pack-summary")).toContainText(expected(counts) + " questions each");
  await expect(page.locator(".af-pack-summary")).toContainText(expected(marks) + " marks each");
  await page.getByLabel("Preview student", { exact: true }).selectOption("1");
  await expect(page.getByText("Page 1 of 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Page 2 of 4", { exact: true })).toBeVisible();
  const downloaded = [];
  for (const [index, button] of (await page.getByRole("button", { name: "Download class PDF" }).all()).entries()) {
    const pending = page.waitForEvent("download"); await button.click(); const download = await pending;
    const path = `coverage/assessment/download-${index}.pdf`; await download.saveAs(path); downloaded.push(await readFile(path));
  }
  expect(downloaded[0].equals(downloaded[1])).toBe(true);
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Download class PDF" }).first()).not.toHaveClass(/af-primary/);
  await expect(page.getByRole("button", { name: "Generate class pack", exact: true })).toHaveClass(/af-primary/);
  await expect(page.getByText("Changes made — generate again")).toBeVisible();
});
test("Adjust import can correct alignment without losing data", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).uncheck();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("MM1_H");
  await page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox").fill("1001\tnotes\t" + Array(12).fill("0").join("\t"));
  await page.getByText("Adjust import", { exact: true }).click();
  await page.getByLabel("Student identifiers", { exact: true }).selectOption("0");
  await page.getByLabel("Question columns", { exact: true }).selectOption("2");
  await expect(page.locator(".af-import-summary")).toContainText("1 student");
  await expect(page.locator(".af-import-summary")).toContainText("12/12 columns matched");
  await expect(page.locator(".af-import-summary")).not.toContainText("missing result");
  await expect(page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox")).toHaveValue(/1001/);
});
test("full HPPs default to separate part scores and regenerate when switched to question totals", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  const parts = page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true });
  await expect(parts).toBeChecked();
  const chooser = page.getByLabel("Choose assessment", { exact: true });
  for (const pair of ["1-2", "3-4", "5-6"]) for (const tier of ["H", "F"]) {
    await expect(chooser.locator(`option[value="HPP${pair}_${tier}"]`)).toHaveText(`HPP${pair} — ${tier === "H" ? "Higher" : "Foundation"} — 80 marks`);
  }
  await chooser.selectOption("HPP1-2_H");
  await expect(page.locator(".af-assessment-summary")).toHaveText(/\d+ score columns expected/);
  await page.getByText("View or edit mapping", { exact: true }).click();
  const mappingInput = page.getByRole("group", { name: "Assessment questions", exact: true }).getByRole("textbox");
  const mapping = await mappingInput.inputValue();
  const labels = mapping.split("\n").slice(1).map(row => row.split('","')[0].replace(/^"/, ""));
  expect(labels.some(label => /[a-z]/i.test(label.slice(1)))).toBe(true);
  await expect(page.getByText("Multiple codes:", { exact: false })).toBeVisible();
  await page.getByText("View or edit mapping", { exact: true }).click();
  const results = page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox");
  await results.fill(labels.map(() => "0").join("\t"));
  await expect(page.locator(".af-import-summary")).toContainText(`${labels.length}/${labels.length} columns matched`);
  await expect(page.locator(".af-import-summary")).not.toContainText("missing result");
  const generate = page.getByRole("button", { name: "Generate class pack", exact: true });
  const download = page.getByRole("button", { name: "Download class PDF" }).first();
  await generate.click();
  await expect(download).toBeEnabled({ timeout: 60000 });
  await expect(generate).not.toHaveClass(/af-primary/);
  await expect(download).toHaveClass(/af-primary/);
  await expect(page.locator(".af-preview canvas")).toBeVisible();
  await expect.poll(() => page.locator(".af-preview canvas").evaluate((canvas: HTMLCanvasElement) => {
    if (canvas.width < 500) return false;
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0 && pixels[i] < 180 && pixels[i + 1] < 180 && pixels[i + 2] < 180) dark++;
    return dark > 100;
  }), { timeout: 15000 }).toBe(true);
  await page.screenshot({ path: "coverage/assessment/full-hpp-parts.png", fullPage: true });
  await parts.uncheck();
  await expect(page.locator(".af-assessment-summary")).toHaveText(/\d+ score columns expected/);
  await expect(download).toBeDisabled();
  await expect(generate).toHaveClass(/af-primary/);
  await page.getByText("View or edit mapping", { exact: true }).click();
  const questionCount = (await mappingInput.inputValue()).split("\n").length - 1;
  expect(questionCount).toBeLessThan(labels.length);
  await page.getByText("View or edit mapping", { exact: true }).click();
  await results.fill(Array(questionCount).fill("0").join("\t"));
  await generate.click();
  await expect(download).toBeEnabled({ timeout: 60000 });
  await expect(generate).not.toHaveClass(/af-primary/);
  await expect(download).toHaveClass(/af-primary/);
  await page.getByRole("button", { name: "Reset and clear data" }).click();
  await expect(parts).toBeChecked();
  await expect(generate).toHaveClass(/af-primary/);
  await expect(download).not.toHaveClass(/af-primary/);
});
test("marks-only example and optional details make the initial workflow simple", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await expect(page.getByLabel("Choose assessment", { exact: true })).toHaveValue("");
  await expect(page.getByRole("group", { name: "Assessment questions", exact: true })).toHaveCount(0);
  await expect(page.getByText("Paste marks only, one student per row.", { exact: false })).toBeVisible();
  await expect(page.getByText("How your data is handled", { exact: true }).locator("..")).not.toHaveAttribute("open", "");
  await expect(page.getByText("More options", { exact: true }).locator("..")).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Calculator", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Multiple codes:", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: "coverage/assessment/simplified-empty.png", fullPage: true });
  await page.getByRole("button", { name: "Try example", exact: true }).click();
  const cells = (await page.getByRole("group", { name: "Student marks", exact: true }).getByRole("textbox").inputValue()).split("\n").map(row => row.split("\t"));
  expect(cells).toHaveLength(3);
  expect(cells.flat().every(value => value === "" || /^\d+$/.test(value))).toBe(true);
  expect(cells[2].every(value => value === "")).toBe(true);
  await expect(page.locator(".af-import-summary")).toContainText("3 students");
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).last()).toBeEnabled({ timeout: 60000 });
  const students = page.getByLabel("Preview student", { exact: true });
  expect(await students.locator("option").allTextContents()).toEqual([expect.stringMatching(/^S001 —/), expect.stringMatching(/^S002 —/), expect.stringMatching(/^S003 —/)]);
  await expect(page.getByText("Student details", { exact: true }).locator("..")).not.toHaveAttribute("open", "");
  await students.selectOption("2");
  await expect(page.getByText("Page 1 of 4", { exact: true })).toBeVisible();
  await expect(page.locator(".af-pack-summary")).toContainText("3 students");
});
test("custom mappings, import warnings and marks-only limits remain accessible", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("custom");
  await page.getByRole("group", { name: "Assessment questions", exact: true }).getByRole("textbox").fill("Question,Max marks,Sparx codes\nQ1,3,U753\nQ2,3,U751");
  const marks = page.getByLabel("Paste marks", { exact: true });
  await marks.fill("Student identifier,Q1\nS001,4");
  await expect(page.getByRole("alert").filter({ hasText: "score columns missing" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "invalid score" })).toBeVisible();
  await page.getByText("import notices — check details", { exact: false }).click();
  await expect(page.getByText("invalid score for Q1", { exact: false })).toBeVisible();
  await marks.fill("0\t0\n1\t1");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByText("More options", { exact: true }).click();
  await page.getByLabel("Limit marks", { exact: true }).check();
  await page.getByLabel("Maximum marks", { exact: true }).fill("10");
  await page.getByLabel("Limit pages", { exact: true }).uncheck();
  await expect(page.getByText("No page limit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download class PDF" }).last()).toBeEnabled({ timeout: 60000 });
  await page.getByText("Student details", { exact: true }).click();
  for (const row of await page.locator(".af-table").last().locator("tbody tr").all()) expect(Number(await row.locator("td").nth(2).innerText())).toBeLessThanOrEqual(10);
  await page.getByRole("button", { name: "Reset and clear data", exact: true }).click();
  await expect(page.getByRole("group", { name: "Assessment questions", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Pages per student", { exact: true })).toHaveValue("4");
});
test("home entry, keyboard navigation and tablet widths remain usable", async ({ page }) => {
  await page.goto("/?tool=home");
  await page.getByRole("link", { name: /Create class practice/ }).click();
  await expect(page.getByRole("heading", { name: "Assessment follow-up", exact: true })).toBeVisible();
  for (const width of [320, 375, 621, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Reset and clear data" }).focus();
  await expect(page.getByRole("button", { name: "Reset and clear data" })).toBeFocused();
  await page.getByRole("button", { name: "Try example" }).click();
  await expect(page.getByText("3 students", { exact: false })).toBeVisible();
});

test("untaught topics are optional, preserve mark columns and invalidate generated packs", async ({ page }) => {
  await page.goto("/?tool=assessment-follow-up");
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("custom");
  await page.getByRole("group", { name: "Assessment questions", exact: true }).getByRole("textbox").fill("Question,Max marks,Sparx codes\nQ1,3,U168\nQ2,3,U753");
  const exclusions = page.getByText("Not yet taught", { exact: true }).locator("..");
  await expect(exclusions).not.toHaveAttribute("open", "");
  await page.getByLabel("Paste marks", { exact: true }).fill("0\t0\n\t");
  await expect(page.locator("div.af-import-summary")).toContainText("2/2 columns matched");
  await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
  const download = page.getByRole("button", { name: "Download class PDF" }).first();
  await expect(download).toBeEnabled({ timeout: 60000 });
  await page.getByText("Why these questions?", { exact: true }).click();
  await expect(page.getByText("Why these questions?", { exact: true }).locator("..")).toContainText("follow-up to Q1");
  await exclusions.locator("summary").click();
  await page.getByRole("checkbox", { name: /^Q1 ·/ }).check();
  await expect(download).toBeDisabled();
  await expect(page.getByText("Changes made — generate again")).toBeVisible();
  await expect(page.getByText("Not yet taught · 1 skipped", { exact: true })).toBeVisible();
  await expect(page.locator("div.af-import-summary")).toContainText("2/2 columns matched");
  for (const common of [false, true]) {
    await page.getByLabel("Same questions for everyone").setChecked(common);
    await page.getByRole("button", { name: "Generate class pack", exact: true }).click();
    await expect(download).toBeEnabled({ timeout: 60000 });
    const reasons = page.getByText("Why these questions?", { exact: true }).locator("..");
    if (!(await reasons.getAttribute("open"))) await reasons.locator("summary").click();
    await expect(reasons).not.toContainText("follow-up to Q1");
    await expect(reasons).toContainText("follow-up to Q2");
  }
  await page.setViewportSize({ width: 320, height: 950 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Reset and clear data" }).click();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("HPP3-4_H");
  await page.getByText("Not yet taught", { exact: true }).click();
  expect(await page.locator(".af-topic-exclusions input:checked").count()).toBe(0);
  await page.getByRole("checkbox", { name: /^Q17 ·/ }).check();
  await page.getByLabel("Separate scores for 1a, 1b, etc.", { exact: true }).uncheck();
  await expect(page.getByRole("checkbox", { name: /^Q17 ·/ })).toBeChecked();
  await page.getByLabel("Choose assessment", { exact: true }).selectOption("MM1_H");
  expect(await page.locator(".af-topic-exclusions input:checked").count()).toBe(0);
});
