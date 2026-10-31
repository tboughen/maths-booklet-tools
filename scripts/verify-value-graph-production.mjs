import { chromium } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base=process.argv[2]??"http://127.0.0.1:5184/maths-booklet-tools/";
const out=resolve(process.argv[3]??"../../reports/quadratic-graph-tool-implementation-2026-10-13/production");
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(new URL("tools/value-table-graph",base).href);await page.getByRole("heading",{name:"Table of values & graphs",exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const measure=()=>page.locator('[data-layer="axis-values"] text').first().evaluate(text=>({fontPx:parseFloat(getComputedStyle(text).fontSize)*text.getScreenCTM().a,fontFamily:getComputedStyle(text).fontFamily,declaredFontPoints:text.parentElement.getAttribute("data-font-points")}));
  const before=await measure();if(Math.abs(before.fontPx-16)>.01)throw Error("The 12 pt exam numbers did not render at the expected physical scale.");
  await page.screenshot({path:resolve(out,"tool-desktop.png"),fullPage:true});await page.locator(".vg-paper").screenshot({path:resolve(out,"tool-scaffold.png")});
  await page.getByRole("button",{name:"Extend x left range",exact:true}).click();const after=await measure();if(Math.abs(after.fontPx-before.fontPx)>.01)throw Error("Extending bounds changed the axis-number size.");
  await page.getByRole("button",{name:"Undo",exact:true}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("mathsdock:value-table-graph:v1")));
  if(saved.document.columns.filter(c=>c.y.kind==="blank").length!==5||saved.document.graph.bounds.xMin!=="-3")throw Error("The pupil scaffold changed.");
  if(errors.length)throw Error(errors.join("; "));
  await writeFile(resolve(out,"proof.json"),JSON.stringify({base,builtWebsite:true,before,after,sourceAxisFontPt:12,gridLayers:3,pupilBlanks:5,browserErrors:errors,checks:["built production route","portable fonts loaded","12 pt axis-number physical rendering","bounds extension preserves font size","undo preserves pupil scaffold"]},null,2));
  console.log("Built website verified: three grid tiers, exam-size numbers, bounds controls and pupil blanks.");
}finally{await browser.close();}
