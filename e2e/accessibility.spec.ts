import { test, expect } from "./release-fixtures";
import { readFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { withPerformance, compareAccessibility } from "../src/bank/performance";
import { emptyRoute, filterQuestions, type BankCatalogue } from "../src/bank/model";

const bank=withPerformance(JSON.parse(await readFile("public/bank/catalogue.json","utf8")) as BankCatalogue);
const report="../../reports/mathsdock-accessibility-testing-2026-10-12";
test("default-off toggle, measured and estimated badges, stable ordering and crossover links",async({page})=>{
  await page.goto("/question-bank?code=U851&tier=F");
  await expect(page.getByRole("checkbox",{name:"Show average marks achieved"})).not.toBeChecked();
  await expect(page.locator(".qb-performance")).toHaveCount(0);
  await page.getByRole("button",{name:/^\d+ questions?$/}).click();
  const expected=filterQuestions(bank,{...emptyRoute,code:"U851",tier:"F"});
  await expect(page.locator(".qb-result")).toHaveCount(expected.length);
  const sources=await page.locator(".qb-result b").allTextContents();
  expect(sources).toEqual(expected.map((q,i)=>`${i+1}. ${q.source}`));
  const source=await page.locator(".qb-source-heading strong").textContent();
  await page.getByRole("checkbox",{name:"Show average marks achieved"}).check();
  await expect(page.locator(".qb-source-heading strong")).toHaveText(source!);
  await expect(page.locator(".qb-performance-estimated").first()).toContainText("Estimated");
  const measured=page.locator(".qb-performance:not(.qb-performance-estimated)").first();
  await expect(measured).toBeVisible();
  await expect(page.locator(".qb-stage canvas").first()).toBeVisible();
  await mkdir(report,{recursive:true});await page.screenshot({path:`${report}/desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.qb-pdf[aria-busy="true"]')).toHaveCount(0);
  await page.screenshot({path:`${report}/mobile.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const f=bank.questions.find(q=>q.id==="1MA1_JUN_2017_1F_Q21")!,h=bank.questions.find(q=>q.id===f.equivalentId)!;
  for(const q of [f,h]){
    await page.goto(`/question-bank?code=${q.codes[0]}&question=${q.id}`);
    await expect(page.locator(".qb-source-heading strong")).toHaveText(q.source);
    await page.getByRole("checkbox",{name:"Show average marks achieved"}).check();
    await expect(page.locator(".qb-source-copy .qb-performance")).toHaveCount(2);
  }
});

test("draft ordering, grey estimates, manual moves and both real PDF exports",async({page})=>{
  test.setTimeout(120000);
  const questions=["1MA1_JUN_2017_1F_Q1","1MA1_MOCK_SET_05_1F_Q1","1MA1_JUN_2017_1F_Q2"].map(id=>bank.questions.find(q=>q.id===id)!);
  await page.goto(`/question-bank?code=${questions[0].codes[0]}&question=${questions[0].id}`);
  await page.getByRole("button",{name:/^\d+ questions?$/}).click();
  for(const q of questions){
    await page.getByRole("combobox",{name:"Sparx code or topic"}).fill(q.codes[0]);
    await page.getByRole("button",{name:"Find",exact:true}).click();
    await page.locator(".qb-result button").filter({hasText:q.source}).click();
    await expect(page.locator(".qb-source-heading strong")).toHaveText(q.source);
    await page.getByRole("button",{name:"Select question",exact:true}).click();
  }
  await page.getByRole("button",{name:"Review paper (3)",exact:true}).click();
  const dialog=page.getByRole("dialog");
  const sorted=[...questions].sort(compareAccessibility);
  expect(await dialog.locator(".qb-paper-review-row strong").allTextContents()).toEqual(sorted.map((q,i)=>`${i+1}. ${q.source}`));
  await dialog.getByRole("checkbox",{name:"Show average marks achieved"}).check();
  await expect(dialog.locator(".qb-performance-estimated")).toContainText("Estimated");
  await dialog.getByRole("button",{name:"Move question 3 up",exact:true}).click();
  [sorted[1],sorted[2]]=[sorted[2],sorted[1]];
  expect(await dialog.locator(".qb-paper-review-row strong").allTextContents()).toEqual(sorted.map((q,i)=>`${i+1}. ${q.source}`));
  await page.screenshot({path:`${report}/review.png`,fullPage:true});
  for(const preset of ["Compact practice","Writing space"]){
    await dialog.getByRole("radio",{name:preset,exact:true}).check();
    await dialog.getByRole("button",{name:"Prepare both PDFs"}).click();
    await expect(dialog.getByText("Both PDFs are ready",{exact:true})).toBeVisible({timeout:90000});
    for(const role of ["Questions PDF","Mark schemes PDF"]){
      const download=page.waitForEvent("download");await dialog.getByRole("button",{name:role,exact:true}).click();
      const path=`${report}/${preset.replaceAll(" ","-")}-${role.replaceAll(" ","-")}.pdf`;
      await (await download).saveAs(path);const pdf=await PDFDocument.load(await readFile(path));expect(pdf.getPageCount()).toBeGreaterThan(0);
    }
  }
  await dialog.getByRole("button",{name:"Close paper review"}).click();
  await page.getByRole("button",{name:"Review paper (3)",exact:true}).click();
  expect(await dialog.locator(".qb-paper-review-row strong").allTextContents()).toEqual(sorted.map((q,i)=>`${i+1}. ${q.source}`));
});
