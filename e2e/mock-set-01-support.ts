import {test,expect} from "./release-fixtures";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {PDFDocument} from "pdf-lib";
const bank=JSON.parse(await readFile("public/bank/catalogue.json","utf8")) as {questions:{id:string;paperId:string;source:string;codes:string[];marks:number;equivalentId?:string;schemeSourceNote?:string;questionViews:unknown[];schemeViews:unknown[]}[]};
const report="coverage/mock-set-01";
export function registerPaper(component:string){
 test(`Mock Set 1 ${component}: every question route, full native question and scheme, measured percentage`,async({page})=>{
  test.setTimeout(180000);const rows=bank.questions.filter(q=>q.paperId===`1MA1_MOCK_SET_01_${component}`),proof=[];
  // Reload once per paper; exercise every remaining deep-link route through
  // the real popstate handler without repeatedly booting the entire app.
  await page.goto(`/?tool=question-bank&question=${rows[0].id}`);
  for(const q of rows){
   await page.evaluate(id=>{history.pushState({},"",`/?tool=question-bank&question=${id}`);dispatchEvent(new PopStateEvent("popstate"));},q.id);
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
   if(q.schemeSourceNote)await expect(page.locator(".qb-source-copy .qb-erratum")).toHaveText(q.schemeSourceNote);
   if(q.equivalentId)await expect(page.locator(".qb-source-copy .qb-performance")).toHaveCount(2);
   proof.push({id:q.id,question:true,scheme:true,measured:true,sourceNote:!!q.schemeSourceNote});
  }
  await mkdir(report,{recursive:true});await writeFile(`${report}/${component}.json`,JSON.stringify(proof,null,2));
  await page.screenshot({path:`${report}/${component}.png`});
 });
}
export function registerDownloads(){test("Mock Set 1: real browser downloads preserve native scale and all scheme corrections",async({page})=>{
 test.setTimeout(120000);const ids=["1MA1_MOCK_SET_01_3F_Q10","1MA1_MOCK_SET_01_1H_Q19","1MA1_MOCK_SET_01_2H_Q21"];
 await page.goto(`/?tool=question-bank&question=${ids[0]}`);
 for(const id of ids){await page.evaluate(id=>{history.pushState({},"",`/?tool=question-bank&question=${id}`);dispatchEvent(new PopStateEvent("popstate"));},id);await expect(page.locator(".qb-source-heading strong")).toHaveText(bank.questions.find(q=>q.id===id)!.source);await page.getByRole("button",{name:"Select question",exact:true}).click();}
 await page.getByRole("button",{name:"Review paper (3)",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog).toContainText("3 complete questions · 11 marks");
 await mkdir(report,{recursive:true});
 for(const preset of ["Compact practice","Writing space"]){
  await dialog.getByRole("radio",{name:preset,exact:true}).check();await dialog.getByRole("button",{name:"Prepare both PDFs",exact:true}).click();
  await expect(dialog.getByText("Both PDFs are ready",{exact:true})).toBeVisible({timeout:90000});
  for(const name of ["Questions PDF","Mark schemes PDF"]){
   const waiting=page.waitForEvent("download");await dialog.getByRole("button",{name,exact:true}).click();const destination=`${report}/${preset}-${name}.pdf`;
   await(await waiting).saveAs(destination);const pdf=await PDFDocument.load(await readFile(destination));
   expect(pdf.getSubject()).toContain("3 source questions, 11 marks");expect(pdf.getPageCount()).toBe(name==="Questions PDF"?3:5);
   expect(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe("None");
  }
 }
});
}
export function registerMobile(){test("Mock Set 1: mobile display and keyboard preserve question and answer context",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/?tool=question-bank&question=1MA1_MOCK_SET_01_2H_Q17");
 await expect(page.locator(".qb-stage canvas").first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Display",exact:true}).click();await expect(page.getByRole("button",{name:"Exit Display Esc",exact:true})).toBeVisible();await page.keyboard.press("m");
 await expect(page.locator(".qb-scheme-stage canvas").first()).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Hide mark scheme",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByRole("button",{name:"Display",exact:true})).toBeVisible();
 await mkdir(report,{recursive:true});await page.screenshot({path:`${report}/mobile.png`});
});
}
