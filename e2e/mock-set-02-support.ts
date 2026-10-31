import {test,expect} from "./release-fixtures";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
const bank=JSON.parse(await readFile("public/bank/catalogue.json","utf8")) as {questions:{id:string;paperId:string;source:string;codes:string[];marks:number;equivalentId?:string;schemeSourceNote?:string;questionViews:unknown[];schemeViews:unknown[]}[]};
const report="coverage/mock-set-02";
export function registerPaper(component:string){
 test(`Mock Set 2 ${component}: every question route, full native question and scheme, measured percentage`,async({page})=>{
  test.setTimeout(180000);const rows=bank.questions.filter(q=>q.paperId===`1MA1_MOCK_SET_02_${component}`),proof=[];
  // Reload once per paper; exercise every remaining deep-link route through
  // the real popstate handler without repeatedly booting the entire app.
  await page.goto(`/question-bank?question=${rows[0].id}`);
  for(const q of rows){
   await page.evaluate(id=>{history.pushState({},"",`/question-bank?question=${id}`);dispatchEvent(new PopStateEvent("popstate"));},q.id);
   await expect(page.locator(".qb-source-heading strong")).toHaveText(q.source);
   await expect.poll(()=>page.locator(".qb-stage canvas").evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>(n as HTMLCanvasElement).width>0))).toBe(true);
   await expect(page.locator('.qb-pdf[aria-busy="true"]')).toHaveCount(0);
   await page.getByRole("checkbox",{name:"Show average marks achieved",exact:true}).check();
   await expect(page.locator(".qb-source-copy .qb-performance").first()).toBeVisible();
   await expect(page.locator(".qb-source-copy .qb-performance-estimated")).toHaveCount(0);
   await page.getByRole("button",{name:"Show mark scheme",exact:true}).click();
   await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();
   await expect(page.locator('.qb-pdf[aria-busy="true"]')).toHaveCount(0);
   for(let view=1;view<q.schemeViews.length;view++){await page.keyboard.press("ArrowRight");await expect(page.locator(".qb-navigation")).toContainText(`View ${view+1} of ${q.schemeViews.length}`);await expect(page.locator(".qb-source-heading strong")).toHaveText(q.source);await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();await expect(page.locator('.qb-pdf[aria-busy="true"]')).toHaveCount(0);}
   if(q.schemeSourceNote){
    await expect(page.locator(".qb-source-copy .qb-erratum")).toHaveText(q.schemeSourceNote);
    await page.getByRole("button",{name:"Display",exact:true}).click();
    await expect(page.getByRole("note",{name:"Source notes",exact:true})).toHaveText(q.schemeSourceNote);
    await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".qb-source-copy .qb-erratum")).toHaveText(q.schemeSourceNote);
   }
   if(q.equivalentId)await expect(page.locator(".qb-source-copy .qb-performance")).toHaveCount(2);
   proof.push({id:q.id,question:true,scheme:true,measured:true,sourceNote:!!q.schemeSourceNote});
  }
  await mkdir(report,{recursive:true});await writeFile(`${report}/${component}.json`,JSON.stringify(proof,null,2));
  await page.screenshot({path:`${report}/${component}.png`});
 });
}
export function registerMobile(){test("Mock Set 2: mobile display and keyboard preserve question and answer context",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/question-bank?question=1MA1_MOCK_SET_02_2H_Q17");
 await expect(page.locator(".qb-stage canvas").first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Display",exact:true}).click();await expect(page.getByRole("button",{name:"Exit Display Esc",exact:true})).toBeVisible();await page.keyboard.press("m");
 await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Hide mark scheme",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByRole("button",{name:"Display",exact:true})).toBeVisible();
 await mkdir(report,{recursive:true});await page.screenshot({path:`${report}/mobile.png`});
});
}

export function registerDownloads(component:string){test(`Mock Set 2 ${component}: both full-paper browser exports and assessment preset`,async({page})=>{
 test.setTimeout(180000);
 const rows=bank.questions.filter(q=>q.paperId===`1MA1_MOCK_SET_02_${component}`).sort((a,b)=>Number(a.id.split('_Q')[1])-Number(b.id.split('_Q')[1]));
 await page.goto(`/question-bank?question=${rows[0].id}`);
 for(const q of rows){
  await page.evaluate(id=>{history.pushState({},"",`/question-bank?question=${id}`);dispatchEvent(new PopStateEvent("popstate"));},q.id);
  await expect(page.locator(".qb-source-heading strong")).toHaveText(q.source);
  await page.getByRole("button",{name:"Select question",exact:true}).click();
 }
 await page.getByRole("button",{name:`Review paper (${rows.length})`,exact:true}).click();const dialog=page.getByRole("dialog");
 await expect(dialog).toContainText(`${rows.length} complete questions · 80 marks`);await mkdir(report,{recursive:true});
 const proof=[];
 for(const preset of ["Compact practice","Writing space"]){
  await dialog.getByRole("radio",{name:preset,exact:true}).check();await dialog.getByRole("button",{name:"Prepare both PDFs",exact:true}).click();
  await expect(dialog.getByText("Both PDFs are ready",{exact:true})).toBeVisible({timeout:90000});
  for(const name of ["Questions PDF","Mark schemes PDF"]){
   const waiting=page.waitForEvent("download");await dialog.getByRole("button",{name,exact:true}).click();const destination=`${report}/${component}-${preset}-${name}.pdf`;
   await(await waiting).saveAs(destination);const pdf=await PDFDocument.load(await readFile(destination));
   expect(pdf.getSubject()).toContain(`${rows.length} source questions, 80 marks`);expect(pdf.getPageCount()).toBeGreaterThan(0);
   expect(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe("None");proof.push({preset,name,pages:pdf.getPageCount(),destination});
  }
 }
 await page.goto("/assessment-follow-up");await page.getByLabel("Choose assessment",{exact:true}).selectOption(`1MA1_MOCK_SET_02_${component}`);
 await page.getByText("View or edit mapping",{exact:true}).click();const mapping=await page.getByRole("group",{name:"Assessment questions",exact:true}).getByRole("textbox").inputValue();
 expect(mapping).toContain("1");await writeFile(`${report}/${component}-exports.json`,JSON.stringify({downloads:proof,assessmentMapping:mapping},null,2));
 await page.screenshot({path:`${report}/${component}-assessment.png`});
});}
