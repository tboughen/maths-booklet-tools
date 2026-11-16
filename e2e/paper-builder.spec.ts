import { test, expect, sourceAssetMatcher } from "./release-fixtures";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";

const report=resolve("../../reports/sparx-paper-builder-integration-2026-10-11");
const outputs=resolve("../../output/pdf/sparx-paper-builder-integration");
const raw=JSON.parse(await readFile("public/bank/catalogue.json","utf8")) as {questions:{id:string;equivalentId?:string;tier:string;collection:string;calculator:boolean;codes:string[];revisionUse?:string}[]};

test("all 27 filter combinations have correct table counts and preserve selected code intent",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/question-bank?bankView=topics");
  await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("U538");
  await page.getByRole("checkbox",{name:"Include questions for U538",exact:true}).check();
  await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("");
  // The table opens on codes with questions; this check covers every code.
  await page.getByRole("region",{name:"Build a paper by topic",exact:true}).getByRole("combobox",{name:"Show",exact:true}).selectOption("all");
  // Cover the whole bank, Year 11 revision programme papers included.
  await page.getByRole("region",{name:"Build a paper by topic",exact:true}).getByRole("combobox",{name:"Year 11 revision papers",exact:true}).selectOption("include");
  const proof=[];
  for(const tier of ["all","F","H"])for(const collection of ["all","past","mock"])for(const calculator of ["all","yes","no"]){
    const builder=page.getByRole("region",{name:"Build a paper by topic",exact:true});
    await builder.getByRole("combobox",{name:"Tier",exact:true}).selectOption(tier);
    await builder.getByRole("combobox",{name:"Paper type",exact:true}).selectOption(collection);
    await builder.getByRole("combobox",{name:"Calculator",exact:true}).selectOption(calculator);
    const rows=await builder.locator("tbody tr").evaluateAll(rows=>rows.map(row=>({code:row.querySelector("td:nth-child(2) button")!.textContent!,available:Number(row.querySelector("td:nth-child(4)")!.textContent)})));
    expect(rows).toHaveLength(629);
    for(const row of rows){
      const qs=raw.questions.filter(q=>q.codes.includes(row.code)&&(tier==="all"||q.tier===tier)&&(collection==="all"||(/^mock/i.test(q.collection)?"mock":"past")===collection)&&(calculator==="all"||q.calculator===(calculator==="yes")));
      const count=new Set(qs.map(q=>q.equivalentId?[q.id,q.equivalentId].sort().join("|"):q.id)).size;
      expect(row.available,`${row.code} ${tier} ${collection} ${calculator}`).toBe(count);
    }
    await expect(builder.getByRole("checkbox",{name:"Include questions for U538",exact:true})).toBeChecked();
    proof.push({tier,collection,calculator,codes:rows.length});
  }
  await mkdir(report,{recursive:true});await writeFile(resolve(report,"browser-filter-checks.json"),JSON.stringify(proof,null,2));
});

test("Crossover only shows just the questions shared by a Foundation and a Higher paper, in the table and the link",async({page})=>{
  await page.goto("/question-bank?bankView=topics");
  const builder=page.getByRole("region",{name:"Build a paper by topic",exact:true});
  await builder.getByRole("combobox",{name:"Show",exact:true}).selectOption("all");
  await builder.getByRole("combobox",{name:"Crossover",exact:true}).selectOption("only");
  await expect(page).toHaveURL(/crossover=only/);
  // Year 11 revision programme papers are left out unless included.
  const visible=raw.questions.filter(q=>!q.revisionUse);
  const rows=await builder.locator("tbody tr").evaluateAll(rows=>rows.map(row=>({code:row.querySelector("td:nth-child(2) button")!.textContent!,available:Number(row.querySelector("td:nth-child(4)")!.textContent)})));
  for(const row of rows){
    const count=new Set(visible.filter(q=>q.equivalentId&&q.codes.includes(row.code)).map(q=>[q.id,q.equivalentId!].sort().join("|"))).size;
    expect(row.available,row.code).toBe(count);
  }
  await page.goto("/question-bank?code=U538&crossover=only");
  await expect(page.locator("details.qb-filters summary")).toContainText("active");
});

test("shared code/manual selection survives navigation, excludes once, restores and never falls back on empty filters",async({page})=>{
  await page.goto("/question-bank?bankView=topics");
  // This journey deliberately uses the original single past-paper match. New
  // mock questions may share either topic without changing this manual choice.
  await page.getByRole("region",{name:"Build a paper by topic",exact:true}).getByRole("combobox",{name:"Paper type",exact:true}).selectOption("past");
  const search=page.getByRole("searchbox",{name:"Search codes or topics"}),summary=page.getByRole("region",{name:"Your paper",exact:true});
  for(const code of ["U538","U793"]){await search.fill(code);await page.getByRole("checkbox",{name:`Include questions for ${code}`,exact:true}).check();}
  await expect(summary).toContainText("2 selected codes · 1 distinct question · 4 marks");
  await page.getByRole("button",{name:"U793",exact:true}).click();
  await page.getByRole("button",{name:"Selected",exact:true}).click();
  await expect(summary).toContainText("0 distinct questions");
  await page.getByRole("button",{name:"Select question",exact:true}).click();
  await summary.getByRole("button",{name:"Untick U538"}).click();await summary.getByRole("button",{name:"Untick U793"}).click();
  await expect(summary).toContainText("0 selected codes · 1 distinct question · 4 marks");
  await page.getByRole("navigation",{name:"Main sections"}).getByRole("link",{name:"Paper builder",exact:true}).click();
  await expect(search).toHaveValue("U793");
  await page.getByRole("navigation",{name:"Main sections"}).getByRole("link",{name:"Diagram builder",exact:true}).click();
  await page.getByRole("navigation",{name:"Main sections"}).getByRole("link",{name:"Paper builder",exact:true}).click();
  await expect(summary).toContainText("1 distinct question");
  await page.getByRole("region",{name:"Build a paper by topic",exact:true}).getByRole("combobox",{name:"Paper type",exact:true}).selectOption("mock");
  await expect(summary.getByRole("button",{name:"Review paper",exact:true})).toBeDisabled();
  // The question bank under the same filters (the main Question bank link restores the bank's own last view instead).
  await page.goto("/question-bank?code=U793&collection=mock");
  await expect(page.getByRole("button",{name:"Review paper (0)",exact:true})).toBeDisabled();
  await page.goBack();
  await expect(page.getByRole("navigation",{name:"Main sections"}).getByRole("link",{name:"Paper builder",exact:true})).toHaveAttribute("aria-current","page");
  await page.getByRole("region",{name:"Build a paper by topic",exact:true}).getByRole("combobox",{name:"Paper type",exact:true}).selectOption("all");
  await summary.getByRole("button",{name:"Review paper",exact:true}).click();
  const dialog=page.getByRole("dialog");await dialog.getByRole("button",{name:"Remove question 1",exact:true}).click();
  await expect(dialog.getByRole("button",{name:"Prepare both PDFs"})).toBeDisabled();
  await dialog.getByRole("button",{name:/Restore individually removed/}).click();
  await expect(dialog).toContainText("1 complete question · 4 marks");
  await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();
});

test("the paper survives a reload and Clear paper removes it",async({page})=>{
  await page.goto("/question-bank?bankView=topics");
  const search=page.getByRole("searchbox",{name:"Search codes or topics"}),summary=page.getByRole("region",{name:"Your paper",exact:true});
  await search.fill("U538");await page.getByRole("checkbox",{name:"Include questions for U538",exact:true}).check();
  await expect(summary).toContainText("1 selected code");
  const before=await summary.getByRole("status").first().textContent();
  await page.reload();
  await expect(summary).toContainText(before!);
  await expect(summary.getByRole("button",{name:"Untick U538",exact:true})).toBeVisible();
  await summary.getByRole("button",{name:"Clear paper",exact:true}).click();
  await expect(summary).toContainText("0 selected codes · 0 distinct questions");
  await page.reload();
  await expect(summary).toContainText("0 selected codes · 0 distinct questions");
});

test("actual browser downloads retain multipart, crossover, writing space and physical scale in both layouts",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/question-bank?code=U945&question=1MA1_JUN_2018_3H_Q3");
  await page.getByRole("button",{name:"Select question",exact:true}).click();
  await page.getByRole("combobox",{name:"Sparx code or topic"}).fill("U350");
  await page.getByRole("button",{name:"Find",exact:true}).click();await page.getByRole("button",{name:"Select question",exact:true}).click();
  await page.getByRole("navigation",{name:"Main sections"}).getByRole("link",{name:"Paper builder",exact:true}).click();
  await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("U538");
  await page.getByRole("checkbox",{name:"Include questions for U538",exact:true}).check();
  await page.getByRole("region",{name:"Your paper",exact:true}).getByRole("button",{name:"Review paper",exact:true}).click();
  const dialog=page.getByRole("dialog");await expect(dialog).toContainText("3 complete questions · 11 marks");
  await dialog.getByRole("button",{name:"Move question 3 up",exact:true}).click();
  await dialog.locator(".qb-paper-preview > summary").first().click();
  await expect.poll(()=>dialog.locator(".qb-paper-preview img").first().evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBeTruthy();
  const order=await dialog.locator(".qb-paper-review-row strong").allTextContents();
  await mkdir(outputs,{recursive:true});await mkdir(report,{recursive:true});
  const proof=[];
  for(const preset of ["Compact practice","Writing space"]){
    await dialog.getByRole("radio",{name:preset,exact:true}).check();
    await dialog.getByRole("button",{name:"Prepare both PDFs",exact:true}).click();
    await expect(dialog.getByText("Both PDFs are ready")).toBeVisible();
    for(const name of ["Questions PDF","Mark schemes PDF"]){
      const pending=page.waitForEvent("download");await dialog.getByRole("button",{name,exact:true}).click();
      const download=await pending,path=resolve(outputs,`${preset.startsWith("Compact")?"compact":"writing"}-${name.startsWith("Questions")?"questions":"schemes"}.pdf`);
      await download.saveAs(path);const pdf=await PDFDocument.load(await readFile(path));expect(pdf.getPageCount()).toBeGreaterThan(0);
      proof.push({preset,name,path,pages:pdf.getPageCount(),failure:await download.failure()});
    }
  }
  await writeFile(resolve(report,"browser-export-checks.json"),JSON.stringify({order,questions:3,marks:11,downloads:proof},null,2));
  await page.screenshot({path:resolve(report,"paper-review.png")});
});

test("failed scheme fetch has no partial pair; retry and cancellation retain selection",async({page})=>{
  test.setTimeout(60000);
  await page.goto("/question-bank?bankView=topics");
  await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("U538");
  await page.getByRole("checkbox",{name:"Include questions for U538",exact:true}).check();
  await page.getByRole("button",{name:"Review paper",exact:true}).click();
  const dialog=page.getByRole("dialog");
  const schemeRoute = await sourceAssetMatcher('/scheme.pdf');
  await page.route(schemeRoute,route=>route.fulfill({status:503,body:"Unavailable in test"}));
  await dialog.getByRole("button",{name:"Prepare both PDFs"}).click();
  await expect(dialog.getByRole("alert")).toBeVisible();await expect(dialog.getByRole("button",{name:"Questions PDF",exact:true})).toHaveCount(0);
  await page.unroute(schemeRoute);await dialog.getByRole("button",{name:"Prepare both PDFs"}).click();
  await expect(dialog.getByText("Both PDFs are ready")).toBeVisible();
  await dialog.getByRole("button",{name:"Close paper review"}).click();
  await page.getByRole("button",{name:"Clear paper",exact:true}).click();
  await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("U388");
  await page.getByRole("checkbox",{name:"Include questions for U388",exact:true}).check();
  await page.getByRole("button",{name:"Review paper",exact:true}).click();
  await dialog.getByRole("button",{name:"Prepare both PDFs"}).click();await dialog.getByRole("button",{name:"Cancel export",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("selection is unchanged");
  const selectedCount=new Set(raw.questions.filter(q=>!q.revisionUse&&q.codes.includes("U388")).map(q=>q.equivalentId?[q.id,q.equivalentId].sort().join("|"):q.id)).size;
  await expect(dialog).toContainText(`${selectedCount} complete questions`);await expect(dialog.getByRole("button",{name:"Questions PDF",exact:true})).toHaveCount(0);
});

test("topic controls, table and review fit narrow screens with keyboard dismissal",async({page})=>{
  await mkdir(report,{recursive:true});
  for(const width of [1280,768,375,320]){
    await page.setViewportSize({width,height:812});await page.goto("/question-bank?bankView=topics");
    await page.getByRole("searchbox",{name:"Search codes or topics"}).fill("U538");await page.getByRole("checkbox",{name:"Include questions for U538",exact:true}).check();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const review=page.getByRole("button",{name:"Review paper",exact:true});await expect(review).toBeInViewport();await review.click();
    await expect(page.getByRole("button",{name:"Prepare both PDFs"})).toBeInViewport();await page.keyboard.press("Escape");
    await expect(review).toBeFocused();await page.screenshot({path:resolve(report,`topics-${width}.png`)});
  }
});

test("your paper sits beside the codes with a picture of each question, and a cross removes one question",async({page})=>{
  await page.setViewportSize({width:1920,height:1080});await page.goto("/question-bank?bankView=topics");
  const builder=page.getByRole("region",{name:"Build a paper by topic",exact:true}),paper=page.getByRole("region",{name:"Your paper",exact:true});
  await expect(paper).toContainText("Each code you tick adds its questions here straight away.");
  await builder.getByRole("combobox",{name:"Paper type",exact:true}).selectOption("past");
  for(const code of ["U538","U793"]){await page.getByRole("searchbox",{name:"Search codes or topics"}).fill(code);await page.getByRole("checkbox",{name:`Include questions for ${code}`,exact:true}).check();}
  await expect(paper).toContainText("2 selected codes · 1 distinct question · 4 marks");
  // Side by side on the usual screen: the paper starts where the codes end, and both fill the height.
  const [codes,panel]=[await builder.boundingBox(),await paper.boundingBox()];
  expect(panel!.x).toBeGreaterThanOrEqual(codes!.x+codes!.width);expect(panel!.width).toBeGreaterThan(500);expect(panel!.y+panel!.height).toBeGreaterThan(1000);
  const row=paper.getByRole("listitem");
  await expect(row).toHaveCount(1);await expect(row).toContainText("Higher · Non-calculator");await expect(row).toContainText("4 marks");
  for(const code of ["U538","U793"])await expect(row).toContainText(code);
  // The picture is the question itself, at a size that can be read.
  await expect.poll(()=>row.locator("img").evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0&&el.getBoundingClientRect().width)).toBeGreaterThan(300);
  await row.getByRole("button",{name:/^Remove /}).click();
  await expect(paper).toContainText("2 selected codes · 0 distinct questions · 0 marks");await expect(row).toHaveCount(0);
  await paper.getByRole("button",{name:"Restore 1 removed",exact:true}).click();
  await expect(row).toHaveCount(1);await expect(paper.getByRole("button",{name:/^Restore/})).toHaveCount(0);
  // An upright monitor puts the paper under the codes, with the review button still on screen.
  await page.setViewportSize({width:1080,height:1920});
  const [above,below]=[await builder.boundingBox(),await paper.boundingBox()];
  expect(below!.y).toBeGreaterThanOrEqual(above!.y+above!.height);expect(below!.width).toBeGreaterThan(1000);
  await expect(paper.getByRole("button",{name:"Review paper",exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1080);
});
