import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import type { BankCatalogue, BankQuestion } from "../src/bank/model";

const prefix="bank/assets/worked-fixture/";
const target="SYNTHETIC_1F_Q1";
async function seed(page:Page) {
  const catalogue=JSON.parse(await readFile("public/bank/catalogue.json","utf8")) as BankCatalogue;
  const bodies=new Map<string,Buffer>();
  async function pdf(name:string,worked=false,pages=1) {
    const document=await PDFDocument.create(),font=await document.embedFont(StandardFonts.Helvetica);
    for(let i=0;i<pages;i++) {
      const sheet=document.addPage([595.28,841.89]);
      sheet.drawText("SYNTHETIC TEST RESOURCE",{x:40,y:790,size:16,font});
      sheet.drawText(i?"Q1 continued: explain your method.":"Q1 Calculate 1 + 1.",{x:40,y:740,size:14,font});
      sheet.drawText("Q2 Printed neighbouring question (answer omitted).",{x:40,y:420,size:12,font});
      if(worked)sheet.drawText(i?"Add one to one to make two.":"1 + 1 = 2",{x:40,y:680,size:18,font});
    }
    const bytes=Buffer.from(await document.save());bodies.set(prefix+name,bytes);return bytes;
  }
  await pdf("question.pdf");await pdf("scheme.pdf",true);
  const worked=await pdf("solution.pdf",true,2);
  bodies.set(prefix+"preview.png",new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842"><rect width="595" height="842" fill="white"/></svg>').render().asPng());
  const base=catalogue.questions[0];
  const view={id:"q",label:"Question",page:1,width:595.28,height:841.89,preview:prefix+"preview.png",description:"Synthetic printed question",sourcePages:[8]};
  const question:BankQuestion={...base,id:target,source:"Synthetic target Q1",paperId:"SYNTHETIC_1F",tier:"F",number:1,order:1,revision:"synthetic-q1",questionPdf:prefix+"question.pdf",printPdf:prefix+"question.pdf",schemePdf:prefix+"scheme.pdf",questionViews:[view],schemeViews:[{...view,id:"scheme",description:"Synthetic marking example"}],printPages:[{width:595.28,height:841.89}],scaleSensitive:false,
    equivalentId:"SYNTHETIC_1H_Q1",equivalentSource:"Synthetic higher Q1",
    workedSolution:{schemaVersion:1,revision:"synthetic-solution",basedOnQuestionRevision:"synthetic-q1",pdf:prefix+"solution.pdf",pdfSha256:createHash("sha256").update(worked).digest("hex"),views:[8,9].map((source,i)=>({...view,id:`solution-${i}`,label:`Original page ${source}`,page:i+1,sourcePages:[source],description:`Synthetic Q1 worked solution, original page ${source}`}))}};
  const other={...question,id:"SYNTHETIC_1F_Q2",source:"Synthetic next Q2",number:2,order:2,equivalentId:undefined,equivalentSource:undefined,workedSolution:undefined};
  const crossover={...question,id:"SYNTHETIC_1H_Q1",source:"Synthetic higher Q1",tier:"H" as const,paperId:"SYNTHETIC_1H",equivalentId:target,equivalentSource:question.source,workedSolution:undefined};
  catalogue.questions=[question,other,crossover];
  const requests:string[]=[];
  await page.route("**/bank/catalogue.json",route=>route.fulfill({json:catalogue}));
  await page.route("**/bank/assets/worked-fixture/**",route=>{
    const path=new URL(route.request().url()).pathname.slice(1);requests.push(path);
    const body=bodies.get(path);
    return route.fulfill({status:body?200:404,contentType:path.endsWith(".png")?"image/png":"application/pdf",body});
  });
  await page.goto(`/?tool=question-bank&tier=F&question=${target}`,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toBeEnabled();
  await expect(page.locator(".qb-canvas-host canvas")).toHaveCount(1);
  return {requests,bodies,question};
}

test("worked solutions are deliberately revealed, mutually exclusive and scoped to the selected question",async({page})=>{
  const {requests}=await seed(page);
  expect(requests.some(p=>p.endsWith("solution.pdf"))).toBe(false);
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("button",{name:"Hide worked solution",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".qb-view-info")).toContainText("Worked solution");
  await expect(page.getByRole("img",{name:/Synthetic Q1 worked solution, original page 8/})).toBeVisible();
  const sections=page.getByRole("navigation",{name:"Main sections",exact:true});
  await sections.getByRole("link",{name:"Booklet tools",exact:true}).click();
  await sections.getByRole("link",{name:"Question bank",exact:true}).click();
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toHaveAttribute("aria-pressed","false");
  await expect(page.getByRole("img",{name:"Synthetic printed question",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 9/})).toBeVisible();
  await page.getByRole("button",{name:"Show mark scheme",exact:true}).click();
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toHaveAttribute("aria-pressed","false");
  await expect(page.locator(".qb-view-info")).toContainText("Mark scheme");
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("button",{name:"Show mark scheme",exact:true})).toHaveAttribute("aria-pressed","false");
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await expect(page.locator(".qb-source-heading strong")).toHaveText("Synthetic next Q2");
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toBeDisabled();
  await expect(page.getByText("Not available yet",{exact:true})).toBeVisible();
  await expect(page.locator(".qb-view-info")).toContainText("Question");
  await page.goBack();
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toHaveAttribute("aria-pressed","false");
  await page.reload();
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toHaveAttribute("aria-pressed","false");
});

test("solution download and whole/single PNG actions use the selected resource while paper exports keep their two original outputs",async({page})=>{
  await seed(page);
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  await page.getByLabel("Question options",{exact:true}).click();
  await expect(page.getByRole("link",{name:"Worked solution PDF",exact:true})).toHaveAttribute("href",new RegExp("solution.pdf$"));
  await expect(page.getByRole("link",{name:"Source question PDF",exact:true})).toHaveAttribute("href",new RegExp("question.pdf$"));
  await page.getByLabel("Question options",{exact:true}).click();
  const single=page.waitForEvent("download");await page.getByRole("button",{name:"PNG",exact:true}).click();
  const download=await single;expect(download.suggestedFilename()).toBe(`${target}-worked-solution-1.png`);
  const imageDoc=await PDFDocument.create(),singleImage=await imageDoc.embedPng(await readFile((await download.path())!));
  await page.getByRole("checkbox",{name:"Whole question",exact:true}).check();
  const whole=page.waitForEvent("download");await page.getByRole("button",{name:"PNG",exact:true}).click();
  const wholeDownload=await whole;expect(wholeDownload.suggestedFilename()).toBe(`${target}-worked-solution-whole.png`);
  const wholeImage=await imageDoc.embedPng(await readFile((await wholeDownload.path())!));
  expect(wholeImage.height).toBeGreaterThan(singleImage.height*1.9);
  await page.getByRole("button",{name:"Select question",exact:true}).click();
  await page.getByRole("button",{name:"Review paper (1)",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByText("Worked solution",{exact:true})).toHaveCount(0);
  await dialog.getByRole("button",{name:"Prepare both PDFs",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Questions PDF",exact:true})).toBeVisible();
  const questionsDownload=page.waitForEvent("download");await dialog.getByRole("button",{name:"Questions PDF",exact:true}).click();
  expect((await PDFDocument.load(await readFile((await (await questionsDownload).path())!))).getPageCount()).toBe(1);
  const schemesDownload=page.waitForEvent("download");await dialog.getByRole("button",{name:"Mark schemes PDF",exact:true}).click();
  expect((await PDFDocument.load(await readFile((await (await schemesDownload).path())!))).getPageCount()).toBe(1);
});

test("Display, desktop and narrow-screen reveal controls retain original full-page content",async({page})=>{
  await seed(page);
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  await page.screenshot({path:test.info().outputPath("worked-desktop.png")});
  await page.getByRole("button",{name:"Display",exact:true}).click();
  await expect(page.getByRole("button",{name:"Hide worked solution",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Hide worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:"Synthetic printed question",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({width:375,height:900});
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("worked-mobile.png")});
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 9/})).toBeVisible();
  await page.getByRole("button",{name:"Hide worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:"Synthetic printed question",exact:true})).toBeVisible();
});

test("a failed solution load cannot leave a previous answer canvas and retries only that PDF",async({page})=>{
  await seed(page);
  let fail=true;
  await page.route("**/bank/assets/worked-fixture/solution.pdf",async route=>{
    if(fail)return route.fulfill({status:503,body:"unavailable"});
    return route.fallback();
  });
  await page.getByRole("button",{name:"Show worked solution",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Worked solution could not load.");
  await expect(page.locator(".qb-canvas-host canvas")).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Open PDF",exact:true})).toHaveAttribute("href",/solution.pdf$/);
  fail=false;await page.getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByRole("img",{name:/original page 8/})).toBeVisible();
  await page.getByRole("button",{name:"Hide worked solution",exact:true}).click();
  await expect(page.getByRole("img",{name:"Synthetic printed question",exact:true})).toBeVisible();
});

test("a crossover occurrence never inherits another occurrence's solution",async({page})=>{
  await seed(page);
  await page.goto("/?tool=question-bank&tier=H&question=SYNTHETIC_1H_Q1");
  await expect(page.locator(".qb-source-heading strong")).toHaveText("Synthetic higher Q1");
  await expect(page.getByRole("button",{name:"Show worked solution",exact:true})).toBeDisabled();
});
